import { worldFor } from '../shared/world.mjs';
import { missionFor, DISTRICTS } from '../shared/content.mjs';

export class MissionHUD {
  constructor(parent) {
    this.panel = document.createElement('section'); this.panel.className = 'mission-tracker'; this.panel.hidden = true;
    this.panel.setAttribute('aria-label', 'Objectif de mission');
    this.panel.innerHTML = '<small>OPÉRATION EN COURS</small><h3></h3><p></p><div class="objective-track" role="progressbar" aria-label="Progression de mission" aria-valuemin="0" aria-valuemax="100"><i></i></div>';
    this.map = document.createElement('div'); this.map.className = 'tactical-map';
    this.map.innerHTML = '<canvas width="160" height="160" role="img" aria-label="Carte du secteur : alliés, obstacles et objectifs"></canvas><small></small>';
    this.ctx = this.map.querySelector('canvas').getContext('2d', { willReadFrequently: true }); parent.append(this.panel, this.map);
  }
  update(state, player) {
    const mission = missionFor(state.settings.mission), o = state.objective, world = worldFor(state.settings.district);
    this.panel.hidden = !o;
    if (o) {
      this.panel.querySelector('h3').textContent = mission?.name || 'Mission';
      let description, ratio;
      if (o.ready) {
        const distance = Math.ceil(Math.hypot(o.exit.x - player.x, o.exit.z - player.z));
        description = o.extracting > 0 ? `Évacuation ${o.extracting.toFixed(1)} / 5 s · restez regroupés` : `Extraction à ${distance} m · tous les survivants dans le cercle`;
        ratio = o.extracting / 5;
      } else if (o.goal === 'salvage') {
        const nearest = o.points.filter(p => !p.done).sort((a,b) => Math.hypot(a.x-player.x,a.z-player.z) - Math.hypot(b.x-player.x,b.z-player.z))[0];
        description = `${o.progress} / ${o.target} réserves · ${nearest ? Math.ceil(Math.hypot(nearest.x-player.x,nearest.z-player.z)) + ' m · maintenez E (ou +) 2 s' : 'Éliminez les infectés restants'}`;
        ratio = o.progress / o.target;
      } else if (o.goal === 'defend') {
        const point = o.points[0], distance = Math.ceil(Math.hypot(point.x-player.x, point.z-player.z));
        description = `${Math.floor(o.progress)} / ${o.target} s · ${o.contested ? 'ZONE CONTESTÉE' : o.progress >= o.target ? 'Nettoyez le secteur' : distance > 4 ? 'Relais à ' + distance + ' m' : 'Maintenez la position'}`;
        ratio = o.progress / o.target;
      } else {
        description = `${o.progress} / ${o.target} assaut(s) terminé(s) · éliminez les boss et leurs renforts`;
        ratio = o.progress / o.target;
      }
      this.panel.querySelector('p').textContent = description;
      this.panel.querySelector('.objective-track i').style.width = `${Math.min(100, ratio * 100)}%`;
      this.panel.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    }
    const now = performance.now(); if (now - (this.lastMap || 0) < 200) return; this.lastMap = now;
    const ctx = this.ctx, size = 160, scale = 148 / world.size, at = n => 80 + n * scale;
    ctx.clearRect(0, 0, size, size); ctx.fillStyle = '#142220'; ctx.fillRect(0,0,size,size);
    ctx.strokeStyle = '#537064'; ctx.strokeRect(6,6,148,148); ctx.fillStyle = '#52655c';
    for (const b of world.obstacles) ctx.fillRect(at(b.x-b.w/2),at(b.z-b.d/2),b.w*scale,b.d*scale);
    for (const z of state.zombies) if (Math.hypot(z.x-player.x,z.z-player.z)<20 || z.boss) {
      ctx.fillStyle = z.boss ? '#f59b67' : '#c36f57'; ctx.beginPath(); ctx.arc(at(z.x),at(z.z),z.boss?3:1.5,0,Math.PI*2); ctx.fill();
    }
    if (o) for (const point of o.ready ? [o.exit] : o.goal === 'boss' ? [] : o.points.filter(p=>!p.done)) {
      ctx.strokeStyle = o.ready ? '#87e3c6' : '#ead38a'; ctx.lineWidth = 2; ctx.strokeRect(at(point.x)-3,at(point.z)-3,6,6);
    }
    for (const p of state.players) { ctx.fillStyle = p.hp<=0 ? '#a26c68' : p.id === player.id ? '#f3edd3' : '#87bdce'; ctx.beginPath(); ctx.arc(at(p.x),at(p.z),p.id === player.id?3.5:2.5,0,Math.PI*2); ctx.fill(); }
    ctx.strokeStyle='#f3edd3'; ctx.beginPath();ctx.moveTo(at(player.x),at(player.z));ctx.lineTo(at(player.x)+Math.sin(player.aim)*8,at(player.z)+Math.cos(player.aim)*8);ctx.stroke();
    this.map.querySelector('small').textContent = `${DISTRICTS[state.settings.district].name} · N ↑`;
  }
}
