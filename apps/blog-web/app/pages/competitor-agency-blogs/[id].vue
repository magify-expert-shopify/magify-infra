<script setup lang="ts">
const route = useRoute();
const { request } = useApi();

const blogId = computed(() => String(route.params.id ?? ""));

const { data: blog, error, status } = await useAsyncData(
  () => `blog:${blogId.value}`,
  () => request(`/blogs/${blogId.value}`),
  { watch: [blogId] },
);

const { data: articles } = await useAsyncData(
  () => `blog:${blogId.value}:articles`,
  () => request(`/blogs/${blogId.value}/articles`),
  { watch: [blogId] },
);
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <NuxtLink to="/competitor-agency-blogs" class="text-sm text-slate-500 hover:text-slate-900">
        Blogs
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900">
        {{ blog?.title || blog?.name || "Blog" }}
      </h1>
      <p v-if="blog?.baseUrl" class="text-sm text-slate-500">
        {{ blog.baseUrl }}
      </p>
    </div>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement du blog...
    </p>
    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      title="Impossible de charger ce blog"
      description="Les informations détaillées de ce blog n'ont pas pu être récupérées."
    />

    <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
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

      <aside class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Infos</h2>
        <dl class="mt-4 space-y-3 text-sm">
          <div>
            <dt class="text-slate-500">URL</dt>
            <dd class="break-all text-slate-900">{{ blog?.baseUrl || "Non renseignée" }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Slug</dt>
            <dd class="text-slate-900">{{ blog?.slug || "Non renseigné" }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Dernier scan</dt>
            <dd class="text-slate-900">{{ blog?.lastScannedAt || "Jamais" }}</dd>
          </div>
        </dl>
      </aside>
    </div>
  </section>
</template>
