export const MATERIALS = {
  scrap: { name: 'Ferraille', short: 'FER', color: '#c5b99a' },
  copper: { name: 'Circuits', short: 'CIR', color: '#e5a267' },
  chemical: { name: 'Réactifs', short: 'REA', color: '#b1d27c' },
  plate: { name: 'Plaque du Briseur', short: 'PLA', color: '#eca86e', boss: 'brute' },
  bio: { name: 'Cœur de la Porteuse', short: 'BIO', color: '#b9df72', boss: 'matriarch' },
  reactor: { name: 'Réacteur du Veilleur', short: 'ION', color: '#89dbe5', boss: 'warden' },
};

export const WEAPONS = {
  carbine: { name: 'Vigile', category: 'Carabine', rarity: 'standard', color: '#d7be8a', damage: 32, magazine: 24, cooldown: .16, reload: 1.5, range: 24, description: 'La carabine fiable du refuge. Précise, polyvalente, toujours prête.', price: 0, shape: 'rifle' },
  smg: { name: 'Frelon', category: 'Pistolet-mitrailleur', rarity: 'standard', color: '#d7be8a', damage: 19, magazine: 36, cooldown: .085, reload: 1.3, range: 19, description: 'Une cadence redoutable pour ouvrir un passage au milieu de la horde.', price: 300, shape: 'smg' },
  shotgun: { name: 'Fossoyeur', category: 'Fusil à pompe', rarity: 'standard', color: '#d7be8a', damage: 19, pellets: 5, spread: .22, magazine: 8, cooldown: .7, reload: 2.1, range: 14, description: 'Cinq projectiles par cartouche. Dévastateur à courte portée.', price: 450, shape: 'shotgun' },
  marksman: { name: 'Dernier Mot', category: 'Fusil de précision', rarity: 'standard', color: '#d7be8a', damage: 110, magazine: 8, cooldown: .65, reload: 2, range: 35, description: 'Un tir lourd pour neutraliser les cibles prioritaires à distance.', price: 650, shape: 'sniper' },
  tesla: { name: 'Arc Fantôme', category: 'Carabine Tesla', rarity: 'special', color: '#83dfed', damage: 45, magazine: 20, cooldown: .23, reload: 1.7, range: 23, chain: 3, recipe: { scrap: 25, copper: 12, reactor: 1 }, description: 'Un arc électrique rebondit sur trois infectés proches de la cible.', shape: 'tesla' },
  ember: { name: 'Braise', category: 'Projecteur thermique', rarity: 'special', color: '#f4a26a', damage: 14, magazine: 60, cooldown: .07, reload: 2.2, range: 11, burn: 3, recipe: { scrap: 30, chemical: 10, bio: 1 }, description: 'Une flamme continue qui embrase les infectés et les consume dans le temps.', shape: 'flamer' },
  railgun: { name: 'Brise-Rempart', category: 'Canon magnétique', rarity: 'special', color: '#c1a2ed', damage: 190, magazine: 5, cooldown: 1, reload: 2.4, range: 40, pierce: 4, recipe: { scrap: 40, copper: 16, plate: 1 }, description: 'Une décharge traverse jusqu’à quatre cibles. L’arme des chasseurs de colosses.', shape: 'railgun' },
  venom: { name: 'Ronce Noire', category: 'Lanceur biochimique', rarity: 'special', color: '#b7dd71', damage: 38, magazine: 16, cooldown: .32, reload: 1.8, range: 25, splash: 2.6, recipe: { scrap: 25, chemical: 16, bio: 2 }, description: 'Chaque impact éclate en spores corrosives qui touchent les infectés voisins.', shape: 'bio' },
};

export const SHOP_ITEMS = {
  medkit: { name: 'Trousse de secours', description: 'Rend 55 points de vie. À utiliser avec F ou le bouton de soin.', price: 70, kind: 'consumable', color: '#df8a75' },
  grenade: { name: 'Grenade artisanale', description: '180 dégâts de zone après une seconde. Touche G ou bouton grenade.', price: 55, kind: 'consumable', color: '#c6c78a' },
  salvage: { name: 'Caisse de récupération', description: '12 ferrailles, 4 circuits et 3 réactifs. Aucun composant de boss.', price: 180, kind: 'materials', materials: { scrap: 12, copper: 4, chemical: 3 }, color: '#c6ad75' },
};

