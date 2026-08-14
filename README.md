# Rural Bridge

Cross-domain health and agriculture risk detection for rural blocks.

Two feeds join on a shared spatial-temporal key. A pesticide application record
and a dermal symptom report each mean little on their own; put them in the same
row and they become an early warning. A health system cannot see the
applications and an agriculture system cannot see the symptoms, so neither can
raise the flag alone. That join is the product.

Demo geography is Yavatmal district, Maharashtra, the site of a widely reported
2017 organophosphate poisoning cluster among cotton farmers.

---

## Deploy it (about 15 minutes)

You need free accounts on Neon, OpenWeather and Vercel.

### 1. OpenWeather first

Register at <https://openweathermap.org/api> and copy the API key. **Do this
before anything else**: a new key can take up to an hour to activate, and it is
the only step with a clock on it.

### 2. Neon Postgres

Create a project at <https://neon.tech>. From the dashboard copy the **pooled**
connection string. It looks like:

```
postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

### 3. Push and import

Create the GitHub repo, push this tree, then import it at
<https://vercel.com/new>. Vercel detects Vite on its own; leave the build
settings alone.

### 4. Set the environment variables before the first deploy

In the Vercel project, under Settings then Environment Variables, add all three
to **Production, Preview and Development**:

| Name | Value |
|---|---|
| `DATABASE_URL` | the pooled Neon string from step 2 |
| `OPENWEATHER_KEY` | the key from step 1 |
| `SEED_TOKEN` | any long random string you invent |

Then deploy.

### 5. Check the deploy before writing anything to it

```bash
curl https://YOUR-APP.vercel.app/api/status
```

Expect `"ok": true` and `"driver": "neon"`. If a variable is missing this tells
you exactly which one, without printing its value. Fix and redeploy before
continuing.

### 6. Seed the database, once

```bash
curl -X POST https://YOUR-APP.vercel.app/api/seed -H "x-seed-token: YOUR_SEED_TOKEN"
```

Expect roughly 10 blocks, 233 health records, 125 agri records and 350 weather
rows. This deletes everything first, so do not run it during a demo.

### 7. Pull live weather

```bash
curl https://YOUR-APP.vercel.app/api/weather
```

Overwrites today and the next five days per block with real OpenWeather data.
Days before today stay synthetic: the free tier does not serve history.

### 8. Confirm

```bash
curl https://YOUR-APP.vercel.app/api/correlations | head -40
```

Four flags, composite first. Open the app, choose Block officer, and you should
see Ner, Kalamb, Ghatanji and Ralegaon flagged with six blocks below threshold.

---

## Run it locally

No accounts needed. With `DATABASE_URL` unset the whole stack runs on PGlite,
which is real Postgres compiled to WASM, in `./.pglite`.

```bash
npm install
npm run icons
npm run db:seed
npm run api:dev
```

Then in a second terminal:

```bash
npm run dev
```

The Vite dev server proxies `/api` to the local API on port 5174.

**One local gotcha.** PGlite is single-process, so `npm run db:seed` fails while
`npm run api:dev` is holding `./.pglite`. Either stop the API first, or re-seed
through the running server, which needs no token locally:

```bash
curl -X POST "http://127.0.0.1:5174/api/seed?as_of=2026-08-14"
```

Do this to wipe demo captures and get the seeded data back to a known state
before rehearsing. Neon has no such restriction.

---

## Verify the claims

Do not take any of these on faith. Each one has a command.

**The engine flags exactly the rigged blocks and stays silent elsewhere.**

```bash
npm run engine:test
```

Five blocks are deliberately rigged in `shared/seed.ts`: three for exposure, one
for heat, and one that spikes its applications but keeps symptoms below the
floor. That last one is the important assertion. It proves the engine says no.

**The database round trip does not change the answer.**

```bash
npm run db:seed
```

Seeds, reads back out, and reruns the engine on the database's own rows.

**Sync is idempotent.**

Post the same op three times and check the row count moves once:

```bash
curl -X POST http://127.0.0.1:5174/api/sync -H "Content-Type: application/json" -d '{"ops":[{"op_id":"demo-1","kind":"health","block_id":"LGD4162","device_id":"d1","seq":1,"created_at":"2026-08-14T09:00:00Z","payload":{"observed_on":"2026-08-14","symptom_category":"dermal","severity":2,"age_band":"18 to 40","reporter_id":"ASHA-4162-1"}}]}'
```

First call returns `accepted`, the rest return `duplicates`, and
`/api/status` shows the health count moved by exactly one.

**Offline capture survives a force-kill.** This one needs a real device. Install
the PWA, turn on airplane mode, capture a record, kill the app from the task
switcher, reopen it. The record is still in the outbox.

---

## Layout

```
shared/     engine, schema, seed, types. Imported by the browser, the
            serverless functions and the scripts, so there is one definition
            of each rule and one definition of each query.
api/        Vercel Node functions. Underscore-prefixed files are not routed.
src/        React PWA. screens/ are routed, components/ are shared.
scripts/    seed, engine test, icon generation, local API server.
docs/       build blueprint
```

## Stack, and why

| Layer | Choice | Reason |
|---|---|---|
| App | React 19 + Vite + TS | Smallest output, no framework server to deploy |
| Offline | Dexie over IndexedDB | Append-only op log with a live-query hook |
| Styling | Tailwind v4 | Tokens live in one CSS block, no config file |
| API | Vercel Functions | Same repo, same deploy, no CORS, fast cold start |
| Database | Neon Postgres | Real Postgres over HTTP, no pool to tune in serverless |
| Local DB | PGlite | Same dialect, so everything is verifiable with no account |
| Engine | Plain TS module | Testable from the command line before any UI exists |
| Voice | Web Speech API | No signup, no key, works in Chrome on Android |
| Charts | Hand-built SVG | Two sparklines do not justify 90 KB of charting library |
| Routing | 20 lines of hash routing | Eight screens do not justify a router |

The original plan specified FastAPI and Postgres. The prototype runs the API as
TypeScript serverless functions in the same Vercel project instead. One
deployable rather than two removes CORS, a second dashboard, a second set of
environment variables, and a free-tier Python host that cold-starts for 30 to 50
seconds, which is long enough to kill a live demo. The API surface is unchanged.
If the architecture slide shows FastAPI as the production target, say plainly
which one is deployed.

## What is real and what is not

| Component | Status |
|---|---|
| Offline capture and op log | Real, in IndexedDB on the viewer's own device |
| Sync and idempotency | Real, against live Postgres |
| Correlation engine | Real logic over synthetic data |
| Weather and heat index | Real, live OpenWeather, today forward only |
| Health and agri records | Synthetic, generated across 60 days |
| AgriStack feed | Schema-correct adapter. Third-party API access is not publicly available |
| ABHA and FHIR | Adapter shape only. Sandbox onboarding does not gate the prototype |
| Voice | Real, browser Web Speech. Sarvam sits behind a one-file adapter |
| Advisory dispatch | Stubbed. Records intent locally, contacts nobody |

Volunteer this table before anyone asks. Getting caught overstating an
integration is fatal; disclosing it costs nothing.
