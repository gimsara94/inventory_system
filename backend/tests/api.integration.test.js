import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { hashPassword } from '../src/utils/password.js';
import { emptyState, MemoryDatabase } from './helpers/memoryDatabase.js';

process.env.NODE_ENV = 'test';
process.env.APP_DATABASE_URL = 'postgresql://test:test@localhost:5432/workshop_inventory_test';
process.env.JWT_SECRET = 'automated-test-secret-with-more-than-thirty-two-bytes';
process.env.PUBLIC_ORIGIN = 'http://localhost:5173';
process.env.DATABASE_SSLMODE = 'disable';
delete process.env.MIGRATION_DATABASE_URL;
delete process.env.DATABASE_URL;

const trustedOrigin = 'http://localhost:5173';
let app;
let database;
let adminPasswordHash;
let staffPasswordHash;

function seed() {
  return emptyState([
    { id: '1', email: 'admin@example.com', name: 'Admin', password_hash: adminPasswordHash,
      role: 'admin', active: true, token_version: 1 },
    { id: '2', email: 'staff@example.com', name: 'Staff', password_hash: staffPasswordHash,
      role: 'staff', active: true, token_version: 1 },
  ]);
}

function sessionCookie(response) {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  assert.ok(value, 'expected the response to set a session cookie');
  return value.split(';')[0];
}

async function signIn(email = 'admin@example.com', password = 'correct horse battery staple') {
  const response = await request(app)
    .post('/api/auth/login')
    .set('Origin', trustedOrigin)
    .send({ email, password });
  assert.equal(response.status, 200);
  return { cookie: sessionCookie(response), csrf: response.body.csrf, response };
}

test.before(async () => {
  [adminPasswordHash, staffPasswordHash] = await Promise.all([
    hashPassword('correct horse battery staple'),
    hashPassword('staff account password'),
  ]);
  const [{ createApp }, { setPoolForTests }] = await Promise.all([
    import('../src/app.js'),
    import('../src/db/pool.js'),
  ]);
  database = new MemoryDatabase(seed());
  setPoolForTests(database);
  app = createApp();
});

test.beforeEach(() => database.reset(seed()));

test('security headers, origin checks, JSON limits, and authentication are enforced', async () => {
  const health = await request(app).get('/api/health').set('Origin', trustedOrigin);
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { status: 'ok' });
  assert.equal(health.headers['cache-control'], 'no-store');
  assert.equal(health.headers['x-powered-by'], undefined);
  assert.match(health.headers['content-security-policy'], /object-src 'none'/);

  const unauthenticated = await request(app).get('/api/items').set('Origin', trustedOrigin);
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.body.error, 'Please sign in.');

  const foreignOrigin = await request(app).get('/api/health').set('Origin', 'https://evil.example');
  assert.equal(foreignOrigin.status, 403);

  const crossSite = await request(app).post('/api/auth/login')
    .set('Sec-Fetch-Site', 'cross-site')
    .send({ email: 'admin@example.com', password: 'correct horse battery staple' });
  assert.equal(crossSite.status, 403);

  const malformed = await request(app).post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{"email":');
  assert.equal(malformed.status, 400);
  assert.equal(malformed.body.error, 'Send a valid JSON object.');

  const oversized = await request(app).post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ padding: 'x'.repeat(70 * 1024) }));
  assert.equal(oversized.status, 413);
});

