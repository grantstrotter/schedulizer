<script>
  import { tick } from 'svelte';
  import { dragHandle, dragHandleZone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { showDragBlockToast, clearDragBlockToast } from '../lib/toast.js';
  import { PERSON_ZONE_TYPE, isPersonAllowedOnDay, personBlockedMessage, realItems } from './dragdrop.js';
  import { deleteGroup, renameGroup, findPerson, findGroupDay, setGroupPeople } from './store.js';
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
  $: currentDay = findGroupDay($project, group.id);

  let displayPeople = [];
  $: displayPeople = people;

  // Same availability rule as the day's own people-list — a leader nested under a group
  // is still scheduled on whatever day the group itself currently sits on (if any).
  function handleConsider(e) {
    const proposed = e.detail.items;
    const incoming = realItems(proposed, SHADOW_ITEM_MARKER_PROPERTY_NAME).find(p => !displayPeople.some(x => x.id === p.id));
    if (incoming && currentDay && !isPersonAllowedOnDay(incoming, currentDay)) {
      showDragBlockToast(`person:${incoming.id}:${currentDay}`, personBlockedMessage(incoming, currentDay));
      return;
    }
    clearDragBlockToast();
    displayPeople = proposed;
  }

  function handleFinalize(e) {
    const proposed = realItems(e.detail.items, SHADOW_ITEM_MARKER_PROPERTY_NAME);
    const incoming = proposed.find(p => !people.some(x => x.id === p.id));
    if (incoming && currentDay && !isPersonAllowedOnDay(incoming, currentDay)) {
      showDragBlockToast(`person:${incoming.id}:${currentDay}`, personBlockedMessage(incoming, currentDay));
      displayPeople = people;
      return;
    }
    clearDragBlockToast();
    displayPeople = proposed;
    setGroupPeople(group.id, proposed.map(p => p.id));
  }
</script>

<div
  class="group-card"
  data-group-id={group.id}
  data-type="group"
  data-is-dnd-shadow-item-hint={group[SHADOW_ITEM_MARKER_PROPERTY_NAME]}
>
  <div class="card-row" use:dragHandle aria-label="Drag to move {group.name || 'group'}">
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
