const AUTOSAVE_KEY = 'schedulizer_distribute_v1';
const MATCH_TIER_COUNT = 5; // ranks 5th-or-worse all share the last (worst) tier's color

let project = null;
let sortables = [];
let highlightGroupId = null; // group whose outside candidates are currently shimmering, if any

function blankProject() {
  return { groups: [], leaders: [], participants: [] };
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

function getPersonGroup(id) {
  return project.groups.find(g => g.personIds.includes(id)) || null;
}

function isPersonPlaced(id) {
  return project.groups.some(g => g.personIds.includes(id));
}

function removePersonFromAllPlacements(id) {
  project.groups.forEach(g => { g.personIds = g.personIds.filter(x => x !== id); });
}

function persist() {
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(project));
}

let dragBlockKey = null;

function showDragBlockToast(key, msg) {
  if (dragBlockKey === key) return;
  dragBlockKey = key;
  clearTimeout(showToast._t);
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
  highlightGroupId = null;
  persist();
  startApp();
}

function parseGroupDay(name) {
  const lower = (name || '').toLowerCase();
  return DAYS.find(d => new RegExp(`\\b${DAY_LABELS[d].toLowerCase()}\\b`).test(lower)) || null;
}

function normalizeGroup(g) {
  return {
    id: g.id || uid(),
    name: g.name || 'Group',
    day: g.day || parseGroupDay(g.name),
    personIds: Array.isArray(g.personIds) ? g.personIds : [],
    minimumRequired: typeof g.minimumRequired === 'number' ? g.minimumRequired : 10
  };
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
    preferences: Array.isArray(person.preferences) ? person.preferences.filter(id => typeof id === 'string') : [],
    communityBuilder: !!person.communityBuilder // manual-only flag, never set by CSV import
  });
}

function loadProjectFromObject(obj) {
  const p = blankProject();
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj.groups)) p.groups = obj.groups.map(normalizeGroup);
    if (Array.isArray(obj.leaders)) p.leaders = obj.leaders.map(normalizePerson(true));
    if (Array.isArray(obj.participants)) p.participants = obj.participants.map(normalizePerson(false));
  }
  project = p;
  highlightGroupId = null;
  persist();
  startApp();
}

// ---------- Rendering ----------

function render() {
  sortables.forEach(s => s.destroy());
  sortables = [];

  renderBoard();
  renderDrawers();
  renderAutoAssignMenu();
  attachSortables();
  persist();
  applyHighlight(); // reapply any active candidate highlight to the freshly-rendered DOM
}

function renderAutoAssignMenu() {
  const select = document.getElementById('auto-assign-select');
  select.innerHTML = '';
  select.appendChild(el('option', { attrs: { value: '', selected: '', disabled: '' }, text: 'Auto-Assign…' }));
  select.appendChild(el('option', { attrs: { value: 'first' }, text: 'Place 1st Choices' }));
  const maxRank = maxPreferenceRank();
  for (let rank = 2; rank <= maxRank; rank++) {
    select.appendChild(el('option', { attrs: { value: String(rank) }, text: `Fill Under-Minimum: ${ordinal(rank)} Choices` }));
  }
}

// Badge color tier for a person's current group: 1 (best, coolest color) counts up to
// MATCH_TIER_COUNT (worst, red) — any rank at or beyond that tier shares the same red,
// and "unranked" (not on their preference list at all) is its own worst-case tier.
function matchInfo(person, group) {
  if (!group) return null;
  const rank = person.preferences.indexOf(group.id);
  if (rank === -1) return { label: '!', tier: 'unranked' };
  return { label: String(rank + 1), tier: `t${Math.min(rank + 1, MATCH_TIER_COUNT)}` };
}

// Display order only — doesn't touch project.groups itself. Sorted by day of week
// (Sun-Sat, matching the Schedule tool), with undated groups pushed to the end, then
// alphabetically within the same day.
function sortedGroups() {
  return [...project.groups].sort((a, b) => {
    const dayA = a.day ? DAYS.indexOf(a.day) : DAYS.length;
    const dayB = b.day ? DAYS.indexOf(b.day) : DAYS.length;
    if (dayA !== dayB) return dayA - dayB;
    return a.name.localeCompare(b.name);
  });
}

