export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = new Set(["/login"]);
  const { isAuthenticated, ensureSession } = useSupabaseAuth();

  if (publicRoutes.has(to.path)) {
    if (isAuthenticated.value) {
      return navigateTo((to.query.redirect as string) || "/");
    }

    return;
  }

  const session = await ensureSession();

  if (!session) {
    return navigateTo({
      path: "/login",
      query: { redirect: to.fullPath },
    });
  }
});
