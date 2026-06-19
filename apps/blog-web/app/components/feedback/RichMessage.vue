<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    tone?: "info" | "success" | "warning" | "error";
    title?: string;
    description?: string;
    details?: string | null;
    icon?: string | null;
    actionLabel?: string | null;
    actionIcon?: string | null;
  }>(),
  {
    tone: "info",
    title: "",
    description: "",
    details: null,
    icon: null,
    actionLabel: null,
    actionIcon: null,
  },
);

defineEmits<{
  action: [];
}>();

const toneConfig = computed(() => {
  if (props.tone === "error") {
    return {
      wrapper: "border-red-200 bg-red-50",
      iconWrapper: "bg-red-100",
      iconClass: "text-red-600",
      titleClass: "text-red-700",
      descriptionClass: "text-red-600",
      defaultTitle: "Une erreur est survenue",
      defaultDescription: "Impossible de récupérer les données demandées.",
      defaultIcon: "i-lucide-alert-circle",
      buttonColor: "error" as const,
    };
  }

  if (props.tone === "success") {
    return {
      wrapper: "border-emerald-200 bg-emerald-50",
      iconWrapper: "bg-emerald-100",
      iconClass: "text-emerald-600",
      titleClass: "text-emerald-700",
      descriptionClass: "text-emerald-600",
      defaultTitle: "Tout est prêt",
      defaultDescription: "L’action s’est bien déroulée.",
      defaultIcon: "i-lucide-circle-check-big",
      buttonColor: "success" as const,
    };
  }

  if (props.tone === "warning") {
    return {
      wrapper: "border-amber-200 bg-amber-50",
      iconWrapper: "bg-amber-100",
      iconClass: "text-amber-600",
      titleClass: "text-amber-700",
      descriptionClass: "text-amber-700",
      defaultTitle: "Attention",
      defaultDescription: "Une vérification supplémentaire est recommandée.",
      defaultIcon: "i-lucide-triangle-alert",
      buttonColor: "warning" as const,
    };
  }

  return {
    wrapper: "border-sky-200 bg-sky-50",
    iconWrapper: "bg-sky-100",
    iconClass: "text-sky-600",
    titleClass: "text-sky-800",
    descriptionClass: "text-sky-700",
    defaultTitle: "Information",
    defaultDescription: "Quelques détails utiles à garder en tête.",
    defaultIcon: "i-lucide-info",
    buttonColor: "info" as const,
  };
});

const resolvedIcon = computed(() => props.icon || toneConfig.value.defaultIcon);
const resolvedTitle = computed(() => props.title || toneConfig.value.defaultTitle);
const resolvedDescription = computed(
  () => props.description || toneConfig.value.defaultDescription,
);
const resolvedActionIcon = computed(
  () => props.actionIcon || "i-lucide-refresh-cw",
);
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-2xl border p-4"
    :class="toneConfig.wrapper"
    :title="props.details || undefined"
  >
    <div
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      :class="toneConfig.iconWrapper"
    >
      <UIcon
        :name="resolvedIcon"
        class="h-5 w-5"
        :class="toneConfig.iconClass"
      />
    </div>

    <div class="space-y-1">
      <p class="text-sm font-semibold" :class="toneConfig.titleClass">
        {{ resolvedTitle }}
      </p>

      <p class="text-sm" :class="toneConfig.descriptionClass">
        {{ resolvedDescription }}
      </p>

      <div v-if="$slots.default" class="pt-1">
        <slot />
      </div>

      <UButton
        v-if="actionLabel"
        :color="toneConfig.buttonColor"
        variant="soft"
        size="sm"
        :icon="resolvedActionIcon"
        class="mt-2"
        @click="$emit('action')"
      >
        {{ actionLabel }}
      </UButton>
    </div>
  </div>
</template>
