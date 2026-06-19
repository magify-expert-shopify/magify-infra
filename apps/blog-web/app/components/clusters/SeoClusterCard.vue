<script setup lang="ts">
import type { SeoCluster } from "~/types/domain";

const props = defineProps<{
  cluster: SeoCluster;
  deleting?: boolean;
}>();

const emit = defineEmits<{
  edit: [cluster: SeoCluster];
  delete: [cluster: SeoCluster];
  createChild: [cluster: SeoCluster];
  toggleFavorite: [cluster: SeoCluster];
  toggleSprintCluster: [cluster: SeoCluster];
}>();

const isMenuOpen = ref(false);
const isExpanded = ref(false);
const articleElement = ref<HTMLElement | null>(null);
const router = useRouter();
const menuPosition = reactive({
  x: 0,
  y: 0,
});

const hasPillarPage = computed(() =>
  (props.cluster.pages ?? []).some((page) => page.seoRole === "PILLAR"),
);

function toLucideIconName(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "i-lucide-folder-kanban";
  }

  return `i-lucide-${trimmed.replace(/^i-lucide-/, "")}`;
}

function getHierarchyColorClass(type: "card" | "icon" | "badge") {
  const hierarchyLevel = props.cluster.hierarchyLevel ?? 0;

  if (type === "card") {
    if (hierarchyLevel >= 2) {
      return "border-red-100";
    }

    if (hierarchyLevel === 1) {
      return "border-violet-100";
    }

    return "border-sky-100";
  }

  if (hierarchyLevel >= 2) {
    return "bg-red-50 text-red-700 ring-red-100";
  }

  if (hierarchyLevel === 1) {
    return "bg-violet-50 text-violet-700 ring-violet-100";
  }

  return "bg-sky-50 text-sky-700 ring-sky-100";
}

function openMenuAtPosition(x: number, y: number) {
  menuPosition.x = x;
  menuPosition.y = y;
  isMenuOpen.value = true;
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}

function openClusterPage() {
  return router.push(`/clusters/${props.cluster.id}`);
}

function openMenuFromButton(event: MouseEvent) {
  const currentTarget = event.currentTarget;

  if (!(currentTarget instanceof HTMLElement)) {
    isMenuOpen.value = !isMenuOpen.value;
    return;
  }

  const articleRect =
    articleElement.value?.getBoundingClientRect() ??
    currentTarget.getBoundingClientRect();
  const buttonRect = currentTarget.getBoundingClientRect();

  openMenuAtPosition(
    buttonRect.right - articleRect.left - 176,
    buttonRect.bottom - articleRect.top + 8,
  );
}

function openContextMenu(event: MouseEvent) {
  const currentTarget = event.currentTarget;

  if (!(currentTarget instanceof HTMLElement)) {
    return;
  }

  const rect = currentTarget.getBoundingClientRect();

  openMenuAtPosition(event.clientX - rect.left, event.clientY - rect.top);
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!isMenuOpen.value) {
    return;
  }

  const target = event.target;

  if (!(target instanceof Node)) {
    return;
  }

  if (articleElement.value?.contains(target)) {
    return;
  }

  isMenuOpen.value = false;
}

