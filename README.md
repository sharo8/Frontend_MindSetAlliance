# MA Workspace — console web

Interface React de **MA Workspace** (Mindset Alliance). Elle parle uniquement au backend Core (`http://localhost:8081`), proxifié en développement via Vite.

## Démarrage

Le Core doit tourner (profil `local`, port 8081). Puis :

```bash
cd ma-workspace-web
npm install
npm run dev
```

Ouvrir `http://localhost:5173`.

## Comptes de démonstration

Mot de passe : `ChangeMe123!`  
Code 2FA : `000000`

| Compte | Attendu |
|---|---|
| `support.cnn@mindsetalliance.cd` | Pas de 2FA. Sélecteur et menu limités à Colis na Nga. |
| `direction@mindsetalliance.cd` | 2FA. Tableau de bord consolidé. Option « Toute l’entreprise ». |
| `admin@mindsetalliance.cd` | 2FA. Administration. |

## Jetons

Le Core renvoie `accessToken` / `refreshToken` dans le JSON (pas de cookie httpOnly). Les jetons sont stockés en `sessionStorage` et rafraîchis 2 minutes avant expiration (JWT 15 min).

## Tests

```bash
npm test
```
