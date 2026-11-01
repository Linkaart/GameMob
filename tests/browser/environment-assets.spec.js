import { test, expect } from '@playwright/test';
import { worldFor } from '../../shared/world.mjs';

test('downloaded scenery: four local GLB assets load and survive district changes', async ({page}) => {
  test.setTimeout(90000);
  const errors=[], loaded=new Set(); page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.ok()&&r.url().includes('/assets/environment/')) loaded.add(r.url().split('/').at(-1));});
  await page.goto('/?room=SCENERY');await expect(page.locator('#wallet-value')).toHaveText('450');
  await expect.poll(()=>['vehicle-truck-green.glb','vehicle-truck-red.glb','vehicle-motorcycle.glb','decoration-tents.glb','colormap.png'].every(n=>loaded.has(n))).toBe(true);
  for(const district of ['quarantine','foundry','laboratory','quarantine']) {
    await page.locator(`[data-setting="district"][data-value="${district}"]`).click();
    await expect(page.locator('#scene canvas')).toHaveAttribute('data-vehicle-assets',String(worldFor(district).obstacles.filter(o=>o.type==='car').length));
    await page.locator('#join-button').click();await expect(page.locator('#hud')).toBeVisible();
    await page.screenshot({path:`test-results/scenery-${district}.png`});
    await page.locator('#leave-game').click();await expect(page.locator('#landing')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('downloaded scenery: failed downloads preserve playable fallback obstacles', async ({page}) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/assets/environment/*.glb',route=>route.abort());
  await page.goto('/?room=FALLBACK');await expect(page.locator('#wallet-value')).toHaveText('450');
  await expect(page.locator('#scene canvas')).toHaveAttribute('data-vehicle-assets','0');
  await page.locator('#join-button').click();await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#health-value')).toHaveText('100');
  await page.locator('#leave-game').click();await expect(page.locator('#landing')).toBeVisible();
  expect(errors).toEqual([]);
});