function renderBoard() {
  const board = document.getElementById('groups-board');
  board.innerHTML = '';
  if (project.groups.length === 0) {
    board.appendChild(el('div', {
      class: 'board-empty-hint',
      text: 'No groups yet — click "Import Sign-Up (CSV)…" above to derive groups from your sign-up form (or open a project file that already has them).'
    }));
    return;
  }
  sortedGroups().forEach(g => board.appendChild(renderGroupCard(g)));
}

function renderDrawers() {
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
  const cardClass = `group-card board-group-card${highlightGroupId === group.id ? ' group-card--highlighting' : ''}`;
  const card = el('div', { class: cardClass, attrs: { 'data-group-id': group.id, 'data-type': 'group' } });

  const row = el('div', { class: 'card-row' });
  const nameSpan = el('span', { class: 'group-name', text: group.name || '(unnamed group)' });
  row.appendChild(nameSpan);

  const editBtn = el('button', { class: 'icon-btn group-edit-btn', text: '✎', attrs: { title: 'Rename group' } });
  editBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const input = el('input', { class: 'inline-input group-name', attrs: { type: 'text' } });
    input.value = group.name;
    nameSpan.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
      group.name = input.value;
      group.day = parseGroupDay(group.name);
      nameSpan.textContent = group.name || '(unnamed group)';
      input.replaceWith(nameSpan);
      persist();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (ke) => {
      if (ke.key === 'Enter') input.blur();
      if (ke.key === 'Escape') { input.value = group.name; input.blur(); }
    });
  });
  row.appendChild(editBtn);

  const delBtn = el('button', { class: 'icon-btn', text: '✕', attrs: { title: 'Delete group' } });
  delBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!confirm(`Delete group "${group.name}"? People inside will return to their drawer.`)) return;
    project.groups = project.groups.filter(g => g.id !== group.id);
    render();
  });
  row.appendChild(delBtn);
  card.appendChild(row);

  const countDiv = el('div', { class: group.personIds.length < group.minimumRequired ? 'group-count under-min' : 'group-count' });
  countDiv.appendChild(document.createTextNode(`${group.personIds.length} / `));
  const minInput = el('input', { class: 'min-input', attrs: { type: 'number', min: '0', title: 'Minimum required' } });
  minInput.value = group.minimumRequired;
  minInput.addEventListener('change', () => {
    const val = parseInt(minInput.value, 10);
    group.minimumRequired = Number.isFinite(val) && val >= 0 ? val : 0;
    minInput.value = group.minimumRequired;
    countDiv.classList.toggle('under-min', group.personIds.length < group.minimumRequired);
    persist();
  });
  countDiv.appendChild(minInput);
  if (group.day) countDiv.appendChild(document.createTextNode(` · ${DAY_LABELS[group.day]}`));
  card.appendChild(countDiv);

  const isHighlighting = highlightGroupId === group.id;
  const highlightBtn = el('button', {
    class: `group-highlight-btn${isHighlighting ? ' active' : ''}`,
    text: isHighlighting ? 'Stop Highlighting' : 'Highlight Candidates',
    attrs: { title: 'Show people outside this group who ranked it' }
  });
  highlightBtn.addEventListener('click', (e) => {
    e.preventDefault();
    highlightGroupId = highlightGroupId === group.id ? null : group.id;
    applyHighlight();
  });
  card.appendChild(highlightBtn);

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

  let leaderBadge = null;
  if (person.isLeader) {
    leaderBadge = el('span', { class: 'leader-emoji', text: '🎯' });
    summary.appendChild(leaderBadge);
  }
  let communityBuilderBadge = null;
  if (person.communityBuilder) {
    communityBuilderBadge = el('span', { class: 'community-builder-emoji', text: '⭐', attrs: { title: 'Community Builder' } });
    summary.appendChild(communityBuilderBadge);
  }

  const currentGroup = getPersonGroup(person.id);
  let matchBadge = null;
  if (currentGroup) {
    const info = matchInfo(person, currentGroup);
    matchBadge = el('span', { class: `match-badge match-${info.tier}`, text: info.label, attrs: { title: info.tier === 'unranked' ? 'Not on this person’s preference list' : `Rank ${info.label} choice` } });
    summary.appendChild(matchBadge);
  }
  // Editing this person's Group ranking below can change their current group's rank
  // (directly, or indirectly via a shift when another group's rank collides) — refresh
  // the summary badge in place rather than requiring a full render() to notice.
  const refreshMatchBadge = () => {
    if (!currentGroup || !matchBadge) return;
    const info = matchInfo(person, currentGroup);
    matchBadge.className = `match-badge match-${info.tier}`;
    matchBadge.textContent = info.label;
    matchBadge.title = info.tier === 'unranked' ? 'Not on this person’s preference list' : `Rank ${info.label} choice`;
  };

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

  const leaderRow = el('label', { class: 'contact-line leader-toggle' });
  const leaderCb = el('input', { attrs: { type: 'checkbox' } });
  leaderCb.checked = person.isLeader;
  leaderRow.appendChild(leaderCb);
  leaderRow.appendChild(document.createTextNode(' Leader'));
  detail.appendChild(leaderRow);
  leaderCb.addEventListener('change', () => {
    person.isLeader = leaderCb.checked;
    project.leaders = project.leaders.filter(p => p.id !== person.id);
    project.participants = project.participants.filter(p => p.id !== person.id);
    (person.isLeader ? project.leaders : project.participants).push(person);

    if (person.isLeader && !leaderBadge) {
      leaderBadge = el('span', { class: 'leader-emoji', text: '🎯' });
      summary.insertBefore(leaderBadge, nameSpan.nextSibling); // always leftmost badge
    } else if (!person.isLeader && leaderBadge) {
      leaderBadge.remove();
      leaderBadge = null;
    }

    const container = details.parentElement;
    if (container && container.dataset.container === 'people-drawer') {
      const targetDrawer = document.getElementById(person.isLeader ? 'drawer-leaders' : 'drawer-participants');
      if (container.id !== targetDrawer.id) {
        targetDrawer.appendChild(details);
        document.getElementById('count-leaders').textContent = `(${document.querySelectorAll('#drawer-leaders > .person-card').length})`;
        document.getElementById('count-participants').textContent = `(${document.querySelectorAll('#drawer-participants > .person-card').length})`;
      }
    }

    persist();
  });

  const communityBuilderRow = el('label', { class: 'contact-line leader-toggle' });
  const communityBuilderCb = el('input', { attrs: { type: 'checkbox' } });
  communityBuilderCb.checked = person.communityBuilder;
  communityBuilderRow.appendChild(communityBuilderCb);
  communityBuilderRow.appendChild(document.createTextNode(' Community Builder'));
  detail.appendChild(communityBuilderRow);
  communityBuilderCb.addEventListener('change', () => {
    person.communityBuilder = communityBuilderCb.checked;
    if (person.communityBuilder && !communityBuilderBadge) {
      communityBuilderBadge = el('span', { class: 'community-builder-emoji', text: '⭐', attrs: { title: 'Community Builder' } });
      summary.insertBefore(communityBuilderBadge, matchBadge || delBtn); // after leader badge, before rank badge
    } else if (!person.communityBuilder && communityBuilderBadge) {
      communityBuilderBadge.remove();
      communityBuilderBadge = null;
    }
    persist();
  });

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
    label.appendChild(document.createTextNode(d.slice(0, 3)));
    grid.appendChild(label);
  });
  detail.appendChild(grid);

  if (project.groups.length > 0) {
    const prefBlock = el('div', { class: 'contact-line preferences-editor' });
    prefBlock.appendChild(el('div', { text: 'Group ranking:' }));

    const resyncRankSelects = () => {
      prefBlock.querySelectorAll('.rank-select').forEach(sel => {
        const rank = person.preferences.indexOf(sel.dataset.groupId);
        sel.value = rank === -1 ? '' : String(rank + 1);
      });
    };

    // Setting a rank means "move this group to position N, shifting everyone else
    // down" (like reordering a priority list) — not "resolve conflicts by tie-break",
    // which would silently ignore the very change the user just made whenever it
    // collided with an existing rank.
    const setGroupRank = (groupId, rank) => {
      person.preferences = person.preferences.filter(id => id !== groupId);
      if (rank !== null) {
        const index = Math.max(0, Math.min(rank - 1, person.preferences.length));
        person.preferences.splice(index, 0, groupId);
      }
      resyncRankSelects();
      refreshMatchBadge();
      persist();
    };

    sortedGroups().forEach(g => {
      const row = el('div', { class: 'preference-row' });
      row.appendChild(el('span', { class: 'preference-group-name', text: g.name }));
      const select = el('select', { class: 'rank-select', attrs: { 'data-group-id': g.id } });
      select.appendChild(el('option', { attrs: { value: '' }, text: '—' }));
      for (let r = 1; r <= project.groups.length; r++) {
        select.appendChild(el('option', { attrs: { value: String(r) }, text: String(r) }));
      }
      const currentRank = person.preferences.indexOf(g.id);
      select.value = currentRank === -1 ? '' : String(currentRank + 1);
      select.addEventListener('change', () => {
        setGroupRank(g.id, select.value ? parseInt(select.value, 10) : null);
      });
      row.appendChild(select);
      prefBlock.appendChild(row);
    });

    detail.appendChild(prefBlock);
  }

  details.appendChild(detail);
  return details;
}

