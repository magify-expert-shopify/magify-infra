export const customElementAssetRegistry = {
  "sitemap-generator": "/assets/sitemap-generator.js",
} as const;

export type SupportedCustomElementTagName =
  keyof typeof customElementAssetRegistry;

export const customElementStructureOptions = [
  {
    label: "Sitemap generator",
    value: "sitemap-generator",
  },
  {
    label: "Details / summary",
    value: "details-summary",
  },

] as const;

export const applicationCustomElementStructureOptions =
  customElementStructureOptions.filter(
    (option) => option.value !== "details-summary",
  );

export type CustomElementStructureType =
  (typeof customElementStructureOptions)[number]["value"];
