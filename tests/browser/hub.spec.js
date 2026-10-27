import { test, expect } from '@playwright/test';

test('refuge: purchase, equip, persist and deploy the actual weapon; crafting shows missing components', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?room=ARSENAL');
  await expect(page.locator('#wallet-value')).toHaveText('450');
  await page.locator('[data-tab="shop"]').first().click();
  await page.screenshot({ path: 'test-results/shop-desktop.png' });
  await page.locator('[data-command="buy"][data-item="smg"]').click();
  await expect(page.locator('#wallet-value')).toHaveText('150');
  await page.locator('[data-command="equip"][data-item="smg"]').click();
  await expect(page.locator('[data-command="equip"][data-item="smg"]')).toBeDisabled();
  await page.locator('[data-command="buy"][data-item="medkit"]').click();
  await expect(page.locator('#wallet-value')).toHaveText('80');
  await page.locator('[data-tab="craft"]').click();
  await expect(page.locator('[data-command="craft"][data-item="tesla"]')).toBeDisabled();
  await expect(page.locator('[data-weapon="tesla"]')).toContainText('Le Veilleur');
  await page.screenshot({ path: 'test-results/workshop-desktop.png' });
  await page.reload(); await expect(page.locator('#wallet-value')).toHaveText('80');
  await expect(page.locator('.equipped-strip')).toContainText('Frelon');
  await page.locator('#join-button').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('.weapon-name')).toContainText('FRELON');
  await expect(page.locator('#ammo-value')).toHaveText('36');
  await expect(page.locator('#medkit-count')).toHaveText('2');
  await page.keyboard.press('KeyG'); await expect(page.locator('#grenade-count')).toHaveText('1');
  await page.locator('#leave-game').click();
  await page.locator('[data-tab="shop"]').click();
  await expect(page.locator('[data-product="grenade"] .card-top')).toContainText('EN STOCK : 1');
  expect(errors).toEqual([]);
});

test('bestiary launches a boss hunt with the selected district and a live boss health bar', async ({ page }) => {
  const errors = [], states = []; page.on('pageerror', error => errors.push(error.message));
  page.on('websocket', socket => socket.on('framereceived', frame => { const m = JSON.parse(String(frame.payload)); if (m.type === 'state') states.push(m); }));
  await page.goto('/?room=HUNTER'); await expect(page.locator('#wallet-value')).toHaveText('450');
  await page.locator('[data-tab="bestiary"]').first().click();
  await page.screenshot({ path: 'test-results/bestiary-desktop.png' });
  await page.locator('[data-hunt="warden"]').click();
  await expect(page.locator('[data-setting="district"][data-value="foundry"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#join-button').click();
  await expect(page.locator('#boss-health')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#boss-name')).toHaveText('Le Veilleur');
  await expect.poll(() => states.at(-1)?.settings).toEqual({ mode: 'hunt', district: 'foundry', boss: 'warden' });
  await expect.poll(() => states.some(s => s.hazards.some(h => h.kind === 'electric')),{timeout:10000}).toBe(true);
  await page.screenshot({ path: 'test-results/boss-hunt.png' });
  await page.locator('#leave-game').click(); expect(errors).toEqual([]);
});

test('mobile refuge: all six pages fit and shop actions remain reachable', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.locator('#wallet-value')).toHaveText('450');
  for (const tab of ['shop','craft','arsenal','contracts','bestiary','home']) {
    await page.locator(`.hub-nav [data-tab="${tab}"]`).tap();
    expect(await page.locator('#hub-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
  await page.locator('.hub-nav [data-tab="shop"]').tap();
  await page.locator('[data-command="buy"][data-item="grenade"]').tap();
  await expect(page.locator('#wallet-value')).toHaveText('395');
  await page.screenshot({ path: 'test-results/shop-mobile.png' });
  expect(errors).toEqual([]); await context.close();
});

test('original props: inspect all eight weapon models and five crates, rotate and return to the arsenal', async ({ page }) => {
  test.setTimeout(60000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?room=PROPS'); await expect(page.locator('#wallet-value')).toHaveText('450');
  await page.locator('.hub-nav [data-tab="arsenal"]').click();
  const weapons = page.locator('[data-inspect-kind="weapon"]');
  await expect(weapons).toHaveCount(8); await expect(page.locator('.crate-card')).toHaveCount(5);
  await expect.poll(() => page.locator('.prop-preview img').evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0))).toBe(true);
  await page.screenshot({ path: 'test-results/original-arsenal.png' });
  for (const id of ['carbine','smg','shotgun','marksman','tesla','ember','railgun','venom']) {
    const trigger = page.locator(`[data-inspect-kind="weapon"][data-inspect-id="${id}"]`);
    await trigger.click(); await expect(page.locator('.prop-inspector')).toBeVisible();
    await expect(page.locator('.inspection-stage canvas')).toBeVisible();
    await expect(page.locator('#inspection-stats')).toContainText('DÉGÂTS');
    if (id === 'tesla') {
      await page.locator('.inspection-stage').focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowUp');
      await page.screenshot({ path: 'test-results/tesla-inspection.png' });
      await page.locator('[data-view="reset"]').click();
    }
    await page.keyboard.press('Escape'); await expect(page.locator('.prop-inspector')).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
  for (const id of ['salvage','medical','brute','matriarch','warden']) {
    await page.locator(`[data-inspect-kind="crate"][data-inspect-id="${id}"]`).click();
    await expect(page.locator('.inspection-stage canvas')).toBeVisible();
    if (id === 'warden') await page.screenshot({ path: 'test-results/reactor-crate.png' });
    await page.locator('.inspection-close').click();
  }
  await page.locator('.hub-nav [data-tab="home"]').click(); await page.locator('#join-button').click();
  await expect(page.locator('#hud')).toBeVisible(); await expect(page.locator('#ammo-value')).toHaveText('24');
  await page.screenshot({ path: 'test-results/original-weapon-game.png' });
  await page.locator('#leave-game').click();
  expect(errors).toEqual([]);
});
