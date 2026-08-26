import { writable, get } from 'svelte/store';
import { DAYS, DAY_LABELS } from '../lib/constants.js';
import { uid, csvEscape, parseAvailability, parseCSVRow, downloadBlob } from '../lib/util.js';
import { showToast } from '../lib/toast.js';

const AUTOSAVE_KEY = 'schedulizer_distribute_v1';
export const MATCH_TIER_COUNT = 5; // ranks 5th-or-worse all share the last (worst) tier's color

export const project = writable(null);
export const started = writable(false);
export const highlightGroupId = writable(null);

// Mutate the project object in place, then notify subscribers and persist. Simpler than
// rebuilding an immutable tree on every change, and matches how the data was already
// being handled — Svelte stores don't require immutability, just a notify call.
function mutate(fn) {
  project.update(p => {
    fn(p);
    return p;
  });
  persist();
}

function persist() {
  const p = get(project);
  if (p) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(p));
}

function blankProject() {
  return { groups: [], leaders: [], participants: [] };
}

export function getAllPeople(p) {
  return p.leaders.concat(p.participants);
}

export function findPerson(p, id) {
  return getAllPeople(p).find(x => x.id === id);
}

export function findGroup(p, id) {
  return p.groups.find(g => g.id === id);
}

export function getPersonGroup(p, id) {
  return p.groups.find(g => g.personIds.includes(id)) || null;
}

export function isPersonPlaced(p, id) {
  return p.groups.some(g => g.personIds.includes(id));
}

export function removePersonFromAllPlacements(p, id) {
  p.groups.forEach(g => { g.personIds = g.personIds.filter(x => x !== id); });
}

export function parseGroupDay(name) {
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
    communityBuilder: !!person.communityBuilder, // manual-only flag, never set by CSV import
    comments: typeof person.comments === 'string' ? person.comments : '',
    commentAddressed: !!person.commentAddressed
  });
}

// Badge color tier for a person's current group: 1 (best, coolest color) counts up to
// MATCH_TIER_COUNT (worst, red) — any rank at or beyond that tier shares the same red,
// and "unranked" (not on their preference list at all) is its own worst-case tier.
export function matchInfo(person, group) {
  if (!group) return null;
  const rank = person.preferences.indexOf(group.id);
  if (rank === -1) return { label: '!', tier: 'unranked' };
  return { label: String(rank + 1), tier: `t${Math.min(rank + 1, MATCH_TIER_COUNT)}` };
}

// Sign-up forms that make a comment field look required (rather than optional) train
// people to type a placeholder rather than leave it blank — none of these carry any
// actual information, so they shouldn't trigger a comment review any more than a truly
// empty field would.
const BLANK_COMMENT_VALUES = new Set([
  'n/a', 'na', 'no', 'none', 'nope', 'nope!', 'nothing', 'not applicable', 'no comment', 'no comments', '-'
]);

export function isMeaningfulComment(value) {
  const normalized = (value || '').trim().toLowerCase().replace(/\.$/, '');
  return normalized !== '' && !BLANK_COMMENT_VALUES.has(normalized);
}

// Needs-review flag: placed in a group whose parsed night isn't among their marked
// availability. No availability marked at all means unrestricted (same convention used
// everywhere else in the app), so that alone never triggers this. Manual drags already
// block this exact mismatch, but auto-assign moves people by preference rank alone, so
// this can still happen — this badge is how staff notice and fix it afterward.
export function needsAvailabilityReview(person, group) {
  return !!(group && group.day && person.availability.length > 0 && !person.availability.includes(group.day));
}

export function newProject(confirmFirst) {
  if (confirmFirst && get(project) && !confirm('Start a new project? This replaces the current one (still saved in local autosave until you start/open another).')) return;
  project.set(blankProject());
  highlightGroupId.set(null);
  persist();
  started.set(true);
}

export function loadProjectFromObject(obj) {
  const p = blankProject();
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj.groups)) p.groups = obj.groups.map(normalizeGroup);
    if (Array.isArray(obj.leaders)) p.leaders = obj.leaders.map(normalizePerson(true));
    if (Array.isArray(obj.participants)) p.participants = obj.participants.map(normalizePerson(false));
  }
  project.set(p);
  highlightGroupId.set(null);
  persist();
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
  mutate(p => { p.groups = p.groups.filter(g => g.id !== groupId); });
}

