<script setup lang="ts">
import type { ObservationTitleSuggestion } from "~/types/urls";

const props = defineProps<{
  query: string;
}>();

const emit = defineEmits<{
  (event: "select", value: ObservationTitleSuggestion): void;
}>();

const runtimeConfig = useRuntimeConfig();
const debouncedQuery = ref(props.query);
const isOpen = ref(false);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.query,
  (value) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      const nextQuery = String(value || "").trim();
      debouncedQuery.value = nextQuery;
      isOpen.value = nextQuery.length >= 3;
    }, 250);
  },
  { immediate: true },
);

const { data, pending } = await useFetch<ObservationTitleSuggestion[]>(
  () => `${runtimeConfig.public.apiUrl}/urls/observations/suggestions`,
  {
    default: () => [],
    query: computed(() => ({
      search: debouncedQuery.value,
      limit: 6,
    })),
  },
);

const suggestions = computed(() => data.value || []);
const visibleSuggestions = computed(() => {
  if (debouncedQuery.value.length < 3) {
    return [];
  }

  return suggestions.value.slice(0, 6);
});

onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
});
</script>

<template>
  <div
    v-if="isOpen && (pending || visibleSuggestions.length > 0)"
    class="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
  >
    <div class="mb-2 flex items-center justify-between gap-3">
      <p
        class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
      >
        Titres similaires
      </p>
      <p class="text-xs text-slate-500">
        {{
          pending
            ? "Recherche..."
            : `${visibleSuggestions.length} suggestion(s)`
        }}
      </p>
    </div>

    <div v-if="visibleSuggestions.length > 0" class="flex flex-wrap gap-2">
      <button
        v-for="suggestion in visibleSuggestions"
        :key="suggestion.title"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900"
        @mousedown.prevent
        @click="emit('select', suggestion)"
      >
        <span class="font-medium">{{ suggestion.title }}</span>
        <UBadge color="neutral" variant="soft" class="shrink-0">
          {{ suggestion.siteCount }} site{{
            suggestion.siteCount > 1 ? "s" : ""
          }}
        </UBadge>
      </button>
    </div>

    <div
      v-else
      class="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-muted-sm"
    >
      Recherche des titres similaires...
    </div>
  </div>
</template>
