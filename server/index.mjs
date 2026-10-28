import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
import { ProfileStore } from './profiles.mjs';
import { Room } from './game.mjs';
import { GAME_VERSION, missionFor, missionUnlocked } from '../shared/content.mjs';

const root = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

export function createGameServer({ tick = true, database = ':memory:' } = {}) {
  const rooms = new Map(), profiles = new ProfileStore(database), activeProfiles = new Map(), dirtyProfiles = new Set(), creations = new Map();
  const hooks = Object.fromEntries(['reward', 'spend', 'consume'].map(method => [method, (id, value) => { const result = profiles[method](id, value); dirtyProfiles.add(id); return result; }]));
  const json = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const sameOrigin = req => { try { return !req.headers.origin || new URL(req.headers.origin).host === req.headers.host; } catch { return false; } };
  async function body(req) {
    let content = ''; for await (const chunk of req) { content += chunk; if (content.length > 2048) throw new Error('Requête trop longue.'); }
    const data = JSON.parse(content || '{}'); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Requête invalide.'); return data;
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const url = new URL(req.url, 'http://localhost');
    if (['/api/profiles', '/api/profile', '/api/profile/action'].includes(url.pathname)) {
      try {
        if (!sameOrigin(req)) { json(res, 403, { error: 'Origine refusée.' }); return; }
        if (url.pathname === '/api/profiles' && req.method === 'POST') {
          const ip = req.socket.remoteAddress, now = Date.now();
          for (const [key, entry] of creations) if (entry.until < now) creations.delete(key);
          const entry = creations.get(ip) || { count: 0, until: now + 3600000 }; creations.set(ip, entry);
          if (++entry.count > 60 || creations.size > 10000) { json(res, 429, { error: 'Trop de nouveaux profils. Réessayez plus tard.' }); return; }
          json(res, 201, profiles.create()); return;
        }
        const profile = profiles.authenticate(req.headers.authorization?.replace(/^Bearer /, ''));
        if (!profile) { json(res, 401, { error: 'Profil introuvable. Rechargez le refuge.' }); return; }
        if (url.pathname === '/api/profile' && req.method === 'GET') { json(res, 200, { profile }); return; }
        if (url.pathname === '/api/profile/action' && req.method === 'POST') {
          if (activeProfiles.has(profile.id)) { json(res, 409, { error: 'Retournez au refuge pour modifier votre équipement.' }); return; }
          const data = await body(req);
          if (activeProfiles.has(profile.id)) { json(res, 409, { error: 'Retournez au refuge pour modifier votre équipement.' }); return; }
          json(res, 200, { profile: profiles.command(profile.id, data.action, data.item) }); return;
        }
        json(res, 405, { error: 'Méthode indisponible.' });
      } catch (error) { json(res, 400, { error: error instanceof SyntaxError ? 'Requête invalide.' : error.message }); }
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ status: 'ok', game: 'deadblock', version: GAME_VERSION, rooms: rooms.size })); return;
    }
    try {
      const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      if (!(await stat(filename)).isFile()) throw new Error('Not a file');
      const data = await readFile(filename);
      res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
        'Cache-Control': filename.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Page introuvable. Lancez npm run build avant npm start.');
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    let validOrigin = true;
    try { if (req.headers.origin) validOrigin = new URL(req.headers.origin).host === req.headers.host; } catch { validOrigin = false; }
    if (req.url !== '/ws' || !validOrigin || wss.clients.size >= 120) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  const send = (ws, data) => { if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 256 * 1024) ws.send(JSON.stringify(data)); };
  wss.on('connection', ws => {
    ws.alive = true;
    let room, player, messages = 0, windowStart = Date.now();
    const joinTimeout = setTimeout(() => { if (!player) ws.close(1008, 'Join timeout'); }, 10000);
    ws.on('pong', () => { ws.alive = true; });
    ws.on('error', () => {});
    ws.on('message', raw => {
      if (Date.now() - windowStart >= 1000) { messages = 0; windowStart = Date.now(); }
      if (++messages > 100) { ws.close(1008, 'Too many messages'); return; }
      let message;
      try { message = JSON.parse(raw.toString()); } catch { ws.close(1008, 'Invalid JSON'); return; }
      if (!message || typeof message !== 'object') return;
      if (message.type === 'join' && !player) {
        const code = typeof message.code === 'string' ? message.code.trim().toUpperCase() : '';
        if (!/^[A-Z0-9]{3,8}$/.test(code)) { send(ws, { type: 'error', message: 'Le code doit contenir 3 à 8 lettres ou chiffres.' }); return; }
        const profile = message.token ? profiles.authenticate(message.token) : null;
        if (message.token && !profile) { send(ws, { type: 'error', message: 'Profil invalide. Rechargez le refuge.' }); return; }
        if (profile && activeProfiles.has(profile.id)) { send(ws, { type: 'error', message: 'Ce survivant est déjà en partie dans un autre onglet.' }); return; }
        const campaignSettings = rooms.get(code)?.settings || message.settings;
        if (campaignSettings?.mode === 'campaign' && (!profile || !missionFor(campaignSettings.mission) || !missionUnlocked(profile, campaignSettings.mission))) {
          send(ws, { type: 'error', message: 'Cette mission est verrouillée. Terminez d’abord la précédente avec ce survivant.' }); return;
        }
        if (!rooms.has(code)) {
          if (rooms.size >= 30) { send(ws, { type: 'error', message: 'Serveur complet. Réessayez un peu plus tard.' }); return; }
          rooms.set(code, new Room(code, Math.random, { ...message.settings, hooks }));
        }
        room = rooms.get(code);
        try { player = room.addPlayer(message.name, profile); }
        catch (error) { send(ws, { type: 'error', message: error.message }); return; }
        clearTimeout(joinTimeout);
        ws.room = room; ws.playerId = player.id; ws.profileId = profile?.id;
        if (profile) activeProfiles.set(profile.id, ws);
        send(ws, { type: 'welcome', id: player.id, code: room.code, settings: room.settings, profile });
      } else if (player && message.type === 'input') room.setInput(player.id, message);
      else if (player && message.type === 'action') room.action(player.id, message.action);
    });
    ws.on('close', () => {
      clearTimeout(joinTimeout);
      if (player) {
        room.removePlayer(player.id);
        if (ws.profileId) { activeProfiles.delete(ws.profileId); dirtyProfiles.delete(ws.profileId); }
        if (!room.players.size) rooms.delete(room.code);
      }
    });
  });
  function step(dt = 0.05) {
    for (const room of rooms.values()) {
      room.tick(dt);
      const state = room.snapshot();
      for (const ws of wss.clients) if (ws.room === room) {
        send(ws, state);
        if (dirtyProfiles.has(ws.profileId)) { send(ws, { type: 'profile', profile: profiles.get(ws.profileId) }); dirtyProfiles.delete(ws.profileId); }
      }
    }
  }
  const ticker = tick ? setInterval(step, 50) : null;
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false; ws.ping();
    }
  }, 15000);
  const close = () => new Promise(resolve => {
    clearInterval(ticker); clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    wss.close(); server.close(() => { profiles.close(); resolve(); });
  });
  return { server, rooms, profiles, step, close };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = createGameServer({ database: path.resolve(process.env.DATA_DIR || '.data', 'deadblock.sqlite') });
  const port = Number(process.env.PORT || 3000);
  app.server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`DEADBLOCK server listening on port ${port}`));
  const shutdown = () => app.close().then(() => process.exit(0));
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
