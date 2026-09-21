export function formatAmount(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('en-GB', { maximumFractionDigits: 3 })
    : String(value ?? '0');
}

export function formatMoney(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value ?? '0.00');
}

export function formatDateTime(value, timeZone = 'Asia/Colombo') {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(value));
  } catch {
    return String(value ?? '');
  }
}

export function dateKey(value, timeZone = 'Asia/Colombo') {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone,
    }).formatToParts(new Date(value));
    const part = type => parts.find(entry => entry.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    return '';
  }
}

export function requestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const values = new Uint8Array(16);
  globalThis.crypto.getRandomValues(values);
  return Array.from(values, value => value.toString(16).padStart(2, '0')).join('');
}
