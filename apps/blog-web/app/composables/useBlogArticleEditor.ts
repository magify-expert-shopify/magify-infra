import { Extension, Node as TiptapNode, mergeAttributes } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import CodeBlock from "@tiptap/extension-code-block";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { Fragment } from "@tiptap/pm/model";
import { NodeSelection, Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useEditor } from "@tiptap/vue-3";
import {
  editorIndentStepRem,
  editorMaxIndentLevel,
  indentableEditorNodeTypes,
} from "~/constants/editor";
import { customElementStructureOptions } from "~/constants/custom-elements";
import type { Ref } from "vue";
import { formatEditorHtml } from "~/utils/format-editor-html";
import type {
  ArticleEditorDocument,
  AsideVariant,
  BlockFormatValue,
  EditorMode,
  EditorSaveHandler,
  TextAlignment,
} from "~/types/editor";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
    nonBreakingSpace: {
      toggleNonBreakingSpace: () => ReturnType;
    };
    keyboardInput: {
      toggleKeyboardInput: () => ReturnType;
    };
    figureImage: {
      insertFigureImage: (attrs: {
        src: string;
        alt?: string | null;
        caption?: string | null;
      }) => ReturnType;
    };
    detailsElement: {
      insertDetailsElement: () => ReturnType;
    };
    customElementStructure: {
      insertCustomElementStructure: (type: string) => ReturnType;
      toggleCustomElementStructure: (type: string) => ReturnType;
      removeCustomElementStructure: () => ReturnType;
    };
  }
}

const VideoEmbed = TiptapNode.create({
  name: "videoEmbed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: "",
      },
      title: {
        default: null,
      },
      width: {
        default: null,
      },
      height: {
        default: null,
      },
      allow: {
        default: null,
      },
      frameborder: {
        default: "0",
      },
      allowfullscreen: {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "iframe[src]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const {
      allowfullscreen,
      ...rest
    } = HTMLAttributes as Record<string, string | boolean | null | undefined>;

    return [
      "div",
      { class: "editor-video-embed" },
      [
        "iframe",
        mergeAttributes(rest, {
          allowfullscreen: allowfullscreen ? "true" : null,
          loading: "lazy",
        }),
      ],
    ];
  },
});

