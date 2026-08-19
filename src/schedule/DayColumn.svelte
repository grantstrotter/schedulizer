<script>
  import { dragHandleZone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { DAY_LABELS } from '../lib/constants.js';
  import { GROUP_ZONE_TYPE, PERSON_ZONE_TYPE, realItems } from './dragdrop.js';
  import { project, findGroup, findPerson, setDayGroups, setDayPeople } from './store.js';
  import GroupCard from './GroupCard.svelte';
  import PersonCard from './PersonCard.svelte';

  export let day;

  $: dayData = $project.days[day];
  $: groups = dayData.groupIds.map(id => findGroup($project, id)).filter(Boolean);
  $: people = dayData.personIds.map(id => findPerson($project, id)).filter(Boolean);

  let displayGroups = [];
  let displayPeople = [];
  $: displayGroups = groups;
  $: displayPeople = people;

  // No availability veto — dropping a group or leader on a night that doesn't match is
  // allowed; the "needs review" badge on the affected card is what flags it afterward.
  function handleGroupsConsider(e) {
    displayGroups = e.detail.items;
  }

  function handleGroupsFinalize(e) {
    const proposed = realItems(e.detail.items, SHADOW_ITEM_MARKER_PROPERTY_NAME);
    displayGroups = proposed;
    setDayGroups(day, proposed.map(g => g.id));
  }

  function handlePeopleConsider(e) {
    displayPeople = e.detail.items;
  }

  function handlePeopleFinalize(e) {
    const proposed = realItems(e.detail.items, SHADOW_ITEM_MARKER_PROPERTY_NAME);
    displayPeople = proposed;
    setDayPeople(day, proposed.map(p => p.id));
  }
</script>

<div class="day-column" data-day={day}>
  <h2>{DAY_LABELS[day]}</h2>
  <div class="zone-label">Groups</div>
  <div
    class="groups-list"
    data-container="day-groups"
    data-day={day}
    use:dragHandleZone={{ items: displayGroups, type: GROUP_ZONE_TYPE, flipDurationMs: 150, useCursorForDetection: true }}
    on:consider={handleGroupsConsider}
    on:finalize={handleGroupsFinalize}
  >
    {#each displayGroups as group (`${group.id}${group[SHADOW_ITEM_MARKER_PROPERTY_NAME] ? '_' + group[SHADOW_ITEM_MARKER_PROPERTY_NAME] : ''}`)}
      <GroupCard {group} />
    {/each}
  </div>

  <div class="zone-label">Leaders</div>
  <div
    class="people-list"
    data-container="day-people"
    data-day={day}
    use:dragHandleZone={{ items: displayPeople, type: PERSON_ZONE_TYPE, flipDurationMs: 150, useCursorForDetection: true }}
    on:consider={handlePeopleConsider}
    on:finalize={handlePeopleFinalize}
  >
    {#each displayPeople as person (person.id)}
      <PersonCard {person} />
    {/each}
  </div>
</div>
