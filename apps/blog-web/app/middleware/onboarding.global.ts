import type { BusinessPositioningSettings } from "~/types/settings";

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/login") {
    return;
  }

  const businessPositioningState = useState<BusinessPositioningSettings | null>(
    "business-positioning",
    () => null,
  );

  if (!businessPositioningState.value) {
    try {
      businessPositioningState.value =
        await useSettings().getBusinessPositioning();
    } catch {
      return;
    }
  }

  const isComplete = businessPositioningState.value?.isComplete ?? false;

  if (!isComplete && to.path !== "/onboarding") {
    return navigateTo("/onboarding");
  }

  if (isComplete && to.path === "/onboarding") {
    return navigateTo("/");
  }
});
