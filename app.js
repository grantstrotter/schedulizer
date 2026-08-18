const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };
const DAY_ABBR = { sunday: 'Sun', monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat' };
const AUTOSAVE_KEY = 'schedulizer_project_v1';

let project = null;
let sortables = [];

function uid() {
  return crypto.randomUUID();
}

function blankProject() {
  const days = {};
  DAYS.forEach(d => { days[d] = { groupIds: [], personIds: [] }; });
  return { days, groups: [], leaders: [], participants: [] };
}

function getAllPeople() {
  return project.leaders.concat(project.participants);
}

function findPerson(id) {
  return getAllPeople().find(p => p.id === id);
}

function findGroup(id) {
  return project.groups.find(g => g.id === id);
}

function findGroupDay(groupId) {
  for (const d of DAYS) {
    if (project.days[d].groupIds.includes(groupId)) return d;
  }
  return null;
}

function isPersonPlaced(id) {
  for (const d of DAYS) {
    if (project.days[d].personIds.includes(id)) return true;
  }
  return project.groups.some(g => g.personIds.includes(id));
}

function isGroupPlaced(id) {
  return findGroupDay(id) !== null;
}

function removePersonFromAllPlacements(id) {
  DAYS.forEach(d => {
    project.days[d].personIds = project.days[d].personIds.filter(x => x !== id);
  });
  project.groups.forEach(g => {
    g.personIds = g.personIds.filter(x => x !== id);
  });
}

function removeGroupFromAllPlacements(id) {
  DAYS.forEach(d => {
    project.days[d].groupIds = project.days[d].groupIds.filter(x => x !== id);
  });
}

function persist() {
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('visible'), 3200);
}

let dragBlockKey = null;

function showDragBlockToast(key, msg) {
  if (dragBlockKey === key) return; // already showing this exact block, avoid re-flashing it
  dragBlockKey = key;
  clearTimeout(showToast._t); // a drag-block toast stays until explicitly cleared, not on a timer
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
}

function clearDragBlockToast() {
  if (dragBlockKey === null) return;
  dragBlockKey = null;
  document.getElementById('toast').classList.remove('visible');
}

// ---------- Bootstrapping ----------

function startApp() {
  document.getElementById('empty-state').hidden = true;
  document.getElementById('app').hidden = false;
  render();
}

function newProject(confirmFirst) {
  if (confirmFirst && project && !confirm('Start a new project? This replaces the current one (still saved in local autosave until you start/open another).')) return;
  project = blankProject();
  persist();
  startApp();
}

function loadProjectFromObject(obj) {
  const p = blankProject();
  if (obj && typeof obj === 'object') {
    if (obj.days) DAYS.forEach(d => {
      if (obj.days[d]) {
        p.days[d].groupIds = obj.days[d].groupIds || [];
        p.days[d].personIds = obj.days[d].personIds || [];
      }
    });
    if (Array.isArray(obj.groups)) p.groups = obj.groups.map(g => ({
      id: g.id || uid(), name: g.name || 'Group', personIds: g.personIds || []
    }));
    if (Array.isArray(obj.leaders)) p.leaders = obj.leaders.map(normalizePerson(true));
    if (Array.isArray(obj.participants)) p.participants = obj.participants.map(normalizePerson(false));
  }
  project = p;
  persist();
  startApp();
}

function normalizePerson(isLeader) {
  return (person) => ({
    id: person.id || uid(),
    first: person.first || '',
    last: person.last || '',
    phone: person.phone || '',
    email: person.email || '',
    isLeader: person.isLeader !== undefined ? !!person.isLeader : isLeader,
    availability: Array.isArray(person.availability) ? person.availability.filter(d => DAYS.includes(d)) : []
  });
}

// ---------- Rendering ----------

function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text) node.textContent = opts.text;
  if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (opts.html) node.innerHTML = opts.html;
  return node;
}

function render() {
  sortables.forEach(s => s.destroy());
  sortables = [];

  renderDaysRow();
  renderDrawers();
  attachSortables();
  persist();
}

