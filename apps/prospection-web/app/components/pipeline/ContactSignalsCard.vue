<script setup lang="ts">
import { computed } from "vue";
import type { ContactLink } from "~/types/urls";

const props = defineProps<{
  email: string | null;
  owner: string | null;
  linkedinUrl: string | null;
  socialLinksJson: string | null;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (event: "rescan-contact-signals"): void;
}>();

const socialLinks = computed(() => {
  try {
    const parsed = JSON.parse(props.socialLinksJson || "[]");
    return Array.isArray(parsed)
      ? (parsed.filter((item) => typeof item === "string") as string[])
      : [];
  } catch {
    return [];
  }
});

const linkedinHandle = computed(() => formatLinkedinHandle(props.linkedinUrl));

const socialLinksWithMeta = computed(
  () =>
    socialLinks.value
      .map((link) => {
        const meta = getSocialMeta(link);
        return meta ? { ...meta, url: link } : null;
      })
      .filter(Boolean) as ContactLink[],
);

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function formatLinkedinHandle(value: string | null) {
  if (!value) return "—";

  try {
    const parts = new URL(value).pathname.split("/").filter(Boolean);
    const slugIndex = parts.findIndex(
      (part) => part === "in" || part === "company",
    );
    const slug = slugIndex >= 0 ? parts[slugIndex + 1] : parts[0];

    return slug ? `linkedin.com/in/${slug}` : value;
  } catch {
    return value;
  }
}

function getSocialMeta(value: string): Omit<ContactLink, "url"> | null {
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
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="mb-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div
            class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
          >
            Contact et reseaux
          </div>
          <h3 class="mt-1 text-base font-semibold text-slate-900">
            Informations trouvées
          </h3>
        </div>

        <UButton
          color="neutral"
          variant="soft"
          size="xs"
          icon="i-lucide-refresh-cw"
          :loading="props.loading"
          :disabled="!!props.loading"
          @click="emit('rescan-contact-signals')"
        >
          Relancer
        </UButton>
      </div>
    </div>

    <div class="space-y-4">
      <div class="flex items-start gap-3">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100"
        >
          <UIcon name="i-lucide-mail" class="h-4 w-4" />
        </div>

        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium text-slate-500">Email trouvé</div>

          <a
            v-if="props.email"
            :href="`mailto:${props.email}`"
            class="mt-0.5 block truncate text-xs font-semibold text-slate-900 hover:text-primary-600 hover:underline"
          >
            {{ props.email }}
          </a>

          <div v-else class="mt-0.5 text-xs font-semibold text-slate-400">
            Non trouvé
          </div>
        </div>

        <div
          class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset"
          :class="
            hasValue(props.email)
              ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
              : 'bg-slate-50 text-slate-400 ring-slate-200'
          "
        >
          <UIcon
            :name="hasValue(props.email) ? 'i-lucide-check' : 'i-lucide-minus'"
            class="h-3.5 w-3.5"
          />
        </div>
      </div>

      <div class="flex items-start gap-3">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-600 ring-1 ring-slate-200"
        >
          <UIcon name="i-lucide-user" class="h-4 w-4" />
        </div>

        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium text-slate-500">Propriétaire</div>

          <div
            class="mt-0.5 truncate text-xs font-semibold"
            :class="props.owner ? 'text-slate-900' : 'text-slate-400'"
          >
            {{ props.owner || "Non trouvé" }}
          </div>
        </div>

        <div
          class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset"
          :class="
            hasValue(props.owner)
              ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
              : 'bg-slate-50 text-slate-400 ring-slate-200'
          "
        >
          <UIcon
            :name="hasValue(props.owner) ? 'i-lucide-check' : 'i-lucide-minus'"
            class="h-3.5 w-3.5"
          />
        </div>
      </div>

      <div class="flex items-start gap-3">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100"
        >
          <UIcon name="i-lucide-linkedin" class="h-4 w-4" />
        </div>

        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium text-slate-500">LinkedIn</div>

          <a
            v-if="props.linkedinUrl"
            :href="props.linkedinUrl"
            target="_blank"
            rel="noreferrer"
            class="mt-0.5 block truncate text-xs font-semibold text-slate-900 hover:text-primary-600 hover:underline"
          >
            {{ linkedinHandle }}
          </a>

          <div v-else class="mt-0.5 text-xs font-semibold text-slate-400">
            Non trouvé
          </div>
        </div>

        <div
          class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset"
          :class="
            hasValue(props.linkedinUrl)
              ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
              : 'bg-slate-50 text-slate-400 ring-slate-200'
          "
        >
          <UIcon
            :name="
              hasValue(props.linkedinUrl) ? 'i-lucide-check' : 'i-lucide-minus'
            "
            class="h-3.5 w-3.5"
          />
        </div>
      </div>

      <div class="flex items-start gap-3">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"
        >
          <UIcon name="i-lucide-share-2" class="h-4 w-4" />
        </div>

        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium text-slate-500">Autres réseaux</div>

          <div
            v-if="socialLinksWithMeta.length"
            class="mt-2 flex flex-wrap gap-2"
          >
            <a
              v-for="link in socialLinksWithMeta"
              :key="link.url"
              :href="link.url"
              target="_blank"
              rel="noreferrer"
              class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 hover:shadow"
              :title="link.label"
              :aria-label="link.label"
            >
              <UIcon :name="link.icon" class="h-4 w-4" />
            </a>
          </div>

          <div v-else class="mt-0.5 text-xs font-semibold text-slate-400">
            Non trouvé
          </div>
        </div>

        <div
          class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset"
          :class="
            socialLinksWithMeta.length
              ? 'bg-emerald-50 text-emerald-600 ring-emerald-200'
              : 'bg-slate-50 text-slate-400 ring-slate-200'
          "
        >
          <UIcon
            :name="
              socialLinksWithMeta.length ? 'i-lucide-check' : 'i-lucide-minus'
            "
            class="h-3.5 w-3.5"
          />
        </div>
      </div>
    </div>
  </section>
</template>
