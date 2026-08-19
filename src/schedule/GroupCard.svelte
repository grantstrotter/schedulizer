<script>
  import { tick } from 'svelte';
  import { sortable } from '../lib/sortable.js';
  import { boardSortableOptions } from './dragdrop.js';
  import { deleteGroup, renameGroup, findPerson } from './store.js';
  import { project } from './store.js';
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

  $: people = group.personIds.map(id => findPerson($project, id)).filter(Boolean);
</script>

<div class="group-card" data-group-id={group.id} data-type="group">
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

  <div
    class="people-list"
    data-container="group-people"
    data-group-id={group.id}
    use:sortable={boardSortableOptions(false)}
  >
    {#each people as person (person.id)}
      <PersonCard {person} />
    {/each}
  </div>
</div>
