<script>
  import { createEventDispatcher } from 'svelte';

  export let toolTag;
  export let homeHref = 'index.html';

  const dispatch = createEventDispatcher();
  let dragOver = false;
  let fileInput;

  function handleFiles(fileList) {
    const file = fileList && fileList[0];
    if (file) dispatch('openfile', file);
  }
</script>

<div id="empty-state">
  <div
    class="empty-state-inner"
    class:drag-over={dragOver}
    id="dropzone"
    on:dragover|preventDefault={() => (dragOver = true)}
    on:dragenter|preventDefault={() => (dragOver = true)}
    on:dragleave|preventDefault={() => (dragOver = false)}
    on:drop|preventDefault={(e) => { dragOver = false; handleFiles(e.dataTransfer.files); }}
  >
    <h1>Schedulizer <span class="tool-tag">{toolTag}</span></h1>
    <p>Drag a project <code>.json</code> file here, or</p>
    <div class="empty-state-actions">
      <button on:click={() => fileInput.click()}>Open Project File&hellip;</button>
      <button on:click={() => dispatch('newproject')}>Start New Project</button>
    </div>
    <button class="help-link" on:click={() => dispatch('help')}>Help</button>
    <p class="tool-switch"><a href={homeHref}>&larr; Home</a></p>
    <input
      type="file"
      bind:this={fileInput}
      accept="application/json,.json"
      hidden
      on:change={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
    />
  </div>
</div>
