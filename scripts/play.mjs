import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces, homedir } from 'node:os';
import { spawn } from 'node:child_process';
import { createGameServer } from '../server/index.mjs';
import { GAME_VERSION } from '../shared/content.mjs';

export const DEFAULT_PLAY_PORT = 3377;

export async function startLocalGame({
  port = Number(process.env.PORT || DEFAULT_PLAY_PORT),
  host = '0.0.0.0',
  database = path.join(process.env.DATA_DIR || path.join(process.env.LOCALAPPDATA || path.join(homedir(), '.local', 'share'), 'GameMob', 'Deadblock'), 'deadblock.sqlite'),
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Port de jeu invalide.');
  const app = createGameServer({ database });
  try {
    await new Promise((resolve, reject) => {
      app.server.once('error', reject);
      app.server.listen(port, host, () => { app.server.off('error', reject); resolve(); });
    });
  } catch (error) { await app.close(); throw error; }
  const actualPort = app.server.address().port;
  const url = `http://127.0.0.1:${actualPort}`;
  const lan = Object.values(networkInterfaces()).flat().filter(n => n?.family === 'IPv4' && !n.internal).map(n => `http://${n.address}:${actualPort}`);
  return { ...app, url, lan, database };
}

function openBrowser(url) {
  if (process.env.DEADBLOCK_NO_BROWSER === '1') return;
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(command, [url], { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.log(`Ouvrez cette adresse dans votre navigateur : ${url}`));
  child.unref();
}

async function main() {
  const port = Number(process.env.PORT || DEFAULT_PLAY_PORT);
  const url = `http://127.0.0.1:${port}`;
  // A second double-click reopens the existing game instead of opening its database twice.
  if (port > 0 && port <= 65535) {
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(700) });
      const health = await response.json();
      if (response.ok && health.status === 'ok' && health.game === 'deadblock') {
        if (health.version !== GAME_VERSION) {
          console.error('Une ancienne version de DEADBLOCK est encore ouverte. Fermez sa fenetre noire JOUER, puis relancez ce nouveau JOUER.bat.');
          process.exitCode = 1; return;
        }
        console.log(`DEADBLOCK est deja ouvert : ${url}`); openBrowser(url); return;
      }
    } catch { /* The usual first launch has no server yet. */ }
  }
  const game = await startLocalGame({ port });
  console.log('\nDEADBLOCK - Le refuge est pret !');
  console.log(`\nLe jeu s'ouvre dans votre navigateur : ${game.url}`);
  console.log('\nGardez cette fenetre ouverte pendant la partie.');
  console.log('Pour arreter le serveur : Ctrl+C.');
  if (game.lan.length) {
    console.log('\nPour vos amis sur le meme reseau local :');
    for (const address of game.lan) console.log(`  ${address}`);
    console.log('Ouvrez la meme adresse sur les autres appareils, puis entrez le meme code de salle.');
  }
  console.log(`\nSauvegardes : ${game.database}\n`);
  openBrowser(game.url);
  let stopping = false;
  const stop = async () => { if (stopping) return; stopping = true; await game.close(); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error.code === 'EADDRINUSE'
      ? 'Le port du jeu est deja utilise par une autre application. Fermez cette application puis relancez JOUER.'
      : `Impossible de lancer DEADBLOCK : ${error.message}`);
    process.exitCode = 1;
  });
}
