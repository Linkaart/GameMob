import test from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/game.mjs';
import { ProfileStore } from '../server/profiles.mjs';
import { MISSIONS, missionUnlocked, WEAPONS } from '../shared/content.mjs';
import { WORLDS, blocked, moveBody } from '../shared/world.mjs';
import { clearPath, findRoute } from '../server/navigation.mjs';

function advance(room, seconds, input = {}) {
  for (let i = 0; i < Math.ceil(seconds / .05); i++) {
    for (const p of room.players.values()) room.setInput(p.id, input);
    room.tick(.05);
  }
}
function clearMissionWaves(room, p) {
  for (let wave = 1; wave <= room.mission.waves; wave++) {
    room.startWave(); assert.ok(room.toSpawn > 0);
    const expected = room.mission.bosses?.[wave-1] || (wave === room.mission.waves ? room.mission.boss : null);
    if (expected) assert.equal(room.zombies.find(z=>z.boss)?.kind, expected);
    for (const z of room.zombies) room.damageEnemy(z, 999999, p);
    room.toSpawn = 0; room.tick(.05);
  }
}

test('all three maps have reachable mission stations and exits, independent collision boundaries and valid routes', () => {
  for (const world of Object.values(WORLDS)) {
    const from = {x:0,z:0}, destinations = [...world.stations,{x:0,z:world.size/2-4}];
    for (const to of destinations) {
      assert.equal(blocked(to.x,to.z,.46,world),false);
      const route = [...findRoute(from,to,world),to]; let previous = from;
      for (const point of route) { assert.ok(clearPath(previous,point,world)); previous=point; }
    }
    const p = {x:world.size/2-.5,z:0}; moveBody(p,1,0,.46,world); assert.equal(p.x,world.size/2-.5);
    const obstacle=world.obstacles[0]; assert.ok(blocked(obstacle.x,obstacle.z,.46,world));
  }
  assert.equal(blocked(29,0,.46,WORLDS.quarantine),true);
  assert.equal(blocked(29,0,.46,WORLDS.foundry),false);
});

test('all nine campaign missions can be completed in sequence with saved unlocks, first-clear rewards and extraction', () => {
  const store=new ProfileStore();
  try {
    const profile=store.create().profile;
    for (const mission of MISSIONS) {
      assert.ok(missionUnlocked(store.get(profile.id),mission.id));
      const room=new Room('CAMPAIGN',()=>.9,{mode:'campaign',mission:mission.id,hooks:{reward:(...a)=>store.reward(...a)}});
      const p=room.addPlayer('Hunter',store.get(profile.id)); p.invulnerable=999;
      clearMissionWaves(room,p);
      if (mission.goal==='salvage') for(const point of room.objective.points) {
        p.x=point.x;p.z=point.z;advance(room,2.1,{interact:true});assert.equal(point.done,true);
      }
      else if(mission.goal==='defend') {p.x=room.objective.points[0].x;p.z=room.objective.points[0].z;advance(room,mission.target+.2);}
      assert.equal(room.phase,'extraction',mission.id);
      Object.assign(p,room.objective.exit);advance(room,5.2);
      assert.equal(room.phase,'victory',mission.id);
      assert.ok(store.get(profile.id).campaign.completed.includes(mission.id));
      const credits=store.get(profile.id).credits;advance(room,10);assert.equal(store.get(profile.id).credits,credits);
    }
    assert.equal(store.get(profile.id).stats.missions,9);
    assert.equal(store.get(profile.id).campaign.completed.length,9);
    const before=store.get(profile.id).credits;
    store.reward(profile.id,{mission:MISSIONS[0].id});
    assert.equal(store.get(profile.id).credits-before,Math.floor(MISSIONS[0].reward*.35));
    assert.equal(store.get(profile.id).stats.missions,9);
    assert.ok(store.command(profile.id,'claim','campaign_veteran').claimed.includes('campaign_veteran'));
  } finally {store.close();}
});

test('salvage requires nearby sustained interaction; extraction requires all living teammates and resets when they leave', () => {
  const room=new Room('COOP',()=>.9,{mode:'campaign',mission:'last_signal'});
  const a=room.addPlayer('A'),b=room.addPlayer('B');a.invulnerable=b.invulnerable=999;
  room.timer=999;advance(room,3,{interact:true});assert.equal(room.objective.progress,0);
  const point=room.objective.points[0];a.x=point.x;a.z=point.z;
  advance(room,1,{interact:true});assert.equal(point.done,false);advance(room,1.1,{interact:true});assert.equal(point.done,true);
  room.phase='extraction';room.objective.ready=true;
  Object.assign(a,room.objective.exit);advance(room,6);assert.equal(room.phase,'extraction');assert.equal(room.objective.extracting,0);
  Object.assign(b,room.objective.exit);advance(room,2);assert.ok(room.objective.extracting>1);
  b.z-=5;advance(room,.1);assert.equal(room.objective.extracting,0);
  Object.assign(b,room.objective.exit);advance(room,5.2);assert.equal(room.phase,'victory');
  room.action(a.id,'restart');assert.equal(room.objective.progress,0);assert.equal(room.objective.ready,false);
});

test('defence only progresses with a survivor inside an uncontested relay', () => {
  const room=new Room('DEFEND',()=>.9,{mode:'campaign',mission:'relay'});const p=room.addPlayer('A');p.invulnerable=999;room.timer=999;
  advance(room,2);assert.equal(room.objective.progress,0);
  const point=room.objective.points[0];p.x=point.x;p.z=point.z;
  room.spawnZombie('walker');Object.assign(room.zombies[0],{x:point.x+1,z:point.z,speed:0});
  advance(room,2);assert.equal(room.objective.progress,0);assert.equal(room.objective.contested,true);
  room.zombies=[];advance(room,2);assert.ok(room.objective.progress>=1.9);
});

test('legacy JSON profiles retain purchases while receiving campaign fields', () => {
  const store=new ProfileStore();
  try {
    const {profile,token}=store.create();store.command(profile.id,'buy','smg');
    const old=store.get(profile.id);delete old.campaign;delete old.stats.missions;
    store.saveRow.run(JSON.stringify(old),old.id);
    const restored=store.authenticate(token);assert.deepEqual(restored.campaign,{completed:[]});assert.equal(restored.stats.missions,0);
    assert.ok(restored.owned.includes('smg'));assert.equal(restored.credits,150);
    assert.equal(missionUnlocked(restored,'new_dawn'),false);assert.equal(missionUnlocked(restored,'last_signal'),true);
  } finally {store.close();}
});

test('cryogenic hits slow enemies temporarily and plasma deals its configured area damage', () => {
  const room=new Room('SPECIAL',()=>.9),p=room.addPlayer('A');room.timer=999;
  Object.assign(p,{x:0,z:0,aim:Math.PI,weapon:'cryo'});
  room.spawnZombie('walker');const z=room.zombies[0];Object.assign(z,{x:0,z:-8,hp:500,maxHp:500,speed:2});
  room.shoot(p);assert.equal(z.chilled,WEAPONS.cryo.slow);
  const start=z.z;room.pursue(z,p,.1);assert.ok(Math.abs(z.z-start-.09)<.001);
  advance(room,2.6);assert.equal(z.chilled,0);
  Object.assign(z,{x:0,z:-5,hp:500});room.spawnZombie('walker');const other=room.zombies[1];Object.assign(other,{x:1.5,z:-5,hp:500});
  p.weapon='cannon';room.shoot(p);assert.equal(z.hp,370);assert.equal(other.hp,430);
});
