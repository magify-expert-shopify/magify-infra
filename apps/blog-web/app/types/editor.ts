export type BlockFormatValue =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "heading-4"
  | "heading-5"
  | "heading-6"
  | "blockquote"
  | "code-block";

export type TextAlignment = "left" | "center" | "right" | "justify";

export type EditorMode = "rich-text" | "html" | "script-assets" | "preview";

export type AsideVariant = "info" | "warning" | "success" | "tip";

export interface ArticleEditorDocument {
  title?: string | null;
  content?: string | null;
}

export type EditorSaveHandler = () => void | Promise<void>;
