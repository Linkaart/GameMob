# GameMob · DEADBLOCK

Jeu de survie coopérative en 3D dans le navigateur, pour 1 à 4 joueurs. Un refuge pour préparer ses sorties, une ville infestée, trois boss à chasser et des armes spéciales à fabriquer avec leur butin. Univers, décor procédural et sons originaux ; armes adaptées de bases Kenney CC0 et boss de modèles Quaternius CC0. Aucun asset de Call of Mini: Zombies n’est utilisé.

## Démarrer

### Version Windows prête à jouer

L’archive `DEADBLOCK-Windows.zip` contient le client compilé, le serveur et le runtime officiel Node.js pour Windows 10/11 x64. Faites un clic droit sur le ZIP, choisissez **Extraire tout**, puis double-cliquez sur **JOUER.bat** dans le dossier extrait. Le lanceur ouvre le navigateur et conserve le serveur dans sa fenêtre de console ; laissez-la ouverte pendant la partie. Aucun `npm install` n’est nécessaire pour cette version.

Le lanceur utilise le port 3377 et affiche aussi les adresses utilisables sur le même réseau local. Les profils de cette version sont sauvegardés dans `%LOCALAPPDATA%\GameMob\Deadblock`. Utilisez le même navigateur pour retrouver votre profil. Fermer la console arrête les parties en cours. Il ne s’agit pas d’un hébergement public sur Internet.

Pour recréer l’archive, compilez le client puis utilisez `python scripts/package-windows.py --runtime <node.exe> --checksums <SHASUMS256.txt> --node-license <LICENSE> --output <DEADBLOCK-Windows.zip>`. Le runtime utilisé est celui de la distribution officielle Node.js v24.22.1, vérifié contre son manifeste SHA-256. Le script refuse une empreinte différente et n’embarque aucune sauvegarde de développement. La logique du lanceur et l’archive extraite sont testées dans l’environnement Linux ; l’ouverture du navigateur par Windows nécessite un essai sur Windows.

### Développement

**Node.js 24+** (SQLite intégré) et npm sont nécessaires. Aucun service externe ni secret à configurer.

```bash
cd /workspace/GameMob
npm ci
npm run dev
```

Vite écoute sur **5173** et transmet `/api` et `/ws` au serveur sur **3000**. `Ctrl+C` arrête les deux processus. Pour servir la version compilée avec un seul serveur :

```bash
npm run build
npm start
```

Variables : `PORT` (3000), `HOST` (`0.0.0.0`), `DATA_DIR` (`.data`). La production sert le jeu et les WebSockets sur le même port. Les polices et ressources sont locales ; aucun CDN requis en jeu.

## Le refuge

- **Accueil** : sélection de l’ambiance, du mode et du boss ; pseudonyme et code de salle.
- **Boutique** : cinq armes à acheter, trousses de secours, grenades et caisses de matériaux. Les crédits sont gagnés en jouant ; aucun achat en argent réel.
- **Atelier** : six plans d’armes spéciales avec leurs ingrédients, les stocks disponibles et le boss à chasser.
- **Arsenal** : douze armes, leurs caractéristiques et le choix de celle à emporter.
- **Contrats** : quatorze objectifs permanents portant sur les éliminations, vagues, boss, réanimations et fabrications. Chaque récompense se récupère une fois.
- **Campagne** : neuf opérations en trois chapitres, objectifs de récupération, défense et assaut, extraction et déblocages sauvegardés.
- **Bestiaire** : six types d’infectés et trois boss, leurs attaques et leurs composants. « Préparer la chasse » sélectionne directement une cible.

Un nouveau survivant reçoit 450 crédits, une carabine Vigile, une trousse de secours et deux grenades. Les achats, recettes, consommables et récompenses sont validés côté serveur. L’équipement et les achats ne peuvent être modifiés qu’au refuge.

## Sorties et progression

La **version 0.5** ajoute une campagne jouable du début à la fin : **Opération Nouvelle Aube**. Depuis l’onglet Campagne, sélectionnez « Le dernier signal », préparez la mission puis déployez l’escouade. Les neuf opérations se débloquent dans l’ordre, pour chaque profil. Un coéquipier doit lui aussi avoir débloqué la mission choisie. Le serveur contrôle ces accès et les récompenses.

