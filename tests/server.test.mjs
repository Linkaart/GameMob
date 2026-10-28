import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/index.mjs';

function nextMessage(ws, type) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { ws.off('message', listener); reject(new Error(`Timeout waiting for ${type}`)); }, 3000);
    function listener(data) {
      const message = JSON.parse(data);
      if (message.type === type) { clearTimeout(timeout); ws.off('message', listener); resolve(message); }
    }
    ws.on('message', listener);
  });
}
async function join(url, code, name) {
  const ws = new WebSocket(url); await once(ws, 'open');
  const welcome = nextMessage(ws, 'welcome');
  ws.send(JSON.stringify({ type: 'join', code, name }));
  return { ws, welcome: await welcome };
}

test('campaign rooms reject locked or invalid missions and validate each teammate before joining', async t => {
  const app=createGameServer({tick:false});t.after(()=>app.close());
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const url=`ws://127.0.0.1:${app.server.address().port}/ws`;
  const a=app.profiles.create(),b=app.profiles.create();
  const ws=new WebSocket(url);await once(ws,'open');
  for(const mission of ['new_dawn','__proto__']) {
    const error=nextMessage(ws,'error');ws.send(JSON.stringify({type:'join',code:'LOCKED',token:a.token,settings:{mode:'campaign',mission}}));
    assert.match((await error).message,/verrouillée/);assert.equal(app.rooms.size,0);
  }
  app.profiles.reward(a.profile.id,{mission:'last_signal'});
  const welcome=nextMessage(ws,'welcome');ws.send(JSON.stringify({type:'join',code:'LOCKED',token:a.token,settings:{mode:'campaign',mission:'relay',district:'laboratory'}}));
  assert.equal((await welcome).settings.district,'quarantine');
  const teammate=new WebSocket(url);await once(teammate,'open');
  const error=nextMessage(teammate,'error');teammate.send(JSON.stringify({type:'join',code:'LOCKED',token:b.token,settings:{mode:'survival'}}));
  assert.match((await error).message,/verrouillée/);assert.equal(app.rooms.get('LOCKED').players.size,1);
  const fake=await fetch(`http://127.0.0.1:${app.server.address().port}/api/profile/action`,{method:'POST',headers:{Authorization:`Bearer ${b.token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'complete',item:'last_signal'})});
  assert.equal(fake.status,400);assert.deepEqual(app.profiles.get(b.profile.id).campaign.completed,[]);
  ws.close();teammate.close();
});

test('two WebSocket clients share authoritative state, other rooms stay isolated, and disconnect cleans up', async t => {
  const app = createGameServer();
  t.after(() => app.close());
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const port = app.server.address().port;
  const health = await fetch(`http://127.0.0.1:${port}/api/health`).then(r => r.json());
  assert.equal(health.status, 'ok');
  const url = `ws://127.0.0.1:${port}/ws`;
  const a = await join(url, 'TEAM1', 'Alice');
  const b = await join(url, 'TEAM1', 'Bob');
  const c = await join(url, 'OTHER', 'Charlie');
  const [sa, sb, sc] = await Promise.all([nextMessage(a.ws, 'state'), nextMessage(b.ws, 'state'), nextMessage(c.ws, 'state')]);
  assert.deepEqual(sa.players.map(p => p.id), sb.players.map(p => p.id));
  assert.equal(sa.players.length, 2); assert.equal(sc.players.length, 1);
  const before = sa.players.find(p => p.id === a.welcome.id).x;
  a.ws.send(JSON.stringify({ type: 'input', x: 1, z: 0, aim: 0, fire: true, hp: 9000 }));
  let updated;
  for (let i = 0; i < 5; i++) {
    const state = await nextMessage(b.ws, 'state');
    updated = state.players.find(p => p.id === a.welcome.id);
    if (updated.x > before) break;
  }
  assert.ok(updated.x > before); assert.ok(updated.ammo < 24); assert.equal(updated.hp, 100);
  a.ws.close(); await once(a.ws, 'close');
  const after = await nextMessage(b.ws, 'state');
  assert.equal(after.players.length, 1); assert.equal(after.players[0].id, b.welcome.id);
  b.ws.close(); c.ws.close(); await Promise.all([once(b.ws, 'close'), once(c.ws, 'close')]);
  assert.equal(app.rooms.size, 0);
});

test('invalid room codes and a fifth player receive explicit errors', async t => {
  const app = createGameServer(); t.after(() => app.close());
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const url = `ws://127.0.0.1:${app.server.address().port}/ws`;
  const invalid = new WebSocket(url); await once(invalid, 'open');
  let error = nextMessage(invalid, 'error'); invalid.send(JSON.stringify({ type: 'join', code: '../bad' }));
  assert.match((await error).message, /code/); invalid.close();
  for (let i = 0; i < 4; i++) await join(url, 'FULL', 'Player' + i);
  const fifth = new WebSocket(url); await once(fifth, 'open');
  error = nextMessage(fifth, 'error'); fifth.send(JSON.stringify({ type: 'join', code: 'FULL' }));
  assert.match((await error).message, /complète/); fifth.close();
});

test('profile API authenticates purchases, locks equipment in combat, rejects forged rewards and restores earned loot', async t => {
  const app = createGameServer({ tick: false }); t.after(() => app.close());
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening');
  const origin = `http://127.0.0.1:${app.server.address().port}`, url = origin.replace('http:', 'ws:') + '/ws';
  const created = await fetch(origin + '/api/profiles', { method: 'POST' }).then(r => r.json());
  const headers = { Authorization: 'Bearer ' + created.token, 'Content-Type': 'application/json' };
  const command = data => fetch(origin + '/api/profile/action', { method: 'POST', headers, body: JSON.stringify(data) });
  assert.equal((await fetch(origin + '/api/profile')).status, 401);
  assert.equal((await command({ action: 'reward', credits: 9999, item: 'smg' })).status, 400);
  let response = await command({ action: 'buy', item: 'smg', credits: 99999 }); assert.equal(response.status, 200);
  assert.equal((await response.json()).profile.credits, 150);
  await command({ action: 'equip', item: 'smg' });
  const ws = new WebSocket(url); await once(ws, 'open');
  const welcome = nextMessage(ws, 'welcome'); ws.send(JSON.stringify({ type: 'join', code: 'LOOT', token: created.token, settings: { mode: 'hunt', boss: 'brute', district: 'laboratory' }, weapon: 'railgun' }));
  const joined = await welcome, room = app.rooms.get('LOOT'), player = room.players.get(joined.id);
  assert.equal(player.weapon, 'smg'); assert.equal(player.magazine, 36); assert.equal(joined.settings.mode, 'hunt');
  assert.equal((await command({ action: 'equip', item: 'carbine' })).status, 409);
  const duplicate = new WebSocket(url); await once(duplicate, 'open');
  const error = nextMessage(duplicate, 'error'); duplicate.send(JSON.stringify({ type: 'join', code: 'OTHER', token: created.token }));
  assert.match((await error).message, /déjà en partie/); duplicate.close();
  room.startWave(); room.damageEnemy(room.zombies[0], 99999, player);
  const profileEvent = nextMessage(ws, 'profile'), state = nextMessage(ws, 'state'); app.step();
  assert.equal((await profileEvent).profile.materials.plate, 1);
  const snapshot = await state; assert.ok(!JSON.stringify(snapshot).includes(created.token)); assert.equal(snapshot.players[0].profileId, undefined);
  ws.close(); await once(ws, 'close');
  const saved = await fetch(origin + '/api/profile', { headers }).then(r => r.json());
  assert.equal(saved.profile.materials.plate, 1); assert.equal(saved.profile.stats.bosses, 1);
  assert.equal((await command({ action: 'equip', item: 'carbine' })).status, 200);
  const invalid = new WebSocket(url); await once(invalid, 'open'); const denied = nextMessage(invalid, 'error');
  invalid.send(JSON.stringify({ type: 'join', code: 'BAD', token: 'forged' })); assert.match((await denied).message, /invalide/); invalid.close();
  assert.equal((await fetch(origin + '/api/profiles', { method: 'POST', headers: { Origin: 'https://unrelated.example' } })).status, 403);
});
