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

export function blocked(x, z, radius = PLAYER_RADIUS) {
  const edge = ARENA_SIZE / 2 - radius;
  return Math.abs(x) > edge || Math.abs(z) > edge || OBSTACLES.some(o =>
    Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius);
}

export function moveBody(body, dx, dz, radius = PLAYER_RADIUS) {
  if (!blocked(body.x + dx, body.z, radius)) body.x += dx;
  if (!blocked(body.x, body.z + dz, radius)) body.z += dz;
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
