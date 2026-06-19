<script setup lang="ts">
import type {
  BlogSyncAction,
  BlogSyncApplyOperation,
  BlogSyncCandidate,
  BlogSyncPreview,
  BlogSyncPropertyKey,
  BlogSyncValueSource,
} from "~/types/blog-sync";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  applied: [];
}>();

const { getShopifyBlogSyncPreview, applyShopifyBlogSync } = useBlogs();
const { showErrorToast, showSuccessToast } = useAppToast();

const isLoadingPreview = ref(false);
const isApplying = ref(false);
const preview = ref<BlogSyncPreview | null>(null);
const selectedActions = ref<Record<string, BlogSyncAction>>({});
const configCandidateId = ref<string | null>(null);
const configTargetBlogId = ref<string | null>(null);
const configPropertySources = ref<
  Record<string, Partial<Record<BlogSyncPropertyKey, BlogSyncValueSource>>>
>({});
const feedbackMessage = ref("");
const feedbackTone = ref<"info" | "success" | "warning" | "error">("info");

const actionOptions = [
  {
    label: "Créer un blog",
    value: "create_new",
  },
  {
    label: "Associer à un blog existant",
    value: "associate_existing",
  },
  {
    label: "Synchroniser le blog local",
    value: "sync_existing",
  },
  {
    label: "Ne rien faire",
    value: "ignore",
  },
];

const propertyOptions = [
  { label: "Blog local", value: "local" },
  { label: "Blog Shopify", value: "shopify" },
];

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      resetState();
      return;
    }

    void loadPreview();
  },
  { immediate: true },
);

const candidates = computed(() => preview.value?.candidates ?? []);
const existingBlogs = computed(() => preview.value?.existingBlogs ?? []);
const existingBlogOptions = computed(() =>
  existingBlogs.value.map((blog) => ({
    ...blog,
    label: blog.title || blog.name || blog.baseUrl,
  })),
);
const pendingCount = computed(
  () =>
    candidates.value.filter(
      (candidate) => (selectedActions.value[candidate.shopifyBlog.id] ?? candidate.defaultAction) !== "ignore",
    ).length,
);

function resetState() {
  isLoadingPreview.value = false;
  isApplying.value = false;
  preview.value = null;
  selectedActions.value = {};
  configCandidateId.value = null;
  configTargetBlogId.value = null;
  configPropertySources.value = {};
  feedbackMessage.value = "";
  feedbackTone.value = "info";
}

async function loadPreview() {
  if (isLoadingPreview.value) {
    return;
  }

  try {
    isLoadingPreview.value = true;
    feedbackMessage.value = "";
    preview.value = await getShopifyBlogSyncPreview();
    selectedActions.value = Object.fromEntries(
      preview.value.candidates.map((candidate) => [
        candidate.shopifyBlog.id,
        candidate.defaultAction,
      ]),
    );
  } catch (error) {
    feedbackTone.value = "error";
    feedbackMessage.value =
      error instanceof Error ? error.message : "Impossible de charger l'aperçu.";
  } finally {
    isLoadingPreview.value = false;
  }
}

function closeModal() {
  if (isApplying.value) {
    return;
  }

  emit("update:open", false);
}

function getCandidate(candidateId: string) {
  return candidates.value.find((candidate) => candidate.shopifyBlog.id === candidateId) ?? null;
}

function getCandidateAction(candidate: BlogSyncCandidate) {
  return selectedActions.value[candidate.shopifyBlog.id] ?? candidate.defaultAction;
}

function setCandidateAction(candidate: BlogSyncCandidate, action: BlogSyncAction) {
  selectedActions.value = {
    ...selectedActions.value,
    [candidate.shopifyBlog.id]: action,
  };

  if (action === "associate_existing" || action === "sync_existing") {
    openConfig(candidate);
  }
}

function openConfig(candidate: BlogSyncCandidate) {
  configCandidateId.value = candidate.shopifyBlog.id;
  configTargetBlogId.value =
    candidate.localBlog?.id ?? existingBlogs.value[0]?.id ?? null;

  const defaultSources = candidate.comparisons.reduce(
    (accumulator, comparison) => {
      if (!candidate.localBlog) {
        accumulator[comparison.key] = "shopify";
        return accumulator;
      }

      accumulator[comparison.key] = comparison.isDifferent ? "shopify" : "local";
      return accumulator;
    },
    {} as Partial<Record<BlogSyncPropertyKey, BlogSyncValueSource>>,
  );

  configPropertySources.value = {
    ...configPropertySources.value,
    [candidate.shopifyBlog.id]: {
      name: "shopify",
      title: "shopify",
      slug: "shopify",
      baseUrl: "shopify",
      feedUrl: "shopify",
      platform: "shopify",
      ...defaultSources,
      ...(configPropertySources.value[candidate.shopifyBlog.id] ?? {}),
    },
  };
}

