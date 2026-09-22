import React, { useState } from 'react';
import { api } from '../services/api.js';
import { BrandLogo } from './BrandLogo.jsx';
import { Icon } from './Icon.jsx';

export function Login({ onLogin }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email: form.get('email'), password: form.get('password') },
      });
      onLogin(data.user);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-page">
    <section className="login-visual" aria-hidden="true">
      <div className="login-copy">
        <BrandLogo className="login-hero-logo" />
        <h1>Falcon Inventory</h1>
        <p>Keep stock accurate, find parts quickly, and spot shortages before they slow down the workshop.</p>
      </div>
      <div className="login-preview">
        <div className="preview-head"><span>Today’s stock</span><span className="status-dot">Live</span></div>
        <div className="preview-grid">
          <span><small>Items</small><strong>128</strong></span>
          <span><small>Low stock</small><strong>06</strong></span>
          <span><small>Movements</small><strong>24</strong></span>
        </div>
        <div className="preview-row"><span className="preview-icon"><Icon name="box" /></span><span><strong>M8 hex bolts</strong><small>Rack A · Bin 03</small></span><b>240 pcs</b></div>
        <div className="preview-row"><span className="preview-icon warning-icon"><Icon name="warning" /></span><span><strong>Cutting discs</strong><small>Consumables</small></span><b className="amber-text">4 pcs</b></div>
      </div>
    </section>
    <section className="login-form-side">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mobile-brand"><BrandLogo /><strong>Falcon Inventory</strong></div>
        <p className="eyebrow">WELCOME BACK</p>
        <h2>Sign in to your workshop</h2>
        <p className="muted login-intro">Use the account created by your inventory administrator.</p>
        <label>Email address
          <input name="email" type="email" required autoComplete="username" autoFocus
            placeholder="you@workshop.com" maxLength="254" />
        </label>
        <label>Password
          <span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'}
            required autoComplete="current-password" maxLength="200" />
            <button type="button" className="show-password" onClick={() => setShowPassword(value => !value)}>
              {showPassword ? 'Hide' : 'Show'}
            </button></span>
        </label>
        {error && <p className="form-alert" role="alert"><Icon name="warning" />{error}</p>}
        <button className="primary login-submit" disabled={busy}>
          {busy ? <><span className="spinner" />Signing in…</> : 'Sign in'}
        </button>
        <p className="login-help">Contact an administrator if you cannot access your account.</p>
      </form>
    </section>
  </main>;
}
