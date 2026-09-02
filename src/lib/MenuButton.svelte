<script>
  export let label;

  let el;
  let open = false;

  function handleWindowClick(e) {
    if (open && el && !el.contains(e.target)) open = false;
  }

  // A leaf action (a real <button> inside this menu) closes it — and, by bubbling,
  // closes any parent menu it's nested inside too, so picking a submenu item collapses
  // the whole chain back to the toolbar. Clicking a nested submenu's own <summary> to
  // open it is deliberately not a "leaf action", so it doesn't also close this menu.
  function handleContentClick(e) {
    if (e.target.closest('button')) open = false;
  }
</script>

<svelte:window on:click={handleWindowClick} />

<details class="menu" bind:this={el} bind:open>
  <summary>{label}</summary>
  <div class="menu-list" on:click={handleContentClick}>
    <slot />
  </div>
</details>
