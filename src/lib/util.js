import { DAYS } from './constants.js';

export function uid() {
  return crypto.randomUUID();
}

export function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function parseCSVLine(line) {
  // simple comma split; does not handle quoted commas
  return line.split(',').map(s => s.trim());
}

export function parseCSVRow(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result.map(s => s.trim());
}

export function parseAvailability(raw, delimiter = '|') {
  if (!raw) return [];
  // Each day's first two letters are unique (su/mo/tu/we/th/fr/sa), so matching just
  // that prefix accepts full names, the app's own abbreviations, and any other
  // reasonable spelling ("Weds", "Thurs", etc.) without needing an exact-match list.
  const prefixToDay = {};
  DAYS.forEach(d => { prefixToDay[d.slice(0, 2)] = d; });
  return raw.split(delimiter)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .map(token => prefixToDay[token.slice(0, 2)])
    .filter(Boolean);
}

// Formats a US phone number as 999-999-9999 for CSV export. Anything that isn't
// exactly 10 digits (an international number, an extension, a partial entry, blank)
// is left exactly as typed rather than guessed at.
export function formatPhone(raw) {
  let digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
  if (digits.length !== 10) return raw || '';
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