function renderDaysRow() {
  const row = document.getElementById('days-row');
  row.innerHTML = '';
  DAYS.forEach(day => {
    const col = el('div', { class: 'day-column', attrs: { 'data-day': day } });
    col.appendChild(el('h2', { text: DAY_LABELS[day] }));
    col.appendChild(el('div', { class: 'zone-label', text: 'Groups' }));
    const groupsList = el('div', { class: 'groups-list', attrs: { 'data-container': 'day-groups', 'data-day': day } });
    project.days[day].groupIds.forEach(gid => {
      const g = findGroup(gid);
      if (g) groupsList.appendChild(renderGroupCard(g));
    });
    col.appendChild(groupsList);

    col.appendChild(el('div', { class: 'zone-label', text: 'People' }));
    const peopleList = el('div', { class: 'people-list', attrs: { 'data-container': 'day-people', 'data-day': day } });
    project.days[day].personIds.forEach(pid => {
      const p = findPerson(pid);
      if (p) peopleList.appendChild(renderPersonCard(p));
    });
    col.appendChild(peopleList);

    row.appendChild(col);
  });
}

function renderDrawers() {
  const groupsDrawer = document.getElementById('drawer-groups');
  groupsDrawer.innerHTML = '';
  const unplacedGroups = project.groups.filter(g => !isGroupPlaced(g.id));
  unplacedGroups.forEach(g => groupsDrawer.appendChild(renderGroupCard(g)));
  document.getElementById('count-groups').textContent = `(${unplacedGroups.length})`;

  const leadersDrawer = document.getElementById('drawer-leaders');
  leadersDrawer.innerHTML = '';
  const unplacedLeaders = project.leaders.filter(p => !isPersonPlaced(p.id));
  unplacedLeaders.forEach(p => leadersDrawer.appendChild(renderPersonCard(p)));
  document.getElementById('count-leaders').textContent = `(${unplacedLeaders.length})`;

  const participantsDrawer = document.getElementById('drawer-participants');
  participantsDrawer.innerHTML = '';
  const unplacedParticipants = project.participants.filter(p => !isPersonPlaced(p.id));
  unplacedParticipants.forEach(p => participantsDrawer.appendChild(renderPersonCard(p)));
  document.getElementById('count-participants').textContent = `(${unplacedParticipants.length})`;
}

function renderGroupCard(group) {
  const card = el('div', { class: 'group-card', attrs: { 'data-group-id': group.id, 'data-type': 'group' } });

  const row = el('div', { class: 'card-row' });
  row.appendChild(el('span', { class: 'drag-handle', text: '⠿' }));

  const nameInput = el('input', { class: 'inline-input group-name', attrs: { type: 'text', value: group.name } });
  nameInput.value = group.name;
  nameInput.addEventListener('input', () => { group.name = nameInput.value; persist(); });
  row.appendChild(nameInput);

  const delBtn = el('button', { class: 'icon-btn', text: '✕', attrs: { title: 'Delete group' } });
  delBtn.addEventListener('click', () => {
    if (!confirm(`Delete group "${group.name}"? People inside will return to their drawer.`)) return;
    removeGroupFromAllPlacements(group.id);
    project.groups = project.groups.filter(g => g.id !== group.id);
    render();
  });
  row.appendChild(delBtn);
  card.appendChild(row);

  const peopleList = el('div', { class: 'people-list', attrs: { 'data-container': 'group-people', 'data-group-id': group.id } });
  group.personIds.forEach(pid => {
    const p = findPerson(pid);
    if (p) peopleList.appendChild(renderPersonCard(p));
  });
  card.appendChild(peopleList);

  return card;
}

