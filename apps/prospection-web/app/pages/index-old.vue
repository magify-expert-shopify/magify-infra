<script setup lang="ts">
const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const prospectUrl = ref("");
const isSubmitting = ref(false);
const clipboardButtonState = ref<"idle" | "copied">("idle");
let clipboardButtonTimer: ReturnType<typeof setTimeout> | null = null;
const dragDepth = ref(0);
const dragState = ref<"idle" | "hover" | "uploading" | "error">("idle");
const fileInputRef = ref<HTMLInputElement | null>(null);

const {
  workflowPanelRef,
  workflowTargetKind,
  workflowImportId,
  workflowUrlId,
  workflowSummary,
  workflowExistingUrlsDismissed,
  workflowAllRescanDone,
  workflowError,
  workflowRunning,
  workflowStep,
  workflowFinished,
  workflowSteps,
  workflowDisplayKind,
  workflowProgress,
  workflowHasOnlyExistingUrls,
  workflowProspects,
  startWorkflow,
  runCurrentWorkflow,
  getApiErrorMessage,
} = useHomeWorkflow();

function extractFirstUrl(text: string) {
  const match = String(text || "").match(/https?:\/\/[^\s<>"'`]+/i);
  return match ? match[0].replace(/[),.;:!?]+$/g, "") : "";
}

function extractUrls(text: string) {
  const matches = String(text || "").match(/https?:\/\/[^\s<>"'`]+/gi) || [];
  return [
    ...new Set(
      matches
        .map((url) => url.replace(/[),.;:!?]+$/g, "").trim())
        .filter(Boolean),
    ),
  ];
}

function handleProspectPaste(event: ClipboardEvent) {
  event.preventDefault();

  const pastedText = event.clipboardData?.getData("text/plain") || "";
  const extractedUrl = extractFirstUrl(pastedText);
  prospectUrl.value = extractedUrl || pastedText.trim();

  if (extractedUrl && !isSubmitting.value && !workflowRunning.value) {
    void startWorkflow([extractedUrl], "paste");
  }
}

watch(prospectUrl, (value) => {
  if (!value) {
    return;
  }

  const extractedUrl = extractFirstUrl(value);
  if (extractedUrl && extractedUrl !== value) {
    prospectUrl.value = extractedUrl;
  }
});

function setClipboardButtonCopied() {
  clipboardButtonState.value = "copied";

  if (clipboardButtonTimer) {
    window.clearTimeout(clipboardButtonTimer);
  }

  clipboardButtonTimer = window.setTimeout(() => {
    clipboardButtonState.value = "idle";
    clipboardButtonTimer = null;
  }, 3000);
}

async function addProspectFromClipboard() {
  if (isSubmitting.value || workflowRunning.value) {
    return;
  }

  isSubmitting.value = true;

  try {
    const clipboardText = await navigator.clipboard.readText().catch(() => "");
    const clipboardUrls = extractUrls(clipboardText);
    const inputUrls = extractUrls(prospectUrl.value);
    const finalUrls = clipboardUrls.length > 0 ? clipboardUrls : inputUrls;

    if (finalUrls.length === 0) {
      throw new Error("Aucune URL trouvée dans le presse-papier ou le champ.");
    }

    setClipboardButtonCopied();
    prospectUrl.value = finalUrls[0] || prospectUrl.value;
    await startWorkflow(
      finalUrls,
      clipboardUrls.length > 0 ? "clipboard" : "manual",
    );
    prospectUrl.value = "";
  } catch (error) {
    const message = getApiErrorMessage(
      error,
      "Impossible de lire le presse-papier.",
    );
    workflowError.value = message;
    dragState.value = "error";
    notifications.add({
      kind: "error",
      title: "Ajout prospect échoué",
      message,
    });
  } finally {
    isSubmitting.value = false;
  }
}

async function handleFileDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dragDepth.value = 0;

  const file = event.dataTransfer?.files?.[0];
  if (!file) {
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    dragState.value = "error";
    workflowError.value =
      "Le fichier est trop volumineux. Taille maximale: 5 Mo.";
    notifications.add({
      kind: "error",
      title: "Fichier trop volumineux",
      message: workflowError.value,
    });
    return;
  }

  try {
    await processDroppedFile(file);
  } catch (error) {
    const message = getApiErrorMessage(error, "Impossible de lire le fichier.");
    workflowError.value = message;
    dragState.value = "error";
  }
}

function openFilePicker() {
  if (isSubmitting.value || workflowRunning.value) {
    return;
  }

  fileInputRef.value?.click();
}

async function handleFilePickerChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];

  if (!input) {
    return;
  }

  input.value = "";

  if (!file) {
    return;
  }

  try {
    await processDroppedFile(file);
  } catch (error) {
    const message = getApiErrorMessage(error, "Impossible de lire le fichier.");
    workflowError.value = message;
    dragState.value = "error";
  }
}

