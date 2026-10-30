import * as THREE from 'three';
import { reflectionTexture } from './surface-materials.js';
import { createWeaponModel, createCrateModel, createGrenadeModel, disposeProp, CRATES, WEAPON_FINISHES } from './props.js';
import { createBossModel, disposeBossModel, BOSS_DESIGNS } from './boss-models.js';
import { weaponFor, BOSSES } from '../shared/content.mjs';
import './prop-viewer.css';

const thumbnails = new Map();
export function refreshWeaponThumbnails() { for (const key of thumbnails.keys()) if (key.startsWith('weapon/')) thumbnails.delete(key); }
let studio;
function makeModel(kind, id) { return kind === 'boss' ? createBossModel(id) : kind === 'crate' ? createCrateModel(id) : kind === 'supply' ? createGrenadeModel() : createWeaponModel(id); }
function lightScene(scene) {
  scene.environment = reflectionTexture(); scene.environmentIntensity = .7;
  scene.add(new THREE.HemisphereLight('#e1e8e4', '#40484c', 2.7));
  const key = new THREE.DirectionalLight('#fff1d8', 3.5); key.position.set(-2, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#91b4cb', 2.8); rim.position.set(2, 1, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight('#d0ac83', 1); fill.position.set(-4, -.3, 1); scene.add(fill);
}
function disposeModel(model) { if (model.userData.bossAsset) disposeBossModel(model); else disposeProp(model); }
function fitModel(model) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  model.traverseVisible(mesh => { if (mesh.isMesh) {
    if (mesh.isSkinnedMesh) { mesh.computeBoundingBox(); bounds.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld)); }
    else { mesh.geometry.computeBoundingBox(); bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)); }
  } });
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3()); for (const child of model.children) child.position.sub(center);
  return size;
}
function configureRenderer(renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.setClearColor('#182125', 0);
}

export function propThumbnail(kind, id) {
  const key = `${kind}/${id}`;
  if (thumbnails.has(key)) return thumbnails.get(key);
  let model;
  try {
    if (!studio) {
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      configureRenderer(renderer); renderer.setPixelRatio(1); renderer.setSize(640, 280, false);
      const scene = new THREE.Scene(); lightScene(scene);
      studio = { renderer, scene, camera: new THREE.OrthographicCamera(-2, 2, 1, -1, .01, 40) };
    }
    const { renderer, scene, camera } = studio;
    model = makeModel(kind, id); if (!model) return null; const size = fitModel(model);
    if (kind === 'boss') model.rotation.y = -.35;
    if (kind === 'crate') model.rotation.y = -.36;
    else if (kind === 'weapon') model.rotation.z = .055;
    scene.add(model);
    const height = Math.max(size.y * 1.55, size.x / (640 / 280) * 1.3, kind === 'crate' ? 1.6 : .8);
    camera.left = -height * (640 / 280) / 2; camera.right = -camera.left;
    camera.top = height / 2; camera.bottom = -camera.top; camera.updateProjectionMatrix();
    camera.position.set(kind === 'crate' ? 2.5 : 1.05, kind === 'crate' ? 1.8 : 1.35, 6);
    camera.lookAt(0, 0, 0); renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png'); thumbnails.set(key, url); return url;
  } catch {
    // Keep the shop usable if a device cannot allocate another WebGL context.
    return null;
  } finally { if (model) disposeModel(model); }
}

export function propArt(kind, id, name, className = 'weapon-art') {
  const image = propThumbnail(kind, id);
  return `<button type="button" class="prop-preview" ${kind === 'boss' && !image ? 'disabled aria-busy="true"' : ''} data-inspect-kind="${kind}" data-inspect-id="${id}" aria-label="Examiner ${name} en 3D">${image ? `<img class="${className}" src="${image}" alt="Modèle 3D de ${name}" draggable="false">` : `<span class="prop-fallback">${name}</span>`}<span class="inspect-label">EXAMINER EN 3D <b>+</b></span></button>`;
}

