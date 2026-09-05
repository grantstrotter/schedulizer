import { writable, get } from 'svelte/store';
import { DAYS, DAY_LABELS } from '../lib/constants.js';
import { uid, csvEscape, parseCSVLine, parseAvailability, formatPhone, downloadBlob } from '../lib/util.js';
import { showToast } from '../lib/toast.js';
import { createUndoManager } from '../lib/undoable.js';

const AUTOSAVE_KEY = 'schedulizer_schedule_v1';
const SCHEMA_VERSION = 1; // bumped whenever the exported project JSON's shape changes

export const project = writable(null);
export const started = writable(false);

function persist() {
  const p = get(project);
  if (p) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(p));
}

// mutate() funnels every state-changing action through one place — see undoable.js for
// why that's what makes undo/redo cheap to add here.
const undoManager = createUndoManager(project, persist);
const mutate = undoManager.mutate;
export const canUndo = undoManager.canUndo;
export const canRedo = undoManager.canRedo;
export const undo = undoManager.undo;
export const redo = undoManager.redo;

function blankProject() {
  const days = {};
  DAYS.forEach(d => { days[d] = { groupIds: [], personIds: [] }; });
  return { days, groups: [], leaders: [] };
}

function normalizePerson(isLeader) {
  return (person) => ({
    id: person.id || uid(),
    first: person.first || '',
    last: person.last || '',
    phone: person.phone || '',
    email: person.email || '',
    isLeader: person.isLeader !== undefined ? !!person.isLeader : isLeader,
    availability: Array.isArray(person.availability) ? person.availability.filter(d => DAYS.includes(d)) : [],
    preferences: Array.isArray(person.preferences) ? person.preferences.filter(id => typeof id === 'string') : []
  });
}

export function findPerson(p, id) {
  return p.leaders.find(x => x.id === id);
}

export function findGroup(p, id) {
  return p.groups.find(g => g.id === id);
}

export function findGroupDay(p, groupId) {
  for (const d of DAYS) {
    if (p.days[d].groupIds.includes(groupId)) return d;
  }
  return null;
}

// The day a leader is currently scheduled on — directly on a day, or via whatever group
// they're nested under — or null if unplaced (in the drawer, or nested in a group that's
// itself still in the drawer).
export function findPersonDay(p, personId) {
  for (const d of DAYS) {
    if (p.days[d].personIds.includes(personId)) return d;
  }
  const group = p.groups.find(g => g.personIds.includes(personId));
  return group ? findGroupDay(p, group.id) : null;
}

export function isPersonPlaced(p, id) {
  for (const d of DAYS) {
    if (p.days[d].personIds.includes(id)) return true;
  }
  return p.groups.some(g => g.personIds.includes(id));
}

export function isGroupPlaced(p, id) {
  return findGroupDay(p, id) !== null;
}

export function removePersonFromAllPlacements(p, id) {
  DAYS.forEach(d => {
    p.days[d].personIds = p.days[d].personIds.filter(x => x !== id);
  });
  p.groups.forEach(g => {
    g.personIds = g.personIds.filter(x => x !== id);
  });
}

export function removeGroupFromAllPlacements(p, id) {
  DAYS.forEach(d => {
    p.days[d].groupIds = p.days[d].groupIds.filter(x => x !== id);
  });
}

export function newProject(confirmFirst) {
  if (confirmFirst && get(project) && !confirm('Start a new project? This replaces the current one (still saved in local autosave until you start/open another).')) return;
  project.set(blankProject());
  persist();
  undoManager.reset();
  started.set(true);
}

export function loadProjectFromObject(obj) {
  const p = blankProject();
  if (obj && typeof obj === 'object') {
    if (obj.days) DAYS.forEach(d => {
      if (obj.days[d]) {
        p.days[d].groupIds = obj.days[d].groupIds || [];
        p.days[d].personIds = obj.days[d].personIds || [];
      }
    });
    if (Array.isArray(obj.groups)) p.groups = obj.groups.map(g => ({
      id: g.id || uid(), name: g.name || 'Group', personIds: g.personIds || [],
      minimumRequired: typeof g.minimumRequired === 'number' ? g.minimumRequired : 10
    }));
    if (Array.isArray(obj.leaders)) p.leaders = obj.leaders.map(normalizePerson(true));
  }
  project.set(p);
  persist();
  undoManager.reset();
  started.set(true);
}

export function tryResumeAutosave() {
  const autosaved = localStorage.getItem(AUTOSAVE_KEY);
  if (!autosaved) return;
  try {
    loadProjectFromObject(JSON.parse(autosaved));
  } catch (e) {
    showToast('Autosave was corrupted — starting fresh.');
  }
}

export function deleteGroup(groupId, groupName) {
  if (!confirm(`Delete group "${groupName}"? People inside will return to their drawer.`)) return;
  mutate(p => {
    removeGroupFromAllPlacements(p, groupId);
    p.groups = p.groups.filter(g => g.id !== groupId);
  });
}

