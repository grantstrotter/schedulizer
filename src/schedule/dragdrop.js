import { get } from 'svelte/store';
import { DAYS, DAY_LABELS } from '../lib/constants.js';
import { showDragBlockToast, clearDragBlockToast } from '../lib/toast.js';
import { project, findPerson, findGroup, syncModelFromDom } from './store.js';

// Groups and people share one Sortable group ('board') so either can be dropped
// anywhere on a day column, not just its own sub-section. Each check function below
// decides availability first, then — if the hover isn't already over that item's proper
// zone — relocates the live preview there itself and returns false, which tells Sortable
// "I've placed it, don't also insert it where you were about to." normalizeBoardAdd
// applies the same relocation as a post-drop safety net.

function isPeopleZone(container) {
  return container.dataset.container === 'day-people' || container.dataset.container === 'group-people';
}

function relocateIfNeeded(node, targetList) {
  if (targetList && node.parentElement !== targetList) targetList.appendChild(node);
}

function checkPersonMoveAllowed(evt) {
  if (evt.to.dataset.container === 'day-groups' || evt.to.id === 'drawer-groups') {
    return false;
  }

  const p = get(project);
  const personId = evt.dragged.dataset.personId;
  const person = findPerson(p, personId);

  const dayColumn = evt.to.closest('.day-column');
  const targetDay = dayColumn ? dayColumn.dataset.day : null;

  if (!person || !targetDay) {
    clearDragBlockToast();
    return true;
  }

  const blocked = person.availability.length > 0 && !person.availability.includes(targetDay);
  if (blocked) {
    showDragBlockToast(`person:${personId}:${targetDay}`, `${person.first} ${person.last} is not marked available on ${DAY_LABELS[targetDay]}.`);
    return false;
  }

  clearDragBlockToast();
  return true;
}

function checkGroupMoveAllowed(evt) {
  const p = get(project);
  const groupId = evt.dragged.dataset.groupId;
  const group = findGroup(p, groupId);

  const dayColumn = evt.to.closest('.day-column');
  const targetDay = dayColumn ? dayColumn.dataset.day : null;

  if (!group || !targetDay) {
    clearDragBlockToast();
    if (evt.to.dataset.container === 'group-people') {
      relocateIfNeeded(evt.dragged, document.getElementById('drawer-groups'));
      return false;
    }
    return true;
  }

  const unavailableLeaders = group.personIds
    .map(id => findPerson(p, id))
    .filter(person => person && person.isLeader && person.availability.length > 0 && !person.availability.includes(targetDay));

  if (unavailableLeaders.length > 0) {
    const names = unavailableLeaders.map(person => `${person.first} ${person.last}`.trim()).join(', ');
    showDragBlockToast(`group:${groupId}:${targetDay}`, `${names} ${unavailableLeaders.length === 1 ? 'is' : 'are'} not marked available on ${DAY_LABELS[targetDay]}.`);
    return false;
  }

  clearDragBlockToast();

  const groupsList = dayColumn.querySelector(':scope > .groups-list');
  if (evt.to !== groupsList) {
    relocateIfNeeded(evt.dragged, groupsList);
    return false;
  }

  return true;
}

function checkBoardMoveAllowed(evt) {
  return evt.dragged.dataset.type === 'group' ? checkGroupMoveAllowed(evt) : checkPersonMoveAllowed(evt);
}

function normalizeBoardAdd(evt) {
  const item = evt.item;
  const dayColumn = evt.to.closest('.day-column');

  if (item.dataset.type === 'group') {
    relocateIfNeeded(item, dayColumn ? dayColumn.querySelector(':scope > .groups-list') : document.getElementById('drawer-groups'));
    return;
  }

  if (dayColumn && !isPeopleZone(evt.to)) {
    relocateIfNeeded(item, dayColumn.querySelector(':scope > .people-list'));
  }
}

function readBoardIntoModel(p) {
  DAYS.forEach(day => {
    const col = document.querySelector(`.day-column[data-day="${day}"]`);
    p.days[day].groupIds = Array.from(col.querySelectorAll(':scope > .groups-list > .group-card')).map(n => n.dataset.groupId);
    p.days[day].personIds = Array.from(col.querySelectorAll(':scope > .people-list > .person-card')).map(n => n.dataset.personId);
  });
  p.groups.forEach(g => {
    const listEl = document.querySelector(`.group-card[data-group-id="${g.id}"] > .people-list`);
    if (listEl) g.personIds = Array.from(listEl.querySelectorAll(':scope > .person-card')).map(n => n.dataset.personId);
  });
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
  // Since a person's whole summary (and a group's whole title row) is the drag handle,
  // Sortable brackets *every* click with onStart/onEnd, not just real drags — skip the
  // sync/re-render if nothing actually moved, so a plain click's incidental jitter can't
  // wipe out UI-only state like a just-toggled expand/collapse.
  const unchanged = origin
    && origin.item.parentElement === origin.parent
    && origin.item.nextElementSibling === origin.nextSibling;
  if (unchanged) return;
  syncModelFromDom(readBoardIntoModel);
}

export function boardSortableOptions(isGroupsContainer) {
  return {
    group: 'board',
    handle: isGroupsContainer ? '.card-row' : 'summary',
    filter: '.icon-btn, input',
    preventOnFilter: false,
    animation: 150,
    forceFallback: true,
    onStart: recordDragOrigin,
    onMove: checkBoardMoveAllowed,
    onAdd: normalizeBoardAdd,
    onEnd: handleDragEnd
  };
}
