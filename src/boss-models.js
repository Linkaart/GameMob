import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export const BOSS_DESIGNS = {
  brute: { file: 'Orc.gltf', height: 3.65, glow: '#d47c21', label: 'COLOSSE DE FERRAILLE', detail: 'Une mâchoire massive, des épaulières de récupération et des pointes rouillées. Ses poings annoncent le séisme.' },
  matriarch: { file: 'Demon.gltf', height: 3.9, glow: '#77b830', label: 'MUTATION TOXIQUE', detail: 'Des cornes démesurées, des excroissances dorsales et des poches de venin luminescentes. Restez hors de ses zones acides.' },
  warden: { file: 'BlueDemon.gltf', height: 3.8, glow: '#36bddc', label: 'RÉACTEUR VIVANT', detail: 'Une créature bleue enchâssée dans un harnais industriel. Ses bobines dorsales et son noyau s’illuminent quand elle entre en rage.' },
};
const templates = new Map();
let loading;
export function loadBossAssets() {
  if (!loading) {
    const loader = new GLTFLoader();
    loading = Promise.allSettled(Object.entries(BOSS_DESIGNS).map(async ([id, spec]) => {
      const gltf = await loader.loadAsync(`/assets/bosses/${spec.file}`);
      templates.set(id, gltf);
    }));
  }
  return loading;
}

// Templates retain their textures. Each clone owns its geometry, materials,
// skeleton and animation mixer, so removing one boss cannot break another.
export function disposeBossModel(group) {
  group.userData.mixer?.stopAllAction();
  group.userData.mixer?.uncacheRoot(group.userData.animationRoot);
  const skeletons = new Set();
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) mat.dispose();
    if (mesh.skeleton) skeletons.add(mesh.skeleton);
  });
  for (const skeleton of skeletons) skeleton.dispose();
  group.removeFromParent();
}

