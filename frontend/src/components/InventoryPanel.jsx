import React, { useState } from 'react';
import { formatAmount, formatMoney } from '../utils/format.js';
import { Icon } from './Icon.jsx';

function QuickAdjuster({ item, busy, onAdjust }) {
  const [value, setValue] = useState('1');
  const valid = /^\d+(?:\.\d{1,3})?$/.test(value) && Number(value) > 0 && Number(value) <= 1_000_000_000;
  const canRemove = valid && Number(item.quantity) >= Number(value);

  async function adjust(direction) {
    if (!valid) return;
    const change = direction < 0 ? `-${value}` : value;
    if (await onAdjust(item, change)) setValue('1');
  }

  return <span className="stepper" aria-label={`Quick stock adjustment for ${item.name}`}>
    <button aria-label={`Remove entered quantity from ${item.name}`} title="Remove stock"
      disabled={busy || !canRemove} onClick={() => adjust(-1)}>−</button>
    <input value={value} onChange={event => setValue(event.target.value)} type="number"
      min="0.001" max="1000000000" step="0.001" inputMode="decimal"
      aria-label={`Adjustment quantity for ${item.name}`} aria-invalid={!valid}
      title="Enter a positive quantity with up to three decimal places" disabled={busy} />
    <button aria-label={`Add entered quantity to ${item.name}`} title="Add stock"
      disabled={busy || !valid} onClick={() => adjust(1)}>+</button>
  </span>;
}

export function InventoryPanel({ items, filters, setFilters, categories, currency, loading, busy,
  onRefresh, onAdd, onEdit, onStock, onQuickAdjust, onArchive, onHistory, onExport }) {
  const hasFilters = Boolean(filters.q || filters.category || filters.low || filters.archived);
  const update = values => setFilters(current => ({ ...current, ...values }));

  return <section className="content-panel" aria-labelledby="inventory-heading">
    <div className="filter-bar">
      <label className="search-field"><span>Search inventory</span>
        <span className="input-with-icon"><Icon name="search" />
          <input type="search" value={filters.q} onChange={event => update({ q: event.target.value })}
            placeholder="Name, code, category, or location" /></span>
      </label>
      <label className="category-filter"><span>Category</span>
        <select value={filters.category} onChange={event => update({ category: event.target.value })}>
          <option value="">All categories</option>
          {categories.map(category => <option value={category} key={category}>{category}</option>)}
        </select>
      </label>
      <div className="filter-toggles" aria-label="Stock filters">
        <label className={`toggle-chip${filters.low ? ' checked' : ''}`}>
          <input type="checkbox" checked={filters.low} onChange={event => update({ low: event.target.checked })} />
          Low stock
        </label>
        <label className={`toggle-chip${filters.archived ? ' checked' : ''}`}>
          <input type="checkbox" checked={filters.archived} onChange={event => update({ archived: event.target.checked })} />
          Archived
        </label>
      </div>
    </div>

    <div className="section-head" id="inventory-heading">
      <div><div className="title-row"><h2>{filters.archived ? 'Archived inventory' : 'Inventory'}</h2>
        <span className="count-pill">{items.length}</span></div>
        <p className="muted">{loading ? 'Updating inventory…' : `${items.length} item${items.length === 1 ? '' : 's'} shown`}</p></div>
      <div className="section-actions">
        {hasFilters && <button className="quiet" onClick={() => setFilters({ q: '', category: '', low: false, archived: false })}>Clear filters</button>}
        <button onClick={onExport} disabled={!items.length}><Icon name="download" />Export CSV</button>
        <button onClick={() => window.print()} disabled={!items.length}><Icon name="printer" />Print</button>
        <button className="icon-button" onClick={onRefresh} aria-label="Refresh inventory" title="Refresh inventory"><Icon name="refresh" /></button>
        <button className="primary mobile-add" onClick={onAdd}><Icon name="plus" />Add item</button>
      </div>
    </div>

    <div className={`table-wrap inventory-wrap${loading ? ' loading' : ''}`}>
      <table className="inventory-table">
        <thead><tr><th>Item</th><th>Location</th><th>In stock</th><th>Minimum</th><th>Value · {currency}</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{items.map(item => <tr key={item.id} className={item.low && !item.archived ? 'low-row' : ''}>
          <td data-label="Item"><div className="item-cell"><span className="item-avatar">{item.name.slice(0, 1).toUpperCase()}</span><span>
            <strong>{item.name}</strong><small>{item.sku}{item.category ? ` · ${item.category}` : ''}</small></span></div></td>
          <td data-label="Location"><span>{item.location || '—'}</span>{item.supplier && <small>{item.supplier}</small>}</td>
          <td data-label="In stock"><div className="stock-amount"><strong>{formatAmount(item.quantity)}</strong><span>{item.unit}</span></div>
            {item.low && !item.archived && <span className={`badge ${Number(item.quantity) === 0 ? 'badge-red' : 'badge-amber'}`}>
              {Number(item.quantity) === 0 ? 'Out of stock' : 'Low stock'}</span>}</td>
          <td data-label="Minimum">{formatAmount(item.minimum)} {item.unit}</td>
          <td data-label={`Value · ${currency}`}><strong>{formatMoney(item.value)}</strong></td>
          <td data-label="Actions"><div className="actions">
            {item.archived ? <button className="primary-soft" disabled={busy} onClick={() => onArchive(item, false)}>Restore</button> : <>
              <QuickAdjuster item={item} busy={busy} onAdjust={onQuickAdjust} />
              <button className="primary-soft" disabled={busy} onClick={() => onStock(item)}>Stock in / out</button>
              <button className="icon-button" onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`} title="Edit item"><Icon name="edit" /></button>
              <button className="icon-button" onClick={() => onHistory(item)} aria-label={`View history for ${item.name}`} title="View history"><Icon name="history" /></button>
              <button className="icon-button danger" disabled={busy || Number(item.quantity) !== 0}
                onClick={() => onArchive(item, true)} aria-label={`Archive ${item.name}`}
                title={Number(item.quantity) !== 0 ? 'Stock must be zero before archiving' : 'Archive item'}><Icon name="archive" /></button>
            </>}
          </div></td>
        </tr>)}</tbody>
      </table>
      {!items.length && !loading && <div className="empty-state"><span className="empty-icon"><Icon name={hasFilters ? 'search' : 'box'} size={24} /></span>
        <h3>{hasFilters ? 'No matching items' : 'Your inventory is ready'}</h3>
        <p>{hasFilters ? 'Try changing or clearing the filters.' : 'Add your first workshop item to start tracking stock.'}</p>
        {!hasFilters && <button className="primary" onClick={onAdd}><Icon name="plus" />Add first item</button>}
      </div>}
    </div>
  </section>;
}