// ---------- Candidate highlighting ----------
// Pure DOM-class updates, no render() — keeps this cheap and non-disruptive (expanded
// cards, scroll position, and Sortables all stay untouched) since it's just a visual
// filter, not a data change. render() calls this again afterward so a highlight survives
// (or correctly clears itself) across drags, imports, and auto-assign actions.

function applyHighlight() {
  document.querySelectorAll('.person-card').forEach(card => {
    card.className = card.className.replace(/\bcandidate-t[1-5]\b/g, '').replace(/\s+/g, ' ').trim();
    const badge = card.querySelector('.candidate-rank-badge');
    if (badge) badge.remove();
  });
  document.querySelectorAll('.board-group-card').forEach(card => card.classList.remove('group-card--highlighting'));
  document.querySelectorAll('.group-highlight-btn').forEach(btn => {
    btn.textContent = 'Highlight Candidates';
    btn.classList.remove('active');
  });

  const banner = document.getElementById('highlight-banner');

  if (!highlightGroupId) {
    banner.hidden = true;
    return;
  }

  const group = findGroup(highlightGroupId);
  if (!group) {
    highlightGroupId = null;
    banner.hidden = true;
    return;
  }

  const groupCard = document.querySelector(`.group-card[data-group-id="${group.id}"]`);
  if (groupCard) {
    groupCard.classList.add('group-card--highlighting');
    const btn = groupCard.querySelector('.group-highlight-btn');
    if (btn) { btn.textContent = 'Stop Highlighting'; btn.classList.add('active'); }
  }

  document.querySelectorAll('.person-card').forEach(card => {
    const person = findPerson(card.dataset.personId);
    if (!person || person.isLeader) return; // leaders are pre-determined, never candidates
    const currentGroup = getPersonGroup(person.id);
    if (currentGroup && currentGroup.id === group.id) return; // already in this group
    const rank = person.preferences.indexOf(group.id);
    if (rank === -1) return; // didn't rank this group at all
    const tier = Math.min(rank + 1, MATCH_TIER_COUNT);
    card.classList.add(`candidate-t${tier}`);
    // A number badge alongside the shimmer color, so the rank reads even without
    // relying on distinguishing the background hue. Must go inside <summary>, not as a
    // direct child of <details> — <details> only renders children other than its first
    // <summary> while open, so a sibling badge would be invisible whenever collapsed
    // (i.e. almost always, since cards default to collapsed).
    card.querySelector('summary').appendChild(el('span', { class: `candidate-rank-badge match-t${tier}`, text: String(rank + 1) }));
  });

  banner.hidden = false;
  document.getElementById('highlight-banner-text').textContent = `Highlighting candidates for "${group.name}"`;
}

