<script>
  import { onMount, tick } from 'svelte';
  import { dragHandleZone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { wirePersonExpandToggle } from '../lib/expandToggle.js';
  import Toast from '../lib/Toast.svelte';
  import EmptyState from '../lib/EmptyState.svelte';
  import HelpModal from '../lib/HelpModal.svelte';
  import MenuButton from '../lib/MenuButton.svelte';
  import GroupCard from './GroupCard.svelte';
  import PersonCard from './PersonCard.svelte';
  import CsvMappingModal from './CsvMappingModal.svelte';
  import { PERSON_ZONE_TYPE, realItems } from './dragdrop.js';
  import {
    project, started, highlightGroupId, isPersonPlaced, ordinal, maxPreferenceRank,
    newProject, importJSONFile, tryResumeAutosave, readSignupCSVFile,
    addLeader, addParticipant, exportJSON, exportCSV,
    assignFirstChoices, fillUnderMinimumGroupsAtRank, reorderGroups, setDrawerMembership,
    undo, redo, canUndo, canRedo
  } from './store.js';

  let helpOpen = false;
  let mappingLines = null; // non-null while the CSV column-mapping modal is open
  let fileOpenInput;
  let fileImportSignupInput;

  onMount(() => {
    wirePersonExpandToggle();
    tryResumeAutosave();
  });

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      if ($highlightGroupId) highlightGroupId.set(null);
      return;
    }
    const key = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && key === 'z') {
      e.preventDefault();
      if ($project) { if (e.shiftKey) redo(); else undo(); }
      return;
    }
    if (!(e.metaKey || e.ctrlKey) || key !== 's') return;
    e.preventDefault();
    if ($project) exportJSON();
  }

  async function focusNewPerson(id) {
    await tick();
    const card = document.querySelector(`.person-card[data-person-id="${id}"]`);
    if (!card) return;
    card.open = true;
    card.querySelector('input[placeholder="First name"]')?.focus();
  }

  async function handleAddLeader() {
    await focusNewPerson(addLeader());
  }

  async function handleAddParticipant() {
    await focusNewPerson(addParticipant());
  }

  async function handleImportSignup(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const lines = await readSignupCSVFile(file);
    if (lines) mappingLines = lines;
  }

  // svelte-dnd-action owns this local array during a drag (via consider), then we commit
  // the final order back to the store on finalize. $project.groups stays the source of
  // truth otherwise — this mirrors it, it doesn't replace it.
  let displayGroups = [];
  $: if ($project) displayGroups = $project.groups;

  function handleGroupsConsider(e) {
    displayGroups = e.detail.items;
  }

  function handleGroupsFinalize(e) {
    displayGroups = e.detail.items;
    reorderGroups(displayGroups.map(g => g.id));
  }

  $: unplacedLeaders = $project ? $project.leaders.filter(p => !isPersonPlaced($project, p.id)) : [];
  $: unplacedParticipants = $project ? $project.participants.filter(p => !isPersonPlaced($project, p.id)) : [];

  // Drawers always accept any person unconditionally — no availability rule ever blocks
  // going back to a drawer, so unlike GroupCard there's nothing to veto here.
  let displayLeaders = [];
  let displayParticipants = [];
  $: displayLeaders = unplacedLeaders;
  $: displayParticipants = unplacedParticipants;

  function handleLeadersConsider(e) {
    displayLeaders = e.detail.items;
  }
  function handleLeadersFinalize(e) {
    const proposed = realItems(e.detail.items, SHADOW_ITEM_MARKER_PROPERTY_NAME);
    displayLeaders = proposed;
    setDrawerMembership(true, proposed.map(p => p.id));
  }
  function handleParticipantsConsider(e) {
    displayParticipants = e.detail.items;
  }
  function handleParticipantsFinalize(e) {
    const proposed = realItems(e.detail.items, SHADOW_ITEM_MARKER_PROPERTY_NAME);
    displayParticipants = proposed;
    setDrawerMembership(false, proposed.map(p => p.id));
  }

  $: maxRank = $project ? maxPreferenceRank($project) : 0;
  $: highlightedGroupName = $project && $highlightGroupId ? $project.groups.find(g => g.id === $highlightGroupId)?.name : null;
</script>

<svelte:window on:keydown={handleKeydown} />

