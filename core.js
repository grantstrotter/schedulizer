// Small utilities shared between the two Schedulizer pages (index.html's night
// scheduler and distribute.html's participant distributor). Deliberately minimal —
// each page owns its own data model, rendering, and drag-and-drop logic, since their
// actual needs (day grid vs. side-by-side groups) diverge enough that force-sharing
// that part would add more complexity than it'd save.

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };
const DAY_ABBR = { sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' };

function uid() {
  return crypto.randomUUID();
}

function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text) node.textContent = opts.text;
  if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (opts.html) node.innerHTML = opts.html;
  return node;
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCSVLine(line) {
  // simple comma split; does not handle quoted commas
  return line.split(',').map(s => s.trim());
}

function parseAvailability(raw, delimiter = '|') {
  if (!raw) return [];
  const abbrevToDay = {};
  DAYS.forEach(d => { abbrevToDay[DAY_ABBR[d].toLowerCase()] = d; });
  return raw.split(delimiter)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .map(token => (DAYS.includes(token) ? token : abbrevToDay[token]))
    .filter(Boolean);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('visible'), 3200);
}