test('login creates a protected JWT cookie and CSRF protects browser writes', async () => {
  const badLogin = await request(app).post('/api/auth/login')
    .set('Origin', trustedOrigin)
    .send({ email: 'admin@example.com', password: 'incorrect password' });
  assert.equal(badLogin.status, 401);
  assert.equal(badLogin.body.error, 'Invalid email or password.');

  const { cookie, csrf, response } = await signIn();
  const setCookie = response.headers['set-cookie'][0];
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.equal(response.body.user.password_hash, undefined);
  assert.equal(response.body.token, undefined);
  assert.equal(typeof csrf, 'string');
  assert.ok(csrf.length >= 40);

  const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.email, 'admin@example.com');
  assert.equal(me.body.csrf, csrf);

  const missingCsrf = await request(app).post('/api/auth/logout').set('Cookie', cookie);
  assert.equal(missingCsrf.status, 403);

  const badToken = await request(app).get('/api/auth/me')
    .set('Cookie', 'inventory_session=invalid-token');
  assert.equal(badToken.status, 401);

  const logout = await request(app).post('/api/auth/logout')
    .set('Cookie', cookie)
    .set('X-CSRF-Token', csrf)
    .set('Origin', trustedOrigin);
  assert.equal(logout.status, 200);
  assert.match(logout.headers['set-cookie'][0], /Max-Age=0/);
});

test('login attempts are limited for both the account and client IP', async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request(app).post('/api/auth/login')
      .set('Origin', trustedOrigin)
      .send({ email: 'missing@example.com', password: 'incorrect password' });
    assert.equal(response.status, 401);
    assert.equal(response.body.error, 'Invalid email or password.');
  }
  const blocked = await request(app).post('/api/auth/login')
    .set('Origin', trustedOrigin)
    .send({ email: 'missing@example.com', password: 'incorrect password' });
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /Too many sign-in attempts/);
});

test('admin authorization protects user management and passwords are never returned', async () => {
  const staff = await signIn('staff@example.com', 'staff account password');
  const forbidden = await request(app).get('/api/users').set('Cookie', staff.cookie);
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.body.error, 'Admin access required.');

  const staffItem = await request(app).post('/api/items')
    .set('Cookie', staff.cookie)
    .set('X-CSRF-Token', staff.csrf)
    .set('Origin', trustedOrigin)
    .send({ name: 'Staff-created item', unit: 'pcs' });
  assert.equal(staffItem.status, 201);

  const admin = await signIn();
  const noCsrf = await request(app).post('/api/users')
    .set('Cookie', admin.cookie)
    .set('Origin', trustedOrigin)
    .send({ email: 'new@example.com', name: 'New User', password: 'new secure password', role: 'staff' });
  assert.equal(noCsrf.status, 403);

  const created = await request(app).post('/api/users')
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send({ email: 'new@example.com', name: 'New User', password: 'new secure password', role: 'staff' });
  assert.equal(created.status, 201);
  assert.equal(created.body.email, 'new@example.com');
  assert.equal(created.body.password, undefined);
  assert.equal(created.body.password_hash, undefined);
  const stored = database.state.users.find(user => user.email === 'new@example.com');
  assert.match(stored.password_hash, /^scrypt\$/);
  assert.notEqual(stored.password_hash, 'new secure password');

  const duplicate = await request(app).post('/api/users')
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send({ email: 'new@example.com', name: 'Duplicate', password: 'another secure password', role: 'staff' });
  assert.equal(duplicate.status, 409);

  const removeOwnAdmin = await request(app).patch('/api/users/1')
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send({ active: false });
  assert.equal(removeOwnAdmin.status, 409);

  const disabled = await request(app).patch('/api/users/2')
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send({ active: false });
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.active, false);

  const revokedSession = await request(app).get('/api/items').set('Cookie', staff.cookie);
  assert.equal(revokedSession.status, 401);
  assert.equal(revokedSession.body.error, 'Session expired. Sign in again.');
});