const NonBreakingSpace = Extension.create({
  name: "nonBreakingSpace",
  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addCommands() {
    return {
      toggleNonBreakingSpace:
        () =>
        ({ state, dispatch }) => {
          const activeRange = findNonBreakingSpaceRangeAtSelection(
            state.selection,
            state.doc,
          );

          if (activeRange) {
            if (dispatch) {
              dispatch(
                state.tr.delete(activeRange.from, activeRange.to).scrollIntoView(),
              );
            }

            return true;
          }

          if (dispatch) {
            const transaction = state.tr.insertText(
              "\u00A0",
              state.selection.from,
              state.selection.to,
            );

            dispatch(transaction.scrollIntoView());
          }

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("non-breaking-space"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node, position) => {
              if (!node.isText || !node.text?.includes("\u00A0")) {
                return;
              }

              const text = node.text;
              let offset = 0;

              while (offset < text.length) {
                const nextIndex = text.indexOf("\u00A0", offset);

                if (nextIndex === -1) {
                  break;
                }

                const from = position + nextIndex;
                const to = from + 1;

                decorations.push(
                  Decoration.inline(from, to, {
                    class: "non-breaking-space",
                  }),
                );

                offset = nextIndex + 1;
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

const EmDashHighlight = Extension.create({
  name: "emDashHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("em-dash-highlight"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node, position) => {
              if (!node.isText || !node.text?.includes("—")) {
                return;
              }

              const text = node.text;
              let offset = 0;

              while (offset < text.length) {
                const nextIndex = text.indexOf("—", offset);

                if (nextIndex === -1) {
                  break;
                }

                const from = position + nextIndex;
                const to = from + 1;

                decorations.push(
                  Decoration.inline(from, to, {
                    class: "editor-em-dash",
                  }),
                );

                offset = nextIndex + 1;
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

const FigureImage = TiptapNode.create({
  name: "figureImage",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) =>
          element.querySelector("img")?.getAttribute("src")?.trim() ?? "",
      },
      alt: {
        default: "",
        parseHTML: (element) =>
          element.querySelector("img")?.getAttribute("alt")?.trim() ?? "",
      },
      caption: {
        default: "",
        parseHTML: (element) =>
          element.querySelector("figcaption")?.textContent?.trim() ?? "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attributes = HTMLAttributes as Record<string, string | undefined>;
    const src = String(attributes.src ?? "").trim();
    const alt = String(attributes.alt ?? "");
    const caption = String(attributes.caption ?? "").trim();

    return [
      "figure",
      {
        class: "editor-figure-image",
      },
      [
        "img",
        mergeAttributes(
          {
            src,
            alt,
          },
          {
            class: "editor-figure-image__img",
          },
        ),
      ],
      caption
        ? [
            "figcaption",
            {
              class: "editor-figure-image__caption",
            },
            caption,
          ]
        : null,
    ].filter(Boolean);
  },

  addCommands() {
    return {
      insertFigureImage:
        (attrs: { src: string; alt?: string | null; caption?: string | null }) =>
        ({ commands }) => {
          commands.insertContent({
            type: this.name,
            attrs: {
              src: attrs.src.trim(),
              alt: attrs.alt?.trim() ?? "",
              caption: attrs.caption?.trim() ?? "",
            },
          });

          return true;
        },
    };
  },
});

const KeyboardInput = TiptapNode.create({
  name: "keyboardInput",
  inline: true,
  group: "inline",
  content: "text*",
  selectable: false,
  draggable: false,

  parseHTML() {
    return [
      {
        tag: "kbd",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["kbd", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleKeyboardInput:
        () =>
        ({ state, dispatch }) => {
          const activeSelection = findKeyboardInputAtSelection(state.selection);

          if (activeSelection) {
            if (dispatch) {
              const replacement = activeSelection.node.textContent?.trim() ?? "";
              const transaction = replacement
                ? state.tr.replaceWith(
                    activeSelection.from,
                    activeSelection.to,
                    state.schema.text(replacement),
                  )
                : state.tr.delete(activeSelection.from, activeSelection.to);

              dispatch(transaction.scrollIntoView());
            }

            return true;
          }

          const selectedText = state.selection.empty
            ? ""
            : state.doc.textBetween(state.selection.from, state.selection.to).trim();
          const content = selectedText || "Ctrl";

          if (dispatch) {
            const node = state.schema.nodes.keyboardInput.create(
              null,
              state.schema.text(content),
            );
            dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
          }

          return true;
        },
    };
  },
});

const SitemapGeneratorEmbed = TiptapNode.create({
  name: "sitemapGeneratorEmbed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      class: {
        default: null,
      },
      id: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "sitemap-generator",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["sitemap-generator", mergeAttributes(HTMLAttributes)];
  },
});

const DetailsSummaryHeader = TiptapNode.create({
  name: "detailsSummaryHeader",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [
      {
        tag: "summary",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "summary",
      mergeAttributes(HTMLAttributes, {
        class: "details-element__summary",
      }),
      0,
    ];
  },
});

const DetailsSummaryContent = TiptapNode.create({
  name: "detailsSummaryContent",
  content: "block+",
  defining: true,

  parseHTML() {
    return [
      {
        tag: "div.details-element__content",
      },
      {
        tag: "details > div",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "details-element__content",
      }),
      0,
    ];
  },
});

const DetailsElement = TiptapNode.create({
  name: "detailsElement",
  group: "block",
  content: "detailsSummaryHeader detailsSummaryContent",
  defining: true,

  parseHTML() {
    return [
      {
        tag: "details",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, {
        class: "details-element",
        open: "open",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertDetailsElement:
        () =>
        ({ state, commands }) => {
          const selectedText = state.selection.empty
            ? ""
            : state.doc.textBetween(state.selection.from, state.selection.to, "\n").trim();
          const selectedLines = selectedText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          const question = selectedLines[0] || "Question";
          const answerLines = selectedLines.slice(1);
          const answerParagraphs = (answerLines.length ? answerLines : ["Réponse"]).map(
            (line) => ({
              type: "paragraph",
              content: [{ type: "text", text: line }],
            }),
          );

          return commands.insertContent({
            type: this.name,
            content: [
              {
                type: "detailsSummaryHeader",
                content: [{ type: "text", text: question }],
              },
              {
                type: "detailsSummaryContent",
                content: answerParagraphs,
              },
            ],
          });
        },
    };
  },
});

const CustomElementStructure = TiptapNode.create({
  name: "customElementStructure",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      type: {
        default: "sitemap-generator",
        parseHTML: (element) => {
          const customType =
            element.getAttribute("data-custom-element-type")?.trim() ?? "";

          if (customElementStructureOptions.some((option) => option.value === customType)) {
            return customType;
          }

          return "sitemap-generator";
        },
        renderHTML: (attributes) => ({
          "data-custom-element-type": normalizeCustomElementStructureType(
            String(attributes.type ?? "sitemap-generator"),
          ),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.custom-element[data-custom-element-type]",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const structureType = normalizeCustomElementStructureType(
      String(node.attrs.type ?? HTMLAttributes.type ?? "sitemap-generator"),
    );

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: "custom-element",
        "data-custom-element-type": structureType,
        contenteditable: "false",
        role: "button",
      }),
      [structureType],
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("custom-element-structure"),
        props: {
          handleClickOn(view, _pos, node, nodePos) {
            if (node.type.name !== "customElementStructure") {
              return false;
            }

            view.dispatch(
              view.state.tr.setSelection(
                NodeSelection.create(view.state.doc, nodePos ?? _pos),
              ),
            );
            return true;
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      insertCustomElementStructure:
        (type: string) =>
        ({ editor, commands }) => {
          const structureType = normalizeCustomElementStructureType(type);

          return commands.insertContent({
            type: this.name,
            attrs: {
              type: structureType,
            },
          });
        },
      toggleCustomElementStructure:
        (type: string) =>
          ({ editor, state, commands }) => {
            const selectedStructure =
              findCustomElementStructureAtSelection(state.selection);
            const isCurrentStructure =
              !!selectedStructure || editor.isActive("customElementStructure");

            if (isCurrentStructure) {
              return commands.removeCustomElementStructure();
            }

          return commands.insertCustomElementStructure(type);
        },
      removeCustomElementStructure:
        () =>
        ({ state, dispatch }) => {
          const { $from } = state.selection;

          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth);

            if (node.type.name !== this.name) {
              continue;
            }

            const from = $from.before(depth);
            const to = $from.after(depth);

            if (dispatch) {
              dispatch(state.tr.delete(from, to));
            }

            return true;
          }

          return false;
        },
    };
  },
});

function findKeyboardInputAtSelection(
  selection:
    | {
        $from: {
          depth: number;
          node: (depth: number) => {
            type: { name: string };
            attrs: Record<string, unknown>;
            textContent?: string | null;
          };
          before: (depth: number) => number;
          after: (depth: number) => number;
        };
      }
    | null
    | undefined,
) {
  if (!selection) {
    return null;
  }

  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    const node = selection.$from.node(depth);

    if (node.type.name !== "keyboardInput") {
      continue;
    }

    return {
      from: selection.$from.before(depth),
      to: selection.$from.after(depth),
      node,
    };
  }

  return null;
}

function normalizeCustomElementStructureType(value: string) {
  const normalizedValue = value.trim();

  return customElementStructureOptions.some(
    (option) => option.value === normalizedValue,
  )
    ? normalizedValue
    : "sitemap-generator";
}

function findCustomElementStructureAtSelection(
  selection: {
    $from: {
      depth: number;
      node: (depth: number) => { type: { name: string }; attrs: Record<string, unknown> };
      before: (depth: number) => number;
    };
  } | null | undefined,
) {
  if (!selection) {
    return null;
  }

  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    const node = selection.$from.node(depth);

    if (node.type.name !== "customElementStructure") {
      continue;
    }

    return {
      position: selection.$from.before(depth),
      type: normalizeCustomElementStructureType(
        String(node.attrs.type ?? "sitemap-generator"),
      ),
    };
  }

  return null;
}

function findDetailsElementAtSelection(
  selection:
    | {
        $from: {
          depth: number;
          node: (depth: number) => {
            type: { name: string };
          };
          before: (depth: number) => number;
          after: (depth: number) => number;
        };
      }
    | null
    | undefined,
) {
  if (!selection) {
    return null;
  }

  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    const node = selection.$from.node(depth);

    if (node.type.name !== "detailsElement") {
      continue;
    }

    return {
      from: selection.$from.before(depth),
      to: selection.$from.after(depth),
    };
  }

  return null;
}

function findImageNodeAtSelection(
  selection:
    | {
        from: number;
        $from: {
          depth: number;
          node: (depth: number) => {
            type: { name: string };
          };
          before: (depth: number) => number;
          after: (depth: number) => number;
        };
        node?: {
          type: { name: string };
        } | null;
      }
    | null
    | undefined,
) {
  if (!selection) {
    return null;
  }

  for (let depth = selection.$from.depth; depth > 0; depth -= 1) {
    const node = selection.$from.node(depth);

    if (node.type.name !== "image" && node.type.name !== "figureImage") {
      continue;
    }

    return {
      from: selection.$from.before(depth),
      to: selection.$from.after(depth),
    };
  }

  const selectedNode = "node" in selection ? selection.node : null;

  if (
    selectedNode &&
    (selectedNode.type.name === "image" ||
      selectedNode.type.name === "figureImage")
  ) {
    return {
      from: selection.from,
      to: selection.from + 1,
    };
  }

  return null;
}

function findNonBreakingSpaceRangeAtSelection(
  selection:
    | {
        empty: boolean;
        from: number;
        to: number;
        $from: {
          pos: number;
          nodeBefore: { isText?: boolean; text?: string | null } | null;
          nodeAfter: { isText?: boolean; text?: string | null } | null;
        };
      }
    | null
    | undefined,
  doc?:
    | {
        textBetween: (from: number, to: number) => string;
      }
    | null
    | undefined,
) {
  if (!selection) {
    return null;
  }

  if (!selection.empty) {
    const selectedText = doc?.textBetween(selection.from, selection.to) ?? "";

    if (/^\u00A0+$/.test(selectedText)) {
      return {
        from: selection.from,
        to: selection.to,
      };
    }

    return null;
  }

  const beforeNode = selection.$from.nodeBefore;

  if (beforeNode?.isText) {
    const beforeText = beforeNode.text ?? "";

    if (beforeText.endsWith("\u00A0")) {
      return {
        from: selection.$from.pos - 1,
        to: selection.$from.pos,
      };
    }
  }

  const afterNode = selection.$from.nodeAfter;

  if (afterNode?.isText) {
    const afterText = afterNode.text ?? "";

    if (afterText.startsWith("\u00A0")) {
      return {
        from: selection.$from.pos,
        to: selection.$from.pos + 1,
      };
    }
  }

  return null;
}

const asideVariantClassMap: Record<AsideVariant, string> = {
  info: "editor-callout-aside--info",
  warning: "editor-callout-aside--warning",
  success: "editor-callout-aside--success",
  tip: "editor-callout-aside--tip",
};

function normalizeAsideVariant(value: string | null | undefined): AsideVariant {
  if (value === "warning" || value === "success" || value === "tip") {
    return value;
  }

  return "info";
}

const CalloutAside = TiptapNode.create({
  name: "calloutAside",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: "info",
        parseHTML: (element) => {
          const explicitVariant = element.getAttribute("data-aside-variant");

          if (explicitVariant) {
            return normalizeAsideVariant(explicitVariant);
          }

          if (element.classList.contains("editor-callout-aside--warning")) {
            return "warning";
          }

          if (element.classList.contains("editor-callout-aside--success")) {
            return "success";
          }

          if (element.classList.contains("editor-callout-aside--tip")) {
            return "tip";
          }

          return "info";
        },
        renderHTML: (attributes) => {
          const variant = normalizeAsideVariant(attributes.variant);

          return {
            "data-aside-variant": variant,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "aside.editor-callout-aside",
      },
      {
        tag: "aside.editor-info-aside",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const variant = normalizeAsideVariant(
      String(HTMLAttributes.variant ?? HTMLAttributes["data-aside-variant"] ?? "info"),
    );
    const {
      variant: _variant,
      class: _className,
      ...rest
    } = HTMLAttributes as Record<string, string | null | undefined>;

    return [
      "aside",
      mergeAttributes(rest, {
        class: `editor-callout-aside ${asideVariantClassMap[variant]}`,
      }),
      0,
    ];
  },
});

const CalloutBox = TiptapNode.create({
  name: "calloutBox",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      backgroundColor: {
        default: "#f8fafc",
        parseHTML: (element) =>
          element.getAttribute("data-callout-background-color")?.trim() ||
          "#f8fafc",
        renderHTML: (attributes) => ({
          "data-callout-background-color":
            typeof attributes.backgroundColor === "string" &&
            attributes.backgroundColor.trim().length
              ? attributes.backgroundColor.trim()
              : "#f8fafc",
        }),
      },
      borderColor: {
        default: "#cbd5e1",
        parseHTML: (element) =>
          element.getAttribute("data-callout-border-color")?.trim() || "#cbd5e1",
        renderHTML: (attributes) => ({
          "data-callout-border-color":
            typeof attributes.borderColor === "string" &&
            attributes.borderColor.trim().length
              ? attributes.borderColor.trim()
              : "#cbd5e1",
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div.editor-callout-box",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const backgroundColor =
      typeof HTMLAttributes.backgroundColor === "string" &&
      HTMLAttributes.backgroundColor.trim().length
        ? HTMLAttributes.backgroundColor.trim()
        : typeof HTMLAttributes["data-callout-background-color"] === "string" &&
            HTMLAttributes["data-callout-background-color"].trim().length
          ? HTMLAttributes["data-callout-background-color"].trim()
          : "#f8fafc";
    const borderColor =
      typeof HTMLAttributes.borderColor === "string" &&
      HTMLAttributes.borderColor.trim().length
        ? HTMLAttributes.borderColor.trim()
        : typeof HTMLAttributes["data-callout-border-color"] === "string" &&
            HTMLAttributes["data-callout-border-color"].trim().length
          ? HTMLAttributes["data-callout-border-color"].trim()
          : "#cbd5e1";
    const {
      backgroundColor: _backgroundColor,
      borderColor: _borderColor,
      class: _className,
      style: existingStyle,
      ...rest
    } = HTMLAttributes as Record<string, string | null | undefined>;

    return [
      "div",
      mergeAttributes(rest, {
        class: "editor-callout-box",
        style: [
          existingStyle,
          `--editor-callout-box-background-color: ${backgroundColor}`,
          `--editor-callout-box-border-color: ${borderColor}`,
        ]
          .filter(Boolean)
          .join("; "),
      }),
      0,
    ];
  },
});

const CodeBlockWithLanguage = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: "plain",
        parseHTML: (element) => {
          const explicitLanguage = element.getAttribute("data-language")?.trim();

          if (explicitLanguage) {
            return explicitLanguage;
          }

          const codeClassName =
            element.querySelector("code")?.getAttribute("class") ?? "";
          const languageClass = codeClassName
            .split(/\s+/)
            .find((className) => className.startsWith("language-"));

          return languageClass?.slice("language-".length) || "plain";
        },
        renderHTML: (attributes) => {
          const language =
            typeof attributes.language === "string" &&
            attributes.language.trim().length
              ? attributes.language.trim()
              : "plain";

          return {
            "data-language": language,
          };
        },
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const language =
      typeof node.attrs.language === "string" && node.attrs.language.trim().length
        ? node.attrs.language.trim()
        : "plain";

    return [
      "pre",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-language": language,
      }),
      ["code", { class: `language-${language}` }, 0],
    ];
  },
});

const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: [...indentableEditorNodeTypes],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) =>
              Number(element.getAttribute("data-indent") ?? 0),
            renderHTML: (attributes) => {
              const indent = Number(attributes.indent ?? 0);

              if (!indent) {
                return {};
              }

              return {
                "data-indent": String(indent),
                style: `margin-left: ${indent * editorIndentStepRem}rem;`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const updateIndent =
      (direction: 1 | -1) =>
      () =>
      ({ editor, state, dispatch, commands }) => {
        if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
          return direction > 0
            ? commands.sinkListItem("listItem")
            : commands.liftListItem("listItem");
        }

        const { from, to } = state.selection;
        const transaction = state.tr;
        let hasUpdatedNode = false;

        state.doc.nodesBetween(from, to, (node, position) => {
          if (
            !indentableEditorNodeTypes.includes(
              node.type.name as (typeof indentableEditorNodeTypes)[number],
            )
          ) {
            return;
          }

          const currentIndent = Number(node.attrs.indent ?? 0);
          const nextIndent = Math.min(
            editorMaxIndentLevel,
            Math.max(0, currentIndent + direction),
          );

          if (nextIndent === currentIndent) {
            return false;
          }

          transaction.setNodeMarkup(position, undefined, {
            ...node.attrs,
            indent: nextIndent,
          });
          hasUpdatedNode = true;

          return false;
        });

        if (!hasUpdatedNode) {
          return false;
        }

        if (dispatch) {
          dispatch(transaction.scrollIntoView());
        }

        return true;
      };

    return {
      increaseIndent: updateIndent(1),
      decreaseIndent: updateIndent(-1),
    };
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const { editor } = this;
        const { empty, $from } = editor.state.selection;

        if (!empty || $from.parentOffset !== 0) {
          return false;
        }

        if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
          return editor.commands.decreaseIndent();
        }

        if (
          !indentableEditorNodeTypes.includes(
            $from.parent.type.name as (typeof indentableEditorNodeTypes)[number],
          )
        ) {
          return false;
        }

        const currentIndent = Number($from.parent.attrs.indent ?? 0);

        if (currentIndent < 1) {
          return false;
        }

        return editor.commands.decreaseIndent();
      },
    };
  },
});

