// Every dnd-zone here (the two drawers and each group's nested people-list) is a valid
// target for any person, unconditionally — a group's night not matching someone's stated
// availability is surfaced afterward via the "needs review" badge rather than blocked at
// drop time.

export { realItems } from '../lib/dnd.js';

export const PERSON_ZONE_TYPE = 'distribute-person';
