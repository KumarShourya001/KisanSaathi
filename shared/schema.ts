/**
 * Schema as a string rather than a .sql file so the Vercel function bundler
 * always carries it. Plain Postgres, no ORM, no migration tool: the whole
 * schema is six tables and it fits on one screen.
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS blocks (
  block_id    TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  district    TEXT NOT NULL,
  state       TEXT NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lon         DOUBLE PRECISION NOT NULL,
  households  INTEGER NOT NULL DEFAULT 0
);

-- op_id is generated on the device before the record ever leaves it, which is
-- what makes the sync endpoint idempotent: a retried batch collides on the
-- primary key and is absorbed rather than duplicated.
CREATE TABLE IF NOT EXISTS health_records (
  op_id            TEXT PRIMARY KEY,
  block_id         TEXT NOT NULL REFERENCES blocks(block_id),
  observed_on      DATE NOT NULL,
  symptom_category TEXT NOT NULL,
  severity         SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 3),
  age_band         TEXT NOT NULL,
  reporter_id      TEXT NOT NULL,
  device_id        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agri_records (
  op_id       TEXT PRIMARY KEY,
  block_id    TEXT NOT NULL REFERENCES blocks(block_id),
  applied_on  DATE NOT NULL,
  input_class TEXT NOT NULL,
  crop        TEXT NOT NULL,
  area_ha     REAL NOT NULL DEFAULT 0,
  reporter_id TEXT NOT NULL,
  device_id   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weather_cache (
  block_id      TEXT NOT NULL REFERENCES blocks(block_id),
  for_date      DATE NOT NULL,
  temp_c        REAL NOT NULL,
  humidity_pct  REAL NOT NULL,
  heat_index_c  REAL NOT NULL,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (block_id, for_date)
);

-- The DPDP artifact. Purpose, expiry and a revocation timestamp are the three
-- things the Act actually requires to be demonstrable.
CREATE TABLE IF NOT EXISTS consents (
  consent_id  TEXT PRIMARY KEY,
  subject_ref TEXT NOT NULL,
  block_id    TEXT REFERENCES blocks(block_id),
  purpose     TEXT NOT NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);

-- Audit trail of every op the server accepted, kept separate from the record
-- tables so a duplicate submission is still visible in the log.
CREATE TABLE IF NOT EXISTS sync_ops (
  op_id       TEXT NOT NULL,
  kind        TEXT NOT NULL,
  device_id   TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  outcome     TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_block_date ON health_records (block_id, observed_on);
CREATE INDEX IF NOT EXISTS idx_agri_block_date   ON agri_records   (block_id, applied_on);
CREATE INDEX IF NOT EXISTS idx_weather_block     ON weather_cache  (block_id, for_date);
CREATE INDEX IF NOT EXISTS idx_syncops_device    ON sync_ops       (device_id, received_at);
`;
