import React, { useState } from 'react';
import { api } from '../services/api.js';
import { formatAmount, requestId } from '../utils/format.js';
import { Modal } from './Modal.jsx';

export function StockForm({ item, close, saved }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('receipt');
  const [operationId] = useState(requestId);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    let change = data.amount.trim();
    if (kind === 'issue') change = `-${change.replace(/^\+/, '')}`;
    try {
      await api(`/items/${item.id}/adjust`, {
        method: 'POST',
        body: { change, kind, reason: data.reason, request_id: operationId },
      });
      await saved('Stock movement saved.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const correction = kind === 'correction';
  return <Modal title="Record stock movement" description="Add received stock, record usage, or correct a count."
    close={close} narrow>
    <div className="stock-current">
      <span>{item.name}<small>{item.sku}</small></span>
      <strong>{formatAmount(item.quantity)} <small>{item.unit}</small></strong>
    </div>
    <form onSubmit={submit} aria-busy={busy}>
      <label>Movement type
        <select name="kind" value={kind} onChange={event => setKind(event.target.value)}>
          <option value="receipt">Stock in · received</option>
          <option value="issue">Stock out · used or issued</option>
          <option value="correction">Correction · signed difference</option>
        </select>
      </label>
      <label>{correction ? 'Quantity difference' : 'Quantity'}
        <input name="amount" type="number" step="0.001" required inputMode="decimal"
          min={correction ? '-1000000000' : '0.001'} max="1000000000"
          placeholder={correction ? 'e.g. -2 or 2' : '0'} />
      </label>
      {correction && <p className="form-hint correction-hint">Enter the difference. For example, −2 removes two and +2 adds two.</p>}
      <label>Reason <span className="required">Required</span>
        <input name="reason" required maxLength="240"
          placeholder={kind === 'receipt' ? 'e.g. Supplier delivery' : 'e.g. Used for assembly'} />
      </label>
      {error && <p className="form-alert" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" onClick={close}>Cancel</button>
        <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save movement'}</button>
      </div>
    </form>
  </Modal>;
}
