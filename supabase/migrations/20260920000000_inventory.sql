-- The application server is the only database client. Never expose these tables
-- through Supabase's public Data API.
CREATE SCHEMA IF NOT EXISTS inventory;
REVOKE ALL ON SCHEMA inventory FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS inventory.users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  token_version INTEGER NOT NULL DEFAULT 1 CHECK (token_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  CONSTRAINT users_name_length CHECK (length(name) BETWEEN 1 AND 120)
);

CREATE TABLE IF NOT EXISTS inventory.items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'pcs',
  quantity BIGINT NOT NULL DEFAULT 0 CHECK (quantity BETWEEN 0 AND 1000000000000),
  minimum BIGINT NOT NULL DEFAULT 0 CHECK (minimum BETWEEN 0 AND 1000000000000),
  location TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  cost BIGINT NOT NULL DEFAULT 0 CHECK (cost BETWEEN 0 AND 1000000000),
  notes TEXT NOT NULL DEFAULT '',
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT item_lengths CHECK (
    length(sku) BETWEEN 1 AND 40 AND length(name) BETWEEN 1 AND 120
    AND length(category) <= 80 AND length(unit) BETWEEN 1 AND 20
    AND length(location) <= 100 AND length(supplier) <= 120 AND length(notes) <= 2000
  )
);
CREATE INDEX IF NOT EXISTS items_active_name_idx ON inventory.items (archived, lower(name), id);

CREATE TABLE IF NOT EXISTS inventory.stock_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES inventory.items(id),
  actor_id BIGINT REFERENCES inventory.users(id) ON DELETE SET NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  change BIGINT NOT NULL,
  balance BIGINT NOT NULL CHECK (balance BETWEEN 0 AND 1000000000000),
  kind TEXT NOT NULL CHECK (kind IN ('opening', 'receipt', 'issue', 'correction')),
  reason TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_id TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS stock_log_time_idx ON inventory.stock_log (timestamp DESC, id DESC);
CREATE INDEX IF NOT EXISTS stock_log_item_idx ON inventory.stock_log (item_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS inventory.login_attempts (
  key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  window_started TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_until TIMESTAMPTZ
);

-- RLS is defense in depth if this schema is ever added to exposed schemas.
ALTER TABLE inventory.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.stock_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA inventory FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA inventory FROM PUBLIC, anon, authenticated;
