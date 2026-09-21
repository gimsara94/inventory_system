function normalized(statement) {
  return statement.replace(/\s+/g, ' ').trim();
}

function duplicate(message) {
  const error = new Error(message);
  error.code = '23505';
  throw error;
}

function cloneRows(rows) {
  return rows.map(row => ({ ...row }));
}

export class MemoryDatabase {
  constructor(seed) {
    this.reset(seed);
  }

  reset(seed) {
    this.state = structuredClone(seed);
    this.snapshot = null;
  }

  async connect() {
    return {
      query: (statement, parameters) => this.query(statement, parameters),
      release() {},
    };
  }

  async query(statement, parameters = []) {
    const sql = normalized(statement);
    if (sql === 'BEGIN') {
      this.snapshot = structuredClone(this.state);
      return { rows: [] };
    }
    if (sql === 'COMMIT') {
      this.snapshot = null;
      return { rows: [] };
    }
    if (sql === 'ROLLBACK') {
      if (this.snapshot) this.state = this.snapshot;
      this.snapshot = null;
      return { rows: [] };
    }
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [{}] };

    if (sql.startsWith('SELECT * FROM inventory.login_attempts')) {
      const keys = parameters[0];
      return { rows: keys.filter(key => this.state.loginAttempts[key])
        .map(key => ({ key, ...this.state.loginAttempts[key] })) };
    }
    if (sql.startsWith('INSERT INTO inventory.login_attempts')) {
      const key = parameters[0];
      const now = new Date();
      const previous = this.state.loginAttempts[key];
      const expired = previous && previous.window_started < new Date(now.getTime() - 10 * 60 * 1000);
      const failures = !previous || expired ? 1 : previous.failures + 1;
      this.state.loginAttempts[key] = {
        failures,
        window_started: !previous || expired ? now : previous.window_started,
        blocked_until: previous && !expired && previous.failures >= 9
          ? new Date(now.getTime() + 10 * 60 * 1000)
          : null,
      };
      return { rows: [] };
    }
    if (sql.startsWith('DELETE FROM inventory.login_attempts')) {
      for (const key of parameters[0]) delete this.state.loginAttempts[key];
      return { rows: [] };
    }

    if (sql === 'SELECT * FROM inventory.users WHERE email=$1') {
      const user = this.state.users.find(row => row.email === parameters[0]);
      return { rows: user ? [{ ...user }] : [] };
    }
    if (sql.startsWith('SELECT id,email,name,role,active,token_version FROM inventory.users')) {
      const user = this.state.users.find(row => String(row.id) === String(parameters[0]));
      return { rows: user ? [{ id: user.id, email: user.email, name: user.name,
        role: user.role, active: user.active, token_version: user.token_version }] : [] };
    }
    if (sql === 'SELECT id,email,name,role,active FROM inventory.users ORDER BY id') {
      return { rows: this.state.users.map(({ id, email, name, role, active }) => (
        { id, email, name, role, active }
      )) };
    }
    if (sql.startsWith('INSERT INTO inventory.users')) {
      const [address, name, passwordHash, role] = parameters;
      if (this.state.users.some(user => user.email === address)) duplicate('duplicate user');
      const user = { id: String(this.state.nextUserId++), email: address, name,
        password_hash: passwordHash, role, active: true, token_version: 1 };
      this.state.users.push(user);
      return { rows: [{ id: user.id, email: user.email, name, role, active: true }] };
    }
    if (sql === 'SELECT * FROM inventory.users WHERE id=$1 FOR UPDATE') {
      const user = this.state.users.find(row => String(row.id) === String(parameters[0]));
      return { rows: user ? [{ ...user }] : [] };
    }
    if (sql.startsWith("SELECT count(*)::int AS count FROM inventory.users WHERE role='admin'")) {
      return { rows: [{ count: this.state.users.filter(user => user.role === 'admin' && user.active).length }] };
    }
    if (sql.startsWith('UPDATE inventory.users SET password_hash=$2')) {
      const user = this.state.users.find(row => String(row.id) === String(parameters[0]));
      user.password_hash = parameters[1];
      return { rows: [] };
    }
    if (sql.startsWith('UPDATE inventory.users SET name=$2')) {
      const [id, name, role, active, passwordHash] = parameters;
      const user = this.state.users.find(row => String(row.id) === String(id));
      Object.assign(user, { name, role, active, password_hash: passwordHash,
        token_version: user.token_version + 1 });
      return { rows: [{ id: user.id, email: user.email, name, role, active }] };
    }

