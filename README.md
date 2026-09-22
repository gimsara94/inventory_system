# Workshop Inventory — React, Express, Supabase PostgreSQL

This new version has a React interface and an Express API backed by Supabase PostgreSQL. The old Flask/SQLite app remains in `../workshop-inventory` and is not used by this version. Existing SQLite data is not imported automatically.

## Set up

1. Create a Supabase project and copy its **Postgres session pooler connection string** from Database connection settings. Replace its password placeholder with the real database password; URL-encode any special characters in that password. The public Supabase URL and publishable key are not database credentials. The backend verifies TLS with Supabase's root CA certificate in `backend/certs/`.
2. Add the values from `backend/.env.example` to `backend/.env` (or copy the example if `.env` does not exist). Set a random `JWT_SECRET` of at least 32 bytes and `INVENTORY_ORIGIN`. Copy `backend/.env.migrate.example` to `backend/.env.migrate` and set `MIGRATION_DATABASE_URL` to the privileged Postgres connection string. Keep both files private; they are ignored by Git.
3. From `backend/`, run `npm install`, then `npm run migrate`. The migrations create the private `inventory` schema, users, items, stock movements, login attempt tables, and a restricted PostgreSQL role. They are tracked and safe to rerun. The SQL is also in `supabase/migrations/` for Supabase CLI workflows.
4. From `backend/`, run `npm run setup-app-role`. This generates a separate database password and writes `APP_DATABASE_URL` to the private `.env` file. The API requires this limited credential; `MIGRATION_DATABASE_URL` is loaded only by the migration and role setup scripts.
5. From `backend/`, run `npm run bootstrap-admin` and enter the first admin's email, name and password. This works only while the users table is empty. The password must be 12–200 characters.
6. From `backend/`, run `npm run dev`. In another terminal, from `frontend/`, run `npm install` and `npm run dev`. Open `http://localhost:5173`.

For production, run `npm run build` in `frontend/`, set `NODE_ENV=production` and `INVENTORY_ORIGIN` to the public HTTPS origin, then run `npm start` in `backend/`. Express serves `frontend/dist`. Use HTTPS at the reverse proxy. Deploy only the runtime `.env` file; keep `.env.migrate` on an administrator's machine. Do not put database credentials or `JWT_SECRET` in the frontend.

The migration cannot be applied using the Supabase publishable key. `MIGRATION_DATABASE_URL` must be available to the migration process. The API uses only `APP_DATABASE_URL` at runtime.

If `npm run migrate` reports `ENOTFOUND` or `EHOSTUNREACH` for `db.<project-ref>.supabase.co`, the direct connection is IPv6-only and your network cannot reach it. In Supabase Dashboard, click **Connect**, select **Session pooler**, and replace `MIGRATION_DATABASE_URL` with that entire connection string. Keep its port `5432` and replace its password placeholder. The pooler hostname varies by project; copy it rather than guessing.

## Backend structure

The backend follows a routes, middleware, controllers, and models structure:

```text
backend/src/
├── config/          Environment configuration
├── controllers/     HTTP input, responses, and business rules
├── db/              PostgreSQL pool and transaction helper
├── middleware/      Authentication, CSRF, origin, and error handling
├── models/          Parameterized PostgreSQL queries
├── routes/          Endpoint paths and controller mapping
├── utils/           Passwords, validation, and response presenters
├── app.js           Express application setup
└── server.js        Runtime entry point
```

Requests flow from a route through the authentication and security middleware to a controller. The controller validates the request and coordinates a transaction. Models perform the database queries and return rows to the controller.

## React interface

The responsive React interface keeps the original workshop workflow and adds:

- Desktop tables that become touch-friendly cards on phones and tablets
- Inventory search, category, low-stock, and archived filters
- Quick −/amount/+ controls that reset to 1 after each successful change, plus full receipt, issue, and correction forms
- Item-specific and date-filtered movement history
- CSV export and print views for inventory and movement reports
- Admin user management with clear role and account status indicators
- Accessible dialogs, keyboard focus, status messages, and reduced-motion support

