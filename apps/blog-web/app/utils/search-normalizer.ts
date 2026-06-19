export function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function includesSearchText(value: string | null | undefined, search: string) {
  const normalizedSearch = normalizeSearchText(search);

  if (!normalizedSearch) {
    return true;
  }

  return normalizeSearchText(value).includes(normalizedSearch);
}

export function equalsSearchText(value: string | null | undefined, search: string) {
  return normalizeSearchText(value) === normalizeSearchText(search);
}
