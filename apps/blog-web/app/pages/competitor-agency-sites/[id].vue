<script setup lang="ts">
const route = useRoute();
const { request } = useApi();

const siteId = computed(() => String(route.params.id ?? ""));

const { data: site, error, status } = await useAsyncData(
  () => `agency-site:${siteId.value}`,
  () => request(`/agency-sites/${siteId.value}`),
  { watch: [siteId] },
);

const { data: blogs } = await useAsyncData(
  () => `agency-site:${siteId.value}:blogs`,
  () => request(`/agency-sites/${siteId.value}/blogs`),
  { watch: [siteId] },
);
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <NuxtLink to="/competitor-agency-site" class="text-sm text-slate-500 hover:text-slate-900">
        Agency Sites
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900">
        {{ site?.name || "Agency Site" }}
      </h1>
      <p v-if="site?.baseUrl" class="text-sm text-slate-500">
        {{ site.baseUrl }}
      </p>
    </div>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement du site...
    </p>
    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      title="Impossible de charger ce site"
      description="Les informations détaillées de ce site n'ont pas pu être récupérées."
    />

    <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Blogs détectés</h2>
        <div v-if="blogs?.length" class="mt-4 space-y-3">
          <NuxtLink
            v-for="blog in blogs"
            :key="blog.id"
            :to="`/competitor-agency-blogs/${blog.id}`"
            class="block rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <p class="font-medium text-slate-900">
              {{ blog.title || blog.name || blog.baseUrl }}
            </p>
            <p class="text-sm text-slate-500">{{ blog.baseUrl }}</p>
          </NuxtLink>
        </div>
        <p v-else class="mt-4 text-sm text-slate-500">Aucun blog trouvé.</p>
      </section>

      <aside class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Infos</h2>
        <dl class="mt-4 space-y-3 text-sm">
          <div>
            <dt class="text-slate-500">Nom</dt>
            <dd class="text-slate-900">{{ site?.name || "Non renseigné" }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Base URL</dt>
            <dd class="break-all text-slate-900">{{ site?.baseUrl || "Non renseignée" }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Dernier scan</dt>
            <dd class="text-slate-900">{{ site?.lastScannedAt || "Jamais" }}</dd>
          </div>
        </dl>
      </aside>
    </div>
  </section>
</template>