function closeConfig() {
  configCandidateId.value = null;
}

const configCandidate = computed(() =>
  configCandidateId.value ? getCandidate(configCandidateId.value) : null,
);

const canSaveConfig = computed(() => {
  if (!configCandidate.value) {
    return false;
  }

  const action = getCandidateAction(configCandidate.value);
  if (action === "associate_existing") {
    return Boolean(configTargetBlogId.value);
  }

  return action === "sync_existing";
});

function updatePropertySource(key: BlogSyncPropertyKey, source: BlogSyncValueSource) {
  if (!configCandidate.value) {
    return;
  }

  configPropertySources.value = {
    ...configPropertySources.value,
    [configCandidate.value.shopifyBlog.id]: {
      ...(configPropertySources.value[configCandidate.value.shopifyBlog.id] ?? {}),
      [key]: source,
    },
  };
}

function saveConfig() {
  if (!configCandidate.value) {
    return;
  }

  if (configTargetBlogId.value) {
    configTargetBlogId.value = configTargetBlogId.value.trim() || null;
  }

  closeConfig();
}

function formatValue(value: string | null) {
  return value?.trim() || "—";
}

function buildOperations(): BlogSyncApplyOperation[] {
  return candidates.value
    .map((candidate) => {
      const action = getCandidateAction(candidate);

      if (action === "ignore") {
        return {
          shopifyBlogId: candidate.shopifyBlog.id,
          action,
        } satisfies BlogSyncApplyOperation;
      }

      if (action === "create_new") {
        return {
          shopifyBlogId: candidate.shopifyBlog.id,
          action,
        } satisfies BlogSyncApplyOperation;
      }

      const propertySources =
        configPropertySources.value[candidate.shopifyBlog.id] ?? {};

      return {
        shopifyBlogId: candidate.shopifyBlog.id,
        action,
        targetBlogId:
          action === "associate_existing"
            ? configTargetBlogId.value
            : candidate.localBlog?.id ?? null,
        propertySources,
      } satisfies BlogSyncApplyOperation;
    })
    .filter(Boolean);
}

async function applySync() {
  if (isApplying.value || !preview.value) {
    return;
  }

  if (configCandidateId.value) {
    feedbackTone.value = "warning";
    feedbackMessage.value =
      "Termine la configuration du blog ouvert avant d'appliquer la synchronisation.";
    return;
  }

  try {
    isApplying.value = true;
    feedbackMessage.value = "";

    const result = await applyShopifyBlogSync({
      operations: buildOperations(),
    });

    showSuccessToast(
      "Synchronisation Shopify préparée",
      `${result.createdCount} créé(s), ${result.associatedCount} associé(s), ${result.synchronizedCount} synchronisé(s), ${result.ignoredCount} ignoré(s).`,
    );
    emit("applied");
    emit("update:open", false);
  } catch (error) {
    feedbackTone.value = "error";
    feedbackMessage.value =
      error instanceof Error
        ? error.message
        : "Impossible d'appliquer la synchronisation.";
    showErrorToast(
      "Impossible d'appliquer la synchronisation",
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.",
    );
  } finally {
    isApplying.value = false;
  }
}
</script>

