<template>
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">MAGIFY</p>
      <h1>Dashboard</h1>
      <p class="subtitle">Accès centralisé aux applications et services.</p>

      <nav aria-label="Applications">
        <NuxtLink :to="statusRoute" class="status-card status-card--highlight">
          <span>API Status</span>
          <small>Etat des APIs, PostgreSQL et Redis</small>
        </NuxtLink>
        <a :href="links.blog">
          <span>Blog</span>
          <small>Gestion et publication de contenu</small>
        </a>
        <a :href="links.prospection">
          <span>Prospection</span>
          <small>Suivi des campagnes commerciales</small>
        </a>
        <a :href="links.social">
          <span>Social</span>
          <small>Gestion des réseaux sociaux</small>
        </a>
        <a :href="links.proxyManager">
          <span>Proxy Manager</span>
          <small>Administration du reverse proxy</small>
        </a>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()

const links = {
  blog: config.public.dashboardBlogUrl,
  prospection: config.public.dashboardProspectionUrl,
  social: config.public.dashboardSocialUrl,
  proxyManager: config.public.dashboardProxyManagerUrl,
}

const statusRoute = '/api-status'
</script>

<style scoped>
:global(:root) {
  color-scheme: dark;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  background: #09090b;
  color: #fafafa;
}

:global(body) {
  margin: 0;
}

.shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 3rem 1.5rem;
  background:
    radial-gradient(circle at 15% 10%, rgba(99, 102, 241, 0.2), transparent 35%),
    radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.12), transparent 30%),
    #09090b;
}

.hero {
  width: min(100%, 960px);
}

.eyebrow {
  color: #818cf8;
  font-weight: 800;
  letter-spacing: 0.22em;
}

h1 {
  margin: 0.25rem 0;
  font-size: clamp(3rem, 8vw, 6rem);
  line-height: 1;
}

.subtitle {
  margin: 1rem 0 3rem;
  color: #a1a1aa;
  font-size: 1.15rem;
}

nav {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

a,
.status-card {
  min-height: 145px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.5rem;
  color: inherit;
  text-decoration: none;
  background: rgba(24, 24, 27, 0.8);
  border: 1px solid #27272a;
  border-radius: 1rem;
  transition: transform 0.18s ease, border-color 0.18s ease;
}

a:hover,
.status-card:hover {
  transform: translateY(-4px);
  border-color: #6366f1;
}

.status-card--highlight {
  background: linear-gradient(180deg, rgba(79, 70, 229, 0.3), rgba(24, 24, 27, 0.86));
  border-color: rgba(129, 140, 248, 0.7);
}

a span,
.status-card span {
  font-size: 1.25rem;
  font-weight: 700;
}

a small,
.status-card small {
  color: #a1a1aa;
  line-height: 1.4;
}
</style>
