// Since a person card's whole summary is the Sortable drag handle, Sortable's floating
// fallback ghost can end up sitting on top of the real card at pointerup time, so a
// listener attached to the card itself sometimes never receives that event at all — the
// native <details> click-to-toggle fires inconsistently as a result. A single delegated
// listener on document sidesteps this: no matter which element the event actually lands
// on, it always bubbles up to document, so we always see it. This is a SortableJS
// quirk, not a framework one, so it's needed the same way regardless of Svelte.
let pendingToggle = null; // { details, x, y }
let wired = false;

export function wirePersonExpandToggle() {
  if (wired) return;
  wired = true;
  document.addEventListener('pointerdown', (e) => {
    const summary = e.target.closest('.person-card summary');
    if (!summary || e.target.closest('.icon-btn')) return;
    pendingToggle = { details: summary.parentElement, x: e.clientX, y: e.clientY };
  });
  document.addEventListener('pointerup', (e) => {
    if (!pendingToggle) return;
    const { details, x, y } = pendingToggle;
    pendingToggle = null;
    if (Math.hypot(e.clientX - x, e.clientY - y) < 5) details.open = !details.open;
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('.person-card summary') && !e.target.closest('.icon-btn')) e.preventDefault();
  });
}
