<script setup lang="ts">
import { html } from "@codemirror/lang-html";
import { EditorState } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { indentWithTab } from "@codemirror/commands";
import { tags } from "@lezer/highlight";

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const rootElement = ref<HTMLDivElement | null>(null);
let editorView: EditorView | null = null;
let isApplyingExternalValue = false;

const htmlHighlightStyle = HighlightStyle.define([
  { tag: tags.angleBracket, color: "#64748b" },
  { tag: tags.tagName, color: "#0f766e", fontWeight: "600" },
  { tag: tags.attributeName, color: "#7c3aed" },
  { tag: tags.attributeValue, color: "#b45309" },
  { tag: tags.string, color: "#b45309" },
  { tag: tags.comment, color: "#94a3b8", fontStyle: "italic" },
  { tag: tags.keyword, color: "#0369a1" },
  { tag: tags.content, color: "#0f172a" },
]);

function applyEditorValue(value: string, options?: { emitUpdate?: boolean }) {
  if (!editorView) {
    return;
  }

  const currentValue = editorView.state.doc.toString();

  if (currentValue === value) {
    return;
  }

  isApplyingExternalValue = true;
  editorView.dispatch({
    changes: {
      from: 0,
      to: currentValue.length,
      insert: value,
    },
  });
  isApplyingExternalValue = false;

  if (options?.emitUpdate !== false) {
    emit("update:modelValue", value);
  }
}

function formatHtmlNode(node: Node, level = 0): string {
  const indent = "  ".repeat(level);
  const childIndent = "  ".repeat(level + 1);

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.replace(/\s+/g, " ").trim() ?? "";

    return text ? `${indent}${text}` : "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  const attributes = Array.from(element.attributes)
    .map((attribute) => `${attribute.name}="${attribute.value}"`)
    .join(" ");
  const openingTag = attributes
    ? `<${tagName} ${attributes}>`
    : `<${tagName}>`;
  const children = Array.from(element.childNodes)
    .map((child) => formatHtmlNode(child, level + 1))
    .filter(Boolean);

  if (!children.length) {
    return `${indent}${openingTag}</${tagName}>`;
  }

  const hasOnlyTextChild =
    element.childNodes.length === 1 &&
    element.firstChild?.nodeType === Node.TEXT_NODE;

  if (hasOnlyTextChild) {
    const textContent = element.textContent?.replace(/\s+/g, " ").trim() ?? "";

    return `${indent}${openingTag}${textContent}</${tagName}>`;
  }

  return [
    `${indent}${openingTag}`,
    children.map((child) => child.replace(childIndent, childIndent)).join("\n"),
    `${indent}</${tagName}>`,
  ].join("\n");
}

function prettifyHtml(value: string) {
  if (typeof window === "undefined") {
    return value;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return value;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(normalizedValue, "text/html");
  const hasParserError = document.querySelector("parsererror");

  if (hasParserError) {
    return value;
  }

  const formatted = Array.from(document.body.childNodes)
    .map((node) => formatHtmlNode(node, 0))
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return formatted || value;
}

function handlePrettify() {
  if (!editorView) {
    return;
  }

  applyEditorValue(prettifyHtml(editorView.state.doc.toString()));
}

function createEditorState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      html(),
      syntaxHighlighting(htmlHighlightStyle),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || isApplyingExternalValue) {
          return;
        }

        emit("update:modelValue", update.state.doc.toString());
      }),
      EditorView.theme({
        "&": {
          backgroundColor: "#ffffff",
          color: "#0f172a",
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: "0.875rem",
          height: "100%",
        },
        ".cm-scroller": {
          minHeight: "22rem",
          overflow: "auto",
        },
        ".cm-content": {
          minHeight: "22rem",
          padding: "1rem 0",
        },
        ".cm-gutters": {
          backgroundColor: "#f8fafc",
          borderRight: "1px solid #e2e8f0",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "#e2e8f0",
        },
        ".cm-activeLine": {
          backgroundColor: "#f8fafc",
        },
        ".cm-focused": {
          outline: "none",
        },
        ".cm-selectionBackground, .cm-content ::selection": {
          backgroundColor: "#bae6fd",
        },
      }),
    ],
  });
}

onMounted(() => {
  if (!rootElement.value) {
    return;
  }

  editorView = new EditorView({
    state: createEditorState(props.modelValue),
    parent: rootElement.value,
  });
});

watch(
  () => props.modelValue,
  (value) => {
    applyEditorValue(value, { emitUpdate: false });
  },
);

onBeforeUnmount(() => {
  editorView?.destroy();
});
</script>

<template>
  <div class="space-y-3">
    <div class="flex justify-end">
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-wand-sparkles"
        @click="handlePrettify"
      >
        Prettify
      </UButton>
    </div>

    <div
      ref="rootElement"
      class="min-h-[22rem] overflow-hidden rounded-xl border border-slate-200"
      :data-placeholder="placeholder"
    />
  </div>
</template>
