import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original, game-ready props. X points toward the muzzle; Y points up.
// The same meshes are used for the arsenal renders, inspection and live combat.
const palette = {
  iron: '#394249', edge: '#818b8b', dark: '#20272d', rubber: '#292b2a',
  wood: '#755345', tape: '#c5bda2', rust: '#9b6146', copper: '#bd8961',
  olive: '#657164', red: '#a35848', blue: '#50798c', yellow: '#d5b45e',
};
const materialCache = new Map();
function surface(color, glow = false) {
  color = palette[color] || color;
  const key = `${color}/${glow}`;
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({
    color, roughness: glow ? .32 : .72, metalness: glow ? .25 : .48,
    ...(glow ? { emissive: color, emissiveIntensity: .8 } : {}),
  }));
  return materialCache.get(key);
}

function chamferBox(w, h, d) {
  const c = Math.min(w, h, d) * .16, x = w / 2, y = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + c, -y); shape.lineTo(x - c, -y); shape.lineTo(x, -y + c);
  shape.lineTo(x, y - c); shape.lineTo(x - c, y); shape.lineTo(-x + c, y);
  shape.lineTo(-x, y - c); shape.lineTo(-x, -y + c); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, steps: 1, curveSegments: 1 });
  geometry.translate(0, 0, -d / 2); return geometry;
}

class PropBuilder {
  constructor(name) { this.root = new THREE.Group(); this.root.name = name; this.parts = []; }
  part(geometry, x, y, z, color, rotation = [0, 0, 0], glow = false) {
    const mesh = new THREE.Mesh(geometry, surface(color, glow));
    mesh.position.set(x, y, z); mesh.rotation.set(...rotation); this.root.add(mesh); this.parts.push(mesh); return mesh;
  }
  box(w, h, d, x, y, z, color, angle = 0, bevel = true, glow = false) {
    return this.part(bevel ? chamferBox(w, h, d) : new THREE.BoxGeometry(w, h, d), x, y, z, color, [0, 0, angle], glow);
  }
  tube(radius, length, x, y, z, color, axis = 'x', glow = false, top = radius) {
    return this.part(new THREE.CylinderGeometry(top, radius, length, 10, 1), x, y, z, color,
      axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0], glow);
  }
  ring(radius, thickness, x, y, z, color, axis = 'x', glow = false) {
    return this.part(new THREE.TorusGeometry(radius, thickness, 5, 12), x, y, z, color,
      axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0], glow);
  }
  rod(from, to, radius, color) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
    const mesh = this.tube(radius, direction.length(), 0, 0, 0, color, 'y');
    mesh.position.copy(a.add(b).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); return mesh;
  }
  bolts(x, y, z, count = 3, spacing = .2) {
    for (let i = 0; i < count; i++) this.tube(.032, .018, x + i * spacing, y, z, 'edge', 'z');
  }
  vents(x, y, z, count = 4, step = .15) {
    for (let i = 0; i < count; i++) this.box(.075, .11, .012, x + i * step, y, z, 'dark', -.12, false);
  }
  wrap(x, y, z, w = .1, h = .3, d = .27, count = 3) {
    for (let i = 0; i < count; i++) this.box(w, h, d, x + i * w * .85, y, z, i % 2 ? '#aca68e' : 'tape', -.09 + i * .04);
  }
  hazard(x, y, z, w = .5) {
    this.box(w, .075, .013, x, y, z, 'dark', 0, false);
    for (let i = 0; i < 4; i++) this.box(w / 9, .075, .017, x - w * .35 + i * w * .23, y, z + .01, 'yellow', -.4, false);
  }
  scars(x, y, z, w = .55) {
    for (let i = 0; i < 5; i++) this.box(.045 + i % 2 * .03, .012, .006, x + (i / 5 - .5) * w, y + Math.sin(i * 7) * .065, z, i % 2 ? 'rust' : 'edge', -.25 + i * .12, false);
  }
  finish(muzzle) {
    this.root.updateMatrixWorld(true);
    const batches = new Map();
    for (const part of this.parts) {
      const key = part.material.uuid;
      if (!batches.has(key)) batches.set(key, { material: part.material, geometry: [] });
      let geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
      geometry.applyMatrix4(part.matrixWorld);
      batches.get(key).geometry.push(geometry);
      part.geometry.dispose(); part.removeFromParent();
    }
    for (const batch of batches.values()) {
      const merged = mergeGeometries(batch.geometry);
      for (const geometry of batch.geometry) geometry.dispose();
      const mesh = new THREE.Mesh(merged, batch.material); mesh.castShadow = true; mesh.receiveShadow = true;
      this.root.add(mesh);
    }
    if (muzzle) { const point = new THREE.Object3D(); point.name = 'muzzle'; point.position.set(...muzzle); this.root.add(point); }
    this.root.userData.originalProp = true;
    return this.root;
  }
}

