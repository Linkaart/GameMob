import { loadWeaponAssets } from './weapon-assets.js';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { surface, radialTexture, reflectionTexture, glowTexture } from './surface-materials.js';
import { DISTRICTS, BOSSES, ENEMIES, weaponFor } from '../shared/content.mjs';
import { ARENA_SIZE, OBSTACLES, PLAYER_COLORS, worldFor } from '../shared/world.mjs';
import { createWeaponModel, createCrateModel, disposeProp } from './props.js';
import { createBossModel, loadBossAssets, disposeBossModel } from './boss-models.js';
import { characterUnderAim, movementInView, unobstructedCamera } from './camera.js';

const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const roundedGeometry = new RoundedBoxGeometry(1, 1, 1, 2, .07);
const contactTexture = radialTexture();
const materials = new Map();
function cloth(color) {
  const key = 'cloth-' + color;
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, map: surface('cloth'), bumpMap: surface('cloth'), bumpScale: .018, roughness: .98 }));
  return materials.get(key);
}
function bodyBox(parent, ...args) {
  const mesh = box(parent, ...args); mesh.geometry = roundedGeometry; return mesh;
}
function batchBody(rig) {
  // Only rigid, direct children: legs, weapons and their animation remain independent.
  const groups = new Map();
  for (const mesh of rig.children) {
    if (!mesh.isMesh || Array.isArray(mesh.material)) continue;
    const key = `${mesh.geometry.uuid}/${mesh.material.uuid}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  }
  for (const meshes of groups.values()) {
    if (meshes.length < 2) continue;
    const batch = new THREE.InstancedMesh(meshes[0].geometry, meshes[0].material, meshes.length);
    batch.castShadow = batch.receiveShadow = true;
    meshes.forEach((mesh, index) => { mesh.updateMatrix(); batch.setMatrixAt(index, mesh.matrix); mesh.removeFromParent(); });
    batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere(); rig.add(batch);
  }
}
function material(color, extra = {}) {
  if (extra.map || extra.envMap) return new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra });
  const key = color + JSON.stringify(extra);
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra }));
  return materials.get(key);
}
function box(parent, w, h, d, x, y, z, color, shadow = true) {
  const mesh = new THREE.Mesh(boxGeometry, typeof color === 'string' ? material(color) : color);
  mesh.scale.set(w, h, d); mesh.position.set(x, y, z);
  mesh.castShadow = shadow; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
function cylinder(parent, radius, height, x, y, z, color, segments = 8) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material(color));
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function textTexture(text, color = '#d4e4d8', background = '#20322f') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background; ctx.fillRect(0, 0, 512, 128);
  ctx.font = '900 64px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color; ctx.fillText(text, 256, 68, 470);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function paintedTexture(paint, size = 128) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

const faces = new Map();
function faceMaterial(skin, zombie) {
  const key = `${skin}-${zombie}`;
  if (!faces.has(key)) faces.set(key, material('#ffffff', { map: paintedTexture(ctx => {
    ctx.fillStyle = skin; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = zombie ? '#728568' : '#c39777';
    ctx.fillRect(2, 94, 124, 34); ctx.fillRect(90, 9, 29, 23);
    ctx.fillStyle = zombie ? '#48533f' : '#3c3029';
    ctx.fillRect(19, 45, 32, 21); ctx.fillRect(78, 45, 31, 21);
    ctx.fillStyle = zombie ? '#e3d390' : '#e2e3d6';
    ctx.fillRect(25, 50, 22, 11); ctx.fillRect(82, 50, 21, 11);
    ctx.fillStyle = '#292d29'; ctx.fillRect(34, 50, 7, 12); ctx.fillRect(87, 50, 7, 12);
    ctx.fillStyle = zombie ? '#4a5640' : '#59412c';
    ctx.save(); ctx.translate(32, 40); ctx.rotate(0.19); ctx.fillRect(-18, -3, 37, 8); ctx.restore();
    ctx.save(); ctx.translate(94, 40); ctx.rotate(-0.22); ctx.fillRect(-18, -3, 37, 8); ctx.restore();
    ctx.fillStyle = '#51483c'; ctx.fillRect(41, 91, 48, 14);
    ctx.fillStyle = '#d2c9a7'; ctx.fillRect(44, 92, 11, 5); ctx.fillRect(61, 92, 11, 5);
    if (zombie) {
      ctx.strokeStyle = '#786353'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(14, 12); ctx.lineTo(27, 36); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(11 + i * 3, 16 + i * 5); ctx.lineTo(25 + i * 3, 11 + i * 5); ctx.stroke(); }
      ctx.fillStyle = '#83664e'; ctx.fillRect(102, 78, 13, 24);
    }
  }) }));
  return faces.get(key);
}

function brickMaterial(width, height, tint) {
  const texture = paintedTexture(ctx => {
    ctx.fillStyle = '#33363b'; ctx.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
      const shade = 69 + (row * 17 + col * 29 + 150) % 25;
      ctx.fillStyle = `rgb(${shade + 5},${shade + 3},${shade})`;
      ctx.fillRect(col * 32 + row % 2 * 16 + 1, row * 16 + 1, 30, 14);
      ctx.fillStyle = '#ffffff08'; ctx.fillRect(col * 32 + row % 2 * 16 + 2, row * 16 + 2, 28, 1);
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(width / 3.5, height / 3.5);
  return material(tint, { map: texture });
}

function bossCharacter(kind) {
  const group = new THREE.Group(), rig = new THREE.Group(); group.add(rig);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.85, .94, 40), new THREE.MeshBasicMaterial({ color: BOSSES[kind].color, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .04; group.add(ring);
  const fallback = character('#829272', true, kind, 'carbine', true); rig.add(fallback.group);
  const actor = { group, rig, ring, legs: [], phase: 0, boss: true, model: null, disposed: false, fallback };
  const install = () => {
    if (actor.disposed) return;
    const model = createBossModel(kind); if (!model) return;
    fallback.group.removeFromParent();
    fallback.group.traverse(mesh => { if (mesh.isInstancedMesh) mesh.dispose(); if (mesh.isMesh && mesh.geometry !== boxGeometry && mesh.geometry !== roundedGeometry) mesh.geometry.dispose(); });
    fallback.ring.material.dispose(); fallback.contact?.material.dispose(); actor.fallback = null;
    rig.add(model); actor.model = model;
  };
  loadBossAssets().then(install);
  return actor;
}

function character(color, zombie = false, kind = 'walker', weapon = 'carbine', fallback = false) {
  if (zombie && BOSSES[kind] && !fallback) return bossCharacter(kind);
  const group = new THREE.Group();
  const rig = new THREE.Group(); group.add(rig);
  const skin = zombie ? (BOSSES[kind]?.color || ENEMIES[kind]?.color || '#9eac7e') : '#dcba94';
  const slot = Math.max(0, PLAYER_COLORS.indexOf(color));
  const shirtColor = zombie ? kind === 'tank' ? '#756379' : kind === 'runner' ? '#a27561' : '#a7ad94' : ['#3d5265', '#684f53', '#776c4b', '#3e625d'][slot];
  const shirt = cloth(shirtColor);
  const hair = ['#714523', '#352d2c', '#a8783b', '#433735'][slot];
  const legs = []; let weaponModel = null;
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * 0.19, 0.62, 0); rig.add(leg);
    bodyBox(leg, 0.3, 0.48, 0.33, 0, -0.22, 0, cloth(zombie ? '#4c535b' : '#303d58'));
    bodyBox(leg, 0.35, 0.22, 0.48, 0, -0.48, 0.06, '#292829'); legs.push(leg);
  }
  bodyBox(rig, 0.72, 0.65, 0.46, 0, 0.94, 0, shirt);
  bodyBox(rig, 0.75, 0.1, 0.48, 0, 0.66, 0, zombie ? '#635f53' : '#c2a363');
  const skinMat = material(skin), face = faceMaterial(skin, zombie);
  bodyBox(rig, 0.96, 0.87, 0.85, 0, 1.64, 0.01, [skinMat, skinMat, skinMat, skinMat, face, skinMat]);
  for (const side of [-1, 1]) bodyBox(rig, 0.12, 0.23, 0.18, side * 0.51, 1.54, 0.02, skin);
  if (!zombie) {
    bodyBox(rig, 1.01, 0.24, 0.91, 0, 2.04, -0.02, hair);
    bodyBox(rig, 1.01, 0.43, 0.13, 0, 1.77, -0.43, hair);
    for (const side of [-1, 1]) bodyBox(rig, 0.13, 0.35, 0.71, side * 0.45, 1.88, -0.04, hair);
    for (let i = 0; i < 5; i++) bodyBox(rig, 0.12, 0.16 + (i % 2) * 0.08, 0.08, -0.35 + i * 0.17, 1.91, 0.45, hair);
    for (let i = 0; i < 12; i++) bodyBox(rig, 0.028, 0.1, 0.012, -0.42 + (i % 6) * 0.16, 1.77 + Math.floor(i / 6) * 0.19, -0.505, '#52351f');
    bodyBox(rig, 0.47, 0.25, 0.16, 0, 1.15, -0.27, '#33486d');
    bodyBox(rig, 0.39, 0.06, 0.025, 0, 0.9, -0.24, color);
    bodyBox(rig, .51, .55, .25, 0, .98, -.34, cloth('#444d46'));
    bodyBox(rig, .43, .23, .1, 0, .81, -.5, cloth('#5b6253'));
    for (const side of [-1, 1]) {
      bodyBox(rig, .075, .59, .055, side * .24, 1.02, -.49, '#252e2d');
      bodyBox(rig, .085, .51, .05, side * .24, 1.01, .25, '#303b38');
      bodyBox(rig, .19, .23, .11, side * .2, .84, .28, cloth('#616a56'));
      bodyBox(legs[side < 0 ? 0 : 1], .24, .18, .08, 0, -.22, .19, '#464c4b');
    }
    bodyBox(rig, .16, .045, .02, 0, .85, -.56, '#b9b29a');
    bodyBox(rig, .04, .16, .02, 0, .85, -.56, '#b9b29a');
    cylinder(rig, .065, .34, .32, .84, -.35, '#80866a', 10);
    weaponModel = createWeaponModel(weapon); weaponModel.scale.setScalar(.44);
    weaponModel.rotation.y = -Math.PI / 2; weaponModel.position.set(.38, 1.04, .55); rig.add(weaponModel);
  } else {
    for (let i = 0; i < 4; i++) {
      const tear = bodyBox(rig, .05, .15, .015, -.23 + i * .15, .97 - i % 2 * .12, .243, '#554a40'); tear.rotation.z = -.4;
    }
    bodyBox(rig, 0.55, 0.07, 0.6, -0.15, 2.09, -0.08, '#565846');
    bodyBox(rig, 0.09, 0.47, 0.04, 0, 0.95, 0.25, '#77534e');
    for (const side of [-1, 1]) {
      const lapel = bodyBox(rig, 0.14, 0.26, 0.06, side * 0.15, 1.12, 0.25, '#c2c1ac'); lapel.rotation.z = side * -0.32;
      bodyBox(rig, 0.18, 0.16, 0.025, side * 0.24, 0.76, 0.24, '#777b65');
    }
  }
  for (const side of [-1, 1]) {
    bodyBox(rig, 0.25, 0.31, 0.29, side * 0.47, 1.04, 0.05, shirt);
    bodyBox(rig, 0.25, 0.24, zombie ? 0.56 : 0.39, side * 0.47, 0.94, zombie ? 0.37 : 0.3, skin);
    if (!zombie) bodyBox(rig, 0.27, 0.08, 0.3, side * 0.47, 1.04, 0.06, color);
  }
  if (zombie && (kind === 'armored' || kind === 'brute' || kind === 'warden')) {
    const armor = kind === 'warden' ? '#536e7a' : '#6c655c';
    bodyBox(rig, 1.07, .27, 1.02, 0, 2.08, .01, armor);
    bodyBox(rig, .8, .5, .14, 0, .99, .3, armor);
    for (const side of [-1, 1]) bodyBox(rig, .4, .3, .5, side * .5, 1.2, .03, armor);
    if (kind === 'brute') {
      for (const side of [-1, 1]) { bodyBox(rig, .43, .4, .48, side * .55, .9, .48, '#827968'); bodyBox(rig, .49, .12, .52, side * .55, .92, .48, '#a59470'); }
      for (let i = 0; i < 3; i++) bodyBox(rig, .08, .27, .05, -.2 + i * .2, .96, .4, '#deac66');
    }
    if (kind === 'warden') {
      bodyBox(rig, .62, .16, .03, 0, 1.7, .46, material('#8ae6ee', { emissive: '#79d7e9', emissiveIntensity: 2 }));
      bodyBox(rig, .32, .33, .13, 0, 1, .42, material('#81dded', { emissive: '#71cfe6', emissiveIntensity: 2 }));
      for (const side of [-1, 1]) { cylinder(rig, .14, .8, side * .4, 1.35, -.4, '#566c73'); bodyBox(rig, .12, .09, .12, side * .4, 1.8, -.4, material('#94e9ee', { emissive: '#7fe2ed', emissiveIntensity: 2 })); }
    }
  }
  if (zombie && ['spitter', 'exploder', 'matriarch'].includes(kind)) {
    const glow = kind === 'exploder' ? '#e7a25f' : '#afd85a';
    for (let i = 0; i < (kind === 'matriarch' ? 7 : 3); i++) {
      const spore = new THREE.Mesh(new THREE.IcosahedronGeometry(.19 + (i % 2) * .06, 0), material(glow, { emissive: glow, emissiveIntensity: .4 }));
      spore.position.set(Math.sin(i * 2.3) * .5, 1.1 + (i % 3) * .4, -.4); rig.add(spore);
    }
    bodyBox(rig, .45, .35, .18, 0, .9, .3, material(glow, { emissive: glow, emissiveIntensity: .25 }));
  }
  if (BOSSES[kind]) { group.scale.setScalar(kind === 'brute' ? 2.05 : 1.85); }
  if (kind === 'tank') group.scale.setScalar(1.45);
  if (kind === 'runner') group.scale.setScalar(0.9);
  const ring = new THREE.Mesh(new THREE.RingGeometry(zombie ? 0.36 : 0.52, zombie ? 0.5 : 0.65, 32),
    new THREE.MeshBasicMaterial({ color: zombie ? '#98634e' : color, transparent: true, opacity: zombie ? 0.12 : 0.3, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.035; group.add(ring);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), material('#ffffff', { map: contactTexture, transparent: true, depthWrite: false, roughness: 1 }));
  contact.rotation.x = -Math.PI / 2; contact.position.y = .025; group.add(contact);
  batchBody(rig);
  const actor = { group, rig, legs, ring, contact, weaponModel, kick: 0, phase: Math.random() * 6.28, target: null, disposed: false };
  if (!zombie) loadWeaponAssets().then(() => {
    if (actor.disposed || actor.weaponModel.userData.importedWeapon) return;
    const replacement = createWeaponModel(weapon); replacement.position.copy(actor.weaponModel.position); replacement.rotation.copy(actor.weaponModel.rotation); replacement.scale.copy(actor.weaponModel.scale);
    disposeProp(actor.weaponModel); rig.add(replacement); actor.weaponModel = replacement;
  });
  return actor;
}

export class GameScene {
  constructor(container) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#101725');
    this.scene.fog = new THREE.Fog('#101725', 24, 68);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.resolutionScale = 1; this.frameWindow = 0; this.frameCount = 0; this.fastWindows = 0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.append(this.renderer.domElement);
    this.lobbyCamera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 120);
    this.followCamera = new THREE.PerspectiveCamera(54, 1, 0.08, 100);
    this.camera = this.lobbyCamera;
    this.cameraYaw = 0;
    this.focus = new THREE.Vector3(0, 0, 0);
    this.players = new Map(); this.zombies = new Map(); this.pickups = new Map(); this.hazards = new Map(); this.signs = []; this.wallMaterials = []; this.neons = [];
    this.effects = []; this.decorations = []; this.fires = []; this.state = null; this.id = null;
    this.raycaster = new THREE.Raycaster(); this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.04);
    this.shake = 0; this.time = 0;
    this.scene.add(new THREE.HemisphereLight('#b8c9d5', '#32302d', 1.3));
    const sun = this.sun = new THREE.DirectionalLight('#adc5ee', 2.2);
    sun.position.set(-20, 30, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, far: 100 });
    sun.shadow.normalBias = 0.025; sun.shadow.bias = -0.0002; this.scene.add(sun);
    this.torch = new THREE.SpotLight('#e5ead6', 24, 16, .45, .65, 1.6);
    this.torch.intensity = 0; this.scene.add(this.torch, this.torch.target);
    this.muzzleLight = new THREE.PointLight('#ffcb87', 0, 7, 2); this.scene.add(this.muzzleLight); this.flashTime = 0;
    this.world = worldFor('quarantine'); this.environment = new THREE.Group(); this.scene.add(this.environment); this.objectiveMarkers = new Map();
    this.buildWorld(); this.buildAtmosphere(); this.batchWorld(); this.buildAttractScene(); this.configureDistrict('quarantine');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const width = window.innerWidth, height = window.innerHeight;
    this.renderer.setSize(width, height);
    const frustum = 38;
    const aspect = width / height;
    this.lobbyCamera.left = -frustum * aspect / 2; this.lobbyCamera.right = frustum * aspect / 2;
    this.lobbyCamera.top = frustum / 2; this.lobbyCamera.bottom = -frustum / 2;
    this.lobbyCamera.updateProjectionMatrix();
    this.followCamera.aspect = aspect;
    this.followCamera.fov = aspect < 0.8 ? 72 : 54;
    this.followCamera.updateProjectionMatrix();
  }

  adaptResolution(frameSeconds) {
    // Keep input/HUD responsive on weaker GPUs; DOM text always stays at native resolution.
    if (!this.id || document.hidden || frameSeconds <= 0 || frameSeconds > 1) {
      this.frameWindow = 0; this.frameCount = 0; return;
    }
    this.frameWindow += frameSeconds; this.frameCount++;
    if (this.frameWindow < 1.2 || this.frameCount < 6) return;
    const average = this.frameWindow / this.frameCount;
    this.frameWindow = 0; this.frameCount = 0;
    let scale = this.resolutionScale;
    if (average > .036) { scale = Math.max(.55, scale - .15); this.fastWindows = 0; }
    else if (average < .019) { if (++this.fastWindows >= 4) { scale = Math.min(1, scale + .1); this.fastWindows = 0; } }
    else this.fastWindows = 0;
    if (Math.abs(scale - this.resolutionScale) < .001) return;
    this.resolutionScale = scale;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75) * scale);
    const shadowSize = scale < .8 ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== shadowSize) {
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
      this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
    }
  }

  buildWorld() {
    const edge = this.world.size / 2;
    const asphalt = surface('asphalt').clone(); asphalt.needsUpdate = true;
    asphalt.repeat.set(this.world.size / 2, this.world.size / 2);
    box(this.environment, 120, 0.8, 120, 0, -0.55, 0, '#252d39');
    this.groundMaterial = material('#c3c6cf', { map: asphalt, bumpMap: asphalt, bumpScale: .02, roughness: .58, metalness: .12 });
    box(this.environment, this.world.size + 1, 0.18, this.world.size + 1, 0, -.08, 0, this.groundMaterial);
    for (let i = -edge + 2; i <= edge - 2; i += 4) {
      if (Math.abs(i) > 5) {
        box(this.environment, 0.1, 0.015, 1.6, 0, 0.055, i, '#827f66', false);
        box(this.environment, 1.6, 0.015, 0.1, i, 0.055, 0, '#827f66', false);
      }
    }
    for (const z of [-7.5, 7.5]) for (let x = -4.8; x < 5; x += 1.15)
      box(this.environment, 0.65, 0.016, 1.5, x, 0.06, z, '#7c8289', false);
    for (const obstacle of this.world.obstacles) this.buildObstacle(obstacle);
    const lampGlow = glowTexture();
    for (const x of [-6, 6]) for (const z of [-18, 18]) {
      cylinder(this.environment, 0.13, 4.5, x, 2.25, z, '#33423c');
      box(this.environment, 0.15, 0.15, 1.2, x, 4.5, z + 0.5, '#33423c');
      box(this.environment, 0.5, 0.15, 0.7, x, 4.42, z + 1, material('#ffe3a6', { emissive: '#e3b963', emissiveIntensity: 0.8 }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampGlow, color: '#ffcf8a', opacity: .4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(x, 4.36, z + 1); glow.scale.setScalar(1.4); this.environment.add(glow);
      const light = new THREE.PointLight('#ffc582', 22, 12, 1.8);
      light.position.set(x, 4.15, z + 1); this.environment.add(light);
    }
    for (const [x, z] of [[-20, -4], [19, 5], [-5, 19], [5, -20], [-19, 19], [20, -20]]) {
      cylinder(this.environment, 0.25, 1.4, x, 0.7, z, '#5e5140');
      cylinder(this.environment, .12, 3.4, x, 2, z, '#45433d');
      for (let i = 0; i < 4; i++) {
        const branch = box(this.environment, .08, 1.5, .09, x + Math.sin(i * 2) * .45, 2.5 + i * .15, z + Math.cos(i * 2) * .4, '#494840');
        branch.rotation.z = Math.sin(i * 2) * .7; branch.rotation.x = Math.cos(i * 2) * .6;
      }
      box(this.environment, 2.6, 0.3, 2.6, x, 0.15, z, '#4b5355');
    }
    for (let i = 0; i < 48; i++) {
      const x = Math.sin(i * 127.1) * 21, z = Math.cos(i * 311.7) * 21;
      box(this.environment, 0.12 + (i % 3) * 0.06, 0.08, 0.24, x, 0.09, z, i % 2 ? '#7c8471' : '#a29a79', false);
    }
    for (const x of [-edge - .6, edge + .6]) for (let z = -edge + 1; z <= edge - 1; z += 2) {
      box(this.environment, 0.12, 1.35, 0.12, x, 0.67, z, '#60716b');
      box(this.environment, 0.08, 0.08, 2, x, 0.9, z, '#60716b');
    }
    for (const z of [-edge - .6, edge + .6]) for (let x = -edge + 1; x <= edge - 1; x += 2) {
      box(this.environment, 0.12, 1.35, 0.12, x, 0.67, z, '#60716b');
      box(this.environment, 2, 0.08, 0.08, x, 0.9, z, '#60716b');
    }
    // A quiet skyline frames the playable district.
    for (let i = 0; i < 20; i++) {
      const angle = i / 20 * Math.PI * 2, radius = edge + 13 + i % 3 * 3;
      const height = 5 + i % 5 * 2.3;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      box(this.environment, 5 + i % 4, height, 6, x, height / 2 - 1, z, '#252d3d');
      for (let floor = 1; floor < height - 1; floor += 2) for (const offset of [-1.5, 0, 1.5])
        box(this.environment, 0.55, 0.9, 0.03, x + offset, floor, z + 3.03, material('#667584', { emissive: '#a99a71', emissiveIntensity: (i + floor) % 3 < 1 ? 0.35 : 0.02 }), false);
    }
    for (const [x, z] of [[-5, -edge - 1.5], [edge + 1.5, 4]]) this.buildFire(x, z);
    // A distant wall, warning sign and moon give the street a readable horizon.
    box(this.environment, 18, 4.2, 0.7, 0, 2.1, -edge - 2, brickMaterial(18, 4.2, '#acadb5'));
    box(this.environment, 5.4, 3.2, 0.2, 1, 1.6, -edge - 1.5, '#292c36');
    for (let i = 0; i < 13; i++) box(this.environment, 0.08, 3.1, 0.1, -1.4 + i * 0.4, 1.6, -edge - 1.35, '#58565b');
    const warning = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 0.75), new THREE.MeshBasicMaterial({ map: textTexture('ZONE CONDAMNÉE', '#c3aa73', '#292c33') }));
    warning.position.set(1, 3.45, -edge - 1.5); this.environment.add(warning);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(2.3, 32), new THREE.MeshBasicMaterial({ color: '#8d9bb3', fog: false }));
    moon.position.set(12, 20, -60); this.environment.add(moon);
  }

  buildAtmosphere() {
    // Reflective wet patches and road scarring use shared geometry and remain inexpensive.
    const puddle = material('#34444b', { metalness: .65, roughness: .12, envMap: reflectionTexture(), envMapIntensity: .6, transparent: true, opacity: .6 });
    for (let i = 0; i < 18; i++) {
      const x = Math.sin(i * 7.3) * 19, z = Math.cos(i * 4.7) * 19;
      const wet = new THREE.Mesh(new THREE.CircleGeometry(1, 11), puddle); wet.rotation.x = -Math.PI / 2; wet.rotation.z = i * 1.7; wet.scale.set(1.2 + i % 3, .6 + i % 2, 1); wet.position.set(x, .025, z); this.environment.add(wet);
    }
    for (let i = 0; i < 7; i++) {
      const crack = box(this.environment, .05, .015, 1.8, -3.5 + Math.sin(i * 5) * 1.4, .04, -3 + i * 2.7, '#202a2b', false); crack.rotation.y = i * .6;
    }
    const stainTexture = radialTexture();
    const stainMaterial = new THREE.MeshBasicMaterial({ map: stainTexture, transparent: true, depthWrite: false, color: '#4a3029' });
    for (let i = 0; i < 22; i++) {
      const stain = new THREE.Mesh(new THREE.PlaneGeometry(2 + i % 4, 1 + i % 3), stainMaterial);
      stain.rotation.x = -Math.PI / 2; stain.rotation.z = i;
      stain.position.set(Math.sin(i * 13.2) * (this.world.size / 2 - 2), .03, Math.cos(i * 5.7) * (this.world.size / 2 - 2)); this.environment.add(stain);
    }
    for (const x of [-4.5, 4.5]) for (const z of [-12, 12]) {
      box(this.environment, .7, .015, 1.2, x, .035, z, '#20292b', false);
      for (let j = 0; j < 7; j++) box(this.environment, .65, .018, .04, x, .048, z - .5 + j * .16, '#515c5e', false);
    }
    // Ruined industrial structures sit beyond the playable perimeter.
    for (const x of [-this.world.size / 2 - 6, this.world.size / 2 + 5]) {
      cylinder(this.environment, 2.2, 5, x, 2.5, -12, '#46524c', 12);
      for (const y of [1, 3, 4.8]) cylinder(this.environment, 2.26, .14, x, y, -12, '#777363', 12);
      box(this.environment, 2, .2, 9, x, 6, -9, '#4b5755');
      for (let i = 0; i < 4; i++) { const beam = box(this.environment, .4, 7 + i % 2 * 2, .5, x + (i % 2) * 3, 3, 5 + i * 2.5, '#3e494c'); beam.rotation.z = (i % 2 ? 1 : -1) * .18; }
    }
    const count = 320, positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) { positions[i*3] = (Math.random()-.5)*(this.world.size + 8); positions[i*3+1] = Math.random()*18; positions[i*3+2] = (Math.random()-.5)*(this.world.size + 8); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.weather = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#b6c8ce', size: .045, transparent: true, opacity: .4, depthWrite: false }));
    this.weather.frustumCulled = false; this.environment.add(this.weather);
  }

  configureDistrict(id = 'quarantine') {
    const next = worldFor(id);
    if (next !== this.world) {
      const geometries = new Set(), ownedMaterials = new Set(), sharedMaterials = new Set(materials.values());
      this.environment.traverse(mesh => {
        if (mesh.geometry && mesh.geometry !== boxGeometry && mesh.geometry !== roundedGeometry) geometries.add(mesh.geometry);
        if (mesh.isInstancedMesh) mesh.dispose();
        if (mesh.material) for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (!sharedMaterials.has(mat)) ownedMaterials.add(mat);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const mat of ownedMaterials) { mat.map?.dispose(); mat.dispose(); }
      this.environment.clear(); this.signs = []; this.wallMaterials = []; this.neons = []; this.fires = [];
      this.world = next; this.buildWorld(); this.buildAtmosphere(); this.batchWorld();
    }
    const d = DISTRICTS[id] || DISTRICTS.quarantine; this.district = id;
    this.scene.background.set(d.sky); this.scene.fog.color.set(d.fog);
    this.scene.fog.near = id === 'laboratory' ? 18 : 24;
    this.sun.color.set(d.moon); this.sun.intensity = d.light;
    this.groundMaterial.color.set(d.ground);
    this.wallMaterials.forEach(m => m.color.set(id === 'foundry' ? '#c59d89' : id === 'laboratory' ? '#9cb8ad' : '#c0bdba'));
    this.signs.forEach((sign, i) => { sign.material.map.dispose(); sign.material.map = textTexture(d.labels[i % 4], d.color, '#20292b'); sign.material.needsUpdate = true; });
    this.neons.forEach(m => { m.color.set(d.color); m.emissive.set(d.color); });
    this.weather.material.color.set(id === 'foundry' ? '#f2ae73' : id === 'laboratory' ? '#bddacb' : '#c6cbd3');
    this.weather.material.size = id === 'foundry' ? .065 : .035;
  }

  buildFire(x, z) {
    cylinder(this.environment, 0.5, 1.15, x, 0.57, z, '#4a3a32');
    const flame = new THREE.Group(); flame.position.set(x, 1.2, z); this.environment.add(flame);
    const flameMap = glowTexture(true), glowMap = glowTexture();
    for (let i = 0; i < 3; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameMap, transparent: true, opacity: .85, depthWrite: false, color: i === 1 ? '#fff5c3' : '#ffac63' }));
      sprite.position.set((i - 1) * .17, .45 + i * .1, i * .09); sprite.scale.set(.65 - i * .07, 1.5 - i * .17, 1); flame.add(sprite);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: '#ff8e35', transparent: true, opacity: .26, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.y = .4; halo.scale.set(2.2, 2.6, 1); flame.add(halo);
    const light = new THREE.PointLight('#ff9d4d', 35, 14, 1.7); light.position.set(x, 2, z); this.environment.add(light);
    const smoke = [], texture = radialTexture(true);
    for (let i = 0; i < 4; i++) {
      const puff = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: .23, depthWrite: false, color: '#7a7f86' }));
      this.environment.add(puff); smoke.push(puff);
    }
    this.fires.push({ flame, light, smoke, x, z, phase: x + z });
  }

  batchWorld() {
    // Hundreds of static window/brick/curb pieces can share a single draw call.
    // Keep the animated flames and multi-material buildings separate.
    this.environment.updateMatrixWorld(true);
    const animated = new Set(this.fires.flatMap(fire => fire.flame.children));
    const batches = new Map();
    this.environment.traverse(mesh => {
      if (!mesh.isMesh || Array.isArray(mesh.material) || animated.has(mesh)) return;
      const key = `${mesh.geometry.uuid}/${mesh.material.uuid}/${mesh.castShadow}/${mesh.receiveShadow}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(mesh);
    });
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const first = meshes[0];
      const batch = new THREE.InstancedMesh(first.geometry, first.material, meshes.length);
      batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow;
      meshes.forEach((mesh, index) => { batch.setMatrixAt(index, mesh.matrixWorld); mesh.removeFromParent(); });
      batch.instanceMatrix.needsUpdate = true; batch.computeBoundingSphere();
      this.environment.add(batch);
    }
  }

  buildObstacle(o) {
    const group = new THREE.Group(); group.position.set(o.x, 0, o.z); this.environment.add(group);
    if (o.type === 'shop') {
      box(group, o.w + 0.7, 0.22, o.d + 0.7, 0, 0.11, 0, '#626773');
      const side = brickMaterial(o.d, o.h, '#c0bdba'), front = brickMaterial(o.w, o.h, '#c0bdba');
      this.wallMaterials.push(side, front);
      box(group, o.w, o.h, o.d, 0, o.h / 2, 0, [side, side, material('#494d58'), material('#494d58'), front, front]);
      for (const x of [-o.w / 3, o.w / 3]) {
        const board = box(group, 2.1, .18, .1, x, 1.7, o.d / 2 + .31, cloth('#625949')); board.rotation.z = -.42;
        for (let j = 0; j < 3; j++) box(group, .045, .6 + j * .3, .025, x - .5 + j * .37, .4, o.d / 2 + .02, '#353936', false);
      }
      for (const x of [-o.w / 2 + .2, o.w / 2 - .2]) { cylinder(group, .07, o.h + .4, x, o.h / 2, o.d / 2 + .25, '#625b4a'); }
      const neon = material('#b6c1af', { emissive: '#b6c1af', emissiveIntensity: 1.5 }); this.neons.push(neon);
      box(group, o.w - 1, .06, .08, 0, 3.98, o.d / 2 + .14, neon, false);
      box(group, o.w + 0.2, 0.3, o.d + 0.2, 0, o.h + 0.12, 0, '#3b424f');
      box(group, o.w - 0.5, 0.06, o.d - 0.5, 0, o.h + 0.31, 0, '#555964');
      box(group, 1.5, 0.65, 1.6, -1.5, o.h + 0.6, -0.5, '#91a196');
      box(group, 1.2, 0.05, 1.3, -1.5, o.h + 0.95, -0.5, '#4c605b');
      box(group, 1.3, 2.4, 0.12, 0, 1.4, o.d / 2 + 0.07, '#2c4543');
      for (const x of [-o.w / 3, o.w / 3]) {
        box(group, 1.9, 1.9, 0.1, x, 1.7, o.d / 2 + 0.06, material('#243140', { emissive: '#9d8155', emissiveIntensity: x < 0 ? 0.12 : 0.02 }));
        box(group, 0.07, 1.9, 0.14, x, 1.7, o.d / 2 + 0.14, '#66707c');
        box(group, 1.9, 0.07, 0.14, x, 1.7, o.d / 2 + 0.14, '#66707c');
        const plank = box(group, 2.05, 0.21, 0.13, x, 1.42, o.d / 2 + 0.22, '#66594d'); plank.rotation.z = x < 0 ? 0.25 : -0.32;
      }
      for (const sideSign of [-1, 1]) for (const z of [-o.d / 3, 0, o.d / 3]) {
        box(group, 0.07, 1.6, 1.2, sideSign * (o.w / 2 + 0.04), o.h - 1.4, z, '#1d2733');
        box(group, 0.1, 1.65, 0.06, sideSign * (o.w / 2 + 0.09), o.h - 1.4, z, '#515963');
        box(group, 0.1, 0.06, 1.25, sideSign * (o.w / 2 + 0.09), o.h - 1.4, z, '#515963');
      }
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(o.w - 1, 6.5), 1.1),
        new THREE.MeshBasicMaterial({ map: textTexture(o.label, '#b7b9ac', '#30353c') }));
      this.signs.push(sign);
      sign.position.set(0, 3.35, o.d / 2 + 0.08); group.add(sign);
      for (let i = 0; i < o.w; i++) box(group, 0.9, 0.16, 1.3, -o.w / 2 + 0.5 + i, 2.8, o.d / 2 + 0.55, i % 2 ? '#776a63' : '#48434a');
    } else if (o.type === 'car') {
      box(group, o.w, 0.65, o.d, 0, 0.68, 0, o.color);
      box(group, o.w - 0.2, 0.65, 2.2, 0, 1.24, -0.2, o.color);
      box(group, o.w - 0.38, 0.43, 0.08, 0, 1.25, 0.95, '#3b5558');
      box(group, o.w - 0.38, 0.43, 0.08, 0, 1.25, -1.35, '#3b5558');
      for (const x of [-o.w / 2, o.w / 2]) for (const z of [-1.3, 1.3]) {
        const wheel = cylinder(group, .34, .28, x, .36, z, '#1d2424', 16); wheel.rotation.z = Math.PI / 2;
        const rim = cylinder(group, .17, .3, x, .36, z, '#696e6c', 12); rim.rotation.z = Math.PI / 2;
      }
      for (const z of [-o.d / 2, o.d / 2]) box(group, o.w + .05, .15, .13, 0, .45, z, '#626966');
      for (const side of [-1, 1]) {
        box(group, .035, .035, 1.9, side * (o.w / 2 + .01), .78, .3, '#b0a68c');
        box(group, .035, .17, .6, side * (o.w / 2 + .02), .55, -.5, '#5a4436');
      }
      const hood = box(group, o.w - .1, .07, 1.5, 0, 1.04, o.d / 2 - .7, cloth('#4f5855')); hood.rotation.x = -.14;
      box(group, .045, .52, .015, .25, 1.26, .998, '#9ba7a4').rotation.z = .55;
      for (const x of [-0.75, 0.75]) box(group, 0.4, 0.2, 0.07, x, 0.8, o.d / 2 + 0.05, '#decda0');
    } else {
      box(group, o.w, o.h, o.d, 0, o.h / 2, 0, o.color);
      for (const x of [-1, 0, 1]) {
        const stripe = box(group, 0.28, 0.7, 0.02, x, o.h / 2, o.d / 2 + 0.02, '#4a4c3c'); stripe.rotation.z = -0.4;
      }
    }
  }

  buildAttractScene() {
    const poses = [[2, 2, 0.7], [4.6, 3.2, 2.4], [2.5, 5.2, -1.5]];
    poses.forEach(([x, z, angle], i) => {
      const actor = character(PLAYER_COLORS[i], false, 'walker', ['carbine','smg','shotgun'][i]); actor.group.position.set(x, 0, z); actor.rig.rotation.y = angle;
      this.scene.add(actor.group); this.decorations.push(actor.group);
    });
    [[-3, 5], [8, 6], [-3, -3], [4, -6], [8, -7], [-5, 9], [10, 8]].forEach(([x, z], i) => {
      const actor = character('#829272', true); actor.group.position.set(x, 0, z); actor.rig.rotation.y = i;
      this.scene.add(actor.group); this.decorations.push(actor.group);
    });
  }

  setPlayer(id) {
    this.id = id;
    if (!id) this.torch.intensity = 0;
    this.camera = id ? this.followCamera : this.lobbyCamera;
    this.cameraYaw = 0;
    this.cameraReady = false;
    this.decorations.forEach(group => { group.visible = !id; });
    this.resize();
    if (!id) {
      for (const map of [this.players, this.zombies, this.pickups, this.hazards, this.objectiveMarkers]) {
        for (const actor of map.values()) this.removeActor(actor);
        map.clear();
      }
      this.state = null;
    }
  }

  removeActor(actor) {
    actor.disposed = true;
    actor.group.traverse(mesh => { if (mesh.isInstancedMesh) mesh.dispose(); });
    if (actor.weaponModel) { disposeProp(actor.weaponModel); actor.weaponModel = null; }
    this.scene.remove(actor.group);
    if (actor.boss) {
      actor.disposed = true;
      if (actor.model) disposeBossModel(actor.model);
      if (actor.fallback) this.removeActor(actor.fallback);
      actor.ring.geometry.dispose(); actor.ring.material.dispose();
      return;
    }
    if (actor.disposable) actor.group.traverse(mesh => { if (mesh.isMesh) { mesh.geometry.dispose(); mesh.material.dispose(); } });
    if (!actor.disposable) actor.group.traverse(mesh => { if (mesh.isMesh && mesh.geometry !== boxGeometry && mesh.geometry !== roundedGeometry && mesh !== actor.ring) mesh.geometry.dispose(); });
    if (actor.ring) { actor.ring.geometry.dispose(); actor.ring.material.dispose(); }
    actor.contact?.material.dispose();
    if (actor.label) { actor.label.material.map.dispose(); actor.label.material.dispose(); }
  }

  applyState(state) {
    this.state = state;
    const update = (items, map, create) => {
      const ids = new Set(items.map(item => item.id));
      for (const [id, actor] of map) if (!ids.has(id)) {
        this.removeActor(actor);
        map.delete(id);
      }
      for (const item of items) {
        let actor = map.get(item.id);
        if (!actor) {
          actor = create(item); map.set(item.id, actor); this.scene.add(actor.group);
          actor.group.position.set(item.x, 0, item.z);
        }
        actor.target = item;
      }
    };
    const objective = state.objective;
    const points = objective ? (objective.ready ? [{ id: 'exit', ...objective.exit, kind: 'exit' }] : objective.goal === 'boss' ? [] : objective.points.map(p => ({ ...p, kind: objective.goal }))) : [];
    update(points, this.objectiveMarkers, p => {
      const group = new THREE.Group(), color = p.kind === 'exit' ? '#77d6bf' : '#dfbe70';
      const ring = new THREE.Mesh(new THREE.RingGeometry(p.kind === 'defend' ? 3.8 : 1.3, p.kind === 'defend' ? 4 : 1.45, 40), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: .65, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .07; group.add(ring);
      const terminal = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.1, .6), new THREE.MeshStandardMaterial({ color: '#35494b', roughness: .7 }));
      terminal.position.y = .55; terminal.castShadow = true; group.add(terminal);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(.53, .3, .64), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .6 })); screen.position.y = .8; group.add(screen);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(p.kind === 'exit' ? 'EXTRACTION' : p.kind === 'defend' ? 'RELAIS' : `RÉSERVE ${p.id + 1}`, color, '#162325'), depthTest: false }));
      label.position.y = 2; label.scale.set(2.7, .65, 1); group.add(label);
      return { group, label, disposable: true };
    });
    for (const actor of this.objectiveMarkers.values()) actor.group.visible = !actor.target.done;
    update(state.players, this.players, p => {
      const actor = character(p.color, false, 'walker', p.weapon);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(p.name.toUpperCase(), p.color, 'rgba(18,29,29,0.7)'), transparent: true, depthTest: false }));
      label.position.y = 2.6; label.scale.set(1.8, 0.45, 1); label.visible = p.id !== this.id;
      actor.group.add(label); actor.label = label;
      return actor;
    });
    update(state.zombies, this.zombies, z => character('#829272', true, z.kind));
    update(state.pickups, this.pickups, p => {
      const group = new THREE.Group();
      const kind = !p.kind || p.kind === 'health' ? 'medical' : p.kind === 'cache' ? p.boss || 'brute' : 'salvage';
      const crate = createCrateModel(kind); crate.scale.setScalar(p.kind === 'cache' ? .85 : .55); group.add(crate);
      const ring = new THREE.Mesh(new THREE.RingGeometry(p.kind === 'cache' ? .7 : .42, p.kind === 'cache' ? .76 : .47, 32), new THREE.MeshBasicMaterial({ color: kind === 'medical' ? '#df9c83' : p.kind === 'cache' ? '#d4bb7a' : '#a4c18c', transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .045; group.add(ring);
      return { group, ring };
    });
    update(state.hazards || [], this.hazards, h => {
      const group = new THREE.Group(), color = h.friendly ? '#e8d99b' : h.kind === 'acid' ? '#b6d66f' : h.kind === 'electric' ? '#82dcee' : '#f39c63';
      const ring = new THREE.Mesh(new THREE.RingGeometry(h.radius - .1, h.radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, side: THREE.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .08; group.add(ring);
      const fill = new THREE.Mesh(new THREE.CircleGeometry(h.radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false }));
      fill.rotation.x = -Math.PI / 2; fill.position.y = .07; group.add(fill);
      const inner = ring.clone(); inner.geometry = ring.geometry.clone(); inner.material = ring.material.clone(); inner.position.y = .09; group.add(inner);
      return { group, fill, inner, disposable: true };
    });
    for (const event of state.events) {
      if (event.type === 'shot' || event.type === 'arc') { this.shot(event); const actor = this.players.get(event.player); if (actor) actor.kick = 1; }
      if (event.type === 'blast') this.burst(event.x, event.z, event.kind === 'acid' ? '#b9d87b' : event.kind === 'electric' ? '#8fdcea' : '#eab278', 16);
      if (event.type === 'kill') this.burst(event.x, event.z, '#a2ba76', 7);
      if (event.type === 'hurt' && event.id === this.id) this.shake = 0.3;
    }
  }

  shot(event) {
    const source = new THREE.Vector3(event.x, 1.04, event.z);
    const muzzle = event.type === 'shot' && this.players.get(event.player)?.weaponModel?.getObjectByName('muzzle');
    if (muzzle) muzzle.getWorldPosition(source);
    const geometry = new THREE.BufferGeometry().setFromPoints([
      source, new THREE.Vector3(event.endX, 1.04, event.endZ),
    ]);
    const tracer = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: event.weapon ? weaponFor(event.weapon).color : '#ffe5a6', transparent: true, opacity: 0.85 }));
    this.scene.add(tracer); this.effects.push({ object: tracer, ttl: 0.09, max: 0.09 });
    if (event.hit) this.burst(event.endX, event.endZ, weaponFor(event.weapon).color, event.weapon === 'venom' ? 9 : 3);
    if (event.weapon === 'ember') this.burst((event.x + event.endX) / 2, (event.z + event.endZ) / 2, '#eb9b53', 2);
    const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), new THREE.MeshBasicMaterial({ color: '#fff2b6' }));
    const direction = new THREE.Vector3(event.endX - event.x, 0, event.endZ - event.z).normalize();
    if (muzzle) flash.position.copy(source); else flash.position.set(event.x + direction.x * 1.25, 1.04, event.z + direction.z * 1.25);
    this.muzzleLight.position.copy(flash.position); this.muzzleLight.intensity = 12; this.flashTime = .055;
    this.scene.add(flash); this.effects.push({ object: flash, ttl: 0.055, max: 0.055 });
  }

  burst(x, z, color, count) {
    if (this.effects.length > 250) return;
    for (let i = 0; i < count; i++) {
      const particle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), new THREE.MeshBasicMaterial({ color, transparent: true }));
      particle.position.set(x, 0.7, z);
      this.scene.add(particle);
      this.effects.push({ object: particle, ttl: 0.4, max: 0.4, velocity: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4) });
    }
  }

  aimAt(clientX, clientY) {
    this.raycaster.setFromCamera(new THREE.Vector2(clientX / window.innerWidth * 2 - 1, -(clientY / window.innerHeight) * 2 + 1), this.camera);
    const enemy = characterUnderAim(this.raycaster.ray, [...this.zombies.values()].map(actor => ({
      x: actor.group.position.x, z: actor.group.position.z,
      radius: actor.target.boss ? 1.2 : actor.target.kind === 'tank' ? .85 : .58, height: 2.2 * actor.group.scale.y,
    })));
    if (enemy) return new THREE.Vector3(enemy.x, 1.04, enemy.z);
    const point = this.raycaster.ray.intersectPlane(this.aimPlane, new THREE.Vector3());
    // Above the horizon, retain a valid horizontal direction instead of aiming backwards.
    if (point) return point;
    const p = this.players.get(this.id)?.group.position;
    return p ? p.clone().addScaledVector(this.raycaster.ray.direction, 40) : null;
  }

  orbit(pixels) {
    this.cameraYaw -= pixels * 0.006;
    this.cameraYaw = Math.atan2(Math.sin(this.cameraYaw), Math.cos(this.cameraYaw));
  }

  movement(x, y) {
    return movementInView(x, y, this.cameraYaw);
  }

  render(dt, inputAim) {
    if (this.inspectionOpen && !this.id) return;
    if (!this.id) {
      this.lobbyElapsed = (this.lobbyElapsed || 0) + dt;
      if (this.lobbyElapsed < 1 / 20) return;
      dt = this.lobbyElapsed; this.lobbyElapsed = 0;
    }
    this.time += dt;
    this.flashTime = Math.max(0, this.flashTime - dt); this.muzzleLight.intensity = this.flashTime > 0 ? 12 : 0;
    const particles = this.weather.geometry.attributes.position;
    for (let i = 0; i < particles.count; i++) {
      let y = particles.getY(i) + dt * (this.district === 'foundry' ? .65 : -5);
      if (y < 0) y = 18; if (y > 18) y = 0; particles.setY(i, y);
    }
    particles.needsUpdate = true;
    this.neons.forEach((m, i) => { m.emissiveIntensity = Math.sin(this.time * 4 + i * 7) > .98 ? .1 : 1.5; });
    for (const actor of this.hazards.values()) {
      const h = actor.target; if (!h) continue;
      actor.fill.material.opacity = h.delay > 0 ? .09 + (1 - h.delay / h.duration) * .14 : .38 + Math.sin(this.time * 14) * .1;
      actor.inner.scale.setScalar(h.delay > 0 ? Math.max(.04, 1 - h.delay / h.duration) : 1);
    }
    const alpha = 1 - Math.exp(-dt * 17);
    for (const map of [this.players, this.zombies]) for (const [id, actor] of map) {
      const target = actor.target; if (!target) continue;
      const oldX = actor.group.position.x, oldZ = actor.group.position.z;
      actor.group.position.x += (target.x - oldX) * alpha; actor.group.position.z += (target.z - oldZ) * alpha;
      const moving = Math.hypot(target.x - oldX, target.z - oldZ) > 0.025;
      actor.phase += dt * (moving ? 13 : 2);
      if (actor.weaponModel) {
        actor.kick = Math.max(0, actor.kick - dt * 10);
        const reloading = target.reload > 0 ? Math.sin(Math.PI * (1 - target.reload / target.reloadDuration)) : 0;
        actor.weaponModel.position.z = .55 - actor.kick * .095;
        actor.weaponModel.position.y = 1.04 - reloading * .15;
        actor.weaponModel.rotation.z = -.22 * reloading + actor.kick * .035;
      }
      actor.model?.userData.animate(dt, { moving, enraged: target.enraged, attacking: target.attacking });
      actor.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(actor.phase + i * Math.PI) * 0.6 : 0; });
      const aim = id === this.id && Number.isFinite(inputAim) ? inputAim : target.aim;
      const diff = Math.atan2(Math.sin(aim - actor.rig.rotation.y), Math.cos(aim - actor.rig.rotation.y));
      actor.rig.rotation.y += diff * alpha;
      actor.rig.rotation.z = target.hp <= 0 ? Math.PI / 2 : 0;
      actor.rig.position.y = actor.boss ? 0 : target.hp <= 0 ? 0.1 : moving ? Math.abs(Math.sin(actor.phase)) * 0.06 : Math.sin(this.time * 2 + actor.phase) * 0.02;
      if (target.burning && Math.random() < dt * 8) this.burst(target.x, target.z, '#e58c4b', 2);
      actor.ring.material.opacity = target.hp <= 0 ? 0.3 + Math.sin(this.time * 6) * 0.2 : actor.boss ? (target.enraged ? .5 : .28) : map === this.zombies ? 0.1 : 0.25;
    }
    for (const actor of this.pickups.values()) { actor.group.rotation.y += dt; actor.group.position.y = 0.1 + Math.sin(this.time * 3) * 0.08; }
    const local = this.players.get(this.id);
    const torchActive = !!local && local.target.hp > 0;
    this.torch.intensity = torchActive ? 24 : 0;
    if (torchActive) {
      const aim = local.rig.rotation.y;
      this.torch.position.set(local.group.position.x + Math.sin(aim) * .65, 1.15, local.group.position.z + Math.cos(aim) * .65);
      this.torch.target.position.set(local.group.position.x + Math.sin(aim) * 12, -.35, local.group.position.z + Math.cos(aim) * 12);
    }
    const target = local ? local.group.position : new THREE.Vector3(window.innerWidth > 800 ? -7 : 0, 0, 0);
    if (local && !this.cameraReady) { this.focus.copy(target); this.cameraReady = true; }
    this.focus.lerp(target, 1 - Math.exp(-dt * 9));
    this.shake = Math.max(0, this.shake - dt);
    if (this.id) {
      const portrait = this.followCamera.aspect < 0.8;
      const distance = portrait ? 8.2 : 6, height = portrait ? 5 : 3.3;
      const backward = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
      const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
      const desired = this.focus.clone().addScaledVector(backward, distance).addScaledVector(right, portrait ? 0.55 : 0.95);
      desired.y = height;
      const anchor = this.focus.clone(); anchor.y = 1.35;
      this.camera.position.copy(unobstructedCamera(anchor, desired, this.world.obstacles));
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.3;
      const look = this.focus.clone().addScaledVector(backward, portrait ? -2.3 : -3.6);
      if (!portrait) look.addScaledVector(right, 0.75);
      look.y = portrait ? 1 : 0.4;
      this.camera.lookAt(look);
    } else {
      this.camera.position.copy(this.focus).add(new THREE.Vector3(15, 24, 19));
      this.camera.lookAt(this.focus);
    }
    for (const fire of this.fires) {
      const flicker = Math.sin(this.time * 17 + fire.phase) * 0.12 + Math.sin(this.time * 29) * 0.06;
      fire.flame.scale.set(1 - flicker * 0.3, 1 + flicker, 1 - flicker * 0.3);
      fire.light.intensity = 35 + flicker * 35;
      fire.smoke.forEach((puff, i) => {
        const age = (this.time * .22 + i / 4) % 1;
        puff.position.set(fire.x + age * 1.2, 1.8 + age * 5, fire.z + Math.sin(age * 3 + fire.phase) * .3);
        puff.scale.setScalar(.9 + age * 3); puff.material.opacity = Math.sin(age * Math.PI) * .22;
      });
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]; effect.ttl -= dt;
      if (effect.velocity) {
        effect.object.position.addScaledVector(effect.velocity, dt); effect.velocity.y -= dt * 8;
      }
      if (effect.object.material.transparent) effect.object.material.opacity = Math.max(0, effect.ttl / effect.max);
      if (effect.ttl <= 0) {
        this.scene.remove(effect.object); effect.object.geometry.dispose(); effect.object.material.dispose(); this.effects.splice(i, 1);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
