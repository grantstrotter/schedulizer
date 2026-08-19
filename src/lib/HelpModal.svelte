<script>
  export let open = false;
  export let title = 'Schedulizer Guide';

  function close() {
    open = false;
  }
</script>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape' && open) close(); }} />

<div class="modal-overlay" hidden={!open} on:click={(e) => { if (e.target === e.currentTarget) close(); }}>
  <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="help-title">
    <div class="modal-header">
      <h2 id="help-title">{title}</h2>
      <button class="icon-btn modal-close" title="Close" on:click={close}>✕</button>
    </div>
    <div class="modal-body">
      <slot />
    </div>
  </div>
</div>
