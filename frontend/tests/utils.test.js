import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell } from '../src/utils/csv.js';
import { formatAmount, formatMoney, requestId } from '../src/utils/format.js';

test('inventory quantities and money are formatted for display', () => {
  assert.equal(formatAmount('1200.125'), '1,200.125');
  assert.equal(formatMoney('100.5'), '100.50');
});

test('CSV values are quoted and spreadsheet formulas are neutralized', () => {
  assert.equal(csvCell('M8 "bolt"'), '"M8 ""bolt"""');
  assert.equal(csvCell('=HYPERLINK("https://example.test")'), '"\'=HYPERLINK(""https://example.test"")"');
  assert.equal(csvCell('-7.5'), '"-7.5"');
});

test('stock operation request IDs are unique', () => {
  const first = requestId();
  const second = requestId();
  assert.ok(first.length >= 32);
  assert.notEqual(first, second);
});
