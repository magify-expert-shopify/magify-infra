import type { CreatedNote, NoteStatus } from '~/types/note'
import { noteStatusOptions } from '~/types/note'

export const useCreateNote = () => {
  const { request } = useApi()

  const title = ref('Nouvelle note')
  const status = ref<NoteStatus>('TODO')
  const pending = ref(false)
  const error = ref<string | null>(null)
  const createdNote = ref<CreatedNote | null>(null)

  const createNote = async () => {
    if (!title.value.trim()) {
      error.value = 'Le titre est obligatoire.'
      return
    }

    pending.value = true
    error.value = null

    try {
      createdNote.value = await request<CreatedNote>('/notes', {
        method: 'POST',
        body: {
          title: title.value.trim(),
          status: status.value,
        },
      })
      title.value = ''
      status.value = 'TODO'
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Erreur lors de la création de la note'
    } finally {
      pending.value = false
    }
  }

  return {
    createdNote,
    createNote,
    error,
    noteStatusOptions,
    pending,
    status,
    title,
  }
}
