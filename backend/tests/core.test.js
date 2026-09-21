import test from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync } from 'node:crypto';
import { hashPassword, needsRehash, verifyPassword } from '../src/utils/password.js';
import { presentItem } from '../src/utils/presenters.js';
import { InputError, itemInput, quantity, scaled } from '../src/utils/validation.js';

test('scrypt hashes are salted and wrong passwords are rejected', async () => {
  const first = await hashPassword('a strong test password');
  const second = await hashPassword('a strong test password');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('a strong test password', first), true);
  assert.equal(await verifyPassword('wrong password', first), false);
  assert.equal(await verifyPassword('anything', 'invalid'), false);
  assert.equal(needsRehash(first), false);
});

test('existing scrypt hashes remain valid and are marked for upgrade', async () => {
  const salt = Buffer.alloc(16, 7);
  const key = scryptSync('legacy account password', salt, 64, { N: 16384, r: 8, p: 1 });
  const legacy = `scrypt$16384$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
  assert.equal(await verifyPassword('legacy account password', legacy), true);
  assert.equal(needsRehash(legacy), true);
});

test('stock quantities use exact thousandths and reject excess precision', () => {
  assert.equal(scaled('1.125', 'Quantity'), 1125n);
  assert.equal(scaled('-0.125', 'Change', 3, true), -125n);
  assert.equal(quantity(-125n), '-0.125');
  for (const input of ['1.0001', 'NaN', 'Infinity', '-1', '1e4', '']) {
    assert.throws(() => scaled(input, 'Quantity'), InputError);
  }
  assert.throws(() => scaled('1000000000.001', 'Quantity'), InputError);
});

test('item values round in cents without floating point errors', () => {
  const input = itemInput({ name: 'Oil', unit: 'litres', minimum: '0.5', unit_cost: '100.20' });
  assert.equal(input.minimum, 500n);
  assert.equal(input.cost, 10020n);
  const item = presentItem({ id: '1', sku: 'OIL', name: 'Oil', category: '', unit: 'litres',
    quantity: '1125', minimum: '500', location: '', supplier: '', cost: '10020', notes: '', archived: false, version: 1 });
  assert.equal(item.quantity, '1.125');
  assert.equal(item.value, '112.73');
});
