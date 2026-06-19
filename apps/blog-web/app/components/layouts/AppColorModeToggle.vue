<script setup lang="ts">
const colorMode = useColorMode();
const mounted = ref(false);

const isDarkMode = computed(() => colorMode.value === "dark");
const toggleIcon = computed(() =>
  mounted.value && isDarkMode.value ? "i-lucide-sun" : "i-lucide-moon",
);
const toggleLabel = computed(() =>
  mounted.value && isDarkMode.value
    ? "Passer en mode clair"
    : "Passer en mode sombre",
);

function toggleColorMode() {
  colorMode.preference = isDarkMode.value ? "light" : "dark";
}

onMounted(() => {
  mounted.value = true;
});
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    size="sm"
    square
    class="rounded-lg text-slate-500 hover:bg-slate-200 hover:text-slate-900"
    :icon="toggleIcon"
    :aria-label="toggleLabel"
    :title="toggleLabel"
    @click="toggleColorMode"
  />
</template>