<template>
  <UModal
    :open="open"
    :dismissible="!isApplying"
    :ui="{ content: 'sm:max-w-6xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="rounded-3xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-slate-900">
              Synchronisation des blogs Shopify
            </h2>
            <p class="text-sm leading-6 text-slate-500">
              Choisis une action pour chaque blog Shopify susceptible d’être importé ou aligné
              avec la base locale, avant toute écriture en base.
            </p>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            :disabled="isApplying"
            @click="closeModal"
          />
        </div>

        <FeedbackInlineMessage
          v-if="feedbackMessage"
          :tone="feedbackTone"
          class="mt-4"
        >
          {{ feedbackMessage }}
        </FeedbackInlineMessage>

        <div class="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
          <UBadge color="primary" variant="soft">
            {{ candidates.length }} candidat(s)
          </UBadge>
          <UBadge color="neutral" variant="soft">
            {{ pendingCount }} action(s) active(s)
          </UBadge>
        </div>

        <div class="mt-5 max-h-[60vh] space-y-4 overflow-auto pr-1">
          <section
            v-for="candidate in candidates"
            :key="candidate.shopifyBlog.id"
            class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <p class="text-base font-semibold text-slate-900">
                    {{ candidate.shopifyBlog.title }}
                  </p>
                  <UBadge color="neutral" variant="soft">
                    {{ candidate.matchedBy ? `match ${candidate.matchedBy}` : "nouveau" }}
                  </UBadge>
                </div>
                <p class="text-sm text-slate-500">
                  {{ candidate.shopifyBlog.baseUrl }}
                </p>
                <p v-if="candidate.localBlog" class="text-xs text-slate-500">
                  Blog local actuel: {{ candidate.localBlog.title || candidate.localBlog.name || candidate.localBlog.baseUrl }}
                </p>
              </div>

              <div class="min-w-[18rem] space-y-2">
                <USelect
                  :model-value="getCandidateAction(candidate)"
                  :items="
                    candidate.localBlog
                      ? actionOptions.filter((item) => ['sync_existing', 'ignore'].includes(item.value))
                      : actionOptions.filter((item) => ['create_new', 'associate_existing', 'ignore'].includes(item.value))
                  "
                  value-key="value"
                  label-key="label"
                  size="lg"
                  @update:model-value="setCandidateAction(candidate, $event as BlogSyncAction)"
                />

                <UButton
                  v-if="getCandidateAction(candidate) !== 'ignore'"
                  color="neutral"
                  variant="soft"
                  class="w-full justify-center"
                  @click="openConfig(candidate)"
                >
                  Configurer
                </UButton>
              </div>
            </div>

            <div class="mt-4 grid gap-2 md:grid-cols-2">
              <div
                v-for="comparison in candidate.comparisons"
                :key="comparison.key"
                class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {{ comparison.label }}
                  </p>
                  <UBadge :color="comparison.isDifferent ? 'warning' : 'success'" variant="soft">
                    {{ comparison.isDifferent ? "Différent" : "Identique" }}
                  </UBadge>
                </div>
                <p class="mt-2 text-xs text-slate-500">
                  Local: <span class="font-medium text-slate-700">{{ formatValue(comparison.localValue) }}</span>
                </p>
                <p class="text-xs text-slate-500">
                  Shopify: <span class="font-medium text-slate-700">{{ formatValue(comparison.shopifyValue) }}</span>
                </p>
              </div>
            </div>
          </section>
        </div>

        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <UButton color="neutral" variant="soft" @click="closeModal">
            Annuler
          </UButton>
          <UButton
            color="primary"
            icon="i-lucide-refresh-cw"
            :loading="isApplying"
            :disabled="!candidates.length || isLoadingPreview || isApplying"
            @click="applySync"
          >
            Appliquer
          </UButton>
        </div>
      </div>
    </template>
  </UModal>

  <UModal
    :open="Boolean(configCandidate)"
    :dismissible="!isApplying"
    :ui="{ content: 'sm:max-w-4xl' }"
    @update:open="!$event && closeConfig()"
  >
    <template #content>
      <div v-if="configCandidate" class="rounded-3xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-slate-900">
              Configurer le blog
            </h3>
            <p class="text-sm text-slate-500">
              Choisis le blog cible et la source de vérité pour chaque propriété.
            </p>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            :disabled="isApplying"
            @click="closeConfig"
          />
        </div>

        <div class="mt-4 space-y-4">
          <div v-if="getCandidateAction(configCandidate) === 'associate_existing'">
            <p class="mb-2 text-sm font-medium text-slate-900">
              Blog local à associer
            </p>
            <USelect
              v-model="configTargetBlogId"
              :items="existingBlogOptions"
              value-key="id"
              label-key="label"
              size="lg"
              placeholder="Choisir un blog existant"
            />
          </div>

          <div>
            <p class="mb-2 text-sm font-medium text-slate-900">
              Source de vérité par propriété
            </p>
            <div class="space-y-3">
              <div
                v-for="comparison in configCandidate.comparisons"
                :key="comparison.key"
                class="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_12rem]"
              >
                <div class="space-y-1">
                  <p class="text-sm font-semibold text-slate-900">
                    {{ comparison.label }}
                  </p>
                  <p class="text-xs text-slate-500">
                    Local: {{ formatValue(comparison.localValue) }} | Shopify: {{ formatValue(comparison.shopifyValue) }}
                  </p>
                </div>

                <USelect
                  :model-value="
                    configPropertySources[configCandidate.shopifyBlog.id]?.[comparison.key] ?? 'shopify'
                  "
                  :items="propertyOptions"
                  value-key="value"
                  label-key="label"
                  size="lg"
                  @update:model-value="
                    updatePropertySource(
                      comparison.key,
                      $event as BlogSyncValueSource,
                    )
                  "
                />
              </div>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <UButton color="neutral" variant="soft" @click="closeConfig">
            Fermer
          </UButton>
          <UButton color="primary" :disabled="!canSaveConfig" @click="saveConfig">
            Enregistrer
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
