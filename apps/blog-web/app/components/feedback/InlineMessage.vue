<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    tone?: "info" | "success" | "warning" | "error";
    icon?: string | null;
    details?: string | null;
  }>(),
  {
    tone: "info",
    icon: null,
    details: null,
  },
);

const toneClasses = computed(() => {
  if (props.tone === "error") {
    return {
      wrapper: "text-red-600",
      icon: "i-lucide-circle-alert",
    };
  }

  if (props.tone === "success") {
    return {
      wrapper: "text-emerald-700",
      icon: "i-lucide-circle-check-big",
    };
  }

  if (props.tone === "warning") {
    return {
      wrapper: "text-amber-700",
      icon: "i-lucide-triangle-alert",
    };
  }

  return {
    wrapper: "text-slate-500",
    icon: "i-lucide-info",
  };
});

const resolvedIcon = computed(() => props.icon || toneClasses.value.icon);
const role = computed(() =>
  props.tone === "error" || props.tone === "warning" ? "alert" : "status",
);
</script>

<template>
  <p
    class="flex items-start gap-2 text-sm leading-6"
    :class="toneClasses.wrapper"
    :role="role"
    :title="props.details || undefined"
  >
    <UIcon
      :name="resolvedIcon"
      class="mt-0.5 size-4 shrink-0"
      aria-hidden="true"
    />
    <span>
      <slot />
    </span>
  </p>
</template>