// ---------- Drag and drop ----------
// Simpler than the scheduling tool: there's no day grid, so every Sortable container
// here (the two drawers and each group's nested people-list) is already a valid target
// for any person — the only thing to check is availability against the group's day
// (if the group's name implied one), so no redirect/relocation logic is needed.

function checkPersonMoveAllowed(evt) {
  const personId = evt.dragged.dataset.personId;
  const person = findPerson(personId);
  const groupCard = evt.to.closest('.group-card');
  const group = groupCard ? findGroup(groupCard.dataset.groupId) : null;

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

function syncModelFromDom() {
  project.groups.forEach(g => {
    const listEl = document.querySelector(`.group-card[data-group-id="${g.id}"] > .people-list`);
    if (listEl) g.personIds = Array.from(listEl.querySelectorAll(':scope > .person-card')).map(n => n.dataset.personId);
  });

  const leaderIds = Array.from(document.querySelectorAll('#drawer-leaders > .person-card')).map(n => n.dataset.personId);
  const participantIds = Array.from(document.querySelectorAll('#drawer-participants > .person-card')).map(n => n.dataset.personId);

  const allPeople = getAllPeople();
  leaderIds.forEach(id => { const p = allPeople.find(x => x.id === id); if (p) p.isLeader = true; });
  participantIds.forEach(id => { const p = allPeople.find(x => x.id === id); if (p) p.isLeader = false; });

  project.leaders = allPeople.filter(p => p.isLeader);
  project.participants = allPeople.filter(p => !p.isLeader);
}

let dragOrigin = null;

function recordDragOrigin(evt) {
  dragOrigin = { item: evt.item, parent: evt.from, nextSibling: evt.item.nextElementSibling };
}

function cancelActiveDrag() {
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
  syncModelFromDom();
  render();
}

function attachSortables() {
  const containers = [
    document.getElementById('drawer-leaders'),
    document.getElementById('drawer-participants'),
    ...Array.from(document.querySelectorAll('.board-group-card > .people-list'))
  ];
  containers.forEach(container => {
    sortables.push(Sortable.create(container, {
      group: 'distribute-board',
      handle: 'summary',
      filter: '.icon-btn, input',
      preventOnFilter: false,
      animation: 150,
      forceFallback: true,
      onStart: recordDragOrigin,
      onMove: checkPersonMoveAllowed,
      onEnd: handleDragEnd
    }));
  });
}

// ---------- Auto-assign by preference (leaders are pre-determined and never touched) ----------

function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const mod100 = n % 100;
  return n + (suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0]);
}

