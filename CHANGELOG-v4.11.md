# Finance AI OS — v4.11

## Ce qui était cassé
v4.10 avait corrigé l'écran **Cloud Sync**, mais il restait des **chaînes françaises codées en dur** dans le reste de l'app — visibles même quand l'utilisateur a sélectionné Espagnol / Anglais / Portugais :

- Tous les `alert()` et `confirm()` hors-cloud (clé Groq, suppression catégorie, modal transfert, permissions notifications, wipe data, import/export, dépôt/retrait objectifs…)
- Les **titres de modales** ("Nouvelle catégorie", "Nouvel objectif", "Virement", "Code de sauvegarde", "Restaurer"…)
- Les **boutons d'action** ("Créer", "Enregistrer", "Supprimer", "Transférer", "Reprendre", "Mettre de côté"…)
- Les **options `<select>`** ("Dépense", "Revenu")
- Les **toasts** ("✓ X mis de côté pour Y")
- Les **messages d'erreur templatés** (solde insuffisant détaillé, repousser d'un objectif, suppression objectif avec épargne…)

Et l'IA Ivy ne **distinguait pas explicitement** les comptes principaux du compte épargne dans son raisonnement.

## Ce qui est corrigé

### 1. i18n — couverture totale
- **+~50 clés par langue** (× FR/EN/ES/PT) injectées au début de chaque bloc i18n (marqueur `// === v4.11 hardcoded FR → i18n full coverage ===`).
- Toutes les chaînes ci-dessus passent désormais par `t('key')` avec substitution `{placeholder}` pour les variables (montants, noms de comptes, etc.).
- Couvre : Groq (clé invalide / enregistrée / erreurs API / mode sandbox / hors-ligne), transactions (virement, sélection, solde, friction prédictive), comptes (suppression), catégories (création/édition/suppression/doublon), objectifs (création/dépôt/retrait/suppression-avec-épargne), virement standalone, devise, notifs (non supportées/bloquées/refusées/test/démo), import/export (copie, restauration OK/KO, wipe), IndexedDB, modales rapides IA (hors ligne / sans clé), tous les titres + boutons + intros + helpers des modales.

### 2. IA Ivy — conscience comptable & catégorielle
- `buildCtx()` enrichi :
  - Chaque compte porte maintenant `role` (`COMPTE_ACTIF` vs `EPARGNE_VERROUILLEE`) et un flag `estPrincipal`.
  - Nouveaux résumés agrégés : `comptesPrincipauxResume.totalDisponible` (vrai cash dépensable) et `comptesEpargneResume.totalEpargne` (réserves verrouillées).
  - Nouveau champ `toutesLesCategories` (id, nom, icône, type) — l'IA connaît désormais TOUTES les catégories créées, pas seulement le top 5 du mois.
- **Prompt système renforcé** (5 nouvelles règles) :
  - Règle 2 : *Account awareness non-négociable* — Ivy doit traiter l'épargne comme sacrée, jamais confondre actif vs épargne, et toujours distinguer les deux quand on demande "combien j'ai".
  - Règle 3 : *Category awareness* — référence les catégories par leur vrai nom, n'en invente pas.
  - Règle 5 : *Logical, not emotional* — chaque affirmation doit tracer vers un nombre de la donnée. Pas de vibes. Si `dataDays<14`, le dire et raisonner uniquement sur ce qui existe.
  - Règle 11 (mise à jour) : l'ordre concret peut être un transfert recommandé (actif → épargne ou inverse) quand ça sert l'objectif prioritaire.

### 3. Versions bumpées
- `sw.js` : `finance-ai-v4.10` → `finance-ai-v4.11` (force le rafraîchissement du cache SWR).
- `manifest.json` : `id: "/?v=4.10"` → `"/?v=4.11"`.

## Déploiement
Drop ces fichiers à la racine de ton hébergement (remplace l'existant). Au prochain chargement, le SW détecte le nouveau nom de cache, installe la nouvelle coquille, et `clients.claim()` la page active. Un hard-refresh une fois si tu veux que ce soit instantané.

## Fichiers inclus
- `index.html` — patché (i18n + IA enrichie)
- `sw.js` — v4.11
- `manifest.json` — v4.11
- `icon-96.png`, `icon-192.png`, `icon-512.png` — inchangés

## Vérification rapide
Après chargement, change la langue dans Paramètres → Espagnol par exemple, puis :
1. Va dans la **clé Groq** → entre n'importe quoi → tu dois voir le message en ES.
2. Crée une catégorie en double → confirm en ES.
3. Tente une dépense supérieure au solde → alert templatée en ES.
4. Pose à Ivy : *"¿Cuánto tengo?"* → elle doit distinguer **total disponible** vs **total ahorrado** et nommer chaque compte.

## Hors-scope (à confirmer si nécessaire)
Les commentaires JS internes (`// Comptes ─────`, `// Revenus attendus`…) restent en français — invisibles pour l'utilisateur, aucun impact UX. Si tu veux du code 100% anglophone pour l'export/contribution, dis-le moi et je passe une v4.12.
