import {test,expect} from '@playwright/test';

test('team recommendation is visible and setup opens the requested saved section',async({page})=>{
 await page.goto('/?view=team');
 await page.getByRole('button',{name:'Build your team',exact:true}).click();
 await page.getByRole('button',{name:'Recommend my five',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Recommended team selected below'})).toBeVisible();
 await expect(page.getByRole('button',{name:/^Remove /})).toHaveCount(5);
 const save=page.getByRole('button',{name:'Save team',exact:true});
 if(await save.isEnabled())await save.click();
 await page.getByText('Sources, permissions & workspace setup',{exact:true}).click();
 await page.getByRole('button',{name:'Sources & connections',exact:true}).click();
 await expect(page).toHaveURL(/mode=profile/);
 await expect(page.getByRole('heading',{name:'Systems & sources',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:/Let’s find a useful first step/})).toHaveCount(0);
});
