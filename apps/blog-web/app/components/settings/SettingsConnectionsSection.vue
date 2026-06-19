<script setup lang="ts">
import type { IntegrationConnectionStatus } from "~/types/settings";

const { getIntegrations } = useSettings();

const isLoading = ref(true);
const integrations = ref<IntegrationConnectionStatus[]>([]);

async function loadIntegrations() {
  isLoading.value = true;

  try {
    const integrationsStatus = await getIntegrations();
    integrations.value = integrationsStatus.connections;
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void loadIntegrations();
});
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div class="flex flex-col gap-4">
      <div class="space-y-1">
        <h2 class="text-lg font-semibold text-slate-900">Connexions</h2>
        <p class="text-sm leading-6 text-slate-500">
          Vérifiez ici quels comptes, clients et services sont actuellement
          branchés sur l’application.
        </p>
      </div>

      <div
        v-if="isLoading"
        class="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500"
      >
        Chargement des connexions...
      </div>

      <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="connection in integrations"
          :key="connection.key"
          class="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
        >
          <div
            v-if="connection.profile"
            class="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
          >
            <img
              v-if="connection.profile.picture"
              :src="connection.profile.picture"
              :alt="
                connection.profile.name ||
                connection.profile.email ||
                connection.label
              "
              class="h-14 w-14 rounded-full border border-slate-200 object-cover"
            />
            <div
              v-else
              class="flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-lg font-semibold text-slate-600"
            >
              {{
                (connection.profile.name || connection.profile.email || "G")
                  .slice(0, 1)
                  .toUpperCase()
              }}
            </div>

            <div class="min-w-0 space-y-1">
              <p class="truncate text-sm font-semibold text-slate-900">
                {{ connection.profile.name || "Compte Google" }}
              </p>
              <p
                v-if="connection.profile.email"
                class="truncate text-sm text-slate-600"
              >
                {{ connection.profile.email }}
              </p>
              <p class="text-xs text-slate-500">
                {{
                  connection.profile.verifiedEmail
                    ? "Email vérifié"
                    : "Email non vérifié"
                }}
              </p>
            </div>
          </div>

          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <p class="text-sm font-medium text-slate-900">
                {{ connection.label }}
              </p>
              <p class="text-sm text-slate-700">
                {{ connection.accountLabel }}
              </p>
            </div>

            <span
              class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
              :class="
                connection.configured
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              "
            >
              {{ connection.configured ? "Connecté" : "Non configuré" }}
            </span>
          </div>

          <p class="mt-3 text-sm leading-6 text-slate-500">
            {{ connection.detail }}
          </p>

          <p
            v-if="connection.error"
            class="mt-2 text-sm leading-6 text-rose-600"
          >
            {{ connection.error }}
          </p>

          <div v-if="connection.authUrl" class="mt-4">
            <a
              :href="connection.authUrl"
              target="_blank"
              rel="noreferrer"
              class="inline-flex items-center rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100"
            >
              Générer ou reconnecter le token
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