function renderPersonCard(person) {
  const details = el('details', { class: 'person-card', attrs: { 'data-person-id': person.id, 'data-type': 'person' } });

  const summary = el('summary');
  const handle = el('span', { class: 'drag-handle', text: '⠿ ' });
  summary.appendChild(handle);
  const nameSpan = el('span', { class: 'person-name', text: `${person.first} ${person.last}`.trim() || '(unnamed)' });
  summary.appendChild(nameSpan);
  if (person.isLeader) summary.appendChild(el('span', { class: 'leader-badge', text: 'LEADER' }));
  const delBtn = el('button', { class: 'icon-btn', text: '✕', attrs: { title: 'Delete person' } });
  delBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!confirm(`Delete ${person.first} ${person.last}`.trim() + '?')) return;
    removePersonFromAllPlacements(person.id);
    project.leaders = project.leaders.filter(p => p.id !== person.id);
    project.participants = project.participants.filter(p => p.id !== person.id);
    render();
  });
  summary.appendChild(delBtn);
  details.appendChild(summary);

  const detail = el('div', { class: 'person-detail' });

  const nameRow = el('div', { class: 'card-row' });
  const firstInput = el('input', { class: 'inline-input person-field', attrs: { type: 'text', placeholder: 'First name' } });
  firstInput.value = person.first;
  firstInput.addEventListener('input', () => {
    person.first = firstInput.value;
    nameSpan.textContent = `${person.first} ${person.last}`.trim() || '(unnamed)';
    persist();
  });
  const lastInput = el('input', { class: 'inline-input person-field', attrs: { type: 'text', placeholder: 'Last name' } });
  lastInput.value = person.last;
  lastInput.addEventListener('input', () => {
    person.last = lastInput.value;
    nameSpan.textContent = `${person.first} ${person.last}`.trim() || '(unnamed)';
    persist();
  });
  nameRow.appendChild(firstInput);
  nameRow.appendChild(lastInput);
  detail.appendChild(nameRow);

  const phoneInput = el('input', { class: 'inline-input person-field', attrs: { type: 'text', placeholder: 'Phone' } });
  phoneInput.value = person.phone;
  phoneInput.addEventListener('input', () => { person.phone = phoneInput.value; persist(); });
  detail.appendChild(phoneInput);

  const emailInput = el('input', { class: 'inline-input person-field', attrs: { type: 'text', placeholder: 'Email' } });
  emailInput.value = person.email;
  emailInput.addEventListener('input', () => { person.email = emailInput.value; persist(); });
  detail.appendChild(emailInput);

  const availLabel = el('div', { class: 'contact-line', text: 'Available:' });
  detail.appendChild(availLabel);
  const grid = el('div', { class: 'availability-grid' });
  DAYS.forEach(d => {
    const label = el('label');
    const cb = el('input', { attrs: { type: 'checkbox' } });
    cb.checked = person.availability.includes(d);
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!person.availability.includes(d)) person.availability.push(d);
      } else {
        person.availability = person.availability.filter(x => x !== d);
      }
      persist();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(DAY_ABBR[d]));
    grid.appendChild(label);
  });
  detail.appendChild(grid);

  details.appendChild(detail);
  return details;
}

// ---------- Drag and drop ----------
//
// Groups and people share one Sortable group ('board', set up in attachSortables) so
// either can be dropped anywhere on a day column, not just its own sub-section. Each
// check function below decides availability first, then — if the hover isn't already
// over that item's proper zone — relocates the live preview there itself and returns
// false, which tells Sortable "I've placed it, don't also insert it where you were
// about to." normalizeBoardAdd applies the same relocation as a post-drop safety net.

function isPeopleZone(container) {
  return container.dataset.container === 'day-people' || container.dataset.container === 'group-people';
}

function relocateIfNeeded(node, targetList) {
  if (targetList && node.parentElement !== targetList) targetList.appendChild(node);
}

function checkPersonMoveAllowed(evt) {
  const personId = evt.dragged.dataset.personId;
  const person = findPerson(personId);

  const dayColumn = evt.to.closest('.day-column');
  const targetDay = dayColumn ? dayColumn.dataset.day : null;

  // drawer drops, or drops into an unplaced group, carry no day and are always allowed
  if (!person || !targetDay) {
    clearDragBlockToast();
    return true;
  }

  const blocked = person.availability.length > 0 && !person.availability.includes(targetDay);
  if (blocked) {
    showDragBlockToast(`person:${personId}:${targetDay}`, `${person.first} ${person.last} is not marked available on ${DAY_LABELS[targetDay]}.`);
    return false; // blocked: leave the card wherever it currently is, don't relocate it
  }

  clearDragBlockToast();

  // A drop directly into a group's own nested People list is a valid zone as-is.
  if (!isPeopleZone(evt.to)) {
    relocateIfNeeded(evt.dragged, dayColumn.querySelector(':scope > .people-list'));
    return false;
  }

  return true;
}

