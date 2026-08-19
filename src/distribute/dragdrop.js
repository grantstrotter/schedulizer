import { get } from 'svelte/store';
import { DAY_LABELS } from '../lib/constants.js';
import { showDragBlockToast, clearDragBlockToast } from '../lib/toast.js';
import { project, findPerson, findGroup, syncModelFromDom } from './store.js';

// Simpler than the scheduling tool: there's no day grid, so every Sortable container
// here (the two drawers and each group's nested people-list) is already a valid target
// for any person — the only thing to check is availability against the group's day
// (if the group's name implied one), so no redirect/relocation logic is needed.

function checkPersonMoveAllowed(evt) {
  const p = get(project);
  const personId = evt.dragged.dataset.personId;
  const person = findPerson(p, personId);
  const groupCard = evt.to.closest('.group-card');
  const group = groupCard ? findGroup(p, groupCard.dataset.groupId) : null;

  if (!person || !group || !group.day) {
    clearDragBlockToast();
    return true;
  }

  const blocked = person.availability.length > 0 && !person.availability.includes(group.day);
  if (blocked) {
    showDragBlockToast(`person:${personId}:${group.id}`, `${person.first} ${person.last} is not marked available on ${DAY_LABELS[group.day]}.`);
    return false;
  }

  clearDragBlockToast();
  return true;
}

function readBoardIntoModel(p) {
  p.groups.forEach(g => {
    const listEl = document.querySelector(`.group-card[data-group-id="${g.id}"] > .people-list`);
    if (listEl) g.personIds = Array.from(listEl.querySelectorAll(':scope > .person-card')).map(n => n.dataset.personId);
  });

  const leaderIds = Array.from(document.querySelectorAll('#drawer-leaders > .person-card')).map(n => n.dataset.personId);
  const participantIds = Array.from(document.querySelectorAll('#drawer-participants > .person-card')).map(n => n.dataset.personId);

  const allPeople = p.leaders.concat(p.participants);
  leaderIds.forEach(id => { const person = allPeople.find(x => x.id === id); if (person) person.isLeader = true; });
  participantIds.forEach(id => { const person = allPeople.find(x => x.id === id); if (person) person.isLeader = false; });

  p.leaders = allPeople.filter(x => x.isLeader);
  p.participants = allPeople.filter(x => !x.isLeader);
}

export let dragOrigin = null; // { item, parent, nextSibling } captured at drag start, for Escape-to-cancel

function recordDragOrigin(evt) {
  dragOrigin = { item: evt.item, parent: evt.from, nextSibling: evt.item.nextElementSibling };
}

export function cancelActiveDrag() {
  if (!dragOrigin) return;
  const { item, parent, nextSibling } = dragOrigin;
  if (nextSibling && nextSibling.parentElement === parent) {
    parent.insertBefore(item, nextSibling);
  } else {
    parent.appendChild(item);
  }
  dragOrigin = null;
  clearDragBlockToast();
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse' }));
}

function handleDragEnd() {
  const origin = dragOrigin;
  dragOrigin = null;
  clearDragBlockToast();
  const unchanged = origin
    && origin.item.parentElement === origin.parent
    && origin.item.nextElementSibling === origin.nextSibling;
  if (unchanged) return;
  syncModelFromDom(readBoardIntoModel);
}

// Person-moving containers (the two drawers, each group's people-list) share one
// Sortable group so a person can move between any of them directly.
export function personSortableOptions() {
  return {
    group: 'distribute-board',
    handle: 'summary',
    filter: '.icon-btn, input',
    preventOnFilter: false,
    animation: 150,
    forceFallback: true,
    onStart: recordDragOrigin,
    onMove: checkPersonMoveAllowed,
    onEnd: handleDragEnd
  };
}

// Group cards themselves are reorderable directly on the board — a separate,
// single-container drag independent of the person-moving Sortables above. Board order
// has no auto-sort layered on it, so this is the only way order changes once the
// CSV-import mapping has set it initially.
export function groupBoardSortableOptions(onReorder) {
  return {
    handle: '.card-row',
    filter: '.icon-btn, input',
    preventOnFilter: false,
    animation: 150,
    forceFallback: true,
    onEnd: (evt) => {
      const orderedIds = Array.from(evt.to.querySelectorAll(':scope > .board-group-card')).map(n => n.dataset.groupId);
      onReorder(orderedIds);
    }
  };
}
