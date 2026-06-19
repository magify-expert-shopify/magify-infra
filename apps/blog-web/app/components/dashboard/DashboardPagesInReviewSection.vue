<script setup lang="ts">
import { pageStatusLabels, pageTypeLabels, seoRoleLabels } from "~/constants/pages";
import type { PageListRecord } from "~/types/pages";

const props = defineProps<{
  pages: PageListRecord[];
  previewCount?: number;
  title?: string;
  description?: string;
  seeAllTo?: string | null;
  seeAllLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}>();

const visiblePages = computed(() =>
  typeof props.previewCount === "number"
    ? props.pages.slice(0, props.previewCount)
    : props.pages,
);

const shouldShowSeeAll = computed(
  () => Boolean(props.seeAllTo) && props.pages.length > visiblePages.value.length,
);
</script>

<template>
  <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">
          {{ title ?? "Pages en review" }}
        </h2>
        <p class="text-sm text-slate-500">
          {{
            description ??
            "Pages assignées pour relecture ou validation avant publication."
          }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <UBadge color="info" variant="soft">
          {{ pages.length }}
        </UBadge>

        <UButton
          v-if="shouldShowSeeAll"
          :to="seeAllTo ?? undefined"
          color="neutral"
          variant="soft"
          size="sm"
        >
          {{ seeAllLabel ?? "Voir tout" }}
        </UButton>
      </div>
    </div>

    <div v-if="visiblePages.length" class="mt-5 space-y-3">
      <NuxtLink
        v-for="page in visiblePages"
        :key="page.id"
        :to="`/review/${page.id}`"
        class="block rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4 transition hover:border-slate-300 hover:bg-white"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 space-y-2">
            <div class="space-y-1">
              <p class="truncate font-medium text-slate-900">
                {{ page.title }}
              </p>
              <p class="break-all text-sm text-slate-500">
                {{ page.url }}
              </p>
            </div>

            <p class="text-sm text-slate-600">
              {{ page.cluster?.name || "Sans cluster" }}
            </p>
          </div>

          <div class="flex flex-col items-end gap-2">
            <UBadge color="neutral" variant="soft">
              {{ pageStatusLabels[page.status ?? "IDEA"] ?? "Idée" }}
            </UBadge>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <UBadge color="primary" variant="soft">
            {{ pageTypeLabels[page.pageType] }}
          </UBadge>
          <UBadge color="info" variant="soft">
            {{ seoRoleLabels[page.seoRole] }}
          </UBadge>
          <UBadge color="neutral" variant="soft">
            {{ page._count?.keywords ?? 0 }} mot-clé(s)
          </UBadge>
        </div>
      </NuxtLink>
    </div>

    <div
      v-else
      class="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500"
    >
      <p class="font-medium text-slate-700">
        {{ emptyTitle ?? "Aucune page en review" }}
      </p>
      <p class="mt-1">
        {{
          emptyDescription ??
          "Quand une page t'est assignée en review, elle apparaîtra ici."
        }}
      </p>
    </div>
  </section>
</template>
