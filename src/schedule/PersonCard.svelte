<script>
  import { dragHandle } from 'svelte-dnd-action';
  import { DAYS, DAY_ABBR } from '../lib/constants.js';
  import { project, findPersonDay, deletePerson, updatePersonField, togglePersonAvailability } from './store.js';

  export let person;

  $: fullName = `${person.first} ${person.last}`.trim() || '(unnamed)';

  // Flags this card when the day they're currently scheduled on (directly, or via
  // whatever group they're nested under) doesn't match their stated availability — no
  // longer blocks placement, just surfaces it for review.
  $: currentDay = findPersonDay($project, person.id);
  $: needsReview = !!(currentDay && person.availability.length > 0 && !person.availability.includes(currentDay));
</script>

<details class="person-card" data-person-id={person.id} data-type="person">
  <summary use:dragHandle aria-label="Drag to move {fullName}">
    <span class="drag-handle">⠿ </span>
    <span class="person-name">{fullName}</span>
    {#if needsReview}
      <span class="needs-review-badge" title="Needs review: Outside of stated availability">📅</span>
    {/if}
    <button
      class="icon-btn"
      title="Delete person"
      on:mousedown|stopPropagation
      on:touchstart|stopPropagation
      on:click|preventDefault={() => deletePerson(person.id, fullName)}
    >✕</button>
  </summary>

  <div class="person-detail">
    <div class="card-row">
      <input
        class="inline-input person-field"
        type="text"
        placeholder="First name"
        value={person.first}
        on:input={(e) => updatePersonField(person.id, 'first', e.target.value)}
      />
      <input
        class="inline-input person-field"
        type="text"
        placeholder="Last name"
        value={person.last}
        on:input={(e) => updatePersonField(person.id, 'last', e.target.value)}
      />
    </div>

    <input
      class="inline-input person-field"
      type="text"
      placeholder="Phone"
      value={person.phone}
      on:input={(e) => updatePersonField(person.id, 'phone', e.target.value)}
    />
    <input
      class="inline-input person-field"
      type="text"
      placeholder="Email"
      value={person.email}
      on:input={(e) => updatePersonField(person.id, 'email', e.target.value)}
    />

    <div class="contact-line">Available:</div>
    <div class="availability-grid">
      {#each DAYS as d}
        <label>
          <input
            type="checkbox"
            checked={person.availability.includes(d)}
            on:change={() => togglePersonAvailability(person.id, d)}
          />
          {DAY_ABBR[d]}
        </label>
      {/each}
    </div>
  </div>
</details>