export function deletePerson(personId, fullName) {
  if (!confirm(`Delete ${fullName}?`)) return;
  mutate(p => {
    removePersonFromAllPlacements(p, personId);
    p.leaders = p.leaders.filter(x => x.id !== personId);
    p.participants = p.participants.filter(x => x.id !== personId);
  });
}

export function addLeader() {
  const id = uid();
  mutate(p => { p.leaders.push({ id, first: '', last: '', phone: '', email: '', isLeader: true, availability: [], preferences: [], communityBuilder: false, comments: '', commentAddressed: false }); });
  return id;
}

export function addParticipant() {
  const id = uid();
  mutate(p => { p.participants.push({ id, first: '', last: '', phone: '', email: '', isLeader: false, availability: [], preferences: [], communityBuilder: false, comments: '', commentAddressed: false }); });
  return id;
}

export function renameGroup(groupId, name) {
  mutate(p => {
    const g = findGroup(p, groupId);
    g.name = name;
    g.day = parseGroupDay(name);
  });
}

export function updateGroupMinimum(groupId, value) {
  mutate(p => {
    const g = findGroup(p, groupId);
    g.minimumRequired = Number.isFinite(value) && value >= 0 ? value : 0;
  });
}

export function reorderGroups(orderedIds) {
  mutate(p => { p.groups = orderedIds.map(id => findGroup(p, id)); });
}

export function updatePersonField(personId, field, value) {
  mutate(p => { findPerson(p, personId)[field] = value; });
}

// Editing the comment itself invalidates any prior "addressed" dismissal — a revised
// comment needs a fresh look, same reasoning as moving the person to a new placement.
export function updateComments(personId, value) {
  mutate(p => {
    const person = findPerson(p, personId);
    person.comments = value;
    person.commentAddressed = false;
  });
}

export function setCommentAddressed(personId, value) {
  mutate(p => { findPerson(p, personId).commentAddressed = value; });
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

export function toggleLeader(personId, isLeader) {
  mutate(p => {
    const person = findPerson(p, personId);
    person.isLeader = isLeader;
    p.leaders = p.leaders.filter(x => x.id !== personId);
    p.participants = p.participants.filter(x => x.id !== personId);
    (isLeader ? p.leaders : p.participants).push(person);
  });
}

export function toggleCommunityBuilder(personId, value) {
  mutate(p => { findPerson(p, personId).communityBuilder = value; });
}

// Setting a rank means "move this group to position N, shifting everyone else down"
// (like reordering a priority list) — not "resolve conflicts by tie-break", which would
// silently ignore the very change the user just made whenever it collided with an
// existing rank.
export function setGroupRank(personId, groupId, rank) {
  mutate(p => {
    const person = findPerson(p, personId);
    person.preferences = person.preferences.filter(id => id !== groupId);
    if (rank !== null) {
      const index = Math.max(0, Math.min(rank - 1, person.preferences.length));
      person.preferences.splice(index, 0, groupId);
    }
  });
}

// Called when a group's people-list dnd-zone finalizes a drop it has accepted (see
// dragdrop.js) — personIds is the zone's full, final membership in display order.
// Anyone arriving from elsewhere (another group, a drawer) is pulled out of their old
// spot first, and has any comment-addressed dismissal cleared — a new placement is a new
// context, so it needs a fresh look, same reasoning as editing the comment itself.
export function setGroupMembership(groupId, personIds) {
  mutate(p => {
    const group = findGroup(p, groupId);
    const previousIds = new Set(group.personIds);
    personIds.forEach(id => {
      removePersonFromAllPlacements(p, id);
      if (!previousIds.has(id)) {
        const person = findPerson(p, id);
        if (person) person.commentAddressed = false;
      }
    });
    group.personIds = personIds;
  });
}

function reorderSubsetToMatch(list, orderedIds) {
  if (orderedIds.length === 0) return list;
  const idSet = new Set(orderedIds);
  const rest = list.filter(x => !idSet.has(x.id));
  const ordered = orderedIds.map(id => list.find(x => x.id === id)).filter(Boolean);
  return [...ordered, ...rest];
}

// Called when a drawer's dnd-zone finalizes a drop it has accepted. personIds is that
// drawer's full, final unplaced membership in display order — anyone arriving from a
// group (or the other drawer) is pulled out of their old placement, has their
// leader/participant flag flipped to match which drawer they landed in, and has any
// comment-addressed dismissal cleared (see setGroupMembership).
export function setDrawerMembership(isLeaderDrawer, personIds) {
  mutate(p => {
    const targetArray = isLeaderDrawer ? p.leaders : p.participants;
    const previousIds = new Set(targetArray.filter(x => !isPersonPlaced(p, x.id)).map(x => x.id));
    personIds.forEach(id => {
      removePersonFromAllPlacements(p, id);
      const person = findPerson(p, id);
      person.isLeader = isLeaderDrawer;
      if (!previousIds.has(id)) person.commentAddressed = false;
    });
    const allPeople = getAllPeople(p);
    const leaders = allPeople.filter(x => x.isLeader);
    const participants = allPeople.filter(x => !x.isLeader);
    p.leaders = isLeaderDrawer ? reorderSubsetToMatch(leaders, personIds) : leaders;
    p.participants = !isLeaderDrawer ? reorderSubsetToMatch(participants, personIds) : participants;
  });
}

export function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const mod100 = n % 100;
  return n + (suffixes[(mod100 - 20) % 10] || suffixes[mod100] || suffixes[0]);
}

