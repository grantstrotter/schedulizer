# Schedulizer

A small tool for running church small groups, built as three static pages sharing
components — [Svelte](https://svelte.dev) + [Vite](https://vitejs.dev), deployed as a
GitHub Pages project site. There's no backend: everything lives in the browser
(`localStorage` for autosave, exported `.json`/`.csv` files for anything you actually
want to keep).

It's actually two tools, covering two separate stages of the process:

- **Schedule Groups** (`schedule.html`) — decide which nights your groups run, based on
  leaders' availability. Only tracks leaders — no participant concept at all.
- **Distribute Participants** (`distribute.html`) — once nights are decided, place
  participants into those groups based on their ranked sign-up preferences.

They're independent projects with their own save files — `schedule.html` doesn't know
about `distribute.html`'s data or vice versa.

## Running it locally

```bash
npm install
npm run dev       # dev server with hot reload, served at http://localhost:5173/
```

To check a production build behaves the same as it will once deployed:

```bash
npm run build      # outputs to dist/
npm run preview    # serves the built dist/ output, base path and all
```

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the project and
publishes it to GitHub Pages automatically — no manual deploy step. The live site is at
`https://grantstrotter.github.io/schedulizer/`. You can also trigger a deploy manually
from any branch via the Actions tab's "Run workflow" button, useful for testing changes
before merging.

## Usage — Schedule Groups (`schedule.html`)

- **Start**: if you have an in-progress session auto-saved in this browser, it resumes
  automatically. Only with no autosave present do you see the empty state, where you can
  start a new project or open an existing `.json` project file (click or drag-and-drop
  it onto the page).
- **Days**: seven columns across the top, each with its own **Groups** section and
  **Leaders** section — drag a group into a day's Groups section, and a leader into its
  Leaders section (they don't auto-redirect if you drop in the wrong sub-section).
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
  nights via checkboxes. A leader with **no** availability checked yet is treated as
  unrestricted (so freshly-imported leaders aren't unassignable everywhere). Dropping
  someone (or a group, based on its nested leaders) on a night that doesn't match is
  **allowed, not blocked** — a 📅 badge shows up on the affected card so you can catch
  and fix it afterward, rather than the drop being refused outright.
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
  "version": 1, // bumped only if this shape changes in the future; not currently read back in
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
editing a leader's phone/email/availability updates it everywhere they're referenced. A
group's day is never stored directly here — it's derived from which day's `groupIds`
array currently contains it. `isLeader`, `minimumRequired`, and `preferences` exist for
compatibility with the Distribute tool's data shape but aren't used by the Schedule tool
itself — there's no participant concept here at all.

## Usage — Distribute Participants (`distribute.html`)

- **Start**: same auto-resume/empty-state behavior as the Schedule tool, but with its
  own separate autosave — the two tools never share project data.
- **Groups**: not created manually — import a sign-up CSV (see below) to derive them
  from the form's own columns, or open a `.json` project that already has them. Each
  group's minimum is editable inline (click the number in its card, defaults to 10).
- **Import Sign-Up (CSV)**: built specifically for a Google Forms **Multiple-choice
  grid** question — each group as a grid row, choices labeled `1st Choice`,
  `2nd Choice`, etc. as grid columns. (Not Forms' separate dedicated "Ranking" question
  type — that exports differently and won't parse here.) Choosing a file opens a
  **Map Sign-Up CSV Columns** dialog before anything is imported — it shows every
  header and lets you confirm or correct what each one means, since a CSV's column
  order doesn't always match what you'd expect (e.g. it can drift from the live form's
  current question order).
- **Column mapping dialog**: pick the `Name` column (or separate First/Last columns),
  and optionally Phone, Email, Availability (comma-separated day names), and Comments —
  sign-up rows always come in as participants, since leaders are added by hand rather
  than detected from the form. For **Group Rankings**, add each column that represents
  a group choice and drag to set their order — that becomes the board's group order, with no
  auto-sorting layered on it afterward (adjust it later by dragging group cards
  directly on the board). A column's `[Bracket]` text, if present, pre-fills its group
  name; edit it if you want something different. CSV parsing here is quote-aware
  (unlike the Schedule tool's plain comma split), so commas inside a quoted response
  are handled correctly. Re-importing leaves existing (name-matched) groups exactly
  where they are and only appends genuinely new ones; a row whose email matches an
  existing person merges into them (refreshing their comments too) rather than
  duplicating them.
- **Placing people**: drag a leader or participant from a drawer straight into a group
  (no day grid here — groups sit side-by-side since their night was already decided in
  the Schedule tool). Drag a group card by its title bar to reorder it on the board.
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
- **Comments**: an expanded person card has an editable Comments box, imported from the
  sign-up form's free-text question (if present) and editable by hand afterward, with a
  **Dismiss: Comment has been reviewed** checkbox below it — check it off once you've
  read and dealt with what they wrote. It's pre-checked for anyone with no comment, or a
  placeholder value that doesn't carry real information (exact, case-insensitive matches
  for "n/a", "na", "no", "none", "nope", "nope!", "nothing", "not applicable", "no comment",
  "no comments", or a bare "-", with or without a trailing period — a comment that merely
  *contains* one of those isn't affected). Editing the comment, or moving the person to a
  different group or drawer, clears the checkbox again, since either one means the
  comment needs a fresh look.
- **Needs Review**: a badge in a card's bottom-left corner means something about this
  person's placement is worth a second look — applies to leaders too. There are two
  independent reasons it can appear: a red 📅 means they're placed in a group whose
  night isn't among their marked availability (only fires if they have at least one
  availability day checked — no boxes checked means unrestricted, same convention as
  everywhere else); a yellow 💬 means they have a comment that hasn't been dismissed
  yet. If both are true at once, the badge becomes a two-color pill (📅 half red, 💬 half
  yellow) rather than picking just one. Dropping someone on a night they're not
  available for is **allowed, not blocked** — this badge is how you catch and fix it (or
  the comment) afterward.
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

## Data model — Distribute Participants

```jsonc
{
  "version": 1, // bumped only if this shape changes in the future; not currently read back in
  "groups": [
    { "id": "...", "name": "Wednesday Night - Young Adults", "day": "wednesday", "personIds": [], "minimumRequired": 10 }
  ],
  "leaders": [
    { "id": "...", "first": "Jane", "last": "Doe", "phone": "", "email": "jane@example.com", "isLeader": true, "availability": [], "preferences": [], "communityBuilder": false, "comments": "", "commentAddressed": false }
  ],
  "participants": [
    { "id": "...", "first": "John", "last": "Smith", "phone": "", "email": "john@example.com", "isLeader": false, "availability": ["sunday"], "preferences": ["<groupId>", "..."], "communityBuilder": false, "comments": "Needs a ride", "commentAddressed": false }
  ]
}
```

Unlike the Schedule tool, a group's `day` **is** stored directly here — parsed once from
its name (whole-word match against a full day name) at creation or rename time, since
groups aren't dragged onto day columns in this tool the way they are in Schedule.
`preferences` is an ordered list of group ids, most-preferred first. `commentAddressed`
resets to `false` whenever the comment is edited or the person is moved to a different
group/drawer — see "Comments" above.

## Known limitations

- CSV parsing in the Schedule tool (and the Distribute tool's `Name`/`Email`/`Phone`/
  availability columns) is a plain comma split — a comma inside a field will misalign
  columns. The Distribute tool's sign-up importer handles quoted fields, since real
  Google Forms exports commonly quote them.
- No accounts, no backend, no multi-user sync — everything lives in the browser
  (`localStorage` autosave, exported files for anything you want to keep), one project
  open at a time per tool.
