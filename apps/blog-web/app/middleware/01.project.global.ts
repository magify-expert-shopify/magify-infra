export default defineNuxtRouteMiddleware(async (to) => {
  const allowedRoutes = new Set([
    "/login",
    "/onboarding",
    "/projects",
  ]);
  const { currentProject, setCurrentProject, clearCurrentProject } = useCurrentProject();
  const { accessToken, user } = useSupabaseAuth();
  const { getCurrentProject } = useSettings();
  const restoreAttempts = useState<Record<string, boolean>>(
    "current-project:restore-attempts",
    () => ({}),
  );

  if (allowedRoutes.has(to.path)) {
    return;
  }

  if (!currentProject.value?.id && accessToken.value) {
    const restoreKey = user.value?.id || accessToken.value;

    if (!restoreAttempts.value[restoreKey]) {
      restoreAttempts.value = {
        ...restoreAttempts.value,
        [restoreKey]: true,
      };

      try {
        const response = await getCurrentProject();

        if (response.project) {
          setCurrentProject(response.project);
        } else {
          clearCurrentProject();
        }
      } catch {
        clearCurrentProject();
      }
    }
  }

  if (!currentProject.value?.id) {
    return navigateTo({
      path: "/projects",
      query: { redirect: to.fullPath },
    });
  }
});
