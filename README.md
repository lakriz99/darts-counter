# 🎯 Darts Counter (PWA)

Compteur de fléchettes **501 / 301** en **web app installable (PWA)**, pensé pour être ultra simple sur smartphone (saisie fléchette par fléchette) tout en restant pratique sur PC.

## ✨ Fonctionnalités

- Modes **501** et **301**
- **1 à 8 joueurs**
- Saisie **fléchette par fléchette** :
  - Choix du **chiffre**, puis **Simple / Double / Triple**
  - Boutons dédiés : **25** et **Bull (50)** (Bull = **D25**)
- Option **Double-out** activable :
  - Il faut finir à **0** avec une **double** (Bull = double)
  - Gestion des **busts** (score < 0 / reste 1 / fin pas sur double)
- Interface **mobile dédiée** (plein écran, lisible, anti-scroll parasite)
- Affichage dynamique du tour :
  - Fléchette **1 / 2 / 3** + valeur
  - Total du tour
  - Passage au joueur suivant
- Affichage permanent des **scores**
- (Optionnel selon version) **Suggestions de checkout ≤ 160**
- Fonctionne **offline** via service worker (`sw.js`)

---

## 📱 Installation sur smartphone (PWA)

### iPhone (Safari)
1. Ouvre le site GitHub Pages de l’app.
2. Bouton **Partager** → **Ajouter à l’écran d’accueil**.

### Android (Chrome)
1. Ouvre le site.
2. Menu ⋮ → **Installer l’application** ou **Ajouter à l’écran d’accueil**.

---

## 🌍 Déploiement sur GitHub Pages

1. Crée un repo (ex: `darts-counter`)
2. Ajoute les fichiers :
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.webmanifest`
   - `sw.js`
3. Dans GitHub : **Settings → Pages**
4. Source : `main` / `(root)`
5. L’URL sera du type :
   - `https://TON_PSEUDO.github.io/darts-counter/`

⚠️ **Important :** la PWA fonctionne mieux en **HTTPS** (GitHub Pages est parfait pour ça).

---

## 🧠 Règles de score (résumé)

### Bull / 25
- **25** = Outer bull = **25 points**
- **Bull (50)** = Bullseye = **50 points** = **D25**  
  (et donc valide pour **double-out**)

### Bust (x01)
- Si le score descend **sous 0** → bust (score inchangé)
- En **double-out** :
  - si tu laisses **1** → bust
  - si tu arrives à **0** sans finir par une **double** → bust

---

## 🛠️ Développement local (optionnel)

L’app est statique, donc un simple serveur local suffit.

### Avec Node (recommandé si pas de Python)
1. Installe Node.js (LTS)
2. Dans un terminal :
   ```bash
   npm install -g http-server
