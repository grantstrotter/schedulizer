<script>
  import { dragHandleZone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
  import { DAY_LABELS } from '../lib/constants.js';
  import { showDragBlockToast, clearDragBlockToast } from '../lib/toast.js';
  import {
    GROUP_ZONE_TYPE, PERSON_ZONE_TYPE, realItems,
    isPersonAllowedOnDay, personBlockedMessage,
    isGroupAllowedOnDay, unavailableLeadersFor, groupBlockedMessage
  } from './dragdrop.js';
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

  function handleGroupsConsider(e) {
    const proposed = e.detail.items;
    const incoming = realItems(proposed, SHADOW_ITEM_MARKER_PROPERTY_NAME).find(g => !displayGroups.some(x => x.id === g.id));
    if (incoming) {
      const unavailable = unavailableLeadersFor(incoming, day, findPerson, $project);
      if (unavailable.length) {
        showDragBlockToast(`group:${incoming.id}:${day}`, groupBlockedMessage(unavailable, day));
        return;
      }
    }
    clearDragBlockToast();
    displayGroups = proposed;
  }

  function handleGroupsFinalize(e) {
    const proposed = realItems(e.detail.items, SHADOW_ITEM_MARKER_PROPERTY_NAME);
    const incoming = proposed.find(g => !groups.some(x => x.id === g.id));
    if (incoming && !isGroupAllowedOnDay(incoming, day, findPerson, $project)) {
      const unavailable = unavailableLeadersFor(incoming, day, findPerson, $project);
      showDragBlockToast(`group:${incoming.id}:${day}`, groupBlockedMessage(unavailable, day));
      displayGroups = groups;
      return;
    }
    clearDragBlockToast();
    displayGroups = proposed;
    setDayGroups(day, proposed.map(g => g.id));
  }

  function handlePeopleConsider(e) {
    const proposed = e.detail.items;
    const incoming = realItems(proposed, SHADOW_ITEM_MARKER_PROPERTY_NAME).find(p => !displayPeople.some(x => x.id === p.id));
    if (incoming && !isPersonAllowedOnDay(incoming, day)) {
      showDragBlockToast(`person:${incoming.id}:${day}`, personBlockedMessage(incoming, day));
      return;
    }
    clearDragBlockToast();
    displayPeople = proposed;
  }

  function handlePeopleFinalize(e) {
    const proposed = realItems(e.detail.items, SHADOW_ITEM_MARKER_PROPERTY_NAME);
    const incoming = proposed.find(p => !people.some(x => x.id === p.id));
    if (incoming && !isPersonAllowedOnDay(incoming, day)) {
      showDragBlockToast(`person:${incoming.id}:${day}`, personBlockedMessage(incoming, day));
      displayPeople = people;
      return;
    }
    clearDragBlockToast();
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
