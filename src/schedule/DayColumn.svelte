<script>
  import { DAY_LABELS } from '../lib/constants.js';
  import { sortable } from '../lib/sortable.js';
  import { boardSortableOptions } from './dragdrop.js';
  import { project, findGroup, findPerson } from './store.js';
  import GroupCard from './GroupCard.svelte';
  import PersonCard from './PersonCard.svelte';

  export let day;

  $: dayData = $project.days[day];
  $: groups = dayData.groupIds.map(id => findGroup($project, id)).filter(Boolean);
  $: people = dayData.personIds.map(id => findPerson($project, id)).filter(Boolean);
</script>

<div class="day-column" data-day={day}>
  <h2>{DAY_LABELS[day]}</h2>
  <div class="zone-label">Groups</div>
  <div class="groups-list" data-container="day-groups" data-day={day} use:sortable={boardSortableOptions(true)}>
    {#each groups as group (group.id)}
      <GroupCard {group} />
    {/each}
  </div>

  <div class="zone-label">Leaders</div>
  <div class="people-list" data-container="day-people" data-day={day} use:sortable={boardSortableOptions(false)}>
    {#each people as person (person.id)}
      <PersonCard {person} />
    {/each}
  </div>
</div>