function maxPreferenceRank() {
  return Math.max(0, ...project.participants.map(p => p.preferences.length));
}

function assignFirstChoices() {
  const unplaced = project.participants.filter(p => !isPersonPlaced(p.id) && p.preferences.length > 0);
  if (unplaced.length === 0) {
    showToast('Nobody unassigned has ranked preferences to place.');
    return;
  }
  unplaced.forEach(p => {
    const group = findGroup(p.preferences[0]);
    if (group) group.personIds.push(p.id);
  });
  render();
  showToast(`Placed ${unplaced.length} people in their 1st choice.`);
}

// Pulls candidates into under-filled groups using their choice at exactly this rank,
// preferring to pull from whichever group currently has the biggest surplus over its own
// minimum. Only ever moves participants — leaders are placed by hand ahead of time and
// are never candidates to move, though they still count toward a group's headcount.
// Evens out group sizes rather than treating each group's own minimum as a floor it
// alone defends: a group sitting exactly at its minimum can still donate to a group
// that's far below its own — what matters is which of the two currently has more
// people, not whether the donor has "surplus" over its own separate target. The >=2
// margin means a pull never leaves the donor smaller than the recipient it just
// helped, so it can't immediately create a new problem of the same size it just fixed.
// Recomputes group sizes fresh after every single move (not just once per click) so
// this reaches a true fixed point in one run — otherwise fixing one group could dip a
// donor below its own minimum, which would only get noticed (and only partially fixed)
// on a second manual click, and so on.
function fillUnderMinimumGroupsAtRank(rank) {
  const pool = () => project.participants.filter(p => p.preferences.length > 0 && isPersonPlaced(p.id));

  let moved = 0;
  let progress = true;
  while (progress) {
    progress = false;
    const underfilled = project.groups
      .filter(g => g.personIds.length < g.minimumRequired)
      .sort((a, b) => (b.minimumRequired - b.personIds.length) - (a.minimumRequired - a.personIds.length));

    for (const group of underfilled) {
      const candidates = pool()
        .filter(p => {
          const currentGroup = getPersonGroup(p.id);
          if (!currentGroup || currentGroup.id === group.id || p.preferences[rank - 1] !== group.id) return false;
          return currentGroup.personIds.length - group.personIds.length >= 2;
        })
        .sort((a, b) => getPersonGroup(b.id).personIds.length - getPersonGroup(a.id).personIds.length);

      if (candidates.length > 0) {
        const person = candidates[0];
        const fromGroup = getPersonGroup(person.id);
        fromGroup.personIds = fromGroup.personIds.filter(x => x !== person.id);
        group.personIds.push(person.id);
        moved++;
        progress = true;
        break; // restart from the most-deficient group with fresh sizes
      }
    }
  }

  const stillUnder = project.groups.filter(g => g.personIds.length < g.minimumRequired);
  render();
  showToast(moved === 0
    ? `No moves were possible at ${ordinal(rank)} choice — nobody eligible in a bigger group.`
    : `Moved ${moved} people using ${ordinal(rank)} choices.${stillUnder.length ? ' ' + stillUnder.length + ' group' + (stillUnder.length === 1 ? '' : 's') + ' still under minimum.' : ' All groups meet their minimum.'}`);
}

