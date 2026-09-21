import { randomBytes } from 'node:crypto';
import { requireConfig } from '../config/env.js';
import { getPool, transaction } from '../db/pool.js';
import {
  createItem as insertItem,
  findItemById,
  getInventorySummary,
  listCategories,
  selectItems,
  setItemArchived,
  updateItemDetails,
  updateItemQuantity,
} from '../models/itemModel.js';
import {
  createStockMovement,
  findMovementByRequestId,
  listStockMovements,
} from '../models/stockMovementModel.js';
import { presentItem } from '../utils/presenters.js';
import {
  InputError,
  itemInput,
  money,
  positiveId,
  quantity,
  scaled,
  text,
} from '../utils/validation.js';

const MAX_QUANTITY = 1_000_000_000_000n;

async function requireItem(db, untrustedId, lock = false) {
  const item = await findItemById(db, positiveId(untrustedId), { lock });
  if (!item) throw new InputError('Item not found.', 404);
  return item;
}

export async function getSummary(_req, res) {
  const [summary, categories] = await Promise.all([
    getInventorySummary(),
    listCategories(),
  ]);
  const config = requireConfig();
  res.json({
    items: summary.items,
    low: summary.low,
    empty: summary.empty,
    value: money(BigInt(summary.value_cents)),
    currency: config.currency,
    timeZone: config.timeZone,
    categories,
  });
}

export async function getItems(req, res) {
  const rows = await selectItems(getPool(), req.query);
  res.json(rows.map(presentItem));
}

export async function getItem(req, res) {
  res.json(presentItem(await requireItem(getPool(), req.params.id)));
}

export async function createItem(req, res) {
  const data = itemInput(req.body || {});
  const opening = scaled(req.body?.quantity ?? 0, 'Opening stock');
  const sku = data.sku || `INV-${randomBytes(6).toString('hex').toUpperCase()}`;
  const row = await transaction(async db => {
    const item = await insertItem(db, { ...data, sku, quantity: opening });
    await createStockMovement(db, {
      item,
      actorId: req.user.id,
      change: opening,
      balance: opening,
      kind: 'opening',
      reason: 'Opening stock',
      requestId: null,
    });
    return item;
  });
  res.status(201).json(presentItem(row));
}

export async function updateItem(req, res) {
  const input = itemInput(req.body || {});
  const version = req.body?.version;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new InputError('Item version is required. Refresh and retry.');
  }

  const row = await transaction(async db => {
    const current = await requireItem(db, req.params.id, true);
    if (current.archived) throw new InputError('Restore the item before editing.', 409);
    if (current.version !== version) throw new InputError('This item changed. Refresh and retry.', 409);
    if (current.unit !== input.unit) throw new InputError('An item’s unit cannot change after creation.');
    return updateItemDetails(db, {
      id: current.id,
      ...input,
      sku: input.sku || current.sku,
    });
  });
  res.json(presentItem(row));
}

export async function adjustStock(req, res) {
  const change = scaled(req.body?.change, 'Stock change', 3, true);
  if (change === 0n) throw new InputError('Stock change must not be zero.');
  const kind = req.body?.kind || (change > 0n ? 'receipt' : 'issue');
  if (!['receipt', 'issue', 'correction'].includes(kind)
      || (kind === 'receipt' && change < 0n)
      || (kind === 'issue' && change > 0n)) {
    throw new InputError('Choose the correct movement type.');
  }
  const reason = text(req.body?.reason, 'Reason', 240, true);
  const requestId = text(req.body?.request_id, 'Request ID', 80, true);

  const row = await transaction(async db => {
    const current = await requireItem(db, req.params.id, true);
    const previous = await findMovementByRequestId(db, requestId);
    if (previous) {
      if (String(previous.item_id) !== String(current.id)
          || BigInt(previous.change) !== change
          || previous.kind !== kind
          || previous.reason !== reason) {
        throw new InputError('Request ID was used for another movement.', 409);
      }
      return current;
    }
    if (current.archived) throw new InputError('Restore the item before changing stock.', 409);

    const balance = BigInt(current.quantity) + change;
    if (balance < 0n) {
      throw new InputError('Not enough stock. Refresh to see the current quantity.', 409);
    }
    if (balance > MAX_QUANTITY) throw new InputError('The resulting stock is too large.');

    const updated = await updateItemQuantity(db, current.id, balance);
    await createStockMovement(db, {
      item: current,
      actorId: req.user.id,
      change,
      balance,
      kind,
      reason,
      requestId,
    });
    return updated;
  });
  res.json(presentItem(row));
}

export async function archiveItem(req, res) {
  if (typeof req.body?.archived !== 'boolean') {
    throw new InputError('archived must be true or false.');
  }
  const row = await transaction(async db => {
    const current = await requireItem(db, req.params.id, true);
    if (req.body.archived && BigInt(current.quantity) !== 0n) {
      throw new InputError('Reduce stock to zero before archiving.', 409);
    }
    return setItemArchived(db, current.id, req.body.archived);
  });
  res.json(presentItem(row));
}

export async function getMovements(req, res) {
  const itemId = req.query.item_id ? positiveId(req.query.item_id) : null;
  const rows = await listStockMovements(itemId);
  res.json(rows.map(row => ({
    ...row,
    id: String(row.id),
    item_id: String(row.item_id),
    change: quantity(row.change),
    balance: quantity(row.balance),
  })));
}
