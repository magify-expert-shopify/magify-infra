<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
  }>(),
  {
    placeholder: "folder-kanban",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const iconPreviewName = computed(() => {
  const normalized = normalizeIconName(props.modelValue);

  if (!normalized) {
    return "i-lucide-folder-kanban";
  }

  return `i-lucide-${normalized}`;
});

function normalizeIconName(value: string) {
  return value
    .replace(/^i-lucide-/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase()
    .trim()
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function onInput(event: Event) {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  emit("update:modelValue", normalizeIconName(target.value));
}
</script>

<template>
  <div class="block">
    <div
      class="flex items-center overflow-hidden rounded-2xl border border-slate-200 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100"
    >
      <span
        class="shrink-0 border-r border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
      >
        i-lucide-
      </span>
      <input
        :value="modelValue"
        type="text"
        :placeholder="placeholder"
        class="w-full px-4 py-3 text-sm text-slate-900 outline-none"
        @input="onInput"
      />
      <span
        class="flex h-12 w-12 shrink-0 items-center justify-center border-l border-slate-200 bg-slate-50 text-slate-600"
      >
        <UIcon :name="iconPreviewName" class="h-5 w-5" />
      </span>
    </div>
  </div>
</template>
