import { test, expect } from '@playwright/test';
import { createGameServer } from '../../server/index.mjs';

test('campaign: local weapon assets, actual interaction, extraction, saved unlocks and switching the larger maps', async ({ page }) => {
  test.setTimeout(120000);
  const app = createGameServer({ tick: false }), errors = [], assets = new Set();
  await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
  const ticker = setInterval(()=>app.step(.05),50);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.ok() && r.url().includes('/assets/weapons/')) assets.add(r.url().split('/').at(-1));});
  try {
    await page.goto(`http://127.0.0.1:${app.server.address().port}/?room=CAMPAIGN`);
    await expect(page.locator('#wallet-value')).toHaveText('450');
    await page.locator('.hub-nav [data-tab="campaign"]').click();
    await expect(page.locator('.mission-card')).toHaveCount(9);
    await expect(page.locator('[data-mission="relay"]')).toBeDisabled();
    await page.screenshot({path:'test-results/campaign-overview.png'});
    await page.locator('[data-mission="last_signal"]').click();
    await expect(page.locator('.mission-brief')).toContainText('Le dernier signal');
    await page.locator('#join-button').click(); await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('.mission-tracker')).toContainText('Le dernier signal');
    const room=app.rooms.get('CAMPAIGN'), player=[...room.players.values()][0];
    // Skip combat here; simulation tests exercise all nine complete wave sequences.
    room.wave=2;room.phase='objective';room.toSpawn=0;room.zombies=[];player.invulnerable=999;
    for(const point of room.objective.points) {
      player.x=point.x;player.z=point.z;
      await page.keyboard.down('KeyE');
      await expect.poll(()=>point.done,{timeout:12000}).toBe(true);
      await page.keyboard.up('KeyE');
    }
    await expect(page.locator('.mission-tracker')).toContainText('Extraction');
    await page.screenshot({path:'test-results/campaign-extraction.png'});
    player.x=room.objective.exit.x;player.z=room.objective.exit.z;
    await expect(page.locator('#gameover')).toBeVisible({timeout:15000});
    await expect(page.locator('#gameover')).toContainText('ESCOUADE EXTRAITE');
    await page.locator('#back-home').click();
    await page.locator('.hub-nav [data-tab="campaign"]').click();
    await expect(page.locator('[data-mission="relay"]')).toBeEnabled();
    await page.reload(); await expect(page.locator('#wallet-value')).toHaveText('630');
    await page.locator('.hub-nav [data-tab="campaign"]').click();
    await expect(page.locator('[data-mission="relay"]')).toBeEnabled();
    await page.locator('.hub-nav [data-tab="arsenal"]').click();
    await expect(page.locator('[data-inspect-kind="weapon"]')).toHaveCount(12);
    await expect.poll(()=>assets.has('blaster.glb') && assets.has('blaster-repeater.glb') && assets.has('colormap.png')).toBe(true);
    await page.screenshot({path:'test-results/kenney-arsenal.png'});
    for(const district of ['foundry','laboratory','quarantine']) {
      await page.locator('.hub-nav [data-tab="home"]').click();
      await page.locator('[data-setting="mode"][data-value="survival"]').click();
      await page.locator(`[data-setting="district"][data-value="${district}"]`).click();
      await page.locator('#join-button').click();await expect(page.locator('#hud')).toBeVisible();
      const active=app.rooms.get('CAMPAIGN');active.timer=999;
      expect(active.world.size).toBe(({foundry:64,laboratory:72,quarantine:46})[district]);
      await expect(page.locator('.tactical-map')).toBeVisible();
      await page.screenshot({path:`test-results/map-${district}.png`});
      await page.locator('#leave-game').click();await expect.poll(()=>app.rooms.size).toBe(0);
    }
    expect(errors).toEqual([]);
  } finally {clearInterval(ticker);await page.goto('about:blank');await app.close();}
});
