import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { BOSSES, CONTRACTS, MATERIALS, SHOP_ITEMS, WEAPONS, canCraft, missionFor } from '../shared/content.mjs';

const normalize = p => { p.campaign ||= { completed: [] }; p.stats.missions ||= 0; return p; };
const hash = token => createHash('sha256').update(token).digest('hex');
export class ProfileStore {
  constructor(filename = ':memory:') {
    if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true });
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, data TEXT NOT NULL)');
    this.readId = this.db.prepare('SELECT data FROM profiles WHERE id=?');
    this.readToken = this.db.prepare('SELECT data FROM profiles WHERE token_hash=?');
    this.saveRow = this.db.prepare('UPDATE profiles SET data=? WHERE id=?');
  }
  create() {
    const token = randomBytes(32).toString('hex');
    const profile = { id: randomUUID(), credits: 450, xp: 0, owned: ['carbine'], equipped: 'carbine',
      materials: Object.fromEntries(Object.keys(MATERIALS).map(key => [key, 0])),
      consumables: { medkit: 1, grenade: 2 }, stats: { kills: 0, waves: 0, bosses: 0, revives: 0, crafts: 0, bestWave: 0, missions: 0 }, campaign: { completed: [] },
      defeated: [], claimed: [], recentLoot: [], createdAt: Date.now() };
    this.db.prepare('INSERT INTO profiles (id,token_hash,data) VALUES (?,?,?)').run(profile.id, hash(token), JSON.stringify(profile));
    return { token, profile };
  }
  authenticate(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
    const row = this.readToken.get(hash(token)); return row ? normalize(JSON.parse(row.data)) : null;
  }
  get(id) { const row = this.readId.get(id); return row ? normalize(JSON.parse(row.data)) : null; }
  transaction(id, change) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const profile = this.get(id); if (!profile) throw new Error('Profil introuvable.');
      change(profile); this.saveRow.run(JSON.stringify(profile), id); this.db.exec('COMMIT'); return profile;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  command(id, action, item) {
    if (typeof item !== 'string' || !/^[a-z_]{1,32}$/.test(item) || item.startsWith('__') || !['buy', 'craft', 'equip', 'claim'].includes(action)) throw new Error('Commande invalide.');
    return this.transaction(id, p => {
      if (action === 'buy') {
        const weapon = Object.hasOwn(WEAPONS, item) ? WEAPONS[item] : null, product = Object.hasOwn(SHOP_ITEMS, item) ? SHOP_ITEMS[item] : null;
        if (weapon && weapon.price > 0) {
          if (p.owned.includes(item)) throw new Error('Cette arme est déjà dans votre arsenal.');
          if (p.credits < weapon.price) throw new Error('Crédits insuffisants.');
          p.credits -= weapon.price; p.owned.push(item);
        } else if (product) {
          if (p.credits < product.price) throw new Error('Crédits insuffisants.');
          if (product.kind === 'consumable' && p.consumables[item] >= 20) throw new Error('Stock maximum : 20 unités.');
          p.credits -= product.price;
          if (product.materials) for (const [key, amount] of Object.entries(product.materials)) p.materials[key] += amount;
          else p.consumables[item]++;
        } else throw new Error('Article indisponible.');
      } else if (action === 'craft') {
        if (!WEAPONS[item]?.recipe) throw new Error('Plan introuvable.');
        if (p.owned.includes(item)) throw new Error('Cette arme est déjà fabriquée.');
        if (!canCraft(p, item)) throw new Error('Composants insuffisants. Chassez les boss pour obtenir les pièces rares.');
        for (const [key, amount] of Object.entries(WEAPONS[item].recipe)) p.materials[key] -= amount;
        p.owned.push(item); p.stats.crafts++;
      } else if (action === 'equip') {
        if (!p.owned.includes(item) || !WEAPONS[item]) throw new Error('Vous ne possédez pas cette arme.');
        p.equipped = item;
      } else if (action === 'claim') {
        const contract = CONTRACTS.find(c => c.id === item);
        if (!contract || p.stats[contract.stat] < contract.target) throw new Error('Contrat incomplet.');
        if (p.claimed.includes(item)) throw new Error('Récompense déjà récupérée.');
        p.claimed.push(item); this.applyReward(p, contract.reward);
      } else throw new Error('Action inconnue.');
    });
  }
  applyReward(p, reward) {
    if (reward.mission && missionFor(reward.mission)) {
      const m = missionFor(reward.mission), first = !p.campaign.completed.includes(m.id);
      if (first) p.campaign.completed.push(m.id);
      reward = { credits: first ? m.reward : Math.floor(m.reward * .35), xp: first ? 180 : 50, stats: { missions: first ? 1 : 0 }, materials: { scrap: first ? 12 : 4, copper: first ? 4 : 1 } };
    }
    p.credits += Math.max(0, reward.credits || 0); p.xp += Math.max(0, reward.xp || 0);
    for (const [key, amount] of Object.entries(reward.materials || {})) if (MATERIALS[key]) p.materials[key] += Math.max(0, amount);
    for (const [key, amount] of Object.entries(reward.consumables || {})) if (key in p.consumables) p.consumables[key] = Math.min(20, p.consumables[key] + Math.max(0, amount));
    for (const [key, amount] of Object.entries(reward.stats || {})) if (key in p.stats && key !== 'bestWave') p.stats[key] += Math.max(0, amount);
    if (reward.wave) p.stats.bestWave = Math.max(p.stats.bestWave, reward.wave);
    if (reward.boss && BOSSES[reward.boss] && !p.defeated.includes(reward.boss)) p.defeated.push(reward.boss);
    if (reward.boss || reward.materials && Object.keys(reward.materials).length) {
      p.recentLoot.unshift({ time: Date.now(), boss: reward.boss || null, materials: reward.materials || {}, credits: reward.credits || 0 });
      p.recentLoot = p.recentLoot.slice(0, 8);
    }
  }
  reward(id, reward) { return this.transaction(id, p => this.applyReward(p, reward)); }
  spend(id, credits) { return this.transaction(id, p => { if (p.credits < credits) throw new Error('Crédits insuffisants.'); p.credits -= credits; }); }
  consume(id, item) {
    let consumed = false;
    this.transaction(id, p => {
      if (['medkit', 'grenade'].includes(item) && p.consumables[item] > 0) { p.consumables[item]--; consumed = true; }
    });
    return consumed;
  }
  close() { this.db.close(); }
}
