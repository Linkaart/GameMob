import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ProfileStore } from '../server/profiles.mjs';
import { Room } from '../server/game.mjs';
import { BOSSES, WEAPONS } from '../shared/content.mjs';

const enemy = (id, x, z, hp = 100) => ({ id, x, z, hp, maxHp: hp, kind: 'walker', speed: 0, attack: 99, aim: 0 });
function persistentRoom(store, profiles, settings = {}) {
  const hooks = Object.fromEntries(['reward', 'consume', 'spend'].map(k => [k, (...args) => store[k](...args)]));
  const room = new Room('PROGRESS', () => .9, { ...settings, hooks });
  return { room, players: profiles.map(p => room.addPlayer('Survivant', p)) };
}

test('purchases, crafting and contracts are atomic, owned and affordable; invalid IDs cannot corrupt balances', () => {
  const store = new ProfileStore();
  try {
    const { profile, token } = store.create(), id = profile.id;
    assert.equal(store.authenticate(token).id, id); assert.equal(store.authenticate('invalid'), null);
    assert.equal(store.command(id, 'buy', 'smg').credits, 150);
    assert.throws(() => store.command(id, 'buy', 'smg'), /déjà/);
    assert.throws(() => store.command(id, 'buy', 'marksman'), /insuffisants/);
    assert.throws(() => store.command(id, 'craft', 'tesla'), /insuffisants/);
    assert.throws(() => store.command(id, 'equip', 'tesla'), /possédez/);
    for (const item of ['constructor', '__proto__', 'toString', 'prototype']) assert.throws(() => store.command(id, 'buy', item));
    assert.equal(store.get(id).credits, 150);
    const reward = { materials: { scrap: 25, copper: 12, reactor: 1 }, stats: { bosses: 1 }, boss: 'warden' };
    store.reward(id, reward);
    assert.equal(store.command(id, 'craft', 'tesla').materials.reactor, 0);
    assert.throws(() => store.command(id, 'craft', 'tesla'), /déjà/);
    assert.equal(store.command(id, 'equip', 'tesla').equipped, 'tesla');
    assert.equal(store.command(id, 'claim', 'boss_hunter').credits, 350);
    assert.throws(() => store.command(id, 'claim', 'boss_hunter'), /déjà/);
    assert.throws(() => store.command(id, 'claim', 'exterminator'), /incomplet/);
    assert.equal(store.get(id).stats.crafts, 1);
  } finally { store.close(); }
});

