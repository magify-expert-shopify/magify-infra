const openAiModelPalette = [
  { border: "rgb(14 165 233)", background: "rgba(14, 165, 233, 0.15)" },
  { border: "rgb(168 85 247)", background: "rgba(168, 85, 247, 0.15)" },
  { border: "rgb(34 197 94)", background: "rgba(34, 197, 94, 0.15)" },
  { border: "rgb(249 115 22)", background: "rgba(249, 115, 22, 0.15)" },
  { border: "rgb(244 63 94)", background: "rgba(244, 63, 94, 0.15)" },
  { border: "rgb(20 184 166)", background: "rgba(20, 184, 166, 0.15)" },
  { border: "rgb(234 179 8)", background: "rgba(234, 179, 8, 0.15)" },
  { border: "rgb(99 102 241)", background: "rgba(99, 102, 241, 0.15)" },
] as const;

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getOpenAiModelColors(model: string) {
  const normalizedModel = model.trim().toLowerCase();
  const paletteIndex =
    openAiModelPalette.length > 0
      ? hashString(normalizedModel) % openAiModelPalette.length
      : 0;

  return openAiModelPalette[paletteIndex] ?? openAiModelPalette[0];
}