| Chapitre | Missions | Carte |
| --- | --- | --- |
| 1 · Quarantaine | Le dernier signal · Rétablir le contact · Briser le siège | 46 × 46 m |
| 2 · La Fonderie | Fer froid · Sortir du noir · Surcharge | 64 × 64 m |
| 3 · Zone Zéro | Patient zéro · Synthèse · Une nouvelle aube | 72 × 72 m |

**Récupération** : approchez les terminaux dorés à moins de 2,8 m et maintenez E (bouton + sur mobile) pendant deux secondes pour chacun. **Défense** : restez à moins de 4 m du relais ; les infectés présents dans le cercle interrompent la progression. **Assaut** : éliminez les vagues et les boss indiqués. La dernière mission enchaîne les trois boss. Toutes les missions demandent aussi de nettoyer leurs vagues, puis de regrouper les survivants vivants pendant cinq secondes dans le cercle d’extraction. Sortir du cercle remet ce compte à rebours à zéro. Les alliés à terre reçoivent également la récompense d’une extraction réussie.

Le panneau d’objectif affiche la progression et la distance. La mini-carte montre les obstacles, les alliés, les objectifs et les infectés proches (les boss restent repérés à distance). La première réussite rapporte la prime affichée, 180 XP, 12 ferrailles et 4 circuits ; rejouer rapporte 35 % des crédits, 50 XP, 4 ferrailles et 1 circuit. Les contrats de campagne comptent les missions distinctes terminées. Les sauvegardes 0.2–0.4 sont enrichies sans réinitialiser achats, équipement ou identifiant de profil. Après les neuf missions, un écran de campagne terminée permet de rejouer ou de continuer en survie.

**Survie** : première vague après cinq secondes, neuf secondes de répit entre les vagues ; un boss toutes les trois vagues, dans l’ordre Briseur, Porteuse, Veilleur. Les vagues n’ont pas de limite prédéfinie.

**Chasse** : le boss choisi arrive dès la première vague, accompagné d’infectés. La victoire est acquise après élimination du boss et des renforts. Sa santé augmente avec le nombre de joueurs présents au début de la vague.

| Boss | Attaque | Composant garanti par joueur |
| --- | --- | --- |
| Le Briseur | Fracture du sol, cercle orange à éviter | Plaque du Briseur |
| La Porteuse | Flaques corrosives persistantes | Cœur de la Porteuse |
| Le Veilleur | Trois décharges électriques annoncées | Réacteur du Veilleur |

À mi-vie, les boss accélèrent et appellent des coureurs. Les dégâts de zone sont précédés de marques au sol. Chaque boss vaincu donne immédiatement son composant rare, des matériaux communs et des crédits à **tous les survivants de la salle**, y compris ceux à terre. Une caisse supplémentaire peut être ramassée avant la fin de la sortie. Les récompenses déjà obtenues restent acquises en cas de défaite.

Les infectés deviennent plus variés : rôdeurs (vague 1), coureurs (2), cracheurs (4), boursouflés explosifs et massifs (5), cuirassés à protection frontale (6). Les éliminations donnent des crédits et parfois des soins ou matériaux. Finir une vague soigne et réapprovisionne l’escouade.

| Arme | Obtention | Particularité |
| --- | --- | --- |
| Vigile | Dès le départ | Carabine, 24 cartouches |
| Frelon | 300 crédits | Cadence élevée, 36 cartouches |
| Fossoyeur | 450 crédits | Cinq projectiles par tir, 8 cartouches |
| Dernier Mot | 650 crédits | Précision, portée de 35 m |
| Arc Fantôme | 25 ferrailles, 12 circuits, 1 réacteur | Arcs sur trois cibles supplémentaires proches |
| Braise | 30 ferrailles, 10 réactifs, 1 cœur | Brûlure persistante, chargeur de 60 |
| Brise-Rempart | 40 ferrailles, 16 circuits, 1 plaque | Traverse jusqu’à quatre cibles |
| Sentinelle | 220 crédits | Pistolet lourd, 12 cartouches, recharge rapide |
| Barrage | 900 crédits | Mitrailleuse, 80 cartouches, recharge de 3,4 s |
| Hiver Noir | 32 ferrailles, 12 circuits, 1 réacteur, 1 cœur | Ralentissement à 45 % de la vitesse pendant 2,5 s |
| Dernier Soleil | 50 ferrailles, 18 circuits, 2 plaques, 1 réacteur | 130 dégâts directs, 70 dégâts de zone |
| Ronce Noire | 25 ferrailles, 16 réactifs, 2 cœurs | Dégâts corrosifs sur les voisins de la cible |

