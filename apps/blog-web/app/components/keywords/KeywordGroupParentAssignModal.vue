<script setup lang="ts">
import type { KeywordGroupRecord } from "~/types/keywords";

const props = defineProps<{
  open: boolean;
  group: KeywordGroupRecord | null;
  groups: KeywordGroupRecord[];
  isSubmitting?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  submit: [parentGroupId: string];
}>();

const search = ref("");
const selectedParentGroupId = ref<string | null>(null);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      search.value = "";
      selectedParentGroupId.value = null;
    }
  },
);

const descendantIds = computed(() => {
  const currentGroupId = props.group?.id;

  if (!currentGroupId) {
    return new Set<string>();
  }

  const childrenByParentId = new Map<string, string[]>();

  for (const group of props.groups) {
    for (const parentGroup of group.parentGroups ?? []) {
      const children = childrenByParentId.get(parentGroup.id) ?? [];
      children.push(group.id);
      childrenByParentId.set(parentGroup.id, children);
    }
  }

  const visited = new Set<string>();
  const stack = [currentGroupId];

  while (stack.length) {
    const groupId = stack.pop();

    if (!groupId) {
      continue;
    }

    const children = childrenByParentId.get(groupId) ?? [];

    for (const childId of children) {
      if (visited.has(childId)) {
        continue;
      }

      visited.add(childId);
      stack.push(childId);
    }
  }

  return visited;
});

const existingParentIds = computed(
  () => new Set((props.group?.parentGroups ?? []).map((parent) => parent.id)),
);

const availableParentGroups = computed(() => {
  const normalizedSearch = search.value.trim().toLowerCase();
  const currentGroupId = props.group?.id ?? null;

  return props.groups
    .filter((group) => group.id !== currentGroupId)
    .filter((group) => !existingParentIds.value.has(group.id))
    .filter((group) => !descendantIds.value.has(group.id))
    .filter((group) => {
      if (!normalizedSearch) {
        return true;
      }

      return [group.name, group.description, group.primaryKeyword]
        .filter((value): value is string => Boolean(value?.trim()))
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    .sort((left, right) =>
      left.name.localeCompare(right.name, "fr", { sensitivity: "base" }),
    );
});

const hasReachedMaxParents = computed(
  () => (props.group?.parentGroups?.length ?? 0) >= 3,
);

function closeModal() {
  emit("update:open", false);
}

function submit() {
  if (!selectedParentGroupId.value || props.isSubmitting || hasReachedMaxParents.value) {
    return;
  }

  emit("submit", selectedParentGroupId.value);
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
              Affilier à un parent
            </h2>
            <p class="text-sm text-slate-500">
              Choisis un groupe parent à ajouter pour ce groupe de mots-clés.
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
          <div
            v-if="hasReachedMaxParents"
            class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            Ce groupe a déjà 3 parents. Retire-en un avant d’en ajouter un nouveau.
          </div>

          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Rechercher un parent..."
          />

          <div class="max-h-[26rem] overflow-y-auto pr-1">
            <div class="grid gap-2">
              <button
                v-for="candidate in availableParentGroups"
                :key="candidate.id"
                type="button"
                class="rounded-2xl border px-4 py-3 text-left transition"
                :class="
                  selectedParentGroupId === candidate.id
                    ? 'border-sky-300 bg-sky-50 ring-4 ring-sky-100'
                    : 'border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-sky-50'
                "
                @click="selectedParentGroupId = candidate.id"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate font-medium text-slate-900">
                      {{ candidate.name }}
                    </p>
                    <p
                      v-if="candidate.description"
                      class="truncate text-xs text-slate-500"
                    >
                      {{ candidate.description }}
                    </p>
                  </div>

                  <UBadge color="neutral" variant="soft">
                    {{
                      candidate.primaryKeyword
                        ? candidate.primaryKeyword
                        : "Sans mot-clé principal"
                    }}
                  </UBadge>
                </div>
              </button>

              <div
                v-if="!availableParentGroups.length"
                class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500"
              >
                Aucun parent compatible trouvé.
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
              icon="i-lucide-folder-plus"
              :loading="isSubmitting"
              :disabled="!selectedParentGroupId || hasReachedMaxParents"
              @click="submit"
            >
              Ajouter le parent
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
