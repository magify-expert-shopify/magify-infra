<script setup lang="ts">
import type { ApiProspect } from "~/types/prospects";

const props = defineProps<{
  prospect: ApiProspect;
}>();

const emit = defineEmits<{
  (event: "relaunch", id: number): void;
  (event: "responded", id: number): void;
}>();

const route = useRoute();

const avatarSrc = computed(
  () => props.prospect.avatarUrl || props.prospect.linkedinImageUrl || "",
);
const displayName = computed(
  () => props.prospect.name || props.prospect.siteName || "Prospect",
);
const siteName = computed(
  () => props.prospect.siteName || "Site non renseigné",
);
const contactDateLabel = computed(() => {
  const rawDate = props.prospect.firstContactEmailSentAt;
  if (!rawDate) {
    return "Date de contact inconnue";
  }

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) {
    return "Date de contact inconnue";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
});
const editMailHref = computed(() => ({
  path: `/prospects/${props.prospect.id}/email-planifie`,
  query: route.query,
}));

function getInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "P"
  );
}
</script>

<template>
  <article
    class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
  >
    <div
      class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
    >
      <div class="flex min-w-0 items-center gap-4">
        <div
          class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200"
        >
          <img
            v-if="avatarSrc"
            :src="avatarSrc"
            :alt="displayName"
            class="h-full w-full object-cover object-center"
          />
          <span v-else class="text-xs font-semibold text-slate-500">
            {{ getInitials(displayName) }}
          </span>
        </div>

        <div class="min-w-0 space-y-1">
          <div class="truncate text-base font-semibold text-slate-900">
            {{ displayName }}
          </div>
          <div class="truncate text-xs text-slate-600">
            {{ siteName }}
          </div>
          <div
            class="text-xs font-medium uppercase tracking-[0.14em] text-slate-400"
          >
            Contacté le {{ contactDateLabel }}
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 md:justify-end">
        <UButton
          color="primary"
          variant="solid"
          size="sm"
          icon="i-lucide-send"
          @click="emit('relaunch', prospect.id)"
        >
          Renvoyer le mail
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-pencil"
          :to="editMailHref"
        >
          Éditer avant renvoi
        </UButton>
        <UButton
          color="success"
          variant="soft"
          size="sm"
          icon="i-lucide-message-circle-reply"
          @click="emit('responded', prospect.id)"
        >
          Le client m'a répondu
        </UButton>
      </div>
    </div>
  </article>
</template>
