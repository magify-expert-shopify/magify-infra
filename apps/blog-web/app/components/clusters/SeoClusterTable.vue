<script setup lang="ts">
import type { SeoCluster } from "~/types/domain";

defineProps<{
  clusters: SeoCluster[];
  deletingClusterId?: string | null;
}>();

defineEmits<{
  edit: [cluster: SeoCluster];
  delete: [cluster: SeoCluster];
  toggleFavorite: [cluster: SeoCluster];
  toggleSprintCluster: [cluster: SeoCluster];
}>();

function getHierarchyColorClass(
  cluster: SeoCluster,
  type: "card" | "icon" | "badge",
) {
  const hierarchyLevel = cluster.hierarchyLevel ?? 0;

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
</script>

<template>
  <div
    class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
  >
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th
              class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Cluster
            </th>
            <!-- <th
              class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Type
            </th> -->
            <th
              class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Mot-clé principal
            </th>
            <!-- <th
              class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Description
            </th> -->
            <th
              class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Actions
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-200">
          <tr
            v-for="cluster in clusters"
            :key="cluster.id"
            class="align-top border-l-2 transition"
            :class="getHierarchyColorClass(cluster, 'card')"
          >
            <td class="w-0 px-4 py-3">
              <div class="flex items-center gap-3">
                <span
                  class="shrink-0 flex h-9 w-9 items-center justify-center rounded-2xl ring-1 ring-inset"
                  :class="getHierarchyColorClass(cluster, 'icon')"
                >
                  <UIcon
                    :name="
                      cluster.icon
                        ? `i-lucide-${cluster.icon.replace(/^i-lucide-/, '')}`
                        : 'i-lucide-folder-kanban'
                    "
                    class="h-4 w-4"
                  />
                </span>
                <div>
                  <div
                    class="flex items-center gap-2 font-medium text-slate-900"
                  >
                    <NuxtLink
                      :to="`/clusters/${cluster.id}`"
                      class="transition text-nowrap hover:text-sky-700"
                    >
                      {{ cluster.name }}
                    </NuxtLink>
                    <UIcon
                      v-if="cluster.isFavorite"
                      name="i-lucide-star"
                      class="h-4 w-4 fill-amber-400 text-amber-500"
                    />
                    <UBadge
                      v-if="cluster.isSprintCluster"
                      color="primary"
                      variant="soft"
                      class="rounded-full"
                    >
                      Sprint
                    </UBadge>
                  </div>
                  <div class="text-nowrap mt-1 text-sm text-slate-500">
                    /{{ cluster.slug || "-" }}
                  </div>
                </div>
              </div>
            </td>
            <!-- <td class="px-4 py-3 text-nowrap text-slate-600">
              <div class="flex items-center gap-2">
                <UBadge
                  color="info"
                  variant="soft"
                  class="rounded-md px-2.5 py-1 font-bold tracking-wide"
                  :color="cluster.parentCluster ? 'neutral' : 'primary'"
                >
                  {{ cluster.parentCluster ? "S" : "P" }}
                </UBadge>
                <span v-if="cluster.parentCluster">
                  {{ cluster.parentCluster.name }}
                </span>
              </div>
            </td> -->
            <td class="px-4 py-3">
              <UBadge
                variant="soft"
                class="whitespace-nowrap rounded-full px-3 py-1 ring-1 ring-inset"
                :class="getHierarchyColorClass(cluster, 'badge')"
              >
                {{ cluster.primaryKeyword }}
              </UBadge>
            </td>
            <!-- <td class="px-4 py-3 text-slate-600">
              {{ cluster.description || "-" }}
            </td> -->
            <td class="px-4 py-3">
              <div class="whitespace-nowrap flex justify-end gap-2">
                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-eye"
                  :to="`/clusters/${cluster.id}`"
                />
                <UButton
                  size="sm"
                  color="primary"
                  variant="soft"
                  :icon="
                    cluster.isSprintCluster
                      ? 'i-lucide-flag-off'
                      : 'i-lucide-flag'
                  "
                  class="hidden"
                  @click="$emit('toggleSprintCluster', cluster)"
                >
                  <!-- {{ cluster.isSprintCluster ? "Retirer sprint" : "Sprint" }} -->
                </UButton>
                <UButton
                  size="sm"
                  color="warning"
                  variant="soft"
                  :icon="
                    cluster.isFavorite ? 'i-lucide-star-off' : 'i-lucide-star'
                  "
                  class="hidden"
                  @click="$emit('toggleFavorite', cluster)"
                >
                  <!-- {{ cluster.isFavorite ? "Retirer" : "Favori" }} -->
                </UButton>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-pencil"
                  @click="$emit('edit', cluster)"
                >
                  <!-- <span class="hidden md:inline">Modifier</span> -->
                </UButton>
                <UButton
                  size="sm"
                  color="error"
                  variant="soft"
                  icon="i-lucide-trash-2"
                  :loading="deletingClusterId === cluster.id"
                  @click="$emit('delete', cluster)"
                >
                  <!-- <span class="hidden md:inline">Supprimer</span> -->
                </UButton>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
