<script setup lang="ts">
const config = useRuntimeConfig();
const { request } = useApi();
const searchQuery = ref("");

type EnvironmentEntry = {
  key: string;
  value: string | null;
  masked?: boolean;
};

type ApiEnvironmentResponse = Record<string, string | undefined>;

const { data, pending, error } = await useAsyncData(
  "settings:environment-values",
  () => request<ApiEnvironmentResponse>("/api/environment"),
);

const nuxtEnvironmentEntries = computed<EnvironmentEntry[]>(() => [
  {
    key: "NUXT_API_URL",
    value: config.public.apiUrl ?? null,
  },
  {
    key: "NUXT_PUBLIC_SUPABASE_URL",
    value: config.public.supabaseUrl ?? null,
  },
  {
    key: "NUXT_PUBLIC_SUPABASE_ANON_KEY",
    value: maskSecret(config.public.supabaseAnonKey ?? null),
    masked: true,
  },
  {
    key: "SUPABASE_SECRET_KEY",
    value: maskSecret(config.supabaseSecretKey ?? null),
    masked: true,
  },
]);

const apiEnvironmentEntries = computed<EnvironmentEntry[]>(() => {
  const env = data.value ?? {};

  return Object.entries(env)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({
      key,
      value: maskIfSecret(key, value ?? null),
      masked: isSensitiveKey(key),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
});

const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase());

const filteredNuxtEnvironmentEntries = computed(() =>
  filterEnvironmentEntries(nuxtEnvironmentEntries.value, normalizedSearchQuery.value),
);

const filteredApiEnvironmentEntries = computed(() =>
  filterEnvironmentEntries(apiEnvironmentEntries.value, normalizedSearchQuery.value),
);

function maskSecret(value: string | null) {
  if (!value) {
    return null;
  }

  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function isSensitiveKey(key: string) {
  return [
    "DATABASE_URL",
    "SUPABASE_SECRET_KEY",
    "BULLMQ_PASSWORD",
    "BULL_BOARD_PASSWORD",
    "NUXT_PUBLIC_SUPABASE_ANON_KEY",
  ].includes(key);
}

function maskIfSecret(key: string, value: string | null) {
  if (!isSensitiveKey(key)) {
    return value;
  }

  return maskSecret(value);
}

function formatValue(entry: EnvironmentEntry) {
  if (!entry.value) {
    return "Non défini";
  }

  return entry.masked ? `${entry.value} (masqué)` : entry.value;
}

function filterEnvironmentEntries(entries: EnvironmentEntry[], query: string) {
  if (!query) {
    return entries;
  }

  return entries.filter((entry) => {
    return (
      entry.key.toLowerCase().includes(query) ||
      (entry.value?.toLowerCase().includes(query) ?? false)
    );
  });
}
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-5">
      <div class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Debug
        </p>
        <h2 class="text-lg font-semibold text-slate-900">
          Variables d’environnement
        </h2>
        <p class="text-sm leading-6 text-slate-500">
          Vue rapide des variables utiles côté Nuxt et côté API. Les valeurs
          sensibles sont masquées.
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <label for="environment-search" class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Recherche
        </label>
        <input
          id="environment-search"
          v-model="searchQuery"
          type="search"
          placeholder="Rechercher une variable ou une valeur..."
          class="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        >
      </div>

      <div v-if="pending" class="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
        Chargement des variables d’environnement...
      </div>

      <div v-else class="grid gap-4 xl:grid-cols-2">
        <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <h3 class="text-sm font-semibold text-slate-900">Nuxt</h3>
          <div
            v-if="filteredNuxtEnvironmentEntries.length > 0"
            class="mt-4 space-y-3"
          >
            <div
              v-for="entry in filteredNuxtEnvironmentEntries"
              :key="entry.key"
              class="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div class="min-w-0">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {{ entry.key }}
                </p>
              </div>
              <p class="break-all text-sm text-slate-700 sm:text-right">
                {{ formatValue(entry) }}
              </p>
            </div>
          </div>
          <p v-else class="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
            Aucune variable Nuxt ne correspond à la recherche.
          </p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
          <h3 class="text-sm font-semibold text-slate-900">API</h3>
          <div v-if="error" class="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            Impossible de charger les variables d’environnement de l’API.
          </div>

          <div
            v-else-if="filteredApiEnvironmentEntries.length > 0"
            class="mt-4 space-y-3"
          >
            <div
              v-for="entry in filteredApiEnvironmentEntries"
              :key="entry.key"
              class="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <div class="min-w-0">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {{ entry.key }}
                </p>
              </div>
              <p class="break-all text-sm text-slate-700 sm:text-right">
                {{ formatValue(entry) }}
              </p>
            </div>
          </div>
          <p v-else class="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
            Aucune variable API ne correspond à la recherche.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
