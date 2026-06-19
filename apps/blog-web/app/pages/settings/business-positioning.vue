<script setup lang="ts">
import BusinessPositioningForm from "~/components/settings/BusinessPositioningForm.vue";
</script>

<template>
  <BusinessPositioningForm
    title="Positionnement business"
    description="Ces réponses servent de référence éditoriale sur ce que vous vendez, vos points forts et les problèmes que vous résolvez."
    :allow-extract-keywords="true"
    submit-label="Enregistrer et extraire"
    saving-label="Enregistrement..."
    idle-message="Vous pouvez modifier ces réponses à tout moment depuis les paramètres."
    success-message="Positionnement mis à jour."
  />
</template>
