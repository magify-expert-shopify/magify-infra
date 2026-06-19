export const useHelloWorld = () => {
  const { request } = useApi()

  const message = ref('Clique sur le bouton pour appeler l\'API.')
  const pending = ref(false)
  const error = ref<string | null>(null)

  const fetchHelloWorld = async () => {
    pending.value = true
    error.value = null

    try {
      message.value = await request<string>('/')
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Erreur lors de l'appel API"
    } finally {
      pending.value = false
    }
  }

  return {
    error,
    fetchHelloWorld,
    message,
    pending,
  }
}
