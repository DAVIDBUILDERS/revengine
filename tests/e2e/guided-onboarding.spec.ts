import {test,expect,type Page} from '@playwright/test';
const origin=process.env.PREVIEW_URL??'http://localhost:3002';
async function start(page:Page,manual=false){
 await page.goto(`${origin}/?view=activation`);
 await expect(page.getByRole('heading',{name:/Let’s get to know/})).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Main navigation'})).toHaveCount(0);
 await page.getByRole('button',{name:'Let’s begin'}).click();
 if(manual){await page.getByRole('button',{name:'I don’t have a website'}).click();await page.getByLabel('Business description').fill('We help independent studios improve sales operations.');await page.getByRole('button',{name:'Continue',exact:false}).click();}
 else {await page.getByLabel('Company website',{exact:true}).fill('example.com');await page.getByLabel('Company website',{exact:true}).press('Enter');}
 if(await page.getByLabel('Your name',{exact:true}).isVisible()){await page.getByLabel('Your name',{exact:true}).fill('Alex');await page.getByRole('button',{name:'Continue',exact:false}).click();}
 await expect(page.getByRole('heading',{name:'What would make the biggest difference right now?'})).toBeVisible();
}
async function facts(page:Page,manual=false){
 await page.getByRole('button',{name:'Continue',exact:false}).click();
 await expect(page.getByRole('heading',{name:manual?'Let’s fill in just the essentials.':'Here’s what we can learn from your website.'})).toBeVisible();
 await page.getByRole('button',{name:manual?'Continue with my own answers':'Review what we found'}).click();
 if(await page.getByLabel('Main offer',{exact:true}).isVisible()){await page.getByLabel('Main offer',{exact:true}).fill('Sales operations consulting');await page.getByRole('button',{name:'Continue',exact:false}).click();}
 if(await page.getByLabel('Ideal customers',{exact:true}).isVisible()){await page.getByLabel('Ideal customers',{exact:true}).fill('Independent studios');await page.getByRole('button',{name:'Continue',exact:false}).click();}
 await expect(page.getByRole('heading',{name:'Here’s what we learned about your business.'})).toBeVisible();
 await page.getByRole('button',{name:'That’s right'}).click();
}
test('website briefing saves business context and opens the workspace on desktop and mobile',async({page},info)=>{
 const errors:string[]=[],calls:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))calls.push(r.url());});
 await start(page);await page.keyboard.press('1');await expect(page.getByRole('checkbox',{name:/Get more qualified leads/})).toBeChecked();
 await expect(page.getByText('Saved to this workspace',{exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('briefing-goal-desktop.png'),fullPage:true});
 await facts(page);
 await expect(page.getByRole('heading',{name:/We’ve saved what we learned/})).toBeVisible();
 await expect(page.getByRole('heading',{name:'A content brief for your ideal customer'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Start with this task'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Approve this preparation setup'})).toHaveCount(0);
 await page.screenshot({path:info.outputPath('briefing-finish-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.screenshot({path:info.outputPath('briefing-finish-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Open my workspace'}).click();await expect(page.getByRole('heading',{name:'Your team',exact:true})).toBeVisible();
 expect(errors).toEqual([]);expect(calls).toEqual([]);
});
test('manual fallback, backtracking and refresh preserve answers without claiming execution',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await start(page,true);
 await page.getByRole('checkbox',{name:/Follow up on open proposals/}).check();await facts(page,true);
 await expect(page.getByText(/Automatic proposal follow-up is a separate pilot/)).toBeVisible();
 await page.getByLabel('Proposal system').fill('Our CRM');await page.getByRole('button',{name:'Continue',exact:false}).click();
 await expect(page.getByRole('heading',{name:/We’ve saved what we learned/})).toBeVisible();
 await page.getByRole('button',{name:'Back',exact:false}).click();await expect(page.getByLabel('Proposal system')).toHaveValue('Our CRM');
 await page.reload();await expect(page.getByLabel('Proposal system')).toHaveValue('Our CRM');
 await page.getByRole('button',{name:'Continue',exact:false}).click();
 await expect(page.getByRole('button',{name:'Prepare sample output'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Open my workspace'})).toBeVisible();
 await page.screenshot({path:info.outputPath('briefing-manual-mobile.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await page.goto(`${origin}/?view=activation&workspace=northstar`);await expect(page.getByRole('heading',{name:/Let’s get to know/})).toBeVisible();await expect(page.getByText('Our CRM')).toHaveCount(0);
});