interface UseBlogArticleEditorOptions {
  article: Ref<ArticleEditorDocument | null | undefined>;
  feedbackMessage: Ref<string>;
}

export function useBlogArticleEditor({
  article,
  feedbackMessage,
}: UseBlogArticleEditorOptions) {
  const title = ref("");
  const savedTitle = ref("");
  const savedContent = ref("");
  const editorMode = ref<EditorMode>("rich-text");
  const editorHtml = ref("");
  const isColorPickerOpen = ref(false);
  const isUsingNativeColorPicker = ref(false);
  const isTypingIndicatorActive = ref(false);
  const isSyncingArticleContent = ref(false);
  const isSyncingHtmlContent = ref(false);
  const selectedAsideVariant = ref<AsideVariant>("info");
  const selectedCalloutBoxBackgroundColor = ref("#f8fafc");
  const selectedCalloutBoxBorderColor = ref("#cbd5e1");
  const dirtySince = ref<number | null>(null);
  const dirtyElapsedLabel = ref("");
  const textColor = ref("#0f172a");
  const backgroundColor = ref("#fef08a");
  const saveHandler = shallowRef<EditorSaveHandler | null>(null);

  let typingIndicatorTimer: ReturnType<typeof setTimeout> | null = null;
  let dirtyElapsedTimer: ReturnType<typeof setInterval> | null = null;

  function clearTypingIndicatorTimer() {
    if (typingIndicatorTimer) {
      clearTimeout(typingIndicatorTimer);
      typingIndicatorTimer = null;
    }
  }

  function clearDirtyElapsedTimer() {
    if (dirtyElapsedTimer) {
      clearInterval(dirtyElapsedTimer);
      dirtyElapsedTimer = null;
    }
  }

  function formatDirtyElapsed(milliseconds: number) {
    const totalSeconds = Math.max(1, Math.floor(milliseconds / 1000));

    if (totalSeconds < 60) {
      return `${totalSeconds}s`;
    }

    const totalMinutes = Math.floor(totalSeconds / 60);

    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    }

    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    if (!remainingMinutes) {
      return `${totalHours}h`;
    }

    return `${totalHours}h ${remainingMinutes} min`;
  }

  function updateDirtyElapsedLabel() {
    if (!dirtySince.value) {
      dirtyElapsedLabel.value = "";
      return;
    }

    dirtyElapsedLabel.value = formatDirtyElapsed(Date.now() - dirtySince.value);
  }

  function startDirtyElapsedTimer() {
    updateDirtyElapsedLabel();

    if (dirtyElapsedTimer) {
      return;
    }

    dirtyElapsedTimer = setInterval(() => {
      updateDirtyElapsedLabel();
    }, 1000);
  }

  const hasChanges = computed(() => {
    const currentContent = editorHtml.value;

    return (
      title.value.trim() !== savedTitle.value.trim() ||
      currentContent !== savedContent.value
    );
  });

  watch(hasChanges, (value) => {
    if (value) {
      if (!dirtySince.value) {
        dirtySince.value = Date.now();
      }

      startDirtyElapsedTimer();
      return;
    }

    dirtySince.value = null;
    dirtyElapsedLabel.value = "";
    clearDirtyElapsedTimer();
  });

  function pulseTypingIndicator() {
    if (isSyncingArticleContent.value || !hasChanges.value) {
      return;
    }

    isTypingIndicatorActive.value = true;
    clearTypingIndicatorTimer();
    typingIndicatorTimer = setTimeout(() => {
      isTypingIndicatorActive.value = false;
      typingIndicatorTimer = null;
    }, 1800);
  }

  const editor = import.meta.client
    ? useEditor({
        extensions: [
          StarterKit.configure({
            codeBlock: false,
            link: false,
            underline: false,
          }),
          CodeBlockWithLanguage,
          Underline,
          Link.configure({
            openOnClick: false,
            autolink: true,
            defaultProtocol: "https",
            HTMLAttributes: {
              class: "text-sky-700 underline underline-offset-2",
              rel: "noopener noreferrer",
            },
          }),
          Image.configure({
            inline: false,
            HTMLAttributes: {
              class: "my-4 h-auto max-w-full rounded-2xl",
            },
          }),
          FigureImage,
          Placeholder.configure({
            placeholder: "Commencez à rédiger votre article...",
          }),
          NonBreakingSpace,
          EmDashHighlight,
          TextStyle,
          Color,
          Highlight.configure({
            multicolor: true,
          }),
          TextAlign.configure({
            types: ["heading", "paragraph"],
          }),
          Table.configure({
            resizable: true,
            HTMLAttributes: {
              class: "editor-table",
            },
          }),
          TableRow,
          TableHeader,
          TableCell,
          Indent,
          KeyboardInput,
          VideoEmbed,
          DetailsSummaryHeader,
          DetailsSummaryContent,
          DetailsElement,
          SitemapGeneratorEmbed,
          CalloutAside,
          CalloutBox,
          CustomElementStructure,
        ],
        content: "",
        editorProps: {
          attributes: {
            class:
              "prose prose-slate max-w-none min-h-[22rem] focus:outline-none",
          },
        },
        onUpdate() {
          if (editor.value) {
            isSyncingHtmlContent.value = true;
            editorHtml.value = formatEditorHtml(editor.value.getHTML());
            isSyncingHtmlContent.value = false;
          }
          pulseTypingIndicator();
        },
      })
    : shallowRef(null);

  watch(
    [article, editor],
    async ([value, editorInstance]) => {
      const incomingTitle = value?.title ?? "";
      const incomingContent = formatEditorHtml(value?.content ?? "");
      const matchesCurrentState =
        title.value === incomingTitle &&
        editorHtml.value === incomingContent;
      const editorMatchesCurrentState = editorInstance
        ? formatEditorHtml(editorInstance.getHTML()) === incomingContent
        : false;

      savedTitle.value = incomingTitle;
      savedContent.value = incomingContent;

      if (matchesCurrentState && editorMatchesCurrentState) {
        return;
      }

      isSyncingArticleContent.value = true;
      clearTypingIndicatorTimer();
      isTypingIndicatorActive.value = false;
      dirtySince.value = null;
      dirtyElapsedLabel.value = "";
      clearDirtyElapsedTimer();
      title.value = incomingTitle;
      isSyncingHtmlContent.value = true;
      editorHtml.value = incomingContent;
      editorInstance?.chain()
        .setMeta("addToHistory", false)
        .setContent(value?.content ?? "", { emitUpdate: false })
        .run();
      isSyncingHtmlContent.value = false;
      await nextTick();
      isSyncingArticleContent.value = false;
    },
    { immediate: true },
  );

  watch(title, () => {
    pulseTypingIndicator();
  });

  watch(editorHtml, (nextHtml) => {
    if (
      !editor.value ||
      isSyncingHtmlContent.value ||
      editorMode.value !== "html"
    ) {
      return;
    }

    isSyncingArticleContent.value = true;
    editor.value.chain()
      .setMeta("addToHistory", false)
      .setContent(nextHtml, { emitUpdate: false })
      .run();
    isSyncingArticleContent.value = false;
    pulseTypingIndicator();
  });

  const currentBlockFormat = computed<BlockFormatValue>(() => {
    if (!editor.value) {
      return "paragraph";
    }

    if (editor.value.isActive("codeBlock")) {
      return "code-block";
    }

    if (editor.value.isActive("blockquote")) {
      return "blockquote";
    }

    for (const level of [1, 2, 3, 4, 5, 6] as const) {
      if (editor.value.isActive("heading", { level })) {
        return `heading-${level}` as BlockFormatValue;
      }
    }

    return "paragraph";
  });

  const currentAsideVariant = computed<AsideVariant>(() => {
    if (!editor.value?.isActive("calloutAside")) {
      return selectedAsideVariant.value;
    }

    return normalizeAsideVariant(
      String(editor.value.getAttributes("calloutAside").variant ?? "info"),
    );
  });

  const currentCodeLanguage = computed(() => {
    if (!editor.value?.isActive("codeBlock")) {
      return "plain";
    }

    const language = editor.value.getAttributes("codeBlock").language;

    return typeof language === "string" && language.trim().length
      ? language.trim()
      : "plain";
  });

  const currentCalloutBoxBackgroundColor = computed(() => {
    if (!editor.value?.isActive("calloutBox")) {
      return selectedCalloutBoxBackgroundColor.value;
    }

    const backgroundColor = editor.value.getAttributes("calloutBox").backgroundColor;

    return typeof backgroundColor === "string" && backgroundColor.trim().length
      ? backgroundColor.trim()
      : "#f8fafc";
  });

  const currentCalloutBoxBorderColor = computed(() => {
    if (!editor.value?.isActive("calloutBox")) {
      return selectedCalloutBoxBorderColor.value;
    }

    const borderColor = editor.value.getAttributes("calloutBox").borderColor;

    return typeof borderColor === "string" && borderColor.trim().length
      ? borderColor.trim()
      : "#cbd5e1";
  });

  const currentCustomElementStructureType = computed(() => {
    const selectedStructure = findCustomElementStructureAtSelection(
      editor.value?.state.selection,
    );

    if (!selectedStructure) {
      return editor.value?.isActive("customElementStructure")
        ? normalizeCustomElementStructureType(
            String(editor.value.getAttributes("customElementStructure").type ?? "sitemap-generator"),
          )
        : "sitemap-generator";
    }

    return selectedStructure.type;
  });

  const isCustomElementStructureActive = computed(
    () =>
      !!findCustomElementStructureAtSelection(editor.value?.state.selection) ||
      !!editor.value?.isActive("customElementStructure"),
  );

  const isNonBreakingSpaceActive = computed(
    () =>
      !!findNonBreakingSpaceRangeAtSelection(
        editor.value?.state.selection,
        editor.value?.state.doc,
      ),
  );

  const isKeyboardInputActive = computed(
    () => !!findKeyboardInputAtSelection(editor.value?.state.selection),
  );

  const isImageSelected = computed(
    () => !!findImageNodeAtSelection(editor.value?.state.selection),
  );

  const statusMessage = computed(() => {
    if (feedbackMessage.value) {
      return feedbackMessage.value;
    }

    if (hasChanges.value && isTypingIndicatorActive.value) {
      return "Modification en cours";
    }

    if (hasChanges.value) {
      return `Modifications non enregistrées depuis ${dirtyElapsedLabel.value || "1s"}`;
    }

    return "A jour";
  });

  const canUndo = computed(() => editor.value?.can().undo() ?? false);
  const canRedo = computed(() => editor.value?.can().redo() ?? false);

  function isEditorReady() {
    return !!editor.value;
  }

  function isMarkActive(name: string, attributes?: Record<string, unknown>) {
    return editor.value?.isActive(name, attributes) ?? false;
  }

  function isTextAlignActive(alignment: TextAlignment) {
    return editor.value?.isActive({ textAlign: alignment }) ?? false;
  }

  function applyBlockFormat(value: BlockFormatValue) {
    if (!editor.value) {
      return;
    }

    const chain = editor.value.chain().focus();

    if (value === "paragraph") {
      chain.setParagraph().run();
      return;
    }

    if (value === "blockquote") {
      chain.toggleBlockquote().run();
      return;
    }

    if (value === "code-block") {
      chain.toggleCodeBlock().run();
      return;
    }

    const level = Number(value.split("-")[1]) as 1 | 2 | 3 | 4 | 5 | 6;
    chain.setHeading({ level }).run();
  }

  function onBlockFormatChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    applyBlockFormat(target.value as BlockFormatValue);
  }

  function setTextAlignment(alignment: TextAlignment) {
    editor.value?.chain().focus().setTextAlign(alignment).run();
  }

  function toggleBold() {
    editor.value?.chain().focus().toggleBold().run();
  }

  function toggleItalic() {
    editor.value?.chain().focus().toggleItalic().run();
  }

  function toggleUnderline() {
    editor.value?.chain().focus().toggleUnderline().run();
  }

  function toggleBulletList() {
    editor.value?.chain().focus().toggleBulletList().run();
  }

  function toggleNonBreakingSpace() {
    editor.value?.chain().focus().toggleNonBreakingSpace().run();
  }

  function toggleKeyboardInput() {
    editor.value?.chain().focus().toggleKeyboardInput().run();
  }

  function toggleOrderedList() {
    editor.value?.chain().focus().toggleOrderedList().run();
  }

  function applyTextColor(color: string) {
    textColor.value = color;
    editor.value?.chain().focus().setColor(color).run();
    isUsingNativeColorPicker.value = false;
  }

  function resetTextColor() {
    editor.value?.chain().focus().unsetColor().run();
  }

  function applyBackgroundColor(color: string) {
    backgroundColor.value = color;
    editor.value?.chain().focus().setHighlight({ color }).run();
    isUsingNativeColorPicker.value = false;
  }

  function resetBackgroundColor() {
    editor.value?.chain().focus().unsetHighlight().run();
  }

  function onColorPickerPointerDown() {
    isUsingNativeColorPicker.value = true;
  }

  function onColorPickerBlur() {
    window.setTimeout(() => {
      isUsingNativeColorPicker.value = false;
    }, 0);
  }

  function onColorPopoverInteractOutside(event: Event) {
    if (isUsingNativeColorPicker.value) {
      event.preventDefault();
    }
  }

  function increaseIndent() {
    editor.value?.chain().focus().increaseIndent().run();
  }

  function decreaseIndent() {
    editor.value?.chain().focus().decreaseIndent().run();
  }

  function clearFormatting() {
    editor.value?.chain().focus().unsetAllMarks().clearNodes().run();
  }

  function undo() {
    editor.value?.chain().focus().undo().run();
  }

  function redo() {
    editor.value?.chain().focus().redo().run();
  }

  function insertTable() {
    editor.value?.chain().focus().insertTable({
      rows: 3,
      cols: 3,
      withHeaderRow: true,
    }).run();
  }

  function setAsideVariant(variant: AsideVariant) {
    selectedAsideVariant.value = variant;

    if (editor.value?.isActive("calloutAside")) {
      editor.value.chain().focus().updateAttributes("calloutAside", {
        variant,
      }).run();
    }
  }

  function setCodeLanguage(language: string) {
    if (!editor.value?.isActive("codeBlock")) {
      return;
    }

    editor.value.chain().focus().updateAttributes("codeBlock", {
      language: language.trim() || "plain",
    }).run();
  }

  function toggleWrappedCallout(
    nodeName: "calloutAside" | "calloutBox",
    attrs: Record<string, unknown>,
  ) {
    if (!editor.value) {
      return;
    }

    const { state, view } = editor.value;
    const { from, to } = state.selection;
    const calloutNodeNames = new Set(["calloutAside", "calloutBox"]);
    const selectedCallouts = new Map<
      number,
      {
        from: number;
        to: number;
        node: any;
        nodeName: "calloutAside" | "calloutBox";
        attrs: Record<string, unknown>;
        selectedChildIndexes: Set<number>;
      }
    >();

    function findNearestCalloutDepth($pos: typeof state.selection.$from) {
      for (let depth = $pos.depth; depth > 0; depth -= 1) {
        if (calloutNodeNames.has($pos.node(depth).type.name)) {
          return depth;
        }
      }

      return null;
    }

    function registerSelectedChild($pos: typeof state.selection.$from) {
      const asideDepth = findNearestCalloutDepth($pos);

      if (asideDepth === null) {
        return false;
      }

      const childDepth = asideDepth + 1;

      if (childDepth > $pos.depth) {
        return false;
      }

      const asideFrom = $pos.before(asideDepth);
      const asideTo = $pos.after(asideDepth);
      const asideNode = $pos.node(asideDepth);
      const asideNodeName = asideNode.type.name as "calloutAside" | "calloutBox";
      const childIndex = $pos.index(asideDepth);
      const existing = selectedCallouts.get(asideFrom);

      if (existing) {
        existing.selectedChildIndexes.add(childIndex);
        return true;
      }

      selectedCallouts.set(asideFrom, {
        from: asideFrom,
        to: asideTo,
        node: asideNode,
        nodeName: asideNodeName,
        attrs: { ...asideNode.attrs },
        selectedChildIndexes: new Set([childIndex]),
      });

      return true;
    }

    if (state.selection.empty) {
      registerSelectedChild(state.selection.$from);
    } else {
      state.doc.nodesBetween(from, to, (node, position) => {
        if (!node.isBlock) {
          return;
        }

        const resolvedPos = state.doc.resolve(
          Math.min(position + 1, state.doc.content.size),
        );
        const asideDepth = findNearestCalloutDepth(resolvedPos);

        if (asideDepth === null) {
          return;
        }

        const childDepth = asideDepth + 1;

        if (
          childDepth > resolvedPos.depth ||
          resolvedPos.before(childDepth) !== position
        ) {
          return;
        }

        registerSelectedChild(resolvedPos);

        return false;
      });
    }

    if (selectedCallouts.size > 0) {
      const calloutNodeType = editor.value.schema.nodes[nodeName];

      if (!calloutNodeType) {
        return;
      }

      let transaction = state.tr;

      const createFragmentFromChildren = (children: any[]) =>
        Fragment.fromArray(children.filter(Boolean));

      for (const aside of [...selectedCallouts.values()].sort((a, b) => b.from - a.from)) {
        const originalCalloutNodeType = editor.value.schema.nodes[aside.nodeName];

        if (!originalCalloutNodeType) {
          continue;
        }

        const replacementNodes: Array<any> = [];
        let currentOriginalWrappedGroup: Array<any> = [];
        let currentTargetWrappedGroup: Array<any> = [];

        const flushOriginalWrappedGroup = () => {
          if (!currentOriginalWrappedGroup.length) {
            return;
          }

          replacementNodes.push(
            originalCalloutNodeType.create(
              aside.attrs,
              createFragmentFromChildren(currentOriginalWrappedGroup),
            ),
          );
          currentOriginalWrappedGroup = [];
        };

        const flushTargetWrappedGroup = () => {
          if (!currentTargetWrappedGroup.length) {
            return;
          }

          replacementNodes.push(
            calloutNodeType.create(
              attrs,
              createFragmentFromChildren(currentTargetWrappedGroup),
            ),
          );
          currentTargetWrappedGroup = [];
        };

        for (let index = 0; index < aside.node.childCount; index += 1) {
          const childNode = aside.node.child(index);

          if (aside.selectedChildIndexes.has(index)) {
            flushOriginalWrappedGroup();

            if (aside.nodeName === nodeName) {
              flushTargetWrappedGroup();
              replacementNodes.push(childNode);
              continue;
            }

            currentTargetWrappedGroup.push(childNode);
            continue;
          }

          flushTargetWrappedGroup();
          currentOriginalWrappedGroup.push(childNode);
        }

        flushOriginalWrappedGroup();
        flushTargetWrappedGroup();

        transaction = transaction.replaceWith(
          aside.from,
          aside.to,
          Fragment.fromArray(replacementNodes),
        );
      }

      const resolvedSelection = transaction.doc.resolve(
        Math.min(from, transaction.doc.content.size),
      );

      transaction.setSelection(TextSelection.near(resolvedSelection));
      view.dispatch(transaction.scrollIntoView());

      return;
    }

    editor.value.chain().focus().toggleWrap(nodeName, attrs).run();
  }

  function insertAside() {
    toggleWrappedCallout("calloutAside", {
      variant: currentAsideVariant.value,
    });
  }

  function setCalloutBoxBackgroundColor(color: string) {
    const normalizedColor = color.trim() || "#f8fafc";

    selectedCalloutBoxBackgroundColor.value = normalizedColor;

    if (editor.value?.isActive("calloutBox")) {
      editor.value.chain().focus().updateAttributes("calloutBox", {
        backgroundColor: normalizedColor,
      }).run();
    }
  }

  function setCalloutBoxBorderColor(color: string) {
    const normalizedColor = color.trim() || "#cbd5e1";

    selectedCalloutBoxBorderColor.value = normalizedColor;

    if (editor.value?.isActive("calloutBox")) {
      editor.value.chain().focus().updateAttributes("calloutBox", {
        borderColor: normalizedColor,
      }).run();
    }
  }

  function insertCalloutBox() {
    toggleWrappedCallout("calloutBox", {
      backgroundColor: currentCalloutBoxBackgroundColor.value,
      borderColor: currentCalloutBoxBorderColor.value,
    });
  }

  function insertCustomElementStructure(type: string) {
    editor.value
      ?.chain()
      .focus()
      .insertCustomElementStructure(type)
      .run();
  }

  function insertDetailsElement() {
    editor.value
      ?.chain()
      .focus()
      .insertDetailsElement()
      .run();
  }

  function toggleCustomElementStructure(type: string) {
    editor.value
      ?.chain()
      .focus()
      .toggleCustomElementStructure(type)
      .run();
  }

  function removeCustomElementStructure() {
    editor.value
      ?.chain()
      .focus()
      .removeCustomElementStructure()
      .run();
  }

  function deleteCurrentEditorElement() {
    if (!editor.value) {
      return false;
    }

    const { state, view } = editor.value;

    if (editor.value.isActive("link")) {
      editor.value
        .chain()
        .focus()
        .extendMarkRange("link")
        .unsetLink()
        .run();

      return true;
    }

    if (findCustomElementStructureAtSelection(state.selection)) {
      return removeCustomElementStructure();
    }

    const selectedDetailsElement = findDetailsElementAtSelection(state.selection);

    if (selectedDetailsElement) {
      const transaction = state.tr.delete(
        selectedDetailsElement.from,
        selectedDetailsElement.to,
      );
      const resolvedSelection = transaction.doc.resolve(
        Math.min(selectedDetailsElement.from, transaction.doc.content.size),
      );

      transaction.setSelection(TextSelection.near(resolvedSelection));
      view.dispatch(transaction.scrollIntoView());

      return true;
    }

    const selectedImage = findImageNodeAtSelection(state.selection);

    if (selectedImage) {
      const transaction = state.tr.delete(selectedImage.from, selectedImage.to);
      const resolvedSelection = transaction.doc.resolve(
        Math.min(selectedImage.from, transaction.doc.content.size),
      );

      transaction.setSelection(TextSelection.near(resolvedSelection));
      view.dispatch(transaction.scrollIntoView());

      return true;
    }

    return false;
  }

  function duplicateInputLine(
    target: HTMLInputElement | HTMLTextAreaElement,
    position: "before" | "after",
  ) {
    const selectionStart = target.selectionStart ?? 0;
    const selectionEnd = target.selectionEnd ?? selectionStart;
    const value = target.value;
    const lineStart =
      value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const nextLineBreak = value.indexOf("\n", selectionEnd);
    const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
    const line = value.slice(lineStart, lineEnd);
    const insertion = `${line}\n`;
    const insertAt =
      position === "before"
        ? lineStart
        : nextLineBreak === -1
          ? value.length
          : nextLineBreak + 1;
    const normalizedInsertion =
      position === "after" && nextLineBreak === -1 && value.length > 0
        ? `\n${line}`
        : insertion;
    const nextValue =
      value.slice(0, insertAt) + normalizedInsertion + value.slice(insertAt);

    target.value = nextValue;
    target.dispatchEvent(new Event("input", { bubbles: true }));

    const offset = position === "before" ? normalizedInsertion.length : 0;
    const nextSelectionStart = selectionStart + offset;
    const nextSelectionEnd = selectionEnd + offset;

    target.setSelectionRange(nextSelectionStart, nextSelectionEnd);
  }

  function duplicateEditorBlock(position: "before" | "after") {
    if (!editor.value) {
      return false;
    }

    const { state, view } = editor.value;
    const { $from } = state.selection;

    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);

      if (!node.isBlock) {
        continue;
      }

      const insertPos =
        position === "before" ? $from.before(depth) : $from.after(depth);
      const duplicateNode = node.type.create(node.attrs, node.content, node.marks);
      const transaction = state.tr.insert(insertPos, duplicateNode);
      const resolvedSelection = transaction.doc.resolve(
        Math.min(
          position === "before" ? insertPos + node.nodeSize + 1 : insertPos + 1,
          transaction.doc.content.size,
        ),
      );

      transaction.setSelection(TextSelection.near(resolvedSelection));
      view.dispatch(transaction.scrollIntoView());

      return true;
    }

    return false;
  }

  function deleteInputLine(target: HTMLInputElement | HTMLTextAreaElement) {
    const selectionStart = target.selectionStart ?? 0;
    const selectionEnd = target.selectionEnd ?? selectionStart;
    const value = target.value;
    const lineStart =
      value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const nextLineBreak = value.indexOf("\n", selectionEnd);
    const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
    const deleteEnd =
      nextLineBreak === -1
        ? lineStart > 0
          ? lineStart
          : lineEnd
        : lineStart === 0
          ? nextLineBreak + 1
          : nextLineBreak + 1;
    const deleteStart =
      nextLineBreak === -1 && lineStart > 0 ? lineStart - 1 : lineStart;
    const nextValue = value.slice(0, deleteStart) + value.slice(deleteEnd);

    target.value = nextValue;
    target.dispatchEvent(new Event("input", { bubbles: true }));

    const nextCursor = Math.min(deleteStart, nextValue.length);
    target.setSelectionRange(nextCursor, nextCursor);
  }

  function deleteEditorBlock() {
    if (!editor.value) {
      return false;
    }

    const { state, view } = editor.value;
    const { $from } = state.selection;

    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);

      if (!node.isBlock) {
        continue;
      }

      const from = $from.before(depth);
      const to = $from.after(depth);
      const transaction = state.tr.delete(from, to);
      const resolvedSelection = transaction.doc.resolve(
        Math.min(from, transaction.doc.content.size),
      );

      transaction.setSelection(TextSelection.near(resolvedSelection));
      view.dispatch(transaction.scrollIntoView());

      return true;
    }

    return false;
  }

  function isEditorEventTarget(target: EventTarget | null) {
    return (
      typeof globalThis.Node !== "undefined" &&
      target instanceof globalThis.Node &&
      !!editor.value?.view.dom.contains(target)
    );
  }

  function onEditorKeydown(event: KeyboardEvent) {
    const isDuplicateAfterShortcut =
      event.shiftKey && event.altKey && event.key === "ArrowDown";
    const isDuplicateBeforeShortcut =
      event.shiftKey && event.altKey && event.key === "ArrowUp";
    const isDeleteLineShortcut =
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.key.toLowerCase() === "k";
    const isUndoShortcut =
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      event.key.toLowerCase() === "z";
    const isSaveShortcut =
      (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";

    if (isUndoShortcut && !hasChanges.value) {
      const target = event.target;

      if (
        isEditorEventTarget(target) ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        event.preventDefault();
        event.stopPropagation();
      }

      return;
    }

    if (isDuplicateAfterShortcut || isDuplicateBeforeShortcut) {
      const position = isDuplicateBeforeShortcut ? "before" : "after";
      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        event.preventDefault();
        duplicateInputLine(target, position);
        return;
      }

      if (editor.value?.isFocused) {
        event.preventDefault();
        duplicateEditorBlock(position);
      }

      return;
    }

    if (isDeleteLineShortcut) {
      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        event.preventDefault();
        deleteInputLine(target);
        return;
      }

      if (editor.value?.isFocused) {
        event.preventDefault();
        deleteEditorBlock();
      }

      return;
    }

    if (!isSaveShortcut) {
      return;
    }

    event.preventDefault();
    void saveHandler.value?.();
  }

  function setSaveHandler(handler: EditorSaveHandler) {
    saveHandler.value = handler;
  }

  function markCurrentStateAsSaved(nextTitle: string, nextContent: string) {
    savedTitle.value = nextTitle;
    savedContent.value = formatEditorHtml(nextContent);
    dirtySince.value = null;
    dirtyElapsedLabel.value = "";
    clearDirtyElapsedTimer();
  }

  async function restoreSavedState() {
    const nextTitle = savedTitle.value;
    const nextContent = savedContent.value;

    isSyncingArticleContent.value = true;
    clearTypingIndicatorTimer();
    isTypingIndicatorActive.value = false;
    dirtySince.value = null;
    dirtyElapsedLabel.value = "";
    clearDirtyElapsedTimer();
    title.value = nextTitle;
    isSyncingHtmlContent.value = true;
    editorHtml.value = nextContent;
    editor.value?.chain()
      .setMeta("addToHistory", false)
      .setContent(nextContent, { emitUpdate: false })
      .run();
    isSyncingHtmlContent.value = false;
    await nextTick();
    isSyncingArticleContent.value = false;
  }

  onMounted(() => {
    window.addEventListener("keydown", onEditorKeydown, true);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", onEditorKeydown, true);
    clearTypingIndicatorTimer();
    clearDirtyElapsedTimer();
    editor.value?.destroy();
  });

  return {
    title,
    editorMode,
    editorHtml,
    isColorPickerOpen,
    isTypingIndicatorActive,
    dirtySince,
    dirtyElapsedLabel,
    currentAsideVariant,
    currentCodeLanguage,
    currentCalloutBoxBackgroundColor,
    currentCalloutBoxBorderColor,
    currentCustomElementStructureType,
    textColor,
    backgroundColor,
    editor,
    currentBlockFormat,
    hasChanges,
    statusMessage,
    canUndo,
    canRedo,
    isCustomElementStructureActive,
    isImageSelected,
    isKeyboardInputActive,
    isNonBreakingSpaceActive,
    isEditorReady,
    isMarkActive,
    isTextAlignActive,
    onBlockFormatChange,
    setTextAlignment,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleBulletList,
    toggleKeyboardInput,
    toggleNonBreakingSpace,
    toggleOrderedList,
    applyTextColor,
    resetTextColor,
    applyBackgroundColor,
    resetBackgroundColor,
    onColorPickerPointerDown,
    onColorPickerBlur,
    onColorPopoverInteractOutside,
    increaseIndent,
    decreaseIndent,
    clearFormatting,
    undo,
    redo,
    insertTable,
    setAsideVariant,
    setCodeLanguage,
    setCalloutBoxBackgroundColor,
    setCalloutBoxBorderColor,
    insertCustomElementStructure,
    insertDetailsElement,
    insertAside,
    insertCalloutBox,
    removeCustomElementStructure,
    deleteCurrentEditorElement,
    setSaveHandler,
    toggleCustomElementStructure,
    markCurrentStateAsSaved,
    restoreSavedState,
  };
}
