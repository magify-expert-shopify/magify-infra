import type {
  CustomerProblemCategory,
  UpsertCustomerProblemCategoryInput,
} from "~/types/customer-problems";

export function useCustomerProblemCategories() {
  const { request } = useApi();

  function useCustomerProblemCategoriesList() {
    return useAsyncData("customer-problem-categories", () =>
      request<CustomerProblemCategory[]>("/customer-problem-categories"),
    );
  }

  function createCustomerProblemCategory(
    input: string | UpsertCustomerProblemCategoryInput,
  ) {
    const payload =
      typeof input === "string"
        ? { title: input, clusterIds: [] }
        : input;

    return request<CustomerProblemCategory>("/customer-problem-categories", {
      method: "POST",
      body: payload,
    });
  }

  function updateCustomerProblemCategory(
    id: string,
    input: string | Partial<UpsertCustomerProblemCategoryInput>,
  ) {
    const payload = typeof input === "string" ? { title: input } : input;

    return request<CustomerProblemCategory>(`/customer-problem-categories/${id}`, {
      method: "PATCH",
      body: payload,
    });
  }

  function deleteCustomerProblemCategory(id: string) {
    return request<CustomerProblemCategory>(`/customer-problem-categories/${id}`, {
      method: "DELETE",
    });
  }

  return {
    useCustomerProblemCategoriesList,
    createCustomerProblemCategory,
    updateCustomerProblemCategory,
    deleteCustomerProblemCategory,
  };
}
