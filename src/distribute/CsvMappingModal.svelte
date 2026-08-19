<script>
  import { createEventDispatcher } from 'svelte';
  import { dragHandle, dragHandleZone } from 'svelte-dnd-action';
  import { parseCSVRow, defaultMappingFromHeaders } from './csvMapping.js';
  import { runSignupImport } from './store.js';

  const MAPPING_GROUP_ORDER_TYPE = 'csv-mapping-group-order';

  export let lines;

  const dispatch = createEventDispatcher();

  const headers = parseCSVRow(lines[0]);
  const defaults = defaultMappingFromHeaders(headers);

  let nameMode = defaults.nameMode;
  let nameIdx = defaults.nameIdx;
  let firstIdx = defaults.firstIdx;
  let lastIdx = defaults.lastIdx;
  let phoneIdx = defaults.phoneIdx;
  let emailIdx = defaults.emailIdx;
  let availIdx = defaults.availIdx;
  let commentsIdx = defaults.commentsIdx;
  let groupOrder = defaults.groupOrder.map(g => ({ ...g, id: g.index }));
  let error = '';

  function close() {
    dispatch('close');
  }

  $: claimed = (() => {
    const set = new Set();
    if (nameMode === 'single') {
      if (nameIdx !== -1) set.add(nameIdx);
    } else {
      if (firstIdx !== -1) set.add(firstIdx);
      if (lastIdx !== -1) set.add(lastIdx);
    }
    [phoneIdx, emailIdx, availIdx, commentsIdx].forEach(v => { if (v !== -1) set.add(v); });
    groupOrder.forEach(g => set.add(g.index));
    return set;
  })();

  $: availableHeaders = headers.map((h, i) => ({ h, i })).filter(({ i }) => !claimed.has(i));

  function addGroupColumn(i, h) {
    const m = h.match(/\[([^\]]+)\]/);
    groupOrder = [...groupOrder, { index: i, id: i, name: m ? m[1].trim() : h }];
  }

  function removeGroupColumn(index) {
    groupOrder = groupOrder.filter(g => g.index !== index);
  }

  function handleGroupOrderConsider(e) {
    groupOrder = e.detail.items;
  }

  function handleGroupOrderFinalize(e) {
    groupOrder = e.detail.items;
  }

  function handleImport() {
    if (nameMode === 'single' && nameIdx === -1) {
      error = 'Choose a Name column (or switch to separate First/Last columns).';
      return;
    }
    if (nameMode === 'split' && firstIdx === -1 && lastIdx === -1) {
      error = 'Choose at least a First or Last name column.';
      return;
    }
    if (groupOrder.length === 0) {
      error = 'Add at least one column as a group ranking.';
      return;
    }

    const mapping = {
      nameMode, nameIdx, firstIdx, lastIdx, phoneIdx, emailIdx, availIdx, commentsIdx,
      groupOrder: groupOrder.map(g => ({ index: g.index, name: g.name.trim() || `Group ${g.index + 1}` }))
    };
    runSignupImport(lines, mapping);
    close();
  }
</script>