async function processDroppedFile(file: File) {
  if (file.size > 5 * 1024 * 1024) {
    dragState.value = "error";
    workflowError.value =
      "Le fichier est trop volumineux. Taille maximale: 5 Mo.";
    notifications.add({
      kind: "error",
      title: "Fichier trop volumineux",
      message: workflowError.value,
    });
    return;
  }

  dragState.value = "uploading";
  workflowError.value = "";

  const text = await file.text();
  const urls = extractUrls(text);
  await startWorkflow(urls, file.name);
}

function handleDragEnter(event: DragEvent) {
  if (!Array.from(event.dataTransfer?.types || []).includes("Files")) {
    return;
  }

  dragDepth.value += 1;
  if (dragState.value === "error") {
    dragState.value = "idle";
  } else if (dragState.value !== "uploading") {
    dragState.value = "hover";
  }
}

function handleDragOver(event: DragEvent) {
  if (!Array.from(event.dataTransfer?.types || []).includes("Files")) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
}

function handleDragLeave(event: DragEvent) {
  if (!Array.from(event.dataTransfer?.types || []).includes("Files")) {
    return;
  }

  dragDepth.value = Math.max(0, dragDepth.value - 1);
  if (dragDepth.value === 0 && dragState.value === "hover") {
    dragState.value = "idle";
  }
}

const dropZoneClass = computed(() => {
  if (dragState.value === "uploading") {
    return "border-slate-300 bg-slate-50 text-slate-700";
  }

  if (dragState.value === "hover") {
    return "border-blue-400 bg-blue-50 text-slate-800 ring-2 ring-blue-200/70 shadow-sm shadow-blue-100/60";
  }

  if (dragState.value === "error") {
    return "border-red-200 bg-white text-slate-700";
  }

  if (dragState.value === "idle") {
    return "border-dashed border-slate-300 bg-white text-slate-700";
  }

  return "border-slate-300 bg-white text-slate-700";
});

function stepIcon(
  status: WorkflowStepStatus,
  outcome: WorkflowStepOutcome = "none",
) {
  if (status === "done" && outcome === "empty") return "i-lucide-circle-minus";
  if (status === "done") return "i-lucide-circle-check-big";
  if (status === "running") return "i-lucide-loader-2";
  if (status === "error") return "i-lucide-circle-x";
  return "i-lucide-circle";
}
</script>

