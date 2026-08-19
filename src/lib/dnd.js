// svelte-dnd-action can inject a temporary shadow-placeholder entry into an items array
// mid-drag (see SHADOW_ITEM_MARKER_PROPERTY_NAME in its docs) — never treat one as a real
// item to validate or persist.
export function realItems(items, shadowMarkerKey) {
  return items.filter(x => !x[shadowMarkerKey]);
}
