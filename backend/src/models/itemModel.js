import { getPool } from '../db/pool.js';
import { text } from '../utils/validation.js';

const LIST_ITEMS_SQL = `SELECT * FROM inventory.items
  WHERE archived=$1 AND ($2='' OR name ILIKE $3 OR sku ILIKE $3 OR category ILIKE $3 OR location ILIKE $3)
  AND ($4='' OR category=$4) AND ($5=false OR quantity<=minimum)
  ORDER BY lower(name), id LIMIT 1000`;

export async function selectItems(db, filters) {
  const search = text(filters.q ?? '', 'Search', 120);
  const category = text(filters.category ?? '', 'Category', 80);
  const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  const { rows } = await db.query(LIST_ITEMS_SQL,
    [filters.archived === '1', search, pattern, category, filters.low === '1']);
  return rows;
}

export async function findItemById(db, id, { lock = false } = {}) {
  const query = lock
    ? 'SELECT * FROM inventory.items WHERE id=$1 FOR UPDATE'
    : 'SELECT * FROM inventory.items WHERE id=$1';
  const { rows } = await db.query(query, [id]);
  return rows[0] ?? null;
}

export async function getInventorySummary() {
  const { rows } = await getPool().query(`SELECT count(*)::int AS items,
    count(*) FILTER (WHERE quantity <= minimum)::int AS low,
    count(*) FILTER (WHERE quantity = 0)::int AS empty,
    coalesce(sum(round(quantity::numeric * cost / 1000)),0)::text AS value_cents
    FROM inventory.items WHERE archived=false`);
  return rows[0];
}

export async function listCategories() {
  const { rows } = await getPool().query(
    "SELECT DISTINCT category FROM inventory.items WHERE archived=false AND category<>'' ORDER BY category",
  );
  return rows.map(row => row.category);
}

export async function createItem(db, item) {
  const { rows } = await db.query(
    `INSERT INTO inventory.items
      (sku,name,category,unit,quantity,minimum,location,supplier,cost,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [item.sku, item.name, item.category, item.unit, String(item.quantity),
      String(item.minimum), item.location, item.supplier, String(item.cost), item.notes],
  );
  return rows[0];
}

export async function updateItemDetails(db, item) {
  const { rows } = await db.query(
    `UPDATE inventory.items SET
      sku=$2,name=$3,category=$4,minimum=$5,location=$6,supplier=$7,cost=$8,notes=$9,
      version=version+1,updated_at=now() WHERE id=$1 RETURNING *`,
    [item.id, item.sku, item.name, item.category, String(item.minimum),
      item.location, item.supplier, String(item.cost), item.notes],
  );
  return rows[0];
}

export async function updateItemQuantity(db, id, quantity) {
  const { rows } = await db.query(
    `UPDATE inventory.items SET quantity=$2,version=version+1,updated_at=now()
      WHERE id=$1 RETURNING *`,
    [id, String(quantity)],
  );
  return rows[0];
}

export async function setItemArchived(db, id, archived) {
  const { rows } = await db.query(
    `UPDATE inventory.items SET archived=$2,version=version+1,updated_at=now()
      WHERE id=$1 RETURNING *`,
    [id, archived],
  );
  return rows[0];
}
