import type { AsideVariant, BlockFormatValue, EditorMode } from "~/types/editor";

export const editorIndentStepRem = 1.5;
export const editorMaxIndentLevel = 6;
export const indentableEditorNodeTypes = [
  "paragraph",
  "heading",
  "blockquote",
] as const;

export const blockFormatOptions: Array<{
  label: string;
  value: BlockFormatValue;
}> = [
  { label: "Paragraphe", value: "paragraph" },
  { label: "Titre 2", value: "heading-2" },
  { label: "Titre 3", value: "heading-3" },
  { label: "Titre 4", value: "heading-4" },
  { label: "Titre 5", value: "heading-5" },
  { label: "Titre 6", value: "heading-6" },
  { label: "Bloc de citation", value: "blockquote" },
  { label: "Code", value: "code-block" },
];

export const editorModeOptions: Array<{
  label: string;
  value: EditorMode;
}> = [
  { label: "Editeur de texte", value: "rich-text" },
  { label: "Editeur html", value: "html" },
  { label: "Scripts JS", value: "script-assets" },
  { label: "Apercue", value: "preview" },
];

export const asideVariantOptions: Array<{
  label: string;
  value: AsideVariant;
}> = [
  { label: "Info", value: "info" },
  { label: "Avertissement", value: "warning" },
  { label: "Succès", value: "success" },
  { label: "Conseil", value: "tip" },
];

export const codeLanguageOptions: Array<{
  label: string;
  value: string;
}> = [
  { label: "Texte brut", value: "plain" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "HTML", value: "html" },
  { label: "CSS", value: "css" },
  { label: "JSON", value: "json" },
  { label: "Bash", value: "bash" },
  { label: "SQL", value: "sql" },
  { label: "Python", value: "python" },
];
