<script>
  import { tick } from 'svelte';
  import { dragHandle, dragHandleZone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { DAY_LABELS } from '../lib/constants.js';
  import { PERSON_ZONE_TYPE, realItems } from './dragdrop.js';
  import { project, highlightGroupId, findPerson, deleteGroup, renameGroup, updateGroupMinimum, setGroupMembership } from './store.js';
  import PersonCard from './PersonCard.svelte';

  export let group;

  let editing = false;
  let draftName = group.name;
  let inputEl;

  async function startEdit() {
    draftName = group.name;
    editing = true;
    await tick();
    inputEl?.focus();
    inputEl?.select();
  }

  function commit() {
    renameGroup(group.id, draftName);
    editing = false;
  }

  function cancel() {
    draftName = group.name;
    editing = false;
  }

  function handleMinChange(e) {
    updateGroupMinimum(group.id, parseInt(e.target.value, 10));
  }

  function toggleHighlight() {
    highlightGroupId.update(id => id === group.id ? null : group.id);
  }

  $: people = group.personIds.map(id => findPerson($project, id)).filter(Boolean);
  $: isHighlighting = $highlightGroupId === group.id;

  // svelte-dnd-action owns this array during a drag (via consider); the store is
  // resynced into it reactively otherwise. `people` above stays the source of truth.
  let displayPeople = [];
  $: displayPeople = people;

  // No availability veto here — dropping someone on a group whose night doesn't match
  // their stated availability is allowed; the "needs review" badge on their card is what
  // flags it for a second look afterward, rather than blocking the move outright.
  function handleConsider(e) {
    displayPeople = e.detail.items;
  }

  function handleFinalize(e) {
    const proposed = realItems(e.detail.items, SHADOW_ITEM_MARKER_PROPERTY_NAME);
    displayPeople = proposed;
    setGroupMembership(group.id, proposed.map(p => p.id));
  }
</script>

<div
  class="group-card board-group-card {isHighlighting ? 'group-card--highlighting' : ''}"
  data-group-id={group.id}
  data-type="group"
  data-is-dnd-shadow-item-hint={group[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
>
  <div class="card-row" use:dragHandle aria-label="Drag to reorder {group.name || 'group'}">
    {#if editing}
      <input
        bind:this={inputEl}
        class="inline-input group-name"
        type="text"
        bind:value={draftName}
        on:mousedown|stopPropagation
        on:touchstart|stopPropagation
        on:blur={commit}
        on:keydown={(e) => {
          if (e.key === 'Enter') inputEl.blur();
          if (e.key === 'Escape') cancel();
        }}
      />
    {:else}
      <span class="group-name">{group.name || '(unnamed group)'}</span>
    {/if}
    <button class="icon-btn group-edit-btn" title="Rename group" on:mousedown|stopPropagation on:touchstart|stopPropagation on:click|preventDefault={startEdit}>✎</button>
    <button class="icon-btn" title="Delete group" on:mousedown|stopPropagation on:touchstart|stopPropagation on:click|preventDefault={() => deleteGroup(group.id, group.name)}>✕</button>
  </div>

  <div class="group-count {people.length < group.minimumRequired ? 'under-min' : ''}">
    {people.length} /
    <input class="min-input" type="number" min="0" title="Minimum required" value={group.minimumRequired} on:change={handleMinChange} />
    {#if group.day}&nbsp;· {DAY_LABELS[group.day]}{/if}
  </div>

  <button class="group-highlight-btn {isHighlighting ? 'active' : ''}" title="Show people outside this group who ranked it" on:click|preventDefault={toggleHighlight}>
    {isHighlighting ? 'Stop Highlighting' : 'Highlight Candidates'}
  </button>

  <div
    class="people-list"
    data-container="group-people"
    data-group-id={group.id}
    use:dragHandleZone={{ items: displayPeople, type: PERSON_ZONE_TYPE, flipDurationMs: 150, useCursorForDetection: true }}
    on:consider={handleConsider}
    on:finalize={handleFinalize}
  >
    {#each displayPeople as person (person.id)}
      <PersonCard {person} />
    {/each}
  </div>
</div>
