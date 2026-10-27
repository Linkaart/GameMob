import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { startLocalGame } from '../scripts/play.mjs';

test('desktop launcher serves profiles and a real game on its assigned port', async t => {
  const game = await startLocalGame({ port: 0, host: '127.0.0.1', database: ':memory:' });
  t.after(() => game.close());
  assert.equal(new URL(game.url).port, String(game.server.address().port));
  const response = await fetch(game.url + '/api/profiles', { method: 'POST', headers: { Origin: game.url } });
  assert.equal(response.status, 201);
  const { token } = await response.json();
  const socket = new WebSocket(game.url.replace('http:', 'ws:') + '/ws', { origin: game.url });
  await once(socket, 'open');
  const received = once(socket, 'message');
  socket.send(JSON.stringify({ type: 'join', code: 'DESKTOP', name: 'Windows', token }));
  const welcome = JSON.parse((await received)[0]); assert.equal(welcome.type, 'welcome');
  const state = JSON.parse((await once(socket, 'message'))[0]);
  assert.equal(state.players[0].id, welcome.id);
  socket.close(); await once(socket, 'close');
});

test('desktop launcher reports an occupied port and closes the unsuccessful instance', async t => {
  const game = await startLocalGame({ port: 0, host: '127.0.0.1', database: ':memory:' });
  t.after(() => game.close());
  await assert.rejects(startLocalGame({ port: game.server.address().port, host: '127.0.0.1', database: ':memory:' }), { code: 'EADDRINUSE' });
  await assert.rejects(startLocalGame({ port: -1, database: ':memory:' }), /invalide/);
  assert.equal((await fetch(game.url + '/api/health')).status, 200);
});
