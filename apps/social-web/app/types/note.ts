export const noteStatusOptions = [
  { label: 'À faire', value: 'TODO' },
  { label: 'Faite', value: 'DONE' },
] as const

export type NoteStatus = (typeof noteStatusOptions)[number]['value']

export type CreatedNote = {
  id: string
  title: string
  status: NoteStatus
  createdAt: string
  updatedAt: string
}