export function maxPreferenceRank(p) {
  return Math.max(0, ...p.participants.map(x => x.preferences.length));
}

export function assignFirstChoices() {
  const p = get(project);
  const unplaced = p.participants.filter(x => !isPersonPlaced(p, x.id) && x.preferences.length > 0);
  if (unplaced.length === 0) {
    showToast('Nobody unassigned has ranked preferences to place.');
    return;
  }
  mutate(p => {
    p.participants.filter(x => !isPersonPlaced(p, x.id) && x.preferences.length > 0).forEach(x => {
      const group = findGroup(p, x.preferences[0]);
      if (group) {
        group.personIds.push(x.id);
        x.commentAddressed = false;
      }
    });
  });
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
// this reaches a true fixed point in one run.
export function fillUnderMinimumGroupsAtRank(rank) {
  let moved = 0;
  mutate(p => {
    const pool = () => p.participants.filter(x => x.preferences.length > 0 && isPersonPlaced(p, x.id));
    let progress = true;
    while (progress) {
      progress = false;
      const underfilled = p.groups
        .filter(g => g.personIds.length < g.minimumRequired)
        .sort((a, b) => (b.minimumRequired - b.personIds.length) - (a.minimumRequired - a.personIds.length));

      for (const group of underfilled) {
        const candidates = pool()
          .filter(x => {
            const currentGroup = getPersonGroup(p, x.id);
            if (!currentGroup || currentGroup.id === group.id || x.preferences[rank - 1] !== group.id) return false;
            return currentGroup.personIds.length - group.personIds.length >= 2;
          })
          .sort((a, b) => getPersonGroup(p, b.id).personIds.length - getPersonGroup(p, a.id).personIds.length);

        if (candidates.length > 0) {
          const person = candidates[0];
          const fromGroup = getPersonGroup(p, person.id);
          fromGroup.personIds = fromGroup.personIds.filter(x => x !== person.id);
          group.personIds.push(person.id);
          person.commentAddressed = false;
          moved++;
          progress = true;
          break; // restart from the most-deficient group with fresh sizes
        }
      }
    }
  });
  const p = get(project);
  const stillUnder = p.groups.filter(g => g.personIds.length < g.minimumRequired);
  showToast(moved === 0
    ? `No moves were possible at ${ordinal(rank)} choice — nobody eligible in a bigger group.`
    : `Moved ${moved} people using ${ordinal(rank)} choices.${stillUnder.length ? ' ' + stillUnder.length + ' group' + (stillUnder.length === 1 ? '' : 's') + ' still under minimum.' : ' All groups meet their minimum.'}`);
}

function findOrCreateGroupByName(p, name) {
  let group = p.groups.find(g => g.name.toLowerCase() === name.toLowerCase());
  if (!group) {
    group = { id: uid(), name, day: parseGroupDay(name), personIds: [], minimumRequired: 10 };
    p.groups.push(group);
  }
  return group;
}

export function runSignupImport(lines, mapping) {
  let imported = 0;
  let merged = 0;
  let groupColsLength = 0;

  mutate(p => {
    // Existing (name-matched) groups keep their current board position untouched; only
    // genuinely new group columns get created, appended in the order set in the modal.
    const groupCols = mapping.groupOrder.map(g => ({ index: g.index, group: findOrCreateGroupByName(p, g.name) }));
    groupColsLength = groupCols.length;

    lines.slice(1).forEach(line => {
      const cells = parseCSVRow(line);
      let first, last;
      if (mapping.nameMode === 'single') {
        const fullName = mapping.nameIdx !== -1 ? (cells[mapping.nameIdx] || '') : '';
        if (!fullName) return;
        const spaceIdx = fullName.indexOf(' ');
        first = spaceIdx === -1 ? fullName : fullName.slice(0, spaceIdx);
        last = spaceIdx === -1 ? '' : fullName.slice(spaceIdx + 1).trim();
      } else {
        first = mapping.firstIdx !== -1 ? (cells[mapping.firstIdx] || '') : '';
        last = mapping.lastIdx !== -1 ? (cells[mapping.lastIdx] || '') : '';
        if (!first && !last) return;
      }

      const email = mapping.emailIdx !== -1 ? (cells[mapping.emailIdx] || '') : '';
      const phone = mapping.phoneIdx !== -1 ? (cells[mapping.phoneIdx] || '') : '';
      const availability = mapping.availIdx !== -1 ? parseAvailability(cells[mapping.availIdx], ',') : [];
      const comments = mapping.commentsIdx !== -1 ? (cells[mapping.commentsIdx] || '') : '';

      const ranked = groupCols
        .map(({ index, group }) => {
          const raw = cells[index] || '';
          // Not anchored to the start — handles "1st Choice", "Choice 1", "Rank: 3",
          // etc., taking the first run of digits found anywhere in the cell.
          const m = raw.match(/(\d+)/);
          return m ? { group, rank: parseInt(m[1], 10) } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.rank - b.rank);
      const preferences = ranked.map(r => r.group.id);

      const existing = email ? getAllPeople(p).find(x => x.email && x.email.toLowerCase() === email.toLowerCase()) : null;
      if (existing) {
        existing.first = first || existing.first;
        existing.last = last || existing.last;
        existing.phone = phone || existing.phone;
        existing.availability = availability.length > 0 ? availability : existing.availability;
        existing.preferences = preferences;
        if (isMeaningfulComment(comments) && comments !== existing.comments) existing.commentAddressed = false;
        existing.comments = comments || existing.comments;
        merged++;
      } else {
        // Sign-up rows are always participants — leaders are user-created, never
        // detected from the form itself (there's no "Is Leader" mapping).
        const person = { id: uid(), first, last, phone, email, isLeader: false, availability, preferences, communityBuilder: false, comments, commentAddressed: false };
        p.participants.push(person);
        imported++;
      }
    });
  });

  showToast(`Imported ${imported} new, merged ${merged} existing. ${groupColsLength} groups mapped.`);
}

export function exportJSON() {
  const p = get(project);
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'schedulizer-distribute-project.json');
}

export function exportCSV() {
  const p = get(project);
  const rows = [['group', 'first', 'last', 'phone', 'email', 'isLeader']];
  p.groups.forEach(g => {
    g.personIds.forEach(pid => {
      const person = findPerson(p, pid);
      if (!person) return;
      rows.push([g.name, person.first, person.last, person.phone, person.email, person.isLeader]);
    });
  });
  getAllPeople(p).filter(x => !isPersonPlaced(p, x.id)).forEach(person => {
    rows.push(['(unassigned)', person.first, person.last, person.phone, person.email, person.isLeader]);
  });
  const csv = rows.map(r => r.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, 'schedulizer-distribute-export.csv');
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

// Reads the raw text of a sign-up CSV file; resolves with its non-blank lines (or null,
// after toasting, if the file has no data rows). Splitting into lines happens here so
// the caller (the column-mapping modal) can work with plain strings — actual per-row
// cell parsing happens later, once column indices are known.
export function readSignupCSVFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const lines = reader.result.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) { showToast('That file has no data rows.'); resolve(null); return; }
      resolve(lines);
    };
    reader.readAsText(file);
  });
}
