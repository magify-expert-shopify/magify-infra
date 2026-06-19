<script setup lang="ts">
import type { PropType } from "vue";
import type { Editor as TiptapEditor } from "@tiptap/core";
import { EditorContent } from "@tiptap/vue-3";
import CustomElementHtmlRenderer from "~/components/content/CustomElementHtmlRenderer.vue";
import BlogArticleEditorToolbar from "~/components/editor/BlogArticleEditorToolbar.vue";
import HtmlCodeEditor from "~/components/editor/HtmlCodeEditor.vue";
import { editorModeOptions } from "~/constants/editor";
import { ensureExternalScriptsLoaded } from "~/utils/custom-elements";
import type {
  AsideVariant,
  BlockFormatValue,
  EditorMode,
  TextAlignment,
} from "~/types/editor";

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  editorMode: {
    type: String as PropType<EditorMode>,
    required: true,
  },
  editorHtml: {
    type: String,
    required: true,
  },
  scriptAssetUrlsText: {
    type: String,
    required: true,
  },
  editor: {
    type: Object as PropType<TiptapEditor | null>,
    default: null,
  },
  currentBlockFormat: {
    type: String as PropType<BlockFormatValue>,
    required: true,
  },
  editorReady: {
    type: Boolean,
    required: true,
  },
  hasChanges: {
    type: Boolean,
    required: true,
  },
  hasScriptAssetChanges: {
    type: Boolean,
    required: true,
  },
  statusMessage: {
    type: String,
    required: true,
  },
  feedbackMessage: {
    type: String,
    required: true,
  },
  isTypingIndicatorActive: {
    type: Boolean,
    required: true,
  },
  isSaving: {
    type: Boolean,
    required: true,
  },
  isSavingScriptAssets: {
    type: Boolean,
    required: true,
  },
  isColorPickerOpen: {
    type: Boolean,
    required: true,
  },
  textColor: {
    type: String,
    required: true,
  },
  backgroundColor: {
    type: String,
    required: true,
  },
  isBoldActive: {
    type: Boolean,
    required: true,
  },
  isItalicActive: {
    type: Boolean,
    required: true,
  },
  isUnderlineActive: {
    type: Boolean,
    required: true,
  },
  isAlignLeftActive: {
    type: Boolean,
    required: true,
  },
  isAlignCenterActive: {
    type: Boolean,
    required: true,
  },
  isAlignRightActive: {
    type: Boolean,
    required: true,
  },
  isAlignJustifyActive: {
    type: Boolean,
    required: true,
  },
  isBulletListActive: {
    type: Boolean,
    required: true,
  },
  isOrderedListActive: {
    type: Boolean,
    required: true,
  },
  isInfoAsideActive: {
    type: Boolean,
    required: true,
  },
  isCalloutBoxActive: {
    type: Boolean,
    required: true,
  },
  isCodeBlockActive: {
    type: Boolean,
    required: true,
  },
  isNonBreakingSpaceActive: {
    type: Boolean,
    required: true,
  },
  isKeyboardInputActive: {
    type: Boolean,
    required: true,
  },
  isImageSelected: {
    type: Boolean,
    required: true,
  },
  isLinkActive: {
    type: Boolean,
    required: true,
  },
  canUndo: {
    type: Boolean,
    required: true,
  },
  canRedo: {
    type: Boolean,
    required: true,
  },
  currentAsideVariant: {
    type: String as PropType<AsideVariant>,
    required: true,
  },
  currentCodeLanguage: {
    type: String,
    required: true,
  },
  currentCalloutBoxBackgroundColor: {
    type: String,
    required: true,
  },
  currentCalloutBoxBorderColor: {
    type: String,
    required: true,
  },
  currentCustomElementStructureType: {
    type: String,
    required: true,
  },
  isCustomElementStructureActive: {
    type: Boolean,
    required: true,
  },
  onBlockFormatChange: {
    type: Function as PropType<(event: Event) => void>,
    required: true,
  },
  onToggleBold: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onToggleItalic: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onToggleUnderline: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onColorPopoverInteractOutside: {
    type: Function as PropType<(event: Event) => void>,
    required: true,
  },
  onResetTextColor: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onColorPickerPointerDown: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onColorPickerBlur: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onApplyTextColor: {
    type: Function as PropType<(color: string) => void>,
    required: true,
  },
  onResetBackgroundColor: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onApplyBackgroundColor: {
    type: Function as PropType<(color: string) => void>,
    required: true,
  },
  onSetTextAlignment: {
    type: Function as PropType<(alignment: TextAlignment) => void>,
    required: true,
  },
  onOpenLinkModal: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onRemoveLink: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onOpenImageModal: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onOpenVideoModal: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onInsertDetailsSummary: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onInsertTable: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onAsideVariantChange: {
    type: Function as PropType<(event: Event) => void>,
    required: true,
  },
  onCodeLanguageChange: {
    type: Function as PropType<(event: Event) => void>,
    required: true,
  },
  onInsertAside: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onInsertCalloutBox: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onInsertCustomElementStructure: {
    type: Function as PropType<(type: string) => void>,
    required: true,
  },
  onCalloutBoxBackgroundColorChange: {
    type: Function as PropType<(color: string) => void>,
    required: true,
  },
  onCalloutBoxBorderColorChange: {
    type: Function as PropType<(color: string) => void>,
    required: true,
  },
  onToggleBulletList: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onToggleNonBreakingSpace: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onToggleKeyboardInput: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onToggleOrderedList: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onDecreaseIndent: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onIncreaseIndent: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onClearFormatting: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onDeleteCurrentElement: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onRemoveCustomElementStructure: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onUndo: {
    type: Function as PropType<() => void>,
    required: true,
  },
  onRedo: {
    type: Function as PropType<() => void>,
    required: true,
  },
});

