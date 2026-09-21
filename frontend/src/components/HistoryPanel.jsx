import React, { useEffect, useMemo, useState } from 'react';
import { downloadCsv } from '../utils/csv.js';
import { dateKey, formatAmount, formatDateTime } from '../utils/format.js';
import { Icon } from './Icon.jsx';

const kindLabels = { opening: 'Opening', receipt: 'Stock in', issue: 'Stock out', correction: 'Correction' };

export function HistoryPanel({ movements, loading, timeZone, focusedItem, clearFocusedItem, onRefresh }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { if (focusedItem) setQuery(''); }, [focusedItem]);
  const filtered = useMemo(() => movements.filter(row => {
    const needle = query.trim().toLowerCase();
    const day = dateKey(row.timestamp, timeZone);
    return (!focusedItem || String(row.item_id) === String(focusedItem.id))
      && (!kind || row.kind === kind)
      && (!from || day >= from)
      && (!to || day <= to)
      && (!needle || [row.name, row.sku, row.reason, row.actor_name].some(value => String(value || '').toLowerCase().includes(needle)));
  }), [movements, query, kind, from, to, focusedItem, timeZone]);

  function exportRows() {
    downloadCsv('stock-movements.csv', ['Date', 'Item', 'Code', 'Type', 'Change', 'Balance', 'Unit', 'Reason', 'By'],
      filtered.map(row => [formatDateTime(row.timestamp, timeZone), row.name, row.sku,
        kindLabels[row.kind] || row.kind, row.change, row.balance, row.unit, row.reason, row.actor_name || 'Former user']));
  }

  const filtersActive = Boolean(query || kind || from || to || focusedItem);
  return <section className="content-panel history-panel" aria-labelledby="history-heading">
    <div className="section-head history-heading" id="history-heading">
      <div><div className="title-row"><h2>Stock history</h2><span className="count-pill">{filtered.length}</span></div>
        <p className="muted">Review receipts, usage, corrections, and opening balances.</p></div>
      <div className="section-actions">
        <button onClick={exportRows} disabled={!filtered.length}><Icon name="download" />Export CSV</button>
        <button onClick={() => window.print()} disabled={!filtered.length}><Icon name="printer" />Print</button>
        <button className="icon-button" onClick={onRefresh} aria-label="Refresh history"><Icon name="refresh" /></button>
      </div>
    </div>
    {focusedItem && <div className="focus-filter"><span>Showing history for <strong>{focusedItem.name}</strong></span>
      <button className="quiet" onClick={clearFocusedItem}>Show all movements</button></div>}
    <div className="history-filters">
      <label className="search-field"><span>Search history</span><span className="input-with-icon"><Icon name="search" />
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Item, reason, or user" /></span></label>
      <label><span>Movement</span><select value={kind} onChange={event => setKind(event.target.value)}>
        <option value="">All movements</option><option value="opening">Opening</option>
        <option value="receipt">Stock in</option><option value="issue">Stock out</option><option value="correction">Correction</option>
      </select></label>
      <label><span>From date</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label><span>To date</span><input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
      {filtersActive && <button className="quiet clear-history" onClick={() => { setQuery(''); setKind(''); setFrom(''); setTo(''); clearFocusedItem(); }}>Clear</button>}
    </div>
    <div className={`table-wrap${loading ? ' loading' : ''}`}>
      <table className="history-table"><thead><tr><th>Date</th><th>Item</th><th>Movement</th><th>Change</th><th>Balance</th><th>Reason</th><th>Recorded by</th></tr></thead>
        <tbody>{filtered.map(row => <tr key={row.id}>
          <td data-label="Date">{formatDateTime(row.timestamp, timeZone)}</td>
          <td data-label="Item"><strong>{row.name}</strong><small>{row.sku}</small></td>
          <td data-label="Movement"><span className={`movement-kind kind-${row.kind}`}>{kindLabels[row.kind] || row.kind}</span></td>
          <td data-label="Change"><span className={Number(row.change) > 0 ? 'positive-change' : Number(row.change) < 0 ? 'negative-change' : ''}>
            {Number(row.change) > 0 ? '+' : ''}{formatAmount(row.change)} {row.unit}</span></td>
          <td data-label="Balance">{formatAmount(row.balance)} {row.unit}</td>
          <td data-label="Reason">{row.reason}</td><td data-label="Recorded by">{row.actor_name || 'Former user'}</td>
        </tr>)}</tbody>
      </table>
      {!filtered.length && !loading && <div className="empty-state"><span className="empty-icon"><Icon name="history" size={24} /></span>
        <h3>No movements found</h3><p>Stock movements matching these filters will appear here.</p></div>}
    </div>
    <p className="table-note">Showing up to the latest 500 recorded movements. Dates use {timeZone}.</p>
  </section>;
}
