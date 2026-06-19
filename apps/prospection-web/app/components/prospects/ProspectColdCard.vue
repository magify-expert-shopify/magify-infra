<script setup lang="ts">
import type { ProspectColdListItem } from "~/types/prospects";
import { getWebsiteCategoryConfig } from "~/utils/home-website-categories";

const props = defineProps<{
  prospect: ProspectColdListItem;
}>();

const route = useRoute();
const contactImageFallbackLevel = ref(0);

const socialLinks = computed(() => {
  try {
    const parsed = JSON.parse(props.prospect.socialLinksJson || "[]");
    return Array.isArray(parsed)
      ? (parsed.filter((item) => typeof item === "string") as string[])
      : [];
  } catch {
    return [];
  }
});

const primaryImageSrc = computed(
  () => props.prospect.avatarUrl || props.prospect.linkedinImageUrl || "",
);
const siteImageSrc = computed(() => getSiteImageSrc(props.prospect.sourceUrl));
const contactImageSrc = computed(() => {
  if (contactImageFallbackLevel.value === 0) {
    return primaryImageSrc.value || siteImageSrc.value;
  }

  if (contactImageFallbackLevel.value === 1) {
    return primaryImageSrc.value &&
      siteImageSrc.value &&
      siteImageSrc.value !== primaryImageSrc.value
      ? siteImageSrc.value
      : "";
  }

  return "";
});

const contactImageFallback = computed(() =>
  getInitials(props.prospect.siteName || props.prospect.name || ""),
);
const redesignStatus = computed(() =>
  String(props.prospect.url?.redesignStatus || "").toLowerCase(),
);

const positionnementTag = computed(() => {
  if (redesignStatus.value === "candidat refonte") {
    return {
      label: "Refonte",
      tone: getWebsiteCategoryConfig("refonte").filterTone,
      icon: getWebsiteCategoryConfig("refonte").icon,
    };
  }

  if (redesignStatus.value === "candidat migration") {
    return {
      label: "Migration",
      tone: getWebsiteCategoryConfig("migration").filterTone,
      icon: getWebsiteCategoryConfig("migration").icon,
    };
  }

  return {
    label: "Support",
    tone: getWebsiteCategoryConfig("support").filterTone,
    icon: getWebsiteCategoryConfig("support").icon,
  };
});

const leadScoreTone = computed(() => {
  const score = Number(props.prospect.leadScore || 0);

  if (score >= 80) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (score >= 50) return "bg-sky-50 text-sky-700 ring-sky-200";
  if (score >= 25) return "bg-amber-50 text-amber-700 ring-amber-200";

  return "bg-slate-100 text-slate-600 ring-slate-200";
});

const socialLinksWithMeta = computed(
  () =>
    socialLinks.value
      .map((link) => {
        const meta = getSocialMeta(link);
        return meta ? { ...meta, url: link } : null;
      })
      .filter(Boolean) as Array<{ url: string; icon: string; label: string }>,
);

const phoneHref = computed(() =>
  props.prospect.phone ? `tel:${sanitizePhone(props.prospect.phone)}` : "",
);
const emailHref = computed(() =>
  props.prospect.email ? `mailto:${props.prospect.email}` : "",
);
const detailHref = computed(() => ({
  path: `/prospects/${props.prospect.id}`,
  query: route.query,
}));

function sanitizePhone(value: string) {
  return value.replace(/\s/g, "");
}

function getSiteImageSrc(value: string | null) {
  if (!value) return "";

  try {
    return new URL("/favicon.ico", value).toString();
  } catch {
    return "";
  }
}

function getInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "C"
  );
}

function getSocialMeta(value: string): { icon: string; label: string } | null {
  try {
    const hostname = new URL(value).hostname
      .replace(/^www\./i, "")
      .toLowerCase();

    if (hostname.includes("linkedin.com"))
      return { icon: "i-lucide-linkedin", label: "LinkedIn" };
    if (hostname.includes("instagram.com"))
      return { icon: "i-lucide-instagram", label: "Instagram" };
    if (hostname.includes("facebook.com"))
      return { icon: "i-lucide-facebook", label: "Facebook" };
    if (hostname.includes("tiktok.com"))
      return { icon: "i-lucide-music-2", label: "TikTok" };
    if (hostname.includes("x.com") || hostname.includes("twitter.com"))
      return { icon: "i-lucide-twitter", label: "X" };
    if (hostname.includes("youtube.com"))
      return { icon: "i-lucide-youtube", label: "YouTube" };
    if (hostname.includes("pinterest.com"))
      return { icon: "i-lucide-pin", label: "Pinterest" };
    if (hostname.includes("threads.net"))
      return { icon: "i-lucide-at-sign", label: "Threads" };
    if (hostname.includes("t.me"))
      return { icon: "i-lucide-send", label: "Telegram" };
    if (hostname.includes("linktr.ee"))
      return { icon: "i-lucide-link-2", label: "Linktree" };
    if (hostname.includes("snapchat.com"))
      return { icon: "i-lucide-sparkles", label: "Snapchat" };
    if (hostname.includes("wa.me") || hostname.includes("whatsapp.com"))
      return { icon: "i-lucide-message-circle", label: "WhatsApp" };
    if (hostname.includes("discord.gg") || hostname.includes("discord.com"))
      return { icon: "i-lucide-message-square", label: "Discord" };

    return { icon: "i-lucide-globe", label: hostname.replace(/^m\./i, "") };
  } catch {
    return null;
  }
}

