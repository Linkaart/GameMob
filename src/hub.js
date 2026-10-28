import { WEAPONS, MATERIALS, SHOP_ITEMS, BOSSES, DISTRICTS, ENEMIES, CONTRACTS, MISSIONS, missionFor, missionUnlocked, canCraft, weaponFor } from '../shared/content.mjs';
import './hub.css';
import { loadWeaponAssets } from './weapon-assets.js';
import { worldFor } from '../shared/world.mjs';
import './campaign.css';
import { loadBossAssets } from './boss-models.js';
import { CRATES } from './props.js';
import { propArt, PropInspector, refreshWeaponThumbnails } from './prop-viewer.js';

const tabs = [['home', '01', 'Refuge'], ['shop', '02', 'Boutique'], ['craft', '03', 'Atelier'], ['arsenal', '04', 'Arsenal'], ['contracts', '05', 'Contrats'], ['bestiary', '06', 'Bestiaire'], ['campaign', '07', 'Campagne']];
const safeRead = key => { try { return localStorage.getItem(key); } catch { return null; } };
export function weaponArt(id) { return propArt('weapon', id, weaponFor(id).name); }

const materials = (recipe, profile, costs = false) => Object.entries(recipe).map(([id, count]) => `<span class="material-chip ${costs && (profile?.materials[id] || 0) < count ? 'missing' : ''}" title="${MATERIALS[id].name}" style="--item-color:${MATERIALS[id].color}"><i>${MATERIALS[id].short}</i>${costs ? `${profile?.materials[id] || 0} / ` : ''}${count}</span>`).join('');
const bossArt = id => propArt('boss', id, BOSSES[id].name, 'boss-portrait');