const emit = defineEmits<{
  "update:title": [value: string];
  "update:editorMode": [value: EditorMode];
  "update:editorHtml": [value: string];
  "update:scriptAssetUrlsText": [value: string];
  "update:isColorPickerOpen": [value: boolean];
  "update:textColor": [value: string];
  "update:backgroundColor": [value: string];
  save: [];
  saveScriptAssets: [];
}>();

const titleModel = computed({
  get: () => props.title,
  set: (value: string) => emit("update:title", value),
});

const editorModeModel = computed({
  get: () => props.editorMode,
  set: (value: EditorMode) => emit("update:editorMode", value),
});

const editorHtmlModel = computed({
  get: () => props.editorHtml,
  set: (value: string) => emit("update:editorHtml", value),
});

const scriptAssetUrlsTextModel = computed({
  get: () => props.scriptAssetUrlsText,
  set: (value: string) => emit("update:scriptAssetUrlsText", value),
});

const scriptAssetUrls = computed(() =>
  scriptAssetUrlsTextModel.value
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean),
);

const statusMessageClass = computed(() => {
  const message = props.statusMessage.toLowerCase();

  if (message.includes("impossible")) {
    return "text-red-600";
  }

  if (message.includes("non enregistr")) {
    return "text-amber-700";
  }

  if (message.includes("enregistr")) {
    return "text-emerald-600";
  }

  if (message.includes("modification en cours")) {
    return "text-amber-600";
  }

  if (message.includes("a jour")) {
    return "text-slate-500";
  }

  return "text-slate-500";
});

async function syncPreviewScripts() {
  if (!import.meta.client || editorModeModel.value !== "preview") {
    return;
  }

  await ensureExternalScriptsLoaded(scriptAssetUrls.value);
}

watch([editorModeModel, scriptAssetUrls], () => {
  void syncPreviewScripts();
});

onMounted(() => {
  void syncPreviewScripts();
});
</script>

