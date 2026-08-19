import { DAY_LABELS } from '../lib/constants.js';

export { realItems } from '../lib/dnd.js';

export const GROUP_ZONE_TYPE = 'schedule-group';
export const PERSON_ZONE_TYPE = 'schedule-person';

export function isPersonAllowedOnDay(person, day) {
  return person.availability.length === 0 || person.availability.includes(day);
}

export function personBlockedMessage(person, day) {
  return `${person.first} ${person.last} is not marked available on ${DAY_LABELS[day]}.`;
}

// A group can move onto a day only if every one of its currently-nested leaders is
// available that day (no availability marked at all means unrestricted, same convention
// used everywhere else).
export function isGroupAllowedOnDay(group, day, findPerson, p) {
  return !unavailableLeadersFor(group, day, findPerson, p).length;
}

export function unavailableLeadersFor(group, day, findPerson, p) {
  return group.personIds
    .map(id => findPerson(p, id))
    .filter(person => person && person.availability.length > 0 && !person.availability.includes(day));
}

export function groupBlockedMessage(unavailableLeaders, day) {
  const names = unavailableLeaders.map(person => `${person.first} ${person.last}`.trim()).join(', ');
  return `${names} ${unavailableLeaders.length === 1 ? 'is' : 'are'} not marked available on ${DAY_LABELS[day]}.`;
}
