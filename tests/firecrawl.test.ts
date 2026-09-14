import {describe,it,expect,vi} from 'vitest';
import {createFirecrawlCapture} from '../packages/connectors/src/firecrawl';
const resolve=async()=>[{address:'93.184.216.34'}];
const ok=(links:string[]=[])=>Response.json({success:true,data:{markdown:'# Company\nServices for customers',links,metadata:{title:'Company',statusCode:200}}});
describe('Firecrawl website capture',()=>{
 it('uses the fixed authenticated provider and bounds follow-up pages to relevant same-origin links',async()=>{
  const send=vi.fn<typeof fetch>().mockImplementation(async()=>ok(['https://company.example/about','https://company.example/services','https://evil.example/about','https://company.example/products']));
  const result=await createFirecrawlCapture({fetch:send,resolve,key:()=> 'test-secret'})('https://company.example');
  expect(result.provider).toBe('firecrawl');expect(result.pages).toHaveLength(3);expect(result.pages.every(p=>!p.verifiedFacts&&p.hash.length===64)).toBe(true);
  expect(send).toHaveBeenCalledTimes(3);
  const [url,init]=send.mock.calls[0];expect(url).toBe('https://api.firecrawl.dev/v2/scrape');expect(init?.headers).toHaveProperty('Authorization','Bearer test-secret');
  expect(JSON.parse(String(init?.body))).toMatchObject({formats:['markdown','links'],parsers:[],skipTlsVerification:false});
 });
 it('never calls the provider for missing credentials or private DNS',async()=>{
  const send=vi.fn<typeof fetch>();
  await expect(createFirecrawlCapture({fetch:send,resolve,key:()=>undefined})('https://company.example')).rejects.toMatchObject({code:'FIRECRAWL_UNCONFIGURED'});
  await expect(createFirecrawlCapture({fetch:send,resolve:async()=>[{address:'127.0.0.1'}],key:()=> 'test'})('https://company.example')).rejects.toMatchObject({code:'WEBSITE_URL_INVALID'});
  expect(send).not.toHaveBeenCalled();
 });
 it('sanitizes provider failures instead of leaking response content or pretending capture succeeded',async()=>{
  for(const status of [401,402,429,500]){
   const send=vi.fn<typeof fetch>().mockResolvedValue(new Response('sensitive provider body',{status}));
   await expect(createFirecrawlCapture({fetch:send,resolve,key:()=> 'test'})('https://company.example')).rejects.toMatchObject({code:'FIRECRAWL_REJECTED'});
  }
 });
 it('keeps partial captures with explicit limitations',async()=>{
  const send=vi.fn<typeof fetch>().mockResolvedValueOnce(ok(['https://company.example/about'])).mockResolvedValueOnce(new Response('',{status:500}));
  const result=await createFirecrawlCapture({fetch:send,resolve,key:()=> 'test'})('https://company.example');
  expect(result.pages).toHaveLength(1);expect(result.limitations).toHaveLength(2);
 });
 it('rejects empty or oversized responses',async()=>{
  for(const response of [Response.json({success:true,data:{markdown:' '}}),new Response('x'.repeat(1000001))]){
   await expect(createFirecrawlCapture({fetch:vi.fn<typeof fetch>().mockResolvedValue(response),resolve,key:()=> 'test'})('https://company.example')).rejects.toThrow();
  }
 });
});
