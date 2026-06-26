<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">M</span>
        <div>
          <p class="brand-name">Magify</p>
          <p class="brand-subtitle">Dashboard</p>
        </div>
      </div>

      <nav class="nav" aria-label="Navigation principale">
        <NuxtLink to="/" class="nav-link">Accueil</NuxtLink>
        <NuxtLink to="/api-status" class="nav-link">Statut API</NuxtLink>
      </nav>
    </header>

    <NuxtPage />
  </div>
</template>

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

.app-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at 15% 10%, rgba(99, 102, 241, 0.18), transparent 35%),
    radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.12), transparent 30%),
    #09090b;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.5rem;
  backdrop-filter: blur(16px);
  background: rgba(9, 9, 11, 0.72);
  border-bottom: 1px solid rgba(63, 63, 70, 0.55);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.brand-mark {
  width: 2.5rem;
  height: 2.5rem;
  display: grid;
  place-items: center;
  border-radius: 0.85rem;
  background: linear-gradient(135deg, #6366f1, #10b981);
  color: #fff;
  font-weight: 800;
}

.brand-name,
.brand-subtitle {
  margin: 0;
}

.brand-name {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.brand-subtitle {
  color: #a1a1aa;
  font-size: 0.85rem;
}

.nav {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem;
  background: rgba(24, 24, 27, 0.65);
  border: 1px solid rgba(63, 63, 70, 0.9);
  border-radius: 999px;
}

.nav-link {
  padding: 0.65rem 1rem;
  border-radius: 999px;
  color: #d4d4d8;
  text-decoration: none;
  font-weight: 600;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.nav-link:hover,
.nav-link.router-link-active,
.nav-link.router-link-exact-active {
  background: rgba(99, 102, 241, 0.18);
  color: #fff;
}

@media (max-width: 720px) {
  .topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .nav {
    width: 100%;
    justify-content: space-between;
  }

  .nav-link {
    flex: 1;
    text-align: center;
  }
}
</style>
