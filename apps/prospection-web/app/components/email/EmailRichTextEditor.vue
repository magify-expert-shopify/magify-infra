<script setup lang="ts">
import { Extension } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/vue-3";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    disabled?: boolean;
    showHeader?: boolean;
    label?: string;
    description?: string;
    minHeight?: string;
  }>(),
  {
    disabled: false,
    showHeader: true,
    label: "Corps du mail",
    description: "Mets en forme le texte avec TipTap.",
    minHeight: "22rem",
  },
);

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();

const TextAlignExtension = Extension.create({
  name: "textAlign",

  addOptions() {
    return {
      types: ["heading", "paragraph"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (element) => {
              const value = (element as HTMLElement).style.textAlign;
              return value || null;
            },
            renderHTML: (attributes) => {
              if (!attributes.textAlign) {
                return {};
              }

              return {
                style: `text-align: ${attributes.textAlign}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment: "left" | "center" | "right" | "justify") =>
        ({ chain }) => {
          chain()
            .updateAttributes("paragraph", { textAlign: alignment })
            .updateAttributes("heading", { textAlign: alignment })
            .run();

          return true;
        },
      unsetTextAlign:
        () =>
        ({ chain }) => {
          chain()
            .updateAttributes("paragraph", { textAlign: null })
            .updateAttributes("heading", { textAlign: null })
            .run();

          return true;
        },
    };
  },
});

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      link: false,
      bulletList: {
        HTMLAttributes: {
          class: "list-disc pl-5 my-2",
        },
      },
      orderedList: {
        HTMLAttributes: {
          class: "list-decimal pl-5 my-2",
        },
      },
      listItem: {
        HTMLAttributes: {
          class: "my-1",
        },
      },
    }),
    TextAlignExtension,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      HTMLAttributes: {
        class: "text-sky-700 underline decoration-sky-500 underline-offset-2",
      },
    }),
  ],
  content: props.modelValue || "",
  editorProps: {
    attributes: {
      class:
        "w-full rounded-lg px-4 py-3 text-xs leading-6 text-slate-900 outline-none prose prose-slate max-w-none",
    },
  },
  onUpdate({ editor: currentEditor }) {
    emit("update:modelValue", currentEditor.getHTML());
  },
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) {
      return;
    }

    const nextValue = value || "";
    if (editor.value.getHTML() === nextValue) {
      return;
    }

    editor.value.commands.setContent(nextValue, false);
  },
  { immediate: true },
);

function toggleMark(mark: "bold" | "italic") {
  if (!editor.value || props.disabled) {
    return;
  }

  editor.value
    .chain()
    .focus()
    [mark === "bold" ? "toggleBold" : "toggleItalic"]()
    .run();
}

function toggleList(kind: "bulletList" | "orderedList") {
  if (!editor.value || props.disabled) {
    return;
  }

  editor.value
    .chain()
    .focus()
    [kind === "bulletList" ? "toggleBulletList" : "toggleOrderedList"]()
    .run();
}

function setParagraph() {
  if (!editor.value || props.disabled) {
    return;
  }

  editor.value.chain().focus().setParagraph().run();
}

function toggleHeading(level: 1 | 2 | 3) {
  if (!editor.value || props.disabled) {
    return;
  }

  editor.value.chain().focus().toggleHeading({ level }).run();
}

function toggleUnderline() {
  if (!editor.value || props.disabled) {
    return;
  }

  editor.value.chain().focus().toggleUnderline().run();
}

function toggleStrike() {
  if (!editor.value || props.disabled) {
    return;
  }

  editor.value.chain().focus().toggleStrike().run();
}

function undo() {
  if (!editor.value || props.disabled) {
    return;
  }

  editor.value.chain().focus().undo().run();
}

function redo() {
  if (!editor.value || props.disabled) {
    return;
  }

  editor.value.chain().focus().redo().run();
}

function setAlignment(alignment: "left" | "center" | "right" | "justify") {
  if (!editor.value || props.disabled) {
    return;
  }

  const chain = editor.value.chain().focus() as any;
  chain.setTextAlign(alignment).run();
}

function setLink() {
  if (!editor.value || props.disabled) {
    return;
  }

  const currentHref = editor.value.getAttributes("link")?.href || "";
  const href = window.prompt("URL du lien", currentHref) || "";
  const normalizedHref = href.trim();

  if (!normalizedHref) {
    editor.value.chain().focus().unsetLink().run();
    return;
  }

  const finalHref = /^https?:\/\//i.test(normalizedHref)
    ? normalizedHref
    : `https://${normalizedHref}`;

  editor.value
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({ href: finalHref })
    .run();
}

function unsetLink() {
  if (!editor.value || props.disabled) {
    return;
  }

  editor.value.chain().focus().unsetLink().run();
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="showHeader" class="flex items-center justify-between gap-3">
      <div class="space-y-0.5">
        <label
          class="text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          {{ label }}
        </label>
        <p class="text-xs text-slate-500">
          {{ description }}
        </p>
      </div>
    </div>

    <div
      class="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-sm"
    >
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-undo-2"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-4' }"
        :disabled="disabled || !editor"
        @click="undo"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-redo-2"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-4' }"
        :disabled="disabled || !editor"
        @click="redo"
      />
      <div class="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-align-left"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-4' }"
        :disabled="disabled || !editor"
        @click="setAlignment('left')"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-align-center"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-4' }"
        :disabled="disabled || !editor"
        @click="setAlignment('center')"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-align-right"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-4' }"
        :disabled="disabled || !editor"
        @click="setAlignment('right')"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-align-justify"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-4' }"
        :disabled="disabled || !editor"
        @click="setAlignment('justify')"
      />
      <div class="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        class="min-h-9 min-w-9 px-3 text-xs font-semibold transition-colors hover:bg-slate-100 hover:text-slate-900"
        :disabled="disabled || !editor"
        @click="setParagraph"
      >
        P
      </UButton>
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        class="min-h-9 min-w-9 px-3 text-xs font-semibold transition-colors hover:bg-slate-100 hover:text-slate-900"
        :disabled="disabled || !editor"
        @click="toggleHeading(1)"
      >
        H1
      </UButton>
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        class="min-h-9 min-w-9 px-3 text-xs font-semibold transition-colors hover:bg-slate-100 hover:text-slate-900"
        :disabled="disabled || !editor"
        @click="toggleHeading(2)"
      >
        H2
      </UButton>
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        class="min-h-9 min-w-9 px-3 text-xs font-semibold transition-colors hover:bg-slate-100 hover:text-slate-900"
        :disabled="disabled || !editor"
        @click="toggleHeading(3)"
      >
        H3
      </UButton>
      <div class="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-bold"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-4' }"
        :disabled="disabled || !editor"
        @click="toggleMark('bold')"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-italic"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-4' }"
        :disabled="disabled || !editor"
        @click="toggleMark('italic')"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-underline"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-4' }"
        :disabled="disabled || !editor"
        @click="toggleUnderline"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-strikethrough"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-4' }"
        :disabled="disabled || !editor"
        @click="toggleStrike"
      />
      <div class="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-list"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-5' }"
        :disabled="disabled || !editor"
        @click="toggleList('bulletList')"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-list-ordered"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-5' }"
        :disabled="disabled || !editor"
        @click="toggleList('orderedList')"
      />
      <div class="mx-1 h-6 w-px bg-slate-200" aria-hidden="true" />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-link"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-5' }"
        :disabled="disabled || !editor"
        @click="setLink"
      />
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-link-2-off"
        class="min-h-9 min-w-9 px-3 transition-colors hover:bg-slate-100 hover:text-slate-900"
        :ui="{ leadingIcon: 'size-5' }"
        :disabled="disabled || !editor"
        @click="unsetLink"
      />
    </div>

    <div
      class="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
      :style="{ minHeight }"
    >
      <ClientOnly>
        <EditorContent
          v-if="editor"
          :editor="editor"
          class="min-h-[var(--editor-min-height)]"
          :style="{ '--editor-min-height': minHeight }"
        />
        <template #fallback>
          <div :style="{ minHeight }" class="px-4 py-3 text-muted-sm">
            Chargement de l'éditeur...
          </div>
        </template>
      </ClientOnly>
    </div>
  </div>
</template>
