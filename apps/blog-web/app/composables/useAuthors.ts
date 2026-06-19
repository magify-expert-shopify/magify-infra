import type { Author } from "~/types/domain";
import type { UpsertMagifyAuthorInput } from "~/types/authors";

export function useAuthors() {
  const { request } = useApi();

  function useAuthorsList() {
    return useAsyncData("authors", () => request<Author[]>("/authors"));
  }

  function useMagifyAuthorsList() {
    return useAsyncData("magify-authors", () =>
      request<Author[]>("/authors/magify"),
    );
  }

  function createMagifyAuthor(input: UpsertMagifyAuthorInput) {
    return request<Author>("/authors/magify", {
      method: "POST",
      body: input,
    });
  }

  function updateMagifyAuthor(id: string, input: UpsertMagifyAuthorInput) {
    return request<Author>(`/authors/magify/${id}`, {
      method: "PATCH",
      body: input,
    });
  }

  function deleteMagifyAuthor(id: string) {
    return request<Author>(`/authors/magify/${id}`, {
      method: "DELETE",
    });
  }

  return {
    useAuthorsList,
    useMagifyAuthorsList,
    createMagifyAuthor,
    updateMagifyAuthor,
    deleteMagifyAuthor,
  };
}
