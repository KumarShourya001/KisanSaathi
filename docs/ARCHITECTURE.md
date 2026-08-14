# Architecture

## The one-sentence version

Two data feeds, captured offline by different workers, join on a shared
`(block_id, date)` key, and a rule-based engine reads both to produce a ranked,
explainable advisory that neither feed could have produced alone.

## Data flow

```
  ASHA worker                          Agri worker
  symptom category, severity,          input class, crop,
  age band                             area, date
        |                                    |
        +------------------+-----------------+
                           |
                  block_id + date attached
                  automatically from device
                           |
                           v
              Append-only op log (IndexedDB)
              one immutable op per capture,
              device-issued UUID v4
                           |
                  drain on reconnect
                           v
              POST /api/sync   (idempotent)
              upsert on op_id, per-op result
                           |
                           v
              Postgres:  health_records
                         agri_records
                         weather_cache  <-- Open-Meteo
                           |
                           v
              Correlation engine (pure TS)
              group by (block_id, date)
              60-day rolling baseline per block
              three rules
                           |
                           v
              GET /api/correlations
              ranked flags with evidence,
              explanation and action
                           |
                           v
              Block officer console
```

## Why each piece is what it is

### One deployable, not two

The plan called for FastAPI plus a separate host. The prototype runs the API as
TypeScript serverless functions inside the same Vercel project.

Two deployments means CORS configuration, two dashboards, two sets of
environment variables, and a free-tier Python host that cold-starts for 30 to
50 seconds. On a live demo, a 40-second first request is indistinguishable from
a broken product. One project removes all of it. The API surface is unchanged,
so this is a hosting decision rather than a design one.

### Rules, not machine learning

There is no labelled dataset for this join. Any model would be trained on data
we generated, which makes its accuracy a statement about our generator rather
than about the world.

Rules are explainable to a district health officer with the numbers attached,
auditable by anyone who reads `shared/engine.ts`, run in 2 ms on a cheap phone,
and survive the question "why did it flag this block". The upgrade path is
real: run a pilot, collect ground truth, then evaluate whether a model beats
the rules. Framing this as a deliberate choice with a stated upgrade path is
both honest and stronger than claiming an unvalidated model.

### Append-only op log

A record's payload is written once and never edited. Only its delivery metadata
(`state`, `attempts`, `last_error`) changes. That means a sync interrupted
halfway can be resumed by re-reading the log rather than reconciled, and the
client never has to reason about partial writes.

### Last-write-wins, and why a CRDT would be wrong here

Each observation is written once by one worker and is immutable. Two workers
never edit the same record, so there is no concurrent mutation to reconcile.
A CRDT would add convergence machinery for a conflict that cannot occur.

Idempotency does the actual work: `ON CONFLICT (op_id) DO NOTHING` against the
device-issued UUID means a retried batch, a duplicated batch, or a batch that
half-succeeded before the connection dropped all converge on the same state.
The `RETURNING` clause distinguishes "inserted" from "already had it", so the
client can show an honest per-op result rather than a blanket success.

### Correlation computed per request, not stored

At 10 blocks and roughly 700 records the whole run is 2 ms. Computing live
means a record that synced three seconds ago moves a flag immediately, which is
exactly what the demo needs to show. A stored `correlation_flags` table exists
in the schema for the batch-job version at district scale, but the prototype
does not need it and pretending otherwise would add a staleness bug.

### Two database drivers behind one interface

`shared/db.ts` picks Neon (HTTP, no connection pool to tune in a serverless
runtime) when `DATABASE_URL` is set, and PGlite (real Postgres compiled to
WASM) otherwise. Same SQL dialect, so the schema and every query are verifiable
locally with no account and no network. PGlite is a devDependency loaded
through a specifier the bundler cannot resolve statically, so it never reaches
a deployed function.

## Module layout

| Path | Holds | Imported by |
|---|---|---|
| `shared/types.ts` | Domain types, hazard class lists | everything |
| `shared/engine.ts` | The three rules, heat index, thresholds | api, scripts, tests |
| `shared/seed.ts` | Deterministic synthetic dataset | api, scripts |
| `shared/blocks.ts` | Block reference data | browser too, kept separate so the seed generator stays out of the bundle |
| `shared/schema.ts` | DDL as a string | api, scripts |
| `shared/db.ts` | Driver selection | api, scripts |
| `shared/repo.ts` | Every query | api, scripts |
| `api/*.ts` | Vercel Node functions | deployed |
| `src/lib/*` | Dexie, sync, api client, i18n, voice, routing | browser |
| `src/screens/*` | One file per routed screen | browser |

One definition of each rule and one definition of each query, shared by the
browser, the serverless functions and the command-line scripts. That is what
makes `npm run engine:test` meaningful: it tests the same code that runs in
production.

## Scaling beyond the prototype

The prototype is one district, 10 blocks, ~700 records. What changes at scale:

- **Engine becomes a scheduled batch job.** At thousands of blocks, computing
  per request stops being free. Write to `correlation_flags`, recompute nightly
  plus on-demand for blocks with new records.
- **Baselines move to a materialised view.** The 60-day rolling window per block
  is the expensive part, and it changes slowly.
- **Sync batches get compaction.** A worker offline for a week produces a large
  op log. Cap the batch, drain in order, resume on failure. Already
  implemented; the cap is 50 ops per request.
- **Weather moves to a scheduled fetch.** Currently on-demand via
  `/api/weather`. At district scale this is one cron per day.
- **Block reference data comes from LGD** rather than shipping in the bundle.

None of that changes the schema or the rules.

## Known limits

- Third-party AgriStack API access is not publicly available, so the agri feed
  is a schema-correct adapter rather than a live integration.
- ABHA and FHIR are shaped correctly but not connected. Sandbox onboarding does
  not gate the prototype.
- Sarvam AI: Live integration via `api/transcribe.ts` for multilingual speech-to-text; the API key is kept server-side.
- Open-Meteo is free for non-commercial use and needs no API key. A commercial
  deployment needs their paid tier.
- Live weather is read-only by default. Persisting it replaces the seeded demo
  scenario, and real heat in this district peaks outside the engine's
  evaluation window for an August date, so writing is behind an explicit flag.
- Advisory dispatch records intent locally and contacts nobody.
- Block codes are shaped like LGD codes but are demo values, not verified real
  codes for these blocks.