{#if !$started}
  <EmptyState
    toolTag="Distribute"
    on:newproject={() => newProject(false)}
    on:openfile={(e) => importJSONFile(e.detail)}
    on:help={() => (helpOpen = true)}
  />
{:else}
  <div id="app">
    <div class="sticky-header">
      <header class="toolbar">
        <span class="app-title"><a href="index.html" class="app-title-link">Schedulizer</a> <span class="tool-tag">Distribute</span></span>
        <MenuButton label="File">
          <button on:click={() => newProject(true)}>New Project</button>
          <button on:click={() => fileOpenInput.click()}>Open&hellip;</button>
          <button on:click={exportJSON}>Save As&hellip;</button>
          <button on:click={() => fileImportSignupInput.click()}>Import Sign-Up CSV&hellip;</button>
          <button on:click={exportCSV}>Export CSV&hellip;</button>
        </MenuButton>
        <MenuButton label="Edit">
          <button on:click={undo} disabled={!$canUndo} title="Undo (Cmd/Ctrl+Z)">&larr; Undo</button>
          <button on:click={redo} disabled={!$canRedo} title="Redo (Cmd/Ctrl+Shift+Z)">&rarr; Redo</button>
          <MenuButton label="Auto-Assign">
            <button on:click={() => assignFirstChoices()}>Place 1st Choices</button>
            {#each Array(Math.max(0, maxRank - 1)) as _, i}
              <button on:click={() => fillUnderMinimumGroupsAtRank(i + 2)}>Fill Under-Minimum: {ordinal(i + 2)} Choices</button>
            {/each}
          </MenuButton>
        </MenuButton>
        <button on:click={() => (helpOpen = true)}>Help</button>
        <span class="spacer"></span>
        <input
          type="file"
          bind:this={fileOpenInput}
          accept="application/json,.json"
          hidden
          on:change={(e) => {
            if (e.target.files[0] && confirm('Open this file? It will replace the current project.')) importJSONFile(e.target.files[0]);
            e.target.value = '';
          }}
        />
        <input type="file" bind:this={fileImportSignupInput} accept="text/csv,.csv" hidden on:change={handleImportSignup} />
      </header>

      {#if $highlightGroupId}
        <div class="highlight-banner">
          <span>Highlighting candidates for "{highlightedGroupName}"</span>
          <button on:click={() => highlightGroupId.set(null)}>Stop Highlighting</button>
        </div>
      {/if}
    </div>

    {#if $project.groups.length === 0}
      <div class="groups-board"><div class="board-empty-hint">No groups yet — click "Import Sign-Up CSV…" above to derive groups from your sign-up form (or open a project file that already has them).</div></div>
    {:else}
      <main
        class="groups-board"
        id="groups-board"
        use:dragHandleZone={{ items: displayGroups, flipDurationMs: 150, useCursorForDetection: true }}
        on:consider={handleGroupsConsider}
        on:finalize={handleGroupsFinalize}
      >
        {#each displayGroups as group (`${group.id}${group[SHADOW_ITEM_MARKER_PROPERTY_NAME] ? '_' + group[SHADOW_ITEM_MARKER_PROPERTY_NAME] : ''}`)}
          <GroupCard {group} />
        {/each}
      </main>
    {/if}

    <section class="drawers" id="drawers">
      <details class="drawer" open>
        <summary>
          Leaders 🎯 <span class="count">({unplacedLeaders.length})</span>
          <button class="drawer-add-btn" on:click|preventDefault={handleAddLeader}>+ Add Leader</button>
        </summary>
        <div
          class="drawer-list"
          id="drawer-leaders"
          data-container="people-drawer"
          use:dragHandleZone={{ items: displayLeaders, type: PERSON_ZONE_TYPE, flipDurationMs: 150, useCursorForDetection: true }}
          on:consider={handleLeadersConsider}
          on:finalize={handleLeadersFinalize}
        >
          {#each displayLeaders as person (person.id)}
            <PersonCard {person} />
          {/each}
        </div>
      </details>
      <details class="drawer" open>
        <summary>
          Unassigned Participants <span class="count">({unplacedParticipants.length})</span>
          <button class="drawer-add-btn" on:click|preventDefault={handleAddParticipant}>+ Add Participant</button>
        </summary>
        <div
          class="drawer-list"
          id="drawer-participants"
          data-container="people-drawer"
          use:dragHandleZone={{ items: displayParticipants, type: PERSON_ZONE_TYPE, flipDurationMs: 150, useCursorForDetection: true }}
          on:consider={handleParticipantsConsider}
          on:finalize={handleParticipantsFinalize}
        >
          {#each displayParticipants as person (person.id)}
            <PersonCard {person} />
          {/each}
        </div>
      </details>
    </section>
  </div>
{/if}

{#if mappingLines}
  <CsvMappingModal lines={mappingLines} on:close={() => (mappingLines = null)} />
{/if}

<HelpModal bind:open={helpOpen} title="Schedulizer Distribute Guide">
  <h3>What this tool is for</h3>
  <p>Once you've decided which nights your groups run (using the
    <a href="schedule.html">Schedule tool</a>), use this page to place participants into
    those groups based on their ranked preferences from a sign-up form.</p>

  <h3>Getting started</h3>
  <p>Start a new project, open a saved <code>.json</code> file, or import a sign-up CSV
    exported from Google Forms — that import creates your groups automatically, one per
    group column in the form (all under the <strong>File</strong> menu). Your work
    auto-saves in this browser as a safety net, but use <strong>Save As&hellip;</strong>
    (also in <strong>File</strong>, or <kbd>Cmd/Ctrl+S</kbd>) to export a
    <code>.json</code> file you can keep or reopen later.</p>

  <h3>Undo / Redo</h3>
  <p>Every change that affects saved data — moving people or groups, editing a field,
    importing a sign-up CSV, auto-assigning — can be undone with <strong>Edit &rarr;
    Undo</strong> (or <kbd>Cmd/Ctrl+Z</kbd>) and reapplied with <strong>Edit &rarr;
    Redo</strong> (or <kbd>Cmd/Ctrl+Shift+Z</kbd>). Typing in a field groups into
    a single undo step rather than one per keystroke. Highlighting candidates isn't
    tracked, since it doesn't change any saved data. Starting a new project or opening a
    different file clears this history — you can't undo back into a document you've
    left.</p>

  <h3>Importing a sign-up CSV</h3>
  <p>Built specifically for a Google Forms <strong>Multiple-choice grid</strong> question,
    with each group as a grid <em>row</em> and choices labeled <code>1st Choice</code>,
    <code>2nd Choice</code>, etc. as grid <em>columns</em> — not Forms' separate dedicated
    "Ranking" question type, which exports differently and won't parse here. Export
    responses as CSV and choose the file — before anything is imported, a
    <strong>Map Sign-Up CSV Columns</strong> dialog shows every header and lets you
    confirm or correct what each one means, since a CSV's column order doesn't always
    match what you'd expect (e.g. it can drift from the live form's current question
    order).</p>
  <p>In that dialog: pick the <strong>Name</strong> column (or separate First/Last
    columns), and optionally Phone, Email, Availability (comma-separated day names), and
    Comments — sign-up rows always come in as participants, since leaders are added by
    hand rather than detected from the form. Then, for <strong>Group Rankings</strong>,
    add each column that represents a group choice and drag to set their order — that
    order becomes the
    board's group order going forward, with no further auto-sorting layered on it (you
    can always adjust it later by dragging group cards directly on the board). A column's
    <code>[Bracket]</code> text, if present, pre-fills its group name; edit it if you
    want something different. Re-importing leaves existing (name-matched) groups exactly
    where they are and only appends genuinely new ones; a row whose email matches an
    existing person (leader or participant) merges into them instead of creating a
    duplicate, refreshing their comments too.</p>

  <h3>Groups</h3>
  <p>Groups sit side-by-side on the board — there's no day grid here, since a group's
    night was already decided elsewhere. Each group card shows how many people are in it
    against its minimum — click the number to edit it (defaults to 10 for newly-imported
    groups). Drag participants and leaders directly into a group, or back out to the
    drawers. Drag a group card by its title bar to reorder it relative to the others —
    the board just shows groups in whatever order they're stored in, so this is how you
    adjust it after import.</p>

  <h3>Preference match</h3>
  <p>Each participant shows a colored number badge next to their name — their current
    group's rank in their preferences: blue for a great match (1st choice), shading
    through green, yellow, and orange down to red for a poor one (5th choice or worse). A
    dark red <strong>!</strong> badge means they're in a group they didn't rank at all (a
    likely problem worth a second look). It recomputes live as you move people between
    groups.</p>

  <h3>Editing preferences by hand</h3>
  <p>Expand any person's card (once at least one group exists) to see a
    <strong>Group ranking</strong> section — a dropdown per group where you can set or
    change their rank directly (or clear it back to <strong>—</strong> for not ranked).
    This works for leaders too, since they usually don't come from the sign-up CSV but
    may still have real preferences worth recording.</p>

  <h3>Placing by preference</h3>
  <p>The <strong>Edit &rarr; Auto-Assign</strong> submenu runs one placement step
    at a time, so you can check the board between steps. <strong>Place 1st Choices</strong> puts
    everyone still unassigned into their 1st choice group, unconditionally. Each
    <strong>Fill Under-Minimum: Nth Choices</strong> step then pulls people whose Nth
    choice is an under-filled group in from whichever other group currently has more
    people — it prioritizes evening out group sizes overall, so a group already sitting
    at its own minimum can still donate to one far below its minimum, as long as doing
    so doesn't leave the donor smaller than the group it just helped. It keeps working
    until nothing more can be evened out at this rank, so one click reaches a stable
    result — re-running the same step again immediately finds nothing left to do. Run
    2nd, then 3rd, and so on as needed. Leaders are never moved by these steps — they're
    placed by hand and stay put. Anything still under-filled afterward is left for you
    to adjust.</p>

  <h3>Highlighting candidates</h3>
  <p>Each group card has a <strong>Highlight Candidates</strong> button — click it to
    shimmer everyone outside that group (in another group, or still unplaced) who ranked
    it, colored by the same rank-badge colors so you can see at a glance how good a match
    they'd be if dragged in — a small number badge in the corner shows the exact rank too,
    so you're not relying on the color alone. Leaders never shimmer, since they're
    pre-determined. Only one group highlights at a time; a banner at the top shows which
    one, with its own <strong>Stop Highlighting</strong> button — clicking the group's
    button again, or pressing <kbd>Esc</kbd>, also turns it off.</p>

  <h3>Leader ⇄ Participant</h3>
  <p>Toggle the <strong>Leader</strong> checkbox on an expanded person card to flip their
    role, same as the scheduling tool.</p>

  <h3>Community Builder</h3>
  <p>The <strong>Community Builder</strong> checkbox, right below Leader, is a manual
    staff-only flag for people especially effective at building community — it always
    starts unchecked and is never set by the sign-up import, only by hand. When checked,
    their name shows a ⭐ badge next to it.</p>

  <h3>Comments</h3>
  <p>An expanded person card has an editable <strong>Comments</strong> box, below their
    availability — imported from the sign-up form's free-text question (if present) and
    editable by hand afterward, with a <strong>Dismiss: Comment has been reviewed</strong>
    checkbox right below it — check it off once you've read and dealt with what they
    wrote. It's pre-checked for anyone with no comment (or a placeholder like "N/A" or
    "None" — those don't count as real comments). Editing the comment, or
    moving the person to a different group or drawer, clears that checkbox again, since
    either one means the comment needs a fresh look.</p>

  <h3>Needs Review</h3>
  <p>A badge in a card's bottom-left corner means something about this person's
    placement is worth a second look — applies to leaders too. There are two independent
    reasons it can appear: a red <strong>📅</strong> means they're placed in a group
    whose night isn't among their marked availability (only fires if they have at least
    one availability day checked — no boxes checked means unrestricted, same as
    everywhere else); a yellow <strong>💬</strong> means they have a comment that hasn't
    been dismissed yet. If both are true at once, the badge becomes a two-color
    pill showing both rather than picking just one. Dropping someone
    on a night they're not available for is allowed, not blocked — this badge is how you
    catch and fix it (or the comment) afterward.</p>

  <h3>Exporting</h3>
  <p>Both live in the <strong>File</strong> menu: <strong>Save As&hellip;</strong>
    downloads the full project as JSON, <strong>Export CSV&hellip;</strong> downloads one row
    per person with their group, name, phone, email, and leader flag.</p>
</HelpModal>

<Toast />
