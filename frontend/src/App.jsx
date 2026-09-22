import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrandLogo } from './components/BrandLogo.jsx';
import { HistoryPanel } from './components/HistoryPanel.jsx';
import { Icon } from './components/Icon.jsx';
import { InventoryPanel } from './components/InventoryPanel.jsx';
import { ItemForm } from './components/ItemForm.jsx';
import { Login } from './components/Login.jsx';
import { StatCards } from './components/StatCards.jsx';
import { StockForm } from './components/StockForm.jsx';
import { TopBar } from './components/TopBar.jsx';
import { UsersPanel } from './components/UsersPanel.jsx';
import { useDebouncedValue } from './hooks/useDebouncedValue.js';
import { api, clearCsrf } from './services/api.js';
import { downloadCsv } from './utils/csv.js';
import { formatAmount, formatMoney, requestId } from './utils/format.js';

const emptyFilters = { q: '', category: '', low: false, archived: false };
const headings = {
  inventory: ['WORKSHOP OVERVIEW', 'Every item, accounted for.', 'Track what you have, what you use, and what needs restocking.'],
  history: ['STOCK ACTIVITY', 'Every movement, clearly recorded.', 'Review what came in, what went out, and who recorded it.'],
  users: ['TEAM ACCESS', 'The right access for every person.', 'Create staff accounts and manage access to the inventory.'],
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [tab, setTab] = useState('inventory');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [movements, setMovements] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [focusedItem, setFocusedItem] = useState(null);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const requestSequence = useRef(0);
  const debouncedQuery = useDebouncedValue(filters.q);
  const currency = summary?.currency || 'LKR';
  const timeZone = summary?.timeZone || 'Asia/Colombo';

  const notify = useCallback((message, type = 'success') => setNotice({ message, type }), []);

  useEffect(() => {
    api('/auth/me').then(data => setUser(data.user)).catch(() => clearCsrf()).finally(() => setAuthLoading(false));
    const expire = () => { clearCsrf(); setUser(null); setModal(null); };
    window.addEventListener('inventory:session-expired', expire);
    return () => window.removeEventListener('inventory:session-expired', expire);
  }, []);

  useEffect(() => {
    if (!notice || notice.type === 'error') return undefined;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const loadInventory = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setInventoryLoading(true);
    const parameters = new URLSearchParams({
      q: debouncedQuery,
      category: filters.category,
      low: filters.low ? '1' : '0',
      archived: filters.archived ? '1' : '0',
    });
    try {
      const [nextItems, nextSummary] = await Promise.all([
        api(`/items?${parameters}`),
        api('/summary'),
      ]);
      if (sequence === requestSequence.current) {
        setItems(nextItems);
        setSummary(nextSummary);
      }
    } finally {
      if (sequence === requestSequence.current) setInventoryLoading(false);
    }
  }, [debouncedQuery, filters.category, filters.low, filters.archived]);

  const loadMovements = useCallback(async () => {
    setHistoryLoading(true);
    try { setMovements(await api('/movements')); }
    finally { setHistoryLoading(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try { setUsers(await api('/users')); }
    finally { setUsersLoading(false); }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadInventory().catch(error => notify(error.message, 'error'));
  }, [user, loadInventory, notify]);

  useEffect(() => {
    if (!user) return;
    if (tab === 'history') loadMovements().catch(error => notify(error.message, 'error'));
    if (tab === 'users' && user.role === 'admin') loadUsers().catch(error => notify(error.message, 'error'));
  }, [tab, user, loadMovements, loadUsers, notify]);

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); }
    catch (error) { notify(error.message, 'error'); }
    finally { clearCsrf(); setUser(null); setTab('inventory'); }
  }

  async function runMutation(task, message) {
    setBusy(true);
    try {
      await task();
      notify(message);
      try {
        await loadInventory();
        if (tab === 'history') await loadMovements();
      } catch (refreshError) {
        notify(`${message} Refresh failed: ${refreshError.message}`, 'error');
      }
      return true;
    } catch (error) {
      notify(error.message, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function modalSaved(message) {
    setModal(null);
    notify(message);
    await loadInventory();
    if (tab === 'history') await loadMovements();
  }

  function quickAdjust(item, change) {
    const adding = Number(change) > 0;
    return runMutation(() => api(`/items/${item.id}/adjust`, {
      method: 'POST',
      body: {
        change: String(change),
        kind: adding ? 'receipt' : 'issue',
        reason: adding ? 'Quick add' : 'Quick remove',
        request_id: requestId(),
      },
    }), adding
      ? `Added ${formatAmount(change)} ${item.unit} to ${item.name}.`
      : `Removed ${formatAmount(Math.abs(Number(change)))} ${item.unit} from ${item.name}.`);
  }

  function archiveItem(item, archived) {
    const question = archived
      ? `Archive “${item.name}”? Its movement history will be kept.`
      : `Restore “${item.name}” to active inventory?`;
    if (!window.confirm(question)) return;
    runMutation(() => api(`/items/${item.id}/archive`, { method: 'POST', body: { archived } }),
      archived ? 'Item archived. History was kept.' : 'Item restored.');
  }

  function viewHistory(item) {
    setFocusedItem(item);
    setTab('history');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function exportItems() {
    downloadCsv(filters.archived ? 'archived-inventory.csv' : 'inventory.csv',
      ['Code', 'Name', 'Category', 'Location', 'Supplier', 'Quantity', 'Unit', 'Minimum', `Unit cost (${currency})`, `Value (${currency})`],
      items.map(item => [item.sku, item.name, item.category, item.location, item.supplier,
        formatAmount(item.quantity), item.unit, formatAmount(item.minimum), formatMoney(item.unit_cost), formatMoney(item.value)]));
  }

  if (authLoading) return <main className="app-loading"><BrandLogo /><span className="spinner dark" /><p>Opening workshop inventory…</p></main>;
  if (!user) return <Login onLogin={nextUser => { setUser(nextUser); setNotice(null); }} />;

  const [eyebrow, title, description] = headings[tab];
  return <div id="top" className="app-frame">
    <TopBar user={user} onLogout={logout} />
    <main className="shell">
      <header className="page-heading">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>
        {tab === 'inventory' && <button className="primary desktop-add" onClick={() => setModal({ type: 'item', item: null })}>
          <Icon name="plus" />Add item</button>}
      </header>

      {notice && <div className={`notice notice-${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>
        <span className="notice-icon"><Icon name={notice.type === 'error' ? 'warning' : 'check'} /></span>
        <span>{notice.message}</span><button className="quiet icon-button" onClick={() => setNotice(null)} aria-label="Dismiss message"><Icon name="x" /></button>
      </div>}

      <StatCards summary={summary} />
      <nav className="tabs" aria-label="Inventory sections">
        <button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')} aria-current={tab === 'inventory' ? 'page' : undefined}>
          <Icon name="box" />Inventory</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => { setFocusedItem(null); setTab('history'); }} aria-current={tab === 'history' ? 'page' : undefined}>
          <Icon name="history" />History</button>
        {user.role === 'admin' && <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')} aria-current={tab === 'users' ? 'page' : undefined}>
          <Icon name="users" />Users</button>}
      </nav>

      {tab === 'inventory' && <InventoryPanel items={items} filters={filters} setFilters={setFilters}
        categories={summary?.categories || []} currency={currency} loading={inventoryLoading} busy={busy}
        onRefresh={() => loadInventory().catch(error => notify(error.message, 'error'))}
        onAdd={() => setModal({ type: 'item', item: null })}
        onEdit={item => setModal({ type: 'item', item })}
        onStock={item => setModal({ type: 'stock', item })}
        onQuickAdjust={quickAdjust} onArchive={archiveItem} onHistory={viewHistory} onExport={exportItems} />}
      {tab === 'history' && <HistoryPanel movements={movements} loading={historyLoading}
        timeZone={timeZone} focusedItem={focusedItem} clearFocusedItem={() => setFocusedItem(null)}
        onRefresh={() => loadMovements().catch(error => notify(error.message, 'error'))} />}
      {tab === 'users' && user.role === 'admin' && <UsersPanel users={users} currentUser={user}
        loading={usersLoading} onRefresh={loadUsers} notify={notify} />}

      <footer><span>Workshop Inventory</span><span>Changes are stored securely in your PostgreSQL database.</span></footer>
    </main>
    {modal?.type === 'item' && <ItemForm item={modal.item} currency={currency}
      categories={summary?.categories || []} close={() => setModal(null)} saved={modalSaved} />}
    {modal?.type === 'stock' && <StockForm item={modal.item} close={() => setModal(null)} saved={modalSaved} />}
  </div>;
}