function grip(b, x = -.25, color = 'rubber') {
  b.box(.19, .47, .2, x, -.32, 0, color, -.3);
  for (let i = 0; i < 3; i++) b.box(.15, .025, .212, x - .04 + i * .025, -.45 + i * .09, 0, 'iron', -.3, false);
  b.rod([x + .03, -.16, .09], [x + .32, -.16, .09], .025, 'iron');
  b.rod([x + .32, -.16, .09], [x + .26, -.34, .09], .025, 'iron');
  b.rod([x + .26, -.34, .09], [x -.04, -.34, .09], .025, 'iron');
}
function magazine(b, x = .3, color = 'iron', curved = false) {
  b.box(.25, .39, .19, x, -.29, 0, color, curved ? -.15 : 0);
  if (curved) b.box(.23, .22, .19, x - .06, -.56, 0, color, -.36);
  b.box(.28, .05, .22, curved ? x - .09 : x, curved ? -.66 : -.5, 0, 'edge', curved ? -.36 : 0);
  for (let i = 0; i < 3; i++) b.box(.12, .024, .2, x - (curved ? i * .012 : 0), -.22 - i * .085, 0, 'dark', -.08, false);
}
function woodStock(b, x = -1.04, color = 'wood') {
  b.box(.72, .29, .25, x, -.015, 0, color, .06);
  b.box(.12, .43, .3, x - .35, -.07, 0, 'rubber', .08);
  b.wrap(x -.2, -.02, 0, .09, .31, .27, 3);
  b.scars(x + .15, -.04, .13, .25);
}
function barrel(b, from, to, radius = .07, color = 'iron') {
  b.tube(radius, to - from, (from + to) / 2, .02, 0, color);
  b.tube(radius * 1.45, .16, to -.04, .02, 0, 'edge');
  b.tube(radius * .78, .012, to + .047, .02, 0, 'dark');
  return [to + .06, .02, 0];
}

export const WEAPON_FINISHES = {
  carbine: { label: 'BOIS RAFISTOLÉ / ACIER RÉCUPÉRÉ', detail: 'Crosse bandée, boîtier olive et chargeur courbe marqué à la peinture.' },
  smg: { label: 'COMPACT / CROSSE TUBULAIRE', detail: 'Crosse soudée, garde-main perforé et chargeur bleu prolongé.' },
  shotgun: { label: 'POMPE INDUSTRIELLE / OXYDE ROUGE', detail: 'Pompe rainurée, double tube, cartouches de réserve et crosse usée.' },
  marksman: { label: 'LONGUE PORTÉE / LUNETTE RÉCUPÉRÉE', detail: 'Canon long, optique bleutée, bipied et attaches de fortune.' },
  tesla: { label: 'BOBINES CUIVRÉES / ARC CYAN', detail: 'Trois bobines ouvertes, câbles de cuivre et cellule lumineuse.' },
  ember: { label: 'DOUBLE RÉSERVOIR / MARQUAGE THERMIQUE', detail: 'Réservoirs orange, durite épaisse et bouche protégée contre la chaleur.' },
  railgun: { label: 'RAILS JUMELÉS / CELLULE VIOLETTE', detail: 'Rails séparés, noyau magnétique et coque renforcée angulaire.' },
  venom: { label: 'CUVE BIOCHIMIQUE / FLUIDE VERT', detail: 'Réservoir scellé, tubes corrosifs et poignée de laboratoire récupérée.' },
};