function handleImageError() {
  contactImageFallbackLevel.value += 1;
}
</script>

<template>
  <article
    class="group h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-sky-300"
  >
    <div
      class="grid h-full items-stretch gap-0 lg:grid-cols-[minmax(0,45%)_minmax(0,1fr)] xl:grid-cols-[minmax(0,30%)_minmax(0,1fr)]"
    >
      <div class="relative h-full min-h-56 overflow-hidden bg-slate-100">
        <img
          v-if="contactImageSrc"
          :src="contactImageSrc"
          :alt="prospect.name || prospect.siteName || 'Contact'"
          class="absolute inset-0 h-full w-full object-cover object-center"
          @error="handleImageError"
        />
        <div
          v-else
          class="absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-slate-50 px-6 text-center"
        >
          <div class="space-y-2">
            <div
              class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-lg font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200"
            >
              {{ contactImageFallback }}
            </div>
            <div class="text-xs font-medium text-slate-500">
              {{ prospect.siteName || prospect.name || "Contact" }}
            </div>
          </div>
        </div>

        <div class="absolute left-3 top-3 flex flex-wrap gap-2">
          <span
            class="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 backdrop-blur"
          >
            Prospect froid
          </span>
          <span
            v-if="prospect.firstContactEmailQueuedAt"
            class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-200 backdrop-blur"
          >
            <UIcon name="i-lucide-mail-check" class="h-3.5 w-3.5" />
            Email planifié
          </span>
          <span
            class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset backdrop-blur"
            :class="positionnementTag.tone"
          >
            <UIcon :name="positionnementTag.icon" class="h-3.5 w-3.5" />
            Positionnement: {{ positionnementTag.label }}
          </span>
        </div>

        <div class="absolute bottom-3 left-3">
          <span
            class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ring-1 ring-inset backdrop-blur"
            :class="leadScoreTone"
          >
            <UIcon name="i-lucide-chart-column" class="h-3.5 w-3.5" />
            Lead score: {{ prospect.leadScore }}
          </span>
        </div>
      </div>

      <div class="flex h-full min-w-0 flex-col gap-4 p-5">
        <div class="space-y-1">
          <div class="text-lg font-semibold text-slate-900">
            {{ prospect.name || "Contact sans nom" }}
          </div>
          <div class="text-muted-sm">
            {{ prospect.siteName || "Site non renseigné" }}
          </div>
        </div>

        <div
          class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-1 2xl:grid-cols-2"
        >
          <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div
              class="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Téléphone
            </div>
            <a
              v-if="prospect.phone"
              :href="phoneHref"
              class="pointer-events-auto mt-1 block truncate text-xs font-medium text-slate-900 hover:text-sky-700 hover:underline"
            >
              {{ prospect.phone }}
            </a>
            <div v-else class="mt-1 text-xs font-medium text-slate-400">
              Non renseigné
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div
              class="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Email
            </div>
            <a
              v-if="prospect.email"
              :href="emailHref"
              class="pointer-events-auto mt-1 block truncate text-xs font-medium text-slate-900 hover:text-sky-700 hover:underline"
            >
              {{ prospect.email }}
            </a>
            <div v-else class="mt-1 text-xs font-medium text-slate-400">
              Non renseigné
            </div>
          </div>
        </div>

        <div v-if="socialLinksWithMeta.length" class="space-y-2">
          <div
            class="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
          >
            Réseaux sociaux
          </div>

          <div class="flex flex-wrap gap-2">
            <a
              v-for="link in socialLinksWithMeta"
              :key="link.url"
              :href="link.url"
              target="_blank"
              rel="noreferrer"
              class="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 hover:shadow"
              :title="link.label"
              :aria-label="link.label"
              @click.stop
            >
              <UIcon :name="link.icon" class="h-4 w-4" />
            </a>
          </div>
        </div>

        <div class="mt-auto flex flex-wrap items-center justify-between gap-3">
          <div class="text-xs text-slate-500">
            <!-- {{ prospect.firstName || 'Prénom non renseigné' }} -->
          </div>

          <UButton
            color="neutral"
            variant="solid"
            icon="i-lucide-arrow-right"
            :to="detailHref"
          >
            Voir la fiche de ce contact
          </UButton>
        </div>
      </div>
    </div>
  </article>
</template>
