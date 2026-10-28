import * as THREE from 'three';

// Original, deterministic surfaces generated locally: no network needed in play.
const cache = new Map();
export function surface(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  let seed = 173;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  ctx.fillStyle = kind === 'cloth' ? '#c7c3b7' : kind === 'asphalt' ? '#858a8b' : '#a49e92'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 11000; i++) {
    const value = Math.floor(70 + random() * 160);
    ctx.fillStyle = `rgba(${value},${value},${value},${kind === 'cloth' ? .22 : .18})`;
    ctx.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1 + random() * 2);
  }
  if (kind === 'cloth') {
    ctx.strokeStyle = '#353a3624'; ctx.lineWidth = .6;
    for (let i = 0; i < 256; i += 3) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke(); }
  } else {
    for (let i = 0; i < 9; i++) {
      let x = random() * 256, y = random() * 256;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += random() * 40 - 20; y += random() * 27; ctx.lineTo(x, y); }
      ctx.lineWidth = kind === 'asphalt' ? 1.2 : .6; ctx.strokeStyle = '#252c2c65'; ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4;
  cache.set(kind, texture); return texture;
}

export function radialTexture(smoke = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 63);
  gradient.addColorStop(0, smoke ? '#9ba1a99c' : '#080c10a0');
  gradient.addColorStop(.45, smoke ? '#80879255' : '#080c1060');
  gradient.addColorStop(1, '#00000000'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
