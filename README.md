# Schedulizer

A small local tool for scheduling church small groups across the 7 nights of the week.
Pure HTML/CSS/JS, no build step, one CDN dependency ([SortableJS](https://sortablejs.github.io/Sortable/)).

## Running it

Just open `index.html` directly in a browser (double-click it, or drag it into a
browser window). No server needed.

## Usage

- **Start**: on first load you'll see an empty state — start a new project, open an
  existing `.json` project file (click or drag-and-drop it onto the page), or resume
  your last in-browser session if one was auto-saved.
- **Groups**: created via "+ Add Group" in the toolbar. They start in the Groups drawer;
  drag them onto a day column to schedule them. A group can only be on one day at a time.
  Name is editable inline.
- **People**: either imported via "Import People (CSV)" or added one at a time with
  "+ Add Leader" / "+ Add Participant" in the toolbar — expand the new (blank) card to
  fill in first/last name, phone, and email inline. CSV columns, in order, no header
  variations: `first,last,phone,email,isLeader` (isLeader: `true`/`1`/`yes` = leader).
- **Placing people**: drag a person card from a drawer onto a day (unassigned within that
  day) or onto a group (nested as a child of that group — it moves with the group from
  then on).
- **Availability**: expand a person card (click the name) to see/edit their available
  nights via checkboxes. Dragging a person onto a day they haven't checked as available
  is blocked, with a toast explaining why. A person with **no** availability checked yet
  is treated as unrestricted (so freshly-imported people aren't unassignable everywhere).
- **Leader ⇄ Participant**: drag a person card between the Leaders and Participants
  drawers to convert them. Only works while they're sitting in a drawer (unassigned).
- **Save / Export**: "Save" downloads the full project file (re-open it later the same
  way). "Export CSV" downloads a flattened, spreadsheet-friendly view: one row per
  assigned person (day, group, name, contact, isLeader), plus a trailing block of
  anyone still unassigned.
- **Autosave**: the current project is mirrored into browser `localStorage` after every
  change, purely as a refresh/crash safety net. It is **not** a substitute for exporting
  — clearing browser data or switching browsers loses it.

## Data model

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
    { "id": "...", "name": "Young Adults", "personIds": [] }
  ],
  "leaders": [
    { "id": "...", "first": "Jane", "last": "Doe", "phone": "555-1234", "email": "jane@example.com", "isLeader": true, "availability": ["sunday", "thursday"] }
  ],
  "participants": [
    { "id": "...", "first": "John", "last": "Smith", "phone": "", "email": "", "isLeader": false, "availability": [] }
  ]
}
```

People are stored once (in `leaders`/`participants`) and referenced by `id` elsewhere —
`days[].personIds`, `days[].groupIds`, and `groups[].personIds` are all just id lists, so
editing a person's phone/email/availability updates it everywhere they're referenced.

## Known POC limitations

- CSV parsing is a plain comma split — a comma inside a name/phone/email field will
  misalign columns. Fine for typical church-directory exports, not RFC 4180-safe.
- Dragging a group onto a day checks the availability of that group's **leaders** only
  (blocked, with a toast, if any leader in the group isn't marked available that night).
  Non-leader members already in the group are not re-checked when the group moves.
- No accounts, no server, no multi-user sync — it's a single-file local tool, one
  project open at a time.
- Any drag-and-drop action re-renders the whole board, so an expanded person's detail
  panel collapses again after the next drag elsewhere (the underlying data isn't lost,
  just the expand/collapse UI state).
