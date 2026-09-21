import { money, quantity } from './validation.js';

export function publicUser(user) {
  return {
    id: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
    active: user.active,
  };
}

export function presentItem(row) {
  const value = (BigInt(row.quantity) * BigInt(row.cost) + 500n) / 1000n;
  return {
    id: String(row.id),
    sku: row.sku,
    name: row.name,
    category: row.category,
    unit: row.unit,
    quantity: quantity(row.quantity),
    minimum: quantity(row.minimum),
    location: row.location,
    supplier: row.supplier,
    unit_cost: money(row.cost),
    value: money(value),
    notes: row.notes,
    archived: row.archived,
    low: BigInt(row.quantity) <= BigInt(row.minimum),
    version: row.version,
  };
}
