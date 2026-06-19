<script setup lang="ts">
withDefaults(
  defineProps<{
    details?: string | null;
    pulse?: boolean;
  }>(),
  {
    details: null,
    pulse: false,
  },
);
</script>

<template>
  <FeedbackInlineMessage
    tone="info"
    :details="details || undefined"
    :class="pulse ? 'animate-pulse' : ''"
  >
    <slot />
  </FeedbackInlineMessage>
</template>
