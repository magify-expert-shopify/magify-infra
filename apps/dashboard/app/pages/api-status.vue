<template>
  <main class="page">
    <section class="hero">
      <div class="hero-top">
        <div>
          <p class="eyebrow">MAGIFY</p>
          <h1>API Status</h1>
          <p class="subtitle">
            Vue centralisée de l'état des APIs, de PostgreSQL et de Redis.
          </p>
        </div>

        <div class="actions">
          <NuxtLink class="ghost-link" to="/">Retour au dashboard</NuxtLink>
          <button class="refresh-button" type="button" @click="refresh">
            Rafraîchir
          </button>
        </div>
      </div>

      <div class="summary">
        <div class="summary-card">
          <span class="summary-value">{{ onlineCount }}</span>
          <span class="summary-label">APIs en ligne</span>
        </div>
        <div class="summary-card">
          <span class="summary-value">{{ databaseOnlineCount }}</span>
          <span class="summary-label">DB PostgreSQL</span>
        </div>
        <div class="summary-card">
          <span class="summary-value">{{ redisOnlineCount }}</span>
          <span class="summary-label">Redis</span>
        </div>
      </div>

      <div v-if="pending" class="state-panel">Chargement des statuts...</div>
      <div v-else-if="loadError" class="state-panel state-panel--error">
        {{ loadError }}
      </div>

      <div v-else class="grid">
        <article v-for="service in services" :key="service.key" class="card">
          <div class="card-top">
            <div>
              <p class="card-eyebrow">{{ service.label }}</p>
              <h2>{{ service.label }}</h2>
            </div>
            <span class="badge" :class="service.api.ok ? 'badge--ok' : 'badge--bad'">
              {{ service.api.ok ? 'Online' : 'Offline' }}
            </span>
          </div>

          <div class="meta">
            <a :href="service.appUrl" target="_blank" rel="noreferrer">
              Site
            </a>
            <a :href="service.apiUrl" target="_blank" rel="noreferrer">
              API
            </a>
          </div>

          <div class="rows">
            <div class="row">
              <span class="row-label">API</span>
              <span class="row-value" :class="service.api.ok ? 'row-value--ok' : 'row-value--bad'">
                {{ service.api.detail }}
              </span>
            </div>
            <div class="row">
              <span class="row-label">PostgreSQL</span>
              <span
                class="row-value"
                :class="service.database.ok ? 'row-value--ok' : 'row-value--bad'"
              >
                {{ service.database.detail }}
              </span>
            </div>
            <div class="row">
              <span class="row-label">Redis</span>
              <span class="row-value" :class="service.redis.ok ? 'row-value--ok' : 'row-value--bad'">
                {{ service.redis.detail }}
              </span>
            </div>
          </div>

          <p class="checked-at">Mis à jour le {{ formatDate(service.checkedAt) }}</p>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
type HealthCheck = {
  label: string
  ok: boolean
  detail: string
}

type ApiInfoResponse = {
  appUrl: string
  api: HealthCheck
  database: HealthCheck
  redis: HealthCheck
  databaseUrl: string
  bullBoardUrl?: string | null
  checkedAt: string
}

type DashboardService = ApiInfoResponse & {
  key: string
  label: string
  apiUrl: string
}

const config = useRuntimeConfig()

const serviceDefinitions = [
  {
    key: 'blog',
    label: 'Blog',
    appUrl: config.public.dashboardBlogUrl,
    apiUrl: config.public.dashboardBlogApiUrl,
  },
  {
    key: 'prospection',
    label: 'Prospection',
    appUrl: config.public.dashboardProspectionUrl,
    apiUrl: config.public.dashboardProspectionApiUrl,
  },
  {
    key: 'social',
    label: 'Social',
    appUrl: config.public.dashboardSocialUrl,
    apiUrl: config.public.dashboardSocialApiUrl,
  },
] as const

const fetchService = async (service: (typeof serviceDefinitions)[number]): Promise<DashboardService> => {
  const statusUrl = new URL('/api-info', service.apiUrl).toString()

  try {
    const response = await $fetch<ApiInfoResponse>(statusUrl)

    return {
      ...service,
      ...response,
    }
  } catch (error) {
    const detail = error instanceof Error && error.message ? error.message : 'Connection failed'

    return {
      ...service,
      appUrl: service.appUrl,
      apiUrl: service.apiUrl,
      api: {
        label: 'API',
        ok: false,
        detail,
      },
      database: {
        label: 'Database',
        ok: false,
        detail,
      },
      redis: {
        label: 'Redis',
        ok: false,
        detail,
      },
      databaseUrl: 'Unavailable',
      bullBoardUrl: null,
      checkedAt: new Date().toISOString(),
    }
  }
}

