# 🌾 KisanSaathi

**Cross-domain health & agriculture early-warning system for rural India.**

> A pesticide application record and a dermal symptom report each mean little on their own.
> Put them in the same row and they become an early warning.
> A health system cannot see the applications. An agriculture system cannot see the symptoms.
> **KisanSaathi bridges both.**

---

## 🚀 What It Does

KisanSaathi is a Progressive Web App that connects two isolated data streams — **agricultural input usage** and **community health observations** — to detect pesticide exposure risks before they become crises.

Built around the real-world geography of **Yavatmal district, Maharashtra**, the site of the widely reported 2017 organophosphate poisoning cluster among cotton farmers.

### Key Features

| Feature | Description |
|---|---|
| 🔗 **Cross-Domain Correlation Engine** | Rule-based engine that joins health symptom reports with agricultural pesticide application records on a shared spatial-temporal key to detect exposure spikes |
| 🌡️ **Live Weather & Heat Index** | Real-time weather data from [Open-Meteo](https://open-meteo.com) (no API key needed) — 60 past days + 7-day forecast with Rothfusz heat index calculation |
| 📴 **Offline-First Capture** | Full offline support via IndexedDB (Dexie). Records survive force-kills and sync automatically when connectivity returns |
| 🎙️ **Voice Input** | Web Speech API integration for symptom capture in Hindi, Marathi, and English — built for low-literacy field workers |
| 🌐 **Multilingual UI** | Complete Hindi (हिन्दी) and Marathi (मराठी) translations for all field-worker screens |
| 📊 **Officer Dashboard** | Real-time risk flag console with severity ranking, sparkline visualizations, and actionable recommendations |
| 🔄 **Idempotent Sync** | Append-only op log with deduplication — post the same operation three times, it moves the count once |
| 🛡️ **Privacy by Design** | DPDP Act 2023 alignment, consent management, no personal identifiers attached to health records |

---

## 🎯 How the Engine Works

The correlation engine runs three detection rules:

1. **Exposure Rule** — Detects spikes in WHO Class II pesticide applications (organophosphates, carbamates) followed by symptom clusters (dermal, respiratory, neurological) within a 6-day window, measured against a 49-day rolling baseline.

2. **Heat Rule** — Identifies sustained heat index runs ≥ 40°C that increase dermal absorption risk for field workers exposed to agrochemicals.

3. **Composite Rule** — The bridge itself. When exposure and heat overlap, severity is escalated because heat drives sweating and higher respiratory rates, increasing compound uptake. **Neither a health nor agriculture system can raise this flag alone.**

---

## 👥 User Roles

| Role | Path | Description |
|---|---|---|
| **ASHA Worker** | Field capture | Logs health visit observations (symptom type, severity, age band) with voice support |
| **Agri Worker** | Field capture | Logs pesticide/input applications (compound class, crop, area) |
| **Block Officer** | Dashboard | Reviews correlation flags, severity rankings, and recommended actions |

---

## 🛠️ Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| App | React 19 + Vite + TypeScript | Smallest output, no framework server to deploy |
| Offline | Dexie over IndexedDB | Append-only op log with live-query hooks |
| Styling | Tailwind CSS v4 | Tokens live in one CSS block, no config file |
| API | Vercel Serverless Functions | Same repo, same deploy, no CORS, fast cold start |
| Database | Neon Postgres | Real Postgres over HTTP, no pool to tune in serverless |
| Local DB | PGlite (WASM) | Same SQL dialect, fully verifiable with no account |
| Engine | Pure TypeScript module | Testable from command line before any UI exists |
| Voice | Web Speech API | No signup, no key, works in Chrome on Android |
| Charts | Hand-built SVG | Two sparklines don't justify 90 KB of charting library |
| Routing | 20 lines of hash routing | Eight screens don't justify a full router |

---

## ⚡ Quick Start (Local)

No accounts needed. With `DATABASE_URL` unset, the entire stack runs on **PGlite** (real Postgres compiled to WASM) in `./.pglite`.

```bash
# Install dependencies
npm install

# Generate icon assets
npm run icons

# Seed the local database
npm run db:seed

# Start the local API server (terminal 1)
npm run api:dev

# Start the Vite dev server (terminal 2)
npm run dev
```

The Vite dev server proxies `/api` to the local API on port `5174`.

### Local Tips

- **PGlite is single-process** — `npm run db:seed` will fail while `npm run api:dev` holds `./.pglite`. Either stop the API first, or re-seed through the running server:
  ```bash
  curl -X POST "http://127.0.0.1:5174/api/seed?as_of=2026-08-14"
  ```
- **If PGlite reports `Aborted()`**, its data directory was corrupted. It's disposable:
  ```bash
  rm -rf .pglite && npm run db:seed
  ```

---

## ☁️ Deploy to Vercel (~15 minutes)

You need free accounts on **Neon** and **Vercel**. That's all. **No weather API key required.**

### 1. Create a Neon Postgres Database

Sign up at [neon.tech](https://neon.tech) and copy the **pooled** connection string:
```
postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

### 2. Push & Import

Push this repo to GitHub, then import at [vercel.com/new](https://vercel.com/new). Vercel auto-detects Vite — leave build settings untouched.

### 3. Set Environment Variables

In Vercel → Settings → Environment Variables, add for **Production, Preview, and Development**:

| Name | Value |
|---|---|
| `DATABASE_URL` | Your pooled Neon connection string |
| `SEED_TOKEN` | Any long random string |

### 4. Verify Deployment

```bash
curl https://YOUR-APP.vercel.app/api/status
# Expect: "ok": true, "driver": "neon"
```

### 5. Seed the Database (once)

```bash
curl -X POST https://YOUR-APP.vercel.app/api/seed \
  -H "x-seed-token: YOUR_SEED_TOKEN"
# Expect: 10 blocks, 233 health records, 125 agri records, 350 weather rows
```

### 6. Confirm Correlations

```bash
curl https://YOUR-APP.vercel.app/api/correlations | head -40
# Four flags — composite first. Ner, Kalamb, Ghatanji, Ralegaon flagged.
```

---

## ✅ Verify the Claims

Every claim has a command. Don't take any on faith.

| Claim | Command | What It Proves |
|---|---|---|
| Engine flags rigged blocks, stays silent elsewhere | `npm run engine:test` | 5 rigged blocks: 3 for exposure, 1 for heat, 1 that spikes apps but keeps symptoms below floor (proves the engine says no) |
| Database round-trip preserves the answer | `npm run db:seed` | Seeds, reads back, reruns engine on database rows |
| Sync is idempotent | `curl -X POST .../api/sync ...` (see below) | First call returns `accepted`, repeats return `duplicates` |
| Offline capture survives force-kill | Install PWA → airplane mode → capture → kill app → reopen | Record persists in outbox |

<details>
<summary>Idempotency test command</summary>

```bash
curl -X POST http://127.0.0.1:5174/api/sync \
  -H "Content-Type: application/json" \
  -d '{
    "ops": [{
      "op_id": "demo-1",
      "kind": "health",
      "block_id": "LGD4162",
      "device_id": "d1",
      "seq": 1,
      "created_at": "2026-08-14T09:00:00Z",
      "payload": {
        "observed_on": "2026-08-14",
        "symptom_category": "dermal",
        "severity": 2,
        "age_band": "18 to 40",
        "reporter_id": "ASHA-4162-1"
      }
    }]
  }'
```

</details>

---

## 📁 Project Structure

```
KisanSaathi/
├── shared/          Engine, schema, seed data, types
│                    Imported by browser, serverless functions, and scripts
│                    One definition of each rule, one definition of each query
├── api/             Vercel Node serverless functions
│                    Underscore-prefixed files are not routed
├── src/             React PWA
│   ├── screens/     Routed screens (Dashboard, Capture, Sync, etc.)
│   ├── components/  Shared UI components
│   └── lib/         Client utilities (API, i18n, voice, sync, router)
├── scripts/         Seed, engine test, icon generation, local API server
├── docs/            Architecture docs, API reference, privacy policy, etc.
└── public/          Static assets and PWA manifest
```

---

## 📚 Documentation

| Document | Description |
|---|---|
| [Blueprint](docs/blueprint.html) | Visual overview: pipeline, eight screens, measured benchmarks |
| [Architecture](docs/ARCHITECTURE.md) | Data flow, design decisions, trade-offs, scaling notes |
| [Privacy](docs/PRIVACY.md) | DPDP Act 2023 mapping, data collection scope, known gaps |
| [API Reference](docs/API.md) | All six endpoints with request/response examples |
| [Business Model](docs/BUSINESS.md) | Revenue model, unit economics, beachhead market, risks |
| [Demo Script](docs/DEMO.md) | 4-minute demo walkthrough, expected questions, failure recovery |
| [Pitch Deck](docs/DECK.md) | Slide-by-slide outline for the pitch |

---

## 🔍 What Is Real vs. Stubbed

| Component | Status |
|---|---|
| Offline capture & op log | ✅ Real — IndexedDB on the viewer's device |
| Sync & idempotency | ✅ Real — against live Postgres |
| Correlation engine | ✅ Real logic — runs over synthetic data |
| Weather & heat index | ✅ Real — live Open-Meteo, 60 past days + 7 forecast, no API key |
| Health & agri records | ⚠️ Synthetic — generated across 60 days |
| AgriStack feed | ⚠️ Schema-correct adapter — third-party API not publicly available |
| ABHA & FHIR | ⚠️ Adapter shape only — sandbox onboarding doesn't gate the prototype |
| Voice | ✅ Real — browser Web Speech; Sarvam behind a one-file adapter |
| Advisory dispatch | ❌ Stubbed — records intent locally, contacts nobody |

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