<template>
  <main class="min-h-screen bg-background text-slate-900">
    <section class="w-full px-6 py-8 lg:px-8">
      <div class="grid gap-6 lg:grid-cols-2">
        <div>
          <div class="flex items-center gap-3">
            <span
              class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white"
            >
              1
            </span>
            <div
              class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
            >
              URL du site / Import
            </div>
          </div>

          <div
            class="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div class="space-y-2">
              <label class="text-xs font-medium text-slate-700"
                >URL du site</label
              >
              <div class="relative">
                <UIcon
                  name="i-lucide-link"
                  class="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <UInput
                  v-model="prospectUrl"
                  size="lg"
                  placeholder="https://example.com"
                  class="w-full pl-11"
                  @paste="handleProspectPaste"
                />
              </div>
            </div>

            <div class="flex flex-col gap-3 sm:flex-row">
              <UButton
                class="cursor-pointer"
                color="primary"
                variant="solid"
                size="lg"
                icon="i-lucide-clipboard-paste"
                :loading="isSubmitting || workflowRunning"
                :disabled="isSubmitting || workflowRunning"
                @click="addProspectFromClipboard()"
              >
                {{
                  clipboardButtonState === "copied"
                    ? "Collé"
                    : "Coller et lancer"
                }}
              </UButton>

              <UButton
                color="neutral"
                variant="soft"
                size="lg"
                icon="i-lucide-users"
                to="/prospects"
              >
                Voir les prospects
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                size="lg"
                icon="i-lucide-table"
                to="/urls"
              >
                Voir les sites
              </UButton>
            </div>

            <input
              ref="fileInputRef"
              type="file"
              class="hidden"
              accept=".txt,.csv,.md,.log,.json,application/pdf,text/plain"
              @change="handleFilePickerChange"
            />

            <div
              class="cursor-pointer rounded-xl border px-6 py-8 shadow-sm transition-colors duration-300"
              :class="dropZoneClass"
              role="button"
              tabindex="0"
              @click="openFilePicker"
              @keydown.enter.prevent="openFilePicker"
              @keydown.space.prevent="openFilePicker"
              @dragenter="handleDragEnter"
              @dragover="handleDragOver"
              @dragleave="handleDragLeave"
              @drop="handleFileDrop"
            >
              <div
                class="flex flex-col items-center justify-center text-center"
              >
                <UIcon
                  :name="
                    dragState === 'uploading'
                      ? 'i-lucide-loader-2'
                      : dragState === 'error'
                        ? 'i-lucide-circle-x'
                        : dragState === 'hover'
                          ? 'i-lucide-file-up'
                          : 'i-lucide-upload'
                  "
                  class="mb-3 h-8 w-8"
                  :class="dragState === 'uploading' ? 'animate-spin' : ''"
                />

                <div class="text-base font-medium">
                  {{
                    dragState === "uploading"
                      ? "Import et enrichissement en cours"
                      : dragState === "error"
                        ? "L’import a rencontré une erreur"
                        : "Dépose un fichier ici"
                  }}
                </div>

                <p class="mt-2 max-w-lg text-xs leading-6 text-slate-500">
                  <Transition name="drop-text" mode="out-in">
                    <span
                      :key="`${workflowError}-${workflowSummary?.id || ''}-${workflowFinished}`"
                    >
                      {{
                        dragState === "idle" || dragState === "hover"
                          ? "Le fichier est lu côté front, puis seules les URLs détectées sont envoyées au serveur."
                          : workflowError ||
                            "Les étapes du CRM s’exécutent une à une."
                      }}
                    </span>
                  </Transition>
                </p>

                <div class="mt-6 text-xs text-slate-500">
                  Taille maximale: 5 Mo
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col">
          <div class="flex items-center gap-3">
            <span
              class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white"
            >
              2
            </span>
            <div
              class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"
            >
              Analyse
            </div>
          </div>
          <div
            class="mt-5 grow rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div
              ref="workflowPanelRef"
              v-if="workflowRunning || workflowFinished || workflowError"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="space-y-1">
                  <div
                    class="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500"
                  >
                    {{ workflowTargetKind === "url" ? "Site" : "Import" }} #{{
                      workflowTargetKind === "url"
                        ? workflowUrlId || "..."
                        : workflowImportId || "..."
                    }}
                  </div>
                  <div class="text-xs font-medium text-slate-900">
                    {{
                      workflowRunning
                        ? workflowStep === "idle"
                          ? "Préparation..."
                          : workflowSteps.find(
                              (step) => step.key === workflowStep,
                            )?.label || "Traitement..."
                        : workflowError
                          ? "Site déjà présent"
                          : workflowFinished
                            ? workflowHasOnlyExistingUrls &&
                              !workflowAllRescanDone
                              ? workflowTargetKind === "url"
                                ? "Site préparé"
                                : "Import préparé"
                              : "Enrichissement terminé"
                            : "Information"
                    }}
                  </div>
                </div>
                <div
                  v-if="
                    workflowRunning ||
                    (workflowFinished &&
                      (!workflowHasOnlyExistingUrls || workflowAllRescanDone))
                  "
                  class="text-xs text-slate-600"
                >
                  {{
                    workflowRunning || workflowFinished
                      ? `${workflowProgress.completed}/${workflowProgress.total}`
                      : ""
                  }}
                </div>
              </div>

              <div
                v-if="
                  workflowRunning ||
                  (workflowFinished &&
                    (!workflowHasOnlyExistingUrls || workflowAllRescanDone))
                "
                class="mt-4 h-2 overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  class="h-full rounded-full bg-slate-600 transition-[width] duration-700 ease-out"
                  :style="{
                    width: `${Math.max(10, workflowProgress.percent || (workflowFinished ? 100 : 10))}%`,
                  }"
                />
              </div>

              <div
                v-if="
                  workflowRunning ||
                  (workflowFinished &&
                    (!workflowHasOnlyExistingUrls || workflowAllRescanDone))
                "
                class="mt-4 grid gap-2"
              >
                <div
                  v-for="step in workflowSteps"
                  :key="step.key"
                  class="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <UIcon
                    :name="stepIcon(step.status, step.outcome)"
                    class="h-4 w-4"
                    :class="
                      step.status === 'running'
                        ? 'animate-spin text-slate-500'
                        : step.status === 'done' && step.outcome === 'empty'
                          ? 'text-slate-400'
                          : step.status === 'done'
                            ? 'text-emerald-600'
                            : step.status === 'error'
                              ? 'text-red-600'
                              : 'text-slate-400'
                    "
                  />
                  <div class="min-w-0 flex-1">
                    <div class="font-medium text-slate-900">
                      {{ step.label }}
                    </div>
                    <div class="text-xs text-slate-500">
                      {{
                        step.detail ||
                        (step.status === "pending"
                          ? "En attente"
                          : step.status === "running"
                            ? "En cours"
                            : step.status === "done"
                              ? "Terminé"
                              : "Erreur")
                      }}
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="
                  workflowSummary &&
                  !workflowRunning &&
                  !workflowExistingUrlsDismissed &&
                  workflowSummary.existingUrls > 0
                "
                class="mt-4 rounded-lg px-4 py-3 text-xs"
                :class="
                  workflowHasOnlyExistingUrls
                    ? 'border border-rose-200 bg-rose-50 text-rose-900'
                    : 'border border-amber-200 bg-amber-50 text-amber-900'
                "
              >
                <div
                  class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div class="space-y-1">
                    <div class="font-medium">
                      {{
                        workflowHasOnlyExistingUrls
                          ? workflowSummary.totalUrls === 1
                            ? "Ce site est déjà présent."
                            : "Le lot ne contient que des sites déjà présents."
                          : `${workflowSummary.existingUrls} URL(s) existaient déjà en base`
                      }}
                    </div>
                    <div class="text-xs uppercase tracking-wide opacity-80">
                      {{ workflowSummary.existingUrls }} doublon(s) trouvé(s)
                    </div>
                    <div class="leading-6">
                      {{
                        workflowHasOnlyExistingUrls
                          ? workflowSummary.totalUrls === 1
                            ? `Par défaut, aucune nouvelle URL n’est prise en charge, et les doublons sont ignorés pour éviter d’écraser les données déjà enrichies.`
                            : `Par défaut, 0 nouvelle(s) URL(s) sont prises en charge, et les doublons sont ignorés pour éviter d’écraser les données déjà enrichies.`
                          : `Par défaut, ${workflowSummary.totalUrls - workflowSummary.existingUrls} nouvelle(s) URL(s) sont prises en charge, et les doublons sont ignorés pour éviter d’écraser les données déjà enrichies.`
                      }}
                    </div>
                  </div>
                  <div
                    v-if="!workflowAllRescanDone"
                    class="flex items-center gap-2"
                  >
                    <UButton
                      v-if="!workflowHasOnlyExistingUrls"
                      color="primary"
                      variant="solid"
                      size="sm"
                      icon="i-lucide-refresh-cw"
                      :disabled="workflowRunning"
                      :loading="workflowRunning"
                      @click="runCurrentWorkflow(true, 'existing')"
                    >
                      Rescanner aussi
                    </UButton>
                    <UButton
                      color="neutral"
                      variant="outline"
                      size="sm"
                      icon="i-lucide-rotate-cw"
                      :disabled="workflowRunning"
                      :loading="workflowRunning"
                      @click="runCurrentWorkflow(true, 'all')"
                    >
                      {{
                        workflowHasOnlyExistingUrls &&
                        workflowSummary.totalUrls === 1
                          ? "Rescanner cette URL"
                          : "Tout rescanner"
                      }}
                    </UButton>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      icon="i-lucide-x"
                      :disabled="workflowRunning"
                      @click="workflowExistingUrlsDismissed = true"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <HomeWebSiteDeck :prospects="workflowProspects" />
  </main>
</template>

<style scoped>
.drop-text-enter-active,
.drop-text-leave-active {
  transition:
    opacity 280ms ease,
    transform 280ms ease;
}

.drop-text-enter-from,
.drop-text-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
