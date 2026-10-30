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
  if (kind === 'metal') {
    ctx.fillStyle = '#c3c8c7'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1100; i++) {
      const x = random() * 256, y = random() * 256;
      ctx.strokeStyle = i % 4 ? '#3b44431a' : '#f7f2db66'; ctx.lineWidth = .5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1 + random() * 8, y + random() * 2); ctx.stroke();
    }
  } else if (kind === 'cloth') {
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

let reflection;
export function reflectionTexture() {
  if (reflection) return reflection;
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d'); ctx.scale(.5, .5);
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#7794a8'); sky.addColorStop(.45, '#9daaa8'); sky.addColorStop(.52, '#303d43'); sky.addColorStop(1, '#182222');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 256);
  // Soft light sources become highlights in metal and wet surfaces, not a second background.
  for (const [x, y, r, color] of [[90, 65, 60, '#edf5ff'], [330, 112, 25, '#ffce8b'], [440, 100, 18, '#b4e8d9']]) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r); glow.addColorStop(0, color); glow.addColorStop(1, '#ffffff00');
    ctx.fillStyle = glow; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  reflection = new THREE.CanvasTexture(canvas); reflection.colorSpace = THREE.SRGBColorSpace;
  reflection.mapping = THREE.EquirectangularReflectionMapping; return reflection;
}

export function glowTexture(flame = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (flame) {
    const gradient = ctx.createLinearGradient(0, 120, 0, 4);
    gradient.addColorStop(0, '#ffcc64'); gradient.addColorStop(.25, '#fff2ae'); gradient.addColorStop(.6, '#ff8d2bd9'); gradient.addColorStop(1, '#e13e1200');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(35, 124);
    ctx.bezierCurveTo(6, 90, 56, 70, 45, 37); ctx.bezierCurveTo(70, 55, 75, 25, 73, 2);
    ctx.bezierCurveTo(104, 48, 75, 72, 99, 87); ctx.bezierCurveTo(112, 118, 83, 128, 35, 124); ctx.fill();
  } else {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, '#ffffffee'); gradient.addColorStop(.12, '#ffffff77'); gradient.addColorStop(.4, '#ffffff22'); gradient.addColorStop(1, '#ffffff00');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export function radialTexture(smoke = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(64, 64, 3, 64, 64, 63);
  gradient.addColorStop(0, smoke ? '#9ba1a99c' : '#080c10a0');
  gradient.addColorStop(.45, smoke ? '#80879255' : '#080c1060');
  gradient.addColorStop(1, '#00000000'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}
