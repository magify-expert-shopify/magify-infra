export const useApi = () => {
  const { public: runtime } = useRuntimeConfig()

  const client = $fetch.create({
    baseURL: runtime.apiUrl,
  })

  const request = <T>(path: string, options: any = {}) => {
    return client<T>(path, options)
  }

  return {
    request,
  }
}
