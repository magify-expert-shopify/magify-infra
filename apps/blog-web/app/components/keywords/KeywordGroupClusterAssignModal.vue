<script setup lang="ts">
import type { SeoCluster } from "~/types/domain";
import type { KeywordGroupRecord } from "~/types/keywords";

const props = defineProps<{
  open: boolean;
  group: KeywordGroupRecord | null;
  clusters: SeoCluster[];
  isSubmitting?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  submit: [clusterId: string];
}>();

const search = ref("");
const selectedClusterId = ref<string | null>(null);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      search.value = "";
      selectedClusterId.value = null;
    }
  },
);

const availableClusters = computed(() => {
  const normalizedSearch = search.value.trim().toLowerCase();
  const currentClusterId = props.group?.seoCluster?.id ?? null;

  return props.clusters
    .filter((cluster) => cluster.id !== currentClusterId)
    .filter((cluster) => {
      if (!normalizedSearch) {
        return true;
      }

      return [cluster.name, cluster.description, cluster.primaryKeyword]
        .filter((value): value is string => Boolean(value?.trim()))
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    .sort((left, right) =>
      left.name.localeCompare(right.name, "fr", { sensitivity: "base" }),
    );
});

function closeModal() {
  emit("update:open", false);
}

function submit() {
  if (!selectedClusterId.value || props.isSubmitting) {
    return;
  }

  emit("submit", selectedClusterId.value);
}
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="rounded-3xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-slate-900">
              Affilier à un cluster
            </h2>
            <p class="text-sm text-slate-500">
              Choisis le cluster SEO à associer à ce groupe de mots-clés.
            </p>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            @click="closeModal"
          />
        </div>

        <div class="mt-5 space-y-4">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Rechercher un cluster..."
          />

          <div class="max-h-[26rem] overflow-y-auto pr-1">
            <div class="grid gap-2">
              <button
                v-for="cluster in availableClusters"
                :key="cluster.id"
                type="button"
                class="rounded-2xl border px-4 py-3 text-left transition"
                :class="
                  selectedClusterId === cluster.id
                    ? 'border-sky-300 bg-sky-50 ring-4 ring-sky-100'
                    : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-sky-50'
                "
                @click="selectedClusterId = cluster.id"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 space-y-1">
                    <p class="truncate font-medium text-slate-900">
                      {{ cluster.name }}
                    </p>
                    <p
                      v-if="cluster.description"
                      class="line-clamp-2 text-xs text-slate-500"
                    >
                      {{ cluster.description }}
                    </p>
                  </div>

                  <div class="flex shrink-0 flex-wrap justify-end gap-2">
                    <UBadge color="primary" variant="soft">
                      {{ cluster.primaryKeyword }}
                    </UBadge>
                    <UBadge color="neutral" variant="soft">
                      Niveau {{ cluster.hierarchyLevel ?? 0 }}
                    </UBadge>
                  </div>
                </div>
              </button>

              <div
                v-if="!availableClusters.length"
                class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
              >
                Aucun cluster compatible trouvé.
              </div>
            </div>
          </div>

          <div class="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <UButton
              color="neutral"
              variant="soft"
              @click="closeModal"
            >
              Annuler
            </UButton>
            <UButton
              color="primary"
              icon="i-lucide-link"
              :loading="isSubmitting"
              :disabled="!selectedClusterId"
              @click="submit"
            >
              Associer le cluster
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
