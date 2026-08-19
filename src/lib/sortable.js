import Sortable from 'sortablejs';

// Svelte action wrapping a SortableJS instance. The instance is created once when the
// node mounts and persists across re-renders (Svelte keeps the underlying DOM node
// stable as long as the {#each}/conditional driving it doesn't remove it), so there's no
// need to destroy/recreate on every store update the way the old vanilla render() cycle
// did — .option() just patches in any changed config live.
export function sortable(node, options) {
  let instance = Sortable.create(node, options);
  return {
    update(newOptions) {
      Object.entries(newOptions).forEach(([key, value]) => {
        instance.option(key, value);
      });
    },
    destroy() {
      instance.destroy();
    }
  };
}