function checkGroupMoveAllowed(evt) {
  const groupId = evt.dragged.dataset.groupId;
  const group = findGroup(groupId);

  const dayColumn = evt.to.closest('.day-column');
  const targetDay = dayColumn ? dayColumn.dataset.day : null;

  // drops back into the groups drawer carry no day and are always allowed
  if (!group || !targetDay) {
    clearDragBlockToast();
    return true;
  }

  const unavailableLeaders = group.personIds
    .map(findPerson)
    .filter(p => p && p.isLeader && p.availability.length > 0 && !p.availability.includes(targetDay));

  if (unavailableLeaders.length > 0) {
    const names = unavailableLeaders.map(p => `${p.first} ${p.last}`.trim()).join(', ');
    showDragBlockToast(`group:${groupId}:${targetDay}`, `${names} ${unavailableLeaders.length === 1 ? 'is' : 'are'} not marked available on ${DAY_LABELS[targetDay]}.`);
    return false; // blocked: leave the card wherever it currently is, don't relocate it
  }

  clearDragBlockToast();

  const groupsList = dayColumn.querySelector(':scope > .groups-list');
  if (evt.to !== groupsList) {
    relocateIfNeeded(evt.dragged, groupsList);
    return false;
  }

  return true;
}

function syncModelFromDom() {
  DAYS.forEach(day => {
    const col = document.querySelector(`.day-column[data-day="${day}"]`);
    project.days[day].groupIds = Array.from(col.querySelectorAll(':scope > .groups-list > .group-card')).map(n => n.dataset.groupId);
    project.days[day].personIds = Array.from(col.querySelectorAll(':scope > .people-list > .person-card')).map(n => n.dataset.personId);
  });

  project.groups.forEach(g => {
    const listEl = document.querySelector(`.group-card[data-group-id="${g.id}"] > .people-list`);
    if (listEl) g.personIds = Array.from(listEl.querySelectorAll(':scope > .person-card')).map(n => n.dataset.personId);
  });

  const leaderIds = Array.from(document.querySelectorAll('#drawer-leaders > .person-card')).map(n => n.dataset.personId);
  const participantIds = Array.from(document.querySelectorAll('#drawer-participants > .person-card')).map(n => n.dataset.personId);

  const allPeople = getAllPeople();
  leaderIds.forEach(id => {
    const p = allPeople.find(x => x.id === id);
    if (p) p.isLeader = true;
  });
  participantIds.forEach(id => {
    const p = allPeople.find(x => x.id === id);
    if (p) p.isLeader = false;
  });

  project.leaders = allPeople.filter(p => p.isLeader);
  project.participants = allPeople.filter(p => !p.isLeader);
}

function handleDragEnd() {
  clearDragBlockToast();
  syncModelFromDom();
  render();
}

function normalizeBoardAdd(evt) {
  const item = evt.item;
  const dayColumn = evt.to.closest('.day-column');

  if (item.dataset.type === 'group') {
    relocateIfNeeded(item, dayColumn ? dayColumn.querySelector(':scope > .groups-list') : document.getElementById('drawer-groups'));
    return;
  }

  // person: only relocate if it landed within a day but outside any valid People zone
  if (dayColumn && !isPeopleZone(evt.to)) {
    relocateIfNeeded(item, dayColumn.querySelector(':scope > .people-list'));
  }
}

function checkBoardMoveAllowed(evt) {
  return evt.dragged.dataset.type === 'group' ? checkGroupMoveAllowed(evt) : checkPersonMoveAllowed(evt);
}

function attachSortables() {
  // Groups and people share one Sortable group so a dragged group is accepted anywhere
  // on a day column (not just its Groups sub-section) — normalizeBoardAdd relocates it
  // into the right list afterward, and checkBoardMoveAllowed still enforces availability.
  const containers = [
    document.getElementById('drawer-groups'),
    document.getElementById('drawer-leaders'),
    document.getElementById('drawer-participants'),
    ...Array.from(document.querySelectorAll('.groups-list')),
    ...Array.from(document.querySelectorAll('.people-list'))
  ];
  containers.forEach(container => {
    sortables.push(Sortable.create(container, {
      group: 'board',
      handle: '.drag-handle',
      animation: 150,
      forceFallback: true,
      onMove: checkBoardMoveAllowed,
      onAdd: normalizeBoardAdd,
      onEnd: handleDragEnd
    }));
  });
}

