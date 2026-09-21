export function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^-?\d+(?:\.\d+)?$/.test(text) || !/^\s*[=+\-@]/.test(text) ? text : `'${text}`;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function downloadCsv(filename, columns, rows) {
  const csv = [columns, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
