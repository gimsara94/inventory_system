import React, { useState } from 'react';
import { api } from '../services/api.js';
import { Modal } from './Modal.jsx';

const emptyItem = {
  name: '', sku: '', category: '', unit: 'pcs', quantity: '0', minimum: '0',
  unit_cost: '0.00', location: '', supplier: '', notes: '',
};

export function ItemForm({ item, currency, categories, close, saved }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (item) {
      data.version = item.version;
      data.unit = item.unit;
      delete data.quantity;
    }
    try {
      await api(item ? `/items/${item.id}` : '/items', {
        method: item ? 'PUT' : 'POST', body: data,
      });
      await saved(item ? 'Item updated.' : 'Item added.');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const value = key => item?.[key] ?? emptyItem[key];
  return <Modal title={item ? 'Edit item' : 'Add a new item'}
    description={item ? 'Update the item details. Use stock movement to change quantity.' : 'Add a tool, part, or material to your inventory.'}
    close={close}>
    <form onSubmit={submit} aria-busy={busy}>
      <div className="form-grid">
        <label className="wide">Item name <span className="required">Required</span>
          <input name="name" defaultValue={value('name')} required maxLength="120"
            placeholder="e.g. M8 hex bolt" />
        </label>
        <label>Item code
          <input name="sku" defaultValue={value('sku')} maxLength="40"
            placeholder="Generated if blank" />
        </label>
        <label>Category
          <input name="category" defaultValue={value('category')} maxLength="80"
            list="category-options" placeholder="e.g. Fasteners" />
          <datalist id="category-options">{categories.map(category => <option value={category} key={category} />)}</datalist>
        </label>
        <label>Unit <span className="required">Required</span>
          <input name="unit" defaultValue={value('unit')} required maxLength="20"
            disabled={Boolean(item)} list="unit-options" />
          <datalist id="unit-options"><option value="pcs" /><option value="kg" />
            <option value="m" /><option value="litres" /><option value="sets" /></datalist>
        </label>
        {!item && <label>Opening stock <span className="required">Required</span>
          <input name="quantity" defaultValue={value('quantity')} type="number" required
            min="0" max="1000000000" step="0.001" inputMode="decimal" />
        </label>}
        <label>Minimum stock <span className="required">Required</span>
          <input name="minimum" defaultValue={value('minimum')} type="number" required
            min="0" max="1000000000" step="0.001" inputMode="decimal" />
        </label>
        <label>Unit cost · {currency} <span className="required">Required</span>
          <input name="unit_cost" defaultValue={value('unit_cost')} type="number" required
            min="0" max="10000000" step="0.01" inputMode="decimal" />
        </label>
        <label>Location
          <input name="location" defaultValue={value('location')} maxLength="100"
            placeholder="e.g. Rack A · Bin 03" />
        </label>
        <label>Supplier
          <input name="supplier" defaultValue={value('supplier')} maxLength="120"
            placeholder="Optional supplier" />
        </label>
        <label className="wide">Notes
          <textarea name="notes" defaultValue={value('notes')} maxLength="2000" rows="3"
            placeholder="Part numbers, compatibility, or other useful details" />
        </label>
      </div>
      <p className="form-hint">Stock supports up to three decimal places. Existing quantities are changed through stock movements.</p>
      {error && <p className="form-alert" role="alert">{error}</p>}
      <div className="dialog-actions">
        <button type="button" onClick={close}>Cancel</button>
        <button className="primary" disabled={busy}>{busy ? 'Saving…' : item ? 'Save changes' : 'Add item'}</button>
      </div>
    </form>
  </Modal>;
}
