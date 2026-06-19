<script setup lang="ts">
import type { ApiProspect } from "~/types/prospects";

const PROSPECT_STATUSES = [
  "Prospect froid",
  "Prospect informations manquantes",
  "Prospect contacté",
  "Prospect en attente réponse",
  "Prospect en discussion",
  "Prospect qualifié (opportunité)",
  "Prospect non qualifié",
  "Offre envoyée",
  "Relance en cours",
  "Client",
  "Perdu",
] as const;

const props = defineProps<{
  prospects: ApiProspect[];
}>();

const emit = defineEmits<{
  (event: "move-prospect", payload: { id: number; status: string }): void;
}>();

const draggedId = ref<number | null>(null);
const overStatus = ref<string | null>(null);

const groupedProspects = computed(() => {
  const grouped = new Map<string, ApiProspect[]>();

  for (const status of PROSPECT_STATUSES) {
    grouped.set(status, []);
  }

  for (const prospect of props.prospects) {
    const bucket = grouped.get(prospect.status);
    if (bucket) {
      bucket.push(prospect);
    }
  }

  return grouped;
});

function handleDragStart(prospect: ApiProspect, event: DragEvent) {
  draggedId.value = prospect.id;
  event.dataTransfer?.setData("text/plain", String(prospect.id));
  event.dataTransfer?.setData("application/x-prospect-id", String(prospect.id));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function handleDrop(status: string, event: DragEvent) {
  event.preventDefault();

  const rawId =
    event.dataTransfer?.getData("application/x-prospect-id") ||
    event.dataTransfer?.getData("text/plain") ||
    draggedId.value?.toString() ||
    "";

  const id = Number(rawId);
  if (!Number.isInteger(id) || !status) {
    return;
  }

  emit("move-prospect", { id, status });
  draggedId.value = null;
  overStatus.value = null;
}

function handleDragOver(status: string, event: DragEvent) {
  event.preventDefault();
  overStatus.value = status;
}

function handleDragLeave(status: string) {
  if (overStatus.value === status) {
    overStatus.value = null;
  }
}
</script>

<template>
  <div class="overflow-x-auto pb-2">
    <div class="grid min-w-max grid-flow-col gap-4">
      <section
        v-for="status in PROSPECT_STATUSES"
        :key="status"
        class="flex w-[20rem] flex-col rounded-xl border border-slate-200 bg-slate-100/70"
        :class="overStatus === status ? 'ring-2 ring-sky-400' : ''"
        @dragover="handleDragOver(status, $event)"
        @dragleave="handleDragLeave(status)"
        @drop="handleDrop(status, $event)"
      >
        <div class="border-b border-slate-200 px-4 py-3">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-xs font-semibold text-slate-900">
              {{ status }}
            </h2>
            <span
              class="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
            >
              {{ groupedProspects.get(status)?.length ?? 0 }}
            </span>
          </div>
        </div>

        <div class="flex min-h-[28rem] flex-1 flex-col gap-3 px-3 py-3">
          <ProspectsProspectCard
            v-for="prospect in groupedProspects.get(status) || []"
            :key="prospect.id"
            :prospect="prospect"
            @drag-start="handleDragStart(prospect, $event)"
          />

          <div
            v-if="(groupedProspects.get(status)?.length ?? 0) === 0"
            class="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-muted-sm"
          >
            Dépose une carte ici
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