export function deletePerson(personId, fullName) {
  if (!confirm(`Delete ${fullName}?`)) return;
  mutate(p => {
    removePersonFromAllPlacements(p, personId);
    p.leaders = p.leaders.filter(x => x.id !== personId);
  });
}

export function addGroup() {
  const id = uid();
  mutate(p => { p.groups.push({ id, name: 'New Group', personIds: [], minimumRequired: 10 }); });
  return id;
}

export function addLeader() {
  const id = uid();
  mutate(p => { p.leaders.push({ id, first: '', last: '', phone: '', email: '', isLeader: true, availability: [], preferences: [] }); });
  return id;
}

export function renameGroup(groupId, name) {
  mutate(p => { findGroup(p, groupId).name = name; }, `renameGroup:${groupId}`);
}

export function updatePersonField(personId, field, value) {
  mutate(p => { findPerson(p, personId)[field] = value; }, `personField:${personId}:${field}`);
}

export function togglePersonAvailability(personId, day) {
  mutate(p => {
    const person = findPerson(p, personId);
    if (person.availability.includes(day)) {
      person.availability = person.availability.filter(x => x !== day);
    } else {
      person.availability = [...person.availability, day];
    }
  });
}

// Called when a day's groups-list dnd-zone finalizes a drop it has accepted — groupIds is
// that day's full, final list in display order. Anyone arriving from elsewhere (another
// day, the drawer) is pulled out of their old placement first.
export function setDayGroups(day, groupIds) {
  mutate(p => {
    groupIds.forEach(id => removeGroupFromAllPlacements(p, id));
    p.days[day].groupIds = groupIds;
  });
}

// Same idea for a day's own people-list (leaders scheduled directly on that day, not
// nested under a group).
export function setDayPeople(day, personIds) {
  mutate(p => {
    personIds.forEach(id => removePersonFromAllPlacements(p, id));
    p.days[day].personIds = personIds;
  });
}

// A group's nested people-list (leaders placed under that specific group).
export function setGroupPeople(groupId, personIds) {
  mutate(p => {
    personIds.forEach(id => removePersonFromAllPlacements(p, id));
    findGroup(p, groupId).personIds = personIds;
  });
}

// The two drawers hold whatever's left unplaced — dropping into one just needs to clear
// wherever the arriving item used to be; "unplaced" itself is derived, not stored.
export function setDrawerGroups(groupIds) {
  mutate(p => { groupIds.forEach(id => removeGroupFromAllPlacements(p, id)); });
}

export function setDrawerLeaders(personIds) {
  mutate(p => { personIds.forEach(id => removePersonFromAllPlacements(p, id)); });
}

export function exportJSON() {
  const p = get(project);
  const data = { version: SCHEMA_VERSION, ...p };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'schedulizer-project.json');
}

export function exportCSV() {
  const p = get(project);
  const rows = [['day', 'group', 'first', 'last', 'phone', 'email']];
  DAYS.forEach(day => {
    p.days[day].groupIds.forEach(gid => {
      const g = findGroup(p, gid);
      if (!g) return;
      g.personIds.forEach(pid => {
        const person = findPerson(p, pid);
        if (person) rows.push([DAY_LABELS[day], g.name, person.first, person.last, formatPhone(person.phone), person.email]);
      });
    });
    p.days[day].personIds.forEach(pid => {
      const person = findPerson(p, pid);
      if (person) rows.push([DAY_LABELS[day], '', person.first, person.last, formatPhone(person.phone), person.email]);
    });
  });
  p.leaders.filter(person => !isPersonPlaced(p, person.id)).forEach(person => {
    rows.push(['(unassigned)', '', person.first, person.last, formatPhone(person.phone), person.email]);
  });
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, 'schedulizer-export.csv');
}

export function importJSONFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      loadProjectFromObject(obj);
    } catch (e) {
      showToast('Could not parse that JSON file.');
    }
  };
  reader.readAsText(file);
}

export function importCSVFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const lines = reader.result.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return;
    let imported = 0;
    let skipped = 0;
    mutate(p => {
      lines.slice(1).forEach(line => {
        const [first, last, phone, email, isLeaderRaw, availabilityRaw] = parseCSVLine(line);
        const isLeader = ['true', '1', 'yes', 'y'].includes((isLeaderRaw || '').toLowerCase());
        if (!isLeader) { skipped++; return; }
        const availability = parseAvailability(availabilityRaw);
        const person = { id: uid(), first: first || '', last: last || '', phone: phone || '', email: email || '', isLeader: true, availability, preferences: [] };
        p.leaders.push(person);
        imported++;
      });
    });
    showToast(`Imported ${imported} leader${imported === 1 ? '' : 's'}.${skipped ? ` Skipped ${skipped} non-leader row${skipped === 1 ? '' : 's'} — Schedule only tracks leaders now.` : ''}`);
  };
  reader.readAsText(file);
}
