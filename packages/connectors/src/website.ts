import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { createHash } from 'node:crypto';

const blocked=new BlockList();
for(const [network,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)blocked.addSubnet(network,prefix,'ipv4');
const publicV6=new BlockList();publicV6.addSubnet('2000::',3,'ipv6');
for(const [network,prefix] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]] as const)blocked.addSubnet(network,prefix,'ipv6');
export function isPublicAddress(address:string):boolean {const family=isIP(address);return family===4?!blocked.check(address,'ipv4'):family===6?publicV6.check(address,'ipv6')&&!blocked.check(address,'ipv6'):false;}
export function validatePublicUrl(input:string):URL {
  if(input.length>2048)throw new Error('Website URL exceeds 2048 characters');
  const url=new URL(input);
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443'))throw new Error('Only public HTTPS pages on port 443 are supported');
  const hostname=url.hostname.replace(/^\[|\]$/g,'').toLowerCase();
  if(isIP(hostname)||hostname==='localhost'||hostname.endsWith('.localhost')||hostname.endsWith('.local')||hostname.endsWith('.internal')||!hostname.includes('.'))throw new Error('Public DNS hostname required');
  url.hash='';return url;
}
export type WebsiteSnapshot={url:string;fetchedAt:string;hash:string;title:string;description:string;text:string;links:string[];bytes:number;verifiedFacts:false};
export type CaptureOptions={maxPages?:number;maxBytesPerPage?:number;maxTotalBytes?:number;timeoutMs?:number;now?:()=>Date};
type Resolver=(hostname:string)=>Promise<{address:string;family:number}[]>;
type Downloader=(url:URL,address:{address:string;family:number},options:{maxBytes:number;timeoutMs:number})=>Promise<{status:number;headers:Record<string,string|undefined>;body:string;bytes:number}>;
async function download(url:URL,address:{address:string;family:number},options:{maxBytes:number;timeoutMs:number}):ReturnType<Downloader> {
 return await new Promise((resolve,reject)=>{
  // DNS was checked before this call. Pin lookup to that address, while retaining original TLS servername.
  const req=httpsRequest(url,{method:'GET',agent:false,servername:url.hostname,rejectUnauthorized:true,headers:{'User-Agent':'DAVID-Website-Capture/1.0','Accept':'text/html,text/plain;q=0.9','Accept-Encoding':'identity'},lookup:((_hostname:unknown,lookupOptions:unknown,callback:unknown)=>{const cb=callback as (...args:unknown[])=>void;if((lookupOptions as {all?:boolean}).all)cb(null,[address]);else cb(null,address.address,address.family);}) as NonNullable<Parameters<typeof httpsRequest>[1]>['lookup']},res=>{
   const status=res.statusCode??0; const headers=Object.fromEntries(Object.entries(res.headers).map(([key,value])=>[key,Array.isArray(value)?value.join(','):value]));
   if(status>=300&&status<400){res.resume();resolve({status,headers,body:'',bytes:0});return;}
   if(Number(headers['content-length']??0)>options.maxBytes){res.destroy();reject(new Error('Website page exceeds capture size limit'));return;}
   if(headers['content-encoding']&&headers['content-encoding']!=='identity'){res.destroy();reject(new Error('Compressed website response is unsupported'));return;}
   if(!/^(text\/html|text\/plain)(;|$)/i.test(headers['content-type']??'')){res.destroy();reject(new Error('Website content type is unsupported'));return;}
   const chunks:Buffer[]=[];let bytes=0;
   res.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>options.maxBytes){res.destroy(new Error('Website page exceeds capture size limit'));return;}chunks.push(chunk);});
   res.on('error',reject);res.on('end',()=>resolve({status,headers,body:Buffer.concat(chunks).toString('utf8'),bytes}));
  });
  const timer=setTimeout(()=>req.destroy(new Error('Website capture timed out')),options.timeoutMs);req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end();
 });
}
function decodeText(value:string){return value.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');}
function parsePage(url:URL,html:string,bytes:number,at:string):WebsiteSnapshot {
 const stripped=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ');
 const title=decodeText(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(stripped)?.[1]??'').trim().slice(0,250);
 const descriptionTag=(stripped.match(/<meta\s[^>]*>/gi)??[]).find(tag=>/name\s*=\s*["']description["']/i.test(tag));
 const description=decodeText(/content\s*=\s*["']([^"']*)/i.exec(descriptionTag??'')?.[1]??'').slice(0,1000);
 const text=decodeText(stripped.replace(/<[^>]{0,10000}>/g,' ')).replace(/\s+/g,' ').trim().slice(0,30000);
 const links:string[]=[];for(const match of stripped.matchAll(/<a\s[^>]{0,2000}href\s*=\s*["']([^"']{1,2000})["']/gi)){try{const link=validatePublicUrl(new URL(decodeText(match[1]!),url).href);if(link.origin===url.origin&&!links.includes(link.href))links.push(link.href);}catch{/* unsupported links never fetched */}if(links.length>=30)break;}
 return{url:url.href,fetchedAt:at,hash:createHash('sha256').update(html).digest('hex'),title,description,text,links,bytes,verifiedFacts:false};
}
/** Dependency injection is only for deterministic network fixtures; production always pins validated DNS. */
export function createWebsiteCapture(dependencies:{resolve?:Resolver;download?:Downloader}={}) {
 const resolve=dependencies.resolve??(host=>dnsLookup(host,{all:true,verbatim:true}));const get=dependencies.download??download;
 return async function capture(input:string,options:CaptureOptions={}):Promise<{pages:WebsiteSnapshot[];limitations:string[]}> {
  const maxPages=Math.min(3,Math.max(1,options.maxPages??3));const maxBytes=Math.min(512000,Math.max(1024,options.maxBytesPerPage??256000));const totalLimit=Math.min(1000000,options.maxTotalBytes??750000);const timeoutMs=Math.min(8000,Math.max(500,options.timeoutMs??5000));
  const start=Date.now();const queue=[validatePublicUrl(input)];const pages:WebsiteSnapshot[]=[];const visited=new Set<string>();const limitations:string[]=[];let total=0;
  while(queue.length&&pages.length<maxPages){
   let url=queue.shift()!;if(visited.has(url.href))continue;visited.add(url.href);
   try {
    let loaded:Awaited<ReturnType<Downloader>>|null=null;
    for(let redirect=0;redirect<=3;redirect++){
     if(Date.now()-start>20000)throw new Error('Website capture total time limit reached');
     const addresses=await Promise.race([resolve(url.hostname),new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Website DNS timeout')),2000);timer.unref();})]);
     if(!addresses.length||addresses.some(result=>!isPublicAddress(result.address)))throw new Error('Website DNS resolves to a private or reserved address');
     loaded=await get(url,addresses[0]!,{maxBytes:Math.min(maxBytes,totalLimit-total),timeoutMs});
     if(loaded.status>=300&&loaded.status<400){if(redirect===3||!loaded.headers.location)throw new Error('Website redirect limit reached');url=validatePublicUrl(new URL(loaded.headers.location,url).href);continue;}break;
    }
    if(!loaded||loaded.status!==200)throw new Error('Website page is inaccessible');
    total+=loaded.bytes;if(total>totalLimit)throw new Error('Website capture total size limit reached');
    const page=parsePage(url,loaded.body,loaded.bytes,(options.now?.()??new Date()).toISOString());pages.push(page);
    if(pages.length===1){for(const link of page.links.slice(0,2))queue.push(new URL(link));}
   }catch(error){limitations.push(`${url.origin}: ${error instanceof Error?error.message:'Capture unavailable'}`);}
  }
  if(!pages.length)throw new Error(limitations.join('; ')||'No accessible website pages');
  return{pages,limitations:[...limitations,`Captured ${pages.length} page(s), maximum ${maxPages}; source text is untrusted and facts require confirmation. No forms or page scripts were executed.`]};
 };
}
export const captureWebsite=createWebsiteCapture();