The frontend is organized into `components`, `hooks`, `services`, and `utils` under `frontend/src`.

## Accounts and security

- The first admin is created from the server terminal. There is no public sign-up endpoint. Only an admin can create, disable, re-enable, or change users through `/api/users`.
- Passwords use salted Node.js `scrypt` with a work factor of `N=16384, r=8, p=5`. Older hashes remain valid and upgrade after a successful sign-in. Login attempts are limited per account and per IP in PostgreSQL.
- Sign-in issues a 12-hour HS256 JWT in an HttpOnly, SameSite=Strict cookie. Its CSRF token must accompany browser changes. Each authenticated request checks the current user and token version in PostgreSQL, so disabling an account or changing its password invalidates existing tokens.
- The database tables are in the private `inventory` schema, with access revoked from Supabase `anon` and `authenticated` roles and RLS enabled. The browser calls the Express API; it does not connect directly to PostgreSQL.
- Runtime database queries use the limited `inventory_app` role. It has only the table operations the API needs and cannot read Supabase Auth or migration records. The privileged URL is kept in `.env.migrate`, which the web server does not load.
- PostgreSQL connections verify the Supabase root CA and pooler hostname. If your project uses a different CA, set `DATABASE_CA_CERT` to the path of the certificate downloaded from Supabase Database Settings.
- Inventory quantity is stored as integer thousandths and money as integer cents. Stock changes use row locks and a unique request ID to prevent lost updates and double counting.
- SQL values are bound as PostgreSQL parameters. Search wildcards are escaped, item IDs are validated, and browser writes require a CSRF token and a trusted origin.

## API

All paths start with `/api`. Browser requests send the JWT cookie and the `X-CSRF-Token` returned by sign-in or `/auth/me` for writes. All responses are JSON.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Sign in with `email`, `password` |
| GET | `/auth/me` | Current user and CSRF token |
| POST | `/auth/logout` | Clear session |
| GET | `/items` | List items; optional `q`, `category`, `low=1`, `archived=1` |
| GET | `/items/:id` | Read one item |
| POST | `/items` | Add an item with optional opening quantity |
| PUT | `/items/:id` | Edit details with current `version` |
| POST | `/items/:id/adjust` | Add or remove stock with signed `change`, `kind`, `reason`, unique `request_id` |
| POST | `/items/:id/archive` | Archive or restore with `archived: true/false`; archive requires zero stock |
| GET | `/summary` | Counts and stock value |
| GET | `/movements` | Latest 500 movements; optional `item_id` |
| GET | `/users` | List users; admin only |
| POST | `/users` | Create admin or staff user; admin only |
| PATCH | `/users/:id` | Change name, role, active state, or password; admin only |

Example add item body:

```json
{"name":"M8 bolt","sku":"M8-BOLT","category":"Fasteners","unit":"pcs","quantity":"10","minimum":"2","unit_cost":"0.50","location":"Rack A"}
```

Example stock removal body:

```json
{"change":"-1","kind":"issue","reason":"Used in assembly","request_id":"7ef75699-8f71-4a92-9acb-32c683bb5bf6"}
```

Use a new random request ID for each distinct stock operation and reuse the same ID if retrying that operation. The UI has a quick quantity field between the − and + buttons, and a stock form for detailed movements.

## Deploy from GitHub

Deploy this repository as one Node application with its working directory set to `backend/`. Build the frontend first with `npm ci && npm run build` in `frontend/`, then install backend dependencies with `npm ci --omit=dev` in `backend/` and start it with `npm start`. Express serves `frontend/dist` and the API from the same origin.

