"""Build a portable Windows archive from the compiled game and verified official Node executable.

Usage: python scripts/package-windows.py --runtime /path/node.exe --node-license /path/LICENSE --output /path/DEADBLOCK-Windows.zip
The runtime must be verified against Node.js's official SHASUMS256.txt before packaging.
"""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--runtime', type=Path, required=True)
parser.add_argument('--checksums', type=Path, required=True)
parser.add_argument('--node-license', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
expected = next(line.split()[0] for line in args.checksums.read_text().splitlines() if line.split()[-1] == 'win-x64/node.exe')
if hashlib.sha256(args.runtime.read_bytes()).hexdigest() != expected:
    raise SystemExit('The Node executable does not match the official checksum file.')
if not (root / 'dist/index.html').is_file():
    raise SystemExit('Run npm run build first.')

batch = r'''@echo off
setlocal
cd /d "%~dp0"
title DEADBLOCK - Gardez cette fenetre ouverte
if not exist "runtime\node.exe" (
  echo Extrayez tout le ZIP avant de lancer JOUER.
  pause
  exit /b 1
)
if not exist "app\dist\index.html" (
  echo Le dossier du jeu est incomplet. Extrayez a nouveau tout le ZIP.
  pause
  exit /b 1
)
"%~dp0runtime\node.exe" "%~dp0app\scripts\play.mjs"
if errorlevel 1 (
  echo.
  echo Le jeu n'a pas pu demarrer. Le message ci-dessus indique la cause.
  pause
  exit /b 1
)
'''
guide = '''DEADBLOCK - VERSION WINDOWS 64 BITS

1. Faites un clic droit sur le ZIP puis choisissez "Extraire tout".
2. Ouvrez le dossier extrait DEADBLOCK-Windows.
3. Double-cliquez sur JOUER.bat (Windows peut afficher seulement "JOUER").
4. Le jeu s'ouvre dans votre navigateur. Gardez la fenetre noire ouverte.
5. Dans le refuge, choisissez votre nom et cliquez sur "Deployer l'escouade".

Si le navigateur ne s'ouvre pas, copiez l'adresse affichee dans la fenetre
du lanceur dans la barre d'adresse de Chrome, Edge ou Firefox.
Ne lancez pas app/dist/index.html directement : le jeu a besoin de son serveur.

Aucune installation de Node.js, aucun compte et aucune connexion Internet
ne sont necessaires apres le telechargement et l'extraction du ZIP.
Configuration : Windows 10/11 64 bits x64 et navigateur avec WebGL actif.
Le runtime officiel Node.js est fourni dans runtime/node.exe.

COMMANDES
ZQSD / WASD : bouger       Souris + clic gauche : viser et tirer
Clic droit + glisser : camera      R : recharger      Maj : courir
F : soin      G : grenade      E maintenu : relever un allie
U : ameliorer l'arme pour cette sortie      H : aide

MULTIJOUEUR LOCAL
Les autres joueurs doivent etre sur le meme reseau que l'ordinateur hote.
Le lanceur affiche l'adresse locale a ouvrir sur leurs appareils.
Ils entrent le meme code de salle que l'hote.
Le pare-feu Windows doit autoriser le jeu sur votre reseau prive.
Pour un autre joueur, utilisez un autre profil de navigateur ou un autre appareil.
Cette version ne fournit pas de serveur public pour jouer a distance sur Internet.

SAUVEGARDE
Vos armes et materiaux sont sauvegardes dans :
%LOCALAPPDATA%\\GameMob\\Deadblock\\deadblock.sqlite
Le navigateur garde la cle de votre profil. Utilisez le meme navigateur
et ne supprimez pas ses donnees de site pour retrouver votre progression.
Le ZIP ne contient aucun profil ni sauvegarde d'un autre joueur.

ARRET
Pour arreter le serveur, revenez dans la fenetre noire et appuyez sur Ctrl+C.

Les licences des dependances sont dans le dossier Licences.
'''
args.output.parent.mkdir(parents=True, exist_ok=True)
prefix = 'DEADBLOCK-Windows/'
with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    archive.writestr(prefix + 'JOUER.bat', batch.replace('\n', '\r\n').encode('ascii'))
    archive.writestr(prefix + 'LIRE-MOI.txt', guide.replace('\n', '\r\n').encode('ascii'))
    archive.write(args.runtime, prefix + 'runtime/node.exe')
    archive.write(args.node_license, prefix + 'Licences/Node.js-LICENSE.txt')
    archive.writestr(prefix + 'Licences/Runtime-SHA256.txt', expected + '  runtime/node.exe\nSource : https://nodejs.org/dist/v24.22.1/win-x64/node.exe\n')
    for folder in ['dist', 'server', 'shared', 'node_modules/ws']:
        for file in sorted((root / folder).rglob('*')):
            if file.is_file():
                archive.write(file, prefix + 'app/' + file.relative_to(root).as_posix())
    archive.write(root / 'scripts/play.mjs', prefix + 'app/scripts/play.mjs')
    archive.writestr(prefix + 'app/package.json', json.dumps({'name': 'deadblock-windows', 'version': '0.2.0', 'private': True, 'type': 'module'}, indent=2))
    for source, name in [('node_modules/ws/LICENSE', 'ws'), ('node_modules/three/LICENSE', 'Three.js'), ('node_modules/@fontsource/dm-sans/LICENSE', 'DM-Sans'), ('node_modules/@fontsource/barlow-condensed/LICENSE', 'Barlow-Condensed')]:
        archive.write(root / source, prefix + f'Licences/{name}-LICENSE.txt')
print(f'Created {args.output} ({args.output.stat().st_size / 1024 / 1024:.1f} MiB)')
