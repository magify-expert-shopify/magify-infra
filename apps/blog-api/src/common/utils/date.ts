export function toDate(value: string) {
  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}
