import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-900.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import './style.css';
import './hud.css';
import { Hub } from './hub.js';
import { WEAPONS, BOSSES, MATERIALS, weaponFor } from '../shared/content.mjs';
import { GameScene } from './scene.js';
import { MAGAZINE_SIZE } from '../shared/world.mjs';

const icons = {
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
  sound: '<path d="m11 5-6 4H2v6h3l6 4V5zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4V5zm6 4 5 6m0-6-5 6"/>',
  shuffle: '<path d="M3 7h3c5 0 7 10 12 10h3m-4-4 4 4-4 4M3 17h3c2 0 3-2 5-5m3-3c2-2 2-2 4-2h3m-4-4 4 4-4 4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2m3 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8a2.5 2.5 0 0 1 5 .5c0 2-2.5 2-2.5 4M12 16v.1"/>',
  exit: '<path d="M9 4H4v16h5m6-13 5 5-5 5m-7-5h12"/>',
  reload: '<path d="M20 7v5h-5M4 17v-5h5m-4-4a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upgrade: '<path d="m5 13 7-7 7 7m-14 6 7-7 7 7"/>',
  danger: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.1"/>',
  pulse: '<path d="M2 12h5l3-7 4 14 3-7h5"/>',
  rifle: '<path d="M2 8h4V6h3v2h10v3h-5l-1 5h-3l1-5H8l-2 3H4l1-3H2zm17 1h3M11 6h3"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const brand = '<div class="brand"><span class="brand-mark">D</span>DEADBLOCK</div>';

document.querySelector('#app').innerHTML = `
  <div id="scene" aria-label="Arène 3D de survie coopérative"></div>
  <section id="landing">
    <header class="topbar"><div class="brand"><span class="brand-mark">D</span>DEADBLOCK<small>PAR GAMEMOB</small></div>
      <div class="top-actions"><div id="server-status" class="status"><i class="status-dot"></i><span>CONNEXION…</span></div><button class="icon-button sound-toggle" aria-label="Activer le son">${icon('mute')}</button></div>
    </header>
    <main class="landing-main">
      <div class="eyebrow tagline">SURVIE COOPÉRATIVE · 1 À 4 JOUEURS</div>
      <h1>DEAD<br><span>BLOCK.</span></h1>
      <p class="intro"><strong>La ville est tombée. Pas votre escouade.</strong><br>Rassemblez vos amis, repoussez les vagues.<br>Un quartier. Des centaines de raisons de courir.</p>
      <form id="join-form" class="lobby-form">
        <div class="form-top"><span class="eyebrow">VOTRE PROCHAINE MISSION</span><span class="four-player">${icon('people')} 4 MAX.</span></div>
        <div class="field-row">
          <div class="field"><label for="player-name">NOM DE CODE</label><input id="player-name" name="name" placeholder="Survivant" maxlength="16" autocomplete="nickname" required></div>
          <div class="field code-field"><label for="room-code">CODE DE SALLE</label><div class="code-wrap"><input id="room-code" name="room" maxlength="8" minlength="3" pattern="[A-Za-z0-9]{3,8}" autocomplete="off" autocapitalize="characters" spellcheck="false" required><button type="button" id="new-code" class="shuffle" aria-label="Générer un nouveau code de salle">${icon('shuffle')}</button></div></div>
        </div>
        <button id="join-button" class="primary-button" type="submit"><span>ENTRER DANS LE QUARTIER</span>${icon('arrow')}</button>
        <p class="form-hint">${icon('link')} Même code, même escouade. La salle se crée à votre arrivée.</p>
        <p id="form-error" class="error hidden" role="alert"></p>
      </form>
      <div class="quick-facts"><span><i></i>VAGUES SANS FIN</span><span><i></i>COOP EN TEMPS RÉEL</span><span><i></i>PC & MOBILE</span></div>
    </main>
    <div class="scene-label"><div class="line"></div><div><span class="eyebrow">ZONE DE DÉPLOIEMENT 01</span><strong class="condensed">LE DERNIER QUARTIER</strong><p>État : infesté &nbsp; / &nbsp; Espoir : à confirmer</p></div></div>
    <footer class="landing-footer"><span>RESTEZ ENSEMBLE. RESTEZ EN VIE.</span><div class="footer-controls"><span><kbd>ZQSD</kbd> / <kbd>WASD</kbd> DÉPLACEMENT</span><span><kbd>CLIC</kbd> TIRER</span><span><kbd>R</kbd> RECHARGER</span></div><span class="version">PROTOTYPE 0.1</span></footer>
  </section>
  <section id="hud" class="hidden" aria-label="Interface de jeu">
    <div class="hud-top"><div class="room-info">${brand}<button class="room-button" id="share-room" title="Copier le lien d’invitation"><span>SALLE</span><strong id="room-label"></strong>${icon('link')}</button></div>
      <div class="wave-panel"><div class="eyebrow" id="wave-label">PROCHAINE VAGUE</div><div class="wave-number" id="wave-number">01</div><div class="wave-sub" id="wave-sub">Déploiement…</div></div>
      <div class="hud-right"><span class="status"><i class="status-dot"></i>EN LIGNE</span><button class="icon-button sound-toggle" aria-label="Activer le son">${icon('mute')}</button><button class="icon-button help-toggle" aria-label="Afficher les commandes">${icon('help')}</button><button class="icon-button" id="leave-game" aria-label="Quitter la salle">${icon('exit')}</button></div>
    </div>
    <aside class="squad"><div class="squad-title">VOTRE ESCOUADE <span id="squad-count">1/4</span></div><div id="squad-list"></div></aside>
    <div class="wave-banner" id="wave-banner"><div class="eyebrow" id="banner-sub"></div><h2 id="banner-title"></h2></div>
    <div class="downed hidden" id="downed"><strong>VOUS ÊTES AU SOL</strong><p>Un allié peut vous relever en maintenant E.</p><div class="revive-progress"><span id="revive-fill"></span></div></div>
    <div class="hud-bottom">
      <div class="vitals"><div class="vitals-header"><span>+ VITALITÉ</span><strong><span id="health-value">100</span><small> / 100</small></strong></div><div class="health-track"><div class="health-fill" id="health-fill"></div></div><div class="vitals-footer"><span>ÉLIMINATIONS <strong id="kill-value">0</strong></span><span>CRÉDITS <strong id="credit-value">0</strong></span></div></div>
      <div class="bottom-controls"><span><kbd>R</kbd> Recharger</span><span><kbd>MAJ</kbd> Courir</span><span><kbd>E</kbd> Relever</span><span><kbd>U</kbd> Améliorer</span></div>
      <div class="weapon-panel"><button class="upgrade-button" id="upgrade-button">${icon('upgrade')}<span id="upgrade-label">AMÉLIORER · 120 CR</span></button><div class="weapon-card"><div class="weapon-name">CARABINE<strong id="weapon-level">NIVEAU 01</strong></div><div><div class="ammo"><span id="ammo-value">24</span><small>/ ∞</small></div><div class="reload-status" id="reload-status">24 PAR CHARGEUR</div></div></div></div>
    </div>
    <div class="mobile-controls"><div id="move-stick" class="touch-stick move-stick" role="group" aria-label="Joystick de déplacement"><div class="knob"></div><span class="stick-label">BOUGER</span></div><div id="aim-stick" class="touch-stick aim-stick" role="group" aria-label="Joystick de visée et de tir"><div class="knob"></div><span class="stick-label">VISER / TIRER</span></div><div class="touch-actions"><button id="touch-revive" aria-label="Maintenir pour relever un allié">${icon('plus')}</button><button id="touch-reload" aria-label="Recharger">${icon('reload')}</button></div></div>
  </section>
  <div id="crosshair" class="crosshair hidden"></div><div id="damage-flash" class="damage-flash"></div>
  <div id="toast" class="toast hidden" role="status" aria-live="polite"></div>
  <div id="gameover" class="overlay hidden"><section class="modal"><div class="eyebrow">TRANSMISSION INTERROMPUE</div><h2>L’ESCOUADE<br>EST TOMBÉE.</h2><p>Le quartier n’a pas dit son dernier mot. Vous non plus.</p><div class="result-grid"><div><span class="stat-value" id="result-wave">0</span><small>VAGUE ATTEINTE</small></div><div><span class="stat-value" id="result-kills">0</span><small>ÉLIMINATIONS</small></div><div><span class="stat-value" id="result-time">0:00</span><small>TEMPS SURVÉCU</small></div></div><button class="primary-button" id="restart-game">REDÉPLOYER L’ESCOUADE ${icon('reload')}</button><button class="secondary-button" id="back-home">Retour à l’accueil</button></section></div>
  <div id="help" class="overlay hidden"><section class="modal"><div class="eyebrow">BRIEFING DE MISSION</div><h2>VEILLEZ LES UNS<br>SUR LES AUTRES.</h2><p>Survivez ensemble. Ramassez les trousses de soin et améliorez votre carabine avec les crédits gagnés. Les munitions de réserve sont illimitées.</p><div class="help-row"><span>Se déplacer</span><span><kbd>WASD</kbd><kbd>ZQSD</kbd><kbd>↑↓←→</kbd></span></div><div class="help-row"><span>Viser / tirer</span><span><kbd>SOURIS</kbd><kbd>CLIC</kbd></span></div><div class="help-row"><span>Recharger / courir</span><span><kbd>R</kbd><kbd>MAJ</kbd></span></div><div class="help-row"><span>Relever un allié à proximité</span><span><kbd>E maintenu</kbd></span></div><div class="help-row"><span>Améliorer la carabine</span><span><kbd>U</kbd></span></div><p>Sur mobile : joystick gauche pour bouger, droit pour viser et tirer. Maintenez + près d’un allié pour le relever. La partie continue pendant ce briefing.</p><button class="primary-button" id="close-help">COMPRIS. ON Y VA.</button></section></div>
  <div id="connection-error" class="overlay connection-error hidden"><section class="modal"><div class="eyebrow">SIGNAL PERDU</div><h2>CONNEXION<br>INTERROMPUE.</h2><p>Le serveur ne répond plus. Vous pouvez rejoindre à nouveau la salle ; votre personnage sera réinitialisé.</p><button class="primary-button" id="reconnect">REJOINDRE LA SALLE</button><button class="secondary-button" id="disconnect-home">Retour à l’accueil</button></section></div>
`;

const $ = selector => document.querySelector(selector);
// Keep combat information in the upper corners, leaving the street and touch controls clear.
const vitals = $('.vitals');
const vitalsBody = document.createElement('div'); vitalsBody.className = 'vitals-body';
vitalsBody.append(...vitals.childNodes); vitals.append(vitalsBody);
const portrait = document.createElement('div'); portrait.className = 'combat-portrait';
portrait.innerHTML = '<svg viewBox="0 0 64 70" aria-hidden="true"><path fill="#27313f" d="M0 0h64v70H0z"/><path fill="#48689b" d="m8 70 4-19h40l6 19z"/><path fill="#d9b68d" d="M10 12h44v40L44 61H23L10 50z"/><path fill="#704625" d="M7 9 17 0h29l12 11v19l-8-6-3-10-8 7-9-8-11 10-8 11z"/><path stroke="#4c3529" stroke-width="4" d="m16 33 13 3m8 0 13-4"/><path fill="#f0e9d8" d="M18 38h11v6H18zm19 0h11v6H37z"/><path fill="#293039" d="M24 38h4v6h-4zm14 0h4v6h-4z"/><path fill="#664c3f" d="M25 51h17v5H25z"/></svg><span id="profile-level">NV. 1</span>';
vitals.prepend(portrait);
$('.hud-top').append(vitals, $('.weapon-panel'));
$('.vitals-header > span').innerHTML = '<span id="profile-name">SURVIVANT</span>';
const cameraTip = document.createElement('div'); cameraTip.className = 'camera-tip';
cameraTip.textContent = 'CLIC DROIT + GLISSER : CAMÉRA'; $('#hud').append(cameraTip);
const cameraHelp = document.createElement('div'); cameraHelp.className = 'help-row';
cameraHelp.innerHTML = '<span>Tourner la caméra</span><span><kbd>CLIC DROIT + GLISSER</kbd></span>';
$('#close-help').before(cameraHelp);
const mobileHelp = $('#help .modal p:last-of-type');
mobileHelp.textContent = 'Sur mobile : joystick gauche pour bouger, droit pour viser et tirer. Glissez un doigt sur le décor pour tourner la caméra. Maintenez + près d’un allié pour le relever. La partie continue pendant ce briefing.';

const vitalKicker = document.createElement('div'); vitalKicker.className = 'panel-kicker';
vitalKicker.innerHTML = `${icon('pulse')} <span>SIGNAUX VITAUX</span><strong id="condition-label">STABLE</strong>`;
vitalsBody.prepend(vitalKicker);
$('.health-track').setAttribute('role', 'progressbar');
$('.health-track').setAttribute('aria-label', 'Santé');
$('.health-track').setAttribute('aria-valuemin', '0');
$('.health-track').setAttribute('aria-valuemax', '100');
const waveLabel = $('#wave-label');
const waveHeading = document.createElement('div'); waveHeading.className = 'wave-heading';
waveHeading.innerHTML = icon('danger'); waveLabel.before(waveHeading); waveHeading.append(waveLabel);
const survivalTime = document.createElement('div'); survivalTime.className = 'survival-time';
survivalTime.innerHTML = '<span>SURVIE</span><time id="survival-clock">00:00</time>';
$('.wave-panel').append(survivalTime);
$('.weapon-card').innerHTML = `
  <div class="panel-kicker"><span>ARMEMENT / 01</span><strong id="ammo-state">PRÊT</strong></div>
  <div class="weapon-loadout"><div class="weapon-name">${icon('rifle')}<span>CARABINE</span><strong id="weapon-level">NIVEAU 01</strong></div><div class="ammo"><span id="ammo-value">24</span><small>/ ∞</small></div></div>
  <div class="magazine" aria-hidden="true">${Array.from({ length: MAGAZINE_SIZE }, () => '<i></i>').join('')}</div>
  <div class="reload-track" aria-hidden="true"><span></span></div>
  <div class="reload-status" id="reload-status">24 PAR CHARGEUR</div>`;
let bullets = [...document.querySelectorAll('.magazine i')];
$('.squad-title').innerHTML = `<span>${icon('people')} SURVIVANTS</span><span id="squad-count">1/4</span>`;
const fieldStatus = document.createElement('div'); fieldStatus.className = 'field-status'; fieldStatus.dataset.mode = 'quiet';
fieldStatus.innerHTML = `${icon('danger')}<div><strong id="field-title">RESTEZ VIGILANT</strong><span id="field-detail">Surveillez les accès au quartier.</span></div>`;
$('#hud').append(fieldStatus);

const bossHealth = document.createElement('div'); bossHealth.id = 'boss-health'; bossHealth.className = 'boss-health hidden';
bossHealth.setAttribute('role', 'progressbar'); bossHealth.setAttribute('aria-label', 'Santé du boss'); bossHealth.setAttribute('aria-valuemin', '0');
bossHealth.innerHTML = '<div><span id="boss-phase"></span><b id="boss-hp"></b></div><strong id="boss-name"></strong><div class="boss-track"><span id="boss-fill"></span></div>';
$('#hud').append(bossHealth);
const consumables = document.createElement('div'); consumables.className = 'consumables';
consumables.innerHTML = '<button id="use-medkit" aria-label="Utiliser une trousse de secours"><span>+</span><b id="medkit-count">1</b><small>F · SOIN</small></button><button id="use-grenade" aria-label="Lancer une grenade"><span>◉</span><b id="grenade-count">2</b><small>G · GRENADE</small></button>';
$('#hud').append(consumables);
const lootSummary = document.createElement('p'); lootSummary.id = 'run-loot'; $('#restart-game').before(lootSummary);
$('#back-home').textContent = 'Retour au refuge · boutique et atelier';
const itemHelp = document.createElement('div'); itemHelp.className = 'help-row'; itemHelp.innerHTML = '<span>Soin / grenade</span><span><kbd>F</kbd><kbd>G</kbd></span>'; $('#close-help').before(itemHelp);
$('#help .modal > p').textContent = 'Survivez ensemble. Sortez des marques au sol avant les attaques des boss. F pour vous soigner, G pour une grenade. U améliore votre arme pour cette sortie en dépensant vos crédits permanents. Réserve de munitions illimitée.';

const text = (selector, value) => { const el = $(selector); const next = String(value); if (el.textContent !== next) el.textContent = next; };
const show = (selector, visible = true) => $(selector).classList.toggle('hidden', !visible);
const getStored = key => { try { return localStorage.getItem(key); } catch { return null; } };
const setStored = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ } };
const roomCode = () => [...crypto.getRandomValues(new Uint8Array(5))].map(n => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 31]).join('');
const requestedRoom = new URLSearchParams(location.search).get('room');
$('#room-code').value = requestedRoom && /^[a-z0-9]{3,8}$/i.test(requestedRoom) ? requestedRoom.toUpperCase() : roomCode();
$('#player-name').value = getStored('deadblock-name') || 'Survivant';

