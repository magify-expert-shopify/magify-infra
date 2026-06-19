import type { HomeProspect } from '~/types/home-prospect'
import type { ProspectListResponse } from '~/types/prospects'

type WorkflowStepKey = 'shopify' | 'contact' | 'linkedin' | 'social' | 'technical' | 'lighthouse'
type WorkflowStepStatus = 'pending' | 'running' | 'done' | 'error'
type WorkflowStepOutcome = 'none' | 'result' | 'empty'
type ImportScanScope = 'new' | 'existing' | 'all'

type WorkflowTargetKind = 'import' | 'url' | null

type WorkflowSummary = {
  id: number
  totalUrls: number
  existingUrls: number
  sourceFile: string
}

type WorkflowStep = {
  key: WorkflowStepKey
  label: string
  status: WorkflowStepStatus
  detail: string
  outcome: WorkflowStepOutcome
}

type ProspectUrlPayload = {
  url: string
  shopifyStatus: string | null
  redesignStatus: string | null
  redesignDecision: string | null
  cmsName: string | null
  shopifyThemeSchemaName: string | null
  shopifyThemeName: string | null
  scanTotalMs: number | null
  scanTtfbMs: number | null
  scanHtmlBytes: number | null
  lighthousePerformanceScore: number | null
  lighthouseAccessibilityScore: number | null
  lighthouseBestPracticesScore: number | null
  lighthouseSeoScore: number | null
}

