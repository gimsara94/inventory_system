import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const migrations = resolve(process.cwd(), '../supabase/migrations');

test('inventory migration keeps application tables private and enables RLS', async () => {
  const sql = await readFile(resolve(migrations, '20260920000000_inventory.sql'), 'utf8');
  assert.match(sql, /REVOKE ALL ON SCHEMA inventory FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA inventory FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /REVOKE ALL ON ALL SEQUENCES IN SCHEMA inventory FROM PUBLIC, anon, authenticated/i);
  for (const table of ['users', 'items', 'stock_log', 'login_attempts']) {
    assert.match(sql, new RegExp(`ALTER TABLE inventory\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
  }
});

test('runtime database role has limited grants', async () => {
  const sql = await readFile(resolve(migrations, '20260920010000_app_role.sql'), 'utf8');
  assert.match(sql, /CREATE ROLE inventory_app NOLOGIN NOINHERIT/i);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON inventory\.items TO inventory_app/i);
  assert.match(sql, /GRANT SELECT, INSERT ON inventory\.stock_log TO inventory_app/i);
  assert.doesNotMatch(sql, /GRANT[^;]*DELETE[^;]*inventory\.(?:items|stock_log|users)/i);
  assert.doesNotMatch(sql, /GRANT[^;]*TO (?:anon|authenticated)/i);
});