    if (sql.startsWith('SELECT count(*)::int AS items')) {
      const items = this.state.items.filter(item => !item.archived);
      const value = items.reduce((sum, item) => (
        sum + (BigInt(item.quantity) * BigInt(item.cost) + 500n) / 1000n
      ), 0n);
      return { rows: [{
        items: items.length,
        low: items.filter(item => BigInt(item.quantity) <= BigInt(item.minimum)).length,
        empty: items.filter(item => BigInt(item.quantity) === 0n).length,
        value_cents: String(value),
      }] };
    }
    if (sql.startsWith('SELECT DISTINCT category FROM inventory.items')) {
      const categories = [...new Set(this.state.items
        .filter(item => !item.archived && item.category)
        .map(item => item.category))].sort();
      return { rows: categories.map(category => ({ category })) };
    }
    if (sql.startsWith('SELECT * FROM inventory.items WHERE archived=$1')) {
      const [archived, search, _pattern, category, lowOnly] = parameters;
      const needle = search.toLowerCase();
      const rows = this.state.items.filter(item => item.archived === archived)
        .filter(item => !needle || [item.name, item.sku, item.category, item.location]
          .some(value => value.toLowerCase().includes(needle)))
        .filter(item => !category || item.category === category)
        .filter(item => !lowOnly || BigInt(item.quantity) <= BigInt(item.minimum))
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          || Number(a.id) - Number(b.id))
        .slice(0, 1000);
      return { rows: cloneRows(rows) };
    }
    if (sql.startsWith('SELECT * FROM inventory.items WHERE id=$1')) {
      const item = this.state.items.find(row => String(row.id) === String(parameters[0]));
      return { rows: item ? [{ ...item }] : [] };
    }
    if (sql.startsWith('INSERT INTO inventory.items')) {
      const [sku, name, category, unit, quantity, minimum, location, supplier, cost, notes] = parameters;
      if (this.state.items.some(item => item.sku === sku)) duplicate('duplicate item');
      const item = { id: String(this.state.nextItemId++), sku, name, category, unit,
        quantity, minimum, location, supplier, cost, notes, archived: false, version: 1 };
      this.state.items.push(item);
      return { rows: [{ ...item }] };
    }
    if (sql.startsWith('UPDATE inventory.items SET sku=$2')) {
      const [id, sku, name, category, minimum, location, supplier, cost, notes] = parameters;
      if (this.state.items.some(item => item.sku === sku && String(item.id) !== String(id))) {
        duplicate('duplicate item');
      }
      const item = this.state.items.find(row => String(row.id) === String(id));
      Object.assign(item, { sku, name, category, minimum, location, supplier, cost,
        notes, version: item.version + 1 });
      return { rows: [{ ...item }] };
    }
    if (sql.startsWith('UPDATE inventory.items SET quantity=$2')) {
      const item = this.state.items.find(row => String(row.id) === String(parameters[0]));
      item.quantity = parameters[1];
      item.version += 1;
      return { rows: [{ ...item }] };
    }
    if (sql.startsWith('UPDATE inventory.items SET archived=$2')) {
      const item = this.state.items.find(row => String(row.id) === String(parameters[0]));
      item.archived = parameters[1];
      item.version += 1;
      return { rows: [{ ...item }] };
    }

    if (sql.startsWith('INSERT INTO inventory.stock_log')) {
      const [itemId, actorId, sku, name, unit, change, balance, kind, reason, requestId] = parameters;
      if (requestId && this.state.movements.some(row => row.request_id === requestId)) {
        duplicate('duplicate movement');
      }
      this.state.movements.push({ id: String(this.state.nextMovementId++), item_id: itemId,
        actor_id: actorId, sku, name, unit, change, balance, kind, reason,
        request_id: requestId, timestamp: new Date() });
      return { rows: [] };
    }
    if (sql === 'SELECT * FROM inventory.stock_log WHERE request_id=$1') {
      const movement = this.state.movements.find(row => row.request_id === parameters[0]);
      return { rows: movement ? [{ ...movement }] : [] };
    }
    if (sql.startsWith('SELECT l.id,l.item_id') && sql.includes('FROM inventory.stock_log')) {
      const itemId = parameters[0];
      const rows = this.state.movements.filter(row => !itemId || String(row.item_id) === String(itemId))
        .sort((a, b) => Number(b.id) - Number(a.id))
        .slice(0, 500)
        .map(row => ({ ...row, actor_name: this.state.users
          .find(user => String(user.id) === String(row.actor_id))?.name ?? null }));
      return { rows };
    }

    throw new Error(`The in-memory database does not support this query: ${sql}`);
  }
}

export function emptyState(users = []) {
  return {
    users,
    items: [],
    movements: [],
    loginAttempts: {},
    nextUserId: users.length + 1,
    nextItemId: 1,
    nextMovementId: 1,
  };
}
