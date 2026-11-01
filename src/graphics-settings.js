import './graphics-settings.css';

export class GraphicsSettings {
  constructor(scene, onOpen) {
    this.scene = scene;
    let mode; try { mode = localStorage.getItem('deadblock-graphics'); } catch { /* Storage optional. */ }
    this.mode = ['auto','performance','quality'].includes(mode) ? mode : 'auto'; scene?.setGraphicsMode(this.mode);
    this.modal = document.createElement('dialog'); this.modal.className = 'graphics-panel'; this.modal.setAttribute('aria-labelledby', 'graphics-title');
    this.modal.innerHTML = `<button class="graphics-close" aria-label="Fermer les réglages">×</button><small>CONFORT DE JEU</small><h2 id="graphics-title">GRAPHISMES</h2><p>Choisissez le rendu adapté à votre ordinateur. Votre choix est conservé dans ce navigateur.</p><fieldset><legend>Qualité du rendu</legend>${[
      ['auto','Automatique','Recommandé · adapte la résolution et les ombres aux performances.'],
      ['performance','Fluidité','Résolution réduite et ombres allégées pour les petites configurations.'],
      ['quality','Qualité','Résolution maximale et ombres détaillées. Peut ralentir les machines modestes.'],
    ].map(([id,label,detail])=>`<label><input type="radio" name="graphics" value="${id}"><span><b>${label}</b><small>${detail}</small></span></label>`).join('')}</fieldset><p class="graphics-note">Le texte et les commandes restent nets. En mission, la partie continue pendant les réglages.</p>`;
    document.body.append(this.modal); this.modal.querySelector(`[value="${this.mode}"]`).checked = true;
    this.modal.querySelector('.graphics-close').onclick = () => this.modal.close();
    this.modal.addEventListener('change', event => {
      if (event.target.name !== 'graphics') return;
      this.mode = event.target.value; this.scene?.setGraphicsMode(this.mode);
      try { localStorage.setItem('deadblock-graphics', this.mode); } catch { /* Storage optional. */ }
    });
    const open = () => { onOpen(); this.modal.showModal(); };
    const button = document.createElement('button'); button.type = 'button'; button.className = 'icon-button graphics-toggle'; button.setAttribute('aria-label','Réglages graphiques'); button.textContent = '⚙'; button.onclick = open;
    document.querySelector('#hub-connection').append(button);
    const ingame = document.createElement('button'); ingame.type = 'button'; ingame.className = 'secondary-button graphics-ingame'; ingame.textContent = 'Réglages graphiques'; ingame.onclick = open;
    document.querySelector('#close-help').before(ingame);
  }
}