export const BOSSES = {
  brute: { name: 'Le Briseur', title: 'Colosse de la quarantaine', color: '#e3a168', hp: 1350, speed: 1.4, material: 'plate', credits: 180, attack: 'Fracture', description: 'Son impact fracture le sol. Sortez du cercle orange avant le choc.', region: 'quarantine' },
  matriarch: { name: 'La Porteuse', title: 'Matrice des spores', color: '#b6d575', hp: 1150, speed: 1.65, material: 'bio', credits: 200, attack: 'Floraison toxique', description: 'Elle répand des flaques corrosives et appelle des coureurs. Ne restez jamais immobile.', region: 'laboratory' },
  warden: { name: 'Le Veilleur', title: 'Gardien du réacteur', color: '#89d8e6', hp: 1550, speed: 1.5, material: 'reactor', credits: 240, attack: 'Surcharge', description: 'Ses trois décharges marquent votre position. Évitez les cercles bleus avant leur activation.', region: 'foundry' },
};

export const DISTRICTS = {
  quarantine: { name: 'Quarantaine', subtitle: 'Le dernier quartier', number: '01', color: '#d7b579', sky: '#101725', fog: '#101725', ground: '#c3c6cf', moon: '#adc5ee', light: 2.2, labels: ['REFUGE', 'PHARMACIE', 'GARAGE', 'DÉPÔT'], description: 'Rues barricadées, façades condamnées. Le territoire du Briseur.' },
  foundry: { name: 'La Fonderie', subtitle: 'Sous les cendres', number: '02', color: '#e79a60', sky: '#241a19', fog: '#30211e', ground: '#ad9790', moon: '#efb894', light: 1.8, labels: ['FOURNEAU', 'RÉACTEUR', 'ATELIER', 'FONDERIE'], description: 'Braises, fumées et conduites rouillées. Le Veilleur défend les réacteurs.' },
  laboratory: { name: 'Zone Zéro', subtitle: 'L’origine du mal', number: '03', color: '#a8cb80', sky: '#101c1b', fog: '#1b2c28', ground: '#a9bfb2', moon: '#b6d8bf', light: 1.9, labels: ['LABO 07', 'BIOHAZARD', 'ISOLEMENT', 'ARCHIVES'], description: 'Pluie froide et lueurs toxiques. La Porteuse niche dans les ruines du laboratoire.' },
};

export const ENEMIES = {
  walker: { name: 'Rôdeur', description: 'Lent seul, dangereux en groupe.', wave: 1, hp: 70, speed: 1.65, color: '#9eac7e' },
  runner: { name: 'Coureur', description: 'Rapide et fragile. Gardez-le à distance.', wave: 2, hp: 55, speed: 3.6, color: '#bd9b75' },
  spitter: { name: 'Cracheur', description: 'Projette des flaques acides à distance.', wave: 4, hp: 90, speed: 1.5, color: '#aed46e' },
  exploder: { name: 'Boursouflé', description: 'Se gonfle avant d’exploser. Sortez du cercle.', wave: 5, hp: 110, speed: 1.8, color: '#d2a366' },
  tank: { name: 'Massif', description: 'Résistant, lent, brutal au corps à corps.', wave: 5, hp: 250, speed: 1.25, color: '#9b829f' },
  armored: { name: 'Cuirassé', description: 'Une armure frontale. Contournez-le pour frapper dans le dos.', wave: 6, hp: 180, speed: 1.6, color: '#819aa8' },
};

export const CONTRACTS = [
  { id: 'first_blood', name: 'Faire le ménage', description: 'Éliminer 30 infectés.', stat: 'kills', target: 30, reward: { credits: 150, materials: { scrap: 15 } } },
  { id: 'hold_line', name: 'Tenir la ligne', description: 'Terminer 5 vagues.', stat: 'waves', target: 5, reward: { credits: 250, materials: { copper: 8 } } },
  { id: 'boss_hunter', name: 'Chasseur de monstres', description: 'Vaincre un boss.', stat: 'bosses', target: 1, reward: { credits: 200, materials: { chemical: 6 } } },
  { id: 'guardian', name: 'Personne derrière', description: 'Relever 3 alliés.', stat: 'revives', target: 3, reward: { credits: 180, consumables: { medkit: 2 } } },
  { id: 'gunsmith', name: 'L’art de survivre', description: 'Fabriquer 2 armes spéciales.', stat: 'crafts', target: 2, reward: { credits: 350, materials: { scrap: 20, copper: 8 } } },
  { id: 'exterminator', name: 'La ville nous appartient', description: 'Éliminer 200 infectés.', stat: 'kills', target: 200, reward: { credits: 500, materials: { reactor: 1 } } },
];

export function weaponFor(id) { return Object.hasOwn(WEAPONS, id) ? WEAPONS[id] : WEAPONS.carbine; }
export function canCraft(profile, id) {
  const recipe = WEAPONS[id]?.recipe;
  return !!recipe && !profile.owned.includes(id) && Object.entries(recipe).every(([key, amount]) => (profile.materials[key] || 0) >= amount);
}
