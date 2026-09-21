export class InputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function text(value, label, max, required = false) {
  if (typeof value !== 'string') throw new InputError(`${label} must be text.`);
  const result = value.trim();
  if ((required && !result) || result.length > max || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(result)) {
    throw new InputError(`${label} is missing, too long, or contains invalid characters.`);
  }
  return result;
}

export function scaled(value, label, places = 3, signed = false, max = 1_000_000_000_000n) {
  if (typeof value !== 'string' && typeof value !== 'number') throw new InputError(`${label} must be a number.`);
  const input = String(value).trim();
  const match = input.match(signed ? /^(-?)(\d+)(?:\.(\d+))?$/ : /^()(\d+)(?:\.(\d+))?$/);
  if (!match || (match[3] || '').length > places) throw new InputError(`${label} allows at most ${places} decimal places.`);
  const scale = 10n ** BigInt(places);
  const output = (BigInt(match[2]) * scale + BigInt((match[3] || '').padEnd(places, '0') || '0')) * (match[1] === '-' ? -1n : 1n);
  if (output > max || output < (signed ? -max : 0n)) throw new InputError(`${label} is outside the allowed range.`);
  return output;
}

export function quantity(value) {
  const n = BigInt(value);
  const sign = n < 0n ? '-' : '';
  const absolute = n < 0n ? -n : n;
  return sign + (absolute / 1000n) + (absolute % 1000n ? '.' + String(absolute % 1000n).padStart(3, '0').replace(/0+$/, '') : '');
}

export function money(value) {
  const n = BigInt(value);
  return `${n / 100n}.${String(n % 100n).padStart(2, '0')}`;
}

export function itemInput(data) {
  return {
    name: text(data.name, 'Name', 120, true),
    sku: text(data.sku ?? '', 'Item code', 40),
    category: text(data.category ?? '', 'Category', 80),
    unit: text(data.unit ?? 'pcs', 'Unit', 20, true),
    minimum: scaled(data.minimum ?? 0, 'Minimum stock'),
    location: text(data.location ?? '', 'Location', 100),
    supplier: text(data.supplier ?? '', 'Supplier', 120),
    cost: scaled(data.unit_cost ?? 0, 'Unit cost', 2, false, 1_000_000_000n),
    notes: text(data.notes ?? '', 'Notes', 2000),
  };
}

export function email(value) {
  const result = text(value, 'Email', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new InputError('Enter a valid email address.');
  return result;
}

export function password(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 200) throw new InputError('Password must be 12–200 characters.');
  return value;
}

export function positiveId(value) {
  if (!/^[1-9]\d{0,17}$/.test(String(value))) throw new InputError('Invalid ID.');
  return String(value);
}
