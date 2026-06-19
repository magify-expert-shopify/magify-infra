<script setup lang="ts">
import type { ApiProspect } from "~/types/prospects";

const props = defineProps<{
  prospect: ApiProspect;
}>();

const router = useRouter();

const emit = defineEmits<{
  (event: "drag-start", eventObject: DragEvent): void;
}>();

const emailOpen = ref(false);
const copied = ref(false);

const emailSubject = ref("Question rapide sur votre site");
const emailBody = ref(
  [
    "Objet : Question rapide sur votre site",
    "",
    `Bonjour ${props.prospect.firstName?.trim() || "Prénom"},`,
    "",
    "Je suis tombée sur votre site via vos publicités, j’ai pris 2 minutes pour regarder.",
    "",
    "Il y a un point qui peut freiner vos conversions actuellement :",
    "",
    "→ [observation précise]",
    "",
    "(ex : page produit un peu faible en réassurance / CTA peu visible / temps de chargement mobile)",
    "",
    "Rien de bloquant, mais clairement optimisable.",
    "",
    "Je travaille sur Shopify justement sur ce type de sujets.",
    "",
    "Tu veux que je te fasse un retour rapide ?",
    "",
    "N'gnima de Magify",
  ].join("\n"),
);

const mailtoHref = computed(() => {
  if (!props.prospect.email) {
    return "";
  }

  const params = new URLSearchParams({
    subject: emailSubject.value,
    body: emailBody.value,
  });

  return `mailto:${props.prospect.email}?${params.toString()}`;
});

const linkedinHref = computed(() => props.prospect.linkedinUrl || "");
const linkedinLabel = computed(() =>
  formatLinkedinHandle(props.prospect.linkedinUrl),
);
const avatarSrc = computed(
  () => props.prospect.avatarUrl || props.prospect.linkedinImageUrl || "",
);
const phoneHref = computed(() =>
  props.prospect.phone ? `tel:${sanitizePhone(props.prospect.phone)}` : "",
);
const socialLinks = computed(() => {
  try {
    return JSON.parse(props.prospect.socialLinksJson || "[]") as string[];
  } catch {
    return [];
  }
});

function socialLinkLabel(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./i, "");
  } catch {
    return "Réseau";
  }
}

const infoBadges = computed(
  () =>
    [
      props.prospect.email ? { icon: "i-lucide-mail", label: "Email" } : null,
      props.prospect.phone
        ? { icon: "i-lucide-phone", label: "Téléphone" }
        : null,
      props.prospect.linkedinUrl
        ? { icon: "i-lucide-linkedin", label: "LinkedIn" }
        : null,
      socialLinks.value.length
        ? { icon: "i-lucide-share-2", label: "Réseaux" }
        : null,
      props.prospect.sourceUrl
        ? { icon: "i-lucide-link-2", label: "Source" }
        : null,
      props.prospect.evidence
        ? { icon: "i-lucide-badge-info", label: "Indices" }
        : null,
      {
        icon: "i-lucide-chart-column",
        label: `Lead ${props.prospect.leadScore}`,
      },
    ].filter(Boolean) as Array<{ icon: string; label: string }>,
);

function initials(value: string) {
  return value
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function sanitizePhone(value: string) {
  return value.replace(/\s/g, "");
}

function formatLinkedinHandle(value: string | null) {
  if (!value) {
    return "";
  }

  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean);
    const slugIndex = parts.findIndex(
      (part) => part === "in" || part === "company",
    );
    const slug = slugIndex >= 0 ? parts[slugIndex + 1] : parts[0];

    return slug ? `@${slug}` : value;
  } catch {
    return value;
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return "Jamais";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Jamais";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function copyDraft() {
  const draft = [emailSubject.value, "", emailBody.value].join("\n");

  try {
    await navigator.clipboard.writeText(draft);
    copied.value = true;

    window.setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    copied.value = false;
  }
}

function openProcess() {
  router.push(`/prospects/${props.prospect.id}`);
}

function handleCardClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;

  if (target?.closest('a,button,input,textarea,select,label,[role="button"]')) {
    return;
  }

  openProcess();
}
</script>

