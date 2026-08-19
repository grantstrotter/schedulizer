# Schedulizer

A small local tool for running church small groups. Pure HTML/CSS/JS, no build step,
one CDN dependency ([SortableJS](https://sortablejs.github.io/Sortable/)).

It's actually two tools, covering two separate stages of the process:

- **Schedule Groups** (`schedule.html`) — decide which nights your groups run, based on
  leaders' availability. Only tracks leaders — no participant concept at all.
- **Distribute Participants** (`distribute.html`) — once nights are decided, place
  participants into those groups based on their ranked sign-up preferences.

They're independent projects with their own save files — `schedule.html` doesn't know
about `distribute.html`'s data or vice versa.

## Running it

Open `index.html` directly in a browser (double-click it, or drag it into a browser
window) and pick a tool. No server needed.

## Usage — Schedule Groups (`schedule.html`)

- **Start**: if you have an in-progress session auto-saved in this browser, it resumes
  automatically. Only with no autosave present do you see the empty state, where you can
  start a new project or open an existing `.json` project file (click or drag-and-drop
  it onto the page).
- **Groups**: created via "+ Add Group" in the toolbar. They start in the Groups drawer;
  drag them onto a day column to schedule them. A group can only be on one day at a time.
  Name is editable inline.
- **Leaders**: this tool only tracks leaders — no participant concept at all (that's
  what the Distribute tool is for). Either imported via "Import People (CSV)" or added
  one at a time with "+ Add Leader" in the toolbar — expand the new (blank) card to
  fill in first/last name, phone, and email inline. CSV columns, in order, no header
  variations: `first,last,phone,email,isLeader,availability` — rows where `isLeader`
  isn't `true`/`1`/`yes` are skipped (not imported); availability is optional, a
  `|`-separated list of days — full names or the app's own abbreviations, e.g.
  `sunday|thursday` or `Sun|Thu` — leave blank for no restriction.
- **Placing leaders**: drag a leader card from the drawer onto a day (unassigned within
  that day) or onto a group (nested as a child of that group — it moves with the group
  from then on).
- **Availability**: expand a leader card (click the name) to see/edit their available
  nights via checkboxes. Dragging a leader onto a day they haven't checked as available
  is blocked, with a toast explaining why. A leader with **no** availability checked yet
  is treated as unrestricted (so freshly-imported leaders aren't unassignable everywhere).
- **Save / Export**: "Save" downloads the full project file (re-open it later the same
  way). "Export CSV" downloads a flattened, spreadsheet-friendly view: one row per
  assigned leader (day, group, name, contact), plus a trailing block of anyone still
  unassigned.
- **Autosave**: the current project is mirrored into browser `localStorage` after every
  change, purely as a refresh/crash safety net. It is **not** a substitute for exporting
  — clearing browser data or switching browsers loses it.

## Data model — Schedule Groups

```jsonc
{
  "days": {
    "sunday":    { "groupIds": [], "personIds": [] }, // personIds = people on this day but not in a group
    "monday":    { "groupIds": [], "personIds": [] },
    "tuesday":   { "groupIds": [], "personIds": [] },
    "wednesday": { "groupIds": [], "personIds": [] },
    "thursday":  { "groupIds": [], "personIds": [] },
    "friday":    { "groupIds": [], "personIds": [] },
    "saturday":  { "groupIds": [], "personIds": [] }
  },
  "groups": [
    { "id": "...", "name": "Young Adults", "personIds": [], "minimumRequired": 10 }
  ],
  "leaders": [
    { "id": "...", "first": "Jane", "last": "Doe", "phone": "555-1234", "email": "jane@example.com", "isLeader": true, "availability": ["sunday", "thursday"], "preferences": [] }
  ]
}
```

Leaders are stored once (in `leaders`) and referenced by `id` elsewhere —
`days[].personIds`, `days[].groupIds`, and `groups[].personIds` are all just id lists, so
editing a leader's phone/email/availability updates it everywhere they're referenced.
`isLeader`, `minimumRequired`, and `preferences` exist for compatibility with the
Distribute tool's data shape but aren't used by the Schedule tool itself — there's no
participant concept here at all.

## Usage — Distribute Participants (`distribute.html`)

- **Start**: same auto-resume/empty-state behavior as the Schedule tool, but with its
  own separate autosave — the two tools never share project data.
- **Groups**: not created manually — import a sign-up CSV (see below) to derive them
  from the form's own columns, or open a `.json` project that already has them. Each
  group's minimum is editable inline (click the number in its card, defaults to 10).
- **Import Sign-Up (CSV)**: built specifically for a Google Forms **Multiple-choice
  grid** question — each group as a grid row, choices labeled `1st Choice`,
  `2nd Choice`, etc. as grid columns. (Not Forms' separate dedicated "Ranking" question
  type — that exports differently and won't parse here.) Expects a `Name` column and
  one column per group row, headers containing the group name in brackets (e.g.
  `Which groups would you prefer to do? [Wednesday Night - Young Adults]`). One group is
  created per such column, even if nobody ranked it. If a day name appears anywhere in
  the group's name, that's parsed out for availability checking. Optional `Email`,
  `Phone`, an availability column (comma-separated day names), and a free-text column
  whose header contains "comment", "question", or "concern" (e.g. "Any comments,
  questions, or unique scheduling concerns?") are also read if present — the last
  becomes their editable Comments field. CSV parsing here is quote-aware (unlike the
  Schedule tool's plain comma split), so commas inside a quoted response are handled
  correctly. Importing again adds new people and merges into an existing person by
  matching email (refreshing their comments too), rather than duplicating them.
- **Placing people**: drag a leader or participant from a drawer straight into a group
  (no day grid here — groups sit side-by-side since their night was already decided in
  the Schedule tool, sorted by that day then alphabetically). Availability is checked
  against the group's parsed day, same as
  the Schedule tool.
- **Preference match**: each placed person shows a colored number badge for their
  current group's rank in their preferences — blue for a great match, shading through
  green, yellow, and orange down to red for a poor one (5th choice or worse, all sharing
  the same red), or a dark red "!" if they're in a group they didn't rank at all.
- **Editing preferences by hand**: expand any person's card (once at least one group
  exists) for a **Group ranking** section — a dropdown per group to set, change, or
  clear their rank directly. Works for leaders too, since they don't usually come from
  the sign-up CSV but may still have real preferences worth recording.
- **Community Builder**: a manual staff-only flag (checkbox on an expanded person card,
  right below Leader) for people especially effective at building community. Always
  starts unchecked and is never set by the sign-up import — only by hand. Shows a ⭐
  badge next to their name when checked.
- **Comments**: an expanded person card has an editable Comments box below their
  availability, imported from the sign-up form's free-text question (if present) and
  editable by hand afterward.
- **Needs Review**: a dark red "?" badge in a card's bottom-left corner means they're
  placed in a group whose night isn't among their marked availability (applies to
  leaders too). Only fires if they have at least one availability day checked — no
  boxes checked means unrestricted, same convention as everywhere else. Manual drags
  already block this exact mismatch, but the Auto-Assign steps place people by
  preference rank alone, so this is how you catch and fix it afterward.
- **Auto-Assign… menu**: runs one placement step at a time. **Place 1st Choices** puts
  everyone still unassigned into their 1st-choice group, unconditionally. Each
  **Fill Under-Minimum: Nth Choices** step pulls people whose Nth choice is an
  under-filled group in from whichever other group currently has more people —
  prioritizing evening out group sizes overall, so a group already at its own minimum
  can still donate to one far below its minimum, as long as the donor doesn't end up
  smaller than the group it just helped. It keeps working until nothing more can be
  evened out at this rank, so one click reaches a stable result (re-running the same
  step again immediately is a no-op). Run 2nd, then 3rd, and so on as needed, checking
  the board between steps. Leaders are never moved by these steps (they're placed by
  hand and stay put). Anything still under-filled afterward is left for manual
  adjustment.
- **Highlight Candidates**: each group has a button that shimmers everyone outside that
  group (elsewhere or unplaced) who ranked it, colored by the same rank-badge colors —
  plus a small number badge in the corner with the exact rank, so it's not
  color-only — so you can manually drag in a good match. Leaders never shimmer. Only
  one group highlights at a time; a banner at the top names which one and has its own
  stop button — the group's own button (now reading "Stop Highlighting"), or `Esc`,
  also turns it off.
- **Save / Export**: same as the Schedule tool — "Save" downloads the full project
  JSON, "Export CSV" downloads one row per person with their group, name, phone,
  email, and leader flag.

## Known POC limitations

- CSV parsing in the Schedule tool (and the Distribute tool's `Name`/`Email`/`Phone`/
  availability columns) is a plain comma split — a comma inside a field will misalign
  columns. The Distribute tool's sign-up importer handles quoted fields, since real
  Google Forms exports commonly quote them.
- Dragging a group onto a day (Schedule tool) checks the availability of everyone
  already in it (blocked, with a toast, if any of them isn't marked available that
  night).
- No accounts, no server, no multi-user sync — these are single-file local tools, one
  project open at a time each.
- Any drag-and-drop action re-renders the whole board, so an expanded person's detail
  panel collapses again after the next drag elsewhere (the underlying data isn't lost,
  just the expand/collapse UI state).
