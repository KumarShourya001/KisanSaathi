# API reference

Six endpoints. Base URL is your Vercel deployment, or `http://127.0.0.1:5174`
when running `npm run api:dev` locally.

All responses are JSON. Errors return `{ "error": "readable message" }` with a
non-200 status, never an opaque platform error page.

---

## `GET /api/status`

Deployment smoke test. Hit this before anything else after a deploy. Reports
whether each environment variable is present **without echoing its value**.

```bash
curl https://YOUR-APP.vercel.app/api/status
```

```json
{
  "ok": true,
  "as_of": "2026-08-14",
  "env": { "DATABASE_URL": true, "OPENWEATHER_KEY": true, "SEED_TOKEN": true },
  "db": {
    "driver": "neon",
    "reachable": true,
    "rows": { "blocks": 10, "health": 233, "agri": 125, "weather": 350, "ops": 0 }
  }
}
```

`ok` is true only when `DATABASE_URL` is set and the database answered. If it
is false, `db.error` and `note` say what to fix.

---

## `GET /api/blocks`

Block reference data. Cached for 5 minutes, stale-while-revalidate for a day,
since blocks change roughly never.

```json
{ "blocks": [ { "block_id": "LGD4162", "name": "Ner", "district": "Yavatmal",
               "state": "Maharashtra", "lat": 20.4, "lon": 78.0,
               "households": 2840 } ] }
```

---

## `GET /api/correlations`

Runs the engine over current database contents and returns ranked flags.

| Query param | Default | Meaning |
|---|---|---|
| `as_of` | today (UTC) | Evaluation date, `YYYY-MM-DD` |

```bash
curl "https://YOUR-APP.vercel.app/api/correlations?as_of=2026-08-14"
```

```json
{
  "as_of": "2026-08-14",
  "flags": [
    {
      "flag_id": "composite:LGD4162:2026-08-02",
      "block_id": "LGD4162",
      "block_name": "Ner",
      "rule": "composite",
      "severity": "high",
      "confidence": "high",
      "window_start": "2026-08-02",
      "window_end": "2026-08-13",
      "evidence": {
        "applications_observed": 9,
        "applications_expected": 0,
        "symptoms_observed": 7,
        "symptoms_expected": 1,
        "symptom_categories": ["neuro", "dermal", "respiratory"],
        "peak_heat_index_c": 46.2,
        "heat_days": 4,
        "ratio": 7,
        "series_start": "2026-08-02",
        "series_agri": [0, 2, 3, 1, 2, 1, 0, 0, 0, 0, 0, 0],
        "series_health": [0, 0, 1, 2, 1, 2, 1, 0, 0, 0, 0, 0]
      },
      "headline": "Exposure spike under sustained heat",
      "explanation": "WHO Class II applications in Ner reached 9 in 7 days ...",
      "action": "Escalate to district. Alert 3 ASHA workers ...",
      "action_role": "District health and agriculture officers"
    }
  ],
  "quiet_blocks": [ { "block_id": "LGD4167", "name": "Arni" } ],
  "counts": { "blocks": 10, "health": 233, "agri": 125, "weather": 350 },
  "elapsed_ms": 35
}
```

Sorted by severity, then rule (`composite` > `exposure` > `heat`), then ratio.
A `Server-Timing: engine;dur=N` header carries the engine time.

`quiet_blocks` is deliberate. A detector that only ever returns hits gives no
evidence it can discriminate.

`series_agri` and `series_health` are daily counts across the flag window, so a
client can draw both feeds without a second round trip.

---

## `POST /api/sync`

Drain target for the client op log. **Idempotent.** Answers per op, not per
batch.

Max 200 ops per request. Every op needs `op_id`, `block_id`, and a `kind` of
`health` or `agri`.

```bash
curl -X POST https://YOUR-APP.vercel.app/api/sync \
  -H "Content-Type: application/json" \
  -d '{
    "ops": [{
      "op_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "kind": "health",
      "block_id": "LGD4162",
      "device_id": "dev-a1b2c3d4",
      "seq": 1,
      "created_at": "2026-08-14T09:17:00Z",
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

```json
{ "accepted": ["f47ac10b-..."], "duplicates": [], "rejected": [],
  "received": 1, "elapsed_ms": 24 }
```

Send the identical body again:

```json
{ "accepted": [], "duplicates": ["f47ac10b-..."], "rejected": [],
  "received": 1, "elapsed_ms": 11 }
```

The row count moves once. Every attempt, including the duplicate, is recorded
in `sync_ops`, so a retry is visible in the audit trail rather than silently
swallowed.

From the device's point of view `accepted` and `duplicates` are the same
success: in both cases the op can leave the outbox.

**Agri payload shape:**

```json
{ "applied_on": "2026-08-14", "input_class": "organophosphate",
  "crop": "cotton", "area_ha": 2.4, "reporter_id": "AGRI-4162-1" }
```

`input_class` is one of `organophosphate`, `carbamate`, `pyrethroid`,
`herbicide`, `fertiliser`, `biological`. The first two are WHO Hazard Class II
and are the only ones the exposure rule counts.

---

## `GET /api/weather`

Fetches the OpenWeather five-day forecast per block centroid, aggregates to a
daily maximum temperature with the humidity at that reading, computes the
Rothfusz heat index, and upserts into `weather_cache`.

| Query param | Meaning |
|---|---|
| `dry=1` | Fetch and report without writing |

```json
{
  "live": true,
  "source": "OpenWeather 5 day / 3 hour forecast, free tier",
  "history_note": "Days before today come from the synthetic seed. The free tier does not serve history.",
  "written": [ { "block": "Ner", "days": 6 } ],
  "failed": []
}
```

Without `OPENWEATHER_KEY` set it returns `"live": false` with the reason and the
cached row count, rather than failing.

---

## `POST /api/seed`

Wipes and regenerates the synthetic dataset. **Deletes everything first**, so
never run it during a demo.

With a live `DATABASE_URL`, `SEED_TOKEN` must be set and the request must carry
a matching `x-seed-token` header. Without a `DATABASE_URL` you are on local
PGlite and it is open.

```bash
curl -X POST "https://YOUR-APP.vercel.app/api/seed?as_of=2026-08-14" \
  -H "x-seed-token: YOUR_SEED_TOKEN"
```

```json
{ "seeded": true, "as_of": "2026-08-14", "driver": "neon",
  "counts": { "blocks": 10, "health": 233, "agri": 125, "weather": 350, "ops": 0 },
  "elapsed_ms": 219,
  "note": "Synthetic data. Five blocks are rigged: see shared/seed.ts." }
```

---

## Engine thresholds

`/api/correlations` returns the live threshold values under `thresholds`. They
are defined in one place, `THRESHOLDS` in `shared/engine.ts`:

| Threshold | Value | Meaning |
|---|---|---|
| `exposureWindowDays` | 7 | Applications counted over a trailing week |
| `symptomWindowDays` | 6 | Symptoms observed after the spike day |
| `baselineBuckets` x `baselineBucketDays` | 7 x 7 | 49 days of baseline |
| `baselineGapDays` | 14 | Baseline ends 14 days before the window, so a spike cannot inflate its own baseline |
| `minApplications` | 3 | Absolute floor |
| `applicationMultiple` | 3 | Or 3x the block's own median week |
| `minSymptoms` | 5 | Absolute floor |
| `symptomMultiple` | 2.5 | Or 2.5x the block's own baseline |
| `minBaselineHealthRecords` | 8 | Below this the block is suppressed as insufficient data |
| `heatIndexC` | 40 | Heat advisory threshold |
| `minHeatRunDays` | 2 | Consecutive days required |
