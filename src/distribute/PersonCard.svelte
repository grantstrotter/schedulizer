<script>
  import { dragHandle } from 'svelte-dnd-action';
  import { DAYS, DAY_ABBR } from '../lib/constants.js';
  import {
    project, highlightGroupId, findGroup, getPersonGroup, matchInfo, needsAvailabilityReview,
    deletePerson, updatePersonField, togglePersonAvailability,
    toggleLeader, toggleCommunityBuilder, setGroupRank, MATCH_TIER_COUNT
  } from './store.js';

  export let person;

  $: currentGroup = getPersonGroup($project, person.id);
  $: match = currentGroup ? matchInfo(person, currentGroup) : null;
  $: needsReview = needsAvailabilityReview(person, currentGroup);
  $: fullName = `${person.first} ${person.last}`.trim() || '(unnamed)';

  // Candidate highlighting: when a group's "Highlight Candidates" is active, everyone
  // outside that group (never leaders — they're pre-determined) who ranked it shimmers,
  // colored by the same rank-tier as the match badge, with a number badge alongside.
  $: highlightedGroup = $highlightGroupId ? findGroup($project, $highlightGroupId) : null;
  $: candidateRank = (() => {
    if (!highlightedGroup || person.isLeader) return -1;
    if (currentGroup && currentGroup.id === highlightedGroup.id) return -1;
    return person.preferences.indexOf(highlightedGroup.id);
  })();
  $: candidateTier = candidateRank === -1 ? null : Math.min(candidateRank + 1, MATCH_TIER_COUNT);
</script>

<details class="person-card {candidateTier ? 'candidate-t' + candidateTier : ''}" data-person-id={person.id} data-type="person">
  <summary use:dragHandle aria-label="Drag to move {fullName}">
    <span class="drag-handle">⠿ </span>
    <span class="person-name">{fullName}</span>
    {#if person.isLeader}<span class="leader-emoji">🎯</span>{/if}
    {#if person.communityBuilder}<span class="community-builder-emoji" title="Community Builder">⭐</span>{/if}
    {#if match}
      <span
        class="match-badge match-{match.tier}"
        title={match.tier === 'unranked' ? 'Not on this person’s preference list' : `Rank ${match.label} choice`}
      >{match.label}</span>
    {/if}
    {#if needsReview}
      <span class="needs-review-badge" title="Needs review: Outside of stated availability">?</span>
    {/if}
    <button class="icon-btn" title="Delete person" on:mousedown|stopPropagation on:touchstart|stopPropagation on:click|preventDefault={() => deletePerson(person.id, `${person.first} ${person.last}`.trim())}>✕</button>
    {#if candidateTier}
      <span class="candidate-rank-badge match-t{candidateTier}">{candidateRank + 1}</span>
    {/if}
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

    <label class="contact-line leader-toggle">
      <input type="checkbox" checked={person.isLeader} on:change={(e) => toggleLeader(person.id, e.target.checked)} />
      Leader
    </label>

    <label class="contact-line leader-toggle">
      <input type="checkbox" checked={person.communityBuilder} on:change={(e) => toggleCommunityBuilder(person.id, e.target.checked)} />
      Community Builder
    </label>

    <div class="contact-line">Available:</div>
    <div class="availability-grid">
      {#each DAYS as day}
        <label>
          <input type="checkbox" checked={person.availability.includes(day)} on:change={() => togglePersonAvailability(person.id, day)} />
          {DAY_ABBR[day]}
        </label>
      {/each}
    </div>

    <div class="contact-line">Comments:</div>
    <textarea
      class="inline-input comments-field"
      rows="2"
      placeholder="e.g. can only attend every other week"
      value={person.comments}
      on:input={(e) => updatePersonField(person.id, 'comments', e.target.value)}
    ></textarea>

    {#if $project.groups.length > 0}
      <div class="contact-line preferences-editor">
        <div>Group ranking:</div>
        {#each $project.groups as g (g.id)}
          <div class="preference-row">
            <span class="preference-group-name" title={g.name}>{g.name}</span>
            <select
              class="rank-select"
              value={person.preferences.indexOf(g.id) === -1 ? '' : String(person.preferences.indexOf(g.id) + 1)}
              on:change={(e) => setGroupRank(person.id, g.id, e.target.value ? parseInt(e.target.value, 10) : null)}
            >
              <option value="">—</option>
              {#each Array($project.groups.length) as _, i}
                <option value={String(i + 1)}>{i + 1}</option>
              {/each}
            </select>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</details>