<template>
  <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div class="flex flex-col gap-4">
      <div class="space-y-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Article
        </p>
        <input
          v-model="titleModel"
          type="text"
          placeholder="Titre de l’article"
          class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-2xl font-semibold text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
        />
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="option in editorModeOptions"
          :key="option.value"
          size="sm"
          color="neutral"
          :variant="editorModeModel === option.value ? 'solid' : 'soft'"
          @click="editorModeModel = option.value"
        >
          {{ option.label }}
        </UButton>
      </div>

      <BlogArticleEditorToolbar
        v-if="editorModeModel === 'rich-text'"
        :current-block-format="currentBlockFormat"
        :editor-ready="editorReady"
        :is-bold-active="isBoldActive"
        :is-italic-active="isItalicActive"
        :is-underline-active="isUnderlineActive"
        :is-align-left-active="isAlignLeftActive"
        :is-align-center-active="isAlignCenterActive"
        :is-align-right-active="isAlignRightActive"
        :is-align-justify-active="isAlignJustifyActive"
        :is-bullet-list-active="isBulletListActive"
        :is-ordered-list-active="isOrderedListActive"
        :is-info-aside-active="isInfoAsideActive"
        :is-callout-box-active="isCalloutBoxActive"
        :is-code-block-active="isCodeBlockActive"
        :is-non-breaking-space-active="isNonBreakingSpaceActive"
        :is-keyboard-input-active="isKeyboardInputActive"
        :is-image-selected="isImageSelected"
        :is-link-active="isLinkActive"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :current-aside-variant="currentAsideVariant"
        :current-code-language="currentCodeLanguage"
        :current-callout-box-background-color="currentCalloutBoxBackgroundColor"
        :current-callout-box-border-color="currentCalloutBoxBorderColor"
        :current-custom-element-structure-type="
          currentCustomElementStructureType
        "
        :is-color-picker-open="isColorPickerOpen"
        :is-custom-element-structure-active="isCustomElementStructureActive"
        :text-color="textColor"
        :background-color="backgroundColor"
        :on-block-format-change="onBlockFormatChange"
        :on-toggle-bold="onToggleBold"
        :on-toggle-italic="onToggleItalic"
        :on-toggle-underline="onToggleUnderline"
        :on-color-popover-interact-outside="onColorPopoverInteractOutside"
        :on-reset-text-color="onResetTextColor"
        :on-color-picker-pointer-down="onColorPickerPointerDown"
        :on-color-picker-blur="onColorPickerBlur"
        :on-apply-text-color="onApplyTextColor"
        :on-reset-background-color="onResetBackgroundColor"
        :on-apply-background-color="onApplyBackgroundColor"
        :on-set-text-alignment="onSetTextAlignment"
        :on-open-link-modal="onOpenLinkModal"
        :on-remove-link="onRemoveLink"
        :on-open-image-modal="onOpenImageModal"
        :on-open-video-modal="onOpenVideoModal"
        :on-insert-details-summary="onInsertDetailsSummary"
        :on-insert-table="onInsertTable"
        :on-aside-variant-change="onAsideVariantChange"
        :on-code-language-change="onCodeLanguageChange"
        :on-insert-aside="onInsertAside"
        :on-insert-callout-box="onInsertCalloutBox"
        :on-insert-custom-element-structure="onInsertCustomElementStructure"
        :on-callout-box-background-color-change="
          onCalloutBoxBackgroundColorChange
        "
        :on-callout-box-border-color-change="onCalloutBoxBorderColorChange"
        :on-toggle-bullet-list="onToggleBulletList"
        :on-toggle-non-breaking-space="onToggleNonBreakingSpace"
        :on-toggle-keyboard-input="onToggleKeyboardInput"
        :on-toggle-ordered-list="onToggleOrderedList"
        :on-decrease-indent="onDecreaseIndent"
        :on-increase-indent="onIncreaseIndent"
        :on-clear-formatting="onClearFormatting"
        :on-delete-current-element="onDeleteCurrentElement"
        :on-remove-custom-element-structure="onRemoveCustomElementStructure"
        :on-undo="onUndo"
        :on-redo="onRedo"
        @update:is-color-picker-open="emit('update:isColorPickerOpen', $event)"
        @update:text-color="emit('update:textColor', $event)"
        @update:background-color="emit('update:backgroundColor', $event)"
      />

      <div
        class="max-h-[calc(100vh-32rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4"
      >
        <ClientOnly v-if="editorModeModel === 'rich-text'">
          <EditorContent :editor="editor" class="editor-content" />
        </ClientOnly>

        <ClientOnly v-else-if="editorModeModel === 'html'">
          <HtmlCodeEditor
            v-model="editorHtmlModel"
            placeholder="<p>Commencez à écrire votre HTML...</p>"
          />
        </ClientOnly>

        <div v-else-if="editorModeModel === 'script-assets'" class="space-y-3">
          <div class="space-y-1">
            <p class="text-sm font-medium text-slate-800">
              URLs JS associées à cet article
            </p>
            <p class="text-sm text-slate-500">
              Une URL par ligne. Elles seront injectées à la fin du contenu au
              moment du push Shopify.
            </p>
          </div>

          <textarea
            v-model="scriptAssetUrlsTextModel"
            rows="12"
            placeholder="https://example.com/assets/sitemap-generator.js"
            class="min-h-[22rem] w-full rounded-xl border border-slate-200 px-3 py-3 font-mono text-sm text-slate-800 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
          />

          <div class="flex justify-end">
            <UButton
              icon="i-lucide-file-code-2"
              :loading="isSavingScriptAssets"
              :disabled="!hasScriptAssetChanges"
              @click="emit('saveScriptAssets')"
            >
              {{
                isSavingScriptAssets
                  ? "Enregistrement..."
                  : "Enregistrer les scripts JS"
              }}
            </UButton>
          </div>
        </div>

        <CustomElementHtmlRenderer
          v-else
          :html="editorHtmlModel"
          content-class="editor-preview-content shopify-content max-w-none min-h-[22rem] rounded-xl bg-[#f9f8ff] p-4"
        />
      </div>

      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p :class="['text-sm', statusMessageClass]">
          <template v-if="!feedbackMessage && hasChanges">
            {{ statusMessage
            }}<span
              v-if="isTypingIndicatorActive"
              :class="['typing-dots', { 'is-active': isTypingIndicatorActive }]"
              ><span>.</span><span>.</span><span>.</span></span
            >
          </template>
          <template v-else>
            {{ statusMessage }}
          </template>
        </p>

        <div class="flex flex-wrap items-center justify-end gap-2">
          <UButton
            icon="i-lucide-save"
            :loading="isSaving"
            :disabled="!hasChanges"
            @click="emit('save')"
          >
            {{ isSaving ? "Enregistrement..." : "Enregistrer l’article" }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../../assets/css/main.css";

:deep(.editor-content img) {
  width: 100% !important;
  height: 200px !important;
  object-fit: cover !important;
}

:deep(.editor-content .ProseMirror-selectednode.editor-figure-image) {
  border-radius: 1rem;
  box-shadow:
    0 0 0 2px rgba(14, 165, 233, 0.9),
    0 0 0 8px rgba(186, 230, 253, 0.75);
}

:deep(.editor-content .ProseMirror-selectednode.editor-figure-image .editor-figure-image__img) {
  border-radius: 1rem;
}

:deep(.editor-content img.ProseMirror-selectednode) {
  border-radius: 1rem;
  box-shadow:
    0 0 0 2px rgba(14, 165, 233, 0.9),
    0 0 0 8px rgba(186, 230, 253, 0.75);
}

:deep(.shopify-content a) {
  @apply text-primary-600 underline;
}

:deep(.shopify-content h2),
:deep(.shopify-content .h2) {
  @apply mt-8 mb-4 font-bold lg:text-[2.5rem];
}

:deep(.shopify-content h3),
:deep(.shopify-content .h3) {
  @apply mt-8 mb-4 font-bold lg:text-2xl;
}

:deep(.shopify-content h4),
:deep(.shopify-content .h4) {
  @apply mt-8 mb-4 font-bold lg:text-xl;
}

:deep(.shopify-content p) {
  @apply leading-7;
  color: color-mix(in srgb, var(--ui-text) 85%, transparent);
}

:deep(.shopify-content strong) {
  @apply font-semibold;
  color: var(--ui-text-highlighted);
}

:deep(.shopify-content em) {
  @apply italic;
}

:deep(.shopify-content u) {
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.15em;
}

:deep(.shopify-content :is(p, ul)) {
  margin-block-start: 1rem;
  margin-block-end: 1rem;
}

:deep(.shopify-content blockquote) {
  @apply my-6 border-l-4 px-5 py-4 italic;
  color: color-mix(in srgb, var(--ui-text) 80%, transparent);
  border-color: color-mix(in srgb, var(--color-primary-600) 30%, transparent);
  background-color: color-mix(in srgb, var(--color-primary-600) 6%, white);
}

:deep(.shopify-content blockquote p) {
  @apply my-0;
}

:deep(.shopify-content pre) {
  @apply my-6 overflow-x-auto rounded-2xl border bg-neutral-950 px-5 py-4 text-sm leading-6 text-white shadow-sm;
  border-color: color-mix(in srgb, var(--ui-text) 10%, transparent);
}

:deep(.shopify-content pre code) {
  @apply block font-mono;
}

:deep(.shopify-content :is(code):not(pre code)) {
  @apply rounded-md px-1.5 py-0.5 font-mono text-[0.95em];
  background-color: color-mix(in srgb, var(--ui-text) 8%, transparent);
  color: var(--ui-text-highlighted);
}

:deep(.shopify-content .editor-callout-aside) {
  @apply my-6 rounded-lg border px-5 py-4;
}

:deep(.shopify-content .editor-callout-aside p) {
  @apply my-0;
}

:deep(.shopify-content .editor-callout-aside--info) {
  @apply border text-sky-950;
  border-color: rgb(186 230 253);
  background-color: rgb(240 249 255);
}

:deep(.shopify-content .editor-callout-aside--warning) {
  @apply border text-red-950;
  border-color: rgb(254 202 202);
  background-color: rgb(254 242 242);
}

:deep(.shopify-content .editor-callout-aside--success) {
  @apply border text-emerald-950;
  border-color: rgb(167 243 208);
  background-color: rgb(236 253 245);
}

:deep(.shopify-content .editor-callout-aside--tip) {
  @apply border text-violet-950;
  border-color: rgb(221 214 254);
  background-color: rgb(245 243 255);
}

:deep(.editor-content .custom-element) {
  @apply my-6 rounded-2xl border border-slate-300 bg-slate-50 px-5 py-4;
  position: relative;
}

:deep(.ProseMirror .custom-element.ProseMirror-selectednode) {
  border-color: rgb(14 165 233);
  box-shadow:
    0 0 0 4px rgb(14 165 233 / 0.16),
    0 12px 24px -16px rgb(15 23 42 / 0.45);
  outline: none;
}

:deep(.ProseMirror .non-breaking-space) {
  @apply inline-block rounded-sm px-0.5;
  background-color: rgb(251 191 36 / 0.3);
  box-shadow: inset 0 0 0 1px rgb(245 158 11 / 0.35);
  white-space: nowrap;
}

:deep(.ProseMirror .editor-em-dash) {
  @apply inline-block rounded px-0.5 font-semibold;
  background-color: rgb(248 113 113 / 0.18);
  box-shadow:
    inset 0 -0.55em 0 rgb(248 113 113 / 0.16),
    0 0 0 1px rgb(239 68 68 / 0.22);
  color: rgb(185 28 28);
  text-shadow: 0 0 0.5px currentColor;
}

:deep(.editor-content kbd) {
  @apply inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[0.85em];
  background-color: rgb(15 23 42 / 0.06);
  border-color: rgb(15 23 42 / 0.14);
  color: rgb(15 23 42);
}

:deep(.shopify-content kbd) {
  @apply inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[0.85em];
  background-color: rgb(15 23 42 / 0.06);
  border-color: rgb(15 23 42 / 0.14);
  color: rgb(15 23 42);
}

:deep(.editor-content .custom-element > [data-custom-element-type]) {
  @apply block;
}

:deep(.editor-content .custom-element::before) {
  color: rgb(71 85 105);
  content: "Application";
  display: block;
  font-weight: 700;
  /* font-size: 0.875rem;
  letter-spacing: 0.02em;
  */
  margin-bottom: 0.5rem;
}

:deep(.editor-content .custom-element::after) {
  /* color: rgb(100 116 139);
  content: attr(data-custom-element-type);
  display: block;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.8125rem;
  margin-top: 0.35rem;
   */
}

:deep(.editor-content sitemap-generator) {
  background: linear-gradient(
    135deg,
    rgb(224 242 254 / 0.9),
    rgb(240 249 255 / 0.95)
  );
  border: 1px dashed rgb(56 189 248);
  border-radius: 1rem;
  color: rgb(3 105 161);
  display: block;
  /* margin: 1.5rem 0; */
  min-height: 4rem;
  padding: 1rem 1.25rem;
}

:deep(.editor-content sitemap-generator::before) {
  content: "sitemap-generator";
  /* display: block; */
  /* font-weight: 700; */
  /* font-size: 0.875rem;
  letter-spacing: 0.02em; */
}

:deep(.editor-content sitemap-generator::after) {
  /* content: "<sitemap-generator/>"; */
  /* content: "Trouver le sitemap de son site Shopify";
  display: block;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 0.8125rem;
  margin-top: 0.4rem;
  opacity: 0.85; */
}
</style>
