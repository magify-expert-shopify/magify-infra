<script setup lang="ts">
import {
  HOME_CARD_DEFINITIONS,
  type HomeCardSetting,
} from "~/lib/homepage-cards";
import type { HomepageCardBlock } from "~/types/site-settings";

const props = defineProps<{
  modelValue: HomeCardSetting[];
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: HomeCardSetting[]): void;
  (event: "change"): void;
}>();

const dragIndex = ref<number | null>(null);
const dropIndex = ref<number | null>(null);

const blockDefinitions = computed<HomepageCardBlock[]>(() => {
  const definitions = new Map(
    HOME_CARD_DEFINITIONS.map((definition) => [definition.key, definition]),
  );

  return props.modelValue.map((block) => ({
    ...block,
    ...definitions.get(block.key),
  }));
});

function commit(nextBlocks: HomeCardSetting[]) {
  emit(
    "update:modelValue",
    nextBlocks.map((block, index) => ({
      ...block,
      position: index,
    })),
  );
  emit("change");
}

function toggleVisibility(index: number) {
  const next = [...props.modelValue];
  next[index] = {
    ...next[index],
    visible: !next[index].visible,
  };

  commit(next);
}

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index;
  dropIndex.value = index;
  event.dataTransfer?.setData("text/plain", String(index));
}

function onDragOver(index: number, event: DragEvent) {
  event.preventDefault();
  dropIndex.value = index;
}

function onListDragOver(event: DragEvent) {
  event.preventDefault();

  if (event.target === event.currentTarget) {
    dropIndex.value = blockDefinitions.value.length;
  }
}

function onDrop(index: number) {
  if (dragIndex.value === null || dragIndex.value === index) {
    dragIndex.value = null;
    dropIndex.value = null;
    return;
  }

  const next = [...props.modelValue];
  const [moved] = next.splice(dragIndex.value, 1);
  next.splice(index, 0, moved);

  dragIndex.value = null;
  dropIndex.value = null;
  commit(next);
}

function onListDrop() {
  if (dragIndex.value === null) {
    return;
  }

  const next = [...props.modelValue];
  const [moved] = next.splice(dragIndex.value, 1);
  next.push(moved);

  dragIndex.value = null;
  dropIndex.value = null;
  commit(next);
}

function onDragEnd() {
  dragIndex.value = null;
  dropIndex.value = null;
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-slate-500">
          Paramètre de l'accueil
        </div>
        <p class="mt-1 text-xs text-slate-600">
          Glisse les blocs pour changer l’ordre d’affichage de la homepage.
        </p>
      </div>

      <slot name="status" />
    </div>

    <div
      class="mt-6 space-y-3"
      @dragover="onListDragOver"
      @drop.prevent="onListDrop"
    >
      <div
        v-if="dragIndex !== null && dropIndex === 0"
        class="pointer-events-none h-0.5 rounded-full bg-sky-400 shadow-[0_0_0_1px_rgba(186,230,253,0.8)]"
      />

      <div
        v-for="(block, index) in blockDefinitions"
        :key="block.key"
        class="relative"
      >
        <div
          v-if="dragIndex !== null && dropIndex === index"
          class="pointer-events-none absolute -top-2 left-0 right-0 h-0.5 rounded-full bg-sky-400 shadow-[0_0_0_1px_rgba(186,230,253,0.8)]"
        />

        <div
          class="flex items-center gap-3 rounded-xl border px-4 py-3 transition"
          :class="[
            block.visible
              ? 'border-slate-200 bg-slate-50'
              : 'border-dashed border-slate-200 bg-white opacity-70',
            dragIndex === index ? 'ring-2 ring-sky-200' : '',
          ]"
          draggable="true"
          @dragstart="onDragStart(index, $event)"
          @dragover="onDragOver(index, $event)"
          @drop.prevent="onDrop(index)"
          @dragend="onDragEnd"
        >
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            title="Déplacer"
          >
            <UIcon name="i-lucide-grip-vertical" class="h-4 w-4" />
          </button>

          <div
            class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white"
          >
            <UIcon :name="block.icon" class="h-4 w-4" />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h2 class="truncate text-xs font-semibold text-slate-900">
                {{ block.title }}
              </h2>
            </div>
            <p class="truncate text-xs text-slate-500">
              {{ block.eyebrow }} · {{ block.ctaLabel }}
            </p>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            square
            :icon="block.visible ? 'i-lucide-eye' : 'i-lucide-eye-off'"
            :title="block.visible ? 'Masquer' : 'Afficher'"
            @click="toggleVisibility(index)"
          />
        </div>
      </div>

      <div
        v-if="dragIndex !== null && dropIndex === blockDefinitions.length"
        class="pointer-events-none h-0.5 rounded-full bg-sky-400 shadow-[0_0_0_1px_rgba(186,230,253,0.8)]"
      />
    </div>
  </section>
</template>
