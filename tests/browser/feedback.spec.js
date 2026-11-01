import { test, expect } from '@playwright/test';
import { createGameServer } from '../../server/index.mjs';

test('combat feedback and graphics: authoritative hits, wounded targets, saved modes and mobile settings', async ({page}) => {
  test.setTimeout(90000);
  const app = createGameServer({tick:false}), errors=[];
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const ticker = setInterval(()=>app.step(0),100);
  page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${app.server.address().port}/?room=FEEDBACK`);
    await expect(page.locator('#wallet-value')).toHaveText('450');
    await page.getByRole('button',{name:'Réglages graphiques',exact:true}).click();
    await page.locator('[name="graphics"][value="performance"]').check();
    await expect(page.locator('#scene canvas')).toHaveAttribute('data-resolution-scale','0.65');
    await page.reload();
    await expect(page.locator('#scene canvas')).toHaveAttribute('data-graphics','performance');
    await page.getByRole('button',{name:'Réglages graphiques',exact:true}).click();
    await expect(page.locator('[name="graphics"][value="performance"]')).toBeChecked();
    await page.locator('[name="graphics"][value="quality"]').check();
    await expect(page.locator('#scene canvas')).toHaveAttribute('data-resolution-scale','1.00');
    await page.locator('[name="graphics"][value="auto"]').check();
    await page.screenshot({path:'test-results/graphics-settings.png'});
    await page.keyboard.press('Escape');
    await page.locator('#join-button').click(); await expect(page.locator('#hud')).toBeVisible();
    const room=app.rooms.get('FEEDBACK'), player=[...room.players.values()][0];
    player.x=0;player.z=3;player.aim=Math.PI;room.timer=999;
    room.zombies=[{id:900,x:0,z:-3,hp:160,maxHp:160,kind:'walker',speed:0,attack:0,aim:0}];
    app.step(0);
    await page.evaluate(()=>{
      window.hitTexts=[];
      new MutationObserver(()=>{for(const el of document.querySelectorAll('.damage-number')) if(el.textContent) window.hitTexts.push(el.textContent);}).observe(document.querySelector('.combat-feedback'),{childList:true,subtree:true,characterData:true});
    });
    // The authoritative server fires: unit tests independently cover collision and armor.
    room.shoot(player);app.step(0);
    await expect.poll(()=>page.evaluate(()=>window.hitTexts.some(t=>t==='32'))).toBe(true);
    await expect(page.locator('.enemy-vitals:not([hidden])')).toHaveCount(1);
    await expect(page.locator('.enemy-vitals small')).toHaveText('Rôdeur');
    await page.screenshot({path:'test-results/combat-feedback.png'});
    // Another survivor's hit updates the target, not this player's damage counter.
    await page.evaluate(()=>window.hitTexts=[]);
    const ally=room.addPlayer('Allié');room.damageEnemy(room.zombies[0],10,ally);app.step(0);
    await expect(page.locator('#squad-count')).toHaveText('2/4');
    expect(await page.evaluate(()=>window.hitTexts.some(t=>t==='10'))).toBe(false);
    room.damageEnemy(room.zombies[0],1000,player);app.step(0);
    await expect.poll(()=>page.evaluate(()=>window.hitTexts.some(t=>t.includes('ÉLIMINÉ')))).toBe(true);
    await expect(page.locator('.enemy-vitals')).toHaveCount(0);
    await page.locator('.help-toggle').click();
    await page.locator('.graphics-ingame').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#help')).toBeVisible();
    await page.locator('#close-help').click();
    await page.locator('#leave-game').click();
    await expect(page.locator('.damage-number')).toHaveCount(0);
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'Réglages graphiques',exact:true}).click();
    await page.screenshot({path:'test-results/graphics-mobile.png'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.keyboard.press('Escape');expect(errors).toEqual([]);
  } finally {clearInterval(ticker);await page.goto('about:blank');await app.close();}
});
