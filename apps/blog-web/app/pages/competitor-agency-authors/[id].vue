<script setup lang="ts">
const route = useRoute();
const { request } = useApi();

const authorId = computed(() => String(route.params.id ?? ""));

const { data: author, error, status } = await useAsyncData(
  () => `author:${authorId.value}`,
  () => request(`/authors/${authorId.value}`),
  { watch: [authorId] },
);

const [{ data: articles }, { data: blogs }] = await Promise.all([
  useAsyncData(
    () => `author:${authorId.value}:articles`,
    () => request(`/authors/${authorId.value}/articles`),
    { watch: [authorId] },
  ),
  useAsyncData(
    () => `author:${authorId.value}:blogs`,
    () => request(`/authors/${authorId.value}/blogs`),
    { watch: [authorId] },
  ),
]);
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <NuxtLink to="/competitor-agency-authors" class="text-sm text-slate-500 hover:text-slate-900">
        Auteurs
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900">
        {{ author?.name || "Auteur" }}
      </h1>
      <p v-if="author?.profileUrl" class="text-sm text-slate-500">
        {{ author.profileUrl }}
      </p>
    </div>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement de l’auteur...
    </p>
    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      title="Impossible de charger cet auteur"
      description="Les informations détaillées de cet auteur n'ont pas pu être récupérées."
    />

    <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="space-y-6">
        <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="text-lg font-semibold text-slate-900">Articles</h2>
          <div v-if="articles?.length" class="mt-4 space-y-3">
            <NuxtLink
              v-for="article in articles"
              :key="article.id"
              :to="`/competitor-agency-blog-articles/${article.id}`"
              class="block rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <p class="font-medium text-slate-900">{{ article.title }}</p>
              <p class="text-sm text-slate-500">{{ article.url || article.slug || "Sans URL" }}</p>
            </NuxtLink>
          </div>
          <p v-else class="mt-4 text-sm text-slate-500">Aucun article trouvé.</p>
        </section>

        <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="text-lg font-semibold text-slate-900">Blogs</h2>
          <div v-if="blogs?.length" class="mt-4 space-y-3">
            <NuxtLink
              v-for="blog in blogs"
              :key="blog.id"
              :to="`/competitor-agency-blogs/${blog.id}`"
              class="block rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <p class="font-medium text-slate-900">{{ blog.title || blog.name || blog.baseUrl }}</p>
              <p class="text-sm text-slate-500">{{ blog.baseUrl }}</p>
            </NuxtLink>
          </div>
          <p v-else class="mt-4 text-sm text-slate-500">Aucun blog trouvé.</p>
        </section>
      </div>

      <aside class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Infos</h2>
        <dl class="mt-4 space-y-3 text-sm">
          <div>
            <dt class="text-slate-500">Nom</dt>
            <dd class="text-slate-900">{{ author?.name || "Non renseigné" }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Profil</dt>
            <dd class="break-all text-slate-900">{{ author?.profileUrl || "Aucun profil" }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Source</dt>
            <dd class="text-slate-900">{{ author?.source || "Inconnue" }}</dd>
          </div>
        </dl>
      </aside>
    </div>
  </section>
</template>
