<script setup lang="ts">
import type { ImportContactPreview } from '~/types/imports'

const props = defineProps<{
  total: number
  contacts: ImportContactPreview[]
  error?: string
}>()

const previewContacts = computed(() => props.contacts.slice(0, 3))
const prospectsColdTarget = computed(() => {
  if (props.total === 1 && props.contacts.length === 1 && props.contacts[0]?.id) {
    return `/prospects/${props.contacts[0].id}`
  }

  return '/prospects-status/prospect-froid'
})

function getAvatarSrc(contact: ImportContactPreview) {
  return contact.avatarUrl || contact.linkedinImageUrl || ''
}

function getContactLabel(contact: ImportContactPreview) {
  return contact.siteName || contact.name || contact.email || 'Contact'
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'C'
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-slate-50  p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="text-xs font-medium uppercase tracking-wide text-slate-700">
          Contacts importés
        </div>
        <div class="mt-2 text-3xl font-semibold text-slate-950">
          {{ props.total }}
        </div>
        <p class="mt-1 text-xs text-slate-600">
          Contact(s) trouvé(s) pendant l’analyse de cet import.
        </p>
      </div>

      <UButton
        :to="prospectsColdTarget"
        color="primary"
        variant="soft"
        size="sm"
        icon="i-lucide-arrow-up-right"
      >
        Prospects froids
      </UButton>
    </div>

    <div class="mt-4 flex items-center justify-between gap-3">
      <div class="flex -space-x-2">
        <div
          v-for="contact in previewContacts"
          :key="contact.id"
          class="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-slate-900 text-xs font-semibold text-white shadow-sm"
          :title="getContactLabel(contact)"
        >
          <img
            v-if="getAvatarSrc(contact)"
            :src="getAvatarSrc(contact)"
            :alt="getContactLabel(contact)"
            class="h-full w-full object-cover"
          >
          <span v-else>{{ getInitials(getContactLabel(contact)) }}</span>
        </div>

        <div
          v-if="props.total > previewContacts.length"
          class="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 shadow-sm"
        >
          +{{ props.total - previewContacts.length }}
        </div>

        <div
          v-if="props.total === 0"
          class="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-400 shadow-sm"
        >
          <UIcon name="i-lucide-user-round-search" class="h-5 w-5" />
        </div>
      </div>

      <p v-if="props.error" class="text-xs text-rose-600">
        {{ props.error }}
      </p>
      <p v-else class="text-xs text-slate-500">
        {{ previewContacts.length ? 'Aperçu des derniers contacts importés' : 'Aucun contact trouvé pour le moment' }}
      </p>
    </div>
  </section>
</template>
