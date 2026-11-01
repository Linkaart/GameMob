import * as THREE from 'three';
import { ENEMIES } from '../shared/content.mjs';
import { rayBoxDistance } from '../shared/world.mjs';
import './combat-feedback.css';

export class CombatFeedback {
  constructor(scene, parent) {
    this.scene = scene; this.hits = []; this.bars = new Map(); this.state = null;
    this.root = document.createElement('div'); this.root.className = 'combat-feedback'; this.root.setAttribute('aria-hidden', 'true');
    this.confirm = document.createElement('div'); this.confirm.className = 'hit-confirm'; this.root.append(this.confirm); parent.append(this.root);
    this.point = new THREE.Vector3();
  }
  clear() {
    for (const h of this.hits) h.el.remove(); this.hits = [];
    for (const bar of this.bars.values()) bar.remove(); this.bars.clear(); this.state = null; this.wounded = []; this.lastSelect = 0; this.confirmUntil = 0; this.confirm.className = 'hit-confirm';
  }
  update(state, id) {
    this.state = state; this.id = id;
    const now = performance.now();
    for (const e of state.events) {
      if (e.type !== 'impact' || e.player !== id) continue;
      let hit = this.hits.find(h => h.id === e.id && now - h.created < 220);
      if (!hit) {
        if (this.hits.length >= 12) this.hits.shift().el.remove();
        const el = document.createElement('span'); el.className = 'damage-number'; this.root.append(el);
        hit = { id: e.id, el, amount: 0, x: e.x, z: e.z, boss: e.boss, created: now }; this.hits.push(hit);
      }
      hit.amount += e.amount; hit.until = now + 750; hit.fatal = e.fatal; hit.armored = e.armored;
      hit.el.textContent = `${Math.round(hit.amount)}${e.fatal ? ' · ÉLIMINÉ' : e.armored ? ' · ARMURE' : ''}`;
      hit.el.dataset.fatal = String(e.fatal); hit.el.dataset.armored = String(e.armored);
      this.confirm.textContent = e.fatal ? 'ÉLIMINATION' : e.armored ? 'ARMURE TOUCHÉE' : 'TOUCHÉ';
      this.confirm.className = `hit-confirm active${e.fatal ? ' fatal' : ''}`; this.confirmUntil = now + 350;
    }
  }
  position(el, x, y, z, player, offset = 0) {
    const dx = x - player.x, dz = z - player.z, distance = Math.hypot(dx, dz);
    const obscured = distance > 18 || (distance > .1 && this.scene.world.obstacles.some(o => rayBoxDistance(player.x, player.z, dx / distance, dz / distance, o) < distance - .5));
    this.point.set(x, y, z).project(this.scene.camera);
    const visible = !obscured && this.point.z > -1 && this.point.z < 1 && Math.abs(this.point.x) < .98 && Math.abs(this.point.y) < .94;
    el.hidden = !visible;
    if (visible) el.style.transform = `translate(${(this.point.x + 1) * innerWidth / 2}px,${(1 - this.point.y) * innerHeight / 2 - offset}px) translate(-50%,-100%)`;
  }
  render() {
    const player = this.state?.players.find(p => p.id === this.id); if (!player) return;
    const now = performance.now();
    if (now > this.confirmUntil) this.confirm.classList.remove('active');
    this.hits = this.hits.filter(hit => {
      if (now > hit.until) { hit.el.remove(); return false; }
      this.position(hit.el, hit.x, hit.boss ? 4.2 : 2.5, hit.z, player, (now - hit.created) * .035);
      hit.el.style.opacity = Math.min(1, (hit.until - now) / 200); return true;
    });
    // Refresh selection at 5 Hz; project the small set of visible bars with the camera.
    if (now - (this.lastSelect || 0) > 200) {
      this.lastSelect = now;
      this.wounded = this.state.zombies.filter(z => !z.boss && z.hp > 0 && z.hp < z.maxHp && Math.hypot(z.x - player.x, z.z - player.z) < 14)
        .sort((a,b) => Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z)).slice(0,8);
      const ids = new Set(this.wounded.map(z => z.id));
      for (const [id, el] of this.bars) if (!ids.has(id)) { el.remove(); this.bars.delete(id); }
    }
    for (const z of this.wounded || []) {
      const actor = this.scene.zombies.get(z.id); if (!actor) { this.bars.get(z.id)?.remove(); this.bars.delete(z.id); continue; }
      let el = this.bars.get(z.id);
      if (!el) { el = document.createElement('div'); el.className = 'enemy-vitals'; el.innerHTML = '<small></small><div><i></i></div>'; this.bars.set(z.id, el); this.root.append(el); }
      const target = actor.target;
      el.querySelector('small').textContent = ENEMIES[target.kind]?.name || 'Infecté';
      el.querySelector('i').style.transform = `scaleX(${Math.max(0, target.hp / target.maxHp)})`;
      this.position(el, actor.group.position.x, 2.45 * actor.group.scale.y, actor.group.position.z, player);
    }
  }
}