let scene;
try { scene = new GameScene($('#scene')); }
catch (error) {
  console.error(error);
  text('#form-error', 'La 3D nécessite WebGL. Activez l’accélération graphique ou utilisez un navigateur récent.');
  show('#form-error'); $('#join-button').disabled = true;
}

const hub = new Hub(scene);

let socket = null, playerId = null, state = null, lastRoom = '', lastName = '';
let mouse = { x: innerWidth / 2, y: innerHeight / 2, active: false, fire: false };
let orbitPointer = null, orbitX = 0;
const keys = new Set();
const touch = { x: 0, y: 0, aimX: 0, aimY: 0, fire: false, interact: false };
let touchMode = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch-device', touchMode);
let aim = Math.PI;
let toastTimer, bannerTimer, damageTimer, lastStateAt = 0;
const squadElements = new Map();

class Sound {
  constructor() { this.muted = getStored('deadblock-sound') !== 'on'; this.ctx = null; this.lastShot = 0; }
  activate() {
    if (this.muted) return;
    try {
      this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      this.ctx.resume().catch(() => {});
    } catch { this.muted = true; }
  }
  tone(frequency, length, volume = 0.04, kind = 'triangle', end = frequency / 2) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = kind; osc.frequency.setValueAtTime(frequency, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + length);
    gain.gain.setValueAtTime(volume, t); gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    osc.connect(gain); gain.connect(this.ctx.destination); osc.start(t); osc.stop(t + length);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }
  event(event) {
    if (event.type === 'shot') {
      if (performance.now() - this.lastShot < 45) return;
      this.lastShot = performance.now(); this.tone(160, 0.065, event.player === playerId ? 0.035 : 0.01, 'sawtooth', 45);
    } else if (event.type === 'hurt' && event.id === playerId) this.tone(90, 0.2, 0.05, 'sine', 35);
    else if (event.type === 'wave') this.tone(180, 0.5, 0.04, 'triangle', 280);
    else if (event.type === 'heal' && event.id === playerId) this.tone(440, 0.25, 0.04, 'sine', 660);
    else if (event.type === 'upgrade' && event.id === playerId) this.tone(330, 0.3, 0.04, 'triangle', 880);
  }
}
const sound = new Sound();
function updateSoundButtons() {
  document.querySelectorAll('.sound-toggle').forEach(button => {
    button.innerHTML = icon(sound.muted ? 'mute' : 'sound');
    button.setAttribute('aria-label', sound.muted ? 'Activer le son' : 'Couper le son');
    button.setAttribute('aria-pressed', String(!sound.muted));
  });
}
document.querySelectorAll('.sound-toggle').forEach(button => button.addEventListener('click', () => {
  sound.muted = !sound.muted; setStored('deadblock-sound', sound.muted ? 'off' : 'on'); sound.activate(); updateSoundButtons();
}));
updateSoundButtons();

