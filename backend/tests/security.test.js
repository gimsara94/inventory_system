import test from 'node:test';
import assert from 'node:assert/strict';
import { selectItems } from '../src/models/itemModel.js';
import { protectOrigin } from '../src/middleware/origin.js';
import { InputError, positiveId } from '../src/utils/validation.js';

test('inventory search sends SQL-looking input only as a bound value', async () => {
  const attack = "' OR 1=1; DROP TABLE inventory.items; --";
  let sql;
  let values;
  const db = { query: async (statement, parameters) => {
    sql = statement;
    values = parameters;
    return { rows: [] };
  } };
  await selectItems(db, { q: attack, category: "Tools'--", low: '1' });
  assert.equal(sql.includes(attack), false);
  assert.equal(sql.includes("Tools'--"), false);
  assert.equal(values[1], attack);
  assert.equal(values[2], `%${attack}%`);
  assert.equal(values[3], "Tools'--");
  assert.equal(values[4], true);
});

test('search treats SQL LIKE wildcards as literal search characters', async () => {
  let values;
  await selectItems({ query: async (_sql, parameters) => { values = parameters; return { rows: [] }; } }, { q: '50%_\\' });
  assert.equal(values[2], '%50\\%\\_\\\\%');
});

test('path IDs reject SQL syntax and oversized values', () => {
  for (const value of ['1 OR 1=1', '1; DROP TABLE users', '0', '-1', '9999999999999999999']) {
    assert.throws(() => positiveId(value), InputError);
  }
  assert.equal(positiveId('123'), '123');
});

test('cross-site mutations and untrusted origins are blocked', () => {
  const middleware = protectOrigin('https://inventory.example.com');
  const invoke = (method, headers) => {
    let result;
    middleware({ method, get: name => headers[name.toLowerCase()] }, {}, error => { result = error || null; });
    return result;
  };
  assert.equal(invoke('POST', { origin: 'https://inventory.example.com' }), null);
  assert.equal(invoke('POST', { origin: 'https://evil.example.com', host: 'evil.example.com' }).status, 403);
  assert.equal(invoke('POST', { 'sec-fetch-site': 'cross-site' }).status, 403);
  assert.equal(invoke('GET', { origin: 'https://evil.example.com' }).status, 403);
});
