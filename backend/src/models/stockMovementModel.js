import { getPool } from '../db/pool.js';

export async function createStockMovement(db, movement) {
  await db.query(
    `INSERT INTO inventory.stock_log
      (item_id,actor_id,sku,name,unit,change,balance,kind,reason,request_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [movement.item.id, movement.actorId, movement.item.sku, movement.item.name,
      movement.item.unit, String(movement.change), String(movement.balance),
      movement.kind, movement.reason, movement.requestId],
  );
}

export async function findMovementByRequestId(db, requestId) {
  const { rows } = await db.query(
    'SELECT * FROM inventory.stock_log WHERE request_id=$1',
    [requestId],
  );
  return rows[0] ?? null;
}

export async function listStockMovements(itemId) {
  const { rows } = await getPool().query(
    `SELECT l.id,l.item_id,l.sku,l.name,l.unit,l.change,l.balance,l.kind,l.reason,l.timestamp,
      u.name AS actor_name FROM inventory.stock_log l
      LEFT JOIN inventory.users u ON u.id=l.actor_id
      WHERE ($1::bigint IS NULL OR l.item_id=$1)
      ORDER BY l.timestamp DESC,l.id DESC LIMIT 500`,
    [itemId],
  );
  return rows;
}