export class PropInspector {
  constructor(onVisibility = () => {}) {
    this.onVisibility = onVisibility;
    this.modal = document.createElement('dialog'); this.modal.className = 'prop-inspector'; this.modal.setAttribute('aria-labelledby', 'inspection-name');
    this.modal.innerHTML = `<div class="inspection-top"><span>ATELIER DU REFUGE / MODÈLE ORIGINAL</span><button class="inspection-close" aria-label="Fermer l’aperçu">×</button></div>
      <div class="inspection-stage" tabindex="0" role="img" aria-label="Vue 3D interactive. Glissez pour tourner ou utilisez les flèches du clavier."></div>
      <div class="inspection-toolbar"><span>GLISSER POUR TOURNER</span><div><button data-view="left" aria-label="Tourner vers la gauche">←</button><button data-view="reset" aria-label="Réinitialiser la vue">VUE INITIALE</button><button data-view="right" aria-label="Tourner vers la droite">→</button></div></div>
      <div class="inspection-copy"><span id="inspection-finish"></span><h2 id="inspection-name"></h2><p id="inspection-detail"></p><div id="inspection-stats"></div></div>`;
    document.body.append(this.modal);
    this.stage = this.modal.querySelector('.inspection-stage');
    this.modal.querySelector('.inspection-close').addEventListener('click', () => this.modal.close());
    this.modal.addEventListener('click', e => { if (e.target === this.modal) { const r = this.modal.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.modal.close(); } });
    this.modal.addEventListener('close', () => {
      this.onVisibility(false); cancelAnimationFrame(this.frame); this.drag = null;
      if (this.model) { disposeModel(this.model); this.model = null; }
      this.previousFocus?.focus();
    });
    this.modal.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.view === 'reset') { this.yaw = -.12; this.pitch = .08; }
      else this.yaw += button.dataset.view === 'left' ? -.35 : .35;
    }));
    this.stage.addEventListener('pointerdown', e => { if (!this.model) return; this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; this.stage.setPointerCapture(e.pointerId); });
    this.stage.addEventListener('pointermove', e => {
      if (e.pointerId !== this.drag?.id) return;
      this.yaw += (e.clientX - this.drag.x) * .009; this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + (e.clientY - this.drag.y) * .007));
      this.drag.x = e.clientX; this.drag.y = e.clientY;
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this.stage.addEventListener(event, () => { this.drag = null; });
    this.stage.addEventListener('keydown', e => {
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Home') { this.yaw = -.12; this.pitch = .08; }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.yaw += e.key === 'ArrowLeft' ? -.2 : .2;
      else this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch + (e.key === 'ArrowUp' ? -.15 : .15)));
    });
  }
  open(kind, id, trigger) {
    if (kind === 'boss' && !Object.hasOwn(BOSS_DESIGNS, id) || kind === 'weapon' && !Object.hasOwn(WEAPON_FINISHES, id) || kind === 'crate' && !Object.hasOwn(CRATES, id) || !['weapon','crate','supply','boss'].includes(kind)) return;
    const spec = kind === 'boss' ? BOSSES[id] : kind === 'weapon' ? weaponFor(id) : kind === 'crate' ? CRATES[id] : { name: 'Grenade artisanale', description: 'Une coque striée, une cuillère métallique et un anneau de récupération.' };
    this.modal.querySelector('.inspection-top > span').textContent = kind === 'boss' ? 'BESTIAIRE / QUATERNIUS · ADAPTATION DEADBLOCK' : kind === 'weapon' ? 'ARMURERIE / KENNEY · ADAPTATION DEADBLOCK' : 'ATELIER DU REFUGE / MODÈLE ORIGINAL';
    this.previousFocus = trigger || document.activeElement;
    this.modal.querySelector('#inspection-name').textContent = spec.name;
    this.modal.querySelector('#inspection-finish').textContent = kind === 'boss' ? BOSS_DESIGNS[id].label : kind === 'weapon' ? WEAPON_FINISHES[id].label : 'CAISSES ET ÉQUIPEMENT / RÉCUPÉRATION';
    this.modal.querySelector('#inspection-detail').textContent = kind === 'boss' ? BOSS_DESIGNS[id].detail : kind === 'weapon' ? WEAPON_FINISHES[id].detail : spec.description;
    this.modal.querySelector('#inspection-stats').innerHTML = kind === 'boss' ? `<span><b>${spec.hp}</b>PV EN SOLO</span><span><b>${spec.credits}</b>CRÉDITS</span><span><b>50 %</b>SEUIL DE RAGE</span>` : kind === 'weapon' ? `<span><b>${spec.damage}${spec.pellets ? ' × ' + spec.pellets : ''}</b>DÉGÂTS</span><span><b>${spec.magazine}</b>CHARGEUR</span><span><b>${spec.reload.toLocaleString('fr-FR')} s</b>RECHARGE</span><span><b>${spec.range} m</b>PORTÉE</span>` : '';
    this.modal.showModal(); this.onVisibility(true); this.yaw = -.12; this.pitch = .08;
    try {
      if (!this.renderer) {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); configureRenderer(this.renderer);
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.stage.replaceChildren(this.renderer.domElement);
        this.scene = new THREE.Scene(); lightScene(this.scene); this.camera = new THREE.PerspectiveCamera(35, 1, .01, 50);
        this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(this.stage);
      }
      if (this.model) disposeModel(this.model);
      this.model = makeModel(kind, id); this.modelSize = fitModel(this.model); this.scene.add(this.model);
      this.resize();
      let last = performance.now();
      this.stage.dataset.model = this.model.userData.bossAsset || id;
      const render = () => {
        if (!this.modal.open) return;
        const now = performance.now(); this.model.userData.animate?.((now - last) / 1000); last = now;
        this.model.rotation.set(this.pitch, this.yaw, 0); this.renderer.render(this.scene, this.camera);
        this.frame = requestAnimationFrame(render);
      };
      cancelAnimationFrame(this.frame); render();
    } catch {
      this.stage.textContent = 'L’aperçu 3D est indisponible sur ce navigateur. Les caractéristiques restent consultables ci-dessous.';
    }
  }
  resize() {
    if (!this.renderer || !this.model) return;
    const w = this.stage.clientWidth, h = this.stage.clientHeight; if (!w || !h) return;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const isBoss = !!this.model.userData.bossAsset;
    const span = Math.max(this.modelSize.y * (isBoss ? 1.05 : 1.5), this.modelSize.x / this.camera.aspect, this.modelSize.z * (isBoss ? 1.05 : 1.5));
    this.camera.position.set(.2, .35, span / (2 * Math.tan(THREE.MathUtils.degToRad(35) / 2)) * (isBoss ? 1.15 : 1.35));
    this.camera.lookAt(0, 0, 0);
  }
}
