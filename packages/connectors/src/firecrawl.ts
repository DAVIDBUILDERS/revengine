import {createHash} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {z} from 'zod';
import {isPublicAddress,validatePublicUrl,type WebsiteSnapshot} from './website';

export class WebsiteCaptureError extends Error {
 constructor(public code:string,message:string,public status=502){super(message);}
}
const resultSchema=z.object({success:z.literal(true),data:z.object({
 markdown:z.string().min(1),links:z.array(z.string()).optional(),
 metadata:z.object({title:z.string().nullish(),description:z.string().nullish(),sourceURL:z.string().nullish(),statusCode:z.number().nullish()}).passthrough().optional(),
})});
/** Fixed provider endpoint; never send credentials to a customer-supplied URL. */
export function createFirecrawlCapture(deps:{fetch?:typeof fetch;resolve?:(host:string)=>Promise<{address:string}[]>;key?:()=>string|undefined}={}){
 const send=deps.fetch??fetch,resolve=deps.resolve??(host=>lookup(host,{all:true})),key=deps.key??(()=>process.env.FIRECRAWL_API_KEY);
 return async(input:string):Promise<{pages:WebsiteSnapshot[];limitations:string[];provider:'firecrawl'}>=>{
  const secret=key()?.trim();
  if(!secret)throw new WebsiteCaptureError('FIRECRAWL_UNCONFIGURED','Website research needs administrator setup: configure FIRECRAWL_API_KEY.',503);
  const deadline=AbortSignal.timeout(45000);
  async function publicUrl(value:string){
   let url:URL;try{url=validatePublicUrl(value);}catch{throw new WebsiteCaptureError('WEBSITE_URL_INVALID','Enter a public HTTPS website address.',400);}
   const addresses=await Promise.race([resolve(url.hostname),new Promise<never>((_,reject)=>{const t=setTimeout(()=>reject(new WebsiteCaptureError('WEBSITE_DNS_FAILED','The website address could not be resolved.')),2000);t.unref();})]);
   if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address)))throw new WebsiteCaptureError('WEBSITE_URL_INVALID','Only publicly accessible websites can be researched.',400);
   return url;
  }
  async function scrape(value:string):Promise<WebsiteSnapshot>{
   const url=await publicUrl(value);
   let response:Response;
   try{response=await send('https://api.firecrawl.dev/v2/scrape',{method:'POST',redirect:'error',signal:deadline,headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'},body:JSON.stringify({url:url.href,formats:['markdown','links'],onlyMainContent:true,timeout:20000,parsers:[],skipTlsVerification:false})});}
   catch{throw new WebsiteCaptureError('FIRECRAWL_UNAVAILABLE','Website research timed out or could not reach Firecrawl. Try again.');}
   if(!response.ok){await response.body?.cancel();throw new WebsiteCaptureError('FIRECRAWL_REJECTED',response.status===401||response.status===403?'Firecrawl credentials were rejected. Ask your administrator to check the API key.':response.status===402||response.status===429?'Firecrawl credits or request capacity are exhausted. Ask your administrator to check the account.':'Firecrawl could not capture this website. Try again or supply another source.');}
   const reader=response.body?.getReader();if(!reader)throw new WebsiteCaptureError('FIRECRAWL_EMPTY','Firecrawl returned no website content.');
   const chunks:Uint8Array[]=[];let bytes=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>1000000)throw new WebsiteCaptureError('FIRECRAWL_SIZE','This page exceeds the website research size limit.');chunks.push(value);}}
   finally{await reader.cancel();}
   let parsed:z.infer<typeof resultSchema>;
   try{parsed=resultSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{throw new WebsiteCaptureError('FIRECRAWL_EMPTY','Firecrawl did not return readable website content. Try another source.');}
   const data=parsed.data;if((data.metadata?.statusCode??200)>=400)throw new WebsiteCaptureError('WEBSITE_INACCESSIBLE','The website returned an error page. Try another source.');
   const finalUrl=data.metadata?.sourceURL?await publicUrl(data.metadata.sourceURL):url;
   const text=data.markdown.trim().slice(0,30000);if(!text)throw new WebsiteCaptureError('FIRECRAWL_EMPTY','No readable text was found on this page.');
   const links:string[]=[];
   for(const href of data.links??[]){try{const link=validatePublicUrl(new URL(href,finalUrl).href);if(link.origin===finalUrl.origin&&!links.includes(link.href))links.push(link.href);}catch{/* Unsupported links are never submitted. */}if(links.length===30)break;}
   return{url:finalUrl.href,fetchedAt:new Date().toISOString(),hash:createHash('sha256').update(text).digest('hex'),title:(data.metadata?.title??'').slice(0,250),description:(data.metadata?.description??'').slice(0,1000),text,links,bytes,verifiedFacts:false};
  }
  const first=await scrape(input),pages=[first],limitations:string[]=[];
  const links=first.links.filter(l=>l!==first.url&&/about|services|solutions|products|customers/i.test(new URL(l).pathname)).slice(0,2);
  const extra=await Promise.allSettled(links.map(scrape));
  for(const result of extra){if(result.status==='fulfilled')pages.push(result.value);else limitations.push(result.reason instanceof WebsiteCaptureError?result.reason.message:'An additional website page could not be captured.');}
  return{provider:'firecrawl',pages,limitations:[...limitations,`Captured ${pages.length} public page(s) through Firecrawl, maximum 3. Website content is untrusted; company facts require owner confirmation. No form submissions or custom browser actions were requested.`]};
 };
}
export const captureWebsiteWithFirecrawl=createFirecrawlCapture();