Set `APP_DATABASE_URL`, `JWT_SECRET`, `INVENTORY_ORIGIN`, and `NODE_ENV=production` as server environment variables. `INVENTORY_ORIGIN` must exactly match the public HTTPS origin, including the hostname. The older `PUBLIC_ORIGIN` name still works when `INVENTORY_ORIGIN` is absent. Do not set `MIGRATION_DATABASE_URL` or `DATABASE_URL` in the web server environment; use `.env.migrate` only on an administrator's machine when running migrations. Run the migrations and `setup-app-role` once against the Supabase project before the first deployment, and create the first admin with `bootstrap-admin`. The runtime role credential produced by `setup-app-role` belongs in the host's private `APP_DATABASE_URL` variable.

GitHub stores the source and runs the tests in `.github/workflows/test.yml`; it does not host the Express process or PostgreSQL database by itself. Keep `backend/.env` and `backend/.env.migrate` local. Both are excluded from Git.

### Deploy on Vercel

Vercel ignores `express.static()`, so create **two Vercel projects** from this GitHub repository. The root `backend/app.js` exports the Express app for Vercel. The React build is deployed separately. A rewrite on the frontend project keeps browser requests to `/api` on the frontend domain, where the session cookie is stored.

1. Run the migrations, `setup-app-role`, and `bootstrap-admin` locally as described above if you have not already done so. The Vercel function must use the limited `APP_DATABASE_URL`; never give it `MIGRATION_DATABASE_URL` or `DATABASE_URL`.
2. In Vercel, import `gimsara94/inventory_system` as a web project. Set **Root Directory** to `frontend` and select the **Vite** preset. Build Command is `npm run build`, Output Directory is `dist`. Deploy and note its stable production URL, such as `https://your-web-project.vercel.app`.
3. Import the same repository again as a separate API project. Set **Root Directory** to `backend` and select the **Express** framework preset if Vercel asks. Before deploying, set these Production environment variables under Project Settings → Environment Variables: `APP_DATABASE_URL` and `JWT_SECRET` from the private `backend/.env` file (mark both sensitive), `NODE_ENV=production`, and `INVENTORY_ORIGIN` equal to the exact frontend production URL (scheme and hostname, no trailing slash). Use the Config type for `INVENTORY_ORIGIN`; its value is a public URL, and its name avoids Vercel's special treatment of the `PUBLIC_` prefix. The runtime `APP_DATABASE_URL` must use the Supabase pooler, not an IPv6-only direct host. Never paste database secrets into Git or the frontend project. Deploy and note the API project's stable production URL.
4. In the web project's **CDN → Routing** settings, publish a rewrite from `/api/:path*` to `https://your-api-project.vercel.app/api/:path*`. Use the API project's stable production URL, not a preview URL. If you prefer version-controlled routing, add the same rewrite to `frontend/vercel.json` and redeploy the web project.
5. Visit `https://your-web-project.vercel.app/api/health`; it should return `{"status":"ok"}`. Then open the web URL, sign in as the first admin, add an item, and adjust its stock. Vercel Preview URLs have different origins, so browser login on previews requires a matching `INVENTORY_ORIGIN` setup; this recipe targets the stable production URL.

Vercel environment variable changes affect new deployments, so redeploy after setting or updating them. All API responses use `Cache-Control: no-store`; leave API caching disabled in the routing rule.

## Verification

From `backend/`, run the complete automated test suite:

```bash
npm test
```

The suite covers authentication, JWT cookies, CSRF, trusted origins, login throttling, admin permissions, password storage, item operations, stock adjustments, idempotent retries, movement history, archiving, SQL injection defenses, validation, RLS declarations, and restricted database grants. API tests replace the database pool with an isolated in-memory test database, so they never read or modify the configured Supabase project.

Individual groups can also be run separately:

```bash
npm run test:unit
npm run test:security
npm run test:api
npm run test:watch
```

From `frontend/`, run `npm test` and `npm run build`. The GitHub Actions workflow in `.github/workflows/test.yml` runs both backend and frontend tests plus the production frontend build automatically for every push and pull request.
