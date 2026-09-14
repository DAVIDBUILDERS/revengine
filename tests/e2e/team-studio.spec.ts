import {test,expect} from '@playwright/test';
test('studio focuses on one agent, keeps configuration optional, and fits mobile',async({page})=>{
 await page.goto('/?view=team');
 await expect(page.getByRole('heading',{name:'Your team',exact:true})).toBeVisible();
 await expect(page.locator('.agent-card')).toHaveCount(0);
 await page.getByRole('button',{name:/Account Intelligence.*saved|Account Intelligence.*Awaiting/}).click();
 await expect(page.getByRole('region',{name:'Account Intelligence workbench'})).toBeVisible();
 await page.getByRole('button',{name:'Access, limits & history'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'Close details'}).click();
 await page.getByRole('button',{name:'Build your team',exact:true}).click();
 await expect(page.locator('.agent-card')).toHaveCount(32);
 await page.getByRole('button',{name:'Recommend my five',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Recommended team selected below'})).toBeVisible();
 await page.getByRole('button',{name:'Back to workspace',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
