<script setup lang="ts">
import type { UpsertMagifyAuthorInput } from "~/types/authors";
import type { ShopifyImageListItem, ShopifyPageListItem } from "~/types/shared";
import { normalizeSearchText } from "~/utils/search-normalizer";

const props = defineProps<{
  form: UpsertMagifyAuthorInput;
}>();

const { getImages, getPages } = useShopify();

const allPages = ref<ShopifyPageListItem[]>([]);
const allImages = ref<ShopifyImageListItem[]>([]);
const isLoadingImages = ref(false);
const isLoadingPages = ref(false);
const imagePickerRef = ref<HTMLElement | null>(null);
const isImageSuggestionsOpen = ref(false);
const imageSearch = ref("");
const isPageSuggestionsOpen = ref(false);

const pageSearch = ref("");
const pagePickerRef = ref<HTMLElement | null>(null);

const selectedImage = computed(
  () =>
    allImages.value.find((image) => image.id === props.form.shopifyAvatarId) ??
    null,
);

const selectedPage = computed(
  () =>
    allPages.value.find((page) => page.id === props.form.shopifyPageId) ?? null,
);

const filteredPages = computed(() => {
  const search = normalizeSearchText(pageSearch.value);

  if (!search) {
    return allPages.value.slice(0, 8);
  }

  return allPages.value
    .filter((page) =>
      [page.title, page.handle].some((value) =>
        normalizeSearchText(value).includes(search),
      ),
    )
    .slice(0, 8);
});

const filteredImages = computed(() => {
  const search = normalizeSearchText(imageSearch.value);

  if (!search) {
    return allImages.value.slice(0, 12);
  }

  return allImages.value
    .filter((image) =>
      [image.alt ?? "", image.url].some((value) =>
        normalizeSearchText(value).includes(search),
      ),
    )
    .slice(0, 12);
});

function formatPageLabel(page: ShopifyPageListItem) {
  return `${page.title} - /${page.handle}`;
}

async function ensurePagesLoaded() {
  if (allPages.value.length || isLoadingPages.value) {
    return;
  }

  isLoadingPages.value = true;

  try {
    allPages.value = await getPages();
  } finally {
    isLoadingPages.value = false;
  }
}

async function ensureImagesLoaded() {
  if (allImages.value.length || isLoadingImages.value) {
    return;
  }

  isLoadingImages.value = true;

  try {
    allImages.value = await getImages();
  } finally {
    isLoadingImages.value = false;
  }
}

function selectPage(page: ShopifyPageListItem) {
  props.form.shopifyPageId = page.id;
  pageSearch.value = formatPageLabel(page);
  isPageSuggestionsOpen.value = false;
}

function clearSelectedPage() {
  props.form.shopifyPageId = "";
  pageSearch.value = "";
  isPageSuggestionsOpen.value = false;
}

function formatImageLabel(image: ShopifyImageListItem) {
  const alt = image.alt?.trim();
  return alt || image.url.split("/").pop() || image.id;
}

function selectImage(image: ShopifyImageListItem) {
  props.form.shopifyAvatarId = image.id;
  props.form.avatarUrl = image.url;
  imageSearch.value = formatImageLabel(image);
  isImageSuggestionsOpen.value = false;
}

function clearSelectedImage() {
  props.form.shopifyAvatarId = "";
  props.form.avatarUrl = "";
  imageSearch.value = "";
  isImageSuggestionsOpen.value = false;
}

watch(
  selectedPage,
  (page) => {
    pageSearch.value = page ? formatPageLabel(page) : "";
  },
  { immediate: true },
);

watch(
  selectedImage,
  (image) => {
    imageSearch.value = image ? formatImageLabel(image) : "";
    if (image?.url) {
      props.form.avatarUrl = image.url;
    }
  },
  { immediate: true },
);

watch(pageSearch, (value) => {
  if (
    value.trim() !==
    (selectedPage.value ? formatPageLabel(selectedPage.value) : "")
  ) {
    props.form.shopifyPageId = "";
  }
});

watch(imageSearch, (value) => {
  if (
    value.trim() !==
    (selectedImage.value ? formatImageLabel(selectedImage.value) : "")
  ) {
    props.form.shopifyAvatarId = "";
    props.form.avatarUrl = "";
  }
});

