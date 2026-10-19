# MA Workspace : frontend (Mindset Alliance)

Interface web de **MA Workspace**, la console interne de **Mindset Alliance**,
et **site vitrine public** de Mindset Alliance.

| | |
|---|---|
| Framework | React 19 + TypeScript, Vite |
| Style | Tailwind CSS v4, animations `motion` |
| Données | TanStack Query, Zustand, React Hook Form + Zod |
| Graphiques | Recharts |
| Cartes | Google Maps JavaScript API + Directions API |
| Langues | français, anglais, lingala, swahili (i18next) |
| Qualité | oxlint, Vitest + Testing Library |
| Port de développement | `5173` |
| Backend associé | [Backend_MindSetAlliance](https://github.com/sharo8/Backend_MindSetAlliance) (MA Core, port 8081) |

---

## Sommaire

1. [Démarrage rapide](#1-démarrage-rapide)
2. [Configuration (.env.local et clé Google Maps)](#2-configuration-envlocal-et-clé-google-maps)
3. [Scripts](#3-scripts)
4. [Structure du code](#4-structure-du-code)
5. [Connexion, rôles et espaces par projet](#5-connexion-rôles-et-espaces-par-projet)
6. [Pages et routes](#6-pages-et-routes)
7. [Espace Colis na Nga](#7-espace-colis-na-nga)
8. [Site vitrine](#8-site-vitrine)
9. [Langues (i18n)](#9-langues-i18n)
10. [Design](#10-design)
11. [Dépannage](#11-dépannage)
12. [Règles de contribution](#12-règles-de-contribution)

---

## 1. Démarrage rapide

Prérequis : Node.js 22 (LTS) ou plus récent, et le backend MA Core lancé sur `http://localhost:8081`
(voir son README).

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:5173`.

- Visiteur non connecté : le site vitrine (`/bienvenue`), avec le bouton vers la connexion.
- Connexion : `/connexion` (e-mail, mot de passe, puis code à 6 chiffres reçu par e-mail).
  Il n'existe **aucun compte de démonstration** : les comptes sont créés par un administrateur
  dans **Administration → Utilisateurs**.

En développement, Vite redirige `/api/**` vers `http://localhost:8081` (voir `vite.config.ts`).
Aucune URL de backend n'est à configurer.

---

## 2. Configuration (.env.local et clé Google Maps)

Une seule variable : la clé web Google Maps, utilisée par la carte Colis na Nga.

Créer `frontend/.env.local` (ignoré par Git grâce à la règle `*.local`) :

```
VITE_GOOGLE_MAPS_API_KEY=<votre clé web>
```

Obtenir et sécuriser la clé (Google Cloud, projet `colis-na-ngai`) :

1. **API et services → Bibliothèque** : activer **Maps JavaScript API** et **Directions API**.
2. **API et services → Identifiants → Créer une clé API**.
3. Restriction d'application : **Sites web**, ajouter `http://localhost:5173/*` (et le domaine de production).
4. Restriction d'API : cocher **Maps JavaScript API** et **Directions API** (elles n'apparaissent dans la liste qu'une fois activées à l'étape 1).
5. Relancer `npm run dev` après toute modification de `.env.local`.

Sans clé, la carte affiche un message ; le reste de l'application fonctionne.
Ne jamais commiter la clé ni la coller dans le code.

---

## 3. Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement (port 5173) |
| `npm run build` | vérification TypeScript (`tsc -b`) puis build de production dans `dist/` |
| `npm run preview` | servir le build localement |
| `npm run lint` | analyse oxlint |
| `npm test` | tests Vitest (dont la parité des clés de traduction) |
| `node scripts/fill-missing-locale-keys.mjs` | ajoute dans chaque langue les clés manquantes |

Avant chaque commit : `npx tsc -b && npm run lint && npm test`.

---

## 4. Structure du code

```
frontend/
├── index.html
├── vite.config.ts            proxy /api → 8081, alias @ → src
├── public/                   icônes, images statiques
├── scripts/                  outils (clés de traduction)
└── src/
    ├── main.tsx              point d'entrée
    ├── index.css             thème Tailwind, couleurs clair/sombre, effets (carte, vitrine)
    ├── app/App.tsx           toutes les routes
    ├── components/
    │   ├── layout/           AppLayout, menu latéral, barre mobile, panneaux langue/apparence
    │   ├── ui/               boutons, cartes, tableaux, modales, badges, drapeaux (flags.tsx)…
    │   ├── charts/           graphiques partagés
    │   └── motion/           animations réutilisables
    ├── lib/
    │   ├── api/              clients HTTP par domaine (auth, tickets, cnnAdmin, reports…)
    │   ├── auth/             session, jetons, garde des routes
    │   ├── rbac/             menus, permissions, espaces par projet
    │   ├── maps/google.ts    chargement Google Maps, routeThrough, pathLengthKm
    │   ├── i18n/             configuration i18next
    │   ├── theme/            mode clair / sombre
    │   ├── projects/, vitrine/
    │   └── utils.ts
    ├── locales/              fr.json, en.json, ln.json, sw.json
    ├── features/
    │   ├── site/             site vitrine public (SitePage, Constellation)
    │   ├── auth/             connexion, 2FA, première connexion, mot de passe, mon compte
    │   ├── projects/         accueil
    │   ├── cnnadmin/         espace Colis na Nga (voir section 7)
    │   ├── admin/            sociétés, utilisateurs, départements, accès, permissions, audit, rapports, assistant IA, statistiques
    │   ├── tickets/          billetterie
    │   ├── hr/, finance/, commercial/, ops/, dashboard-direction/, mindsetduroyaume/
    └── test/setup.ts
```

---

## 5. Connexion, rôles et espaces par projet

- Les jetons MA (RS256) sont émis par MA Core. Le jeton d'accès dure 15 minutes et se renouvelle automatiquement.
- **Permissions** : chaque entrée de menu déclare ses permissions dans `lib/rbac/rbac.ts`.
  Les actions VIEW / CREATE / UPDATE / DELETE masquent ou affichent les boutons correspondants.
- **Espaces par projet** : le sélecteur de projet change tout l'écran (menu, pages, accueil).
  Le champ `workspaces` de chaque entrée de menu indique où elle apparaît :

  | Espace | Contenu |
  |---|---|
  | `ENTREPRISE` (Toute l'entreprise) | billetterie, commercial, finance, RH, juridique, marketing, technique, direction, administration, documents |
  | `CNN` (Colis na Nga) | tableau de bord, carte, statistiques, commandes, clients, livreurs, motards, associations, abonnements et crédits, signalements et incidents, tarification |
  | `MDR` (Mindset du Royaume) | accueil du projet, vue média |

  Changer de projet ramène à l'accueil du projet choisi.

---

## 6. Pages et routes

| Route | Page |
|---|---|
| `/bienvenue` | site vitrine public |
| `/connexion`, `/mot-de-passe-oublie`, `/premiere-connexion`, `/definir-mot-de-passe` | authentification |
| `/` | accueil (tableau de bord Colis na Nga dans l'espace CNN) |
| `/compte` | mon compte |
| `/tickets`, `/tickets/:id`, `/tickets-techniques`, `/technique/bugs` | billetterie |
| `/direction` | tableau de bord de la direction |
| `/rh`, `/rh/agents`, `/rh/conges`, `/rh/paie` | ressources humaines |
| `/finance`, `/finance/abonnements`, `/finance/facturation`, `/finance/b2c` | finance |
| `/commercial`, `/commercial/coursiers`, `/commercial/entreprises` | commercial |
| `/juridique/partenaires`, `/juridique/conformite` | juridique |
| `/marketing/performance`, `/marketing/mediatheque` | marketing |
| `/technique/monitoring` | technique |
| `/documents` | documents |
| `/supervision/cnn`, `/supervision/mdr` | supervision des projets |
| `/colis-na-nga/...` | espace Colis na Nga (section 7) |
| `/admin`, `/admin/societes`, `/admin/utilisateurs`, `/admin/departements`, `/admin/acces`, `/admin/permissions`, `/admin/audit`, `/admin/rapports`, `/admin/assistant-ia`, `/admin/statistiques` | administration |

---

## 7. Espace Colis na Nga

Toutes les données sont **réelles** : lues dans la base Colis na Nga par MA Core, modifiées via
l'API admin de Colis na Nga (relais). Détails côté serveur :
`docs/INTEGRATION-COLIS-NA-NGA.md` dans le dépôt backend.

| Route | Fichier | Contenu |
|---|---|---|
| `/` (espace CNN) | `CnnDashboard.tsx` | indicateurs du jour, taux USD → FC avec drapeaux |
| `/colis-na-nga/carte` | `CnnLiveMapPage.tsx`, `CnnTrace.tsx` | positions en direct (toutes les 5 s) et onglet « Itinéraires » : trajet de chaque commande passée, en cours ou à venir |
| `/colis-na-nga/statistiques` | `CnnStatsPage.tsx` | 7, 30, 90 ou 365 jours, comparaison à la période précédente |
| `/colis-na-nga/commandes` | `CnnOrdersPage.tsx` | commandes, statuts, lien vers l'itinéraire |
| `/colis-na-nga/clients` | `CnnClientsPage.tsx` | clients ponctuels et abonnés, activité, fiche avec toutes les commandes |
| `/colis-na-nga/livreurs` | `CnnAgentsPage.tsx` | livreurs |
| `/colis-na-nga/motards` | `CnnMotardsPage.tsx` | motards partenaires |
| `/colis-na-nga/associations` | `CnnAssociationsPage.tsx` | associations et leurs motards |
| `/colis-na-nga/abonnements` | `CnnSubscriptionsPage.tsx`, `SubscriptionPlanModal.tsx` | formules (même formulaire que l'admin de l'application), clients abonnés, factures, crédits motards |
| `/colis-na-nga/incidents` | `CnnIncidentsPage.tsx` | signalements des motards, appels et contact d'urgence, remboursements |
| `/colis-na-nga/tarification` | `CnnPricingPage.tsx` | tarifs et simulateur (USD → FC, plancher 4 000 FC, supplément poids) |

Points techniques :

- API : `lib/api/cnnAdmin.ts` (`/api/cnn/lecture/**` pour lire, `/api/cnn/admin/**` pour modifier).
- Les boutons de modification n'apparaissent que si `GET /api/cnn/admin-relay/status` renvoie `relayReady: true`
  et que l'agent a l'action correspondante.
- Itinéraires : le trajet GPS enregistré est aligné sur les routes avec l'API Directions (`routeThrough`),
  repli sur les points bruts ; départ, arrêts et livraison ont des repères animés visibles en mode clair et sombre.
- Les dates de l'API admin Colis na Nga arrivent sans fuseau : `parseCnnDate` les lit en UTC.
- Monnaies affichées : dollar américain et franc congolais uniquement (`components/ui/flags.tsx`).

---

## 8. Site vitrine

- Route publique `/bienvenue` (`features/site/SitePage.tsx`). Un visiteur non connecté qui ouvre `/` y est envoyé.
- Fond animé « constellation » (`Constellation.tsx`, canvas 2D) qui réagit au pointeur, se met en pause hors de l'écran
  et respecte la préférence « réduire les animations ».
- Présente Mindset Alliance, ses projets (Colis na Nga, Mindset du Royaume, représenté par son sigle « MDR »),
  avec un bouton vers `/connexion`. La page de connexion a un lien « Retour à l'accueil ».
- Textes dans `locales/*.json` (clés `site.*`), modes clair et sombre, sélecteur de langue.

---

## 9. Langues (i18n)

- Fichiers : `src/locales/fr.json` (référence), `en.json`, `ln.json`, `sw.json`.
- Le test `lib/i18n/locale-parity.test.ts` échoue si une clé manque dans une langue.
- Les noms **Mindset Alliance**, **MA Workspace**, **Colis na Nga**, **Mindset du Royaume** ne se traduisent jamais.
- Pas de tiret long (—) dans les textes visibles.

---

## 10. Design

- Polices : Inter (texte) et Cinzel (titres de marque).
- Couleurs définies dans `index.css` (variables pour le mode clair et le mode sombre).
- Composants de base dans `components/ui/` : réutiliser `Button`, `Card`, `Modal`, `Table`, `Badge`, `StatCard`…
  avant d'en créer un nouveau.
- Animations avec `motion/react`, toujours désactivées si l'utilisateur a demandé moins d'animations.
- Mise en page adaptée au mobile (barre d'onglets en bas sur petit écran).

---

## 11. Dépannage

| Symptôme | Solution |
|---|---|
| Erreurs réseau sur `/api/...` | le backend MA Core ne tourne pas sur le port 8081 |
| Écrans Colis na Nga « indisponible » | proxy Cloud SQL arrêté côté backend (voir README backend) |
| Carte grise ou message de clé | `VITE_GOOGLE_MAPS_API_KEY` absente, ou `localhost:5173` non autorisé sur la clé |
| Itinéraire en ligne droite | Directions API non activée ou non cochée sur la clé |
| `npm test` échoue sur la parité | lancer `node scripts/fill-missing-locale-keys.mjs` puis traduire les nouvelles clés |
| Code 2FA jamais reçu (local) | backend lancé avec `MA_AUTH_DEMO_TOTP=true` : code `000000` |

---

## 12. Règles de contribution

- Aucune donnée inventée dans l'interface : une valeur absente s'affiche comme indisponible.
- Toute nouvelle page Colis na Nga passe par `lib/api/cnnAdmin.ts` et déclare sa permission dans `lib/rbac/rbac.ts`.
- Tout nouveau texte visible va dans les quatre fichiers de langue.
- Aucun secret dans Git (`.env.local` est ignoré).
- Branche principale : `main`.