test('item creation, editing, stock changes, idempotency, history, and archiving work', async () => {
  const admin = await signIn();
  const itemBody = {
    name: 'M8 bolt',
    sku: 'M8-BOLT',
    category: 'Fasteners',
    unit: 'pcs',
    quantity: '5',
    minimum: '2',
    unit_cost: '0.50',
    location: 'Rack A',
  };

  const noCsrf = await request(app).post('/api/items')
    .set('Cookie', admin.cookie)
    .set('Origin', trustedOrigin)
    .send(itemBody);
  assert.equal(noCsrf.status, 403);

  const created = await request(app).post('/api/items')
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send(itemBody);
  assert.equal(created.status, 201);
  assert.equal(created.body.quantity, '5');
  assert.equal(created.body.value, '2.50');
  const itemId = created.body.id;

  const fetched = await request(app).get(`/api/items/${itemId}`).set('Cookie', admin.cookie);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.name, 'M8 bolt');

  const list = await request(app).get('/api/items?q=M8').set('Cookie', admin.cookie);
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].sku, 'M8-BOLT');

  const injection = await request(app)
    .get(`/api/items/${encodeURIComponent('1 OR 1=1')}`)
    .set('Cookie', admin.cookie);
  assert.equal(injection.status, 400);
  assert.equal(database.state.items.length, 1);

  const adjustment = {
    change: '2', kind: 'receipt', reason: 'Supplier delivery', request_id: 'delivery-001',
  };
  const adjusted = await request(app).post(`/api/items/${itemId}/adjust`)
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send(adjustment);
  assert.equal(adjusted.status, 200);
  assert.equal(adjusted.body.quantity, '7');

  const retry = await request(app).post(`/api/items/${itemId}/adjust`)
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send(adjustment);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.quantity, '7');
  assert.equal(database.state.movements.length, 2);

  const excessiveIssue = await request(app).post(`/api/items/${itemId}/adjust`)
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send({ change: '-8', kind: 'issue', reason: 'Too many', request_id: 'issue-too-many' });
  assert.equal(excessiveIssue.status, 409);
  assert.equal(database.state.items[0].quantity, '7000');

  const edited = await request(app).put(`/api/items/${itemId}`)
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send({ ...itemBody, name: 'M8 stainless bolt', version: adjusted.body.version });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.name, 'M8 stainless bolt');

  const staleEdit = await request(app).put(`/api/items/${itemId}`)
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send({ ...itemBody, version: adjusted.body.version });
  assert.equal(staleEdit.status, 409);

  const nonEmptyArchive = await request(app).post(`/api/items/${itemId}/archive`)
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send({ archived: true });
  assert.equal(nonEmptyArchive.status, 409);

  const issued = await request(app).post(`/api/items/${itemId}/adjust`)
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send({ change: '-7', kind: 'issue', reason: 'Used in assembly', request_id: 'issue-001' });
  assert.equal(issued.status, 200);
  assert.equal(issued.body.quantity, '0');

  const archived = await request(app).post(`/api/items/${itemId}/archive`)
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send({ archived: true });
  assert.equal(archived.status, 200);
  assert.equal(archived.body.archived, true);

  const activeItems = await request(app).get('/api/items').set('Cookie', admin.cookie);
  const archivedItems = await request(app).get('/api/items?archived=1').set('Cookie', admin.cookie);
  assert.equal(activeItems.body.length, 0);
  assert.equal(archivedItems.body.length, 1);

  const movements = await request(app).get(`/api/movements?item_id=${itemId}`)
    .set('Cookie', admin.cookie);
  assert.equal(movements.status, 200);
  assert.deepEqual(movements.body.map(row => row.kind), ['issue', 'receipt', 'opening']);

  const summary = await request(app).get('/api/summary').set('Cookie', admin.cookie);
  assert.equal(summary.status, 200);
  assert.equal(summary.body.items, 0);

  const restored = await request(app).post(`/api/items/${itemId}/archive`)
    .set('Cookie', admin.cookie)
    .set('X-CSRF-Token', admin.csrf)
    .set('Origin', trustedOrigin)
    .send({ archived: false });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.archived, false);

  const activeAfterRestore = await request(app).get('/api/items').set('Cookie', admin.cookie);
  assert.equal(activeAfterRestore.body.length, 1);
});