function notify(message) {
  clearTimeout(toastTimer); text('#toast', message); show('#toast');
  toastTimer = setTimeout(() => show('#toast', false), 3500);
}
function banner(title, subtitle) {
  clearTimeout(bannerTimer); text('#banner-title', title); text('#banner-sub', subtitle);
  $('#wave-banner').classList.add('show'); bannerTimer = setTimeout(() => $('#wave-banner').classList.remove('show'), 2400);
}
function action(name) {
  if (socket?.readyState === WebSocket.OPEN && playerId) socket.send(JSON.stringify({ type: 'action', action: name }));
}
function resetControls() {
  keys.clear(); mouse.fire = false; orbitPointer = null;
  Object.assign(touch, { x: 0, y: 0, aimX: 0, aimY: 0, fire: false, interact: false });
  document.querySelectorAll('.knob').forEach(el => { el.style.transform = ''; });
}

function quit() {
  const local = state?.players.find(p => p.id === playerId);
  if (local) hub.lastRun = { kills: local.kills, bosses: local.bossKills, loot: local.loot, victory: state.phase === 'victory' };
  const previous = socket; socket = null; previous?.close();
  playerId = null; state = null; resetControls(); scene?.setPlayer(null);
  show('#landing'); show('#hud', false); show('#crosshair', false);
  for (const overlay of ['#help', '#gameover', '#connection-error', '#downed']) show(overlay, false);
  document.body.classList.remove('playing', 'critical-health');
  $('#join-button').disabled = !scene; text('#join-button span', 'ENTRER DANS LE QUARTIER');
  $('#wave-banner').classList.remove('show');
  squadElements.clear(); $('#squad-list').replaceChildren();
  hub.render(); hub.ready = hub.load(); scene?.configureDistrict(hub.settings.district);
}