// ---------- Sign-up CSV import ----------

function parseCSVRow(line) {
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

function findOrCreateGroupByName(name) {
  let group = project.groups.find(g => g.name.toLowerCase() === name.toLowerCase());
  if (!group) {
    group = { id: uid(), name, day: parseGroupDay(name), personIds: [], minimumRequired: 10 };
    project.groups.push(group);
  }
  return group;
}

function importSignupCSVFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const lines = reader.result.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length < 2) { showToast('That file has no data rows.'); return; }
    const headers = parseCSVRow(lines[0]);

    const nameIdx = headers.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase() === 'full name');
    const emailIdx = headers.findIndex(h => h.toLowerCase().includes('email'));
    const phoneIdx = headers.findIndex(h => h.toLowerCase().includes('phone'));
    const availIdx = headers.findIndex(h => h.toLowerCase().includes('available') || h.toLowerCase().includes('availability'));
    const leaderIdx = headers.findIndex(h => h.toLowerCase().includes('leader'));

    const groupCols = []; // { index, group }
    headers.forEach((h, i) => {
      const m = h.match(/\[([^\]]+)\]/);
      if (m) groupCols.push({ index: i, group: findOrCreateGroupByName(m[1].trim()) });
    });

    if (nameIdx === -1) { showToast('Could not find a "Name" column in that CSV.'); return; }
    if (groupCols.length === 0) { showToast('Could not find any group-preference columns (expected headers containing "[Group Name]").'); return; }

    let imported = 0;
    let merged = 0;

    lines.slice(1).forEach(line => {
      const cells = parseCSVRow(line);
      const fullName = cells[nameIdx] || '';
      if (!fullName) return;
      const spaceIdx = fullName.indexOf(' ');
      const first = spaceIdx === -1 ? fullName : fullName.slice(0, spaceIdx);
      const last = spaceIdx === -1 ? '' : fullName.slice(spaceIdx + 1).trim();
      const email = emailIdx !== -1 ? (cells[emailIdx] || '') : '';
      const phone = phoneIdx !== -1 ? (cells[phoneIdx] || '') : '';
      const availability = availIdx !== -1 ? parseAvailability(cells[availIdx], ',') : [];
      const isLeader = leaderIdx !== -1 && ['true', '1', 'yes', 'y'].includes((cells[leaderIdx] || '').toLowerCase());

      const ranked = groupCols
        .map(({ index, group }) => {
          const raw = cells[index] || '';
          const m = raw.match(/^(\d+)/);
          return m ? { group, rank: parseInt(m[1], 10) } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.rank - b.rank);
      const preferences = ranked.map(r => r.group.id);

      const existing = email ? getAllPeople().find(p => p.email && p.email.toLowerCase() === email.toLowerCase()) : null;
      if (existing) {
        existing.first = first || existing.first;
        existing.last = last || existing.last;
        existing.phone = phone || existing.phone;
        existing.availability = availability.length > 0 ? availability : existing.availability;
        existing.preferences = preferences;
        merged++;
      } else {
        const person = { id: uid(), first, last, phone, email, isLeader, availability, preferences, communityBuilder: false };
        (isLeader ? project.leaders : project.participants).push(person);
        imported++;
      }
    });

    render();
    showToast(`Imported ${imported} new, merged ${merged} existing. ${groupCols.length} groups on the board.`);
  };
  reader.readAsText(file);
}

// ---------- JSON export / import ----------

function exportJSON() {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'schedulizer-distribute-project.json');
}

