<script setup lang="ts">
type ParentClusterOption = {
  id: string;
  name: string;
  slug?: string | null;
};

const props = defineProps<{
  open: boolean;
  parentClusterSearch: string;
  availableParentClusters: ParentClusterOption[];
  currentParentClusterId?: string | null;
  hasParentCluster: boolean;
  isUpdatingParentCluster: boolean;
}>();

const emit = defineEmits<{
  close: [];
  "update:parentClusterSearch": [value: string];
  "select-parent": [parentClusterId: string | null];
}>();
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
    @pointerdown.self="emit('close')"
  >
    <div
      class="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"
      @pointerdown.stop
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-slate-900">
            Changer le cluster parent
          </h2>
          <p class="text-sm text-slate-500">
            Choisissez un nouveau parent pour ce cluster.
          </p>
        </div>

        <button
          type="button"
          class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          @click="emit('close')"
        >
          <UIcon name="i-lucide-x" class="h-5 w-5" />
        </button>
      </div>

      <div class="mt-6">
        <input
          :value="parentClusterSearch"
          type="text"
          placeholder="Rechercher un cluster parent..."
          class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          @input="
            emit(
              'update:parentClusterSearch',
              (($event.target as HTMLInputElement | null)?.value ?? ''),
            )
          "
        />
      </div>

      <div class="mt-6 max-h-[24rem] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div class="space-y-2">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left"
            :disabled="isUpdatingParentCluster"
            @click="emit('select-parent', null)"
          >
            <span class="text-sm font-medium text-slate-900">Aucun parent</span>
            <UIcon
              v-if="!hasParentCluster"
              name="i-lucide-check"
              class="h-4 w-4 text-sky-600"
            />
          </button>

          <button
            v-for="parentCluster in availableParentClusters"
            :key="parentCluster.id"
            type="button"
            class="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left"
            :disabled="isUpdatingParentCluster"
            @click="emit('select-parent', parentCluster.id)"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-slate-900">
                {{ parentCluster.name }}
              </p>
              <p class="mt-1 text-xs text-slate-500">
                /{{ parentCluster.slug || "-" }}
              </p>
            </div>

            <UIcon
              v-if="currentParentClusterId === parentCluster.id"
              name="i-lucide-check"
              class="h-4 w-4 text-sky-600"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
