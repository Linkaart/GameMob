export const ARENA_SIZE = 46;
export const PLAYER_RADIUS = 0.46;
export const PLAYER_COLORS = ['#d6fb62', '#7ad9f4', '#f2a3c5', '#c4b2ff'];
export const MAGAZINE_SIZE = 24;

// Shared by the authoritative simulation and the 3D scene.
export const OBSTACLES = [
  { x: -13, z: -12, w: 10, d: 8, h: 5.1, type: 'shop', color: '#647978', label: 'MART' },
  { x: 12, z: -13, w: 9, d: 7, h: 6.4, type: 'shop', color: '#6f727c', label: 'PHARMACY' },
  { x: -14, z: 12, w: 8, d: 7, h: 4.8, type: 'shop', color: '#997461', label: 'GARAGE' },
  { x: 13, z: 12, w: 10, d: 8, h: 5.6, type: 'shop', color: '#687a70', label: 'STORAGE' },
  { x: -8, z: 1, w: 2.4, d: 4.5, h: 1.3, type: 'car', color: '#b66a4e' },
  { x: 7.5, z: -2, w: 2.4, d: 4.5, h: 1.3, type: 'car', color: '#728ca1' },
  { x: 1.5, z: 13, w: 3, d: 1.2, h: 0.8, type: 'barrier', color: '#c4b27a' },
  { x: -2, z: -14, w: 3, d: 1.2, h: 0.8, type: 'barrier', color: '#c4b27a' },
];

const warehouse = (x, z, w, d, h, color) => ({ x, z, w, d, h, color, type: 'shop', label: 'SECTEUR' });
export const WORLDS = {
  quarantine: { size: 46, obstacles: OBSTACLES, stations: [{ x: -4, z: 8 }, { x: 4, z: -9 }, { x: -4, z: -20 }, { x: 4, z: 20 }] },
  foundry: { size: 64, obstacles: [
    warehouse(-13, -14, 13, 8, 5.8, '#886551'), warehouse(14, -13, 10, 10, 7, '#7a655b'),
    warehouse(-14, 14, 10, 12, 5, '#8c7461'), warehouse(13, 15, 13, 8, 6, '#79716a'),
    warehouse(-25, -25, 8, 8, 4.5, '#726152'), warehouse(25, 25, 8, 8, 4.5, '#726152'),
    { x: -8, z: 2, w: 3, d: 6, h: 1.3, type: 'car', color: '#b98554' },
    { x: 9, z: -2, w: 5, d: 1.2, h: .9, type: 'barrier', color: '#b9a57a' },
  ], stations: [{ x: -25, z: 0 }, { x: 25, z: 0 }, { x: 0, z: 24 }, { x: 0, z: -24 }] },
  laboratory: { size: 72, obstacles: [
    warehouse(-15, -14, 8, 17, 7, '#728a84'), warehouse(15, -14, 8, 17, 7, '#728a84'),
    warehouse(-14, 15, 17, 8, 5.5, '#819287'), warehouse(15, 15, 17, 8, 5.5, '#819287'),
    warehouse(-29, -26, 8, 10, 6, '#667f77'), warehouse(29, -26, 8, 10, 6, '#667f77'),
    warehouse(-29, 28, 8, 8, 6, '#667f77'), warehouse(29, 28, 8, 8, 6, '#667f77'),
    { x: -7, z: 0, w: 2, d: 5, h: 1.3, type: 'car', color: '#a8b5a8' },
    { x: 7, z: 0, w: 2, d: 5, h: 1.3, type: 'car', color: '#a8b5a8' },
  ], stations: [{ x: -28, z: 0 }, { x: 28, z: 0 }, { x: 0, z: -27 }, { x: 0, z: 27 }] },
};
export const worldFor = id => WORLDS[id] || WORLDS.quarantine;

export function blocked(x, z, radius = PLAYER_RADIUS, world = WORLDS.quarantine) {
  const edge = world.size / 2 - radius;
  return Math.abs(x) > edge || Math.abs(z) > edge || world.obstacles.some(o =>
    Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius);
}

export function moveBody(body, dx, dz, radius = PLAYER_RADIUS, world = WORLDS.quarantine) {
  if (!blocked(body.x + dx, body.z, radius, world)) body.x += dx;
  if (!blocked(body.x, body.z + dz, radius, world)) body.z += dz;
}

export function rayBoxDistance(x, z, dx, dz, box) {
  let near = 0, far = Infinity;
  for (const [position, direction, min, max] of [
    [x, dx, box.x - box.w / 2, box.x + box.w / 2],
    [z, dz, box.z - box.d / 2, box.z + box.d / 2],
  ]) {
    if (Math.abs(direction) < 1e-8) {
      if (position < min || position > max) return Infinity;
    } else {
      const a = (min - position) / direction, b = (max - position) / direction;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return Infinity;
    }
  }
  return far < 0 ? Infinity : near;
}
