import { writable } from 'svelte/store';

export const toast = writable({ message: '', visible: false });

let dismissTimer = null;
let dragBlockKey = null;

// Auto-dismisses after 3.2s. Used for one-off status messages (import results, etc.).
export function showToast(msg) {
  dragBlockKey = null;
  clearTimeout(dismissTimer);
  toast.set({ message: msg, visible: true });
  dismissTimer = setTimeout(() => toast.update(t => ({ ...t, visible: false })), 3200);
}

// Stays visible until explicitly cleared (not on a timer) — used while a drag hovers a
// blocked drop target, so the explanation doesn't flicker away mid-hover. Re-showing the
// same key while it's already up is a no-op, avoiding a re-flash.
export function showDragBlockToast(key, msg) {
  if (dragBlockKey === key) return;
  dragBlockKey = key;
  clearTimeout(dismissTimer);
  toast.set({ message: msg, visible: true });
}

export function clearDragBlockToast() {
  if (dragBlockKey === null) return;
  dragBlockKey = null;
  toast.update(t => ({ ...t, visible: false }));
}
