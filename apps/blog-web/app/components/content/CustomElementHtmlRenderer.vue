<script setup lang="ts">
import { ensureCustomElementsLoadedForHtml } from "~/utils/custom-elements";

const props = withDefaults(
  defineProps<{
    html?: string | null;
    fallbackHtml?: string;
    contentClass?: string;
  }>(),
  {
    html: "",
    fallbackHtml: "",
    contentClass: "",
  },
);

const contentRef = ref<HTMLElement | null>(null);

const resolvedHtml = computed(() => props.html || props.fallbackHtml || "");

async function syncCustomElements() {
  if (!import.meta.client) {
    return;
  }

  await nextTick();
  await ensureCustomElementsLoadedForHtml(resolvedHtml.value);
}

watch(resolvedHtml, () => {
  void syncCustomElements();
});

onMounted(() => {
  void syncCustomElements();
});
</script>

<template>
  <div
    ref="contentRef"
    :class="contentClass"
    v-html="resolvedHtml"
  />
</template>

<style scoped>
:deep(.details-element) {
  margin-block: 1.5rem;
  border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  border-radius: 1rem;
  background: var(--ui-bg, #fff);
}

:deep(.details-element__summary) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  cursor: pointer;
  font-size: 1.125rem;
  font-weight: 600;
  list-style: none;
}

:deep(.details-element__summary::-webkit-details-marker) {
  display: none;
}

:deep(.details-element__summary::after) {
  content: "+";
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
  border-radius: 9999px;
  font-size: 1.25rem;
  line-height: 1;
  transition: transform 300ms ease-out;
}

:deep(.details-element[open] .details-element__summary::after) {
  transform: rotate(45deg);
}

:deep(.details-element__content) {
  padding-inline: 1.25rem;
  padding-bottom: 1.25rem;
  color: color-mix(in srgb, currentColor 75%, transparent);
}

:deep(.details-element__content > :first-child) {
  margin-block-start: 0;
}

:deep(.details-element__content > :last-child) {
  margin-block-end: 0;
}
</style>
