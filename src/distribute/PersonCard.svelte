<script>
  import { dragHandle } from 'svelte-dnd-action';
  import { DAYS, DAY_ABBR } from '../lib/constants.js';
  import {
    project, highlightGroupId, findGroup, getPersonGroup, matchInfo, needsAvailabilityReview,
    isMeaningfulComment, deletePerson, updatePersonField, updateComments, setCommentAddressed,
    togglePersonAvailability, toggleLeader, toggleCommunityBuilder, togglePinned, setGroupRank, MATCH_TIER_COUNT
  } from './store.js';

  export let person;

  $: currentGroup = getPersonGroup($project, person.id);
  $: match = currentGroup ? matchInfo(person, currentGroup) : null;
  $: needsAvailability = needsAvailabilityReview(person, currentGroup);
  $: hasComment = isMeaningfulComment(person.comments);
  $: needsCommentReview = hasComment && !person.commentAddressed;
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
    {#if person.pinned}<span class="pin-emoji" title="Pinned — auto-assign will skip this person">📌</span>{/if}
    {#if match}
      <span
        class="match-badge match-{match.tier}"
        title={match.tier === 'unranked' ? 'Not on this person’s preference list' : `Rank ${match.label} choice`}
      >{match.label}</span>
    {/if}
    {#if needsAvailability && needsCommentReview}
      <span class="needs-review-badge needs-review-badge--combo" title="Needs review"
        ><span class="needs-review-half needs-review-half--availability" title="Needs review: Outside of stated availability">📅</span
        ><span class="needs-review-half needs-review-half--comment" title="Needs review: Comment not dismissed">💬</span
      ></span>
    {:else if needsAvailability}
      <span class="needs-review-badge" title="Needs review: Outside of stated availability">📅</span>
    {:else if needsCommentReview}
      <span class="needs-review-badge needs-review-badge--comment" title="Needs review: Comment not dismissed">💬</span>
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

    <hr class="detail-divider" />

    <label class="contact-line leader-toggle">
      <input type="checkbox" checked={person.isLeader} on:change={(e) => toggleLeader(person.id, e.target.checked)} />
      Leader
    </label>

    <label class="contact-line leader-toggle">
      <input type="checkbox" checked={person.communityBuilder} on:change={(e) => toggleCommunityBuilder(person.id, e.target.checked)} />
      Community Builder
    </label>

    {#if !person.isLeader}
      <label class="contact-line leader-toggle">
        <input type="checkbox" checked={person.pinned} on:change={(e) => togglePinned(person.id, e.target.checked)} />
        Pinned (auto-assign will skip this person)
      </label>
    {/if}

    <hr class="detail-divider" />

    <div class="contact-line">Available:</div>
    <div class="availability-grid">
      {#each DAYS as day}
        <label>
          <input type="checkbox" checked={person.availability.includes(day)} on:change={() => togglePersonAvailability(person.id, day)} />
          {DAY_ABBR[day]}
        </label>
      {/each}
    </div>

    {#if $project.groups.length > 0}
      <hr class="detail-divider" />
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

    <hr class="detail-divider" />

    <div class="contact-line">Comments:</div>
    <textarea
      class="inline-input comments-field"
      rows="4"
      value={person.comments}
      on:input={(e) => updateComments(person.id, e.target.value)}
    ></textarea>
    <label class="contact-line leader-toggle">
      <input
        type="checkbox"
        checked={!hasComment || person.commentAddressed}
        on:change={(e) => setCommentAddressed(person.id, e.target.checked)}
      />
      Dismiss: Comment has been reviewed
    </label>
  </div>
</details>
