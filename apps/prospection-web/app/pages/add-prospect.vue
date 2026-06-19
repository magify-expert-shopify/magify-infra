<script setup lang="ts">
import type { AddProspectResponse } from "~/composables/useAddProspect";

const notifications = useNotificationsStore();
const {
  extractFirstUrl,
  resolveProspectUrl,
  addProspect: submitProspect,
} = useAddProspect();
const prospectUrl = ref("");
const isSubmitting = ref(false);
const submitMessage = ref("");
const submitTone = ref<"idle" | "success" | "error">("idle");
const submitDestination = ref<AddProspectResponse["destination"] | null>(null);
const submitButtonLabel = computed(() =>
  isSubmitting.value ? "Ajout du prospect" : "Ajouter le prospect",
);

function resetFeedback() {
  submitMessage.value = "";
  submitTone.value = "idle";
  submitDestination.value = null;
}

async function handleAddProspect(urlValue: string) {
  const normalized = resolveProspectUrl(urlValue);
  if (!normalized) {
    submitTone.value = "error";
    submitMessage.value = "Colle une URL valide pour ajouter un prospect.";
    return;
  }

  isSubmitting.value = true;
  resetFeedback();

  try {
    const result = await submitProspect(normalized);

    submitDestination.value = result.destination;
    submitTone.value = "success";
    submitMessage.value = result.message;

    notifications.add({
      kind: "success",
      title:
        result.outcome === "existing_prospect"
          ? "Prospect déjà lié"
          : "Ajout prospect",
      message: submitMessage.value,
      href: result.destination.href,
    });

    prospectUrl.value = "";
  } catch (error) {
    submitTone.value = "error";
    submitMessage.value =
      error instanceof Error
        ? error.message
        : "Impossible d’ajouter ce prospect.";
    notifications.add({
      kind: "error",
      title: "Ajout prospect échoué",
      message: submitMessage.value,
    });
  } finally {
    isSubmitting.value = false;
  }
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault();

  const pastedText = event.clipboardData?.getData("text/plain") || "";
  const extractedUrl = resolveProspectUrl(pastedText);

  prospectUrl.value = extractedUrl || pastedText.trim();

  if (extractedUrl) {
    void handleAddProspect(extractedUrl);
  }
}

function handleManualSubmit() {
  void handleAddProspect(prospectUrl.value);
}
</script>

<template>
  <LayoutPageShell
    title="Ajouter un prospect"
    description="Colle une URL dans le champ. Dès qu’elle est détectée, elle est ajoutée en base et le scan démarre automatiquement."
    max-width="3xl"
  >
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div class="space-y-3">
        <label class="text-xs font-medium text-slate-700"> URL du site </label>
        <div class="relative">
          <UIcon
            name="i-lucide-link"
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
          <UInput
            v-model="prospectUrl"
            size="md"
            placeholder="https://example.com"
            class="w-full pl-9"
            :disabled="isSubmitting"
            @paste="handlePaste"
            @keydown.enter.prevent="handleManualSubmit"
          />
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <UButton
            color="primary"
            variant="solid"
            icon="i-lucide-clipboard-paste"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            @click="handleManualSubmit"
          >
            {{ submitButtonLabel }}
          </UButton>

          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-trash-2"
            :disabled="isSubmitting"
            @click="prospectUrl = ''"
          >
            Vider
          </UButton>
        </div>

        <div
          v-if="submitMessage"
          class="rounded-lg border px-3 py-2 text-xs"
          :class="
            submitTone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          "
        >
          <div
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="leading-6">
              {{ submitMessage }}
            </p>

            <UButton
              v-if="submitTone === 'success' && submitDestination"
              :to="submitDestination.href"
              color="primary"
              variant="solid"
              icon="i-lucide-arrow-right"
            >
              {{ submitDestination.label }}
            </UButton>
          </div>
        </div>
      </div>
    </section>
  </LayoutPageShell>
</template>