async function connect(name, code) {
  if (!scene) return;
  if (!await hub.ready || !hub.token) { text('#form-error', 'Le profil doit être chargé avant le départ. Utilisez Réessayer dans le refuge.'); show('#form-error'); return; }
  const previous = socket; socket = null; previous?.close();
  resetControls(); show('#form-error', false); show('#connection-error', false);
  $('#join-button').disabled = true; text('#join-button span', 'CONNEXION À L’ESCOUADE…');
  lastName = name; lastRoom = code; setStored('deadblock-name', name);
  sound.activate();
  const connection = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`);
  socket = connection;
  let joined = false;
  const timeout = setTimeout(() => { if (!joined && socket === connection) { connection.close(); } }, 10000);
  connection.addEventListener('open', () => connection.send(JSON.stringify({ type: 'join', name, code, token: hub.token, settings: hub.settings })));
  connection.addEventListener('message', event => {
    if (socket !== connection) return;
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === 'error') {
      clearTimeout(timeout); socket = null; connection.close();
      if (playerId) quit();
      text('#form-error', message.message); show('#form-error');
      $('#join-button').disabled = false; text('#join-button span', 'ENTRER DANS LE QUARTIER');
    } else if (message.type === 'welcome') {
      clearTimeout(timeout); joined = true; playerId = message.id; state = null;
      aim = Math.PI; mouse.active = false; mouse.fire = false;
      scene.configureDistrict(message.settings?.district); hub.update(message.profile); scene.setPlayer(playerId); lastStateAt = performance.now();
      show('#landing', false); show('#hud'); show('#crosshair', !touchMode); show('#gameover', false);
      text('#room-label', message.code); document.body.classList.add('playing');
      notify('Escouade déployée. Partagez le code ' + message.code + ' avec vos amis.');
    } else if (message.type === 'profile') { hub.update(message.profile);
    } else if (message.type === 'state' && joined) {
      state = message; lastStateAt = performance.now(); scene.applyState(state); updateHUD();
      for (const e of state.events) {
        sound.event(e);
        if (e.type === 'wave') banner('VAGUE ' + String(e.wave).padStart(2, '0'), 'TENEZ LE QUARTIER');
        else if (e.type === 'boss') banner(BOSSES[e.boss].name.toUpperCase(), 'MENACE MAJEURE · ÉVITEZ LES MARQUES AU SOL');
        else if (e.type === 'enrage') notify(BOSSES[e.boss].name + ' entre en rage. Des renforts arrivent !');
        else if (e.type === 'boss_loot') notify('Butin sauvegardé : ' + MATERIALS[BOSSES[e.boss].material].name + ' + matériaux pour toute l’escouade.');
        else if (e.type === 'loot' && e.id === playerId) notify('Composants récupérés et sauvegardés.');
        else if (e.type === 'cache') notify('Caisse récupérée : +50 crédits et matériaux pour tous.');
        else if (e.type === 'clear') banner('QUARTIER NETTOYÉ', '+40 CRÉDITS · RÉAPPROVISIONNEMENT');
        else if (e.type === 'join' && e.name !== lastName) notify(e.name + ' rejoint l’escouade.');
        else if (e.type === 'revive') notify(e.name + ' est de retour !');
        else if (e.type === 'upgrade' && e.id === playerId) notify('Arme améliorée pour cette sortie : dégâts et cadence augmentés.');
        else if (e.type === 'hurt' && e.id === playerId) {
          clearTimeout(damageTimer); $('#damage-flash').classList.add('active');
          damageTimer = setTimeout(() => $('#damage-flash').classList.remove('active'), 170);
        }
      }
    }
  });
  connection.addEventListener('close', () => {
    clearTimeout(timeout);
    if (socket !== connection) return;
    socket = null; resetControls();
    if (joined || playerId) { show('#help', false); show('#gameover', false); show('#connection-error'); }
    else {
      text('#form-error', 'Connexion impossible. Vérifiez que le serveur est démarré, puis réessayez.');
      show('#form-error'); $('#join-button').disabled = false; text('#join-button span', 'ENTRER DANS LE QUARTIER');
    }
  });
  connection.addEventListener('error', () => {});
}

function updateHUD() {
  const p = state.players.find(player => player.id === playerId); if (!p) return;
  const preparing = state.phase === 'breather';
  text('#wave-label', preparing ? 'PROCHAINE VAGUE' : 'VAGUE EN COURS');
  text('#wave-number', String(state.wave + (preparing ? 1 : 0)).padStart(2, '0'));
  text('#wave-sub', state.phase === 'over' ? 'Escouade à terre' : preparing ? `Arrivée dans ${Math.max(0, Math.ceil(state.timer))} s` : `${state.remaining} menace${state.remaining > 1 ? 's' : ''} restante${state.remaining > 1 ? 's' : ''}`);
  text('#health-value', Math.ceil(p.hp)); $('#health-fill').style.width = p.hp + '%';
  $('.health-track').setAttribute('aria-valuenow', String(Math.ceil(p.hp)));
  const critical = p.hp > 0 && p.hp <= 30 && state.phase !== 'over';
  document.body.classList.toggle('critical-health', critical);
  vitals.dataset.condition = p.hp <= 0 ? 'down' : critical ? 'critical' : p.hp <= 60 ? 'wounded' : 'stable';
  text('#condition-label', p.hp <= 0 ? 'À TERRE' : critical ? 'CRITIQUE' : p.hp <= 60 ? 'BLESSÉ' : 'STABLE');
  $('.wave-panel').dataset.phase = state.phase;
  text('#survival-clock', `${String(Math.floor(state.elapsed / 60)).padStart(2, '0')}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`);
  text('#profile-name', p.name.toUpperCase()); text('#profile-level', 'NV. ' + p.level);
  text('#kill-value', p.kills); text('#credit-value', p.credits); text('#ammo-value', String(p.ammo).padStart(2, '0'));
  text('#weapon-level', 'NIVEAU ' + String(p.level).padStart(2, '0'));
  text('.weapon-name > span', weaponFor(p.weapon).name.toUpperCase());
  text('#reload-status', p.reload > 0 ? `RECHARGE · ${p.reload.toFixed(1)} s` : `${p.magazine} PAR CHARGEUR`);
  if (bullets.length !== p.magazine) { $('.magazine').innerHTML = '<i></i>'.repeat(p.magazine); bullets = [...document.querySelectorAll('.magazine i')]; }
  $('.magazine').style.gridTemplateColumns = `repeat(${p.magazine},1fr)`;
  text('#medkit-count', p.medkits); text('#grenade-count', p.grenades);
  $('#use-medkit').disabled = p.medkits < 1 || p.hp <= 0 || p.hp >= 100;
  $('#use-grenade').disabled = p.grenades < 1 || p.hp <= 0;
  const boss = state.zombies.find(z => z.boss && z.hp > 0);
  show('#boss-health', !!boss);
  if (boss) {
    const spec = BOSSES[boss.kind]; text('#boss-name', spec.name); text('#boss-phase', boss.enraged ? 'EN RAGE · RENFORTS EN APPROCHE' : spec.attack);
    text('#boss-hp', `${Math.ceil(boss.hp)} / ${boss.maxHp}`);
    $('#boss-fill').style.width = `${boss.hp / boss.maxHp * 100}%`; $('#boss-health').style.setProperty('--boss-color', spec.color);
    $('#boss-health').setAttribute('aria-valuenow', String(Math.ceil(boss.hp))); $('#boss-health').setAttribute('aria-valuemax', String(boss.maxHp));
  }
  $('.weapon-panel').dataset.loading = String(p.reload > 0);
  $('.weapon-panel').dataset.low = String(p.ammo <= 6 && p.reload <= 0);
  $('.reload-track span').style.width = `${p.reload > 0 ? Math.min(100, Math.max(0, (1 - p.reload / p.reloadDuration) * 100)) : 0}%`;
  text('#ammo-state', p.hp <= 0 ? 'À TERRE' : p.reload > 0 ? 'RECHARGE' : p.ammo <= 6 ? 'PRESQUE VIDE' : 'PRÊT');
  bullets.forEach((bullet, index) => bullet.classList.toggle('spent', index >= p.ammo));
  $('#upgrade-button').disabled = p.hp <= 0 || p.level >= 5 || p.credits < p.level * 120;
  text('#upgrade-label', p.level >= 5 ? 'ARME AU MAXIMUM' : `AMÉLIORER · ${p.level * 120} CR`);
  show('#downed', p.hp <= 0 && state.phase !== 'over'); $('#revive-fill').style.width = (p.revive / 2.5 * 100) + '%';
  text('#squad-count', `${state.players.length}/4`);
  const nearby = state.zombies.filter(enemy => Math.hypot(enemy.x - p.x, enemy.z - p.z) < 7).length;
  const fallen = state.players.find(ally => ally.id !== p.id && ally.hp <= 0 && Math.hypot(ally.x - p.x, ally.z - p.z) < 2.6);
  const fieldMode = p.hp <= 0 || state.phase === 'over' ? 'hidden' : fallen ? 'revive' : critical ? 'critical' : nearby ? 'danger' : 'quiet';
  fieldStatus.dataset.mode = fieldMode;
  text('#field-title', fallen ? 'UN ALLIÉ A BESOIN DE VOUS' : critical ? 'BLESSURES CRITIQUES' : nearby ? `${nearby} INFECTÉ${nearby > 1 ? 'S' : ''} À PROXIMITÉ` : preparing ? 'RÉPIT — PRÉPAREZ-VOUS' : 'RESTEZ VIGILANT');
  text('#field-detail', fallen ? `${touchMode ? '+ maintenu' : 'E maintenu'} pour relever ${fallen.name}.` : critical ? 'Éloignez-vous et trouvez des soins.' : nearby ? 'Gardez vos distances. Restez ensemble.' : preparing ? 'Rechargez et améliorez votre arme.' : 'Surveillez les accès au quartier.');
  for (const [id, el] of squadElements) if (!state.players.some(player => player.id === id)) { el.remove(); squadElements.delete(id); }
  for (const player of state.players) {
    let el = squadElements.get(player.id);
    if (!el) {
      el = document.createElement('div'); el.className = 'squad-player';
      el.innerHTML = '<div class="squad-icon"></div><div class="squad-details"><div class="squad-name"><span></span><small></small></div><div class="tiny-health"><span></span></div></div><span class="squad-kills"></span>';
      squadElements.set(player.id, el); $('#squad-list').append(el);
    }
    el.style.setProperty('--player-color', player.color);
    el.dataset.downed = String(player.hp <= 0);
    el.querySelector('.squad-icon').textContent = player.hp <= 0 ? '+' : String(player.slot + 1).padStart(2, '0');
    el.querySelector('.squad-name span').textContent = player.name;
    el.querySelector('.squad-name small').textContent = player.id === playerId ? 'VOUS' : '';
    el.querySelector('.tiny-health span').style.width = player.hp + '%';
    el.querySelector('.squad-kills').textContent = player.kills;
  }
  show('#gameover', ['over', 'victory'].includes(state.phase));
  if (['over', 'victory'].includes(state.phase)) {
    show('#help', false);
    text('#gameover .eyebrow', state.phase === 'victory' ? 'CHASSE TERMINÉE' : 'TRANSMISSION INTERROMPUE');
    text('#gameover h2', state.phase === 'victory' ? 'CIBLE NEUTRALISÉE.' : 'L’ESCOUADE EST TOMBÉE.');
    text('#gameover .modal > p', 'Les crédits et composants gagnés sont conservés. Retrouvez-les au refuge.');
    text('#run-loot', Object.entries(p.loot || {}).map(([id, count]) => `${count} ${MATERIALS[id].name}`).join(' · ') || 'Aucun composant récupéré sur cette sortie.');
    text('#result-wave', state.wave); text('#result-kills', state.teamKills);
    text('#result-time', `${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`);
  }
}

$('#join-form').addEventListener('submit', event => {
  event.preventDefault(); connect($('#player-name').value.trim() || 'Survivant', $('#room-code').value.trim().toUpperCase());
});
$('#new-code').addEventListener('click', () => { $('#room-code').value = roomCode(); });
$('#leave-game').addEventListener('click', quit);
$('#back-home').addEventListener('click', quit);
$('#disconnect-home').addEventListener('click', quit);
$('#restart-game').addEventListener('click', () => action('restart'));
$('#reconnect').addEventListener('click', () => connect(lastName, lastRoom));
$('#upgrade-button').addEventListener('click', () => action('upgrade'));
$('#use-medkit').addEventListener('click', () => action('medkit'));
$('#use-grenade').addEventListener('click', () => action('grenade'));
$('#touch-reload').addEventListener('click', () => action('reload'));
$('.help-toggle').addEventListener('click', () => { resetControls(); show('#help'); });
$('#close-help').addEventListener('click', () => show('#help', false));
$('#share-room').addEventListener('click', async () => {
  const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('room', lastRoom);
  try { await navigator.clipboard.writeText(url.toString()); notify('Lien copié ! Envoyez-le à votre escouade.'); }
  catch { notify('Code de salle : ' + lastRoom + '. Vos amis doivent ouvrir la même adresse puis saisir ce code.'); }
});

function screenToWorld(x, y) { return scene.movement(x, y); }
function blockedByOverlay() { return !$('#help').classList.contains('hidden') || !$('#gameover').classList.contains('hidden') || !$('#connection-error').classList.contains('hidden'); }
function getInput() {
  if (!playerId || blockedByOverlay()) return { x: 0, z: 0, aim, fire: false, interact: false };
  let x = touch.x, y = touch.y;
  if (keys.has('KeyA') || keys.has('KeyQ') || keys.has('ArrowLeft')) x--;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x++;
  if (keys.has('KeyW') || keys.has('KeyZ') || keys.has('ArrowUp')) y--;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y++;
  const length = Math.max(1, Math.hypot(x, y)); const world = screenToWorld(x / length, y / length);
  const p = state?.players.find(player => player.id === playerId);
  if (touch.fire) { const v = screenToWorld(touch.aimX, touch.aimY); aim = Math.atan2(v.x, v.z); }
  else if (mouse.active && p) {
    const point = scene.aimAt(mouse.x, mouse.y); if (point) aim = Math.atan2(point.x - p.x, point.z - p.z);
  }
  return { ...world, aim, fire: mouse.fire || touch.fire, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'), interact: keys.has('KeyE') || touch.interact };
}

window.addEventListener('keydown', event => {
  if (!playerId || /INPUT|TEXTAREA/.test(event.target.tagName)) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (!event.repeat) {
    if (event.code === 'Escape' || event.code === 'KeyH') { resetControls(); show('#help', $('#help').classList.contains('hidden')); }
    if (event.code === 'KeyR' && !blockedByOverlay()) action('reload');
    if (event.code === 'KeyU' && !blockedByOverlay()) action('upgrade');
    if (event.code === 'KeyF' && !blockedByOverlay()) action('medkit');
    if (event.code === 'KeyG' && !blockedByOverlay()) action('grenade');
  }
});
window.addEventListener('keyup', event => keys.delete(event.code));
window.addEventListener('blur', resetControls);
document.addEventListener('visibilitychange', () => { if (document.hidden) resetControls(); });
window.addEventListener('pointermove', event => {
  if (event.pointerId === orbitPointer) {
    scene.orbit(event.clientX - orbitX); orbitX = event.clientX;
    // Keep the character facing into the view while the camera is dragged.
    aim = Math.atan2(-Math.sin(scene.cameraYaw), -Math.cos(scene.cameraYaw));
    mouse.active = false;
    return;
  }
  if (event.pointerType !== 'mouse') return;
  mouse.x = event.clientX; mouse.y = event.clientY; mouse.active = true;
  $('#crosshair').style.left = mouse.x + 'px'; $('#crosshair').style.top = mouse.y + 'px';
});
$('#scene').addEventListener('pointerdown', event => {
  if (!playerId || blockedByOverlay()) return;
  if (event.button === 2 || event.pointerType === 'touch') {
    event.preventDefault();
    if (orbitPointer !== null) return;
    orbitPointer = event.pointerId; orbitX = event.clientX;
    $('#scene').setPointerCapture(event.pointerId);
    mouse.fire = false; mouse.active = false;
    return;
  }
  if (playerId && event.pointerType === 'mouse' && event.button === 0 && !blockedByOverlay()) { mouse.fire = true; sound.activate(); }
});
window.addEventListener('pointerup', event => {
  if (event.pointerType === 'mouse' && event.button === 0) mouse.fire = false;
  if (event.pointerId === orbitPointer) orbitPointer = null;
});
$('#scene').addEventListener('lostpointercapture', event => { if (event.pointerId === orbitPointer) orbitPointer = null; });
window.addEventListener('pointercancel', resetControls);
$('#scene').addEventListener('contextmenu', event => event.preventDefault());

function joystick(selector, aiming) {
  const element = $(selector), knob = element.querySelector('.knob');
  let pointer = null;
  function update(event) {
    const rect = element.getBoundingClientRect();
    let dx = event.clientX - rect.left - rect.width / 2, dy = event.clientY - rect.top - rect.height / 2;
    const max = rect.width * 0.3, distance = Math.hypot(dx, dy);
    if (distance > max) { dx *= max / distance; dy *= max / distance; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    if (aiming) { touch.aimX = dx / max; touch.aimY = dy / max; touch.fire = distance > max * 0.17; }
    else { touch.x = dx / max; touch.y = dy / max; }
  }
  element.addEventListener('pointerdown', event => {
    event.preventDefault(); if (pointer !== null) return;
    pointer = event.pointerId; element.setPointerCapture(pointer); update(event); sound.activate();
  });
  element.addEventListener('pointermove', event => { if (event.pointerId === pointer) { event.preventDefault(); update(event); } });
  const release = event => {
    if (event.pointerId !== pointer) return; pointer = null; knob.style.transform = '';
    if (aiming) { touch.fire = false; touch.aimX = 0; touch.aimY = 0; } else { touch.x = 0; touch.y = 0; }
  };
  element.addEventListener('pointerup', release); element.addEventListener('pointercancel', release); element.addEventListener('lostpointercapture', release);
}
joystick('#move-stick', false); joystick('#aim-stick', true);
$('#touch-revive').addEventListener('pointerdown', event => {
  event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); touch.interact = true;
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('#touch-revive').addEventListener(event, () => { touch.interact = false; });

setInterval(() => {
  if (!playerId || socket?.readyState !== WebSocket.OPEN) return;
  if (performance.now() - lastStateAt > 8000) { socket.close(); return; }
  if (socket.bufferedAmount < 16 * 1024) socket.send(JSON.stringify({ type: 'input', ...getInput() }));
}, 50);

let previous = performance.now();
function animate(now) {
  const dt = Math.min((now - previous) / 1000, 0.05); previous = now;
  if (scene) { getInput(); scene.render(dt, aim); }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

async function checkHealth() {
  let retrySoon = false;
  try {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(8000) });
    const data = await response.json(); if (!response.ok || data.status !== 'ok') throw new Error('offline');
    text('#server-status span', 'SERVEUR OPÉRATIONNEL'); $('#server-status').classList.remove('offline');
  } catch { text('#server-status span', 'SERVEUR HORS LIGNE'); $('#server-status').classList.add('offline'); retrySoon = true; }
  setTimeout(checkHealth, retrySoon ? 4000 : 30000);
}
checkHealth();
