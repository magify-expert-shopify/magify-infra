export interface ArticleChecklistInput {
  title: string;
  slug: string;
  primaryKeyword: string;
  requiredKeywords: string;
  seoTitle: string;
  seoDescription: string;
  html: string;
}

export interface ArticleChecklistItem {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface ArticleChecklistSection {
  id: string;
  title: string;
  items: ArticleChecklistItem[];
}

const slugStopWords = new Set(["de", "a", "le", "les"]);
const contentStopWords = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "dans",
  "de",
  "des",
  "du",
  "en",
  "et",
  "la",
  "le",
  "les",
  "ou",
  "pour",
  "sur",
  "une",
  "un",
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractWords(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((word) => word.trim())
    .filter(Boolean);
}

function countWords(value: string) {
  return extractWords(value).length;
}

function splitRequiredKeywords(value: string) {
  return value
    .split(/[\n,;|]+/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

function parseHtmlContent(html: string) {
  if (!import.meta.client || typeof DOMParser === "undefined") {
    return null;
  }

  return new DOMParser().parseFromString(html, "text/html");
}

function getTextContent(documentNode: Document) {
  return documentNode.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function hasHeadingTreeCoherence(documentNode: Document) {
  const headings = Array.from(
    documentNode.body.querySelectorAll("h1, h2, h3, h4, h5, h6"),
  ).map((heading) => Number(heading.tagName.replace("H", "")));

  if (!headings.length) {
    return true;
  }

  let previousLevel = 1;
  let hasSeenH2OrDeeper = false;

  for (const level of headings) {
    if (level - previousLevel > 1) {
      return false;
    }

    if (level === 1 && hasSeenH2OrDeeper) {
      return false;
    }

    if (level >= 2) {
      hasSeenH2OrDeeper = true;
    }

    previousLevel = level;
  }

  return true;
}

function allParagraphsUnderLimit(documentNode: Document) {
  return Array.from(documentNode.body.querySelectorAll("p")).every(
    (paragraph) => countWords(paragraph.textContent ?? "") < 250,
  );
}

function countEligibleBoldExpressions(documentNode: Document) {
  return Array.from(documentNode.body.querySelectorAll("strong, b")).filter(
    (node) => !node.closest("a, h1, h2, h3, h4, h5, h6"),
  ).length;
}

function hasBulletList(documentNode: Document) {
  return !!documentNode.body.querySelector("ul li");
}

function hasFaqSection(documentNode: Document) {
  return Array.from(documentNode.body.querySelectorAll("h2, h3, h4, h5, h6")).some(
    (heading) => {
      const normalized = normalizeText(heading.textContent ?? "");

      return (
        normalized.includes("faq") ||
        normalized.includes("foire aux questions") ||
        normalized.includes("questions frequentes")
      );
    },
  );
}

function seoDescriptionMatchesContent(seoDescription: string, content: string) {
  const descriptionWords = extractWords(seoDescription).filter(
    (word) => word.length > 2 && !contentStopWords.has(word),
  );
  const contentWords = new Set(
    extractWords(content).filter(
      (word) => word.length > 2 && !contentStopWords.has(word),
    ),
  );

  return descriptionWords.some((word) => contentWords.has(word));
}

export function buildArticleSeoChecklist(
  input: ArticleChecklistInput,
): ArticleChecklistSection[] {
  const documentNode = parseHtmlContent(input.html);
  const articleTitle = input.title.trim();
  const primaryKeyword = input.primaryKeyword.trim();
  const requiredKeywords = splitRequiredKeywords(input.requiredKeywords);
  const seoTitle = input.seoTitle.trim();
  const seoDescription = input.seoDescription.trim();
  const slug = input.slug.trim();
  const normalizedTitle = normalizeText(articleTitle);
  const normalizedPrimaryKeyword = normalizeText(primaryKeyword);
  const contentText = documentNode ? getTextContent(documentNode) : "";
  const normalizedContent = normalizeText(contentText);
  const totalWordCount = countWords(contentText);
  const eligibleBoldCount = documentNode
    ? countEligibleBoldExpressions(documentNode)
    : 0;
  const requiredBoldCount = Math.floor(totalWordCount / 100);
  const slugWords = extractWords(slug);
  const titleWords = new Set(
    extractWords(articleTitle).filter(
      (word) => word.length > 2 && !slugStopWords.has(word),
    ),
  );

  return [
    {
      id: "h1",
      title: "1. H1",
      items: [
        {
          label: "Le titre de l'article doit être renseigné",
          passed: articleTitle.length > 0,
        },
        {
          label: "Le titre de l'article doit contenir le mot-clé principal",
          passed:
            !!normalizedPrimaryKeyword &&
            normalizedTitle.includes(normalizedPrimaryKeyword),
        },
      ],
    },
    {
      id: "headings",
      title: "2. H2 & H3",
      items: [
        {
          label: "Les Hn ont une bonne arborescence",
          passed: documentNode ? hasHeadingTreeCoherence(documentNode) : false,
        },
      ],
    },
    {
      id: "content",
      title: "3. Contenu",
      items: [
        {
          label: "L'article contient tous les mots-clés obligatoires",
          passed:
            requiredKeywords.length > 0 &&
            requiredKeywords.every((keyword) =>
              normalizedContent.includes(normalizeText(keyword)),
            ),
        },
        {
          label: "Les paragraphes font moins de 250 mots",
          passed: documentNode ? allParagraphsUnderLimit(documentNode) : false,
        },
      ],
    },
    {
      id: "bold",
      title: "4. Gras",
      items: [
        {
          label: "L'article a 1 expression en gras tous les 100 mots",
          passed: eligibleBoldCount >= requiredBoldCount,
          detail:
            totalWordCount > 0
              ? `${eligibleBoldCount}/${requiredBoldCount} requis`
              : undefined,
        },
        {
          label: "Les expressions en gras ne sont pas sur des liens ou des titres",
          passed:
            eligibleBoldCount ===
            (documentNode
              ? Array.from(documentNode.body.querySelectorAll("strong, b")).length
              : 0),
        },
      ],
    },
    {
      id: "seo-title",
      title: "5. Titre SEO",
      items: [
        {
          label: "Le titre SEO contient le mot-clé principal",
          passed:
            !!normalizedPrimaryKeyword &&
            normalizeText(seoTitle).includes(normalizedPrimaryKeyword),
        },
        {
          label: "Le titre SEO ne dépasse pas 65 caractères",
          passed: seoTitle.length > 0 && seoTitle.length <= 65,
        },
        {
          label: "Le mot-clé principal est au début du titre SEO",
          passed:
            !!normalizedPrimaryKeyword &&
            normalizeText(seoTitle).startsWith(normalizedPrimaryKeyword),
        },
        {
          label: "Le titre SEO contient au moins une majuscule",
          passed: /[A-ZÀ-ÖØ-Þ]/.test(seoTitle),
        },
      ],
    },
    {
      id: "seo-description",
      title: "6. Description SEO",
      items: [
        {
          label: "La description SEO est en lien avec le contenu de la page",
          passed: seoDescriptionMatchesContent(seoDescription, contentText),
        },
        {
          label: "La description SEO fait entre 130 et 160 caractères",
          passed: seoDescription.length >= 130 && seoDescription.length <= 160,
        },
        {
          label: "La description SEO contient le mot-clé principal",
          passed:
            !!normalizedPrimaryKeyword &&
            normalizeText(seoDescription).includes(normalizedPrimaryKeyword),
        },
        {
          label: "La description SEO contient au moins une majuscule",
          passed: /[A-ZÀ-ÖØ-Þ]/.test(seoDescription),
        },
        {
          label: "La description SEO contient un élément de relief visuel",
          passed: /[|\-✓]/.test(seoDescription),
        },
      ],
    },
    {
      id: "url",
      title: "7. URL",
      items: [
        {
          label: "Le slug ne contient pas de mots de liaison interdits",
          passed:
            slugWords.length > 0 &&
            slugWords.every((word) => !slugStopWords.has(word)),
        },
        {
          label: "Le slug contient des mots du titre ou du H1",
          passed: slugWords.some((word) => titleWords.has(word)),
        },
      ],
    },
    {
      id: "ai",
      title: "8. ChatGPT & IA",
      items: [
        {
          label: "Le contenu contient au moins une liste à puce",
          passed: documentNode ? hasBulletList(documentNode) : false,
        },
        {
          label: "Le contenu contient une section FAQ",
          passed: documentNode ? hasFaqSection(documentNode) : false,
        },
      ],
    },
  ];
}
