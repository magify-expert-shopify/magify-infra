<script setup lang="ts">
type ViewModeItem = {
  value: string;
  label: string;
  icon: string;
};

const props = withDefaults(
  defineProps<{
    modelValue: string;
    items: ViewModeItem[];
    ariaLabel?: string;
  }>(),
  {
    ariaLabel: "Changer le mode d'affichage",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

function selectValue(value: string) {
  emit("update:modelValue", value);
}
</script>

<template>
  <div
    class="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
    role="group"
    :aria-label="props.ariaLabel"
  >
    <button
      v-for="item in props.items"
      :key="item.value"
      type="button"
      class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition"
      :class="
        props.modelValue === item.value
          ? 'bg-sky-700 text-white'
          : 'text-slate-600 hover:bg-slate-50'
      "
      @click="selectValue(item.value)"
    >
      <UIcon :name="item.icon" class="h-4 w-4" />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>
