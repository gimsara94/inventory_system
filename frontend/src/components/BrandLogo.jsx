import React from 'react';

export function BrandLogo({ className = '', label = '' }) {
  return <span className={`brand-logo ${className}`.trim()}>
    <img src="/workshop-logo.jpeg" alt={label} />
  </span>;
}
