<script>
  import { onMount } from 'svelte';
  import { tick } from 'svelte';
  import { dragHandleZone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { DAYS } from '../lib/constants.js';
  import { wirePersonExpandToggle } from '../lib/expandToggle.js';
  import Toast from '../lib/Toast.svelte';
  import EmptyState from '../lib/EmptyState.svelte';
  import HelpModal from '../lib/HelpModal.svelte';
  import DayColumn from './DayColumn.svelte';
  import GroupCard from './GroupCard.svelte';
  import PersonCard from './PersonCard.svelte';
  import { GROUP_ZONE_TYPE, PERSON_ZONE_TYPE, realItems } from './dragdrop.js';
  import {
    project, started, isGroupPlaced, isPersonPlaced,
    newProject, importJSONFile, importCSVFile, tryResumeAutosave,
    addGroup, addLeader, exportJSON, exportCSV,
    setDrawerGroups, setDrawerLeaders
  } from './store.js';

  let helpOpen = false;
  let fileOpenInput;
  let fileImportCsvInput;

  onMount(() => {
    wirePersonExpandToggle();
    tryResumeAutosave();
  });

  function handleKeydown(e) {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 's') return;
    e.preventDefault();
    if ($project) exportJSON();
  }

  async function handleAddGroup() {
    const id = addGroup();
    await tick();
    document.querySelector(`.group-card[data-group-id="${id}"] .group-edit-btn`)?.click();
  }

  async function focusNewPerson(id) {
    await tick();
    const card = document.querySelector(`.person-card[data-person-id="${id}"]`);
    if (!card) return;
    card.open = true;
    card.querySelector('input[placeholder="First name"]')?.focus();
  }

  async function handleAddLeader() {
    const id = addLeader();
    await focusNewPerson(id);
  }

  $: unplacedGroups = $project ? $project.groups.filter(g => !isGroupPlaced($project, g.id)) : [];
  $: unplacedLeaders = $project ? $project.leaders.filter(p => !isPersonPlaced($project, p.id)) : [];

  // Drawers always accept unconditionally — no availability rule ever blocks unscheduling
  // a group or leader back to its drawer.
  let displayGroups = [];
  let displayLeaders = [];
  $: displayGroups = unplacedGroups;
  $: displayLeaders = unplacedLeaders;

  function handleGroupsConsider(e) {
    displayGroups = e.detail.items;
  }
  function handleGroupsFinalize(e) {
    const proposed = realItems(e.detail.items, SHADOW_ITEM_MARKER_PROPERTY_NAME);
    displayGroups = proposed;
    setDrawerGroups(proposed.map(g => g.id));
  }
  function handleLeadersConsider(e) {
    displayLeaders = e.detail.items;
  }
  function handleLeadersFinalize(e) {
    const proposed = realItems(e.detail.items, SHADOW_ITEM_MARKER_PROPERTY_NAME);
    displayLeaders = proposed;
    setDrawerLeaders(proposed.map(p => p.id));
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if !$started}
  <EmptyState
    toolTag="Schedule"
    on:newproject={() => newProject(false)}
    on:openfile={(e) => importJSONFile(e.detail)}
    on:help={() => (helpOpen = true)}
  />
{:else}
  <div id="app">
    <header class="toolbar">
      <strong class="app-title">Schedulizer <span class="tool-tag">Schedule</span></strong>
      <button on:click={() => newProject(true)}>New Project</button>
      <button on:click={() => fileOpenInput.click()}>Open&hellip;</button>
      <button on:click={() => fileImportCsvInput.click()}>Import People (CSV)&hellip;</button>
      <button on:click={() => (helpOpen = true)}>Help</button>
      <span class="spacer"></span>
      <button on:click={exportJSON}>Save</button>
      <button on:click={exportCSV}>Export CSV</button>
      <a href="index.html" class="tool-switch-link">&larr; Home</a>
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
      <input
        type="file"
        bind:this={fileImportCsvInput}
        accept="text/csv,.csv"
        hidden
        on:change={(e) => { if (e.target.files[0]) importCSVFile(e.target.files[0]); e.target.value = ''; }}
      />
    </header>

    <main class="days-row">
      {#each DAYS as day}
        <DayColumn {day} />
      {/each}
    </main>

    <section class="drawers">
      <details class="drawer" open>
        <summary>
          Groups <span class="count">({unplacedGroups.length})</span>
          <button class="drawer-add-btn" on:click|preventDefault={handleAddGroup}>+ Add Group</button>
        </summary>
        <div
          class="drawer-list"
          id="drawer-groups"
          data-container="groups-drawer"
          use:dragHandleZone={{ items: displayGroups, type: GROUP_ZONE_TYPE, flipDurationMs: 150, useCursorForDetection: true }}
          on:consider={handleGroupsConsider}
          on:finalize={handleGroupsFinalize}
        >
          {#each displayGroups as group (`${group.id}${group[SHADOW_ITEM_MARKER_PROPERTY_NAME] ? '_' + group[SHADOW_ITEM_MARKER_PROPERTY_NAME] : ''}`)}
            <GroupCard {group} />
          {/each}
        </div>
      </details>
      <details class="drawer" open>
        <summary>
          Leaders 🎯 <span class="count">({unplacedLeaders.length})</span>
          <button class="drawer-add-btn" on:click|preventDefault={handleAddLeader}>+ Add Leader</button>
        </summary>
        <div
          class="drawer-list"
          id="drawer-leaders"
          data-container="people-drawer"
          data-day="drawer"
          use:dragHandleZone={{ items: displayLeaders, type: PERSON_ZONE_TYPE, flipDurationMs: 150, useCursorForDetection: true }}
          on:consider={handleLeadersConsider}
          on:finalize={handleLeadersFinalize}
        >
          {#each displayLeaders as person (person.id)}
            <PersonCard {person} />
          {/each}
        </div>
      </details>
    </section>
  </div>
{/if}

<HelpModal bind:open={helpOpen} title="Schedulizer Guide">
  <h3>Getting started</h3>
  <p>Start a new project, open a saved <code>.json</code> file, or drag one onto the
    opening screen. Your work auto-saves in this browser as you go, but that's just a
    safety net for refreshes — use <strong>Save</strong> (or <kbd>Cmd/Ctrl+S</kbd>) to
    actually export a <code>.json</code> file you can keep or reopen later.</p>

  <h3>Days</h3>
  <p>Seven columns across the top, one per day, each with a <strong>Groups</strong>
    section and a <strong>Leaders</strong> section — drop a group in the Groups section
    and a leader in the Leaders section.</p>

  <h3>Groups</h3>
  <p><strong>+ Add Group</strong> creates one in the Groups drawer below the days.
    Click the ✎ icon to rename it, drag it by its title bar onto any day to schedule
    it there, and drag it back to the drawer to unschedule it.</p>

  <h3>Leaders</h3>
  <p>This tool is just about deciding which nights groups run, based on who's leading
    them — it doesn't track participants at all (that's what the Distribute tool is
    for). Bring leaders in with <strong>Import People (CSV)</strong>
    (columns: <code>first,last,phone,email,isLeader,availability</code> — rows where
    <code>isLeader</code> isn't true are skipped; availability is optional, a
    <code>|</code>-separated list of days like <code>sunday|thursday</code> or
    <code>Sun|Thu</code>) or add them one at a time with <strong>+ Add Leader</strong>.
    Click a leader's name to expand their card and fill in contact info. Drag their
    title bar onto a day, or straight into a group to nest them under it.</p>

  <h3>Availability</h3>
  <p>Inside an expanded leader card, check the nights they're available. A leader with
    no boxes checked is treated as available every night. Dropping someone (or a group,
    based on its leaders) on a night they're not available is still allowed — a
    <strong>📅</strong> badge shows up on the person's card, or the group's card if the
    mismatch is one of its nested leaders, so it's easy to catch and fix afterward.</p>

  <h3>Exporting</h3>
  <p><strong>Save</strong> downloads the full project as JSON (reopen it anytime).
    <strong>Export CSV</strong> downloads a flattened, spreadsheet-friendly view of the
    schedule — one row per assigned person, plus a trailing block of anyone still
    unassigned.</p>
</HelpModal>

<Toast />
