<script setup lang="ts">
import type { BusinessPositioningSettings } from "~/types/settings";
import BusinessPositioningForm from "~/components/settings/BusinessPositioningForm.vue";

async function handleSaved(value: BusinessPositioningSettings) {
  if (!value.isComplete) {
    return;
  }

  await navigateTo("/");
}
</script>

<template>
  <section class="mx-auto max-w-4xl space-y-8 py-6">
    <header class="space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
        Onboarding
      </p>
      <div class="space-y-2">
        <h1 class="text-3xl font-semibold text-slate-900">
          Posons les bases de votre positionnement
        </h1>
        <p class="max-w-3xl text-sm leading-6 text-slate-500">
          Renseignez l’URL de votre site puis laissez l’IA vous proposer une
          première base de réponses. Vous pourrez ensuite modifier ces réponses
          à tout moment dans les
          paramètres.
        </p>
      </div>
    </header>

    <BusinessPositioningForm
      title="Votre activité en 4 réponses"
      description="Plus vos réponses sont précises, plus les mots-clés extraits seront utiles ensuite."
      submit-label="Terminer l’onboarding"
      saving-label="Finalisation..."
      idle-message="Une fois enregistré, l’onboarding ne réapparaîtra plus tant que ces réponses restent remplies."
      success-message="Onboarding enregistré."
      @saved="handleSaved"
    />
  </section>
</template>
