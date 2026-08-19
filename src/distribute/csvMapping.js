import { parseCSVRow } from '../lib/util.js';

export { parseCSVRow };

// Group columns are identified first and excluded from every other heuristic below —
// otherwise a bracketed group name that happens to contain a keyword (e.g. "[Wednesday
// Night - City Leadership & Services]" containing "leader") gets misclaimed as that
// single-purpose field instead of showing up as a group-ranking column.
export function defaultMappingFromHeaders(headers) {
  const groupOrder = [];
  const isGroupCol = new Set();
  headers.forEach((h, i) => {
    const m = h.match(/\[([^\]]+)\]/);
    if (m) { groupOrder.push({ index: i, name: m[1].trim() }); isGroupCol.add(i); }
  });
  const find = (predicate) => headers.findIndex((h, i) => !isGroupCol.has(i) && predicate(h));

  const nameIdx = find(h => h.toLowerCase() === 'name' || h.toLowerCase() === 'full name');
  const firstIdx = find(h => h.toLowerCase().includes('first'));
  const lastIdx = find(h => h.toLowerCase().includes('last'));
  const phoneIdx = find(h => h.toLowerCase().includes('phone'));
  const emailIdx = find(h => h.toLowerCase().includes('email'));
  const availIdx = find(h => {
    const lower = h.toLowerCase();
    return lower.includes('available') || lower.includes('availability');
  });
  const commentsIdx = find(h => {
    const lower = h.toLowerCase();
    return lower.includes('comment') || lower.includes('question') || lower.includes('concern');
  });
  const nameMode = nameIdx !== -1 ? 'single' : (firstIdx !== -1 || lastIdx !== -1 ? 'split' : 'single');

  return { nameMode, nameIdx, firstIdx, lastIdx, phoneIdx, emailIdx, availIdx, commentsIdx, groupOrder };
}
