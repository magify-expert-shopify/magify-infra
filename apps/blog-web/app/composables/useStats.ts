import type {
  BusinessKpisResponse,
  OpenAiUsageRange,
  OpenAiUsageResponse,
  SeoKpiRange,
  SeoKpisResponse,
} from "~/types/stats";
import { toValue } from "vue";
import type { Ref } from "vue";

const SEO_KPIS_ASYNC_KEY_PREFIX = "stats-seo-kpis";
const BUSINESS_KPIS_ASYNC_KEY = "stats-business-kpis";
const OPENAI_USAGE_ASYNC_KEY_PREFIX = "stats-openai-usage";

export function useStats() {
  const { request } = useApi();

  function useSeoKpisData(range: Ref<SeoKpiRange> | SeoKpiRange = "28d") {
    return useAsyncData(
      () => `${SEO_KPIS_ASYNC_KEY_PREFIX}-${toValue(range)}`,
      () =>
        request<SeoKpisResponse>("/stats/seo-kpis", {
          query: { range: toValue(range) },
        }),
      {
        watch: [() => toValue(range)],
      },
    );
  }

  function useBusinessKpisData() {
    return useAsyncData(BUSINESS_KPIS_ASYNC_KEY, () =>
      request<BusinessKpisResponse>("/stats/business-kpis"),
    );
  }

  function useOpenAiUsageData(range: Ref<OpenAiUsageRange> | OpenAiUsageRange = "30d") {
    return useAsyncData(
      () => `${OPENAI_USAGE_ASYNC_KEY_PREFIX}-${toValue(range)}`,
      () =>
        request<OpenAiUsageResponse>("/stats/openai-usage", {
          query: { range: toValue(range) },
        }),
      {
        watch: [() => toValue(range)],
      },
    );
  }

  return {
    useBusinessKpisData,
    useOpenAiUsageData,
    useSeoKpisData,
  };
}
