// Explicit, opt-in integration harness. Creates labeled test Auth users/workspaces; never production.
import './runtime';
import {writeFileSync,mkdirSync} from 'node:fs';import {randomUUID,randomBytes} from 'node:crypto';import {createClient} from '@supabase/supabase-js';import {chromium,expect as baseExpect,type BrowserContext} from '@playwright/test';import {execFileSync} from 'node:child_process';
const expect=baseExpect.configure({timeout:15000});
const routingOnly=process.argv.includes('--routing-only');
const env={APP_ORIGIN:process.env.TEST_APP_ORIGIN,EXPECTED_SUPABASE_PROJECT_ID:process.env.TEST_SUPABASE_PROJECT_ID,PRODUCTION_SUPABASE_PROJECT_ID:process.env.PRODUCTION_SUPABASE_PROJECT_ID,NEXT_PUBLIC_SUPABASE_URL:process.env.TEST_SUPABASE_PROJECT_ID?`https://${process.env.TEST_SUPABASE_PROJECT_ID}.supabase.co`:undefined};const bypass=process.env.TEST_VERCEL_BYPASS_SECRET;
if(!env.APP_ORIGIN||!env.EXPECTED_SUPABASE_PROJECT_ID||!env.PRODUCTION_SUPABASE_PROJECT_ID||!env.NEXT_PUBLIC_SUPABASE_URL||!bypass)throw new Error('HOSTED_TEST_CONFIGURATION_REQUIRED');
const origin=env.APP_ORIGIN;if(env.EXPECTED_SUPABASE_PROJECT_ID===env.PRODUCTION_SUPABASE_PROJECT_ID||origin!=='https://revengine-test.vercel.app')throw new Error('TEST_TARGET_REQUIRED');
const keys=JSON.parse(execFileSync('supabase',['projects','api-keys','--project-ref',env.EXPECTED_SUPABASE_PROJECT_ID,'--output','json'],{stdio:['ignore','pipe','ignore']}).toString());const key=keys.find((x:{name:string})=>x.name==='service_role').api_key;
const admin=createClient(env.NEXT_PUBLIC_SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});
mkdirSync('artifacts',{recursive:true});const marker=randomUUID();const browser=await chromium.launch();const evidence:{check:string;result:string}[]=[];
const check=(name:string)=>{evidence.push({check:name,result:'PASS'});console.log('PASS',name)};
const userRecords:{email:string;password:string;id:string;workspaceId?:string}[]=[];
try{
 const contexts:BrowserContext[]=[];
 for(const letter of ['a','b']){
  const email=`revengine-hosted-${marker}-${letter}@example.invalid`,password=randomBytes(24).toString('base64url');
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{purpose:'isolated hosted onboarding test'}});if(error||!data.user)throw new Error('Test Auth actor creation failed');
  userRecords.push({email,password,id:data.user.id});writeFileSync('.env.hosted-test-actors.local',JSON.stringify(userRecords),{mode:0o600});
  const context=await browser.newContext();await context.route(origin+'/**',async route=>{await route.continue({headers:{...route.request().headers(),'x-vercel-protection-bypass':bypass}})});contexts.push(context);
  const page=await context.newPage();await page.goto(origin+'/login');await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(origin+'/start',{timeout:60000});
  await expect(page.getByRole('heading',{name:'What’s your company called?'})).toBeVisible();
  check(`New account ${letter} is routed from login directly to company setup`);
  await page.goto(origin+'/?view=activation');await page.waitForURL(origin+'/start',{timeout:60000});
  check(`Account ${letter} without a workspace is routed from the dashboard to setup`);
  await page.getByLabel('Company name',{exact:true}).fill(`Hosted onboarding ${marker} ${letter}`);await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('button',{name:'Create workspace',exact:true}).click();await page.waitForURL(/workspace=/,{timeout:30000});
  const workspaceId=new URL(page.url()).searchParams.get('workspace')!;userRecords.at(-1)!.workspaceId=workspaceId;writeFileSync('.env.hosted-test-actors.local',JSON.stringify(userRecords),{mode:0o600});
  await expect(page.getByRole('heading',{name:'Your team',exact:true})).toBeVisible();
  check(`Authenticated ${letter} created a private workspace in the deployed app`);
  await page.goto(origin+'/login');await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('workspace')===workspaceId,{timeout:60000});await expect(page.getByRole('heading',{name:'Your team',exact:true})).toBeVisible();check(`Returning account ${letter} opens its existing workspace`);
 }
 const page=contexts[0].pages()[0];const a=userRecords[0].workspaceId!,b=userRecords[1].workspaceId!;
 const api=async(path:string,body?:unknown)=>{
  const r=await contexts[0].request.fetch(origin+path,{method:body?'POST':'GET',headers:{'x-vercel-protection-bypass':bypass,...(body?{'Origin':origin}: {})},...(body?{data:body}:{})});return {status:r.status(),body:await r.json()};
 };
 const denied=await api('/api/state?workspace='+b);expect(denied.status).toBe(403);check('Cross-workspace read denied');
 if(process.argv.includes('--capture-unconfigured')){const capture=await api('/api/context/capture',{workspaceId:a,url:'https://getdavid.ai'});expect(capture.status).toBe(503);expect(capture.body.error).toBe('FIRECRAWL_UNCONFIGURED');check('Missing Firecrawl credentials produce explicit setup error without fallback');}
 if(!routingOnly){
 await page.goto(origin+'/?view=activation&workspace='+a);
 await page.getByRole('button',{name:'Let’s begin'}).click();
 await page.getByLabel('Company website',{exact:true}).fill('https://example.com');await page.getByLabel('Company website',{exact:true}).press('Enter');
 await page.getByLabel('Your name',{exact:true}).fill('Hosted test owner');await page.getByRole('button',{name:'Continue',exact:false}).click();
 await page.getByRole('radio',{name:/Get more qualified leads/}).check();await page.getByRole('button',{name:'Continue',exact:false}).click();
 await page.getByRole('button',{name:'Review what we found'}).waitFor({timeout:45000});await page.getByRole('button',{name:'Review what we found'}).click();
 await expect(page.getByRole('heading',{name:/What’s your main offer|Who do you help|Here’s what we learned/})).toBeVisible();
 if(await page.getByLabel('Main offer',{exact:true}).isVisible()){await page.getByLabel('Main offer',{exact:true}).fill('Implementation consulting');await page.getByRole('button',{name:'Continue',exact:false}).click();}
 await expect(page.getByRole('heading',{name:/Who do you help|Here’s what we learned/})).toBeVisible();
 if(await page.getByLabel('Ideal customers',{exact:true}).isVisible()){await page.getByLabel('Ideal customers',{exact:true}).fill('Business owners');await page.getByRole('button',{name:'Continue',exact:false}).click();}
 await page.getByRole('button',{name:'That’s right'}).click();await page.getByRole('button',{name:'Start with this task'}).click();await page.getByRole('button',{name:'Confirm this source'}).click();
 check('Actual HTTPS capture supports a reviewed company summary; owner supplied missing facts');
 await expect(page.getByRole('heading',{name:/What’s a comfortable spending limit|Review this preparation permission/})).toBeVisible();
 if(await page.getByLabel('Daily model budget (USD)').isVisible()){
  await page.getByLabel('Daily model budget (USD)').fill('0');await expect(page.getByText('Saved to this workspace',{exact:true})).toBeVisible();await page.reload();await expect(page.getByLabel('Daily model budget (USD)')).toHaveValue('0');
  check('Autosaved answers and zero spending limit survive reload from Supabase');
  await page.getByRole('button',{name:'Continue',exact:false}).click();
 }else{
  await expect(page.getByText('Saved to this workspace',{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'Review this preparation permission.'})).toBeVisible();
  const saved=await api('/api/state?workspace='+a);expect(saved.body.onboarding.answers.briefing.task).toBe('technical-seo-monitor');
  check('Model-free recommendation skips spending questions and resumes from Supabase');
 }
 await page.getByLabel(/I approve this internal preparation limit/).check();await page.getByRole('button',{name:'Approve this preparation setup'}).click();await expect(page.getByRole('heading',{name:/Your first step/})).toBeVisible({timeout:60000});
 const state=await api('/api/state?workspace='+a);expect(state.status).toBe(200);expect(state.body.workspace.mode).toBe('shadow');expect(state.body.workspace.paused).toBe(true);expect(state.body.onboardingCapture.fixture).toBe(false);expect(state.body.onboarding.appliedRevision).toBe(state.body.onboarding.revision);
 check('Explicitly reviewed preparation setup applied with execution paused and spending disabled');
 }
 const updateDenied=await api('/api/command?workspace='+b,{type:'build_setup',goal:'demand',expectedRevision:0,expectedGeneration:0});expect(updateDenied.status).toBe(403);check('Cross-workspace mutation denied');
 const wrongOrigin=await contexts[0].request.post(origin+'/api/command?workspace='+a,{headers:{'x-vercel-protection-bypass':bypass,Origin:'https://untrusted.example'},data:{type:'build_setup',goal:'demand',expectedRevision:0,expectedGeneration:0}});expect(wrongOrigin.status()).toBe(403);check('Cross-origin mutation denied');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'artifacts/hosted-onboarding.png',fullPage:true});
 await contexts[0].request.post(origin+'/api/auth/signout',{headers:{'x-vercel-protection-bypass':bypass,Origin:origin}});
 const after=await api('/api/state?workspace='+a);expect(after.status).toBe(401);check('Signed-out session denied');
 writeFileSync('artifacts/hosted-onboarding-evidence.json',JSON.stringify({at:new Date().toISOString(),scope:routingOnly?'login and workspace routing':'complete onboarding',origin,project:env.EXPECTED_SUPABASE_PROJECT_ID,marker,evidence,limitations:['Test Auth users confirmed administratively; no email delivered.','No Google OAuth/model/provider execution tested.']},null,2));
}catch(e){console.error((e as Error).message);console.log('Completed checks:',evidence.length);for(const c of browser.contexts()){for(const p of c.pages()){console.log((await p.locator('body').innerText()).slice(-3500));}}process.exitCode=1}finally{await browser.close()}