export function createWeaponModel(id = 'carbine') {
  if (!Object.hasOwn(WEAPON_FINISHES, id)) id = 'carbine';
  const b = new PropBuilder(`weapon-${id}`); let muzzle;
  if (id === 'carbine') {
    woodStock(b); grip(b); magazine(b, .27, 'iron', true);
    b.box(1.03, .3, .28, -.05, .045, 0, 'olive'); b.box(.64, .24, .25, .73, .025, 0, 'wood');
    b.box(.85, .065, .22, -.02, .23, 0, 'iron'); b.vents(.53, .045, .133, 4, .13);
    b.bolts(-.4, .08, .151); b.hazard(.25, -.03, .158, .29);
    b.wrap(.62, .025, 0, .055, .255, .265, 2);
    b.box(.075, .19, .1, 1.19, .13, 0, 'iron');
    b.box(.2, .12, .13, -.35, .29, 0, 'dark'); b.scars(-.02, .11, .15);
    muzzle = barrel(b, .93, 1.55);
    b.box(.25, .07, .205, .18, -.43, 0, 'blue', -.12);
  } else if (id === 'smg') {
    for (const z of [-.09, .09]) { b.rod([-.52, .15, z], [-1.2, .12, z], .034, 'edge'); b.rod([-1.2, .12, z], [-1.13, -.2, z], .034, 'edge'); }
    b.box(.1, .37, .24, -1.18, -.045, 0, 'rubber', .15);
    b.box(.9, .36, .32, -.08, .03, 0, 'iron'); b.box(.47, .27, .3, .55, .02, 0, 'blue');
    grip(b, -.38); magazine(b, .14, 'blue'); b.box(.22, .21, .19, .14, -.59, 0, 'blue'); b.wrap(.07, -.61, 0, .065, .13, .21, 2);
    b.box(.5, .06, .2, -.08, .25, 0, 'edge'); b.box(.17, .18, .19, .04, .33, 0, 'dark');
    b.box(.09, .065, .2, .04, .37, 0, '#88a5b3', 0, false, true);
    b.vents(.38, .05, .16, 3, .14); b.bolts(-.4, .09, .17); b.scars(-.1, .03, .17);
    muzzle = barrel(b, .65, 1.1, .09);
  } else if (id === 'shotgun') {
    woodStock(b, -1.05); grip(b, -.35, 'wood'); b.box(.88, .29, .3, -.08, .05, 0, 'red');
    muzzle = barrel(b, .25, 1.62, .1); b.tube(.085, 1.1, .84, -.18, 0, 'iron');
    b.box(.64, .25, .29, .65, -.15, 0, 'wood');
    for (let i = 0; i < 6; i++) b.box(.035, .27, .315, .39 + i * .1, -.15, 0, 'rubber');
    for (let i = 0; i < 4; i++) { b.tube(.05, .2, -.38 + i * .15, .04, .2, 'red', 'y'); b.tube(.052, .05, -.38 + i * .15, -.065, .2, 'copper', 'y'); }
    b.box(.14, .085, .1, 1.25, .16, 0, 'iron'); b.box(.1, .08, .09, -.21, .24, 0, 'iron'); b.scars(.12, .09, .162, .3);
  } else if (id === 'marksman') {
    woodStock(b, -1.25, 'wood'); grip(b, -.65, 'wood'); magazine(b, -.03, 'iron');
    b.box(1.48, .25, .25, -.12, -.005, 0, 'wood'); b.box(.86, .21, .24, -.29, .15, 0, 'iron');
    muzzle = barrel(b, .4, 2.04, .058); b.tube(.095, .36, 1.86, .02, 0, 'dark');
    for (const x of [-.5, .05]) { b.box(.07, .18, .14, x, .3, 0, 'edge'); b.ring(.1, .022, x, .43, 0, 'edge'); }
    b.tube(.09, .83, -.2, .43, 0, 'iron'); b.tube(.15, .2, .24, .43, 0, 'iron');
    b.tube(.126, .018, .35, .43, 0, '#689cae', 'x', true);
    b.tube(.115, .16, -.66, .43, 0, 'rubber'); b.tube(.055, .1, -.2, .55, 0, 'edge', 'y');
    b.rod([.96, -.06, .07], [1.1, -.5, .3], .035, 'edge'); b.rod([.96, -.06, -.07], [1.1, -.5, -.3], .035, 'edge');
    b.wrap(.3, -.005, 0, .085, .27, .28, 3); b.bolts(-.55, .14, .132, 3, .23);
    b.rod([-.27, .16, .13], [-.27, -.01, .32], .035, 'iron'); b.tube(.06, .1, -.27, -.02, .33, 'dark', 'z');
  } else if (id === 'tesla') {
    woodStock(b, -1.15, 'iron'); grip(b, -.5); b.box(.95, .35, .33, -.26, .04, 0, 'blue');
    b.tube(.115, 1.15, .72, .03, 0, 'dark');
    for (let i = 0; i < 3; i++) { const x = .36 + i * .29; b.ring(.2, .045, x, .03, 0, 'copper'); b.ring(.145, .027, x, .03, 0, '#78d4e5', 'x', true); }
    for (const z of [-.19, .19]) b.rod([.13, -.08, z], [1.23, -.08, z], .025, 'edge');
    b.box(.38, .42, .26, -.01, -.32, 0, 'iron'); b.box(.19, .29, .275, -.01, -.32, 0, '#77d5df', 0, true, true);
    b.rod([-.61, .23, .17], [-.18, .3, .23], .027, 'copper'); b.rod([-.18, .3, .23], [.29, .09, .23], .027, 'copper');
    b.hazard(-.3, .05, .178, .45); b.scars(-.38, .14, .18, .4);
    muzzle = barrel(b, 1.1, 1.43, .11); b.ring(.16, .026, 1.45, .02, 0, '#78d4e5', 'x', true);
  } else if (id === 'ember') {
    woodStock(b, -1.17, 'iron'); grip(b, -.53); b.box(.93, .31, .36, -.23, .06, 0, 'olive');
    b.tube(.15, 1.19, .78, .03, 0, 'iron');
    for (const z of [-.24, .24]) {
      b.tube(.17, .63, -.05, -.36, z, 'red', 'y'); b.tube(.12, .09, -.05, -.73, z, 'edge', 'y');
      b.ring(.175, .025, -.05, -.25, z, 'iron', 'y'); b.ring(.175, .025, -.05, -.53, z, 'iron', 'y');
      b.rod([.05, -.57, z], [.61, -.26, z], .04, 'rubber'); b.rod([.61, -.26, z], [.85, -.04, z], .04, 'rubber');
    }
    b.tube(.24, .42, 1.24, .03, 0, 'rust'); b.tube(.18, .025, 1.46, .03, 0, 'dark');
    b.ring(.19, .035, 1.48, .03, 0, 'copper'); b.hazard(-.22, .06, .19, .56);
    b.vents(.38, .09, .15, 5, .14); b.box(.22, .12, .22, -.44, .28, 0, 'iron');
    muzzle = [1.5, .03, 0];
  } else if (id === 'railgun') {
    b.box(.8, .23, .26, -1.18, -.03, 0, 'iron', .1); b.box(.13, .42, .32, -1.56, -.08, 0, 'rubber', .14);
    b.rod([-1.51, -.25, 0], [-.72, -.1, 0], .035, 'edge'); grip(b, -.51);
    b.box(1.1, .39, .42, -.19, .04, 0, 'iron'); b.box(.6, .22, .44, -.13, .07, 0, 'red');
    b.box(.32, .5, .27, .01, -.38, 0, 'dark'); b.box(.14, .3, .29, .01, -.35, 0, '#a991d8', 0, true, true);
    for (const z of [-.19, .19]) {
      b.box(1.53, .18, .15, 1.04, .03, z, 'edge'); b.box(1.26, .08, .04, 1.04, .03, z * .65, '#af9bea', 0, false, true);
      b.box(.3, .32, .17, 1.61, .03, z, 'iron');
    }
    b.box(.48, .07, .22, -.35, .29, 0, 'edge'); b.box(.14, .13, .16, -.38, .37, 0, 'dark');
    b.bolts(-.55, .12, .235); b.scars(-.25, .02, .235); b.hazard(.08, .15, .235, .29);
    muzzle = [1.82, .03, 0];
  } else if (id === 'venom') {
    woodStock(b, -1.12, 'olive'); grip(b, -.5); b.box(.92, .33, .35, -.28, .04, 0, 'olive');
    b.tube(.2, .87, .6, .035, 0, 'iron'); b.tube(.235, .1, .85, .035, 0, 'edge');
    b.tube(.18, .57, -.08, .46, 0, '#89bc67', 'x', true);
    for (const x of [-.4, .24]) b.tube(.21, .085, x, .46, 0, 'iron');
    for (const x of [-.25, .12]) b.box(.06, .42, .1, x, .34, .17, 'edge');
    b.rod([.22, .47, .16], [.56, .31, .22], .04, 'copper'); b.rod([.56, .31, .22], [.61, .08, .22], .04, 'copper');
    magazine(b, -.1, 'dark'); b.box(.13, .22, .205, -.1, -.3, 0, '#9acb74', 0, false, true);
    b.wrap(-1.28, -.02, 0, .08, .31, .28, 3); b.hazard(-.3, .07, .19, .42); b.scars(-.51, .13, .19, .25);
    muzzle = barrel(b, .9, 1.42, .135); b.ring(.18, .026, 1.46, .02, 0, '#a9d279', 'x', true);
  }
  const model = b.finish(muzzle); model.userData.propId = id; model.userData.kind = 'weapon';
  return model;
}

