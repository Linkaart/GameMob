import test from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/game.mjs';
import { MAGAZINE_SIZE, blocked } from '../shared/world.mjs';

function fixture() {
  const room = new Room('TEST', () => 0.5);
  room.timer = 999;
  const player = room.addPlayer('Alice');
  player.x = 0; player.z = 0;
  return { room, player };
}
function zombie(id, x, z) {
  return { id, x, z, hp: 70, maxHp: 70, kind: 'walker', speed: 1.8, attack: 0, aim: 0, route: null };
}

test('movement is normalized, rejects invalid numbers, and cannot cross walls or bounds', () => {
  const { room, player } = fixture();
  room.setInput(player.id, { x: 10000, z: 10000, hp: 99999 });
  room.tick(0.1);
  assert.ok(Math.abs(Math.hypot(player.x, player.z) - 0.44) < 1e-8);
  assert.equal(player.hp, 100);
  room.setInput(player.id, { x: NaN, z: Infinity, aim: NaN });
  room.tick(0.1);
  assert.ok(Number.isFinite(player.x) && Number.isFinite(player.aim));
  player.x = -7.6; player.z = -12;
  room.setInput(player.id, { x: -1 }); room.tick(0.1);
  assert.equal(player.x, -7.6);
  player.x = 22.5; player.z = 0;
  room.setInput(player.id, { x: 1 }); room.tick(0.1);
  assert.equal(player.x, 22.5);
});

test('stale inputs stop movement and shooting when a tab stops sending', () => {
  const { room, player } = fixture();
  room.setInput(player.id, { x: 1, fire: true, aim: 0 });
  for (let i = 0; i < 12; i++) room.tick(0.05);
  const x = player.x, ammo = player.ammo;
  for (let i = 0; i < 5; i++) room.tick(0.05);
  assert.equal(player.x, x); assert.equal(player.ammo, ammo);
});

test('shooting damages the nearest zombie, awards a kill once, and reloads a magazine', () => {
  const { room, player } = fixture();
  room.zombies = [zombie(1, 0, 4), zombie(2, 0, 8)];
  for (let i = 0; i < 10; i++) {
    room.setInput(player.id, { aim: 0, fire: true }); room.tick(0.05);
  }
  assert.equal(player.kills, 1); assert.equal(room.teamKills, 1); assert.equal(player.credits, 15);
  assert.equal(room.zombies.length, 1); assert.equal(room.zombies[0].hp, 70);
  room.setInput(player.id, { fire: false }); room.action(player.id, 'reload');
  assert.equal(player.reload, 1.5);
  for (let i = 0; i < 31; i++) room.tick(0.05);
  assert.equal(player.ammo, MAGAZINE_SIZE); assert.equal(player.reload, 0);
});

test('buildings and parked cars block bullets; allies are not damaged', () => {
  const { room, player } = fixture();
  room.zombies = [zombie(1, 11.25, -3)];
  player.aim = Math.atan2(7.5, -2); room.shoot(player);
  assert.equal(room.zombies[0].hp, 70);
  const ally = room.addPlayer('Bob'); ally.x = 0; ally.z = 2;
  player.aim = 0; room.shoot(player); assert.equal(ally.hp, 100);
});

test('reviving requires a nearby living teammate holding interact', () => {
  const { room, player } = fixture();
  const ally = room.addPlayer('Bob'); ally.x = 1; ally.z = 0; ally.hp = 0;
  for (let i = 0; i < 60; i++) room.tick(0.05);
  assert.equal(ally.hp, 0);
  for (let i = 0; i < 51; i++) { room.setInput(player.id, { interact: true }); room.tick(0.05); }
  assert.equal(ally.hp, 60); assert.ok(ally.invulnerable > 0);
});

test('upgrades require earned credits and cannot exceed level five', () => {
  const { room, player } = fixture();
  room.action(player.id, 'upgrade'); assert.equal(player.level, 1);
  player.credits = 120; room.action(player.id, 'upgrade');
  assert.equal(player.level, 2); assert.equal(player.credits, 0);
  player.credits = 10000;
  for (let i = 0; i < 10; i++) room.action(player.id, 'upgrade');
  assert.equal(player.level, 5);
});

test('wave completion heals and resupplies the team; all downed ends the run; restart resets it', () => {
  const { room, player } = fixture();
  room.startWave(); assert.equal(room.wave, 1); assert.ok(room.toSpawn > 0);
  room.toSpawn = 0; player.hp = 25; player.ammo = 3;
  room.tick(0.05);
  assert.equal(room.phase, 'breather'); assert.equal(player.hp, 65); assert.equal(player.ammo, MAGAZINE_SIZE);
  player.hp = 0; room.tick(0.05); assert.equal(room.phase, 'over');
  room.action(player.id, 'restart');
  assert.equal(room.phase, 'breather'); assert.equal(room.wave, 0); assert.equal(player.hp, 100);
  assert.equal(player.credits, 0); assert.equal(room.elapsed, 0);
});

test('zombies route around a building instead of walking through it', () => {
  const { room, player } = fixture();
  player.x = -13; player.z = -5; player.invulnerable = 999;
  const enemy = zombie(1, -13, -20); room.zombies = [enemy];
  for (let i = 0; i < 500; i++) {
    room.tick(0.05);
    assert.equal(blocked(enemy.x, enemy.z, 0.39), false);
  }
  assert.ok(Math.hypot(enemy.x - player.x, enemy.z - player.z) < 1.5, `Zombie stuck at ${enemy.x}, ${enemy.z}`);
});

test('rooms are limited to four players and reuse available colors after disconnect', () => {
  const { room, player } = fixture();
  for (const name of ['B', 'C', 'D']) room.addPlayer(name);
  assert.throws(() => room.addPlayer('E'), /complète/);
  room.removePlayer(player.id);
  assert.equal(room.addPlayer('E').slot, 0);
});