<template>
  <details
    class="group cursor-pointer rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    draggable="true"
    @click="handleCardClick"
    @dragstart="emit('drag-start', $event)"
  >
    <summary
      class="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 outline-none"
    >
      <div class="min-w-0 space-y-2">
        <div class="flex items-start gap-3">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200"
          >
            <img
              v-if="avatarSrc"
              :src="avatarSrc"
              :alt="prospect.name"
              class="h-full w-full object-cover object-center"
            />
            <span v-else class="text-xs font-semibold text-slate-500">
              {{ initials(prospect.name) }}
            </span>
          </div>
          <div class="min-w-0">
            <div class="truncate text-xs font-semibold text-slate-900">
              {{ prospect.name }}
            </div>
            <div class="truncate text-xs text-slate-500">
              {{ prospect.siteName }}
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="badge in infoBadges"
            :key="badge.label"
            class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600"
            :title="badge.label"
          >
            <UIcon :name="badge.icon" class="h-3.5 w-3.5" />
          </span>
        </div>

        <div v-if="socialLinks.length" class="flex flex-wrap gap-2">
          <UButton
            v-for="link in socialLinks"
            :key="link"
            color="neutral"
            variant="soft"
            size="xs"
            icon="i-lucide-share-2"
            as="a"
            :href="link"
            target="_blank"
            rel="noreferrer"
          >
            {{ socialLinkLabel(link) }}
          </UButton>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <span
          class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
        >
          {{ prospect.status }}
        </span>
        <UIcon
          name="i-lucide-grip-vertical"
          class="mt-1 h-4 w-4 text-slate-400 transition group-open:rotate-90"
        />
      </div>
    </summary>

    <div class="border-t border-slate-200 px-4 pb-4 pt-3">
      <div class="grid gap-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg bg-slate-50 px-3 py-2">
            <div
              class="text-[11px] font-medium uppercase tracking-wide text-slate-500"
            >
              Responsable
            </div>
            <div class="mt-1 text-xs text-slate-900">
              {{ prospect.owner || "Non renseigné" }}
            </div>
          </div>
          <div class="rounded-lg bg-slate-50 px-3 py-2">
            <div
              class="text-[11px] font-medium uppercase tracking-wide text-slate-500"
            >
              Mise à jour
            </div>
            <div class="mt-1 text-xs text-slate-900">
              {{ formatDate(prospect.lastChecked) }}
            </div>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="space-y-2 text-xs">
            <div class="flex items-center justify-between gap-3">
              <span class="text-slate-500">Email</span>
              <a
                v-if="prospect.email"
                class="truncate font-medium text-slate-900 hover:text-sky-700"
                :href="`mailto:${prospect.email}`"
              >
                {{ prospect.email }}
              </a>
              <span v-else class="font-medium text-slate-400"
                >Non renseigné</span
              >
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-slate-500">Téléphone</span>
              <a
                v-if="prospect.phone"
                class="font-medium text-slate-900 hover:text-sky-700"
                :href="phoneHref"
              >
                {{ prospect.phone }}
              </a>
              <span v-else class="font-medium text-slate-400"
                >Non renseigné</span
              >
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-slate-500">Lead score</span>
              <span class="font-medium text-slate-900">
                {{ prospect.leadScore }}
              </span>
            </div>
          </div>

          <div class="space-y-2 text-xs text-slate-500">
            <div class="flex items-center justify-between gap-3">
              <span>Source</span>
              <a
                class="truncate text-slate-700 hover:text-sky-700"
                :href="prospect.sourceUrl"
                target="_blank"
                rel="noreferrer"
              >
                {{ prospect.sourceUrl }}
              </a>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span>Fichier</span>
              <span class="truncate text-slate-700">{{
                prospect.sourceFile
              }}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span>Score de complétude</span>
              <span class="truncate text-slate-700"
                >{{ prospect.score }} / 100</span
              >
            </div>
          </div>
        </div>

        <p class="rounded-lg bg-slate-50 px-3 py-2 body-muted">
          {{ prospect.evidence || prospect.sourceUrl }}
        </p>

        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-linkedin"
            as="a"
            :href="linkedinHref || undefined"
            :disabled="!linkedinHref"
            target="_blank"
            rel="noreferrer"
          >
            {{ linkedinLabel || "LinkedIn" }}
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-phone"
            as="a"
            :href="phoneHref || undefined"
            :disabled="!prospect.phone"
          >
            Téléphone
          </UButton>
          <UButton
            color="primary"
            variant="solid"
            size="sm"
            icon="i-lucide-mail"
            as="a"
            :href="prospect.email ? `mailto:${prospect.email}` : undefined"
            :disabled="!prospect.email"
          >
            Email
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-send"
            @click.stop="emailOpen = true"
          >
            Prospection
          </UButton>
        </div>
      </div>
    </div>
  </details>

  <UModal
    v-model:open="emailOpen"
    title="Email de prospection"
    description="Template prérempli pour contacter ce prospect."
    portal="body"
    :ui="{
      content:
        'fixed left-1/2 top-1/2 z-50 w-[min(94vw,42rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-2xl',
    }"
  >
    <template #body>
      <div class="space-y-5 px-1 pb-1 pt-2">
        <UAlert
          color="neutral"
          variant="soft"
          icon="i-lucide-info"
          title="Le message est prêt à être envoyé ou copié."
        />

        <UFormField label="Objet" class="space-y-1">
          <UInput v-model="emailSubject" class="w-full" />
        </UFormField>

        <UFormField label="Message" class="space-y-1">
          <UTextarea v-model="emailBody" autoresize :rows="16" class="w-full" />
        </UFormField>

        <div
          class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"
        >
          <div class="text-muted-sm">
            {{
              prospect.email
                ? `Cible: ${prospect.email}`
                : "Aucune adresse email détectée pour le moment."
            }}
          </div>

          <div class="flex flex-wrap justify-end gap-2">
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              icon="i-lucide-copy"
              @click="copyDraft"
            >
              {{ copied ? "Copié" : "Copier" }}
            </UButton>
            <UButton
              type="button"
              color="primary"
              icon="i-lucide-mail"
              as="a"
              :href="mailtoHref || undefined"
              :disabled="!prospect.email"
            >
              Ouvrir l’email
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