<div class="modal-overlay" on:click={(e) => { if (e.target === e.currentTarget) close(); }}>
  <div class="modal-content csv-mapping-content" role="dialog" aria-modal="true" aria-labelledby="csv-mapping-title">
    <div class="modal-header">
      <h2 id="csv-mapping-title">Map Sign-Up CSV Columns</h2>
      <button class="icon-btn modal-close" title="Cancel" on:click={close}>✕</button>
    </div>
    <div class="modal-body">
      <div class="mapping-section">
        <h3>Name</h3>
        <label class="mapping-radio"><input type="radio" bind:group={nameMode} value="single" /> Single column, split on first space</label>
        <label class="mapping-radio"><input type="radio" bind:group={nameMode} value="split" /> Separate First / Last columns</label>
        {#if nameMode === 'single'}
          <div class="mapping-row">
            <span class="mapping-label">Name column</span>
            <select bind:value={nameIdx}>
              <option value={-1}>— None —</option>
              {#each headers as h, i}<option value={i}>{h}</option>{/each}
            </select>
          </div>
        {:else}
          <div class="mapping-row">
            <span class="mapping-label">First name column</span>
            <select bind:value={firstIdx}>
              <option value={-1}>— None —</option>
              {#each headers as h, i}<option value={i}>{h}</option>{/each}
            </select>
            <span class="mapping-label">Last name column</span>
            <select bind:value={lastIdx}>
              <option value={-1}>— None —</option>
              {#each headers as h, i}<option value={i}>{h}</option>{/each}
            </select>
          </div>
        {/if}
      </div>

      <div class="mapping-section">
        <div class="mapping-row">
          <span class="mapping-label">Phone</span>
          <select bind:value={phoneIdx}>
            <option value={-1}>— None —</option>
            {#each headers as h, i}<option value={i}>{h}</option>{/each}
          </select>
        </div>
        <div class="mapping-row">
          <span class="mapping-label">Email</span>
          <select bind:value={emailIdx}>
            <option value={-1}>— None —</option>
            {#each headers as h, i}<option value={i}>{h}</option>{/each}
          </select>
        </div>
        <div class="mapping-row">
          <span class="mapping-label">Availability</span>
          <select bind:value={availIdx}>
            <option value={-1}>— None —</option>
            {#each headers as h, i}<option value={i}>{h}</option>{/each}
          </select>
        </div>
        <p class="mapping-hint mapping-hint-indent">Assumes this column's content is comma-separated day names, full or abbreviated — e.g. "Sunday, Wednesday" or "Sun, Wed".</p>
        <div class="mapping-row">
          <span class="mapping-label">Comments</span>
          <select bind:value={commentsIdx}>
            <option value={-1}>— None —</option>
            {#each headers as h, i}<option value={i}>{h}</option>{/each}
          </select>
        </div>
      </div>

      <div class="mapping-section">
        <h3>Group Rankings</h3>
        <p class="mapping-hint">Add each column that represents a group choice, then drag to set the order. This becomes the group order on the board. Each person's rank in a group comes from the first number found anywhere in that cell's text (e.g. "1st Choice", "Choice 2"). A cell with no digit, like "First", is treated as unranked.</p>
        <div class="mapping-columns">
          <div class="mapping-pool">
            <div class="mapping-pool-label">Available columns</div>
            <div class="mapping-available-list">
              {#each availableHeaders as { h, i } (i)}
                <div class="mapping-available-row">
                  <span class="mapping-available-text">{h}</span>
                  <button class="mapping-add-btn" on:click={() => addGroupColumn(i, h)}>+ Add</button>
                </div>
              {:else}
                <div class="mapping-empty-hint">All columns are assigned.</div>
              {/each}
            </div>
          </div>
          <div class="mapping-groups">
            <div class="mapping-pool-label">Group order</div>
            <div
              class="mapping-group-list"
              use:dragHandleZone={{ items: groupOrder, type: MAPPING_GROUP_ORDER_TYPE, flipDurationMs: 150, useCursorForDetection: true }}
              on:consider={handleGroupOrderConsider}
              on:finalize={handleGroupOrderFinalize}
            >
              {#each groupOrder as g (g.id)}
                <div class="mapping-group-row" data-col-index={g.index}>
                  <span class="drag-handle" use:dragHandle aria-label="Drag to reorder {g.name}">⠿</span>
                  <input class="inline-input mapping-group-name" type="text" bind:value={g.name} />
                  <button class="icon-btn" title="Remove" on:click={() => removeGroupColumn(g.index)}>✕</button>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </div>

      {#if error}<div class="mapping-error">{error}</div>{/if}
    </div>
    <div class="modal-footer">
      <button on:click={close}>Cancel</button>
      <button on:click={handleImport}>Import</button>
    </div>
  </div>
</div>