L’amélioration U augmente dégâts et cadence jusqu’au niveau 5 **pour la sortie en cours**. Elle coûte des crédits permanents, contrairement à l’acquisition d’une arme, qui reste dans l’arsenal. La réserve de munitions est illimitée, mais chaque arme a sa propre taille de chargeur et sa durée de recharge.

## Jouer ensemble

1. Tous les joueurs ouvrent la même adresse de serveur depuis leur navigateur.
2. Le premier choisit sa mission et un code de 3 à 8 lettres ou chiffres, puis se déploie.
3. Les autres saisissent le même code. Ils rejoignent les réglages de la salle existante.
4. Le bouton du code de salle copie un lien d’invitation, ou affiche le code si le presse-papiers est indisponible.

Chaque joueur utilise son propre profil navigateur. Un même profil ne peut pas jouer dans deux onglets à la fois. Pour tester deux joueurs sur une machine, utilisez deux profils de navigateur ou des contextes isolés.

Sur un réseau local, ouvrez l’adresse réseau de la machine hôte, au port 5173 en développement ou 3000 en production. Sur Internet, le serveur Node doit être accessible derrière HTTPS, avec WebSocket `/ws` et un disque persistant pour `DATA_DIR`. Un hébergement uniquement statique ne suffit pas. Ce projet n’est pas déployé sur un hébergement public par ces modifications.

## Commandes

| Action | Ordinateur | Mobile |
| --- | --- | --- |
| Se déplacer | WASD, ZQSD ou flèches | Joystick gauche |
| Viser et tirer | Souris et clic gauche maintenu | Joystick droit |
| Tourner la caméra | Clic droit + glisser | Glisser sur le décor |
| Recharger | R | Bouton recharge |
| Courir | Maj, sans tirer | — |
| Relever un allié | E maintenu à proximité, 2,5 s | Bouton + maintenu |
| Soin (+55 PV) | F ou bouton soin | Bouton soin |
| Grenade (180 dégâts) | G ou bouton grenade | Bouton grenade |
| Améliorer l’arme pour cette sortie | U ou bouton d’amélioration | Bouton d’amélioration |
| Afficher les commandes | H, Échap ou ? | Bouton ? |

Les alliés ne se blessent pas entre eux. Si tous les survivants tombent, la sortie se termine ; n’importe quel membre peut redéployer l’escouade. Le briefing ne met pas la partie en pause. Le son peut être activé avec l’icône haut-parleur.

La caméra à la troisième personne évite les obstacles. Les déplacements suivent son orientation. Le paysage est conseillé sur téléphone ; le portrait est pris en charge. L’ATH affiche santé, chargeur réel, recharge, consommables, escouade, danger proche, santé du boss et bilan des composants obtenus.

## Graphismes

