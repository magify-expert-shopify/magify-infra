export interface AddProspectDestination {
  label: string
  href: string
}

export interface AddProspectResponse {
  site: {
    id: number
    url: string
    siteName?: string | null
  }
  scan: unknown | null
  prospect: {
    id: number
    name: string
    siteName?: string | null
  } | null
  outcome: 'existing_prospect' | 'prospect_found' | 'url_detail'
  message: string
  destination: AddProspectDestination
}

export function useAddProspect() {
  const runtimeConfig = useRuntimeConfig()

  function extractFirstUrl(text: string) {
    const match = String(text || '').match(/https?:\/\/[^\s<>"'`]+/i)
    return match ? match[0].replace(/[),.;:!?]+$/g, '') : ''
  }

  function resolveProspectUrl(text: string) {
    return extractFirstUrl(text) || ''
  }

  async function addProspect(urlValue: string) {
    const normalized = resolveProspectUrl(urlValue)
    if (!normalized) {
      throw new Error('Colle une URL valide pour ajouter un prospect.')
    }

    return $fetch<AddProspectResponse>(`${runtimeConfig.public.apiUrl}/urls`, {
      method: 'POST',
      body: {
        url: normalized,
        sourceFile: 'manual',
        scan: true,
      },
    })
  }

  return {
    extractFirstUrl,
    resolveProspectUrl,
    addProspect,
  }
}