export function useHomeWorkflow() {
  const runtimeConfig = useRuntimeConfig()
  const notifications = useNotificationsStore()
  const workflowPanelRef = ref<HTMLElement | null>(null)
  const isMobileViewport = ref(false)
  const workflowTargetKind = ref<WorkflowTargetKind>(null)
  const workflowImportId = ref<number | null>(null)
  const workflowUrlId = ref<number | null>(null)
  const workflowTargetUrlIds = ref<number[]>([])
  const workflowUrlCards = ref<HomeProspect[]>([])
  const workflowSummary = ref<WorkflowSummary | null>(null)
  const workflowExistingUrlsDismissed = ref(false)
  const workflowAllRescanDone = ref(false)
  const workflowError = ref('')
  const workflowRunning = ref(false)
  const workflowStep = ref<WorkflowStepKey | 'idle'>('idle')
  const workflowFinished = ref(false)
  const workflowSteps = ref<WorkflowStep[]>([
    { key: 'shopify', label: 'Vérification Shopify...', status: 'pending', detail: '', outcome: 'none' },
    { key: 'contact', label: 'Recherche contact...', status: 'pending', detail: '', outcome: 'none' },
    { key: 'linkedin', label: 'Recherche LinkedIn...', status: 'pending', detail: '', outcome: 'none' },
    { key: 'social', label: 'Recherche autres réseaux...', status: 'pending', detail: '', outcome: 'none' },
    { key: 'technical', label: 'Analyse technique...', status: 'pending', detail: '', outcome: 'none' },
    { key: 'lighthouse', label: 'Audit Lighthouse...', status: 'pending', detail: '', outcome: 'none' },
  ])

  const { data: homeProspects, refresh: refreshHomeProspects } = useFetch<ProspectListResponse>(
    () => `${runtimeConfig.public.apiUrl}/prospects`,
    {
      default: () => ({
        items: [],
        meta: {
          page: 1,
          limit: 1,
          total: 0,
          totalPages: 1,
        },
      }),
      query: {
        all: 'true',
      },
    },
  )

  const workflowDisplayKind = computed(() =>
    workflowTargetKind.value === 'url' || (workflowTargetKind.value === 'import' && workflowSummary.value?.totalUrls === 1)
      ? 'Site'
      : 'Import',
  )

  const workflowProgress = computed(() => {
    const total = workflowSteps.value.length
    const completed = workflowSteps.value.filter((step) => step.status === 'done').length
    const running = workflowSteps.value.filter((step) => step.status === 'running').length
    return {
      total,
      completed,
      running,
      percent: Math.round((completed / total) * 100),
    }
  })

  const workflowHasOnlyExistingUrls = computed(() => {
    if (!workflowSummary.value) {
      return false
    }

    return workflowSummary.value.totalUrls > 0 && workflowSummary.value.existingUrls === workflowSummary.value.totalUrls
  })

  const workflowProspects = computed(() => {
    if (!workflowTargetKind.value) {
      return []
    }

    const targetIds = new Set(
      workflowTargetKind.value === 'url'
        ? workflowUrlId.value ? [workflowUrlId.value] : []
        : workflowTargetUrlIds.value,
    )

    if (!targetIds.size) {
      return []
    }

    const merged = new Map<number, HomeProspect>()

    for (const prospect of (homeProspects.value?.items || [])) {
      if (prospect.urlId != null && targetIds.has(prospect.urlId)) {
        merged.set(prospect.urlId, prospect)
      }
    }

    for (const card of workflowUrlCards.value) {
      if (card.urlId != null && targetIds.has(card.urlId) && !merged.has(card.urlId)) {
        merged.set(card.urlId, card)
      }
    }

    return [...merged.values()].sort((left, right) => {
      const scoreDelta = (Number(right.leadScore || 0) - Number(left.leadScore || 0))
        || (Number(right.score || 0) - Number(left.score || 0))

      if (scoreDelta !== 0) {
        return scoreDelta
      }

      return String(left.siteName || left.name).localeCompare(String(right.siteName || right.name), 'fr')
    })
  })

  function resetWorkflow() {
    workflowTargetKind.value = null
    workflowImportId.value = null
    workflowUrlId.value = null
    workflowTargetUrlIds.value = []
    workflowUrlCards.value = []
    workflowSummary.value = null
    workflowExistingUrlsDismissed.value = false
    workflowAllRescanDone.value = false
    workflowError.value = ''
    workflowRunning.value = false
    workflowStep.value = 'idle'
    workflowFinished.value = false
    workflowSteps.value = workflowSteps.value.map((step) => ({
      ...step,
      status: 'pending',
      detail: '',
      outcome: 'none',
    }))
  }

  function setStepStatus(stepKey: WorkflowStepKey, status: WorkflowStepStatus, detail = '', outcome: WorkflowStepOutcome = 'none') {
    workflowSteps.value = workflowSteps.value.map((step) =>
      step.key === stepKey ? { ...step, status, detail, outcome } : step,
    )
  }

  function setActiveStep(stepKey: WorkflowStepKey | 'idle') {
    workflowStep.value = stepKey
  }

  function getApiErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object') {
      const typedError = error as {
        statusCode?: number
        statusMessage?: string
        message?: string
        data?: { message?: string | string[] }
      }

      const apiMessage = typedError.data?.message
      if (Array.isArray(apiMessage) && apiMessage.length > 0) {
        return apiMessage.join(' ')
      }

      if (typeof apiMessage === 'string' && apiMessage.trim()) {
        return apiMessage
      }

      if (typedError.statusCode) {
        if (typedError.statusCode === 413) {
          return 'Le fichier est trop volumineux pour être envoyé à l’API.'
        }

        return typedError.statusMessage || `Erreur API ${typedError.statusCode}.`
      }

      if (typedError.message) {
        return typedError.message
      }
    }

    return fallback
  }

  async function scrollToWorkflowPanelOnMobile() {
    if (!isMobileViewport.value) {
      return
    }

    await nextTick()

    const panel = workflowPanelRef.value
    if (!panel) {
      return
    }

    const offset = 96
    const top = window.scrollY + panel.getBoundingClientRect().top - offset

    window.scrollTo({
      top: Math.max(0, top),
      behavior: 'smooth',
    })
  }

  function getStepDetail(step: WorkflowStepKey, matched: number, total: number) {
    const safeProcessed = Math.max(0, matched)
    const safeTotal = Math.max(0, total)

    if (step === 'shopify') return `${safeProcessed}/${safeTotal} site(s) Shopify détecté(s)`
    if (step === 'contact') return `${safeProcessed}/${safeTotal} contact(s) trouvé(s)`
    if (step === 'linkedin') return `${safeProcessed}/${safeTotal} profil(s) LinkedIn trouvé(s)`
    if (step === 'social') return `${safeProcessed}/${safeTotal} autre(s) réseau(x) trouvé(s)`
    if (step === 'lighthouse') return `${safeProcessed}/${safeTotal} audit(s) Lighthouse terminé(s)`

    return `${safeProcessed}/${safeTotal} analyse(s) technique(s) terminée(s)`
  }

  function buildWorkflowCardFromUrl(site: Record<string, unknown>): HomeProspect {
    const urlId = Number(site.id || 0) || null
    const sourceUrl = String(site.url || '')
    const siteName = String(site.site_name || site.siteName || sourceUrl || 'URL')
    const firstName = String(site.contact_first_name || site.contactFirstName || '').trim() || null
    const email = String(site.contact_email || site.contactEmail || '').trim() || null
    const phone = String(site.contact_phone || site.contactPhone || '').trim() || null
    const linkedinUrl = String(site.contact_linkedin_url || site.contactLinkedinUrl || site.contact_company_linkedin_url || site.contactCompanyLinkedinUrl || '').trim() || null
    const socialLinksJson = String(site.contact_social_links_json || site.contactSocialLinksJson || '[]')
    const owner = String(site.contact_owner_name || site.contactOwnerName || '').trim() || null
    const evidence = String(site.contact_evidence || site.contactEvidence || '').trim() || null
    const shopifyThemeStoreType = String(site.shopify_theme_store_type || site.shopifyThemeStoreType || '').trim() || null
    const shopifyThemeSchemaName = String(site.shopify_theme_schema_name || site.shopifyThemeSchemaName || '').trim() || null
    const shopifyThemeName = String(site.shopify_theme_name || site.shopifyThemeName || '').trim() || null

    return {
      id: urlId || 0,
      urlId,
      name: siteName,
      siteName,
      sourceUrl,
      sourceFile: String(site.source_file || site.sourceFile || 'manual'),
      status: 'Prospect froid',
      email,
      phone,
      linkedinUrl,
      avatarUrl: String(site.avatar_url || site.avatarUrl || '').trim() || null,
      linkedinImageUrl: String(site.linkedin_image_url || site.linkedinImageUrl || '').trim() || null,
      socialLinksJson,
      owner,
      lastChecked: String(site.shopify_checked_at || site.shopifyCheckedAt || site.lighthouse_checked_at || site.lighthouseCheckedAt || '').trim() || null,
      evidence,
      score: 0,
      leadScore: Number(site.lead_score || site.leadScore || 0),
      firstName,
      url: {
        url: sourceUrl,
        shopifyStatus: String(site.shopify_status || site.shopifyStatus || 'unknown'),
        redesignStatus: String(site.redesign_status || site.redesignStatus || '').trim() || null,
        redesignDecision: String(site.redesign_decision || site.redesignDecision || '').trim() || null,
        shopifyThemeStoreType: shopifyThemeStoreType === 'free' || shopifyThemeStoreType === 'paid' || shopifyThemeStoreType === 'custom'
          ? shopifyThemeStoreType
          : null,
        shopifyThemeSchemaName,
        shopifyThemeName,
        scanTotalMs: site.scan_total_ms == null ? null : Number(site.scan_total_ms || site.scanTotalMs || 0),
        scanTtfbMs: site.scan_ttfb_ms == null ? null : Number(site.scan_ttfb_ms || site.scanTtfbMs || 0),
        scanHtmlBytes: site.scan_html_bytes == null ? null : Number(site.scan_html_bytes || site.scanHtmlBytes || 0),
        lighthousePerformanceScore: site.lighthouse_performance_score == null
          ? null
          : Number(site.lighthouse_performance_score || site.lighthousePerformanceScore || 0),
        lighthouseAccessibilityScore: site.lighthouse_accessibility_score == null
          ? null
          : Number(site.lighthouse_accessibility_score || site.lighthouseAccessibilityScore || 0),
        lighthouseBestPracticesScore: site.lighthouse_best_practices_score == null
          ? null
          : Number(site.lighthouse_best_practices_score || site.lighthouseBestPracticesScore || 0),
        lighthouseSeoScore: site.lighthouse_seo_score == null
          ? null
          : Number(site.lighthouse_seo_score || site.lighthouseSeoScore || 0),
      },
    }
  }

  async function loadWorkflowCards() {
    const targetIds = workflowTargetKind.value === 'url'
      ? (workflowUrlId.value ? [workflowUrlId.value] : [])
      : workflowTargetUrlIds.value

    if (!targetIds.length) {
      workflowUrlCards.value = []
      return
    }

    const cards = await Promise.all(
      targetIds.map(async (id) => {
        const site = await $fetch<Record<string, unknown>>(`${runtimeConfig.public.apiUrl}/urls/${id}`)
        return buildWorkflowCardFromUrl(site)
      }),
    )

    workflowUrlCards.value = cards
  }

  async function createImport(urls: string[], sourceFile: string) {
    const response = await $fetch<{
      id: number
      totalUrls: number
      existingUrls: number
      sourceFile: string
      urlIds: number[]
      existingUrlIds: number[]
      newUrlIds: number[]
      queuedUrls: number
      processedUrls: number
      failedUrls: number
      status: string
      currentStep: string
    }>(`${runtimeConfig.public.apiUrl}/imports`, {
      method: 'POST',
      body: {
        urls,
        sourceFile,
      },
    })

    workflowTargetKind.value = 'import'
    workflowImportId.value = response.id
    workflowUrlId.value = null
    workflowTargetUrlIds.value = response.urlIds || []
    workflowSummary.value = response
    workflowExistingUrlsDismissed.value = false
    workflowAllRescanDone.value = false
    void loadWorkflowCards()

    return response
  }

  async function checkExistingSite(url: string) {
    return $fetch<{
      exists: boolean
      normalizedUrl: string
      site: { id: number; url: string; siteName: string | null } | null
    }>(`${runtimeConfig.public.apiUrl}/urls/exists`, {
      query: { url },
    })
  }

  async function runWorkflowStep(step: WorkflowStepKey, force = false, scope: ImportScanScope = 'new') {
    const targetKind = workflowTargetKind.value
    const targetId = targetKind === 'url' ? workflowUrlId.value : workflowImportId.value

    if (!targetId || !targetKind) {
      throw new Error('Cible manquante.')
    }

    setActiveStep(step)
    setStepStatus(step, 'running')

    const response = await $fetch<{ processed: number; matched?: number; total: number }>(
      targetKind === 'url'
        ? `${runtimeConfig.public.apiUrl}/scanning/sites/${targetId}/steps/${step}`
        : `${runtimeConfig.public.apiUrl}/imports/${targetId}/steps/${step}`,
      {
        method: 'POST',
        query: {
          ...(force ? { force: 'true' } : {}),
          ...(targetKind === 'import' ? { scope } : {}),
        },
      },
    )

    const matched = response.matched ?? response.processed
    setStepStatus(step, 'done', getStepDetail(step, matched, response.total), matched > 0 ? 'result' : 'empty')

    return response
  }

  function prepareWorkflowRun() {
    workflowError.value = ''
    workflowRunning.value = false
    workflowStep.value = 'idle'
    workflowFinished.value = false
    workflowExistingUrlsDismissed.value = false
    workflowAllRescanDone.value = false
    workflowSteps.value = workflowSteps.value.map((step) => ({
      ...step,
      status: 'pending',
      detail: '',
    }))
  }

  async function runCurrentWorkflow(force = false, scope: ImportScanScope = 'new') {
    if ((!workflowImportId.value && !workflowUrlId.value) || !workflowSummary.value || !workflowTargetKind.value) {
      return
    }

    prepareWorkflowRun()
    workflowRunning.value = true

    try {
      await scrollToWorkflowPanelOnMobile()
      await runWorkflowStep('shopify', force, scope)
      await runWorkflowStep('contact', force, scope)
      await runWorkflowStep('linkedin', force, scope)
      await runWorkflowStep('social', force, scope)
      await runWorkflowStep('technical', force, scope)
      await runWorkflowStep('lighthouse', force, scope)

      workflowFinished.value = true
      if (force && (scope === 'all' || workflowTargetKind.value === 'url')) {
        workflowAllRescanDone.value = true
        workflowExistingUrlsDismissed.value = true
      }
      await loadWorkflowCards().catch(() => {})
      void refreshHomeProspects()
      notifications.add({
        kind: 'success',
        title: force ? 'Rescan forcé terminé' : 'Enrichissement terminé',
        message:
          workflowTargetKind.value === 'url'
            ? `URL #${workflowSummary.value.id} traitée via le CRM.`
            : `${workflowSummary.value.totalUrls} URL(s) traitée(s) via ${workflowDisplayKind.value.toLowerCase()} #${workflowSummary.value.id}.`,
      })
    } catch (error) {
      const message = getApiErrorMessage(error, 'Impossible de lancer l’enrichissement automatique.')
      workflowError.value = message
      setActiveStep('idle')
      workflowSteps.value = workflowSteps.value.map((step) =>
        step.status === 'done' ? step : { ...step, status: step.status === 'running' ? 'error' : step.status },
      )
      notifications.add({
        kind: 'error',
        title: force ? 'Rescan forcé échoué' : 'Enrichissement échoué',
        message,
      })
    } finally {
      workflowRunning.value = false
    }
  }

  async function startWorkflow(urls: string[], sourceFile: string) {
    if (urls.length === 0) {
      workflowError.value = 'Aucune URL exploitable n’a été trouvée.'
      notifications.add({
        kind: 'warning',
        title: 'Aucune URL trouvée',
        message: workflowError.value,
      })
      return
    }

    if (urls.length === 1) {
      try {
        const existingSite = await checkExistingSite(urls[0])
        if (existingSite.exists) {
          resetWorkflow()
          workflowTargetKind.value = 'url'
          workflowUrlId.value = existingSite.site?.id || null
          workflowTargetUrlIds.value = existingSite.site?.id ? [existingSite.site.id] : []
          workflowSummary.value = existingSite.site
            ? {
                id: existingSite.site.id,
                totalUrls: 1,
                existingUrls: 1,
                sourceFile: 'manual',
              }
            : null
          void loadWorkflowCards()
          workflowError.value = `Ce site est déjà en base${existingSite.site?.siteName ? `: ${existingSite.site.siteName}` : ''}.`
          notifications.add({
            kind: 'warning',
            title: 'Site déjà présent',
            message: workflowError.value,
          })
          await scrollToWorkflowPanelOnMobile()
          return
        }
      } catch {
        // On continue le flux normal si la vérification d'existence échoue.
      }
    }

    resetWorkflow()

    try {
      const createdImport = await createImport(urls, sourceFile)
      notifications.add({
        kind: 'info',
        title: 'Import mis en file',
        message: `${createdImport.totalUrls} URL(s) envoyée(s) en arrière-plan. Suivi de l’import #${createdImport.id}.`,
      })

      if (createdImport.totalUrls > 0 && createdImport.existingUrls === createdImport.totalUrls) {
        notifications.add({
          kind: 'warning',
          title: 'Import déjà connu',
          message: 'Tout l’import existe déjà en base. Il n’y avait rien à envoyer dans la file.',
        })
      }

      await scrollToWorkflowPanelOnMobile()
    } catch (error) {
      const message = getApiErrorMessage(error, 'Impossible de lancer l’enrichissement automatique.')
      workflowError.value = message
      notifications.add({
        kind: 'error',
        title: 'Enrichissement échoué',
        message,
      })
    }
  }

  function stepIcon(status: WorkflowStepStatus, outcome: WorkflowStepOutcome = 'none') {
    if (status === 'done' && outcome === 'empty') return 'i-lucide-circle-minus'
    if (status === 'done') return 'i-lucide-circle-check-big'
    if (status === 'running') return 'i-lucide-loader-2'
    if (status === 'error') return 'i-lucide-circle-x'
    return 'i-lucide-circle'
  }

  function getApiErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object') {
      const typedError = error as {
        statusCode?: number
        statusMessage?: string
        message?: string
        data?: { message?: string | string[] }
      }

      const apiMessage = typedError.data?.message
      if (Array.isArray(apiMessage) && apiMessage.length > 0) {
        return apiMessage.join(' ')
      }

      if (typeof apiMessage === 'string' && apiMessage.trim()) {
        return apiMessage
      }

      if (typedError.statusCode) {
        if (typedError.statusCode === 413) {
          return 'Le fichier est trop volumineux pour être envoyé à l’API.'
        }

        return typedError.statusMessage || `Erreur API ${typedError.statusCode}.`
      }

      if (typedError.message) {
        return typedError.message
      }
    }

    return fallback
  }

  onMounted(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)')

    const syncViewport = () => {
      isMobileViewport.value = mediaQuery.matches
    }

    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)

    onBeforeUnmount(() => {
      mediaQuery.removeEventListener('change', syncViewport)
    })
  })

  return {
    workflowPanelRef,
    isMobileViewport,
    workflowTargetKind,
    workflowImportId,
    workflowUrlId,
    workflowTargetUrlIds,
    workflowUrlCards,
    workflowSummary,
    workflowExistingUrlsDismissed,
    workflowAllRescanDone,
    workflowError,
    workflowRunning,
    workflowStep,
    workflowFinished,
    workflowSteps,
    workflowDisplayKind,
    workflowProgress,
    workflowHasOnlyExistingUrls,
    workflowProspects,
    resetWorkflow,
    setStepStatus,
    setActiveStep,
    stepIcon,
    startWorkflow,
    runCurrentWorkflow,
    runWorkflowStep,
    scrollToWorkflowPanelOnMobile,
    getStepDetail,
    getApiErrorMessage,
  }
}
