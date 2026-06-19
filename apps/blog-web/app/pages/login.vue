<script setup lang="ts">
const route = useRoute();
const { signInWithPassword, isAuthenticated } = useSupabaseAuth();

definePageMeta({
  layout: false,
});

const email = ref("");
const password = ref("");
const isSubmitting = ref(false);
const errorMessage = ref("");

const redirectPath = computed(() => {
  const rawRedirect = route.query.redirect;
  return typeof rawRedirect === "string" && rawRedirect.trim()
    ? rawRedirect
    : "/";
});

async function handleSubmit() {
  if (isSubmitting.value) {
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = "";

  try {
    await signInWithPassword(email.value.trim(), password.value);
    await navigateTo(redirectPath.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Connexion impossible. Vérifie tes identifiants.";
  } finally {
    isSubmitting.value = false;
  }
}

watchEffect(() => {
  if (isAuthenticated.value) {
    void navigateTo(redirectPath.value);
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-950 px-4 py-8 text-slate-900">
    <div
      class="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center"
    >
      <div
        class="grid w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] lg:grid-cols-[1.1fr_0.9fr]"
      >
        <section class="relative overflow-hidden bg-slate-950 px-8 py-10 text-white lg:px-10 lg:py-12">
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.18),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.18),transparent_28%)]" />
          <div class="relative space-y-6">
            <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
              <UIcon name="i-lucide-shield-check" class="h-4 w-4" />
              Authentification Supabase
            </div>
            <div class="space-y-3">
              <h1 class="max-w-xl text-4xl font-semibold tracking-tight">
                Connectez-vous pour accéder à l’application
              </h1>
              <p class="max-w-xl text-sm leading-7 text-slate-300">
                L’accès à Blog Magify est désormais protégé. Identifiez-vous pour
                retrouver vos projets, vos mots-clés, vos clusters et vos pages.
              </p>
            </div>

            <div class="grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p class="font-semibold text-white">Sécurité</p>
                <p class="mt-1 leading-6 text-slate-300">
                  Votre session est vérifiée côté API avec Supabase avant d’ouvrir
                  l’app.
                </p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p class="font-semibold text-white">Continuité</p>
                <p class="mt-1 leading-6 text-slate-300">
                  Si votre token expire, la session est rafraîchie automatiquement
                  quand c’est possible.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="bg-slate-50 px-8 py-10 lg:px-10 lg:py-12">
          <div class="mx-auto flex h-full max-w-md flex-col justify-center">
            <div class="mb-8 space-y-2">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                Connexion
              </p>
              <h2 class="text-3xl font-semibold text-slate-900">
                Accéder à votre espace
              </h2>
              <p class="text-sm leading-6 text-slate-500">
                Utilisez votre email Supabase pour ouvrir la session.
              </p>
            </div>

            <UCard class="border border-slate-200 bg-white shadow-sm">
              <form class="space-y-5" @submit.prevent="handleSubmit">
                <div class="space-y-2 md:flex items-center justify-between">
                  <label class="text-sm font-medium text-slate-700" for="email">
                    Email
                  </label>
                  <UInput
                    id="email"
                    v-model="email"
                    type="email"
                    placeholder="vous@exemple.com"
                    autocomplete="email"
                    size="lg"
                    icon="i-lucide-mail"
                  />
                </div>

                <div class="space-y-2 md:flex items-center justify-between">
                  <label class="text-sm font-medium text-slate-700" for="password">
                    Mot de passe
                  </label>
                  <UInput
                    id="password"
                    v-model="password"
                    type="password"
                    placeholder="••••••••"
                    autocomplete="current-password"
                    size="lg"
                    icon="i-lucide-lock"
                  />
                </div>

                <p
                  v-if="errorMessage"
                  class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                >
                  {{ errorMessage }}
                </p>

                <UButton
                  type="submit"
                  color="primary"
                  size="lg"
                  block
                  :loading="isSubmitting"
                >
                  Se connecter
                </UButton>
              </form>
            </UCard>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
