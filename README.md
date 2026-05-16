# Finance AI OS — v4.8

## Changements v4.8
- **i18n complète** : tous les écrans (Accueil, Analyse, Réglages, IA, Alertes) traduits FR/EN/ES/PT.
- **Comptes & catégories par défaut** affichés dans la langue choisie partout (Réglages inclus).
- **IA online (Groq) + offline (locale)** répondent toujours dans la langue active.
- **Manifest fullscreen** + `display_override` → l'app s'ouvre sans barre Chrome (PWA Builder OK).
- **Service Worker v4.8** (nouveau cache, anciens nettoyés).

## Déploiement
1. Pousser `index.html`, `sw.js`, `manifest.json`, `icon-96.png`, `icon-192.png`, `icon-512.png` à la racine du repo GitHub.
2. Netlify rebuild auto.
3. Désinstaller l'ancienne PWA sur le téléphone, recharger le site, réinstaller (sinon l'ancien manifest reste épinglé).
4. Google Cloud Console → OAuth → Origines JavaScript autorisées : `https://financeai2.netlify.app`.

## Google OAuth
Client ID intégré : `548605771267-a8nskjhah481vb3n60t6liibl8i7ia6h.apps.googleusercontent.com`
