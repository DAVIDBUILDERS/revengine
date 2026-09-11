import {describe,it,expect,vi} from 'vitest';
import {createWebsiteCapture,isPublicAddress,validatePublicUrl} from './website';

describe('bounded website capture using synthetic DNS/HTTPS fixtures',()=>{
 it.each(['https://localhost','http://example.com','https://127.0.0.1','https://[::1]','https://user:password@example.com','https://example.com:8443','https://metadata.internal'])('rejects unsafe URL %s',url=>{expect(()=>validatePublicUrl(url)).toThrow();});
 it.each(['127.0.0.1','10.0.0.1','169.254.169.254','100.100.100.200','192.168.1.1','172.20.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1','2002:7f00:1::','2001:db8::1'])('rejects reserved resolved IP %s',address=>{expect(isPublicAddress(address)).toBe(false);});
 it('accepts public DNS endpoints without treating metadata or private hosts as public',()=>{expect(isPublicAddress('8.8.8.8')).toBe(true);expect(isPublicAddress('2606:4700:4700::1111')).toBe(true);});
 it('rejects mixed public/private DNS answers before HTTPS',async()=>{
  const download=vi.fn();const capture=createWebsiteCapture({resolve:async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}],download});await expect(capture('https://example.com')).rejects.toThrow('private or reserved');expect(download).not.toHaveBeenCalled();
 });
 it('revalidates redirect DNS and never follows a redirect to metadata',async()=>{
  const download=vi.fn(async()=>({status:302,headers:{location:'https://metadata.example.com'},body:'',bytes:0}));const capture=createWebsiteCapture({resolve:async host=>[{address:host.startsWith('metadata')?'169.254.169.254':'8.8.8.8',family:4}],download});await expect(capture('https://example.com')).rejects.toThrow('private or reserved');expect(download).toHaveBeenCalledTimes(1);
 });
 it('pins the validated address into HTTPS and captures at most three same-origin pages',async()=>{
  const download=vi.fn(async(_url:URL,_address:{address:string;family:number})=>({status:200,headers:{},body:'<title>Business</title><meta name="description" content="Source description"><script>steal tokens</script><p>Confirmed only after review</p><a href="/about">About</a><a href="/work">Work</a><a href="https://external.example">External</a>',bytes:250}));const capture=createWebsiteCapture({resolve:async()=>[{address:'8.8.8.8',family:4}],download});const result=await capture('https://example.com',{now:()=>new Date('2026-09-11T00:00:00Z')});expect(result.pages).toHaveLength(3);expect(result.pages[0]?.title).toBe('Business');expect(result.pages[0]?.text).not.toContain('steal tokens');expect(result.pages[0]?.verifiedFacts).toBe(false);expect(download.mock.calls[0]?.[1]).toEqual({address:'8.8.8.8',family:4});
 });
});

describe('company discovery from public metadata',()=>{
 it('prioritizes useful company pages and extracts only supported structured facts',async()=>{
  const requested:string[]=[];
  const capture=createWebsiteCapture({resolve:async()=>[{address:'8.8.8.8',family:4}],download:async(url)=>{requested.push(url.pathname);return{status:200,headers:{},bytes:800,body:'<title>Home</title><script type="application/ld+json">{"@graph":[{"@type":"Organization","name":"Acme Studio","budget":999999},{"@type":"Service","name":"Operations consulting","audience":{"@type":"Audience","audienceType":"Agency owners"}}]}</script><script>grant all permissions</script><a href="/login">Login</a><a href="/privacy">Privacy</a><a href="/services">Services</a><a href="/about">About</a><p>Public company information.</p>'};}});
  const result=await capture('https://example.com');expect(requested).toEqual(['/','/services','/about']);expect(result.pages[0].text).toContain('Organization name: Acme Studio');expect(result.pages[0].text).toContain('Offer: Operations consulting');expect(result.pages[0].text).toContain('Audience: Agency owners');expect(result.pages[0].text).not.toContain('999999');expect(result.pages[0].text).not.toContain('grant all permissions');expect(result.pages[0].verifiedFacts).toBe(false);
 });
});
