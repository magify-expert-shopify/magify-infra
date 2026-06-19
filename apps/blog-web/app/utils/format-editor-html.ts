const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const INLINE_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "cite",
  "code",
  "em",
  "i",
  "mark",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "u",
]);

const COLLAPSIBLE_WHITESPACE = /[ \t\r\n\f\v]+/g;

function escapeAttribute(value: string) {
  return value.replaceAll('"', "&quot;");
}

function formatAttributes(element: Element) {
  return Array.from(element.attributes)
    .map((attribute) => ` ${attribute.name}="${escapeAttribute(attribute.value)}"`)
    .join("");
}

function isInlineLikeNode(node: ChildNode) {
  if (node.nodeType === Node.TEXT_NODE) {
    return true;
  }

  return (
    node.nodeType === Node.ELEMENT_NODE &&
    INLINE_TAGS.has((node as Element).tagName.toLowerCase())
  );
}

function formatInlineNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.replace(COLLAPSIBLE_WHITESPACE, " ") ?? "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const attributes = formatAttributes(element);
  const children = Array.from(element.childNodes)
    .map(formatInlineNode)
    .filter(Boolean)
    .join("");

  if (VOID_TAGS.has(tagName)) {
    return `<${tagName}${attributes}>`;
  }

  return `<${tagName}${attributes}>${children}</${tagName}>`;
}

function formatNode(node: ChildNode, depth: number): string {
  const indentation = "  ".repeat(depth);

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.replace(COLLAPSIBLE_WHITESPACE, " ") ?? "";
    return text.trim() ? `${indentation}${text}` : "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();
  const attributes = formatAttributes(element);

  if (VOID_TAGS.has(tagName)) {
    return `${indentation}<${tagName}${attributes}>`;
  }

  const children = Array.from(element.childNodes).filter((child) => {
    if (child.nodeType !== Node.TEXT_NODE) {
      return true;
    }

    return !!child.textContent?.trim();
  });

  if (!children.length) {
    return `${indentation}<${tagName}${attributes}></${tagName}>`;
  }

  if (children.every(isInlineLikeNode)) {
    const inlineContent = children.map(formatInlineNode).filter(Boolean).join("");
    return `${indentation}<${tagName}${attributes}>${inlineContent}</${tagName}>`;
  }

  const formattedChildren = children
    .map((child) => formatNode(child, depth + 1))
    .filter(Boolean)
    .join("\n");

  return `${indentation}<${tagName}${attributes}>\n${formattedChildren}\n${indentation}</${tagName}>`;
}

export function formatEditorHtml(html: string) {
  const source = html.replace(/\r\n?/g, "\n").trim();

  if (!source || !import.meta.client) {
    return source;
  }

  // Preserve manual indentation from the HTML code editor instead of
  // reformatting it through the pretty-printer.
  if (source.includes("\n")) {
    return source;
  }

  const documentFragment = new DOMParser().parseFromString(source, "text/html");

  return Array.from(documentFragment.body.childNodes)
    .map((node) => formatNode(node, 0))
    .filter(Boolean)
    .join("\n");
}
