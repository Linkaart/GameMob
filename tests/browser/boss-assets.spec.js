import { test, expect } from '@playwright/test';
import { createGameServer } from '../../server/index.mjs';

test('downloaded boss models load locally, animate in the bestiary, and survive combat removal and respawn', async ({ page }) => {
  test.setTimeout(90000);
  const app = createGameServer({ tick: false }), errors = [], loaded = new Set();
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const heartbeat = setInterval(() => app.step(0), 100);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().endsWith('.gltf') && response.ok()) loaded.add(response.url().split('/').at(-1)); });
  try {
    await page.goto(`http://127.0.0.1:${app.server.address().port}/?room=MODELS`);
    await expect(page.locator('#wallet-value')).toHaveText('450');
    await page.locator('.hub-nav [data-tab="bestiary"]').click();
    await expect(page.locator('.boss-portrait')).toHaveCount(3);
    await expect.poll(() => loaded.size).toBe(3);
    await expect.poll(() => page.locator('.boss-portrait').evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0))).toBe(true);
    await page.screenshot({ path: 'test-results/bosses-new-bestiary.png' });
    for (const [kind, file] of [['brute', 'Orc.gltf'], ['matriarch', 'Demon.gltf'], ['warden', 'BlueDemon.gltf']]) {
      const trigger = page.locator(`[data-inspect-kind="boss"][data-inspect-id="${kind}"]`);
      await trigger.click();
      await expect(page.locator('.inspection-stage')).toHaveAttribute('data-model', file);
      await expect(page.locator('.inspection-stage canvas')).toBeVisible();
      await expect(page.locator('#inspection-stats')).toContainText('PV EN SOLO');
      await page.locator('.inspection-stage').focus(); await page.keyboard.press('ArrowRight');
      await page.screenshot({ path: `test-results/boss-${kind}-inspection.png` });
      await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
      await page.locator(`[data-hunt="${kind}"]`).click();
      await page.locator('#join-button').click();
      await expect(page.locator('#hud')).toBeVisible();
      const room = app.rooms.get('MODELS');
      room.startWave(); room.toSpawn = 0;
      const boss = room.zombies.find(z => z.boss), player = [...room.players.values()][0];
      player.x = 0; player.z = 3; player.invulnerable = 999;
      boss.x = 0; boss.z = -3; boss.aim = 0;
      app.step(.05);
      await expect(page.locator('#boss-health')).toBeVisible();
      // Advance actual snapshots: walking, enraged movement, and a melee swing.
      for (let i = 0; i < 12; i++) {
        boss.hp = boss.maxHp * .4; boss.z += .04; boss.attack = .85;
        app.step(.05);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      }
      await page.screenshot({ path: `test-results/boss-${kind}-combat.png` });
      room.toSpawn = 1; room.spawnTimer = 999; room.zombies = []; app.step(.05);
      await expect(page.locator('#boss-health')).not.toBeVisible();
      room.spawnBoss(kind); app.step(.05);
      await expect(page.locator('#boss-health')).toBeVisible();
      await page.locator('#leave-game').click();
      await expect.poll(() => app.rooms.size).toBe(0);
      await page.locator('.hub-nav [data-tab="bestiary"]').click();
    }
    expect(errors).toEqual([]);
  } finally { clearInterval(heartbeat); await page.goto('about:blank'); await app.close(); }
});