test('profile, inventory, credentials and consumed items survive a database restart', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'deadblock-profile-')), filename = path.join(dir, 'profile.sqlite');
  let store = new ProfileStore(filename);
  try {
    const { profile, token } = store.create();
    store.command(profile.id, 'buy', 'medkit'); assert.equal(store.consume(profile.id, 'medkit'), true);
    store.reward(profile.id, { credits: 100, materials: { plate: 1 }, stats: { bosses: 1 } });
    store.close(); store = new ProfileStore(filename);
    const saved = store.authenticate(token);
    assert.equal(saved.credits, 480); assert.equal(saved.materials.plate, 1); assert.equal(saved.consumables.medkit, 1);
    assert.equal(store.consume(saved.id, 'medkit'), true); assert.equal(store.consume(saved.id, 'medkit'), false);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('all three bosses guarantee a rare component to each teammate once, then support real crafting and equipping', () => {
  const store = new ProfileStore();
  try {
    const a = store.create().profile, b = store.create().profile;
    const { room, players } = persistentRoom(store, [a, b]);
    for (const kind of Object.keys(BOSSES)) {
      room.spawnBoss(kind); const boss = room.zombies.at(-1);
      assert.equal(boss.maxHp, BOSSES[kind].hp * 1.5);
      room.damageEnemy(boss, 99999, players[0]); room.damageEnemy(boss, 99999, players[0]);
      for (const p of [a, b]) assert.equal(store.get(p.id).materials[BOSSES[kind].material], 1);
    }
    assert.equal(store.get(a.id).stats.bosses, 3); assert.equal(store.get(b.id).stats.bosses, 3);
    const crafted = store.command(a.id, 'craft', 'tesla'); assert.ok(crafted.owned.includes('tesla'));
    const equipped = store.command(a.id, 'equip', 'tesla');
    const next = persistentRoom(store, [equipped]).players[0];
    assert.equal(next.weapon, 'tesla'); assert.equal(next.ammo, 20);
    assert.equal(room.snapshot().players[0].profileId, undefined);
  } finally { store.close(); }
});

test('boss hazards are telegraphed before damage, rage triggers once, and hunts can be won', () => {
  for (const kind of Object.keys(BOSSES)) {
    const room = new Room('BOSS', () => .9, { mode: 'hunt', boss: kind }); const p = room.addPlayer('Hunter');
    room.startWave(); room.toSpawn = 0; const boss = room.zombies[0];
    assert.equal(boss.kind, kind); boss.x = 0; boss.z = -6; boss.ability = 0;
    p.x = 0; p.z = 0; p.invulnerable = 0;
    room.tick(.05); assert.ok(room.hazards.length); assert.equal(p.hp, 100);
    for (let i = 0; i < 35; i++) room.tick(.05);
    assert.ok(p.hp < 100, kind + ' damages after telegraph');
    boss.hp = boss.maxHp * .4; room.tick(.05);
    assert.equal(room.events.filter(e => e.type === 'enrage').length, 1);
    room.tick(.05); assert.equal(room.events.filter(e => e.type === 'enrage').length, 1);
    for (const z of room.zombies) room.damageEnemy(z, 99999, p);
    room.tick(.05); assert.equal(room.phase, 'victory'); assert.ok(p.loot[BOSSES[kind].material]);
    room.action(p.id, 'restart'); assert.equal(room.phase, 'breather'); assert.equal(room.hazards.length, 0);
  }
});

test('special guns chain, pierce, splash or burn and use their own magazines and reloads', () => {
  const setup = weapon => {
    const room = new Room('GUNS', () => .9), p = room.addPlayer('Hunter', { id: 'test', equipped: weapon, credits: 0, consumables: { medkit: 1, grenade: 2 } });
    Object.assign(p, { x: 0, z: 0, aim: Math.PI });
    room.zombies = [enemy(1, 0, -3, 300), enemy(2, 0, -5, 300), enemy(3, 1.5, -3, 300)];
    return { room, p };
  };
  let { room, p } = setup('tesla'); room.shoot(p); assert.ok(room.zombies.every(z => z.hp < 300)); assert.equal(room.events.filter(e => e.type === 'arc').length, 2);
  ({ room, p } = setup('railgun')); room.shoot(p); assert.equal(room.zombies[0].hp, 110); assert.equal(room.zombies[1].hp, 110); assert.equal(room.zombies[2].hp, 300);
  ({ room, p } = setup('venom')); room.shoot(p); assert.equal(room.zombies[2].hp, 277);
  ({ room, p } = setup('ember')); room.shoot(p); assert.ok(room.zombies[0].burn); const hp = room.zombies[0].hp;
  for (let i = 0; i < 15; i++) room.tick(.05); assert.ok(room.zombies[0].hp < hp);
  for (const id of Object.keys(WEAPONS)) {
    ({ room, p } = setup(id)); p.ammo = 1; room.shoot(p); assert.equal(p.reload, WEAPONS[id].reload);
    for (let i = 0; i < 60; i++) room.tick(.05); assert.equal(p.ammo, WEAPONS[id].magazine);
  }
});

test('medkits and grenades consume saved inventory once and grenades never harm allies', () => {
  const store = new ProfileStore();
  try {
    const profile = store.create().profile, { room, players: [p] } = persistentRoom(store, [profile]);
    p.hp = 25; room.action(p.id, 'medkit'); assert.equal(p.hp, 80); assert.equal(store.get(profile.id).consumables.medkit, 0);
    room.action(p.id, 'medkit'); assert.equal(p.hp, 80);
    p.itemCooldown = 0; p.x = 0; p.z = 0; p.aim = Math.PI;
    room.zombies = [enemy(99, 0, -6, 200)];
    room.action(p.id, 'grenade'); assert.equal(store.get(profile.id).consumables.grenade, 1);
    room.action(p.id, 'grenade'); assert.equal(store.get(profile.id).consumables.grenade, 1);
    for (let i = 0; i < 26; i++) room.tick(.05);
    assert.equal(room.zombies[0].hp, 20); assert.equal(p.hp, 80);
    p.credits = 450; room.action(p.id, 'upgrade'); assert.equal(store.get(profile.id).credits, 330);
  } finally { store.close(); }
});
