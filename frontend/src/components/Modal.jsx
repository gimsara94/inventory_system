import React, { useEffect, useRef } from 'react';
import { Icon } from './Icon.jsx';

export function Modal({ title, description, close, children, narrow = false }) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const onKeyDown = event => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.classList.add('modal-open');
    panel.current?.querySelector('input, select, textarea, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('modal-open');
      previous?.focus?.();
    };
  }, [close]);

  return <div className="overlay" onMouseDown={event => {
    if (event.target === event.currentTarget) close();
  }}>
    <section ref={panel} className={`dialog${narrow ? ' dialog-narrow' : ''}`}
      role="dialog" aria-modal="true" aria-labelledby="dialog-title"
      aria-describedby={description ? 'dialog-description' : undefined}>
      <div className="dialog-head">
        <div><p className="eyebrow">WORKSHOP INVENTORY</p><h2 id="dialog-title">{title}</h2>
          {description && <p id="dialog-description" className="muted dialog-description">{description}</p>}</div>
        <button type="button" className="icon-button quiet" onClick={close} aria-label="Close dialog">
          <Icon name="x" />
        </button>
      </div>
      {children}
    </section>
  </div>;
}
