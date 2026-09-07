# WhatsApp Game Bot

Bot WhatsApp (via [Baileys](https://github.com/WhiskeySockets/Baileys)) qui envoie
un mini-jeu HTML5 avec un menu WhatsApp interactif (Native Flow) : boutons,
sélection de jeux et bouton « Jouer » qui ouvre le jeu dans le navigateur de
WhatsApp.

Connexion par **pairing code** (pas de QR code à scanner).

## 1. Installation

```bash
npm install
```

## 2. Configuration

Copie `.env.example` en `.env` et remplis les valeurs :

```bash
cp .env.example .env
```

- `PHONE_NUMBER` : ton numéro WhatsApp, format international, sans `+` (ex: `33612345678`)
- `BASE_URL` : l'URL publique où ce serveur sera joignable (voir section 4)
- `PORT` : port local du serveur (3000 par défaut)
- `PREFIX` : préfixe des commandes (`!` par défaut)

## 3. Lancement

```bash
npm start
```

La première fois, le terminal affiche un **code de jumelage à 8 chiffres**.
Sur ton téléphone :

1. WhatsApp → Paramètres → Appareils liés
2. "Lier un appareil"
3. "Lier avec un numéro de téléphone à la place"
4. Entre le code affiché dans le terminal

Une fois connecté, les identifiants sont sauvegardés dans `auth_info/` —
tu n'auras plus besoin de refaire le pairing tant que ce dossier existe.

## 4. Rendre le serveur accessible publiquement

Le téléphone des utilisateurs doit pouvoir ouvrir l'URL des jeux depuis
Internet. Deux options :

**A. Test rapide avec ngrok**
```bash
ngrok http 3000
```
Copie l'URL `https://xxxx.ngrok-free.app` fournie dans `BASE_URL` de ton `.env`,
puis relance le bot.

**B. Hébergement permanent**
Déploie ce projet sur un service comme Render, Railway, ou un VPS, et mets
son URL publique (avec HTTPS) dans `BASE_URL`.

## 5. Menu interactif et commandes

Chaque commande correspond automatiquement au `id` du fichier de jeu dans
`/games`. Par exemple `games/flappy.js` exporte `id: "flappy"` → la commande
est `!flappy`.

Commandes disponibles avec les 18 jeux fournis :

```
!2048  !breakout  !car  !connect4  !dino  !flappy  !frogger  !knife
!maze  !memory  !ninja  !pong  !snake  !spaceinvaders  !stickfight
!tetris  !tictactoe  !whack
```

Le menu `!jeux` utilise `generateWAMessageFromContent` + `proto.Message.InteractiveMessage`
pour afficher des contrôles natifs WhatsApp. Les jeux sont répartis en pages
pour éviter un menu trop long. Chaque jeu possède un bouton **▶️ JOUER**.

> **Important :** WhatsApp ne permet pas à un bot Baileys d'exécuter librement
> du JavaScript/HTML directement dans la bulle de conversation. Le jeu HTML5
> reste donc une page web ouverte par le bouton interactif.

Autres commandes :
- `!jeux` — ouvre le menu interactif
- `!help` — ouvre l'aide interactive

## 6. Ajouter un nouveau jeu plus tard

Dépose simplement un nouveau fichier `.js` dans `/games`, au même format que
les autres (`module.exports = { name, id, description, html }`), puis
redémarre le bot. La commande correspondante sera automatiquement active.

## Notes importantes

- Le pairing code expire après quelques minutes — relance `npm start` si tu
  n'as pas eu le temps de l'entrer.
- Utiliser un bot non officiel sur ton compte WhatsApp personnel comporte un
  risque de bannissement selon l'usage (spam, volume de messages). Reste
  raisonnable sur la fréquence d'envoi, surtout dans les groupes.
- `BASE_URL` doit être en HTTPS pour un rendu propre dans WhatsApp.
