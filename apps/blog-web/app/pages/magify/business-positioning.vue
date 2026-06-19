<script setup lang="ts">
import BusinessPositioningForm from "~/components/settings/BusinessPositioningForm.vue";

const breadcrumbItems = [
  {
    label: "Magify",
    to: "/magify/business-positioning",
  },
  {
    label: "Positionnement business",
  },
];
</script>

<template>
  <section class="space-y-6">
    <UBreadcrumb :items="breadcrumbItems" class="text-slate-500" />

    <BusinessPositioningForm
      title="Positionnement business"
      description="Ces réponses servent de référence éditoriale sur ce que vous vendez, vos points forts et les problèmes que vous résolvez."
      :allow-extract-keywords="true"
      submit-label="Enregistrer et extraire"
      saving-label="Enregistrement..."
      idle-message="Vous pouvez modifier ces réponses à tout moment depuis les paramètres."
      success-message="Positionnement mis à jour."
    />
  </section>
</template>