// ---------- CSV / JSON import-export ----------

function exportJSON() {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'schedulizer-project.json');
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCSV() {
  const rows = [['day', 'group', 'first', 'last', 'phone', 'email', 'isLeader']];
  DAYS.forEach(day => {
    project.days[day].groupIds.forEach(gid => {
      const g = findGroup(gid);
      if (!g) return;
      g.personIds.forEach(pid => {
        const p = findPerson(pid);
        if (p) rows.push([DAY_LABELS[day], g.name, p.first, p.last, p.phone, p.email, p.isLeader]);
      });
    });
    project.days[day].personIds.forEach(pid => {
      const p = findPerson(pid);
      if (p) rows.push([DAY_LABELS[day], '', p.first, p.last, p.phone, p.email, p.isLeader]);
    });
  });
  getAllPeople().filter(p => !isPersonPlaced(p.id)).forEach(p => {
    rows.push(['(unassigned)', '', p.first, p.last, p.phone, p.email, p.isLeader]);
  });
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, 'schedulizer-export.csv');
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

function importJSONFile(file) {
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

function parseCSVLine(line) {
  // simple comma split; does not handle quoted commas
  return line.split(',').map(s => s.trim());
}

function importCSVFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const lines = reader.result.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) return;
    lines.slice(1).forEach(line => {
      const [first, last, phone, email, isLeaderRaw] = parseCSVLine(line);
      const isLeader = ['true', '1', 'yes', 'y'].includes((isLeaderRaw || '').toLowerCase());
      const person = { id: uid(), first: first || '', last: last || '', phone: phone || '', email: email || '', isLeader, availability: [] };
      if (isLeader) project.leaders.push(person);
      else project.participants.push(person);
    });
    render();
  };
  reader.readAsText(file);
}

// ---------- Wiring ----------

function wireEmptyState() {
  const dropzone = document.getElementById('dropzone');
  document.getElementById('btn-new-empty').addEventListener('click', () => newProject(false));
  document.getElementById('btn-open-empty').addEventListener('click', () => document.getElementById('file-open-json').click());
  document.getElementById('file-open-json').addEventListener('change', e => {
    if (e.target.files[0]) importJSONFile(e.target.files[0]);
    e.target.value = '';
  });

  const resumeBtn = document.getElementById('btn-resume-empty');
  const saved = localStorage.getItem(AUTOSAVE_KEY);
  if (saved) {
    resumeBtn.hidden = false;
    resumeBtn.addEventListener('click', () => {
      try { loadProjectFromObject(JSON.parse(saved)); } catch (e) { showToast('Autosave was corrupted.'); }
    });
  }

  ['dragover', 'dragenter'].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  }));
  ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
  }));
  dropzone.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (file) importJSONFile(file);
  });
}

function wireToolbar() {
  document.getElementById('btn-new').addEventListener('click', () => newProject(true));
  document.getElementById('btn-open').addEventListener('click', () => document.getElementById('file-open-json-2').click());
  document.getElementById('file-open-json-2').addEventListener('change', e => {
    if (e.target.files[0]) {
      if (confirm('Open this file? It will replace the current project.')) importJSONFile(e.target.files[0]);
    }
    e.target.value = '';
  });

  document.getElementById('btn-add-group').addEventListener('click', (e) => {
    e.preventDefault();
    project.groups.push({ id: uid(), name: 'New Group', personIds: [] });
    render();
  });

  document.getElementById('btn-add-leader').addEventListener('click', (e) => {
    e.preventDefault();
    project.leaders.push({ id: uid(), first: '', last: '', phone: '', email: '', isLeader: true, availability: [] });
    render();
  });
  document.getElementById('btn-add-participant').addEventListener('click', (e) => {
    e.preventDefault();
    project.participants.push({ id: uid(), first: '', last: '', phone: '', email: '', isLeader: false, availability: [] });
    render();
  });

  document.getElementById('btn-import-people').addEventListener('click', () => document.getElementById('file-import-csv').click());
  document.getElementById('file-import-csv').addEventListener('change', e => {
    if (e.target.files[0]) importCSVFile(e.target.files[0]);
    e.target.value = '';
  });

  document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
}

wireEmptyState();
wireToolbar();