const { data, pending, refresh, error } = await useAsyncData(
  'dashboard-api-status',
  async () => Promise.all(serviceDefinitions.map((service) => fetchService(service))),
  {
    server: false,
    default: () => [],
  },
)

const services = computed(() => data.value ?? [])
const loadError = computed(() => (error.value instanceof Error ? error.value.message : ''))
const onlineCount = computed(() => services.value.filter((service) => service.api.ok).length)
const databaseOnlineCount = computed(
  () => services.value.filter((service) => service.database.ok).length,
)
const redisOnlineCount = computed(() => services.value.filter((service) => service.redis.ok).length)

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(value))
  } catch {
    return value
  }
}
</script>

<style scoped>
:global(:root) {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: #060816;
  color: #f8fafc;
}

:global(body) {
  margin: 0;
}

.page {
  min-height: 100vh;
  padding: 3rem 1.5rem 4rem;
  background:
    radial-gradient(circle at 15% 10%, rgba(34, 197, 94, 0.16), transparent 24%),
    radial-gradient(circle at 85% 20%, rgba(59, 130, 246, 0.16), transparent 22%),
    radial-gradient(circle at 50% 100%, rgba(99, 102, 241, 0.16), transparent 28%),
    linear-gradient(180deg, #060816 0%, #090b1e 100%);
}

.hero {
  width: min(1200px, 100%);
  margin: 0 auto;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.eyebrow {
  margin: 0;
  color: #818cf8;
  font-size: 0.85rem;
  letter-spacing: 0.24em;
  font-weight: 800;
}

h1 {
  margin: 0.4rem 0 0;
  font-size: clamp(2.5rem, 5vw, 4.5rem);
  line-height: 1;
}

.subtitle {
  margin: 1rem 0 0;
  color: #a1a1aa;
  max-width: 56rem;
}

.actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.ghost-link,
.refresh-button {
  border-radius: 999px;
  padding: 0.8rem 1rem;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(15, 23, 42, 0.8);
  color: #f8fafc;
  text-decoration: none;
  font-weight: 700;
}

.refresh-button {
  cursor: pointer;
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin: 1.5rem 0 2rem;
}

.summary-card {
  padding: 1rem 1.2rem;
  border-radius: 1.25rem;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.summary-value {
  display: block;
  font-size: 2rem;
  font-weight: 800;
}

.summary-label {
  color: #94a3b8;
}

.state-panel {
  padding: 1rem 1.2rem;
  border-radius: 1rem;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: #cbd5e1;
}

.state-panel--error {
  border-color: rgba(239, 68, 68, 0.35);
  color: #fecaca;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
}

.card {
  background: rgba(15, 23, 42, 0.88);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 1.5rem;
  padding: 1.2rem;
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.26);
}

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.card-eyebrow {
  margin: 0;
  color: #64748b;
  font-size: 0.8rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.card h2 {
  margin: 0.3rem 0 0;
  font-size: 1.5rem;
}

.badge {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 800;
}

.badge--ok {
  background: rgba(34, 197, 94, 0.14);
  color: #86efac;
}

.badge--bad {
  background: rgba(239, 68, 68, 0.14);
  color: #fca5a5;
}

.meta {
  display: flex;
  gap: 0.8rem;
  margin: 1rem 0;
}

.meta a {
  color: #93c5fd;
  text-decoration: none;
  font-weight: 700;
}

.rows {
  display: grid;
  gap: 0.75rem;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 0;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}

.row-label {
  color: #cbd5e1;
  font-weight: 700;
}

.row-value {
  text-align: right;
  color: #94a3b8;
}

.row-value--ok {
  color: #bbf7d0;
}

.row-value--bad {
  color: #fecaca;
}

.checked-at {
  margin: 1rem 0 0;
  color: #64748b;
  font-size: 0.9rem;
}

@media (max-width: 1024px) {
  .grid,
  .summary {
    grid-template-columns: 1fr;
  }

  .hero-top {
    flex-direction: column;
  }

  .actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
