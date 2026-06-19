<script setup lang="ts">
const { createdNote, createNote, error: noteError, noteStatusOptions, pending: notePending, status, title } = useCreateNote()
const { error, fetchHelloWorld, message, pending } = useHelloWorld()
</script>

<template>
  <main class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 text-white">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.28),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(236,72,153,0.24),_transparent_30%),linear-gradient(135deg,_#020617_0%,_#0f172a_50%,_#111827_100%)]" />
    <div class="absolute left-8 top-8 h-32 w-32 rounded-full bg-cyan-400/20 blur-3xl" />
    <div class="absolute bottom-10 right-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />

    <section class="relative w-full max-w-xl rounded-3xl border border-white/10 bg-white/8 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <div class="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
        <span class="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.8)]" />
        TailwindCSS actif
      </div>

      <h1 class="mt-6 text-4xl font-black tracking-tight text-white sm:text-5xl">
        Hello from
        <span class="bg-gradient-to-r from-cyan-300 via-sky-300 to-fuchsia-300 bg-clip-text text-transparent">
          Magify
        </span>
      </h1>

      <p class="mt-4 max-w-lg text-sm leading-6 text-slate-300 sm:text-base">
        Cette page récupère la réponse de l’API Nest et l’affiche directement dans une interface stylée avec Tailwind.
      </p>

      <div class="mt-8">
        <UButton
          color="cyan"
          size="lg"
          icon="i-lucide-badge-info"
          :loading="pending"
          :disabled="pending"
          @click="fetchHelloWorld"
        >
          Appeler l'API
        </UButton>
      </div>

      <div class="mt-8 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <div class="flex flex-col gap-4 sm:flex-row">
          <UInput
            v-model="title"
            class="flex-1"
            placeholder="Titre de la note"
            size="lg"
          />

          <USelect
            v-model="status"
            :items="noteStatusOptions"
            class="w-full sm:w-40"
            size="lg"
          />

          <UButton
            color="emerald"
            icon="i-lucide-plus"
            :loading="notePending"
            :disabled="notePending"
            @click="createNote"
          >
            Ajouter la note
          </UButton>
        </div>

        <p v-if="noteError" class="mt-3 text-sm text-rose-300">
          {{ noteError }}
        </p>

        <div v-if="createdNote" class="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <p class="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-200">
            Note créée
          </p>
          <p class="mt-2 text-base font-semibold text-white">
            {{ createdNote.title }}
          </p>
          <p class="mt-1 text-sm text-emerald-100/80">
            Statut: {{ createdNote.status === 'TODO' ? 'À faire' : 'Faite' }}
          </p>
        </div>
      </div>

      <div class="mt-8 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
        <p class="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">API response</p>

        <div class="mt-3 text-2xl font-semibold sm:text-3xl">
          <span v-if="pending" class="text-slate-300">Loading...</span>
          <span v-else-if="error" class="text-rose-300">Erreur lors de l'appel API</span>
          <span v-else class="text-white">{{ message }}</span>
        </div>
      </div>
    </section>
  </main>
</template>
