import React from 'react';
import { formatMoney } from '../utils/format.js';
import { Icon } from './Icon.jsx';

const cards = [
  { key: 'items', label: 'Active items', helper: 'Inventory lines', icon: 'box', tone: 'green' },
  { key: 'low', label: 'Low stock', helper: 'At or below minimum', icon: 'warning', tone: 'amber' },
  { key: 'empty', label: 'Out of stock', helper: 'Need attention', icon: 'arrowDown', tone: 'red' },
  { key: 'value', label: 'Stock value', helper: 'At recorded unit cost', icon: 'trend', tone: 'blue' },
];

export function StatCards({ summary }) {
  return <section className="stats" aria-label="Current inventory summary">
    {cards.map(card => <article className={`stat-card stat-${card.tone}`} key={card.key}>
      <div className="stat-top"><span>{card.label}{card.key === 'value' && summary ? ` · ${summary.currency}` : ''}</span>
        <span className="stat-icon"><Icon name={card.icon} /></span></div>
      <strong>{summary ? (card.key === 'value' ? formatMoney(summary.value) : summary[card.key]) : '—'}</strong>
      <small>{card.helper}</small>
    </article>)}
  </section>;
}