export class Hub {
  constructor(scene) {
    this.scene = scene; this.inspector = new PropInspector(open => { if (this.scene) this.scene.inspectionOpen = open; }); this.profile = null; this.token = safeRead('deadblock-token'); this.tab = 'home'; this.busy = false;
    this.settings = { district: 'quarantine', mode: 'survival', boss: 'brute' };
    const landing = document.querySelector('#landing'), form = document.querySelector('#join-form'), status = document.querySelector('#server-status'), sound = document.querySelector('.sound-toggle');
    landing.innerHTML = `<header class="hub-header"><a class="hub-logo" href="/" aria-label="Deadblock, accueil"><span>D</span>DEADBLOCK<small>LE REFUGE</small></a><div class="hub-account"><span class="hub-rank">SURVIVANT <b id="rank-value">01</b></span><strong class="hub-wallet"><i>◈</i><span id="wallet-value">—</span><small>CRÉDITS</small></strong><div id="hub-connection"></div></div></header>
      <div class="hub-layout"><nav class="hub-nav" aria-label="Navigation du refuge">${tabs.map(([id, n, name]) => `<button type="button" data-tab="${id}" ${id === 'home' ? 'aria-current="page"' : ''}><span>${n}</span>${name}<i>›</i></button>`).join('')}<div class="nav-foot"><span class="live-dot"></span> REFUGE OPÉRATIONNEL<small>SECTEUR 07 / DERNIER SIGNAL</small></div></nav>
      <main class="hub-main"><div id="hub-message" role="status" aria-live="polite"></div><div id="hub-loading">Connexion au refuge…</div><div id="hub-content"></div><div id="deployment-dock"></div></main></div>
      <footer class="hub-footer"><span>NE SURVIVEZ PAS SEUL.</span><span>COOPÉRATION 1–4 JOUEURS <i>•</i> PC & MOBILE</span><span>DEADBLOCK / 0.6</span></footer>`;
    document.querySelector('#hub-connection').append(status, sound);
    document.querySelector('#deployment-dock').append(form);
    form.querySelector('.form-top .eyebrow').textContent = 'PRÊT POUR UNE SORTIE ?';
    form.querySelector('.form-hint').textContent = 'Même code, même escouade. Le premier arrivé choisit la mission.';
    document.querySelector('#join-button span').textContent = 'DÉPLOYER L’ESCOUADE';
    landing.addEventListener('click', event => {
      const preview = event.target.closest('[data-inspect-id]');
      if (preview) this.inspector.open(preview.dataset.inspectKind, preview.dataset.inspectId, preview);
      const tab = event.target.closest('[data-tab]');
      if (tab) { this.tab = tab.dataset.tab; this.render(); document.querySelector('.hub-main').scrollTop = 0; }
      const choice = event.target.closest('[data-setting]');
      if (choice) { this.settings[choice.dataset.setting] = choice.dataset.value; if (choice.dataset.setting === 'boss') this.settings.district = BOSSES[choice.dataset.value].region; this.scene?.configureDistrict(this.settings.district); this.render(); }
      const missionButton = event.target.closest('[data-mission]');
      if (missionButton && !missionButton.disabled) {
        const m = missionFor(missionButton.dataset.mission);
        this.settings = { mode: 'campaign', mission: m.id, district: m.district, boss: m.boss || m.bosses?.at(-1) || 'brute' };
        this.scene?.configureDistrict(m.district); this.tab = 'home'; this.render(); document.querySelector('#deployment-dock').scrollIntoView({ block: 'center' });
      }
      const command = event.target.closest('[data-command]');
      if (command) this.command(command.dataset.command, command.dataset.item);
      if (event.target.closest('#profile-retry')) this.ready = this.load();
    });
    this.render(); this.ready = this.load();
    loadWeaponAssets().then(() => { refreshWeaponThumbnails(); if (!this.inspector.modal.open && !document.body.classList.contains('playing')) this.render(); });
    loadBossAssets().then(() => { if (['home', 'bestiary'].includes(this.tab) && !this.inspector.modal.open) this.render(); });
  }
  async request(url, data) {
    const response = await fetch(url, { method: data ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(8000) });
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error || 'Le refuge est indisponible.'); error.status = response.status; throw error; }
    return result;
  }
  async load() {
    const loading = document.querySelector('#hub-loading'); loading.hidden = false; loading.textContent = 'Connexion au refuge…';
    try {
      let result;
      if (this.token) {
        try { result = await this.request('/api/profile'); }
        catch (error) { if (error.status !== 401) throw error; this.token = null; }
      }
      if (!this.token) { result = await this.request('/api/profiles', {}); this.token = result.token; try { localStorage.setItem('deadblock-token', this.token); } catch { this.message('Stockage du navigateur désactivé : ce profil ne sera accessible que dans cet onglet.'); } }
      this.update(result.profile); loading.hidden = true; return true;
    } catch (error) { loading.innerHTML = '<span></span><button id="profile-retry" class="secondary-button">Réessayer</button>'; loading.querySelector('span').textContent = error.message; return false; }
  }
  update(profile) {
    if (!profile) return; this.profile = profile;
    document.querySelector('#wallet-value').textContent = profile.credits.toLocaleString('fr-FR');
    document.querySelector('#rank-value').textContent = String(1 + Math.floor(profile.xp / 250)).padStart(2, '0');
    if (!document.body.classList.contains('playing')) this.render();
  }
  message(message, error = false) { const el = document.querySelector('#hub-message'); el.textContent = message; el.classList.toggle('error', error); }
  async command(action, item) {
    if (this.busy || !this.profile) return;
    this.busy = true; this.render();
    try { const data = await this.request('/api/profile/action', { action, item }); this.update(data.profile); this.message(({ buy: 'Achat ajouté à votre réserve.', craft: 'Arme fabriquée ! Équipez-la dans votre arsenal.', equip: 'Arme équipée pour votre prochaine sortie.', claim: 'Récompense du contrat récupérée.' })[action]); }
    catch (error) { this.message(error.message, true); }
    finally { this.busy = false; this.render(); }
  }
  button(action, id, label, enabled = true) { return `<button class="card-action" data-command="${action}" data-item="${id}" ${!enabled || this.busy || !this.profile ? 'disabled' : ''}>${label}<span>›</span></button>`; }
  heading(kicker, title, subtitle) { return `<div class="page-heading"><span class="hub-eyebrow">${kicker}</span><h1>${title}</h1><p>${subtitle}</p></div>`; }
  weaponCard(id, mode) {
    const w = WEAPONS[id], p = this.profile, owned = p?.owned.includes(id), equipped = p?.equipped === id;
    let action;
    if (owned) action = this.button('equip', id, equipped ? 'ÉQUIPÉE' : 'ÉQUIPER', !equipped);
    else if (w.recipe) action = this.button('craft', id, canCraft(p || { owned: [], materials: {} }, id) ? 'FABRIQUER L’ARME' : 'COMPOSANTS MANQUANTS', canCraft(p || { owned: [], materials: {} }, id));
    else action = this.button('buy', id, `ACQUÉRIR · ${w.price} CR`, (p?.credits || 0) >= w.price && w.price > 0);
    return `<article class="item-card ${w.rarity}" style="--item-color:${w.color}" data-weapon="${id}"><div class="card-top"><span>${w.recipe ? 'PLAN EXPÉRIMENTAL' : w.category}</span><b>${equipped ? 'ÉQUIPÉE' : owned ? 'ACQUISE' : w.recipe ? 'SPÉCIALE' : 'STANDARD'}</b></div>${weaponArt(id)}<div class="card-copy"><h2>${w.name}</h2><p>${w.description}</p><div class="weapon-stats"><span><b>${w.damage}${w.pellets ? ' × ' + w.pellets : ''}</b>DÉGÂTS</span><span><b>${w.magazine}</b>CHARGEUR</span><span><b>${w.range} m</b>PORTÉE</span></div>${w.recipe && !owned ? `<div class="recipe">${materials(w.recipe, p, true)}</div><p class="recipe-source">PIÈCE RARE · ${Object.keys(w.recipe).filter(k => MATERIALS[k].boss).map(k => BOSSES[MATERIALS[k].boss].name).join(', ')}</p>` : ''}${action}</div></article>`;
  }
  render() {
    document.querySelectorAll('[data-tab]').forEach(b => { if (b.dataset.tab === this.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    document.querySelector('#deployment-dock').hidden = this.tab !== 'home';
    const p = this.profile, content = document.querySelector('#hub-content');
    if (this.tab === 'home') {
      const district = DISTRICTS[this.settings.district], weapon = weaponFor(p?.equipped);
      content.innerHTML = `<div class="home-hero"><div class="hero-copy"><span class="hub-eyebrow"><i class="live-dot"></i> DERNIÈRE LIGNE DE DÉFENSE</span><h1>DEMAIN<br>N’EST PAS<br><em>PROMIS.</em></h1><p>La ville est tombée. Pas votre escouade.<br>Chassez. Récupérez. Fabriquez votre survie.</p><div class="hero-tags"><span>01—04 SURVIVANTS</span><span>PROGRESSION SAUVEGARDÉE</span></div></div><div class="hero-intel"><span class="hub-eyebrow">MENACE IDENTIFIÉE / 03</span>${bossArt(this.settings.boss)}<div><small>DOSSIER ${String(Object.keys(BOSSES).indexOf(this.settings.boss) + 1).padStart(2, '0')}</small><h2>${BOSSES[this.settings.boss].name}</h2><p>${BOSSES[this.settings.boss].title}</p><button class="intel-link" data-tab="bestiary">CONSULTER LES DOSSIERS ›</button></div></div></div>
      <button class="campaign-entry" data-tab="campaign"><span>OPÉRATION NOUVELLE AUBE <small>9 missions · 3 cartes · progression sauvegardée</small></span><b>${p?.campaign?.completed.length || 0}/9 <i>OUVRIR LA CAMPAGNE →</i></b></button>
      ${this.settings.mode === 'campaign' ? `<section class="mission-brief"><span>MISSION SÉLECTIONNÉE / CHAPITRE ${missionFor(this.settings.mission).chapter}</span><h2>${missionFor(this.settings.mission).name}</h2><p>${missionFor(this.settings.mission).briefing}</p><small>${missionFor(this.settings.mission).waves} vague(s) · extraction de l’escouade · ${missionFor(this.settings.mission).reward} CR à la première réussite</small></section>` : ''}
      <div class="section-line"><h2>CHOISIR UNE SORTIE</h2><span>RECONNAISSANCE / ${district.number}</span></div>
      <div class="district-grid">${Object.entries(DISTRICTS).map(([id, d]) => `<button class="district-card ${this.settings.district === id ? 'selected' : ''} ${id}" data-setting="district" data-value="${id}" ${this.settings.mode === 'campaign' ? 'disabled' : ''} aria-pressed="${this.settings.district === id}" style="--item-color:${d.color}"><span class="district-skyline" aria-hidden="true"></span><span class="district-number">${d.number}</span><span class="district-copy"><small>${d.subtitle}</small><strong>${d.name}</strong></span><i>${this.settings.district === id ? '✓' : '›'}</i></button>`).join('')}</div>
      <div class="mission-options"><div class="mode-picker" aria-label="Mode de mission">${[['survival','SURVIE','Vagues sans fin · boss toutes les 3 vagues'],['hunt','CHASSE','Un boss ciblé · victoire après nettoyage']].map(([id,n,d]) => `<button data-setting="mode" data-value="${id}" aria-pressed="${this.settings.mode === id}"><b>${n}</b><small>${d}</small></button>`).join('')}</div>${this.settings.mode === 'hunt' ? `<div class="boss-picker">${Object.entries(BOSSES).map(([id,b]) => `<button data-setting="boss" data-value="${id}" aria-pressed="${this.settings.boss === id}">${b.name}<small>${MATERIALS[b.material].name}</small></button>`).join('')}</div>` : ''}<div class="equipped-strip"><span>ÉQUIPEMENT</span><strong>${weapon.name}</strong><small>+ ${p?.consumables.medkit || 0} soin(s) / ${p?.consumables.grenade || 0} grenade(s)</small><button data-tab="arsenal">MODIFIER ›</button></div></div>${this.lastRun ? `<div class="last-run"><span class="hub-eyebrow">DERNIÈRE SORTIE · ${this.lastRun.victory ? 'CONTRAT REMPLI' : 'RETOUR AU REFUGE'}</span><strong>${this.lastRun.kills} éliminations · ${this.lastRun.bosses} boss</strong><div>${materials(this.lastRun.loot, p)}</div></div>` : ''}`;
    } else if (this.tab === 'campaign') {
      const done = p?.campaign?.completed || [];
      content.innerHTML = `<section class="campaign-hero"><span class="hub-eyebrow">OPÉRATION / NOUVELLE AUBE</span><h1>REPRENDRE<br><em>LA VILLE.</em></h1><p>Des premières réserves au laboratoire zéro. Neuf missions coopératives pour rendre un avenir au refuge.</p><div class="campaign-summary"><strong>${done.length}<small>/ 9 MISSIONS</small></strong><span>3 CARTES DISTINCTES<br>12 ARMES À MAÎTRISER</span><div class="campaign-progress" role="progressbar" aria-label="Campagne terminée" aria-valuenow="${done.length}" aria-valuemin="0" aria-valuemax="9"><i style="width:${done.length / 9 * 100}%"></i></div></div>${done.length === 9 ? '<p class="campaign-ending">LES DONNÉES SONT SAUVÉES. Le refuge peut préparer le remède. Rejouez les opérations ou poursuivez la survie sans fin.</p>' : ''}</section>` + [1,2,3].map(chapter => {
        const missions = MISSIONS.filter(m => m.chapter === chapter), district = DISTRICTS[missions[0].district], world = worldFor(missions[0].district);
        return `<section class="campaign-chapter"><div class="section-line"><h2>0${chapter} / ${district.name}</h2><span>${world.size} × ${world.size} M · ${district.subtitle}</span></div><div class="mission-grid">${missions.map((m,i) => {
          const unlocked = missionUnlocked(p,m.id), complete = done.includes(m.id);
          return `<article class="mission-card ${unlocked ? '' : 'locked'} ${complete ? 'complete' : ''}" style="--mission-color:${district.color}"><div class="mission-map"><svg viewBox="0 0 120 100" role="img" aria-label="Plan de ${district.name}"><path d="M60 0V100M0 50H120" stroke="currentColor" opacity=".2"/>${world.obstacles.map(o => `<rect x="${(o.x-o.w/2)/world.size*100+60}" y="${(o.z-o.d/2)/world.size*100+50}" width="${o.w/world.size*100}" height="${o.d/world.size*100}" fill="currentColor" opacity=".4"/>`).join('')}${world.stations.map(point => `<circle cx="${point.x/world.size*100+60}" cy="${point.z/world.size*100+50}" r="2" fill="currentColor"/>`).join('')}</svg><span>0${(chapter-1)*3+i+1}</span><b>${complete ? 'TERMINÉE ✓' : unlocked ? 'DISPONIBLE' : 'VERROUILLÉE'}</b></div><div class="mission-copy"><small>${({salvage:'RÉCUPÉRATION',defend:'DÉFENSE DE RELAIS',boss:'ASSAUT'})[m.goal]} · ${m.waves} VAGUE(S)</small><h2>${m.name}</h2><p>${m.briefing}</p><div class="mission-reward"><b>${complete ? Math.floor(m.reward*.35) : m.reward} CR</b><span>${complete ? 'RÉCOMPENSE DE REJEU' : 'PREMIÈRE RÉUSSITE + MATÉRIAUX'}</span></div><button class="card-action" data-mission="${m.id}" ${unlocked && p ? '' : 'disabled'}>${complete ? 'REJOUER' : unlocked ? 'PRÉPARER LA MISSION' : 'TERMINER LA PRÉCÉDENTE'} <span>›</span></button></div></article>`;
        }).join('')}</div></section>`;
      }).join('');
    } else if (this.tab === 'shop') {
      content.innerHTML = this.heading('INTENDANCE / CRÉDITS DU JEU', 'Le marché des survivants.', 'Armes fiables, soins et matériel récupéré. Chaque achat rejoint votre réserve permanente.') + `<div class="content-grid">${Object.keys(WEAPONS).filter(id => WEAPONS[id].price > 0).map(id => this.weaponCard(id, 'shop')).join('')}${Object.entries(SHOP_ITEMS).map(([id, item]) => `<article class="item-card supply" data-product="${id}" style="--item-color:${item.color}"><div class="card-top"><span>RAVITAILLEMENT</span><b>${id === 'salvage' ? 'COMPOSANTS' : 'EN STOCK : ' + (p?.consumables[id] || 0)}</b></div>${propArt(id === 'grenade' ? 'supply' : 'crate', id === 'medkit' ? 'medical' : id, item.name)}<div class="card-copy"><h2>${item.name}</h2><p>${item.description}</p>${item.materials ? `<div class="recipe">${materials(item.materials, p)}</div>` : ''}${this.button('buy',id,`ACHETER · ${item.price} CR`,(p?.credits || 0) >= item.price && (id === 'salvage' || (p?.consumables[id] || 0) < 20))}</div></article>`).join('')}</div>`;
    } else if (this.tab === 'craft') {
      content.innerHTML = this.heading('ATELIER / ARMEMENT EXPÉRIMENTAL', 'Leur chute. Votre puissance.', 'Vaincre un boss garantit son composant à toute l’escouade. Récupérez les matériaux puis fabriquez votre arme.') + `<div class="inventory-strip">${materials(p?.materials || Object.fromEntries(Object.keys(MATERIALS).map(k => [k,0])), p)}</div><div class="content-grid craft-grid">${Object.keys(WEAPONS).filter(id => WEAPONS[id].recipe).map(id => this.weaponCard(id,'craft')).join('')}</div>`;
    } else if (this.tab === 'arsenal') {
      content.innerHTML = this.heading('ARSENAL / ÉQUIPEMENT DE SORTIE', 'Choisissez votre réponse.', `${p?.owned.length || 1} / ${Object.keys(WEAPONS).length} armes acquises. L’arme équipée est disponible dès votre prochain déploiement.`) + `<div class="content-grid">${Object.keys(WEAPONS).map(id => this.weaponCard(id,'arsenal')).join('')}</div><p class="boss-credits">Bases 3D : Kenney (CC0). Équipement et variantes : DEADBLOCK. <a href="/assets/weapons/CREDITS.txt" target="_blank" rel="noopener">Sources des armes ↗</a></p><section class="crate-collection"><div class="section-line"><h2>CAISSES DE RÉCUPÉRATION</h2><span>5 MODÈLES ORIGINAUX</span></div><p class="crate-caption">Reconnaissez le matériel au sol. Le composant rare de chaque boss est sauvegardé dès sa défaite ; sa caisse contient un bonus pour l’escouade.</p><div class="crate-cards">${Object.entries(CRATES).map(([id,c]) => `<article class="crate-card" style="--item-color:${c.color}">${propArt('crate',id,c.name)}<div class="card-copy"><h2>${c.name}</h2><p>${c.description}</p></div></article>`).join('')}</div></section>`;
    } else if (this.tab === 'contracts') {
      content.innerHTML = this.heading('TABLEAU DES CONTRATS / OBJECTIFS PERMANENTS', 'Chaque sortie compte.', 'Éliminations, entraide et fabrication : vos actions font avancer ces quatorze contrats, partie après partie.') + `<div class="content-grid contract-grid">${CONTRACTS.map((c,i) => { const n = Math.min(c.target,p?.stats[c.stat] || 0), claimed = p?.claimed.includes(c.id); return `<article class="contract-card"><div class="card-top"><span>CONTRAT / 0${i+1}</span><b>${claimed ? 'RÉCUPÉRÉ' : n >= c.target ? 'TERMINÉ' : 'EN COURS'}</b></div><h2>${c.name}</h2><p>${c.description}</p><div class="contract-progress" role="progressbar" aria-label="${c.name}" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${c.target}"><span style="width:${n/c.target*100}%"></span></div><div class="contract-count">${n} / ${c.target}</div><div class="contract-reward"><strong>◈ ${c.reward.credits} CR</strong>${c.reward.materials ? materials(c.reward.materials,p) : `<span>${Object.entries(c.reward.consumables || {}).map(([id,n]) => `+ ${n} ${SHOP_ITEMS[id].name}`).join(' · ')}</span>`}</div>${this.button('claim',c.id,claimed ? 'RÉCOMPENSE RÉCUPÉRÉE' : 'RÉCUPÉRER', !claimed && n >= c.target)}</article>`; }).join('')}</div>`;
    } else {
      content.innerHTML = this.heading('RENSEIGNEMENTS / MENACES CONNUES', 'Connaître ce qui vous traque.', 'Trois boss, six types d’infectés. Surveillez les marques au sol et restez en mouvement.') + `<div class="boss-dossiers">${Object.entries(BOSSES).map(([id,b]) => `<article class="boss-dossier" style="--item-color:${b.color}"><span class="hub-eyebrow">${p?.defeated.includes(id) ? 'CIBLE DÉJÀ NEUTRALISÉE' : 'MENACE MAJEURE'}</span>${bossArt(id)}<h2>${b.name}</h2><small>${b.title} · ${b.hp} PV en solo</small><p>${b.description} À mi-vie, le boss accélère et appelle des renforts.</p><div class="boss-drop"><span>BUTIN GARANTI / PAR SURVIVANT</span>${materials({[b.material]:1},p)}<strong>+ ${b.credits} CR</strong></div><button class="card-action" data-hunt="${id}">PRÉPARER LA CHASSE <span>›</span></button></article>`).join('')}</div><p class="boss-credits">Modèles : Quaternius · Ultimate Animated Monster Pack (CC0). Adaptation et équipement : DEADBLOCK. <a href="/assets/bosses/CREDITS.txt" target="_blank" rel="noopener">Sources des modèles ↗</a></p><div class="section-line"><h2>LES INFECTÉS</h2><span>6 PROFILS DE MENACE</span></div><div class="enemy-grid">${Object.entries(ENEMIES).map(([id,e]) => `<article style="--item-color:${e.color}"><span class="enemy-symbol">${({walker:'I',runner:'»',spitter:'∴',exploder:'✳',tank:'III',armored:'▣'})[id]}</span><div><h3>${e.name}</h3><p>${e.description}</p><small>À PARTIR DE LA VAGUE ${e.wave}</small></div></article>`).join('')}</div>`;
      content.querySelectorAll('[data-hunt]').forEach(b => b.addEventListener('click', () => { this.settings.mode = 'hunt'; this.settings.boss = b.dataset.hunt; this.settings.district = BOSSES[b.dataset.hunt].region; this.scene?.configureDistrict(this.settings.district); this.tab = 'home'; this.render(); document.querySelector('#deployment-dock').scrollIntoView({ block: 'center' }); }));
    }
  }
}
