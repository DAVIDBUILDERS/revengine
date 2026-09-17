import {test,expect} from '@playwright/test';

test('team recommendation is visible and saved source setup opens company connections',async({page})=>{
 await page.goto('/?view=team');
 await page.getByRole('button',{name:'Build your team',exact:true}).click();
 await page.getByRole('button',{name:'Recommend my five',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Recommended team selected below'})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Remove /})).toHaveCount(5);
 await page.getByRole('button',{name:'Manage company sources',exact:true}).click();
 await expect(page).toHaveURL(/view=connections/);
 await expect(page.getByRole('heading',{name:'Connections',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:/Let’s get to know/})).toHaveCount(0);
});
