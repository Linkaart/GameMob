import * as THREE from 'three';
import { surface, reflectionTexture } from './surface-materials.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const templates = new Map();
let loading;
export function loadWeaponAssets() {
  if (!loading) {
    const loader = new GLTFLoader();
    loading = Promise.allSettled(['blaster', 'blaster-repeater'].map(async name => {
      templates.set(name, (await loader.loadAsync(`/assets/weapons/${name}.glb`)).scene);
    }));
  }
  return loading;
}

const finishes = {
  carbine: '#939b81', smg: '#7e939d', shotgun: '#ac8067', marksman: '#b49b79',
  tesla: '#6fabb0', ember: '#bd835e', railgun: '#a18db3', venom: '#92ac6b',
  pistol: '#b7b4a1', lmg: '#8d9982', cryo: '#93b9cb', cannon: '#b9976c',
};

// Kenney's CC0 receivers provide the main mesh and atlas. DEADBLOCK adds
// distinct stocks, magazines, barrels and special-weapon equipment in +X.
export function createImportedWeapon(id) {
  const compact = ['pistol', 'shotgun', 'ember', 'venom', 'cryo', 'cannon'].includes(id);
  const source = compact ? 'blaster' : 'blaster-repeater', template = templates.get(source);
  if (!template || !finishes[id]) return null;
  const root = new THREE.Group(), body = template.clone(true);
  root.name = `weapon-${id}`; root.userData = { importedWeapon: true, propId: id, kind: 'weapon', source };
  body.rotation.y = Math.PI / 2;
  body.scale.setScalar(id === 'pistol' ? .8 : 1.05);
  body.position.set(-.2, -.56, 0); root.add(body);
  body.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry = mesh.geometry.clone(); mesh.material = mesh.material.clone();
    mesh.material.color.set(finishes[id]); mesh.material.roughness = .4; mesh.material.metalness = .65; mesh.material.envMap = reflectionTexture(); mesh.material.envMapIntensity = .65;
    mesh.castShadow = mesh.receiveShadow = true;
  });
  const mat = (color, luminous = false) => new THREE.MeshStandardMaterial({ color, envMap: reflectionTexture(), envMapIntensity: .65, roughness: luminous ? .3 : .48, metalness: luminous ? .25 : .7, ...(luminous ? { emissive: color, emissiveIntensity: .85 } : { map: surface('metal') }) });
  function part(geometry, x, y, z, color = '#343c3f', rotation = [0, 0, 0], luminous = false) {
    const mesh = new THREE.Mesh(geometry, mat(color, luminous)); mesh.position.set(x, y, z); mesh.rotation.set(...rotation);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  const box = (w, h, d, x, y, z, color) => part(new RoundedBoxGeometry(w, h, d, 1, Math.min(.04, h / 4, d / 4)), x, y, z, color);
  const tube = (radius, length, x, y, z, color, luminous = false) => part(new THREE.CylinderGeometry(radius, radius, length, 10), x, y, z, color, [0, 0, Math.PI / 2], luminous);
  const ring = (radius, x, y, z, color, luminous = false) => part(new THREE.TorusGeometry(radius, .035, 5, 12), x, y, z, color, [0, Math.PI / 2, 0], luminous);
  let muzzle = id === 'pistol' ? .58 : 1.05;
  if (!['pistol','smg'].includes(id)) {
    box(.7, .24, .3, -1.15, -.02, 0, '#515957'); box(.13, .43, .4, -1.5, -.08, 0, '#272e2e');
    for (let i = 0; i < 3; i++) box(.06, .27, .32, -1.35 + i * .12, -.02, 0, '#a49b7b');
  }
  if (['carbine', 'lmg', 'marksman'].includes(id)) {
    const length = id === 'marksman' ? 1.5 : id === 'lmg' ? 1.05 : .7;
    tube(.075, length, 1 + length / 2, -.15, 0, '#465156'); muzzle = 1 + length;
    ring(.11, muzzle, -.15, 0, '#b6b19a');
    if (id === 'marksman') {
      box(.14, .28, .18, -.3, .38, 0, '#464f4d');
      box(.6, .12, .16, -.1, .48, 0, '#464f4d'); tube(.13, .8, -.1, .62, 0, '#313d42');
      tube(.112, .025, .32, .62, 0, '#68bed0', true);
    }
    if (id === 'lmg') part(new THREE.CylinderGeometry(.32, .32, .42, 12), -.05, -.63, 0, '#4c5651', [Math.PI / 2, 0, 0]);
  } else if (id === 'shotgun') {
    for (const z of [-.13, .13]) { tube(.11, .85, 1.05, .12, z, '#4a5150'); ring(.13, 1.5, .12, z, '#b3a482'); }
    box(.55, .26, .42, .8, -.1, 0, '#966944'); muzzle = 1.52;
  } else if (['tesla','cryo'].includes(id)) {
    const color = id === 'tesla' ? '#56cfdf' : '#a0d8f0';
    tube(.12, .9, 1.2, -.15, 0, '#31494c');
    for (let i = 0; i < 4; i++) { ring(.21, .85 + i * .22, -.15, 0, color, true); }
    box(.34, .45, .38, -.06, -.5, 0, '#4b6874');
    tube(.1, .48, -.08, .48, 0, color, true); muzzle = 1.7;
  } else if (id === 'railgun') {
    for (const z of [-.19, .19]) {
      box(1.45, .18, .15, 1.5, -.15, z, '#939da7');
      tube(.045, 1.3, 1.48, -.15, z, '#ac83dc', true);
    }
    muzzle = 2.25;
  } else if (id === 'ember') {
    for (const z of [-.32, .32]) part(new THREE.CylinderGeometry(.2, .2, .75, 10), -.1, -.48, z, '#b8673e');
    tube(.23, .75, 1.13, -.15, 0, '#806248'); ring(.24, 1.55, -.15, 0, '#e69645', true); muzzle = 1.57;
  } else if (id === 'venom') {
    tube(.22, .65, -.1, .53, 0, '#87b745', true);
    for (const x of [-.47, .27]) ring(.24, x, .53, 0, '#505f4a');
    tube(.2, .65, 1.05, -.15, 0, '#56664b'); muzzle = 1.42;
  } else if (id === 'cannon') {
    tube(.32, 1, 1.15, -.15, 0, '#625b50');
    for (let i = 0; i < 3; i++) ring(.34, .8 + i * .3, -.15, 0, '#e6a04f', true);
    box(.58, .5, .55, -.05, -.48, 0, '#6e6858'); muzzle = 1.75;
  }
  const point = new THREE.Object3D(); point.name = 'muzzle'; point.position.set(muzzle, -.15, 0); root.add(point);
  return root;
}