La version **0.4** remplace les trois boss cubiques par des modèles animés **Quaternius / Ultimate Animated Monster Pack**, récupérés sur [le dépôt de distribution](https://github.com/511action/descent-3d-assets) à la révision `7c5af55b84faf6dbe4a9bada9f11627151acbe62`, qui les annonce sous CC0. Les fichiers, empreintes et liens sources sont consignés dans [les crédits](public/assets/bosses/CREDITS.txt), également accessibles depuis le bestiaire et inclus dans l’archive Windows.

- **Le Briseur** : Orc adapté, masque de fer, épaulières à pointes, protections des avant-bras et plastron lumineux.
- **La Porteuse** : Demon adapté, crocs, excroissances et poches toxiques vertes.
- **Le Veilleur** : BlueDemon adapté, visière, harnais, noyau et bobines électriques.

Les trois modèles ont des transitions entre repos, marche, course en rage et coups de mêlée, déclenchés par l’état de combat. Les pièces ajoutées suivent les os du squelette. Leur lueur s’intensifie en rage. Les fiches du refuge et du bestiaire montrent les modèles du jeu, avec inspection 3D animée. Les fichiers sont servis localement, textures et animations incluses : aucun téléchargement externe n’est nécessaire pendant une partie. Un modèle de secours reste visible si le chargement échoue. Chaque instance libère ses géométries, matériaux et squelette sans invalider ceux des autres boss.

La version **0.5** utilise deux bases 3D téléchargées dans le dépôt officiel [Kenney / Starter Kit FPS](https://github.com/KenneyNL/Starter-Kit-FPS), sous CC0 : `blaster.glb`, `blaster-repeater.glb` et leur texture. Elles servent aux douze variantes d’armes, complétées par des crosses, canons, lunette, tambour, bobines, réservoirs et rails propres à DEADBLOCK. Ce sont **deux assets de base et douze variantes**, pas douze modèles téléchargés distincts. Sources, révision et empreintes dans [les crédits des armes](public/assets/weapons/CREDITS.txt). Les modèles procéduraux antérieurs servent de secours si le chargement échoue. Les maillages d’une arme sont les mêmes dans l’inspection et en jeu. Le tir fait reculer l’arme et la recharge l’abaisse.

Cinq modèles de caisses distinguent récupération, soins et bonus des trois boss. Une grenade originale remplace aussi son pictogramme dans la boutique. Les géométries sont regroupées par matériau ; les aperçus sont mis en cache et les maillages temporaires libérés à leur fermeture.

La version **0.6** retravaille le rendu à partir de la référence visuelle fournie de Call of Mini Zombies : proportions stylisées conservées, arêtes des personnages adoucies, vêtements tissés et usés, sacs de secours, sangles, poches et genouillères. Le bitume présente du grain et du relief ; les rues gagnent des grilles, traces au sol, arbres morts, vitrines barricadées, roues et carrosseries abîmées. Des panaches de fumée accompagnent les feux et une lumière brève éclaire chaque tir. Les textures de cette mise à jour sont originales et générées localement, sans téléchargement pendant une partie. Il s’agit d’un rendu stylisé plus détaillé, pas de modèles ou textures extraits de Call of Mini Zombies ni d’un rendu photoréaliste.

La version **0.7** ajoute un éclairage d’environnement préfiltré pour les métaux et surfaces humides, également utilisé dans l’armurerie. Les accessoires d’armes portent des micro-rayures ; leurs matériaux distinguent mieux la peinture, le métal et les éléments lumineux. Une lampe du survivant suit sa visée et s’éteint quand il tombe ou quitte la sortie. Les lampadaires ont des halos doux et les feux utilisent des flammes transparentes animées, accompagnées de fumée. L’environnement de réflexion est une texture originale générée localement : il ne reflète pas dynamiquement les personnages. Aucun service externe ni nouveau téléchargement n’est requis. Les pièces rigides d’un personnage sont regroupées en instances, tandis que les jambes et armes restent animées séparément ; le décor du refuge est limité à 20 images/s pour libérer des ressources pendant les menus. En partie, la résolution du rendu 3D s’adapte entre 55 % et 100 % du réglage initial lorsque les images deviennent lentes ; les ombres passent de 2048 à 1024 pixels si nécessaire. La qualité remonte progressivement après plusieurs périodes stables. Le texte et les commandes de l’interface gardent leur résolution native. Les relâchements du tir sont envoyés immédiatement au serveur, sans attendre la prochaine mise à jour périodique.

Trois cartes distinctes : **Quarantaine**, **La Fonderie**, **Zone Zéro**. Tailles, bâtiments, routes et collisions sont définis dans `shared/world.mjs` et partagés entre serveur, rendu et mini-carte. Chaque carte possède aussi son ciel, sa brume, son éclairage, ses enseignes et ses particules (pluie ou cendres). Les boss, ennemis et armes disposent de détails visuels distincts. Néons vacillants, feux, flaques réfléchissantes, ruines industrielles, textures de briques et visages sont générés dans le projet. Les éléments statiques sont regroupés en instances pour réduire le coût du rendu.

Source demandée pour une prochaine reprise des images/statistiques : [Call of Mini Zombies Wiki — Weapons](https://callofminizombies.fandom.com/wiki/Weapons). L’accès à Fandom a été refusé par le proxy réseau de l’environnement le 27 octobre 2026 (403 avant connexion au site). Les autorisations de domaine ont été préparées en brouillon. **Aucune image ni statistique de ce wiki n’a encore été importée** ; les valeurs de `shared/content.mjs` restent celles du prototype et ne sont pas présentées comme les valeurs officielles.

## Sauvegarde

La base SQLite est créée automatiquement dans `.data/deadblock.sqlite` (dossier ignoré par Git). Elle conserve crédits, XP, armes, matériaux, consommables, statistiques, boss vaincus et contrats récupérés. Les écritures sont transactionnelles. Ne supprimez pas ce dossier pour réinitialiser seulement une partie ; les salles en cours sont indépendantes et restent en mémoire.

Le navigateur conserve un jeton aléatoire dans son stockage local ; le serveur n’en conserve que l’empreinte. Il n’y a pas encore de compte avec email, de récupération de profil ou de synchronisation entre appareils. Effacer le stockage du navigateur fait perdre l’accès au profil. Si le disque du serveur est éphémère, les sauvegardes disparaissent avec lui. Sauvegardez le dossier de données sur un volume durable ; pour une copie à froid, arrêtez le serveur avant de copier la base.

## Vérifications

```bash
npm test
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Sur une machine sans Chromium système : `npx playwright install chromium`, puis `npm run test:browser`. Playwright lance son propre serveur sur le port 3100 et utilise une base distincte dans `test-results/profile-data`.

Les tests couvrent déplacements/collisions/caméra, tirs/recharge/réanimation, les trois boss et leurs avertissements, les effets d’armes spéciales et le ralentissement, consommables, achats, recettes et récompenses, persistance SQLite, authentification des profils et deux vrais clients WebSocket. Les essais navigateur couvrent les sept pages du refuge, achats/équipement conservés au rechargement, déploiement avec l’arme acquise, chasse au boss, tir/recharge et contrôles tactiles portrait/paysage. Captures dans `test-results/`, ignoré par Git. L’émulation mobile ne remplace pas un essai sur téléphone physique.

## Organisation et limites

- `shared/content.mjs` : catalogue et recettes partagés.
- `server/profiles.mjs` : stockage SQLite et transactions de progression.
- `server/game.mjs` : simulation autoritaire, vagues, boss, attaques et butin.
- `server/index.mjs` : API de profil, HTTP et salles WebSocket.
- `server/navigation.mjs`, `shared/world.mjs` : navigation et collisions.
- `src/hub.js`, `src/hub.css` : refuge, boutique, atelier, arsenal et contrats.
- `src/scene.js`, `src/camera.js` : rendu Three.js et caméra.
- `src/weapon-assets.js`, `public/assets/weapons/` : bases Kenney, texture locale et douze adaptations.
- `src/mission-hud.js`, `src/campaign.css` : objectifs, mini-carte et sélection de campagne.
- `src/boss-models.js`, `public/assets/bosses/` : modèles téléchargés, provenance, équipements ajoutés et animations des boss.
- `src/props.js`, `src/prop-viewer.js` : modèles originaux, vignettes et inspection 3D.
- `src/main.js`, `src/hud.css` : réseau, entrées, audio et ATH.

Prototype en un seul processus, sans matchmaking public, campagne scénarisée ni application native Android/iOS. Les salles disparaissent quand tous les joueurs partent ou au redémarrage du serveur. La progression permanente reste sauvegardée, mais une reconnexion crée un nouveau personnage de sortie. Les codes de salle facilitent les invitations ; ils ne constituent pas un compte utilisateur.
