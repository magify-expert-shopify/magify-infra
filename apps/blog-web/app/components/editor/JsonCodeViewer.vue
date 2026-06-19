<script setup lang="ts">
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";

const props = defineProps<{
  value: string;
}>();

const rootElement = ref<HTMLDivElement | null>(null);
let editorView: EditorView | null = null;

function createEditorState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [
      lineNumbers(),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
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
          minHeight: "18rem",
          overflow: "auto",
        },
        ".cm-content": {
          minHeight: "18rem",
          padding: "1rem 0",
        },
        ".cm-gutters": {
          backgroundColor: "#f8fafc",
          borderRight: "1px solid #e2e8f0",
        },
        ".cm-activeLineGutter": {
          backgroundColor: "#f8fafc",
        },
        ".cm-activeLine": {
          backgroundColor: "transparent",
        },
        ".cm-focused": {
          outline: "none",
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
    state: createEditorState(props.value),
    parent: rootElement.value,
  });
});

watch(
  () => props.value,
  (value) => {
    if (!editorView) {
      return;
    }

    const currentValue = editorView.state.doc.toString();

    if (currentValue === value) {
      return;
    }

    editorView.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    });
  },
);

onBeforeUnmount(() => {
  editorView?.destroy();
});
</script>

<template>
  <div
    ref="rootElement"
    class="min-h-[18rem] overflow-hidden rounded-xl border border-slate-200"
  />
</template>
