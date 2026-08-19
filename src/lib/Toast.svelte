<script>
  import { toast } from './toast.js';
</script>

<div id="toast" class:visible={$toast.visible}>{$toast.message}</div>
