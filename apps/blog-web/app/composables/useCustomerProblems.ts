import type {
  CustomerProblem,
  UpsertCustomerProblemInput,
} from "~/types/customer-problems";

export function useCustomerProblems() {
  const { request } = useApi();

  function useCustomerProblemsList() {
    return useAsyncData("customer-problems", () =>
      request<CustomerProblem[]>("/customer-problems"),
    );
  }

  function useCustomerProblem(id: string) {
    return useAsyncData(`customer-problem:${id}`, () =>
      request<CustomerProblem>(`/customer-problems/${id}`),
    );
  }

  function createCustomerProblem(input: UpsertCustomerProblemInput) {
    return request<CustomerProblem>("/customer-problems", {
      method: "POST",
      body: input,
    });
  }

  function updateCustomerProblem(
    id: string,
    input: Partial<UpsertCustomerProblemInput>,
  ) {
    return request<CustomerProblem>(`/customer-problems/${id}`, {
      method: "PATCH",
      body: input,
    });
  }

  function deleteCustomerProblem(id: string) {
    return request<CustomerProblem>(`/customer-problems/${id}`, {
      method: "DELETE",
    });
  }

  function extractCustomerProblemKeywords(id: string) {
    return request<CustomerProblem>(`/customer-problems/${id}/extract-keywords`, {
      method: "POST",
    });
  }

  return {
    useCustomerProblemsList,
    useCustomerProblem,
    createCustomerProblem,
    updateCustomerProblem,
    deleteCustomerProblem,
    extractCustomerProblemKeywords,
  };
}