function exportCSV() {
  const rows = [['group', 'first', 'last', 'phone', 'email', 'isLeader', 'rank', 'match']];
  sortedGroups().forEach(g => {
    g.personIds.forEach(pid => {
      const p = findPerson(pid);
      if (!p) return;
      const rank = p.preferences.indexOf(g.id);
      rows.push([g.name, p.first, p.last, p.phone, p.email, p.isLeader, rank === -1 ? '' : rank + 1, matchInfo(p, g).label]);
    });
  });
  getAllPeople().filter(p => !isPersonPlaced(p.id)).forEach(p => {
    rows.push(['(unassigned)', p.first, p.last, p.phone, p.email, p.isLeader, '', '']);
  });
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, 'schedulizer-distribute-export.csv');
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

// ---------- Wiring ----------

function wireEmptyState() {
  const dropzone = document.getElementById('dropzone');
  document.getElementById('btn-new-empty').addEventListener('click', () => newProject(false));
  document.getElementById('btn-open-empty').addEventListener('click', () => document.getElementById('file-open-json').click());
  document.getElementById('file-open-json').addEventListener('change', e => {
    if (e.target.files[0]) importJSONFile(e.target.files[0]);
    e.target.value = '';
  });

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

function focusNewPerson(id) {
  const card = document.querySelector(`.person-card[data-person-id="${id}"]`);
  if (!card) return;
  card.open = true;
  const firstInput = card.querySelector('input[placeholder="First name"]');
  if (firstInput) firstInput.focus();
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

  document.getElementById('btn-add-leader').addEventListener('click', (e) => {
    e.preventDefault();
    const id = uid();
    project.leaders.push({ id, first: '', last: '', phone: '', email: '', isLeader: true, availability: [], preferences: [], communityBuilder: false });
    render();
    focusNewPerson(id);
  });
  document.getElementById('btn-add-participant').addEventListener('click', (e) => {
    e.preventDefault();
    const id = uid();
    project.participants.push({ id, first: '', last: '', phone: '', email: '', isLeader: false, availability: [], preferences: [], communityBuilder: false });
    render();
    focusNewPerson(id);
  });

  document.getElementById('btn-import-signup').addEventListener('click', () => document.getElementById('file-import-signup').click());
  document.getElementById('file-import-signup').addEventListener('change', e => {
    if (e.target.files[0]) importSignupCSVFile(e.target.files[0]);
    e.target.value = '';
  });

  document.getElementById('auto-assign-select').addEventListener('change', (e) => {
    const value = e.target.value;
    e.target.value = ''; // reset to the placeholder — this is an action menu, not a persistent setting
    if (value === 'first') assignFirstChoices();
    else if (value) fillUnderMinimumGroupsAtRank(parseInt(value, 10));
  });
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
}

let pendingPersonToggle = null;

function wirePersonExpandToggle() {
  document.addEventListener('pointerdown', (e) => {
    const summary = e.target.closest('.person-card summary');
    if (!summary || e.target.closest('.icon-btn')) return;
    pendingPersonToggle = { details: summary.parentElement, x: e.clientX, y: e.clientY };
  });
  document.addEventListener('pointerup', (e) => {
    if (!pendingPersonToggle) return;
    const { details, x, y } = pendingPersonToggle;
    pendingPersonToggle = null;
    if (Math.hypot(e.clientX - x, e.clientY - y) < 5) details.open = !details.open;
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('.person-card summary') && !e.target.closest('.icon-btn')) e.preventDefault();
  });
}

function wireKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cancelActiveDrag();
      if (highlightGroupId) { highlightGroupId = null; applyHighlight(); }
      return;
    }
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
    e.preventDefault();
    if (project) exportJSON();
  });
}

function wireHighlightBanner() {
  document.getElementById('btn-stop-highlight').addEventListener('click', () => {
    highlightGroupId = null;
    applyHighlight();
  });
}

function wireHelpModal() {
  const modal = document.getElementById('help-modal');
  const open = () => { modal.hidden = false; };
  const close = () => { modal.hidden = true; };
  document.getElementById('btn-help').addEventListener('click', open);
  document.getElementById('btn-help-empty').addEventListener('click', open);
  document.getElementById('btn-help-close').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
}

wireEmptyState();
wireToolbar();
wireKeyboardShortcuts();
wireHelpModal();
wireHighlightBanner();
wirePersonExpandToggle();

const autosaved = localStorage.getItem(AUTOSAVE_KEY);
if (autosaved) {
  try {
    loadProjectFromObject(JSON.parse(autosaved));
  } catch (e) {
    showToast('Autosave was corrupted — starting fresh.');
  }
}
