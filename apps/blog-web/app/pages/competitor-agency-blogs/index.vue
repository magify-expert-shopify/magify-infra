<script setup lang="ts">
import BlogsTable from "~/components/tables/BlogsTable.vue";
import { BlogPlatform } from "~/types/domain";

const {
  useBlogsList,
  deleteBlog: deleteBlogRequest,
  discoverBlogArticles,
  discoverBlogsArticles,
} = useBlogs();
const deletingBlogId = ref<string | null>(null);
const scanningBlogIds = ref<Set<string>>(new Set());
const isScanningAllBlogs = ref(false);

const { data: blogs, error, status } = await useBlogsList();

async function deleteBlog(id: string) {
  if (deletingBlogId.value) {
    return;
  }

  deletingBlogId.value = id;

  try {
    await deleteBlogRequest(id);
    await refreshNuxtData("blogs");
  } finally {
    deletingBlogId.value = null;
  }
}

async function rescanBlog(id: string) {
  if (scanningBlogIds.value.has(id)) {
    return;
  }

  scanningBlogIds.value = new Set(scanningBlogIds.value).add(id);

  try {
    const response = await discoverBlogArticles(id, "sync");

    if (response.mode === "sync" && blogs.value) {
      blogs.value = blogs.value.map((blog) =>
        blog.id === id ? response.blog : blog,
      );
    }
  } finally {
    const nextScanningBlogIds = new Set(scanningBlogIds.value);
    nextScanningBlogIds.delete(id);
    scanningBlogIds.value = nextScanningBlogIds;
  }
}

async function rescanAllBlogs() {
  if (isScanningAllBlogs.value || !blogs.value?.length) {
    return;
  }

  isScanningAllBlogs.value = true;

  try {
    await discoverBlogsArticles(
      blogs.value.map((blog) => blog.id),
      "async",
    );
  } finally {
    isScanningAllBlogs.value = false;
  }
}
</script>

<template>
  <section class="space-y-4">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-slate-900">Blogs</h1>
      <p class="text-sm text-slate-500">
        Liste des blogs recuperes depuis l'API.
      </p>
    </header>

    <div class="flex items-center justify-end">
      <UButton
        color="neutral"
        variant="soft"
        :loading="isScanningAllBlogs"
        :disabled="isScanningAllBlogs || !(blogs?.length ?? 0)"
        @click="rescanAllBlogs"
      >
        {{ isScanningAllBlogs ? "Scan en cours..." : "Scanner tout" }}
      </UButton>
    </div>

    <FeedbackLoadingMessage v-if="status === 'pending'">
      Chargement des blogs...
    </FeedbackLoadingMessage>

    <FeedbackRichMessage
      v-else-if="error"
      tone="error"
      :details="error.toString()"
      title="Impossible de charger les blogs"
      description="Les blogs concurrents n'ont pas pu être récupérés."
    />

    <BlogsTable
      v-else
      :blogs="blogs ?? []"
      :scanning-blog-ids="scanningBlogIds"
      :deleting-blog-id="deletingBlogId"
      @rescan="rescanBlog"
      @delete="deleteBlog"
    />
  </section>
</template>
