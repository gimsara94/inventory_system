import React, { useState } from 'react';
import { api } from '../services/api.js';
import { Icon } from './Icon.jsx';

export function UsersPanel({ users, currentUser, loading, onRefresh, notify }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    try {
      await api('/users', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      form.reset();
      await onRefresh();
      notify('User created. They can now sign in.', 'success');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(user) {
    setUpdatingId(user.id);
    setError('');
    try {
      await api(`/users/${user.id}`, { method: 'PATCH', body: { active: !user.active } });
      await onRefresh();
      notify(user.active ? 'User disabled.' : 'User enabled.', 'success');
    } catch (failure) {
      setError(failure.message);
    } finally {
      setUpdatingId(null);
    }
  }

  return <section className="users-layout" aria-labelledby="users-heading">
    <div className="content-panel users-list">
      <div className="section-head" id="users-heading"><div><div className="title-row"><h2>Team access</h2><span className="count-pill">{users.length}</span></div>
        <p className="muted">Manage who can access this inventory.</p></div>
        <button className="icon-button" onClick={onRefresh} aria-label="Refresh users"><Icon name="refresh" /></button></div>
      <div className={`table-wrap${loading ? ' loading' : ''}`}>
        <table className="users-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>{users.map(user => <tr key={user.id}>
            <td data-label="User"><div className="user-cell"><span className="avatar small-avatar">{user.name.slice(0, 2).toUpperCase()}</span><span>
              <strong>{user.name}{String(user.id) === String(currentUser.id) && <em>You</em>}</strong><small>{user.email}</small></span></div></td>
            <td data-label="Role"><span className={`role-badge role-${user.role}`}>{user.role}</span></td>
            <td data-label="Status"><span className={`status-badge ${user.active ? 'active' : 'disabled'}`}><i />{user.active ? 'Active' : 'Disabled'}</span></td>
            <td data-label="Action"><button disabled={updatingId === user.id || String(user.id) === String(currentUser.id)}
              onClick={() => toggle(user)} title={String(user.id) === String(currentUser.id) ? 'You cannot disable your own account' : ''}>
              {updatingId === user.id ? 'Updating…' : user.active ? 'Disable' : 'Enable'}</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>

    <aside className="content-panel add-user-card">
      <div className="add-user-icon"><Icon name="users" /></div>
      <p className="eyebrow">ADMIN ONLY</p><h2>Add a team member</h2>
      <p className="muted">Create an account for someone who needs inventory access.</p>
      <form onSubmit={create} aria-busy={busy}>
        <label>Full name <span className="required">Required</span>
          <input name="name" required maxLength="120" placeholder="e.g. Kasun Perera" /></label>
        <label>Email address <span className="required">Required</span>
          <input name="email" type="email" required maxLength="254" autoComplete="off" placeholder="name@workshop.com" /></label>
        <label>Temporary password <span className="required">Required</span>
          <span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} minLength="12"
            maxLength="200" required autoComplete="new-password" />
            <button type="button" className="show-password" onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button></span></label>
        <p className="form-hint">Use at least 12 characters.</p>
        <label>Access level
          <select name="role" defaultValue="staff"><option value="staff">Staff · manage inventory</option>
            <option value="admin">Admin · inventory and users</option></select></label>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <button className="primary full-button" disabled={busy}><Icon name="plus" />{busy ? 'Creating…' : 'Create user'}</button>
      </form>
    </aside>
  </section>;
}
