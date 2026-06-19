<script setup lang="ts">
const { user, session } = useSupabaseAuth();

const displayName = computed(() => {
  const metadata = user.value?.userMetadata ?? {};
  const appMetadata = user.value?.appMetadata ?? {};

  return (
    (typeof metadata.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata.name === "string" && metadata.name.trim()) ||
    (typeof appMetadata.full_name === "string" &&
      appMetadata.full_name.trim()) ||
    (typeof appMetadata.name === "string" && appMetadata.name.trim()) ||
    user.value?.email ||
    user.value?.id ||
    "Profil connecté"
  );
});

const initials = computed(() => {
  const source = displayName.value.trim();
  if (!source) {
    return "U";
  }

  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
});

const connectedSinceLabel = computed(() => {
  const createdAt = user.value?.createdAt ?? null;

  if (!createdAt) {
    return null;
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
});

const lastSignInLabel = computed(() => {
  const lastSignInAt = user.value?.lastSignInAt ?? null;

  if (!lastSignInAt) {
    return null;
  }

  const date = new Date(lastSignInAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
});

const identityProviders = computed(() =>
  (user.value?.identities ?? [])
    .map((identity) => identity.provider?.trim())
    .filter((provider): provider is string => Boolean(provider)),
);

const profileFields = computed(() => [
  { label: "Email", value: user.value?.email ?? "Aucun email" },
  { label: "Téléphone", value: user.value?.phone ?? "Aucun téléphone" },
  { label: "Role", value: user.value?.role ?? "Non défini" },
  { label: "Audience", value: user.value?.aud ?? "Non défini" },
  {
    label: "Identifiant",
    value: user.value?.id ?? "Aucun identifiant",
  },
]);
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">Profil connecté</h2>
        <p class="text-sm leading-6 text-slate-500">
          Informations de la session Supabase actuellement ouverte.
        </p>
      </div>

      <div
        v-if="!user"
        class="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500"
      >
        Aucun profil connecté n’a été trouvé.
      </div>

      <template v-else>
        <div class="flex items-start gap-4">
          <div
            class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-lg font-semibold text-violet-700"
          >
            {{ initials }}
          </div>

          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="truncate text-base font-semibold text-slate-900">
                {{ displayName }}
              </h3>
              <UBadge v-if="session?.tokenType" color="neutral" variant="soft">
                {{ session.tokenType }}
              </UBadge>
            </div>

            <p class="break-all text-sm text-slate-500">
              {{ user.email || user.id }}
            </p>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="field in profileFields"
            :key="field.label"
            class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
              {{ field.label }}
            </p>
            <p class="mt-1 break-all text-sm font-medium text-slate-900">
              {{ field.value }}
            </p>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
              Providers
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <UBadge
                v-for="provider in identityProviders"
                :key="provider"
                color="primary"
                variant="soft"
              >
                {{ provider }}
              </UBadge>
              <span
                v-if="!identityProviders.length"
                class="text-sm text-slate-500"
              >
                Aucun provider déclaré
              </span>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
              Dates de session
            </p>
            <div class="mt-2 space-y-2 text-sm text-slate-700">
              <p>
                <span class="font-medium text-slate-900">Créé le:</span>
                {{ connectedSinceLabel || "Non disponible" }}
              </p>
              <p>
                <span class="font-medium text-slate-900">Dernière connexion:</span>
                {{ lastSignInLabel || "Non disponible" }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