onMounted(() => {
  document.addEventListener("pointerdown", onDocumentPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
});
</script>

<template>
  <article
    ref="articleElement"
    data-cluster-card
    class="relative cursor-pointer rounded-2xl border p-5 shadow-sm"
    :class="getHierarchyColorClass('card')"
    @click="toggleExpanded"
    @contextmenu.prevent.stop="openContextMenu"
  >
    <div class="absolute right-4 top-4 flex items-center gap-2">
      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        @click.stop="toggleExpanded"
      >
        <UIcon
          :name="isExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="h-5 w-5"
        />
      </button>

      <button
        type="button"
        class="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        @click.stop="openMenuFromButton"
      >
        <UIcon name="i-lucide-ellipsis" class="h-5 w-5" />
      </button>
    </div>

    <div
      v-if="isMenuOpen"
      class="absolute z-10 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
      :style="{
        left: `${menuPosition.x}px`,
        top: `${menuPosition.y}px`,
      }"
    >
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        @click="openClusterPage"
      >
        <UIcon name="i-lucide-folder-open" class="h-4 w-4" />
        <span>Ouvrir</span>
      </button>

      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-sky-700 transition hover:bg-sky-50"
        @click="
          isMenuOpen = false;
          emit('toggleSprintCluster', props.cluster);
        "
      >
        <UIcon
          :name="
            props.cluster.isSprintCluster
              ? 'i-lucide-flag-off'
              : 'i-lucide-flag'
          "
          class="h-4 w-4"
        />
        <span>{{
          props.cluster.isSprintCluster
            ? "Retirer du sprint"
            : "Marquer cluster du sprint"
        }}</span>
      </button>

      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-amber-700 transition hover:bg-amber-50"
        @click="
          isMenuOpen = false;
          emit('toggleFavorite', props.cluster);
        "
      >
        <UIcon
          :name="
            props.cluster.isFavorite ? 'i-lucide-star-off' : 'i-lucide-star'
          "
          class="h-4 w-4"
        />
        <span>{{
          props.cluster.isFavorite
            ? "Retirer des favoris"
            : "Ajouter aux favoris"
        }}</span>
      </button>

      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        @click="
          isMenuOpen = false;
          emit('createChild', props.cluster);
        "
      >
        <UIcon name="i-lucide-git-branch-plus" class="h-4 w-4" />
        <span>Ajouter un sous-cluster</span>
      </button>

      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
        @click="
          isMenuOpen = false;
          emit('edit', props.cluster);
        "
      >
        <UIcon name="i-lucide-pencil" class="h-4 w-4" />
        <span>Modifier</span>
      </button>

      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
        :disabled="deleting"
        @click="
          isMenuOpen = false;
          emit('delete', props.cluster);
        "
      >
        <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
        <span>{{ deleting ? "Suppression..." : "Supprimer" }}</span>
      </button>
    </div>

    <div class="space-y-3">
      <div>
        <!-- <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cluster
        </p> -->
        <div class="mt-1 flex items-center gap-3">
          <span
            class="flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ring-inset"
            :class="getHierarchyColorClass('icon')"
          >
            <UIcon :name="toLucideIconName(cluster.icon)" class="h-5 w-5" />
          </span>
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold text-slate-900">
                {{ cluster.name }}
              </h2>

              <UIcon
                v-if="cluster.isFavorite"
                name="i-lucide-star"
                class="h-4 w-4 fill-amber-400 text-amber-500"
              />

              <UTooltip
                v-if="!hasPillarPage"
                text="Ce cluster n’a pas encore de page pilier associée."
              >
                <span class="inline-flex items-center text-amber-500">
                  <UIcon name="i-lucide-triangle-alert" class="h-4 w-4" />
                </span>
              </UTooltip>

              <UBadge
                v-if="cluster.isSprintCluster"
                color="primary"
                variant="soft"
                class="rounded-full"
              >
                Sprint
              </UBadge>
            </div>

            <UBadge
              variant="soft"
              color="neutral"
              class="rounded-full px-2.5 py-1 text-xs"
            >
              {{ cluster.articleCount ?? cluster._count?.blogArticles ?? 0 }}
              article{{
                (cluster.articleCount ?? cluster._count?.blogArticles ?? 0) > 1
                  ? "s"
                  : ""
              }}
            </UBadge>
          </div>
        </div>
        <p v-if="isExpanded" class="mt-1 text-sm text-slate-500">
          /{{ cluster.slug || "-" }}
        </p>
      </div>

      <div v-if="isExpanded" class="rounded-xl bg-slate-50 px-3 py-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {{ cluster.parentCluster ? "Sous-cluster de" : "Type de cluster" }}
        </p>
        <p class="mt-1 text-sm text-slate-700">
          {{
            cluster.parentCluster
              ? cluster.parentCluster.name
              : "Cluster principal"
          }}
          <UBadge
            variant="soft"
            class="rounded-full px-2.5 py-1 text-[0.65rem] font-semibold tracking-wide"
            :color="cluster.parentCluster ? 'neutral' : 'primary'"
          >
            {{ cluster.parentCluster ? "S" : "P" }}
          </UBadge>
        </p>
        <!-- <div class="mt-1 flex items-center gap-2 text-sm text-nowrap text-slate-700">
          <UBadge
            variant="soft"
            class="rounded-full px-2.5 py-1 text-[0.65rem] font-semibold tracking-wide"
            :color="cluster.parentCluster ? 'neutral' : 'primary'"
          >
            {{ cluster.parentCluster ? "S" : "P" }}
          </UBadge>
          <span v-if="cluster.parentCluster">{{ cluster.parentCluster.name }}</span>
        </div> -->
      </div>

      <div v-if="isExpanded">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Mot-clé principal
        </p>
        <div class="mt-2">
          <UBadge
            variant="soft"
            class="rounded-full px-3 py-1 ring-1 ring-inset"
            :class="getHierarchyColorClass('badge')"
          >
            {{ cluster.primaryKeyword }}
          </UBadge>
        </div>
      </div>

      <div v-if="isExpanded && cluster.description">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Description
        </p>
        <p class="mt-1 text-sm text-slate-700">
          {{ cluster.description }}
        </p>
      </div>
    </div>
  </article>
</template>
