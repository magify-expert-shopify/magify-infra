<script setup lang="ts">
withDefaults(
  defineProps<{
    details?: string | null;
  }>(),
  {
    details: null,
  },
);
</script>

<template>
  <FeedbackInlineMessage
    tone="error"
    :details="details || undefined"
    class="text-red-600"
  >
    <slot />
  </FeedbackInlineMessage>
</template>
