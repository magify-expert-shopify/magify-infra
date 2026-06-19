import type { PageListRecord } from "~/types/pages";

export function normalizeUserId(userId?: string | null) {
  return userId?.trim() ?? "";
}

export function isPageAssignedToUser(
  page: PageListRecord,
  userId?: string | null,
) {
  const assigneeId = normalizeUserId(page.assignedSupabaseUserId);
  const normalizedUserId = normalizeUserId(userId);

  return Boolean(assigneeId && normalizedUserId && assigneeId === normalizedUserId);
}

export function filterPagesAssignedToUser(
  pages: PageListRecord[],
  userId?: string | null,
) {
  return pages.filter((page) => isPageAssignedToUser(page, userId));
}

export function isPageInReviewAssignedToUser(
  page: PageListRecord,
  userId?: string | null,
) {
  const assigneeId = normalizeUserId(
    page.blogArticle?.reviewSupabaseUser?.id ??
      page.blogArticle?.reviewSupabaseUserId,
  );
  const normalizedUserId = normalizeUserId(userId);
  const isCompleted = Boolean(page.blogArticle?.reviewCompletedAt);

  return Boolean(
    assigneeId &&
      normalizedUserId &&
      assigneeId === normalizedUserId &&
      !isCompleted,
  );
}

export function filterPagesInReviewAssignedToUser(
  pages: PageListRecord[],
  userId?: string | null,
) {
  return pages.filter((page) => isPageInReviewAssignedToUser(page, userId));
}

export function filterPagesInReview(pages: PageListRecord[]) {
  return pages.filter((page) => !page.blogArticle?.reviewCompletedAt);
}