export function createBossModel(id) {
  const template = templates.get(id); if (!template) return null;
  const spec = BOSS_DESIGNS[id], group = new THREE.Group(), body = clone(template.scene);
  group.name = `boss-${id}`; group.userData.bossAsset = spec.file;
  group.add(body);
  body.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone(); mesh.material = mesh.material.clone();
    mesh.material.roughness = .87;
    mesh.material.emissive.set('#53685d'); mesh.material.emissiveIntensity = .22;
    mesh.material.color.set(id === 'matriarch' ? '#879a6b' : id === 'brute' ? '#929084' : '#7d999f');
    mesh.material.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 0.45);'); };
    mesh.material.customProgramCacheKey = () => 'deadblock-weathered-boss';
    mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
    if (mesh.name === 'Orc_Weapon' || mesh.name === 'Trident') mesh.visible = false;
  });
  const mixer = new THREE.AnimationMixer(body), actions = {};
  for (const clip of template.animations) actions[clip.name] = mixer.clipAction(clip);
  actions.Idle?.play(); mixer.update(.01); body.updateMatrixWorld(true);
  // Exclude the optional weapons when fitting the body to gameplay dimensions.
  const bounds = new THREE.Box3();
  body.traverse(mesh => { if (mesh.isMesh && mesh.visible) { mesh.computeBoundingBox(); bounds.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld)); } });
  const torsoCenter = body.getObjectByName('Torso').getWorldPosition(new THREE.Vector3());
  const scale = spec.height / (bounds.max.y - bounds.min.y);
  body.scale.multiplyScalar(scale);
  body.position.set(-torsoCenter.x * scale, -bounds.min.y * scale, -torsoCenter.z * scale);
  group.updateMatrixWorld(true);
  const glowMaterials = [];
  const metal = color => new THREE.MeshStandardMaterial({ color, roughness: .68, metalness: .65 });
  const glow = () => {
    const mat = new THREE.MeshStandardMaterial({ color: spec.glow, emissive: spec.glow, emissiveIntensity: 1.15, roughness: .35 });
    glowMaterials.push(mat); return mat;
  };
  function attachment(boneName, geometry, mat, x, y, z, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); mesh.rotation.set(...rotation);
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); group.updateMatrixWorld(true);
    const bone = body.getObjectByName(boneName); if (bone) bone.attach(mesh);
    return mesh;
  }
  const plate = (bone, w, h, d, x, y, z, color, rotation) => attachment(bone, new RoundedBoxGeometry(w, h, d, 1, Math.min(.07, d / 3, h / 3)), metal(color), x, y, z, rotation);
  function anchor(bone, x = 0, y = 0, z = 0) {
    const point = body.getObjectByName(bone).getWorldPosition(new THREE.Vector3());
    return [point.x + x, point.y + y, point.z + z];
  }
  // Position relative to the resting bones, then bind to those bones for animation.
  if (id === 'brute') {
    for (const side of [-1, 1]) {
      const bone = side < 0 ? 'UpperArmR' : 'UpperArmL';
      plate(bone, .96, .4, .9, ...anchor(bone, side * .2, .08, .06), '#594d3f', [0, 0, side * -.2]);
      for (let i = 0; i < 3; i++) attachment(bone, new THREE.ConeGeometry(.12, .48, 5), metal('#a78c69'), ...anchor(bone, side * (i * .27 - .08), .45, .07), [0, 0, side * -.32]);
      const forearm = side < 0 ? 'LowerArmR' : 'LowerArmL';
      plate(forearm, .57, .42, .53, ...anchor(forearm, side * .09, -.18, .09), '#514c43');
    }
    plate('Torso', .95, .55, .26, ...anchor('Torso', 0, .14, .56), '#4a4940');
    for (let i = -1; i <= 1; i++) attachment('Torso', new THREE.BoxGeometry(.055, .3, .025), glow(), ...anchor('Torso', i * .2, .14, .71));
    plate('Head', 1.18, .42, .2, ...anchor('Head', 0, -.14, 1.02), '#5b5144');
    for (let i = -2; i <= 2; i++) plate('Head', .045, .23, .03, ...anchor('Head', i * .17, -.14, 1.13), '#242a28');
    plate('Head', 1.38, .26, .23, ...anchor('Head', 0, .36, 1.03), '#393e37');
    for (const side of [-1,1]) attachment('Head', new THREE.BoxGeometry(.27, .065, .025), glow(), ...anchor('Head', side * .36, .36, 1.16));
  } else if (id === 'matriarch') {
    for (let i = 0; i < 9; i++) {
      attachment('Torso', new THREE.IcosahedronGeometry(.2 + i % 2 * .1, 1), glow(), ...anchor('Torso', Math.sin(i * 2.4) * .65, -.2 + i % 3 * .33, -.55 - i % 2 * .16));
    }
    for (const side of [-1, 1]) {
      attachment('Torso', new THREE.ConeGeometry(.18, .9, 5), metal('#787957'), ...anchor('Torso', side * .78, .7, -.22), [-.5, 0, side * -.65]);
      attachment('Abdomen', new THREE.IcosahedronGeometry(.27, 1), glow(), ...anchor('Abdomen', side * .5, -.13, .45));
      attachment('Head', new THREE.ConeGeometry(.1, .55, 5), metal('#c7bd92'), ...anchor('Head', side * .38, -.02, .78), [0, 0, Math.PI]);
    }
    plate('Head', 1.38, .26, .22, ...anchor('Head', 0, .35, 1.02), '#3b4135');
    for (const side of [-1,1]) attachment('Head', new THREE.IcosahedronGeometry(.09, 0), glow(), ...anchor('Head', side * .35, .35, 1.16));
  } else {
    plate('Torso', 1.15, .72, .25, ...anchor('Torso', 0, .05, .45), '#33454d');
    attachment('Torso', new THREE.TorusGeometry(.23, .065, 6, 12), metal('#a99573'), ...anchor('Torso', 0, .08, .62));
    attachment('Torso', new THREE.IcosahedronGeometry(.19, 1), glow(), ...anchor('Torso', 0, .08, .63));
    for (const side of [-1, 1]) {
      attachment('Torso', new THREE.CylinderGeometry(.16, .19, 1.4, 8), metal('#37464e'), ...anchor('Torso', side * .8, .38, -.3));
      for (let i = 0; i < 5; i++) attachment('Torso', new THREE.TorusGeometry(.21, .045, 5, 10), glow(), ...anchor('Torso', side * .8, -.12 + i * .23, -.3), [Math.PI / 2, 0, 0]);
      attachment('Torso', new THREE.IcosahedronGeometry(.17, 0), glow(), ...anchor('Torso', side * .8, 1.15, -.3));
    }
    plate('Head', 1.52, .36, .26, ...anchor('Head', 0, .34, 1.05), '#283e44');
    attachment('Head', new THREE.BoxGeometry(.9, .07, .03), glow(), ...anchor('Head', 0, .34, 1.2));
  }
  let current = 'Idle', elapsed = 0;
  group.userData.mixer = mixer; group.userData.animationRoot = body;
  group.userData.animate = (dt, { moving = false, enraged = false, attacking = false } = {}) => {
    const next = attacking ? 'Punch' : moving ? (enraged ? 'Run' : 'Walk') : 'Idle';
    if (next !== current && actions[next]) {
      actions[current]?.fadeOut(.18); actions[next].reset().fadeIn(.18).play(); current = next;
    }
    mixer.update(Math.min(dt, .1)); elapsed += dt;
    for (const mat of glowMaterials) mat.emissiveIntensity = (enraged ? 2.4 : 1.05) + Math.sin(elapsed * (enraged ? 10 : 2.5)) * .3;
    group.userData.animation = current;
  };
  return group;
}
