<script setup lang="ts">
import CustomElementHtmlRenderer from "~/components/content/CustomElementHtmlRenderer.vue";

const route = useRoute();
const articleId = computed(() => String(route.params.id ?? ""));
const { useBlogArticle } = useBlogArticles();

const { data: article, error, status } = await useBlogArticle(articleId.value);
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <NuxtLink to="/competitor-agency-blog-articles" class="text-sm text-slate-500 hover:text-slate-900">
        Articles
      </NuxtLink>
      <h1 class="text-2xl font-semibold text-slate-900">
        {{ article?.title || "Article" }}
      </h1>
      <p v-if="article?.url" class="text-sm text-slate-500">
        {{ article.url }}
      </p>
    </div>

    <p v-if="status === 'pending'" class="text-sm text-slate-500">
      Chargement de l’article...
    </p>
    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      title="Impossible de charger cet article"
      description="Les informations détaillées de cet article n'ont pas pu être récupérées."
    />

    <div v-else-if="article" class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            :to="`/articles/${article.id}`"
            class="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Ouvrir l’éditeur
          </NuxtLink>
          <NuxtLink
            v-if="article.cluster?.id"
            :to="`/clusters/${article.cluster.id}`"
            class="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Voir le cluster
          </NuxtLink>
        </div>

        <CustomElementHtmlRenderer
          :html="article.content"
          fallback-html="<p>Aucun contenu disponible.</p>"
          content-class="prose prose-slate mt-6 max-w-none"
        />
      </section>

      <aside class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-slate-900">Infos</h2>
        <dl class="mt-4 space-y-3 text-sm">
          <div>
            <dt class="text-slate-500">Blog</dt>
            <dd class="text-slate-900">
              <NuxtLink
                v-if="article.blogId"
                :to="`/competitor-agency-blogs/${article.blogId}`"
                class="hover:text-slate-700"
              >
                {{ article.blog?.title || article.blog?.name || "Blog" }}
              </NuxtLink>
              <span v-else>{{ article.blog?.title || article.blog?.name || "Non renseigné" }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-slate-500">Auteur</dt>
            <dd class="text-slate-900">
              <NuxtLink
                v-if="article.author?.id"
                :to="`/competitor-agency-authors/${article.author.id}`"
                class="hover:text-slate-700"
              >
                {{ article.author.name }}
              </NuxtLink>
              <span v-else>Aucun auteur</span>
            </dd>
          </div>
          <div>
            <dt class="text-slate-500">Statut</dt>
            <dd class="text-slate-900">{{ article.status || "Inconnu" }}</dd>
          </div>
          <div>
            <dt class="text-slate-500">Publication</dt>
            <dd class="text-slate-900">{{ article.publishedAt || "Non publiée" }}</dd>
          </div>
        </dl>
      </aside>
    </div>
  </section>
</template>
