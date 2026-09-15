import {test,expect,type Page} from '@playwright/test';
import {createFixtureState,executeCommand,snapshot} from '../../packages/domain/src/index';
/** HTTP fixtures exercise UI failure handling, not provider or hosted-auth success. */
async function apiFixture(page:Page){
 const fixture=createFixtureState();fixture.artifacts=[];fixture.activation.milestone='not_started';fixture.activation.confirmedFacts=false;
 let failSave=false;
 const present=()=>({...snapshot(fixture),workspace:{...fixture.workspace,mode:'shadow'},setupIdentity:{email:'owner@example.invalid',name:'Known Owner'},preparationRuntime:{configured:false,message:'Fixture: provider setup missing'}});
 await page.route('**/api/workspaces',r=>r.fulfill({json:{workspaces:[{id:fixture.workspace.id,name:fixture.workspace.name}]}}));
 await page.route('**/api/state*',r=>r.fulfill({json:present()}));
 await page.route('**/api/command*',async r=>{
  const input=r.request().postDataJSON();
  if(input.type==='save_onboarding'&&failSave){failSave=false;await r.fulfill({status:503,json:{message:'Fixture save failure'}});return;}
  try{await executeCommand(fixture,input);await r.fulfill({json:{snapshot:present(),message:'Fixture saved'}});}catch(e){await r.fulfill({status:409,json:{message:e instanceof Error?e.message:'Fixture denied'}});}
 });
 return {fixture,failNext:()=>{failSave=true;}};
}
test('failed autosave retries without lost answers; known name reused; failed research continues manually',async({page})=>{
 const api=await apiFixture(page);
 await page.route('**/api/context/capture',r=>r.fulfill({status:502,json:{message:'Fixture: website unavailable'}}));
 await page.goto('/?view=activation');await page.getByRole('button',{name:'Let’s begin'}).click();
 await page.getByLabel('Company website').fill('example.com');await page.getByLabel('Company website').press('Enter');
 await expect(page.getByRole('heading',{name:'What would make the biggest difference right now?'})).toBeVisible();await expect(page.getByLabel('Your name',{exact:true})).toHaveCount(0);
 api.failNext();await page.getByRole('checkbox',{name:/Turn more inquiries into customers/}).check();
 await expect(page.getByRole('button',{name:'Retry saving'})).toBeVisible();await expect(page.getByRole('checkbox',{name:/Turn more inquiries into customers/})).toBeChecked();
 await page.getByRole('button',{name:'Retry saving'}).click();await expect(page.getByText('Saved to this workspace',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('checkbox',{name:/Turn more inquiries into customers/})).toBeChecked();
 await page.getByRole('button',{name:'Continue',exact:false}).click();await page.getByRole('button',{name:'Continue with my own answers'}).click();
 await page.getByLabel('Main offer',{exact:true}).fill('Studio consulting');await page.getByLabel('Main offer',{exact:true}).press('Enter');await expect(page.getByLabel('Main offer',{exact:true})).toHaveValue('Studio consulting\n');
 await page.getByRole('button',{name:'Continue',exact:false}).click();await page.getByLabel('Ideal customers').fill('Studio owners');await page.getByRole('button',{name:'Continue',exact:false}).click();await page.getByRole('button',{name:'That’s right'}).click();
 await expect(page.getByLabel('Desired visitor action')).toBeVisible();
});
test('late website response after a different saved URL is ignored and OAuth-style return resumes saved screen',async({page})=>{
 await apiFixture(page);
 let release:(()=>void)|undefined;const wait=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/context/capture',async r=>{await wait;await r.fulfill({json:{capture:{id:'00000000-0000-4000-8000-000000000010',sourceHash:'a'.repeat(64),context:{fixture:false,pages:[{url:'https://abandoned.example/',title:'Abandoned company',description:'',text:'Offers: Abandoned offer',capturedAt:new Date().toISOString()}]}}}});});
 await page.goto('/?view=activation');await page.getByRole('button',{name:'Let’s begin'}).click();await page.getByLabel('Company website').fill('abandoned.example');await page.getByLabel('Company website').press('Enter');
 await expect(page.getByRole('heading',{name:'What would make the biggest difference right now?'})).toBeVisible();await page.getByRole('button',{name:'Back',exact:false}).click();await page.getByRole('button',{name:'I don’t have a website'}).click();
 release!();await page.getByLabel('Business description').fill('Our current description');await page.getByRole('button',{name:'Continue',exact:false}).click();await page.getByRole('checkbox',{name:/Get more qualified leads/}).check();await page.getByRole('button',{name:'Continue',exact:false}).click();
 await page.goto('/?view=activation');await expect(page.getByRole('heading',{name:'Let’s fill in just the essentials.'})).toBeVisible();await expect(page.getByText('Abandoned company')).toHaveCount(0);
});
test('new owners enter company connections, existing work returns to dashboard, and viewer controls remain read-only',async({page})=>{
 const {fixture}=await apiFixture(page);
 await page.goto('/');await expect(page.getByRole('heading',{name:'Connections',exact:true})).toBeVisible();
 fixture.activation.milestone='preparation_artifact';await page.goto('/');await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
 fixture.context.role='workspace_viewer';await page.goto('/?view=activation');await expect(page.getByRole('button',{name:'Let’s begin'})).toBeDisabled();await expect(page.getByText(/A workspace owner must save answers/)).toBeVisible();
});
test('choice shortcuts and Enter work from the heading; website input autosaves before continuing',async({page})=>{
 await apiFixture(page);await page.goto('/?view=activation');await expect(page.getByRole('heading',{name:/Let’s get to know/})).toBeVisible();await page.keyboard.press('Enter');await expect(page.getByLabel('Company website',{exact:true})).toBeVisible();
 await page.getByLabel('Company website',{exact:true}).fill('example.com');await expect(page.getByText('Saved to this workspace',{exact:true})).toBeVisible();await page.reload();await expect(page.getByLabel('Company website',{exact:true})).toHaveValue('example.com');
 await page.getByRole('button',{name:'I don’t have a website'}).click();await page.getByLabel('Business description').fill('Company description');await page.getByRole('button',{name:'Continue',exact:false}).click();
 await expect(page.getByRole('heading',{name:'What would make the biggest difference right now?'})).toBeVisible();await page.keyboard.press('4');await expect(page.getByRole('checkbox',{name:'Something else'})).toBeChecked();await page.keyboard.press('Enter');await expect(page.getByLabel('Your objective')).toBeVisible();
});
test('saved first-task screens resume on the saved business context instead of a starting task',async({page})=>{
 const {fixture}=await apiFixture(page);
 const {Briefing}=await import('../../packages/contracts/src/index');
 const {onboardingFor}=await import('../../packages/domain/src/onboarding');
 const answers=onboardingFor(fixture).answers;answers.company.offers=['Consulting'];answers.company.customers=['Owners'];answers.briefing=Briefing.parse({version:1,step:'recommendation',goal:'demand',name:'Known Owner'});await executeCommand(fixture,{type:'save_onboarding',expectedRevision:0,answers});
 await page.goto('/?view=activation');await expect(page.getByRole('heading',{name:/We’ve saved what we learned/})).toBeVisible();
 await expect(page.getByRole('heading',{name:'A check of your public website pages'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Start with this task'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Request my first preparation'})).toHaveCount(0);
});
test('a newer workspace revision blocks edits and reload restores the saved website input',async({page})=>{
 await page.clock.install();const {fixture}=await apiFixture(page);await page.goto('/?view=activation');await page.getByRole('button',{name:'Let’s begin'}).click();await expect(page.getByLabel('Company website',{exact:true})).toBeVisible();
 const record=fixture.onboarding!;const answers=structuredClone(record.answers);answers.briefing!.websiteInput='newer.example';await executeCommand(fixture,{type:'save_onboarding',expectedRevision:record.revision,answers});
 await page.clock.fastForward(31000);await expect(page.getByRole('button',{name:'Reload saved answers'})).toBeVisible();await expect(page.getByLabel('Company website',{exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Reload saved answers'}).click();await expect(page.getByLabel('Company website',{exact:true})).toHaveValue('newer.example');
});

test('partial website research opens findings before asking for missing audience',async({page})=>{
 await apiFixture(page);
 await page.route('**/api/context/capture',r=>r.fulfill({json:{capture:{id:'00000000-0000-4000-8000-000000000011',sourceHash:'b'.repeat(64),context:{fixture:false,pages:[{url:'https://company.example/',title:'Example Company',description:'',text:'We provide **pest control services**. We offer safe and effective treatments.',capturedAt:new Date().toISOString()}]}}}}));
 await page.goto('/?view=activation');await page.getByRole('button',{name:'Let’s begin'}).click();
 await page.getByLabel('Company website').fill('https://company.example');await page.getByLabel('Company website').press('Enter');
 await page.getByRole('checkbox',{name:/Get more qualified leads/}).check();await page.getByRole('button',{name:'Continue',exact:false}).click();
 await page.getByRole('button',{name:'Review what we found'}).click();
 await expect(page.getByRole('heading',{name:'Here’s what we learned about your business.'})).toBeVisible();
 await expect(page.locator('.briefing-fact li').filter({hasText:'Pest control services'})).toBeVisible();
 await expect(page.locator('.briefing-fact li').filter({hasText:'Safe and effective treatments'})).toBeVisible();
 await expect(page.locator('.briefing-fact').getByText('**pest control services**')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Who do you help?',exact:true})).toHaveCount(0);
 await expect(page.getByText('Customer audience: not identified in the captured pages.')).toBeVisible();
 await page.getByRole('button',{name:'Small businesses',exact:true}).click();
 await expect(page.locator('.briefing-fact li').filter({hasText:'Small businesses'})).toBeVisible();
 await expect(page.getByRole('button',{name:'That’s right',exact:true})).toBeEnabled();
});

test('finished briefing exits to team and remaining setup without repeating permission review',async({page})=>{
 const {fixture}=await apiFixture(page);
 const {Briefing}=await import('../../packages/contracts/src/index');
 const {onboardingFor}=await import('../../packages/domain/src/onboarding');
 const answers=onboardingFor(fixture).answers;
 answers.company.offers=['Pest control'];answers.company.customers=['Homeowners'];
 answers.briefing=Briefing.parse({version:1,step:'finish',goal:'demand',name:'JT',task:'technical-seo-monitor'});
 await executeCommand(fixture,{type:'save_onboarding',expectedRevision:0,answers});
 await page.goto('/?view=activation&step=finish');
 await page.getByRole('button',{name:'Open my workspace',exact:true}).click();
 await expect(page).toHaveURL(/view=team/);await expect(page.getByRole('heading',{name:'Your team',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Your team',exact:true})).toBeVisible();
 await page.goto('/?view=activation&step=finish');
 await page.getByRole('button',{name:'Continue setup',exact:true}).click();
 await expect(page).toHaveURL(/mode=profile/);await expect(page).toHaveURL(/setup=5/);
 await expect(page.getByRole('heading',{name:/We’ve saved what we learned/})).toHaveCount(0);
 await expect(page.getByText('I approve this internal preparation limit and accept responsibility for reviewing its output.')).toHaveCount(0);
 await page.reload();await expect(page).toHaveURL(/setup=5/);
});

test('a saved permission screen opens the saved briefing instead of recycling a first-task review',async({page})=>{
 const {fixture}=await apiFixture(page);
 const {Briefing}=await import('../../packages/contracts/src/index');
 const {onboardingFor}=await import('../../packages/domain/src/onboarding');
 const answers=onboardingFor(fixture).answers;
 answers.company.offers=['Pest control'];answers.company.customers=['Homeowners'];
 answers.briefing=Briefing.parse({version:1,step:'review',goal:'demand',name:'JT'});
 await executeCommand(fixture,{type:'save_onboarding',expectedRevision:0,answers});
 await page.goto('/?view=activation&step=review');
 await expect(page.getByRole('heading',{name:/We’ve saved what we learned/})).toBeVisible();
 await expect(page.getByText('I approve this internal preparation limit and accept responsibility for reviewing its output.')).toHaveCount(0);
 await page.getByRole('button',{name:'Open my workspace',exact:true}).click();
 await expect(page).toHaveURL(/view=team/);
 await expect(page.getByRole('heading',{name:'Your team',exact:true})).toBeVisible();
});
