<script>
  import { tick } from 'svelte';
  import { sortable } from '../lib/sortable.js';
  import { DAY_LABELS } from '../lib/constants.js';
  import { personSortableOptions } from './dragdrop.js';
  import { project, highlightGroupId, findPerson, deleteGroup, renameGroup, updateGroupMinimum } from './store.js';
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
</script>

<div class="group-card board-group-card {isHighlighting ? 'group-card--highlighting' : ''}" data-group-id={group.id} data-type="group">
  <div class="card-row">
    {#if editing}
      <input
        bind:this={inputEl}
        class="inline-input group-name"
        type="text"
        bind:value={draftName}
        on:blur={commit}
        on:keydown={(e) => {
          if (e.key === 'Enter') inputEl.blur();
          if (e.key === 'Escape') cancel();
        }}
      />
    {:else}
      <span class="group-name">{group.name || '(unnamed group)'}</span>
    {/if}
    <button class="icon-btn group-edit-btn" title="Rename group" on:click|preventDefault={startEdit}>✎</button>
    <button class="icon-btn" title="Delete group" on:click|preventDefault={() => deleteGroup(group.id, group.name)}>✕</button>
  </div>

  <div class="group-count {people.length < group.minimumRequired ? 'under-min' : ''}">
    {people.length} /
    <input class="min-input" type="number" min="0" title="Minimum required" value={group.minimumRequired} on:change={handleMinChange} />
    {#if group.day}&nbsp;· {DAY_LABELS[group.day]}{/if}
  </div>

  <button class="group-highlight-btn {isHighlighting ? 'active' : ''}" title="Show people outside this group who ranked it" on:click|preventDefault={toggleHighlight}>
    {isHighlighting ? 'Stop Highlighting' : 'Highlight Candidates'}
  </button>

  <div class="people-list" data-container="group-people" data-group-id={group.id} use:sortable={personSortableOptions()}>
    {#each people as person (person.id)}
      <PersonCard {person} />
    {/each}
  </div>
</div>
