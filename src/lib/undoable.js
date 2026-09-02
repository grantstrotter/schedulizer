import { writable, get } from 'svelte/store';

// Caps undoStack directly; redoStack is bounded by it too, since it can never hold more
// than however many entries were just popped off undoStack. Generous but not unbounded —
// this app's data is small (a single church's group roster), so even a large project's
// snapshot runs well under a megabyte, and real memory pressure wouldn't start until tens
// of thousands of steps. This cap is nowhere near that; it's just a backstop against an
// absurdly long single session never being closed.
const HISTORY_LIMIT = 1000;

// Rapid edits to the *same* field (typing a name, a comment, etc.) collapse into one
// undo step instead of one per keystroke — a pause longer than this, or moving to a
// different field, starts a fresh step.
const COALESCE_WINDOW_MS = 800;

// A single cross-zone drag (e.g. moving a person out of a group and into a drawer)
// fires svelte-dnd-action's finalize on both zones, each calling a different store
// function back-to-back in the same tick — without this, that one drag would silently
// create two undo steps instead of one. Any mutation this close behind the previous one
// is treated as the same user gesture, regardless of what triggered it. Far shorter than
// COALESCE_WINDOW_MS so it can't accidentally merge two genuinely separate quick actions.
const SAME_GESTURE_WINDOW_MS = 150;

// Wraps a project store with whole-state undo/redo. Every mutation already goes
// through a single `mutate` chokepoint in each tool's store, so snapshotting full
// project state there (rather than recording+replaying individual actions) gives every
// mutating action undo support for free, side effects (like a comment's "addressed"
// flag resetting) included — no per-action inverse logic to write or maintain.
export function createUndoManager(project, persist) {
  let undoStack = [];
  let redoStack = [];
  let lastCoalesceKey = null;
  let lastMutateTime = 0;

  const canUndo = writable(false);
  const canRedo = writable(false);

  function syncFlags() {
    canUndo.set(undoStack.length > 0);
    canRedo.set(redoStack.length > 0);
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(get(project)));
  }

  function mutate(fn, coalesceKey = null) {
    const now = Date.now();
    const sameField = coalesceKey !== null && coalesceKey === lastCoalesceKey && (now - lastMutateTime) < COALESCE_WINDOW_MS;
    const sameGesture = (now - lastMutateTime) < SAME_GESTURE_WINDOW_MS;
    if (!sameField && !sameGesture) {
      undoStack.push(snapshot());
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
      redoStack = [];
    }
    lastCoalesceKey = coalesceKey;
    lastMutateTime = now;
    project.update(p => { fn(p); return p; });
    persist();
    syncFlags();
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack.pop();
    redoStack.push(snapshot());
    project.set(prev);
    persist();
    lastCoalesceKey = null; // next edit always starts its own fresh step
    lastMutateTime = 0;
    syncFlags();
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack.pop();
    undoStack.push(snapshot());
    project.set(next);
    persist();
    lastCoalesceKey = null;
    lastMutateTime = 0;
    syncFlags();
  }

  // Called when switching to a different document entirely (new project, opened file,
  // resumed autosave) — undo history shouldn't reach back into a document that's gone.
  function reset() {
    undoStack = [];
    redoStack = [];
    lastCoalesceKey = null;
    syncFlags();
  }

  return { mutate, undo, redo, reset, canUndo, canRedo };
}
