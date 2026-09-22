import React from 'react';
import { BrandLogo } from './BrandLogo.jsx';
import { Icon } from './Icon.jsx';

export function TopBar({ user, onLogout }) {
  const initials = user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return <header className="topbar">
    <div className="topbar-inner">
      <a className="brand" href="#top" aria-label="Workshop Inventory home">
        <BrandLogo />
        <span>Workshop Inventory<small>TOOLS · PARTS · MATERIALS</small></span>
      </a>
      <div className="account">
        <span className="avatar" aria-hidden="true">{initials}</span>
        <span className="account-copy"><strong>{user.name}</strong><small>{user.role === 'admin' ? 'Administrator' : 'Workshop staff'}</small></span>
        <button className="quiet signout" onClick={onLogout}><Icon name="logout" /><span>Sign out</span></button>
      </div>
    </div>
  </header>;
}