export const CRATES = {
  salvage: { name: 'Caisse du récupérateur', color: '#6c8b75', description: 'Ferraille, circuits et réactifs. Récupération commune et ravitaillement du refuge.' },
  medical: { name: 'Valise de secours', color: '#c6bca6', description: 'Une trousse au sol rend 30 PV à un survivant blessé.' },
  brute: { name: 'Malle du Briseur', color: '#cc955b', description: 'Caisse supplémentaire laissée par le Briseur. Crédits et matériaux partagés.' },
  matriarch: { name: 'Conteneur biologique', color: '#8aab65', description: 'Caisse supplémentaire de la Porteuse. Réactifs et pièces sous scellés.' },
  warden: { name: 'Coffre du réacteur', color: '#71a8b8', description: 'Caisse supplémentaire du Veilleur. Verrous renforcés et balises lumineuses.' },
};

export function createCrateModel(id = 'salvage') {
  if (!Object.hasOwn(CRATES, id)) id = 'salvage';
  const b = new PropBuilder(`crate-${id}`), color = CRATES[id].color;
  const width = id === 'medical' ? 1.25 : 1.65, height = id === 'medical' ? .66 : .88, depth = .85;
  b.box(width, height * .68, depth, 0, height * .34, 0, color);
  b.box(width + .045, height * .28, depth + .035, 0, height * .86, 0, color);
  b.box(width + .06, .045, depth + .05, 0, height * .71, 0, 'dark');
  b.box(width + .02, .065, depth + .02, 0, .055, 0, 'iron');
  for (const x of [-width * .34, width * .34]) {
    b.box(.105, height + .06, depth + .09, x, height / 2, 0, 'iron');
    for (const z of [-depth / 2 -.045, depth / 2 + .045]) {
      b.box(.18, .19, .055, x, height * .66, z, 'edge'); b.box(.09, .105, .065, x, height * .66, z, 'dark');
    }
    for (const z of [-depth * .36, depth * .36]) b.box(.21, .16, .19, x, .07, z, 'rubber');
  }
  for (const side of [-1, 1]) {
    const x = side * (width / 2 + .035);
    b.rod([x, .3, -.16], [x, .49, -.16], .03, 'edge');
    b.rod([x, .49, -.16], [x, .49, .16], .035, 'rubber');
    b.rod([x, .49, .16], [x, .3, .16], .03, 'edge');
  }
  b.bolts(-width * .24, .15, depth / 2 + .01, 3, width * .24);
  b.scars(.1, height * .45, depth / 2 + .01, width * .6);
  if (id === 'medical') {
    b.box(.42, .12, .02, 0, .36, depth / 2 + .018, 'red'); b.box(.12, .38, .025, 0, .36, depth / 2 + .02, 'red');
    b.rod([-.2, height, 0], [-.2, height + .13, 0], .035, 'iron');
    b.rod([-.2, height + .13, 0], [.2, height + .13, 0], .04, 'rubber'); b.rod([.2, height + .13, 0], [.2, height, 0], .035, 'iron');
  } else if (id === 'warden') {
    b.box(.48, .22, .04, 0, .43, depth / 2 + .018, 'dark');
    for (let i = 0; i < 3; i++) b.box(.045, .13, .055, -.12 + i * .12, .43, depth / 2 + .04, '#8ddcea', 0, false, true);
    for (const z of [-.23, .23]) b.box(.62, .03, .035, 0, height + .012, z, '#8ddcea', 0, false, true);
    b.hazard(0, .21, depth / 2 + .025, .48);
  } else if (id === 'matriarch') {
    for (const x of [-.18, .18]) { b.tube(.105, .3, x, height + .06, 0, '#b8da7d', 'x', true); b.ring(.115, .025, x, height + .06, 0, 'edge'); }
    b.ring(.12, .026, 0, .41, depth / 2 + .025, 'dark', 'z');
    for (let i = 0; i < 3; i++) b.box(.05, .13, .02, Math.sin(i * Math.PI * 2 / 3) * .08, .41 + Math.cos(i * Math.PI * 2 / 3) * .08, depth / 2 + .04, 'dark', -i * Math.PI * 2 / 3);
  } else {
    b.box(.43, .23, .025, 0, .4, depth / 2 + .018, 'iron');
    b.hazard(0, .42, depth / 2 + .037, .32);
    if (id === 'brute') for (const z of [-.27, 0, .27]) b.box(.57, .045, .12, 0, height + .015, z, 'edge');
    else b.box(.25, .12, .014, 0, .23, depth / 2 + .015, 'tape');
  }
  const model = b.finish(); model.userData.propId = id; model.userData.kind = 'crate'; return model;
}

export function createGrenadeModel() {
  const b = new PropBuilder('grenade');
  b.tube(.22, .5, 0, 0, 0, 'olive', 'y', false, .15);
  for (const y of [-.19, -.02, .15]) b.ring(.21 - (y + .19) * .12, .025, 0, y, 0, 'iron', 'y');
  b.box(.17, .11, .16, 0, .3, 0, 'iron'); b.box(.1, .56, .045, .16, .05, .02, 'edge', .15);
  b.ring(.1, .018, -.07, .38, .08, 'copper', 'z'); b.hazard(0, -.01, .207, .26);
  const model = b.finish(); model.userData.kind = 'supply'; model.userData.propId = 'grenade'; return model;
}

export function disposeProp(model) {
  // Materials belong to the shared palette; geometries belong to this instance.
  model.traverse(mesh => { if (mesh.isMesh) mesh.geometry.dispose(); });
  model.removeFromParent();
}
