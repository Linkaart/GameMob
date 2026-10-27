import { randomUUID } from 'node:crypto';
import { ARENA_SIZE, MAGAZINE_SIZE, OBSTACLES, PLAYER_COLORS, blocked, moveBody, rayBoxDistance } from '../shared/world.mjs';
import { WEAPONS, ENEMIES, BOSSES, DISTRICTS, weaponFor } from '../shared/content.mjs';
import { clearPath, findRoute } from './navigation.mjs';

const finite = (n, fallback = 0) => typeof n === 'number' && Number.isFinite(n) ? n : fallback;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export class Room {
  constructor(code, random = Math.random, options = {}) {
    this.code = code;
    this.hooks = options.hooks || {};
    this.settings = { district: Object.hasOwn(DISTRICTS, options.district) ? options.district : 'quarantine', mode: options.mode === 'hunt' ? 'hunt' : 'survival', boss: Object.hasOwn(BOSSES, options.boss) ? options.boss : 'brute' };
    this.hazards = [];
    this.random = random;
    this.players = new Map();
    this.zombies = [];
    this.pickups = [];
    this.events = [];
    this.wave = 0;
    this.phase = 'breather';
    this.timer = 5;
    this.elapsed = 0;
    this.spawnTimer = 0;
    this.toSpawn = 0;
    this.teamKills = 0;
    this.serial = 0;
  }

  addPlayer(name, profile = null) {
    const weapon = profile?.equipped || 'carbine', spec = weaponFor(weapon);
    if (this.players.size >= 4) throw new Error('Cette salle est complète (4 joueurs).');
    const occupied = new Set([...this.players.values()].map(p => p.slot));
    const slot = [0, 1, 2, 3].find(i => !occupied.has(i));
    const player = {
      id: randomUUID(), name: String(name || 'Survivant').replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 16) || 'Survivant',
      slot, color: PLAYER_COLORS[slot], x: (slot % 2) * 2 - 1, z: Math.floor(slot / 2) * 2 + 1,
      profileId: profile?.id || null, weapon, magazine: spec.magazine, reloadDuration: spec.reload, medkits: profile?.consumables.medkit ?? 1, grenades: profile?.consumables.grenade ?? 2, itemCooldown: 0, loot: {}, bossKills: 0,
      aim: Math.PI, hp: 100, ammo: spec.magazine, reload: 0, cooldown: 0, kills: 0,
      credits: profile?.credits || 0, level: 1, revive: 0, invulnerable: 3, inputAge: 0,
      input: { x: 0, z: 0, aim: Math.PI, fire: false, sprint: false, interact: false },
    };
    this.players.set(player.id, player);
    this.events.push({ type: 'join', name: player.name });
    return player;
  }

  removePlayer(id) {
    this.players.delete(id);
  }

  setInput(id, input) {
    const player = this.players.get(id);
    if (!player || !input || typeof input !== 'object') return;
    let x = clamp(finite(input.x), -1, 1), z = clamp(finite(input.z), -1, 1);
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    player.input = {
      x, z, aim: clamp(finite(input.aim, player.aim), -Math.PI * 2, Math.PI * 2),
      fire: input.fire === true, sprint: input.sprint === true, interact: input.interact === true,
    };
    player.inputAge = 0;
  }

  action(id, action) {
    const p = this.players.get(id);
    if (!p) return;
    if (action === 'restart' && ['over', 'victory'].includes(this.phase)) {
      this.wave = 0;
      this.phase = 'breather';
      this.timer = 5;
      this.teamKills = 0;
      this.elapsed = 0;
      this.zombies = [];
      this.pickups = []; this.hazards = [];
      for (const player of this.players.values()) {
        Object.assign(player, { x: (player.slot % 2) * 2 - 1, z: Math.floor(player.slot / 2) * 2 + 1,
          hp: 100, ammo: player.magazine, reload: 0, cooldown: 0, kills: 0, credits: player.profileId ? player.credits : 0, level: 1, revive: 0, invulnerable: 3, loot: {}, bossKills: 0 });
      }
      this.events.push({ type: 'restart' });
      return;
    }
    if (['over', 'victory'].includes(this.phase) || p.hp <= 0) return;
    if (action === 'reload' && !p.reload && p.ammo < p.magazine) p.reload = p.reloadDuration;
    if (action === 'upgrade' && p.level < 5 && p.credits >= p.level * 120) {
      if (p.profileId && this.hooks.spend) p.credits = this.hooks.spend(p.profileId, p.level * 120).credits;
      else p.credits -= p.level * 120;
      p.level++;
      this.events.push({ type: 'upgrade', id });
    }
    if (p.itemCooldown > 0) return;
    if (action === 'medkit' && p.hp < 100 && p.medkits > 0 && this.consume(p, 'medkit')) {
      p.medkits--; p.hp = Math.min(100, p.hp + 55); p.itemCooldown = 2; this.events.push({ type: 'heal', id });
    }
    if (action === 'grenade' && p.grenades > 0 && this.consume(p, 'grenade')) {
      p.grenades--; p.itemCooldown = 1;
      const point = { x: p.x, z: p.z }; moveBody(point, Math.sin(p.aim) * 6, Math.cos(p.aim) * 6);
      this.hazard('grenade', point, 4.5, 1, .3, 180, p.id);
    }
  }

  consume(p, item) { return !p.profileId || !this.hooks.consume || this.hooks.consume(p.profileId, item); }
  award(p, reward) {
    if (p.profileId && this.hooks.reward) p.credits = this.hooks.reward(p.profileId, reward).credits;
    else p.credits += reward.credits || 0;
    for (const [key, value] of Object.entries(reward.materials || {})) p.loot[key] = (p.loot[key] || 0) + value;
  }
  hazard(kind, point, radius, delay, life, damage, owner = null) {
    this.hazards.push({ id: ++this.serial, kind, x: point.x, z: point.z, radius, delay, duration: delay, life, damage, owner, pulse: 0 });
  }
  damagePlayer(p, amount) {
    if (p.hp <= 0 || p.invulnerable > 0) return;
    p.hp = Math.max(0, p.hp - amount); p.invulnerable = .35; this.events.push({ type: 'hurt', id: p.id });
  }
  damageEnemy(z, amount, p, direct = false) {
    if (z.hp <= 0) return;
    if (direct && z.kind === 'armored' && Math.cos(Math.atan2(p.x - z.x, p.z - z.z) - z.aim) > .25) amount *= .4;
    z.hp = Math.max(0, z.hp - amount);
    if (z.hp > 0) return;
    this.teamKills++; p.kills++;
    this.award(p, { credits: z.kind === 'tank' ? 40 : 15, xp: 8, stats: { kills: 1 } });
    this.events.push({ type: 'kill', id: z.id, x: z.x, z: z.z });
    if (z.boss) {
      const boss = BOSSES[z.kind];
      for (const ally of this.players.values()) {
        ally.bossKills++;
        this.award(ally, { credits: boss.credits, xp: 150, materials: { [boss.material]: 1, scrap: 12, copper: 4, chemical: 3 }, stats: { bosses: 1 }, boss: z.kind });
      }
      this.events.push({ type: 'boss_loot', boss: z.kind });
      this.pickups.push({ id: ++this.serial, x: z.x, z: z.z, kind: 'cache', ttl: 60 });
    } else if (this.random() < .23 && this.pickups.length < 20) this.pickups.push({ id: ++this.serial, x: z.x, z: z.z, kind: this.random() < .4 ? 'health' : 'scrap', ttl: 30 });
  }


  startWave() {
    this.wave++;
    this.phase = 'combat';
    this.toSpawn = this.settings.mode === 'hunt' ? 4 + this.players.size * 2 : Math.ceil((7 + this.wave * 3) * (1 + (this.players.size - 1) * 0.55));
    this.spawnTimer = 0;
    this.events.push({ type: 'wave', wave: this.wave });
    if (this.settings.mode === 'hunt' || this.wave % 3 === 0) this.spawnBoss(this.settings.mode === 'hunt' ? this.settings.boss : ['brute', 'matriarch', 'warden'][Math.floor(this.wave / 3 - 1) % 3]);
  }

  spawnBoss(kind) {
    const boss = BOSSES[kind], hp = Math.round(boss.hp * (1 + (this.players.size - 1) * .5) * (1 + Math.floor(this.wave / 10) * .25));
    this.zombies.push({ id: ++this.serial, kind, boss: true, x: 0, z: -19, hp, maxHp: hp, speed: boss.speed, attack: 0, ability: 3, aim: 0 });
    this.events.push({ type: 'boss', boss: kind });
  }
  spawnZombie(forced) {
    const side = Math.floor(this.random() * 4), coordinate = (this.random() - .5) * (ARENA_SIZE - 4), edge = ARENA_SIZE / 2 - 1;
    const available = Object.keys(ENEMIES).filter(k => ENEMIES[k].wave <= this.wave);
    const kind = forced || (this.random() < .45 ? available[Math.floor(this.random() * available.length)] : 'walker');
    const spec = ENEMIES[kind], hp = spec.hp + this.wave * 8;
    this.zombies.push({ id: ++this.serial, x: side < 2 ? (side === 0 ? -edge : edge) : coordinate,
      z: side < 2 ? coordinate : (side === 2 ? -edge : edge), hp, maxHp: hp, kind,
      speed: spec.speed + (kind === 'walker' ? Math.min(this.wave * .07, .85) : 0), attack: 0, ability: 3, aim: 0, route: null });
  }
  shoot(p) {
    const weapon = weaponFor(p.weapon);
    p.ammo--; p.cooldown = weapon.cooldown * (1 - (p.level - 1) * .05);
    for (let pellet = 0; pellet < (weapon.pellets || 1); pellet++) {
      const aim = p.aim + (weapon.pellets ? (pellet / (weapon.pellets - 1) - .5) * weapon.spread : 0), dx = Math.sin(aim), dz = Math.cos(aim);
      let range = weapon.range;
      for (const obstacle of OBSTACLES) range = Math.min(range, rayBoxDistance(p.x, p.z, dx, dz, obstacle));
      const hits = [];
      for (const z of this.zombies) {
        if (z.hp <= 0) continue;
        const vx = z.x - p.x, vz = z.z - p.z, along = vx * dx + vz * dz, across = vx * dz - vz * dx, radius = z.boss ? 1.2 : z.kind === 'tank' ? .85 : .62;
        if (along < 0 || Math.abs(across) > radius) continue;
        const near = Math.max(0, along - Math.sqrt(radius * radius - across * across));
        if (near < range) hits.push({ z, near });
      }
      hits.sort((a, b) => a.near - b.near);
      const targets = hits.slice(0, weapon.pierce || 1);
      for (const { z } of targets) {
        this.damageEnemy(z, weapon.damage * (1 + (p.level - 1) * .375), p, true);
        if (weapon.burn && z.hp > 0) z.burn = { ttl: weapon.burn, tick: .5, player: p.id };
        if (weapon.chain) {
          let from = z;
          const seen = new Set([z.id]);
          for (let i = 0; i < weapon.chain; i++) {
            const next = this.zombies.filter(other => other.hp > 0 && !seen.has(other.id) && distance(from, other) < 5 && clearPath(from, other)).sort((a, b) => distance(from, a) - distance(from, b))[0];
            if (!next) break;
            this.events.push({ type: 'arc', x: from.x, z: from.z, endX: next.x, endZ: next.z, weapon: p.weapon });
            this.damageEnemy(next, weapon.damage * .65, p); seen.add(next.id); from = next;
          }
        }
        if (weapon.splash) for (const other of this.zombies) if (other !== z && other.hp > 0 && distance(z, other) < weapon.splash && clearPath(z, other)) this.damageEnemy(other, 23, p);
      }
      if (targets.length && !weapon.pierce) range = targets[0].near;
      this.events.push({ type: 'shot', player: p.id, weapon: p.weapon, x: p.x, z: p.z, endX: p.x + dx * range, endZ: p.z + dz * range, hit: targets.length > 0 });
    }
    if (!p.ammo) p.reload = p.reloadDuration;
  }
  abilities(z, target, dt) {
    z.ability = (z.ability ?? 3) - dt;
    if (z.boss && z.hp < z.maxHp * .5 && !z.enraged) {
      z.enraged = true; z.speed *= 1.2; z.ability = Math.min(z.ability, 1);
      for (let i = 0; i < 3; i++) if (this.zombies.length < 60) this.spawnZombie('runner');
      this.events.push({ type: 'enrage', boss: z.kind });
    }
    if (z.ability > 0) return;
    if (z.kind === 'brute') { this.hazard('quake', target, z.enraged ? 4.6 : 3.7, 1.35, .4, 32); z.ability = z.enraged ? 3.8 : 5; }
    if (z.kind === 'matriarch' || z.kind === 'spitter') {
      if (distance(z, target) < 20) { this.hazard('acid', target, z.boss ? 3.2 : 2, 1.1, 5, z.boss ? 12 : 8); z.ability = z.boss ? 4.2 : 6; }
    }
    if (z.kind === 'warden') {
      for (let i = 0; i < 3; i++) this.hazard('electric', { x: target.x + (i - 1) * 3, z: target.z + (i % 2) * 2 }, 2.5, 1.1 + i * .3, .4, 24);
      z.ability = z.enraged ? 3.7 : 5.2;
    }
    if (z.kind === 'exploder' && distance(z, target) < 3.3) { this.hazard('blast', z, 3.2, 1.2, .4, 24); z.hp = 0; }
  }

  // Reuse the arena visibility graph while following moving players.
  pursue(zombie, target, dt) {
    const directionTo = point => {
      const dx = point.x - zombie.x, dz = point.z - zombie.z, length = Math.hypot(dx, dz) || 1;
      return { dx: dx / length, dz: dz / length, length };
    };
    zombie.routeAge = (zombie.routeAge || 0) + dt;
    if (clearPath(zombie, target)) zombie.route = [];
    else if (!zombie.route?.length || zombie.routeAge > 0.8) {
      zombie.route = findRoute(zombie, target); zombie.routeAge = 0;
    }
    if (zombie.route?.length && distance(zombie, zombie.route[0]) < 0.15) zombie.route.shift();
    const direction = directionTo(zombie.route?.[0] || target);
    zombie.aim = Math.atan2(direction.dx, direction.dz);
    moveBody(zombie, direction.dx * zombie.speed * dt, direction.dz * zombie.speed * dt, 0.4);
  }

  tick(dt) {
    if (!this.players.size || ['over', 'victory'].includes(this.phase)) return;
    this.elapsed += dt;
    const living = [...this.players.values()].filter(p => p.hp > 0);
    if (!living.length) {
      this.phase = 'over';
      this.events.push({ type: 'over' });
      return;
    }
    if (this.phase === 'breather') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave();
    }
    if (this.phase === 'combat') {
      this.spawnTimer -= dt;
      if (this.toSpawn > 0 && this.spawnTimer <= 0) {
        this.spawnZombie();
        this.toSpawn--;
        this.spawnTimer = Math.max(0.25, 0.8 - this.wave * 0.03);
      }
    }
    for (const p of this.players.values()) {
      p.inputAge += dt;
      if (p.inputAge > 0.5) p.input = { ...p.input, x: 0, z: 0, fire: false, interact: false };
      if (p.hp <= 0) {
        const helper = living.find(other => other.input.interact && distance(other, p) < 2.6);
        p.revive = helper ? Math.min(2.5, p.revive + dt) : Math.max(0, p.revive - dt * 2);
        if (p.revive >= 2.5) {
          p.hp = 60; p.revive = 0; p.invulnerable = 3;
          this.award(helper, { xp: 25, stats: { revives: 1 } });
          this.events.push({ type: 'revive', name: p.name });
        }
        continue;
      }
      const speed = p.input.sprint && !p.input.fire ? 6.2 : 4.4;
      moveBody(p, p.input.x * speed * dt, p.input.z * speed * dt);
      p.aim = p.input.aim;
      p.cooldown = Math.max(0, p.cooldown - dt);
      p.itemCooldown = Math.max(0, p.itemCooldown - dt);
      p.invulnerable = Math.max(0, p.invulnerable - dt);
      if (p.reload > 0) {
        p.reload = Math.max(0, p.reload - dt);
        if (p.reload === 0) p.ammo = p.magazine;
      }
      if (p.input.fire && !p.reload && !p.cooldown && p.ammo > 0) this.shoot(p);
    }
    this.zombies = this.zombies.filter(z => z.hp > 0);
    for (const zombie of [...this.zombies]) {
      if (zombie.burn) {
        zombie.burn.ttl -= dt; zombie.burn.tick -= dt;
        const owner = this.players.get(zombie.burn.player);
        if (zombie.burn.tick <= 0 && owner) { this.damageEnemy(zombie, 8, owner); zombie.burn.tick = .5; }
        if (zombie.burn.ttl <= 0) zombie.burn = null;
      }
      if (zombie.hp <= 0) continue;
      let target = null, nearest = Infinity;
      for (const p of living) {
        if (p.hp <= 0) continue;
        const d = distance(zombie, p);
        if (d < nearest) { nearest = d; target = p; }
      }
      if (!target) continue;
      zombie.attack = Math.max(0, zombie.attack - dt);
      this.abilities(zombie, target, dt);
      if (nearest > 1) this.pursue(zombie, target, dt);
      if (nearest < 1.35 && !zombie.attack && !target.invulnerable) {
        this.damagePlayer(target, zombie.boss ? 22 : zombie.kind === 'tank' ? 25 : 12);
        zombie.attack = .85;
      }
    }
    // Light separation avoids stacking the entire horde on one point.
    for (let i = 0; i < this.zombies.length; i++) {
      const a = this.zombies[i];
      for (let j = i + 1; j < this.zombies.length; j++) {
        const b = this.zombies[j], d = distance(a, b);
        if (d > 0.001 && d < 0.8) {
          const push = Math.min((0.8 - d) * 0.5, dt);
          const dx = (a.x - b.x) / d * push, dz = (a.z - b.z) / d * push;
          moveBody(a, dx, dz, 0.4); moveBody(b, -dx, -dz, 0.4);
        }
      }
    }
    for (const h of this.hazards) {
      h.delay -= dt;
      if (h.delay > 0) continue;
      h.life -= dt; h.pulse -= dt;
      if (h.pulse <= 0) {
        h.pulse = h.kind === 'acid' ? 1 : 100;
        this.events.push({ type: 'blast', x: h.x, z: h.z, kind: h.kind });
        if (h.owner) {
          const owner = this.players.get(h.owner);
          if (owner) for (const z of this.zombies) if (z.hp > 0 && distance(h, z) < h.radius && clearPath(h, z)) this.damageEnemy(z, h.damage, owner);
        } else for (const p of living) if (distance(h, p) < h.radius) this.damagePlayer(p, h.damage);
      }
    }
    this.hazards = this.hazards.filter(h => h.life > 0);
    this.zombies = this.zombies.filter(z => z.hp > 0);
    for (const pickup of this.pickups) {
      pickup.ttl -= dt;
      const kind = pickup.kind || 'health';
      const p = living.find(p => p.hp > 0 && (kind !== 'health' || p.hp < 100) && distance(p, pickup) < 1.5);
      if (!p) continue;
      pickup.ttl = 0;
      if (kind === 'health') { p.hp = Math.min(100, p.hp + 30); this.events.push({ type: 'heal', id: p.id }); }
      else if (kind === 'cache') { for (const ally of this.players.values()) this.award(ally, { credits: 50, materials: { scrap: 5, copper: 2, chemical: 2 } }); this.events.push({ type: 'cache' }); }
      else { this.award(p, { materials: { scrap: 3, [this.random() < .5 ? 'copper' : 'chemical']: 1 } }); this.events.push({ type: 'loot', id: p.id }); }
    }
    this.pickups = this.pickups.filter(p => p.ttl > 0);
    if (this.phase === 'combat' && !this.toSpawn && !this.zombies.length) {
      this.phase = this.settings.mode === 'hunt' ? 'victory' : 'breather'; this.timer = 9;
      for (const p of this.players.values()) {
        p.hp = Math.min(100, Math.max(50, p.hp) + 15);
        p.ammo = p.magazine; p.reload = 0; this.award(p, { credits: 40, xp: 35, stats: { waves: 1 }, wave: this.wave, materials: { scrap: 3, copper: 1 } });
      }
      this.events.push({ type: 'clear', wave: this.wave });
    }
  }

  snapshot() {
    return {
      type: 'state', code: this.code, settings: this.settings, wave: this.wave, phase: this.phase, timer: this.timer,
      elapsed: this.elapsed, remaining: this.zombies.length + this.toSpawn, teamKills: this.teamKills,
      players: [...this.players.values()].map(({ input, inputAge, cooldown, itemCooldown, profileId, ...p }) => p),
      zombies: this.zombies.map(({ route, routeAge, speed, attack, ability, burn, ...z }) => ({ ...z, burning: !!burn })),
      hazards: this.hazards.map(({ damage, owner, pulse, ...h }) => ({ ...h, friendly: !!owner })),
      pickups: this.pickups, events: this.events.splice(0),
    };
  }
}