onMounted(() => {
  void ensurePagesLoaded();
  void ensureImagesLoaded();

  const handlePointerDown = (event: PointerEvent) => {
    const target = event.target;

    if (
      pagePickerRef.value &&
      target instanceof Node &&
      !pagePickerRef.value.contains(target)
    ) {
      isPageSuggestionsOpen.value = false;
    }

    if (
      imagePickerRef.value &&
      target instanceof Node &&
      !imagePickerRef.value.contains(target)
    ) {
      isImageSuggestionsOpen.value = false;
    }
  };

  window.addEventListener("pointerdown", handlePointerDown);

  onBeforeUnmount(() => {
    window.removeEventListener("pointerdown", handlePointerDown);
  });
});
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2">
    <label class="space-y-2 text-sm font-medium text-slate-700">
      <span>Prénom</span>
      <input
        v-model="form.firstName"
        type="text"
        class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
      />
    </label>

    <label class="space-y-2 text-sm font-medium text-slate-700">
      <span>Nom de famille</span>
      <input
        v-model="form.lastName"
        type="text"
        class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
      />
    </label>

    <label class="space-y-2 text-sm font-medium text-slate-700">
      <span>Nom d’affichage</span>
      <input
        v-model="form.displayName"
        type="text"
        class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
      />
    </label>

    <label class="space-y-2 text-sm font-medium text-slate-700">
      <span>Intitulé du poste</span>
      <input
        v-model="form.jobTitle"
        type="text"
        class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
      />
    </label>

    <label class="space-y-2 text-sm font-medium text-slate-700">
      <span>Email</span>
      <input
        v-model="form.email"
        type="email"
        class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
      />
    </label>

    <label class="space-y-2 text-sm font-medium text-slate-700">
      <span>Numéro de téléphone</span>
      <input
        v-model="form.phoneNumber"
        type="text"
        class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
      />
    </label>

    <label class="space-y-2 text-sm font-medium text-slate-700">
      <span>Image de profil</span>

      <div ref="imagePickerRef" class="relative">
        <input
          v-model="imageSearch"
          type="text"
          placeholder="Rechercher une image Shopify..."
          class="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-24 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          @focus="
            isImageSuggestionsOpen = true;
            void ensureImagesLoaded();
          "
        />

        <button
          v-if="imageSearch || form.shopifyAvatarId"
          type="button"
          class="absolute right-10 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          @click="clearSelectedImage"
        >
          <UIcon name="i-lucide-x" class="h-4 w-4" />
        </button>

        <div
          class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400"
        >
          <UIcon name="i-lucide-image" class="h-4 w-4" />
        </div>

        <div
          v-if="isImageSuggestionsOpen"
          class="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div v-if="isLoadingImages" class="px-4 py-3 text-sm text-slate-500">
            Chargement des images Shopify...
          </div>

          <button
            v-else
            type="button"
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50"
            :class="
              !form.shopifyAvatarId && !imageSearch.trim()
                ? 'bg-slate-50 text-slate-900'
                : 'text-slate-700'
            "
            @click="clearSelectedImage"
          >
            <span>Aucune image associée</span>
            <UIcon
              v-if="!form.shopifyAvatarId && !imageSearch.trim()"
              name="i-lucide-check"
              class="h-4 w-4 text-violet-600"
            />
          </button>

          <div
            v-for="image in filteredImages"
            :key="image.id"
            class="border-t border-slate-100 first:border-t-0"
          >
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
              :class="
                image.id === form.shopifyAvatarId
                  ? 'bg-violet-50 text-violet-700'
                  : ''
              "
              @click="selectImage(image)"
            >
              <img
                :src="image.url"
                :alt="image.alt || 'Image Shopify'"
                class="h-12 w-12 rounded-xl border border-slate-200 object-cover"
              />
              <span class="min-w-0 flex-1 truncate">{{
                formatImageLabel(image)
              }}</span>
              <UIcon
                v-if="image.id === form.shopifyAvatarId"
                name="i-lucide-check"
                class="h-4 w-4 text-violet-600"
              />
            </button>
          </div>

          <div
            v-if="!isLoadingImages && !filteredImages.length"
            class="px-4 py-3 text-sm text-slate-500"
          >
            Aucune image trouvée.
          </div>
        </div>
      </div>

      <img
        v-if="form.avatarUrl"
        :src="form.avatarUrl"
        alt="Prévisualisation de l'image de profil"
        class="h-20 w-20 rounded-2xl border border-slate-200 object-cover"
      />
    </label>

    <label class="space-y-2 text-sm font-medium text-slate-700">
      <span>Profil LinkedIn</span>
      <input
        v-model="form.linkedinProfileUrl"
        type="url"
        placeholder="https://linkedin.com/in/..."
        class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
      />
    </label>

    <label class="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
      <span>Page Shopify auteur</span>

      <div ref="pagePickerRef" class="relative">
        <input
          v-model="pageSearch"
          type="text"
          placeholder="Rechercher une page Shopify..."
          class="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-24 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
          @focus="
            isPageSuggestionsOpen = true;
            void ensurePagesLoaded();
          "
        />

        <button
          v-if="pageSearch || form.shopifyPageId"
          type="button"
          class="absolute right-10 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          @click="clearSelectedPage"
        >
          <UIcon name="i-lucide-x" class="h-4 w-4" />
        </button>

        <div
          class="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400"
        >
          <UIcon name="i-lucide-search" class="h-4 w-4" />
        </div>

        <div
          v-if="isPageSuggestionsOpen"
          class="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div v-if="isLoadingPages" class="px-4 py-3 text-sm text-slate-500">
            Chargement des pages Shopify...
          </div>

          <button
            v-else
            type="button"
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-slate-50"
            :class="
              !form.shopifyPageId && !pageSearch.trim()
                ? 'bg-slate-50 text-slate-900'
                : 'text-slate-700'
            "
            @click="clearSelectedPage"
          >
            <span>Aucune page associée</span>
            <UIcon
              v-if="!form.shopifyPageId && !pageSearch.trim()"
              name="i-lucide-check"
              class="h-4 w-4 text-violet-600"
            />
          </button>

          <button
            v-for="page in filteredPages"
            :key="page.id"
            type="button"
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            :class="
              page.id === form.shopifyPageId
                ? 'bg-violet-50 text-violet-700'
                : ''
            "
            @click="selectPage(page)"
          >
            <span class="truncate">{{ formatPageLabel(page) }}</span>
            <UIcon
              v-if="page.id === form.shopifyPageId"
              name="i-lucide-check"
              class="h-4 w-4 text-violet-600"
            />
          </button>

          <div
            v-if="!isLoadingPages && !filteredPages.length"
            class="px-4 py-3 text-sm text-slate-500"
          >
            Aucune page trouvée.
          </div>
        </div>
      </div>
    </label>

    <label class="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
      <span>Slug / handle de la page auteur</span>
      <input
        v-model="form.slug"
        type="text"
        class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
      />
    </label>
  </div>

  <label class="mt-4 block space-y-2 text-sm font-medium text-slate-700">
    <span>Bio</span>
    <textarea
      v-model="form.bio"
      rows="5"
      class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-100"
    />
  </label>
</template>
