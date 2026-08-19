export { realItems } from '../lib/dnd.js';

export const GROUP_ZONE_TYPE = 'schedule-group';
export const PERSON_ZONE_TYPE = 'schedule-person';

// A leader's availability is checked against wherever they're currently scheduled (a day
// directly, or the day of whatever group they're nested under) to flag a mismatch for
// review — it no longer blocks the placement outright, same convention as Distribute's
// "needs review" badge.
export function unavailableLeadersFor(group, day, findPerson, p) {
  return group.personIds
    .map(id => findPerson(p, id))
    .filter(person => person && person.availability.length > 0 && !person.availability.includes(day));
}
