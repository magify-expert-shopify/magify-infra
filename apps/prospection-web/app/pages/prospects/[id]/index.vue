<script setup lang="ts">
import ProspectEmailComposer from "~/components/prospects/ProspectEmailComposer.vue";
import ObservationTitleSuggestions from "~/components/prospects/ObservationTitleSuggestions.vue";
import {
  DEFAULT_MAGIFY_OS_OFFER_ID,
  DEFAULT_MAGIFY_OS_RESPONSIBLE_USER_ID,
  magifyTicketOfferOptions,
  magifyTicketResponsibleOptions,
} from "~/constants/magify-os";
import type { EmailTemplateKey, ProspectDetail, ProspectListResponse } from "~/types/prospects";
import type { LeadScoreSettingsResponse } from "~/types/site-settings";
import { PROSPECT_STATUS_CONFIG } from "~/utils/prospect-statuses";
import type {
  SiteObservation,
  SiteObservationSeverity,
  SiteQualificationChecklist,
  SiteQualificationPositioning,
} from "~/types/urls";

const DEFAULT_MAGIFY_OS_PRIORITY = "normale";
const FREE_SHOPIFY_THEME_NAMES = new Set([
  "dawn",
  "horizon",
  "refresh",
  "sense",
  "craft",
  "ride",
  "studio",
  "taste",
  "origin",
  "crave",
  "colorblock",
  "publisher",
  "savor",
  "combine",
  "whisk",
  "pipeline",
  "expanse",
  "sleek",
  "local",
  "spark",
  "spotlight",
  "split",
  "broadcast",
  "motion",
  "mood",
  "fabric",
  "vessel",
  "atelier",
  "vision",
  "symmetry",
  "shape",
  "retina",
  "blockshop",
]);

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const notifications = useNotificationsStore();
const id = computed(() => Number(route.params.id));

const { data, pending, error, refresh } = await useFetch<ProspectDetail>(
  () => `${runtimeConfig.public.apiUrl}/prospects/${id.value}`,
  {
    watch: [id],
  },
);

const { data: prospectNavigationList } = await useFetch<ProspectListResponse>(
  () => `${runtimeConfig.public.apiUrl}/prospects`,
  {
    default: () => ({
      items: [],
      meta: { page: 1, limit: 0, total: 0, totalPages: 1 },
    }),
    query: {
      status: "Prospect froid",
      all: true,
      fields: "id",
    },
  },
);

const { data: leadScoreSettings } = await useFetch<LeadScoreSettingsResponse>(
  () => `${runtimeConfig.public.apiUrl}/site-settings/lead-score`,
  {
    key: "prospect-detail-lead-score-settings",
  },
);

const editForm = reactive({
  lastName: "",
  firstName: "",
  email: "",
  phone: "",
  companyName: "",
  siteName: "",
  siren: "",
  ownerName: "",
  companyAddress: "",
  companyAddressExtra: "",
  companyPostalCode: "",
  companyCity: "",
  companyLegalForm: "",
  companyCountry: "",
  shopifyLegalNoticeUrl: "",
  siteLanguageCode: "",
  quoteFileName: "",
  quoteSent: false,
  contractFileName: "",
  contractSent: false,
});
const lastNameTouched = ref(false);
const lastEditFormProspectId = ref<number | null>(null);
const syncingEditForm = ref(false);
let lastEditFormSnapshot = "";

const saveState = ref<"idle" | "saving" | "saved" | "error">("idle");
const saveError = ref("");
const editSaveFeedbackState = ref<"idle" | "visible" | "fading">("idle");
const trashing = ref(false);
const markingContacted = ref(false);
const reanalyzingSite = ref(false);
const autoUpdatingContact = ref(false);
const magifyTicketCreating = ref(false);
const magifyTicketPanelOpen = ref(true);
const magifyTicketTitleTouched = ref(false);
const magifyTicketState = ref<"idle" | "success" | "error">("idle");
const magifyTicketMessage = ref("");
const magifyTicketResult = ref<{
  ticketId: string | null;
  ticketUrl: string | null;
} | null>(null);
const magifyTicketSourceProspectId = ref<number | null>(null);
const magifyTicketForm = reactive({
  companyName: "",
  companySiren: "",
  companyWebsite: "",
  companyLegalForm: "",
  companyAddress: "",
  companyAddressExtra: "",
  companyPostalCode: "",
  companyCity: "",
  companyCountry: "France",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  contactPhone: "",
  contactJobTitle: "",
  title: "",
  offerId: DEFAULT_MAGIFY_OS_OFFER_ID,
  responsibleUserId: DEFAULT_MAGIFY_OS_RESPONSIBLE_USER_ID,
  priority: DEFAULT_MAGIFY_OS_PRIORITY,
  notes: "",
  shopUrl: "",
});
const statusSaving = ref(false);
const positioningSaving = ref(false);
const lighthouseAuditing = ref(false);
const positioningChoice = ref<SiteQualificationPositioning>(
  "support-without-observation",
);
const abandonReason = ref("");
const siteObservations = ref<SiteObservation[]>([]);
const deletedManualObservationKeys = ref<Set<string>>(new Set());
const mainObservationKey = ref<string | null>(null);
const expandedObservationKeys = ref<string[]>([]);
const focusedObservationTitleKey = ref<string | null>(null);
const verificationChecklist = reactive<SiteQualificationChecklist>({
  legalNotice: false,
  legalNoticeStatus: null,
  dawnTheme: false,
  dawnThemeStatus: null,
  visualAnomaly: false,
  visualAnomalyStatus: null,
  collectionVisualAnomaly: false,
  collectionVisualAnomalyStatus: null,
  productVisualAnomaly: false,
  productVisualAnomalyStatus: null,
  aboutVisualAnomaly: false,
  aboutVisualAnomalyStatus: null,
  translated: false,
  translatedStatus: null,
});
const LEGAL_NOTICE_OBSERVATION_KEY = "shopify-legal-notice";
const AUTOMATIC_OBSERVATION_KEYS = new Set([
  "shopify-legal-notice",
  "shopify-legal-notice-missing",
  "legal-notice-checklist",
  "seo-meta-tags",
  "contact-placeholder-email",
  "dawn-theme-checklist",
  "translated-checklist",
  "visual-anomaly-home-checklist",
  "visual-anomaly-collection-checklist",
  "visual-anomaly-product-checklist",
  "visual-anomaly-about-checklist",
  "catalog-gift-card",
]);
let sitePreviewMonitor: ReturnType<typeof setInterval> | null = null;
let observationSaveTimer: ReturnType<typeof setTimeout> | null = null;
let editSaveFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
let editSaveFeedbackFadeTimer: ReturnType<typeof setTimeout> | null = null;
let lastQualificationSnapshot = "";

function inferObservationSource(observation: Partial<SiteObservation> & { key: string }) {
  return observation.source || (AUTOMATIC_OBSERVATION_KEYS.has(observation.key) ? "automatic" : "manual");
}

const positioningOptions = [
  { label: "Support avec erreur", value: "support-with-error" },
  { label: "Support sans observation", value: "support-without-observation" },
  { label: "Refonte", value: "refonte" },
  { label: "Migration", value: "migration" },
  { label: "Optimisation", value: "optimisation" },
  { label: "Abandonner", value: "abandon" },
];

const prospectTabs = [
  { key: "edit", label: "Edition", icon: "i-lucide-pen" },
  { key: "checklist", label: "Checklist", icon: "i-lucide-list-checks" },
  { key: "observations", label: "Observations", icon: "i-lucide-eye" },
  { key: "positioning", label: "Positionnement", icon: "i-lucide-target" },
  { key: "email", label: "Email", icon: "i-lucide-mail" },
  { key: "ticket", label: "Ticket MagifyOS", icon: "i-lucide-ticket" },
  { key: "lighthouse", label: "Lighthouse", icon: "i-lucide-gauge" },
  { key: "tables", label: "Détails", icon: "i-lucide-table-2" },
] as const;

type ProspectTabKey = (typeof prospectTabs)[number]["key"];

const activeProspectTab = ref<ProspectTabKey>("edit");
const activeProspectTabStorageKey = computed(
  () => `prospect:${id.value}:active-tab`,
);
const activeProspectTabKeys = prospectTabs.map((tab) => tab.key);
const activeProspectTabHydrated = ref(false);
const emailPreferredTemplateKey = ref<EmailTemplateKey | null>(null);

const prospectStatusOptions = computed(() =>
  PROSPECT_STATUS_CONFIG.map((config) => ({
    label: config.status,
    value: config.status,
  })),
);

const prospectStatusChoice = ref("");

const prospectNavigationIds = computed(
  () => prospectNavigationList.value?.items.map((item) => item.id) || [],
);
const currentProspectIndex = computed(() =>
  prospectNavigationIds.value.findIndex((prospectId) => prospectId === id.value),
);
const previousProspectId = computed(() => {
  const index = currentProspectIndex.value;
  return index > 0 ? prospectNavigationIds.value[index - 1] : null;
});
const nextProspectId = computed(() => {
  const index = currentProspectIndex.value;
  return index >= 0 && index < prospectNavigationIds.value.length - 1
    ? prospectNavigationIds.value[index + 1]
    : null;
});

function buildEditFormSnapshot() {
  return JSON.stringify({
    lastName: editForm.lastName.trim(),
    companyName: editForm.companyName.trim(),
    siteName: editForm.siteName.trim(),
    firstName: editForm.firstName.trim(),
    email: editForm.email.trim(),
    phone: editForm.phone.trim(),
    siren: editForm.siren.trim(),
    ownerName: editForm.ownerName.trim(),
    companyAddress: editForm.companyAddress.trim(),
    companyAddressExtra: editForm.companyAddressExtra.trim(),
    companyPostalCode: editForm.companyPostalCode.trim(),
    companyCity: editForm.companyCity.trim(),
    companyLegalForm: editForm.companyLegalForm.trim(),
    companyCountry: editForm.companyCountry.trim(),
    shopifyLegalNoticeUrl: editForm.shopifyLegalNoticeUrl.trim(),
    siteLanguageCode: editForm.siteLanguageCode,
    quoteFileName: editForm.quoteFileName.trim(),
    quoteSent: editForm.quoteSent,
    contractFileName: editForm.contractFileName.trim(),
    contractSent: editForm.contractSent,
  });
}

const hasEditFormChanges = computed(
  () => buildEditFormSnapshot() !== lastEditFormSnapshot,
);

watch(hasEditFormChanges, (hasChanges) => {
  if (hasChanges && saveState.value === "saved") {
    hideEditSaveFeedback();
  }
});

function clearEditSaveFeedbackTimers() {
  if (editSaveFeedbackTimer) {
    clearTimeout(editSaveFeedbackTimer);
    editSaveFeedbackTimer = null;
  }

  if (editSaveFeedbackFadeTimer) {
    clearTimeout(editSaveFeedbackFadeTimer);
    editSaveFeedbackFadeTimer = null;
  }
}

function showEditSaveFeedback() {
  clearEditSaveFeedbackTimers();
  editSaveFeedbackState.value = "visible";

  editSaveFeedbackTimer = setTimeout(() => {
    editSaveFeedbackState.value = "fading";

    editSaveFeedbackFadeTimer = setTimeout(() => {
      editSaveFeedbackState.value = "idle";
      saveState.value = "idle";
    }, 250);
  }, 3000);
}

function hideEditSaveFeedback() {
  if (editSaveFeedbackState.value === "idle") {
    saveState.value = "idle";
    clearEditSaveFeedbackTimers();
    return;
  }

  clearEditSaveFeedbackTimers();
  editSaveFeedbackState.value = "fading";
  editSaveFeedbackFadeTimer = setTimeout(() => {
    editSaveFeedbackState.value = "idle";
    saveState.value = "idle";
  }, 250);
}

const positioningLabel = computed(() => {
  if (positioningChoice.value === "support-with-error")
    return "Support avec erreur";
  if (positioningChoice.value === "support-without-observation")
    return "Support sans observation";
  if (positioningChoice.value === "refonte") return "Refonte";
  if (positioningChoice.value === "migration") return "Migration";
  if (positioningChoice.value === "optimisation") return "Optimisation";
  if (positioningChoice.value === "abandon") return "Abandonner";

  return "Support";
});

function formatQualificationPositioning(value: string | null) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "support-with-error") return "Support avec erreur";
  if (normalized === "support-without-observation")
    return "Support sans observation";
  if (normalized === "refonte") return "Refonte";
  if (normalized === "migration") return "Migration";
  if (normalized === "optimisation") return "Optimisation";
  if (normalized === "abandon") return "Abandonner";

  return "—";
}

function getMagifyTicketDefaultTitle(
  prospect: ProspectDetail | null | undefined,
) {
  return (
    prospect?.firstContactEmailSubject?.trim() ||
    `Ticket prospect — ${prospect?.siteName || prospect?.name || "Prospect"}`
  );
}

function syncMagifyTicketForm(prospect: ProspectDetail | null | undefined) {
  if (
    prospect?.id != null &&
    magifyTicketSourceProspectId.value !== prospect.id
  ) {
    magifyTicketSourceProspectId.value = prospect.id;
    magifyTicketTitleTouched.value = false;
    magifyTicketResult.value = null;
    magifyTicketState.value = "idle";
    magifyTicketMessage.value = "";
  }

  if (!magifyTicketTitleTouched.value) {
    magifyTicketForm.title = getMagifyTicketDefaultTitle(prospect);
  }
  magifyTicketForm.companyName =
    prospect?.contactCompanyName ||
    prospect?.siteName ||
    prospect?.name ||
    "Prospect Magify";
  magifyTicketForm.companySiren = prospect?.siren || prospect?.contactSiren || "";
  magifyTicketForm.companyWebsite =
    prospect?.url?.url || prospect?.sourceUrl || "";
  magifyTicketForm.companyLegalForm = prospect?.contactCompanyLegalForm || "";
  magifyTicketForm.companyAddress = prospect?.contactCompanyAddress || "";
  magifyTicketForm.companyAddressExtra =
    prospect?.contactCompanyAddressExtra || "";
  magifyTicketForm.companyPostalCode =
    prospect?.contactCompanyPostalCode || "";
  magifyTicketForm.companyCity = prospect?.contactCompanyCity || "";
  magifyTicketForm.companyCountry =
    prospect?.contactCompanyCountry ||
    prospect?.url?.siteCountryName ||
    "France";
  magifyTicketForm.contactFirstName =
    prospect?.contactFirstName ||
    prospect?.firstName ||
    prospect?.name?.split(" ")[0] ||
    prospect?.siteName?.split(" ")[0] ||
    "Prénom";
  magifyTicketForm.contactLastName =
    prospect?.contactLastName ||
    prospect?.contactOwnerName ||
    prospect?.owner ||
    prospect?.name ||
    prospect?.siteName ||
    "Contact";
  magifyTicketForm.contactEmail =
    prospect?.email || prospect?.contactEmail || "";
  magifyTicketForm.contactPhone =
    prospect?.phone || prospect?.contactPhone || "";
  magifyTicketForm.contactJobTitle =
    prospect?.contactOwnerName || prospect?.owner || "";
  magifyTicketForm.offerId =
    magifyTicketForm.offerId || DEFAULT_MAGIFY_OS_OFFER_ID;
  magifyTicketForm.responsibleUserId =
    magifyTicketForm.responsibleUserId ||
    DEFAULT_MAGIFY_OS_RESPONSIBLE_USER_ID;
  magifyTicketForm.priority = DEFAULT_MAGIFY_OS_PRIORITY;
  magifyTicketForm.notes = buildMagifyTicketNotes(prospect);
  magifyTicketForm.shopUrl = prospect?.url?.url || prospect?.sourceUrl || "";
}

function buildMagifyTicketNotes(prospect: ProspectDetail | null | undefined) {
  const lines: string[] = [];
  const observations =
    prospect?.url?.qualification?.observations || siteObservations.value || [];

  for (const observation of observations) {
    const title = String(observation?.title || "").trim();
    const detail = String(observation?.detail || "").trim();
    const line = [title, detail && detail !== title ? detail : ""]
      .filter(Boolean)
      .join(" — ");
    if (line) {
      lines.push(`- ${line}`);
    }
  }

  return lines.join("\n") || "- Aucune observation détectée";
}

const mainObservationOptions = computed(() =>
  siteObservations.value.map((observation) => ({
    label: observation.title || observation.detail || "Observation sans titre",
    value: observation.key,
    description: observation.detail,
  })),
);

const selectedMainObservationKey = computed({
  get: () => mainObservationKey.value,
  set: (
    value: string | number | { value?: string | number } | null | undefined,
  ) => {
    if (value && typeof value === "object") {
      mainObservationKey.value =
        value.value == null ? null : String(value.value);
      return;
    }

    mainObservationKey.value =
      value == null || value === "" ? null : String(value);
  },
});

function setMagifyTicketTitle(value: string | null | undefined) {
  magifyTicketTitleTouched.value = true;
  magifyTicketForm.title = String(value || "");
}

function handleEmailDraftChanged(payload: {
  subject: string;
  body: string;
  templateKey: string;
}) {
  if (magifyTicketTitleTouched.value) {
    return;
  }

  magifyTicketForm.title =
    String(payload.subject || "").trim() ||
    getMagifyTicketDefaultTitle(data.value);
}

const severityOptions = [
  { label: "Info", value: "info" },
  { label: "Avertissement", value: "warning" },
  { label: "Critique", value: "critical" },
];

const siteLanguageOptions = [
  { label: "Français", value: "fr" },
  { label: "Anglais", value: "en" },
  { label: "Autre langue", value: "other" },
];

type ChecklistBinaryStatus = "valid" | "invalid" | null;

type BinaryChecklistItem = {
  key:
    | "dawnTheme"
    | "visualAnomaly"
    | "collectionVisualAnomaly"
    | "productVisualAnomaly"
    | "aboutVisualAnomaly"
    | "translated";
  label: string;
  description: string;
  statusKey:
    | "dawnThemeStatus"
    | "visualAnomalyStatus"
    | "collectionVisualAnomalyStatus"
    | "productVisualAnomalyStatus"
    | "aboutVisualAnomalyStatus"
    | "translatedStatus";
  question: string;
  observationKey: string;
  validObservation?: {
    title: string;
    detail: string;
    severity: SiteObservationSeverity;
  };
  invalidObservation?: {
    title: string;
    detail: string;
    severity: SiteObservationSeverity;
  };
};

const binaryChecklistItems = [
  {
    key: "dawnTheme",
    label: "Thème gratuit Shopify",
    description:
      "Vérifie si le thème Shopify utilisé sur le site est un thème gratuit du store Shopify.",
    statusKey: "dawnThemeStatus",
    question: "Le site utilise-t-il un thème gratuit Shopify ?",
    observationKey: "dawn-theme-checklist",
    validObservation: {
      title: "Thème gratuit Shopify détecté",
      detail: "Le site utilise bien un thème gratuit du store Shopify.",
      severity: "info",
    },
  },
  {
    key: "translated",
    label: "Site bien traduit",
    description:
      "Vérifie que le contenu est correctement traduit dans la langue attendue.",
    statusKey: "translatedStatus",
    question: "La traduction du site est-elle correcte ?",
    observationKey: "translated-checklist",
    invalidObservation: {
      title: "Site mal traduit",
      detail: "Le contenu du site semble mal traduit ou incohérent.",
      severity: "warning",
    },
  },
  {
    key: "visualAnomaly",
    label: "Page d'accueil",
    description: "Vérifie qu’aucun problème d’affichage important n’est visible sur la page d’accueil.",
    statusKey: "visualAnomalyStatus",
    question: "La page d’accueil est-elle visuellement propre ?",
    observationKey: "visual-anomaly-home-checklist",
    invalidObservation: {
      title: "Anomalie visuelle sur la page d'accueil",
      detail: "La page d’accueil présente un problème d’affichage notable.",
      severity: "warning",
    },
  },
  {
    key: "collectionVisualAnomaly",
    label: "Page collection",
    description: "Vérifie qu’aucun problème d’affichage important n’est visible sur une page collection.",
    statusKey: "collectionVisualAnomalyStatus",
    question: "La page collection est-elle visuellement propre ?",
    observationKey: "visual-anomaly-collection-checklist",
    invalidObservation: {
      title: "Anomalie visuelle sur la page collection",
      detail: "La page collection présente un problème d’affichage notable.",
      severity: "warning",
    },
  },
  {
    key: "productVisualAnomaly",
    label: "Page produit",
    description: "Vérifie qu’aucun problème d’affichage important n’est visible sur une page produit.",
    statusKey: "productVisualAnomalyStatus",
    question: "La page produit est-elle visuellement propre ?",
    observationKey: "visual-anomaly-product-checklist",
    invalidObservation: {
      title: "Anomalie visuelle sur la page produit",
      detail: "La page produit présente un problème d’affichage notable.",
      severity: "warning",
    },
  },
  {
    key: "aboutVisualAnomaly",
    label: "Page à propos",
    description: "Vérifie qu’aucun problème d’affichage important n’est visible sur une page à propos.",
    statusKey: "aboutVisualAnomalyStatus",
    question: "La page à propos est-elle visuellement propre ?",
    observationKey: "visual-anomaly-about-checklist",
    invalidObservation: {
      title: "Anomalie visuelle sur la page à propos",
      detail: "La page à propos présente un problème d’affichage notable.",
      severity: "warning",
    },
  },
] as const satisfies readonly BinaryChecklistItem[];

const yesNoChecklistItemKeys = new Set<BinaryChecklistItem["key"]>([
  "dawnTheme",
  "visualAnomaly",
  "collectionVisualAnomaly",
  "productVisualAnomaly",
  "aboutVisualAnomaly",
  "translated",
]);

function isYesNoChecklistItem(item: BinaryChecklistItem) {
  return yesNoChecklistItemKeys.has(item.key);
}

function getBinaryChecklistButtonLabel(
  item: BinaryChecklistItem,
  status: ChecklistBinaryStatus,
) {
  const isYesNo = isYesNoChecklistItem(item);

  if (status === "valid") {
    return isYesNo ? "Oui" : "Valide";
  }

  return isYesNo ? "Non" : "Pas valide";
}

function getBinaryChecklistBadgeChoice(
  item: BinaryChecklistItem,
  status: ChecklistBinaryStatus,
) {
  const isYesNo = isYesNoChecklistItem(item);

  if (status === "valid") {
    return isYesNo ? "oui" : "valide";
  }

  return isYesNo ? "non" : "pas valide";
}

const verificationChecklistSections = [
  {
    key: "general",
    title: "Générale",
    items: binaryChecklistItems.filter((item) =>
      item.key === "dawnTheme" || item.key === "translated",
    ),
  },
  {
    key: "home",
    title: "Page d'accueil",
    items: binaryChecklistItems.filter((item) => item.key === "visualAnomaly"),
  },
  {
    key: "legal",
    title: "Page légale",
    items: [
      {
        key: "legalNotice",
        label: "Page de mentions légales",
        description: "Vérifie qu’une page de mentions légales existe sur le site.",
        href: "/policies/legal-notice",
      },
    ],
  },
  {
    key: "product",
    title: "Page produit",
    items: binaryChecklistItems.filter((item) => item.key === "productVisualAnomaly"),
  },
  {
    key: "about",
    title: "Page à propos",
    items: binaryChecklistItems.filter((item) => item.key === "aboutVisualAnomaly"),
  },
  {
    key: "collection",
    title: "Page collection",
    items: binaryChecklistItems.filter((item) => item.key === "collectionVisualAnomaly"),
  },
] as const;

function normalizeSiteLanguageChoice(
  code: string | null | undefined,
  name: string | null | undefined,
) {
  const normalized = String(code || name || "")
    .trim()
    .toLowerCase();

  if (normalized.startsWith("fr") || normalized.includes("fran")) return "fr";
  if (
    normalized.startsWith("en") ||
    normalized.includes("anglai") ||
    normalized.includes("english")
  )
    return "en";

  return "other";
}

function normalizeVerificationChecklist(
  value: unknown,
): SiteQualificationChecklist {
  const raw =
      value && typeof value === "object"
      ? (value as Partial<SiteQualificationChecklist>)
      : {};
  const legalNoticeStatus = String(raw.legalNoticeStatus || "").toLowerCase();
  const dawnThemeStatus = String(raw.dawnThemeStatus || "").toLowerCase();
  const visualAnomalyStatus = String(raw.visualAnomalyStatus || "").toLowerCase();
  const collectionVisualAnomalyStatus = String(raw.collectionVisualAnomalyStatus || "").toLowerCase();
  const productVisualAnomalyStatus = String(raw.productVisualAnomalyStatus || "").toLowerCase();
  const aboutVisualAnomalyStatus = String(raw.aboutVisualAnomalyStatus || "").toLowerCase();
  const translatedStatus = String(raw.translatedStatus || "").toLowerCase();

  return {
    legalNotice: Boolean(raw.legalNotice || legalNoticeStatus),
    legalNoticeStatus:
      legalNoticeStatus === "missing" ||
      legalNoticeStatus === "invalid" ||
      legalNoticeStatus === "valid"
        ? (legalNoticeStatus as "missing" | "invalid" | "valid")
        : null,
    dawnTheme: Boolean(raw.dawnTheme || dawnThemeStatus),
    dawnThemeStatus:
      dawnThemeStatus === "valid" || dawnThemeStatus === "invalid"
        ? (dawnThemeStatus as ChecklistBinaryStatus)
        : null,
    visualAnomaly: Boolean(raw.visualAnomaly || visualAnomalyStatus),
    visualAnomalyStatus:
      visualAnomalyStatus === "valid" || visualAnomalyStatus === "invalid"
        ? (visualAnomalyStatus as ChecklistBinaryStatus)
        : null,
    collectionVisualAnomaly: Boolean(raw.collectionVisualAnomaly || collectionVisualAnomalyStatus),
    collectionVisualAnomalyStatus:
      collectionVisualAnomalyStatus === "valid" || collectionVisualAnomalyStatus === "invalid"
        ? (collectionVisualAnomalyStatus as ChecklistBinaryStatus)
        : null,
    productVisualAnomaly: Boolean(raw.productVisualAnomaly || productVisualAnomalyStatus),
    productVisualAnomalyStatus:
      productVisualAnomalyStatus === "valid" || productVisualAnomalyStatus === "invalid"
        ? (productVisualAnomalyStatus as ChecklistBinaryStatus)
        : null,
    aboutVisualAnomaly: Boolean(raw.aboutVisualAnomaly || aboutVisualAnomalyStatus),
    aboutVisualAnomalyStatus:
      aboutVisualAnomalyStatus === "valid" || aboutVisualAnomalyStatus === "invalid"
        ? (aboutVisualAnomalyStatus as ChecklistBinaryStatus)
        : null,
    translated: Boolean(raw.translated || translatedStatus),
    translatedStatus:
      translatedStatus === "valid" || translatedStatus === "invalid"
        ? (translatedStatus as ChecklistBinaryStatus)
        : null,
  };
}

function isFreeShopifyThemeDetectedFromScan(
  shopifyThemeStoreType: string | null | undefined,
  themeSchemaName: string | null | undefined,
  themeName: string | null | undefined,
) {
  const normalizedStoreType = String(shopifyThemeStoreType || "")
    .trim()
    .toLowerCase();
  const normalizedSchemaName = String(themeSchemaName || "")
    .trim()
    .toLowerCase();
  const normalizedThemeName = String(themeName || "").trim().toLowerCase();

  if (normalizedStoreType === "free") {
    return true;
  }

  return (
    normalizedSchemaName === "dawn" ||
    normalizedSchemaName === "refresh" ||
    normalizedThemeName === "dawn" ||
    normalizedThemeName === "refresh"
  );
}

function getScanChecklistPrefill(
  prospect: ProspectDetail | null | undefined,
) {
  const url = prospect?.url;
  const shopifyStatus = String(url?.shopifyStatus || "").trim().toLowerCase();
  const shopifyThemeStoreType = String(url?.shopifyThemeStoreType || "").trim().toLowerCase();

  const legalNoticeStatus =
    shopifyStatus === "shopify"
      ? String(url?.shopifyLegalNoticeStatus || "").trim().toLowerCase()
      : "";

  const freeShopifyThemeDetected =
    shopifyStatus === "shopify" &&
    isFreeShopifyThemeDetectedFromScan(
      url?.shopifyThemeStoreType,
      url?.shopifyThemeSchemaName,
      url?.shopifyThemeName,
    );

  return {
    legalNoticeStatus:
      legalNoticeStatus === "found"
        ? ("valid" as const)
        : legalNoticeStatus === "not_found"
          ? ("missing" as const)
          : null,
    dawnThemeStatus: freeShopifyThemeDetected
      ? ("valid" as const)
      : shopifyStatus === "shopify" || shopifyThemeStoreType.length > 0
        ? ("invalid" as const)
        : null,
  };
}

function applyScanChecklistPrefill(
  prospect: ProspectDetail | null | undefined,
) {
  const prefill = getScanChecklistPrefill(prospect);

  if (
    !verificationChecklist.legalNoticeStatus &&
    prefill.legalNoticeStatus
  ) {
    verificationChecklist.legalNotice = true;
    verificationChecklist.legalNoticeStatus = prefill.legalNoticeStatus;
  }

  if (verificationChecklist.legalNoticeStatus || prefill.legalNoticeStatus) {
    syncLegalNoticeObservation(verificationChecklist.legalNoticeStatus);
  }

  const dawnItem = binaryChecklistItems.find(
    (item) => item.key === "dawnTheme",
  );

  if (!dawnItem) {
    return;
  }

  if (!verificationChecklist.dawnThemeStatus && prefill.dawnThemeStatus) {
    verificationChecklist.dawnTheme = true;
    verificationChecklist.dawnThemeStatus = prefill.dawnThemeStatus;
  }

  if (verificationChecklist.dawnThemeStatus || prefill.dawnThemeStatus) {
    syncBinaryChecklistObservation(
      dawnItem,
      verificationChecklist.dawnThemeStatus,
    );
  }
}

function getLegalNoticeChecklistMeta() {
  const savedUrl = legalNoticeUrl.value.trim();
  const siteUrl = data.value?.sourceUrl || data.value?.url?.url || "";
  const normalizedSiteUrl = siteUrl.trim();

  return {
    url: savedUrl || normalizedSiteUrl,
    popupUrl: savedUrl
      ? savedUrl
      : normalizedSiteUrl
        ? (() => {
            try {
              return new URL("/policies/legal-notice", normalizedSiteUrl).toString();
            } catch {
              return `${normalizedSiteUrl.replace(/\/+$/, "")}/policies/legal-notice`;
            }
          })()
        : "",
  };
}

function syncLegalNoticeObservation(status: SiteQualificationChecklist["legalNoticeStatus"]) {
  const legacyObservationKey = "legal-notice-checklist";
  const matchesLegalNoticeKey = (key: string) =>
    key === LEGAL_NOTICE_OBSERVATION_KEY || key === legacyObservationKey;

  if (status === "valid" || !status) {
    const removedKeys = new Set(siteObservations.value.filter((observation) => matchesLegalNoticeKey(observation.key)).map((observation) => observation.key));
    if (removedKeys.size > 0) {
      siteObservations.value = siteObservations.value.filter(
        (observation) => !matchesLegalNoticeKey(observation.key),
      );
      expandedObservationKeys.value = expandedObservationKeys.value.filter(
        (key) => !matchesLegalNoticeKey(key),
      );
    }
    if (removedKeys.has(mainObservationKey.value || "")) {
      mainObservationKey.value = siteObservations.value[0]?.key || null;
    }
    return;
  }

  const nextObservation = {
    key: LEGAL_NOTICE_OBSERVATION_KEY,
    title:
      status === "missing"
        ? "Page de mentions légales manquante"
        : "Page de mentions légales non valide",
    detail:
      status === "missing"
        ? "La page de mentions légales est absente du site."
        : "La page de mentions légales est accessible, mais son contenu n’est pas jugé valide.",
    severity: status === "missing" ? "critical" : "warning",
    isMain: mainObservationKey.value === LEGAL_NOTICE_OBSERVATION_KEY,
    source: "automatic",
  } satisfies SiteObservation;

  siteObservations.value = [
    nextObservation,
    ...siteObservations.value.filter(
      (observation) => !matchesLegalNoticeKey(observation.key),
    ),
  ];
  expandedObservationKeys.value = expandedObservationKeys.value.filter(
    (key) => !matchesLegalNoticeKey(key),
  );
  if (!expandedObservationKeys.value.includes(LEGAL_NOTICE_OBSERVATION_KEY)) {
    expandedObservationKeys.value = [LEGAL_NOTICE_OBSERVATION_KEY, ...expandedObservationKeys.value];
  }
}

function syncBinaryChecklistObservation(
  item: BinaryChecklistItem,
  status: ChecklistBinaryStatus,
) {
  const observationIndex = siteObservations.value.findIndex(
    (observation) => observation.key === item.observationKey,
  );

  const observationData =
    item.key === "dawnTheme"
      ? status === "valid"
        ? item.validObservation || null
        : null
      : status === "invalid"
        ? item.invalidObservation || null
        : null;

  if (!observationData) {
    if (observationIndex >= 0) {
      siteObservations.value.splice(observationIndex, 1);
      if (expandedObservationKeys.value.includes(item.observationKey)) {
        expandedObservationKeys.value = expandedObservationKeys.value.filter(
          (key) => key !== item.observationKey,
        );
      }
    }
    if (mainObservationKey.value === item.observationKey) {
      mainObservationKey.value = siteObservations.value[0]?.key || null;
    }
    return;
  }

  const nextObservation = {
    key: item.observationKey,
    title: observationData.title,
    detail: observationData.detail,
    severity: observationData.severity,
    isMain: mainObservationKey.value === item.observationKey,
    source: "automatic",
  } satisfies SiteObservation;

  if (observationIndex >= 0) {
    siteObservations.value.splice(observationIndex, 1, nextObservation);
  } else {
    siteObservations.value.unshift(nextObservation);
  }
  if (!expandedObservationKeys.value.includes(item.observationKey)) {
    expandedObservationKeys.value = [item.observationKey, ...expandedObservationKeys.value];
  }
}

function setBinaryChecklistStatus(
  item: BinaryChecklistItem,
  status: ChecklistBinaryStatus,
) {
  verificationChecklist[item.key] = Boolean(status);
  verificationChecklist[item.statusKey] = status;
  syncBinaryChecklistObservation(item, status);
}

function clearBinaryChecklistStatus(item: BinaryChecklistItem) {
  verificationChecklist[item.key] = false;
  verificationChecklist[item.statusKey] = null;
  syncBinaryChecklistObservation(item, null);
}

function getBinaryChecklistStatus(
  item: BinaryChecklistItem,
) {
  return verificationChecklist[item.statusKey];
}

function setLegalNoticeChecklistStatus(
  status: SiteQualificationChecklist["legalNoticeStatus"],
) {
  verificationChecklist.legalNotice = Boolean(status);
  verificationChecklist.legalNoticeStatus = status;
  syncLegalNoticeObservation(status);
}

function clearLegalNoticeChecklistStatus() {
  verificationChecklist.legalNotice = false;
  verificationChecklist.legalNoticeStatus = null;
  syncLegalNoticeObservation(null);
}

function openLegalNoticePopup() {
  const { popupUrl } = getLegalNoticeChecklistMeta();
  if (!popupUrl) {
    return;
  }

  window.open(popupUrl, "_blank", "noopener,noreferrer,width=1280,height=900");
}

const positioningDecisionLabel = computed(() => {
  const normalized = String(
    data.value?.url?.redesignDecision || "",
  ).toLowerCase();

  if (normalized === "accepted") return "Validé";
  if (normalized === "draft") return "Brouillon";
  if (normalized === "rejected") return "Refusé";
  if (normalized === "manual") return "Manuel";
  if (normalized === "none") return "Aucune";

  return data.value?.url?.redesignDecision || "—";
});

const isPositioningValidated = computed(() => {
  return (
    String(data.value?.url?.redesignDecision || "").toLowerCase() === "accepted"
  );
});

function normalizeSuggestionText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function parseObservationList(rawValue: string | null | undefined) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => {
        if (typeof item === "string") {
          const text = item.trim();
          if (!text) {
            return null;
          }

          return {
            key: `lighthouse-${index + 1}`,
            title: text,
            detail: text,
            severity: "info" as const,
            isMain: index === 0,
          };
        }

        if (item && typeof item === "object") {
          const observation = item as Partial<SiteObservation> & {
            severity?: string;
          };
          const title = String(
            observation.title || observation.detail || "",
          ).trim();
          const detail = String(
            observation.detail || observation.title || "",
          ).trim();
          if (!title && !detail) {
            return null;
          }

          return {
            key: String(observation.key || `lighthouse-${index + 1}`),
            title: title || detail || `Observation ${index + 1}`,
            detail: detail || title || "Observation sans détail.",
            severity:
              String(observation.severity || "info").toLowerCase() ===
              "critical"
                ? "critical"
                : String(observation.severity || "info").toLowerCase() ===
                    "warning"
                  ? "warning"
                  : "info",
            isMain: index === 0,
          };
        }

        return null;
      })
      .filter(Boolean) as SiteObservation[];
  } catch {
    return [];
  }
}

function getCrmSuggestion(prospect: ProspectDetail | null | undefined) {
  if (!prospect) {
    return {
      positioning:
        "support-without-observation" as SiteQualificationPositioning,
      reasons: ["Aucun prospect chargé."],
    };
  }

  const url = prospect.url;
  const cmsName = normalizeSuggestionText(url?.cmsName);
  const shopifyStatus = normalizeSuggestionText(url?.shopifyStatus);
  const shopifyThemeSchemaName = normalizeSuggestionText(
    url?.shopifyThemeSchemaName,
  );
  const shopifyThemeName = normalizeSuggestionText(url?.shopifyThemeName);
  const observations = url?.qualification?.observations?.length
    ? url.qualification.observations
    : parseObservationList(url?.lighthouseObservationsJson);
  const mainObservation =
    url?.qualification?.mainObservation || observations[0] || null;
  const scoreEntries = [
    { label: "Performance", value: url?.lighthousePerformanceScore },
    { label: "Accessibilité", value: url?.lighthouseAccessibilityScore },
    { label: "Bonnes pratiques", value: url?.lighthouseBestPracticesScore },
    { label: "SEO", value: url?.lighthouseSeoScore },
  ];
  const definedScores = scoreEntries.filter((item) =>
    Number.isFinite(item.value),
  );
  const lowScoreEntries = scoreEntries.filter(
    (item) => item.value != null && item.value < 80,
  );
  const hasRemarks = observations.length > 0;
  const isSlow =
    (url?.scanTotalMs != null && url.scanTotalMs >= 5000) ||
    (url?.scanTtfbMs != null && url.scanTtfbMs >= 1200);

  if (
    shopifyStatus !== "shopify" &&
    [
      "woocommerce",
      "prestashop",
      "presta shop",
      "magento",
      "opencart",
      "bigcommerce",
    ].some((value) => cmsName.includes(value))
  ) {
    return {
      positioning: "migration" as SiteQualificationPositioning,
      reasons: [
        `CMS détecté: ${url?.cmsName || "inconnu"}; le site est candidat à la migration.`,
      ],
    };
  }

  const hasFreeShopifyTheme = ["dawn", "refresh"].some(
    (theme) =>
      shopifyThemeSchemaName.includes(theme) ||
      shopifyThemeName.includes(theme),
  );
  if (cmsName === "wordpress" && hasFreeShopifyTheme) {
    return {
      positioning: "refonte" as SiteQualificationPositioning,
      reasons: [
        "WordPress avec un thème Shopify gratuit détecté, le site est candidat à la refonte.",
      ],
    };
  }

  if (lowScoreEntries.length > 0) {
    return {
      positioning: "optimisation" as SiteQualificationPositioning,
      reasons: lowScoreEntries.map(
        (entry) =>
          `Lighthouse ${entry.label} est à ${Math.round(Number(entry.value || 0))}, sous le seuil de 80.`,
      ),
    };
  }

  if (
    definedScores.length > 0 &&
    definedScores.every((item) => Number(item.value) >= 80) &&
    hasRemarks
  ) {
    const reasons = [
      "Les scores Lighthouse sont élevés, mais le site contient encore des remarques.",
    ];
    if (mainObservation?.title) {
      reasons.push(`Observation principale: ${mainObservation.title}.`);
    }

    return {
      positioning: "support-with-error" as SiteQualificationPositioning,
      reasons,
    };
  }

  if (isSlow) {
    return {
      positioning: "support-with-error" as SiteQualificationPositioning,
      reasons: ["Le site est lent et mérite un accompagnement avec erreur."],
    };
  }

  const reasons: string[] = [];
  if (mainObservation?.title) {
    reasons.push(`Observation principale: ${mainObservation.title}.`);
  }

  if (hasRemarks) {
    reasons.push(`${observations.length} remarque(s) détectée(s) sur le site.`);
  }

  if (reasons.length === 0) {
    reasons.push(
      "Aucun signal bloquant n’a été détecté, le site est candidat au support sans observation.",
    );
  }

  return {
    positioning: "support-without-observation" as SiteQualificationPositioning,
    reasons,
  };
}

const crmSuggestion = computed(() => getCrmSuggestion(data.value));
const crmPositioningLabel = computed(() =>
  formatQualificationPositioning(crmSuggestion.value.positioning),
);
const crmReasonItems = computed(() => crmSuggestion.value.reasons);
const crmKeyInfoItems = computed(() => {
  const prospect = data.value;
  if (!prospect) {
    return [];
  }

  const themeStoreType =
    prospect.url?.shopifyThemeStoreType === "free"
      ? "Gratuit Shopify"
      : prospect.url?.shopifyThemeStoreType === "paid"
        ? "Payant Shopify"
        : prospect.url?.shopifyThemeStoreType === "custom"
          ? "Hors store Shopify"
          : "—";

  return [
    `CMS: ${prospect.url?.cmsName || "—"}`,
    `Thème: ${prospect.url?.shopifyThemeName || prospect.url?.shopifyThemeSchemaName || "—"}`,
    `Type de thème: ${themeStoreType}`,
    `Produits: ${prospect.url?.productCount ?? "—"}`,
    `Prix médian: ${prospect.url?.medianProductPrice != null ? `${prospect.url.medianProductPrice} €` : "—"}`,
  ];
});

const legalNoticeUrl = computed(
  () => data.value?.url?.shopifyLegalNoticeUrl?.trim() || "",
);

const sirenSearchUrl = computed(() => {
  const siren = String(data.value?.siren || data.value?.contactSiren || "").trim();
  if (!siren) {
    return "";
  }

  return `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siren)}`;
});

function getShopifyLabel(prospect: ProspectDetail | null | undefined) {
  const value = String(prospect?.url?.shopifyStatus || "").toLowerCase();

  if (value === "shopify") return "Shopify";
  if (value === "not_shopify") return "Non Shopify";
  if (value === "error") return "Défectueux";

  return prospect?.url?.shopifyStatus || "—";
}

function isShopify(prospect: ProspectDetail | null | undefined) {
  return String(prospect?.url?.shopifyStatus || "").toLowerCase() === "shopify";
}

const lighthouseScoreItems = computed(() => {
  const url = data.value?.url;

  return [
    { label: "Performance", value: url?.lighthousePerformanceScore ?? null },
    {
      label: "Accessibilité",
      value: url?.lighthouseAccessibilityScore ?? null,
    },
    {
      label: "Bonnes pratiques",
      value: url?.lighthouseBestPracticesScore ?? null,
    },
    { label: "SEO", value: url?.lighthouseSeoScore ?? null },
  ];
});

function scoreTone(value: number | null) {
  if (value == null) return "text-slate-400";
  if (value >= 90) return "text-emerald-600";
  if (value >= 80) return "text-sky-600";
  if (value >= 50) return "text-amber-600";
  return "text-rose-600";
}

function isProspectTabKey(value: string | null): value is ProspectTabKey {
  return Boolean(value && activeProspectTabKeys.includes(value as ProspectTabKey));
}

function restoreActiveProspectTab() {
  if (!import.meta.client) {
    return;
  }

  const storedValue = window.localStorage.getItem(activeProspectTabStorageKey.value);
  activeProspectTab.value = isProspectTabKey(storedValue) ? storedValue : "edit";
  activeProspectTabHydrated.value = true;
}

watch(activeProspectTab, (tab) => {
  if (!import.meta.client || !activeProspectTabHydrated.value) {
    return;
  }

  window.localStorage.setItem(activeProspectTabStorageKey.value, tab);
});

function syncEditForm(prospect: ProspectDetail | null | undefined) {
  const prospectId = prospect?.id ?? null;
  if (lastEditFormProspectId.value !== prospectId) {
    lastNameTouched.value = false;
    lastEditFormProspectId.value = prospectId;
  }

  syncingEditForm.value = true;

  const hasStoredLastName =
    prospect?.contactLastName != null && prospect?.contactLastName !== "";
  editForm.lastName = hasStoredLastName
    ? prospect?.contactLastName || ""
    : prospect?.name != null && prospect?.name !== ""
      ? prospect?.name || ""
      : lastNameTouched.value
        ? ""
        : prospect?.name || "";
  editForm.companyName =
    prospect?.companyName ||
    prospect?.contactCompanyName ||
    "";
  editForm.siteName = prospect?.siteName || prospect?.url?.siteName || "";
  editForm.firstName = prospect?.firstName || "";
  editForm.email = prospect?.email || "";
  editForm.phone = prospect?.contactPhone || prospect?.phone || "";
  editForm.siren = prospect?.siren || prospect?.contactSiren || "";
  editForm.ownerName =
    prospect?.owner || prospect?.contactOwnerName || "";
  editForm.companyAddress =
    prospect?.companyAddress || prospect?.contactCompanyAddress || "";
  editForm.companyAddressExtra =
    prospect?.companyAddressExtra || prospect?.contactCompanyAddressExtra || "";
  editForm.companyPostalCode =
    prospect?.companyPostalCode || prospect?.contactCompanyPostalCode || "";
  editForm.companyCity =
    prospect?.companyCity || prospect?.contactCompanyCity || "";
  editForm.companyLegalForm =
    prospect?.companyLegalForm || prospect?.contactCompanyLegalForm || "";
  editForm.companyCountry =
    prospect?.companyCountry || prospect?.contactCompanyCountry || "";
  editForm.shopifyLegalNoticeUrl =
    prospect?.shopifyLegalNoticeUrl || prospect?.url?.shopifyLegalNoticeUrl || "";
  editForm.siteLanguageCode = normalizeSiteLanguageChoice(
    prospect?.siteLanguageCode || prospect?.url?.siteLanguageCode,
    prospect?.siteLanguageName || prospect?.url?.siteLanguageName,
  );
  editForm.quoteFileName = prospect?.quoteFileName || "";
  editForm.quoteSent = Boolean(prospect?.quoteSentAt);
  editForm.contractFileName = prospect?.contractFileName || "";
  editForm.contractSent = Boolean(prospect?.contractSentAt);
  lastEditFormSnapshot = buildEditFormSnapshot();
  syncingEditForm.value = false;
  siteObservations.value = (
    prospect?.url?.qualification?.observations || []
  ).map((observation) => ({
    key: observation.key,
    title: observation.title,
    detail: observation.detail,
    severity: observation.severity,
    isMain: observation.isMain,
    source: inferObservationSource(observation),
  }));
  Object.assign(
    verificationChecklist,
    normalizeVerificationChecklist(
      prospect?.url?.qualification?.verificationChecklist,
    ),
  );
  mainObservationKey.value =
    prospect?.url?.qualification?.mainObservationKey ||
    siteObservations.value.find((item) => item.isMain)?.key ||
    null;
  deletedManualObservationKeys.value = new Set();
  applyScanChecklistPrefill(prospect);
  expandedObservationKeys.value = [];
  abandonReason.value = prospect?.url?.qualification?.abandonReason || "";
  positioningChoice.value =
    prospect?.url?.qualification?.positioning ||
    getCrmSuggestion(prospect).positioning;
  prospectStatusChoice.value =
    prospect?.status || PROSPECT_STATUS_CONFIG[0]?.status || "";
  lastQualificationSnapshot = JSON.stringify(buildQualificationPayload());
}

watch(
  () => editForm.lastName,
  () => {
    if (!syncingEditForm.value) {
      lastNameTouched.value = true;
    }
  },
);

watch(
  data,
  (prospect) => {
    syncEditForm(prospect);
    syncMagifyTicketForm(prospect);
  },
  { immediate: true },
);

watch(id, () => {
  if (import.meta.client) {
    restoreActiveProspectTab();
  }
});

watch(
  [
    positioningChoice,
    abandonReason,
    siteObservations,
    mainObservationKey,
    verificationChecklist,
  ],
  () => {
    syncPositioningWithMainObservation();
    scheduleObservationAutosave();
  },
  { deep: true },
);

onMounted(() => {
  restoreActiveProspectTab();
});

onBeforeUnmount(() => {
  if (sitePreviewMonitor) {
    clearInterval(sitePreviewMonitor);
    sitePreviewMonitor = null;
  }

  if (observationSaveTimer) {
    clearTimeout(observationSaveTimer);
    observationSaveTimer = null;
  }

  clearEditSaveFeedbackTimers();
});

async function saveProspectDetails() {
  if (!data.value) {
    return;
  }

  saveState.value = "saving";
  saveError.value = "";

  try {
    const updatedProspect = await $fetch<{
      prospect: ProspectDetail;
      updatedFields: string[];
    }>(
      `${runtimeConfig.public.apiUrl}/prospects/${data.value.id}/process`,
      {
        method: "PATCH",
        body: {
          lastName: editForm.lastName.trim() || null,
          companyName: editForm.companyName.trim() || null,
          siteName: editForm.siteName.trim() || null,
          firstName: editForm.firstName.trim() || null,
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          siren: editForm.siren.trim() || null,
          ownerName: editForm.ownerName.trim() || null,
          companyAddress: editForm.companyAddress.trim() || null,
          companyAddressExtra:
            editForm.companyAddressExtra.trim() || null,
          companyPostalCode:
            editForm.companyPostalCode.trim() || null,
          companyCity: editForm.companyCity.trim() || null,
          companyLegalForm:
            editForm.companyLegalForm.trim() || null,
          companyCountry: editForm.companyCountry.trim() || null,
          shopifyLegalNoticeUrl: editForm.shopifyLegalNoticeUrl.trim() || null,
          siteLanguageCode: editForm.siteLanguageCode || null,
          siteLanguageName:
            editForm.siteLanguageCode === "fr"
              ? "Français"
              : editForm.siteLanguageCode === "en"
                ? "Anglais"
                : editForm.siteLanguageCode === "other"
                  ? "Autre langue"
                  : null,
          quoteFileName: editForm.quoteFileName.trim() || null,
          quoteSentAt: editForm.quoteSent,
          contractFileName: editForm.contractFileName.trim() || null,
          contractSentAt: editForm.contractSent,
        },
      },
    );

    if (updatedProspect) {
      data.value = updatedProspect.prospect;
      syncEditForm(updatedProspect.prospect);
    }

    await refresh();
    if (data.value) {
      syncEditForm(data.value);
      syncMagifyTicketForm(data.value);
    }

    saveState.value = "saved";
    showEditSaveFeedback();
  } catch (error) {
    clearEditSaveFeedbackTimers();
    editSaveFeedbackState.value = "idle";
    saveState.value = "error";
    saveError.value =
      error instanceof Error
        ? error.message
        : "Impossible d’enregistrer les modifications.";
  }
}

async function saveProspectStatus() {
  if (!data.value || !prospectStatusChoice.value) {
    return;
  }

  if (prospectStatusChoice.value === data.value.status) {
    return;
  }

  statusSaving.value = true;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/prospects/${data.value.id}/status`,
      {
        method: "PATCH",
        body: { status: prospectStatusChoice.value },
      },
    );

    notifications.add({
      title: "Statut mis à jour",
      message: `Le prospect est maintenant marqué comme "${prospectStatusChoice.value}".`,
      color: "success",
    });

    if (prospectStatusChoice.value === "Prospect non qualifié") {
      await navigateTo({
        path: "/prospects-status/prospect-froid",
        query: route.query,
      });
      return;
    }

    await refresh();
  } catch (error) {
    notifications.add({
      title: "Impossible de changer le statut",
      message:
        error instanceof Error ? error.message : "Une erreur est survenue.",
      color: "red",
    });
  } finally {
    statusSaving.value = false;
  }
}

async function trashProspect() {
  if (!data.value) {
    return;
  }

  const confirmed = window.confirm(
    `Mettre le prospect "${data.value.name || data.value.siteName || "ce contact"}" à la corbeille ?`,
  );
  if (!confirmed) {
    return;
  }

  trashing.value = true;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/prospects/${data.value.id}/trash`,
      {
        method: "PATCH",
      },
    );

    notifications.add({
      title: "Prospect mis à la corbeille",
      message: `${data.value.siteName || data.value.name || "Le contact"} a été déplacé vers la corbeille.`,
      color: "warning",
    });

    await navigateTo("/search-prospects");
  } catch (error) {
    notifications.add({
      title: "Impossible de mettre à la corbeille",
      message:
        error instanceof Error ? error.message : "Une erreur est survenue.",
      color: "red",
    });
  } finally {
    trashing.value = false;
  }
}

async function markProspectAsContacted() {
  if (!data.value) {
    return;
  }

  const prospectLabel = data.value.name || data.value.siteName || "ce contact";
  const confirmed = window.confirm(
    `Marquer le prospect "${prospectLabel}" comme contacté par email via une autre plateforme ?`,
  );

  if (!confirmed) {
    return;
  }

  markingContacted.value = true;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/prospects/${data.value.id}/contacted`,
      {
        method: "PATCH",
      },
    );

    notifications.add({
      title: "Statut mis à jour",
      message: `${data.value.siteName || data.value.name || "Le contact"} est maintenant marqué comme prospect contacté.`,
      color: "success",
    });

    await navigateTo({
      path: "/prospects-status/prospect-froid",
      query: route.query,
    });
  } catch (error) {
    notifications.add({
      title: "Impossible de mettre à jour le statut",
      message:
        error instanceof Error ? error.message : "Une erreur est survenue.",
      color: "red",
    });
  } finally {
    markingContacted.value = false;
  }
}

async function reanalyzeProspectSite() {
  if (!data.value?.urlId) {
    return;
  }

  const siteLabel = data.value.siteName || data.value.name || "ce site";
  const confirmed = window.confirm(`Réanalyser le site "${siteLabel}" ?`);
  if (!confirmed) {
    return;
  }

  reanalyzingSite.value = true;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/scanning/sites/${data.value.urlId}`,
      {
        method: "POST",
      },
    );

    notifications.add({
      title: "Site réanalysé",
      message: `Le scan du site "${siteLabel}" a été relancé.`,
      color: "success",
    });

    await refresh();
  } catch (error) {
    notifications.add({
      title: "Impossible de relancer le scan",
      message:
        error instanceof Error ? error.message : "Une erreur est survenue.",
      color: "red",
    });
  } finally {
    reanalyzingSite.value = false;
  }
}

async function createMagifyTicket() {
  if (!data.value?.id) {
    return;
  }

  const prospectLabel = data.value.siteName || data.value.name || "ce prospect";
  magifyTicketCreating.value = true;
  magifyTicketState.value = "idle";
  magifyTicketMessage.value = "";

  try {
    const result = await $fetch<{
      success?: boolean;
      ticket?: {
        id?: string;
        title?: string;
        status?: string;
        priority?: string;
        ticket_source?: string;
        created_at?: string;
      };
      ticketId?: string | null;
      ticketUrl?: string | null;
    }>(
      `${runtimeConfig.public.apiUrl}/prospects/${data.value.id}/magify-ticket`,
      {
        method: "POST",
        body: {
          company: {
            name:
              magifyTicketForm.companyName.trim() ||
              data.value.contactCompanyName ||
              data.value.siteName ||
              data.value.name ||
              "Prospect Magify",
            siren: magifyTicketForm.companySiren.trim() || undefined,
            website: magifyTicketForm.companyWebsite.trim() || undefined,
            legal_form: magifyTicketForm.companyLegalForm.trim() || undefined,
            address: magifyTicketForm.companyAddress.trim() || undefined,
            address_extra:
              magifyTicketForm.companyAddressExtra.trim() || undefined,
            postal_code: magifyTicketForm.companyPostalCode.trim() || undefined,
            city: magifyTicketForm.companyCity.trim() || undefined,
            country: magifyTicketForm.companyCountry.trim() || "France",
          },
          contact: {
            first_name:
              magifyTicketForm.contactFirstName.trim() ||
              data.value.contactFirstName ||
              data.value.firstName ||
              data.value.name?.split(" ")[0] ||
              data.value.siteName?.split(" ")[0] ||
              "Prénom",
            last_name:
              magifyTicketForm.contactLastName.trim() ||
              data.value.contactLastName ||
              data.value.contactOwnerName ||
              data.value.name ||
              data.value.siteName ||
              "Contact",
            email:
              magifyTicketForm.contactEmail.trim() ||
              data.value.email ||
              data.value.contactEmail ||
              undefined,
            phone:
              magifyTicketForm.contactPhone.trim() ||
              data.value.phone ||
              data.value.contactPhone ||
              undefined,
            job_title:
              magifyTicketForm.contactJobTitle.trim() ||
              data.value.contactOwnerName ||
              undefined,
          },
          ticket: {
            title: magifyTicketForm.title.trim() || undefined,
            notes: magifyTicketForm.notes.trim() || undefined,
            priority: magifyTicketForm.priority.trim() || undefined,
            shop_url: magifyTicketForm.shopUrl.trim() || undefined,
            offer_id: magifyTicketForm.offerId.trim() || undefined,
            responsible_user_id:
              magifyTicketForm.responsibleUserId.trim() || undefined,
          },
        },
      },
    );

    const ticketId = result?.ticketId || result?.ticket?.id || null;
    const ticketUrl = result?.ticketUrl || null;
    magifyTicketResult.value = {
      ticketId,
      ticketUrl,
    };
    magifyTicketState.value = "success";
    magifyTicketMessage.value = ticketId
      ? `Ticket ${ticketId} créé avec succès.`
      : "Ticket créé avec succès.";
    magifyTicketPanelOpen.value = true;

    if (data.value) {
      data.value = {
        ...data.value,
        magifyTicketId: ticketId,
        magifyTicketUrl: ticketUrl,
      };
    }

    notifications.add({
      title: "Ticket créé dans MagifyOS",
      message: `Le ticket a été généré pour "${prospectLabel}".`,
      color: "success",
    });
  } catch (error) {
    magifyTicketResult.value = null;
    magifyTicketState.value = "error";
    magifyTicketMessage.value =
      error instanceof Error ? error.message : "Une erreur est survenue.";
    notifications.add({
      title: "Impossible de créer le ticket",
      message: magifyTicketMessage.value,
      color: "red",
    });
  } finally {
    magifyTicketCreating.value = false;
  }
}

async function handleEmailQueued() {
  if (positioningChoice.value === "support-with-error") {
    activeProspectTab.value = "ticket";
    magifyTicketPanelOpen.value = true;
    return;
  }

  await navigateTo({
    path: "/prospects-status/prospect-froid",
    query: route.query,
  });
}

async function updateContactAutomatically() {
  if (!data.value?.urlId) {
    return;
  }

  autoUpdatingContact.value = true;

  try {
    await $fetch(`${runtimeConfig.public.apiUrl}/prospects/${data.value.id}/contact/refresh`, {
      method: "POST",
    });

    await refresh();

    notifications.add({
      title: "Contact mis à jour",
      description: "Le site a été rescanné pour récupérer les informations de contact.",
      color: "green",
    });
  } catch (error) {
    notifications.add({
      title: "Impossible de mettre à jour le contact",
      description: error instanceof Error ? error.message : "Une erreur inconnue est survenue.",
      color: "red",
    });
  } finally {
    autoUpdatingContact.value = false;
  }
}

function addObservation() {
  const key = crypto.randomUUID();

  siteObservations.value.push({
    key,
    title: "",
    detail: "",
    severity: "warning",
    isMain: siteObservations.value.length === 0,
    source: "manual",
  });

  expandedObservationKeys.value = [key];

  if (!mainObservationKey.value && siteObservations.value.length === 1) {
    mainObservationKey.value = siteObservations.value[0].key;
  }

  scheduleObservationAutosave();
}

function removeObservation(index: number) {
  const [removed] = siteObservations.value.splice(index, 1);
  if (removed && inferObservationSource(removed) === "manual") {
    deletedManualObservationKeys.value = new Set([
      ...deletedManualObservationKeys.value,
      removed.key,
    ]);
  }
  if (removed?.key && removed.key === mainObservationKey.value) {
    mainObservationKey.value = siteObservations.value[0]?.key || null;
  }
  if (removed?.key && removed.key === focusedObservationTitleKey.value) {
    focusedObservationTitleKey.value = null;
  }
  if (removed?.key) {
    expandedObservationKeys.value = expandedObservationKeys.value.filter(
      (key) => key !== removed.key,
    );
  }
  if (siteObservations.value.length === 0) {
    mainObservationKey.value = null;
  }

  scheduleObservationAutosave();
}

function applyObservationTitleSuggestion(
  observation: SiteObservation,
  suggestion: { title: string; exampleDetail: string | null },
) {
  observation.title = suggestion.title;
  if (suggestion.exampleDetail != null && String(suggestion.exampleDetail).trim()) {
    observation.detail = suggestion.exampleDetail;
    return;
  }
  if (!String(observation.detail || "").trim()) {
    observation.detail = suggestion.title;
  }
}

function focusObservationTitleInput(observationKey: string) {
  focusedObservationTitleKey.value = observationKey;
}

function blurObservationTitleInput(observationKey: string) {
  if (focusedObservationTitleKey.value === observationKey) {
    focusedObservationTitleKey.value = null;
  }
}

function isObservationExpanded(key: string) {
  return expandedObservationKeys.value.includes(key);
}

function toggleObservation(key: string) {
  if (isObservationExpanded(key)) {
    expandedObservationKeys.value = [];
    return;
  }

  expandedObservationKeys.value = [key];
}

function syncPositioningWithMainObservation() {
  if (
    !mainObservationKey.value &&
    positioningChoice.value === "support-with-error" &&
    siteObservations.value.length === 0
  ) {
    positioningChoice.value = "support-without-observation";
  }
}

function buildChecklistPayload() {
  return {
    legalNotice: Boolean(verificationChecklist.legalNotice),
    legalNoticeStatus: verificationChecklist.legalNoticeStatus,
    visualAnomaly: Boolean(verificationChecklist.visualAnomaly),
    visualAnomalyStatus: verificationChecklist.visualAnomalyStatus,
    collectionVisualAnomaly: Boolean(verificationChecklist.collectionVisualAnomaly),
    collectionVisualAnomalyStatus: verificationChecklist.collectionVisualAnomalyStatus,
    productVisualAnomaly: Boolean(verificationChecklist.productVisualAnomaly),
    productVisualAnomalyStatus: verificationChecklist.productVisualAnomalyStatus,
    aboutVisualAnomaly: Boolean(verificationChecklist.aboutVisualAnomaly),
    aboutVisualAnomalyStatus: verificationChecklist.aboutVisualAnomalyStatus,
    translated: Boolean(verificationChecklist.translated),
    translatedStatus: verificationChecklist.translatedStatus,
  };
}

function buildQualificationPayload() {
  const observations = siteObservations.value
    .map((observation) => ({
      key: observation.key || crypto.randomUUID(),
      title: String(observation.title || "").trim(),
      detail: String(observation.detail || "").trim(),
      severity: observation.severity,
      isMain: observation.key === mainObservationKey.value,
      source: inferObservationSource(observation as SiteObservation & { key: string }),
    }))
    .filter(
      (observation) =>
        observation.title.length > 0 || observation.detail.length > 0,
    );

  const effectiveMainObservationKey = observations.some(
    (observation) => observation.key === mainObservationKey.value,
  )
    ? mainObservationKey.value
    : observations[0]?.key || null;

  return {
    positioning: positioningChoice.value,
    abandonReason:
      positioningChoice.value === "abandon" ? abandonReason.value.trim() : null,
    mainObservationKey: effectiveMainObservationKey,
    observations,
    deletedObservationKeys: Array.from(deletedManualObservationKeys.value),
    verificationChecklist: buildChecklistPayload(),
  };
}

function getQualificationSnapshot() {
  return JSON.stringify(buildQualificationPayload());
}

function scheduleObservationAutosave() {
  const snapshot = getQualificationSnapshot();
  if (snapshot === lastQualificationSnapshot) {
    return;
  }

  if (observationSaveTimer) {
    clearTimeout(observationSaveTimer);
  }

  observationSaveTimer = window.setTimeout(() => {
    void saveQualification({ silent: true });
  }, 450);
}

async function saveQualification(options: { silent?: boolean } = {}) {
  if (!data.value?.urlId) {
    return;
  }

  const payload = buildQualificationPayload();
  const isSilent = Boolean(options.silent);

  if (payload.positioning === "abandon" && !payload.abandonReason) {
    if (!isSilent) {
      notifications.add({
        title: "Raison requise",
        message: "Indique la raison de l’abandon avant d’enregistrer.",
        color: "red",
      });
    }
    return;
  }

  if (payload.positioning === "support-with-error") {
    if (payload.observations.length === 0) {
      if (!isSilent) {
        notifications.add({
          title: "Observation requise",
          message:
            "Ajoute au moins une observation pour un support avec erreur.",
          color: "red",
        });
      }
      return;
    }

    const effectiveMainObservationKey =
      payload.mainObservationKey || payload.observations[0]?.key || null;
    if (!effectiveMainObservationKey) {
      if (!isSilent) {
        notifications.add({
          title: "Erreur principale requise",
          message: "Choisis l’erreur à mettre en avant.",
          color: "red",
        });
      }
      return;
    }
  }

  if (!isSilent) {
    positioningSaving.value = true;
  }

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/urls/${data.value.urlId}/qualification`,
      {
        method: "PATCH",
        body: payload,
      },
    );

    deletedManualObservationKeys.value = new Set();
    lastQualificationSnapshot = getQualificationSnapshot();
    if (!isSilent) {
      notifications.add({
        title: "Qualification enregistrée",
        message: "La qualification du prospect a été sauvegardée.",
        color: "success",
      });

      if (payload.positioning === "support-without-observation") {
        emailPreferredTemplateKey.value = "support-simple";
        activeProspectTab.value = "email";
      } else {
        emailPreferredTemplateKey.value = null;
      }

      await refreshNuxtData();
    }
  } catch (error) {
    if (!isSilent) {
      notifications.add({
        title: "Impossible d’enregistrer le positionnement",
        message:
          error instanceof Error ? error.message : "Une erreur est survenue.",
        color: "red",
      });
    }
  } finally {
    if (!isSilent) {
      positioningSaving.value = false;
    }

    if (observationSaveTimer) {
      clearTimeout(observationSaveTimer);
      observationSaveTimer = null;
    }
  }
}

async function rerunLighthouseAudit() {
  if (!data.value?.urlId || lighthouseAuditing.value) {
    return;
  }

  lighthouseAuditing.value = true;

  try {
    await $fetch(
      `${runtimeConfig.public.apiUrl}/scanning/sites/${data.value.urlId}/steps/lighthouse?force=true`,
      {
        method: "POST",
      },
    );

    notifications.add({
      title: "Audit Lighthouse relancé",
      message: "Les scores Lighthouse ont été mis à jour.",
      color: "success",
    });

    await refresh();
  } catch (error) {
    notifications.add({
      title: "Audit Lighthouse impossible",
      message:
        error instanceof Error ? error.message : "Une erreur est survenue.",
      color: "red",
    });
  } finally {
    lighthouseAuditing.value = false;
  }
}

function openSitePreview() {
  const siteUrl = data.value?.sourceUrl || data.value?.url?.url;
  if (!siteUrl) {
    return;
  }

  const popup = window.open(
    siteUrl,
    "site-preview",
    "popup=yes,width=1280,height=900",
  );
  if (popup) {
    popup.focus();
    if (sitePreviewMonitor) {
      clearInterval(sitePreviewMonitor);
    }

    sitePreviewMonitor = setInterval(() => {
      if (popup.closed) {
        if (sitePreviewMonitor) {
          clearInterval(sitePreviewMonitor);
          sitePreviewMonitor = null;
        }
        window.focus();
      }
    }, 350);
    return;
  }

  window.open(siteUrl, "_blank", "noopener,noreferrer");
}

function openLegalNoticePage() {
  const { popupUrl } = getLegalNoticeChecklistMeta();
  if (!popupUrl) {
    return;
  }

  window.open(popupUrl, "_blank", "noopener,noreferrer,width=1280,height=900");
}

function normalizeLeadScoreValue(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function formatLeadScorePoints(points: number) {
  return `${Number(points || 0)} pt${Number(points || 0) > 1 ? "s" : ""}`;
}

type LeadScoreBreakdownRow = {
  label: string;
  value: string;
  points: number;
  note: string;
};

type LeadScoreBreakdownSection = {
  label: string;
  total: number;
  rows: LeadScoreBreakdownRow[];
};

function buildLeadScoreBreakdownSections(
  prospect: ProspectDetail | null | undefined,
  settings: LeadScoreSettingsResponse | null | undefined,
) {
  if (!prospect || !settings) {
    return [];
  }

  const url = prospect.url;
  const sections: LeadScoreBreakdownSection[] = [];

  const shopifyStatus = normalizeLeadScoreValue(url?.shopifyStatus);
  const shopifyPoints =
    shopifyStatus === "shopify"
      ? settings.shopify.shopify
      : settings.shopify.other;
  const cmsName = String(url?.cmsName || "").trim();
  const normalizedCmsName = normalizeLeadScoreValue(cmsName);
  const knownCms = [
    "wordpress",
    "woocommerce",
    "prestashop",
    "presta shop",
    "magento",
    "wix",
    "squarespace",
    "webflow",
    "framer",
    "bigcommerce",
    "drupal",
    "joomla",
    "opencart",
  ];
  const cmsDetected = knownCms.some((value) => normalizedCmsName.includes(value));
  const cmsPoints = cmsDetected ? settings.shopify.cms : settings.shopify.other;
  const themeStoreType = normalizeLeadScoreValue(url?.shopifyThemeStoreType || null);
  const themeName = normalizeLeadScoreValue(url?.shopifyThemeName || null);
  const themeSchemaName = normalizeLeadScoreValue(url?.shopifyThemeSchemaName || null);
  const themeJson = normalizeLeadScoreValue(url?.shopifyThemeJson || null);
  const isFreeTheme =
    themeStoreType === "free" ||
    FREE_SHOPIFY_THEME_NAMES.has(themeName) ||
    FREE_SHOPIFY_THEME_NAMES.has(themeSchemaName);
  const isCustomTheme =
    themeStoreType === "custom" ||
    !themeName ||
    themeName.includes("custom") ||
    themeSchemaName.includes("custom") ||
    themeJson.includes("custom") ||
    themeJson.includes('theme_store_id":null');
  const themePoints = isFreeTheme
    ? settings.theme.dawn
    : isCustomTheme
      ? settings.theme.custom
      : settings.theme.other;
  const legalNoticePoints =
    shopifyStatus !== "shopify"
      ? 0
      : url?.shopifyLegalNoticeStatus === "found"
        ? settings.legalNotice.found
        : settings.legalNotice.missing;
  const sirenValue = String(prospect.contactSiren || prospect.siren || "").trim();
  const sirenPoints = sirenValue ? settings.siren.found : settings.siren.missing;
  const siteLanguageCode = normalizeLeadScoreValue(
    url?.siteLanguageCode || prospect.url?.siteLanguageCode || null,
  );
  const siteLanguageName = normalizeLeadScoreValue(
    url?.siteLanguageName || prospect.url?.siteLanguageName || null,
  );
  const siteCountryCode = normalizeLeadScoreValue(url?.siteCountryCode || null);
  const languageValue = siteLanguageName || siteLanguageCode || "non trouvée";
  let languagePoints = settings.language.other;
  let languageNote = "La langue du site n’a pas été identifiée.";
  if (siteLanguageCode.startsWith("fr") || siteCountryCode === "fr" || siteCountryCode === "fr-fr") {
    languagePoints = settings.language.french;
    languageNote = "Le site est identifié comme francophone.";
  } else if (
    siteLanguageCode.startsWith("en") ||
    siteCountryCode === "en" ||
    siteCountryCode === "en-us" ||
    siteCountryCode === "en-gb"
  ) {
    languagePoints = settings.language.english;
    languageNote = "Le site est identifié comme anglophone.";
  }
  const companyCountryValue =
    prospect.companyCountry || prospect.contactCompanyCountry || null;
  const companyCountryLabel = String(companyCountryValue || "Non trouvée").trim();
  const normalizedCompanyCountry = normalizeLeadScoreValue(companyCountryValue);
  const companyCountryPoints = !normalizedCompanyCountry
    ? settings.companyCountry.missing
    : normalizedCompanyCountry === "fr" ||
        normalizedCompanyCountry === "france" ||
        normalizedCompanyCountry === "fr-fr"
      ? settings.companyCountry.france
      : settings.companyCountry.other;
  const productCount = Number(url?.productCount || 0);
  let productCountPoints = settings.catalog.productCount.points.none;
  let productCountLabel = "Aucun produit détecté";
  if (Number.isFinite(productCount) && productCount > 0) {
    if (productCount >= settings.catalog.productCount.thresholds.high) {
      productCountPoints = settings.catalog.productCount.points.high;
      productCountLabel = `${productCount} produits ou plus`;
    } else if (productCount >= settings.catalog.productCount.thresholds.medium) {
      productCountPoints = settings.catalog.productCount.points.medium;
      productCountLabel = `${productCount} produits ou plus`;
    } else {
      productCountPoints = settings.catalog.productCount.points.low;
      productCountLabel = `${productCount} produit(s)`;
    }
  }
  const medianProductPrice = Number(url?.medianProductPrice || 0);
  let medianProductPricePoints = settings.catalog.medianProductPrice.points.none;
  let medianProductPriceLabel = "Prix moyen non trouvé";
  if (Number.isFinite(medianProductPrice) && medianProductPrice > 0) {
    if (medianProductPrice >= settings.catalog.medianProductPrice.thresholds.high) {
      medianProductPricePoints = settings.catalog.medianProductPrice.points.high;
      medianProductPriceLabel = `Prix médian >= ${settings.catalog.medianProductPrice.thresholds.high} €`;
    } else if (medianProductPrice >= settings.catalog.medianProductPrice.thresholds.medium) {
      medianProductPricePoints = settings.catalog.medianProductPrice.points.medium;
      medianProductPriceLabel = `Prix médian >= ${settings.catalog.medianProductPrice.thresholds.medium} €`;
    } else if (medianProductPrice >= settings.catalog.medianProductPrice.thresholds.low) {
      medianProductPricePoints = settings.catalog.medianProductPrice.points.low;
      medianProductPriceLabel = `Prix médian >= ${settings.catalog.medianProductPrice.thresholds.low} €`;
    } else {
      medianProductPricePoints = settings.catalog.medianProductPrice.points.none;
      medianProductPriceLabel = `Prix médian < ${settings.catalog.medianProductPrice.thresholds.low} €`;
    }
  }

  const lighthouseScores = [
    url?.lighthousePerformanceScore,
    url?.lighthouseAccessibilityScore,
    url?.lighthouseBestPracticesScore,
    url?.lighthouseSeoScore,
  ].filter((value): value is number => Number.isFinite(Number(value)));

  let lighthousePoints = 0;
  let lighthouseValue = "Aucun score Lighthouse disponible";
  let lighthouseNote = "Lighthouse n’a pas encore été exécuté.";

  if (lighthouseScores.length > 0) {
    const average =
      lighthouseScores.reduce((sum, value) => sum + Number(value || 0), 0) /
      lighthouseScores.length;

    if (average >= settings.lighthouse.thresholds.excellent) {
      lighthousePoints = settings.lighthouse.points.excellent;
      lighthouseNote = `Moyenne de ${average.toFixed(1)} / 100, au-dessus du seuil excellent.`;
    } else if (average >= settings.lighthouse.thresholds.good) {
      lighthousePoints = settings.lighthouse.points.good;
      lighthouseNote = `Moyenne de ${average.toFixed(1)} / 100, au-dessus du seuil bon.`;
    } else if (average >= settings.lighthouse.thresholds.average) {
      lighthousePoints = settings.lighthouse.points.average;
      lighthouseNote = `Moyenne de ${average.toFixed(1)} / 100, au-dessus du seuil moyen.`;
    } else if (average >= settings.lighthouse.thresholds.poor) {
      lighthousePoints = settings.lighthouse.points.poor;
      lighthouseNote = `Moyenne de ${average.toFixed(1)} / 100, sous le seuil correct.`;
    } else {
      lighthousePoints = settings.lighthouse.points.critical;
      lighthouseNote = `Moyenne de ${average.toFixed(1)} / 100, score critique.`;
    }

    lighthouseValue = `Moyenne ${average.toFixed(1)} / 100`;
  }

  sections.push({
    label: "Plateforme",
    total: shopifyPoints + cmsPoints + themePoints + legalNoticePoints,
    rows: [
      {
        label: "Shopify",
        value:
          shopifyStatus === "shopify"
            ? "Site Shopify détecté"
            : shopifyStatus === "error"
              ? "Erreur de détection"
              : "Site non Shopify",
        points: shopifyPoints,
        note:
          shopifyStatus === "shopify"
            ? "Le site a bien été reconnu comme Shopify."
            : "Le site n’a pas été reconnu comme Shopify.",
      },
      {
        label: "CMS",
        value: cmsDetected ? cmsName || "CMS détecté" : "CMS non identifié",
        points: cmsPoints,
        note: cmsDetected
          ? `CMS identifié: ${cmsName}.`
          : "Aucun CMS connu n’a été détecté.",
      },
      {
        label: "Thème",
        value: isFreeTheme
          ? "Thème gratuit Shopify"
          : isCustomTheme
            ? "Thème hors store Shopify"
            : "Autre thème Shopify",
        points: themePoints,
        note: isFreeTheme
          ? "Le thème est classé comme thème gratuit Shopify."
          : isCustomTheme
            ? "Le thème est classé comme thème personnalisé."
            : "Le thème est classé comme autre thème du store Shopify.",
      },
      {
        label: "Mentions légales",
        value:
          shopifyStatus !== "shopify"
            ? "Non applicable sur un site non Shopify"
            : url?.shopifyLegalNoticeStatus === "found"
              ? "Page trouvée"
              : "Page manquante",
        points: legalNoticePoints,
        note:
          shopifyStatus !== "shopify"
            ? "Cette règle ne s’applique qu’aux sites Shopify."
            : url?.shopifyLegalNoticeStatus === "found"
              ? "La page de mentions légales est présente."
              : "La page de mentions légales est absente ou non validée.",
      },
    ],
  });

  sections.push({
    label: "Contact",
    total: sirenPoints,
    rows: [
      {
        label: "SIREN",
        value: sirenValue || "Non trouvé",
        points: sirenPoints,
        note: sirenValue
          ? "Un SIREN a été trouvé sur le site ou via l’enrichissement."
          : "Aucun SIREN n’a pu être identifié.",
      },
    ],
  });

  sections.push({
    label: "Langue & pays",
    total: languagePoints + companyCountryPoints,
    rows: [
      {
        label: "Langue du site",
        value: languageValue,
        points: languagePoints,
        note: languageNote,
      },
      {
        label: "Pays de l’entreprise",
        value: companyCountryLabel,
        points: companyCountryPoints,
        note: !normalizedCompanyCountry
          ? "Le pays de l’entreprise n’a pas été trouvé."
          : normalizedCompanyCountry === "fr" ||
              normalizedCompanyCountry === "france" ||
              normalizedCompanyCountry === "fr-fr"
            ? "L’entreprise est localisée en France."
            : "L’entreprise n’est pas localisée en France.",
      },
    ],
  });

  sections.push({
    label: "Catalogue",
    total: productCountPoints + medianProductPricePoints,
    rows: [
      {
        label: "Nombre de produits",
        value: productCountLabel,
        points: productCountPoints,
        note:
          Number.isFinite(productCount) && productCount > 0
            ? `Catalogue de ${productCount} produit(s).`
            : "Aucun catalogue produit exploitable n’a été trouvé.",
      },
      {
        label: "Prix médian des produits",
        value: medianProductPriceLabel,
        points: medianProductPricePoints,
        note:
          Number.isFinite(medianProductPrice) && medianProductPrice > 0
            ? `Prix médian détecté: ${medianProductPrice} €.`
            : "Prix médian non exploitable ou absent.",
      },
    ],
  });

  sections.push({
    label: "Performance",
    total: lighthousePoints,
    rows: [
      {
        label: "Lighthouse",
        value: lighthouseValue,
        points: lighthousePoints,
        note: lighthouseNote,
      },
    ],
  });

  return sections;
}

type ProspectDetailTableRow = {
  label: string;
  value: unknown;
  section?: boolean;
};

type ProspectDetailTableSection = {
  label: string;
  rows: Array<{
    label: string;
    value: unknown;
  }>;
};

const formatTableValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }

  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "—";
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "—";
    }
  }

  return String(value);
};

const rows = computed<ProspectDetailTableRow[]>(() => {
  const prospect = data.value;
  if (!prospect) {
    return [];
  }

  const rows: ProspectDetailTableRow[] = [];
  const addSection = (label: string) => {
    rows.push({ label, value: "", section: true });
  };
  const add = (label: string, value: unknown) => {
    rows.push({ label, value });
  };

  addSection("Prospect");
  add("ID", prospect.id);
  add("URL liée", prospect.urlId);
  add("Nom", prospect.name);
  add("Site", prospect.siteName);
  add("Statut", prospect.status);
  add("Score", prospect.score);
  add("Lead score", prospect.leadScore);
  add("Email", prospect.email);
  add("Téléphone", prospect.phone);
  add("LinkedIn", prospect.linkedinUrl);
  add("Image LinkedIn", prospect.linkedinImageUrl);
  add("Avatar", prospect.avatarUrl);
  add("Propriétaire", prospect.owner);
  add("Prénom", prospect.firstName);
  add("Source URL", prospect.sourceUrl);
  add("Fichier source", prospect.sourceFile);
  add("Dernière vérification", prospect.lastChecked);
  add("Indice", prospect.evidence);
  add("Email de prise de contact - objet", prospect.firstContactEmailSubject);
  add("Email de prise de contact - corps", prospect.firstContactEmailBody);
  add("Mail de prise de contact en file", prospect.firstContactEmailQueuedAt);
  add("Mail de prise de contact envoyé", prospect.firstContactEmailSentAt);
  add("Devis", prospect.quoteFileName);
  add("Devis envoyé", prospect.quoteSentAt);
  add("Contrat", prospect.contractFileName);
  add("Contrat envoyé", prospect.contractSentAt);
  add("Contrat signé", prospect.contractSignedAt);
  add("Créé le", prospect.createdAt);
  add("Modifié le", prospect.updatedAt);
  add("Mis à la corbeille", prospect.trashedAt);

  addSection("Site");
  add("URL", prospect.url?.url);
  add("Nom du site", prospect.url?.siteName);
  add("Site key", prospect.url?.siteKey);
  add("Fichier source site", prospect.url?.sourceFile);
  add("Créé le", prospect.url?.createdAt);
  add("Shopify", prospect.url?.shopifyStatus);
  add("Shopify vérifié le", prospect.url?.shopifyCheckedAt);
  add("HTTP status", prospect.url?.httpStatus);
  add("CMS", prospect.url?.cmsName);
  add(
    "Type de thème",
    prospect.url?.shopifyThemeStoreType === "free"
      ? "Gratuit Shopify"
      : prospect.url?.shopifyThemeStoreType === "paid"
        ? "Payant Shopify"
        : prospect.url?.shopifyThemeStoreType === "custom"
          ? "Hors store Shopify"
          : null,
  );
  add("Pays du site - code", prospect.url?.siteCountryCode);
  add("Pays du site - nom", prospect.url?.siteCountryName);
  add("Thème Shopify", prospect.url?.shopifyThemeName);
  add("Thème Shopify ID", prospect.url?.shopifyThemeId);
  add("Thème Shopify schema", prospect.url?.shopifyThemeSchemaName);
  add("Thème Shopify JSON", prospect.url?.shopifyThemeJson);
  add("Rescan demandé le", prospect.url?.rescanRequestedAt);
  add("Redesign status", prospect.url?.redesignStatus);
  add("Décision positionnement", prospect.url?.redesignDecision);
  add("Mentions légales Shopify", prospect.url?.shopifyLegalNoticeStatus);
  add("Mentions légales URL", prospect.url?.shopifyLegalNoticeUrl);
  add(
    "Mentions légales vérifiées le",
    prospect.url?.shopifyLegalNoticeCheckedAt,
  );
  add("Contact status", prospect.url?.contactStatus);
  add("Contact vérifié le", prospect.url?.contactCheckedAt);
  add("Contact email", prospect.contactEmail);
  add("Contact téléphone", prospect.contactPhone);
  add("Contact SIRET", prospect.contactSiret);
  add("Contact SIREN", prospect.contactSiren);
  add("Contact prénom", prospect.contactFirstName);
  add("Contact nom", prospect.contactLastName);
  add("Contact owner", prospect.contactOwnerName);
  add("Contact company", prospect.contactCompanyName);
  add("Contact source URL", prospect.contactSourceUrl);
  add("Contact evidence", prospect.contactEvidence);
  add("Contact LinkedIn", prospect.contactLinkedinUrl);
  add("Contact company LinkedIn", prospect.contactCompanyLinkedinUrl);
  add("Contact social links", prospect.contactSocialLinksJson);
  add("Mis à la corbeille le", prospect.url?.trashedAt);
  add("Blacklisted le", prospect.url?.blacklistedAt);
  add("TTFB", prospect.url?.scanTtfbMs);
  add("Temps total", prospect.url?.scanTotalMs);
  add("Temps Shopify", prospect.url?.scanShopifyMs);
  add("Temps CMS", prospect.url?.scanCmsDetectionMs);
  add("Temps langue", prospect.url?.scanLanguageMs);
  add("Temps SEO meta", prospect.url?.scanSeoMetaMs);
  add("Temps mentions légales", prospect.url?.scanLegalNoticeMs);
  add("Temps catalogue", prospect.url?.scanCatalogMs);
  add("Temps contact", prospect.url?.scanContactMs);
  add("Temps LinkedIn", prospect.url?.scanLinkedinMs);
  add("Temps autres réseaux", prospect.url?.scanSocialMs);
  add("Temps technique", prospect.url?.scanTechnicalMs);
  add("Temps Lighthouse", prospect.url?.scanLighthouseMs);
  add("Temps total workflow", prospect.url?.scanWorkflowTotalMs);
  add("Poids HTML", prospect.url?.scanHtmlBytes);
  add("Nombre de produits", prospect.url?.productCount);
  add(
    "Prix médian produits",
    prospect.url?.medianProductPrice != null
      ? `${prospect.url.medianProductPrice} €`
      : null,
  );
  add("Carte cadeau détectée", prospect.url?.giftCardDetected);
  add("Lighthouse date", prospect.url?.lighthouseCheckedAt);
  add("Lighthouse score", prospect.url?.lighthouseScore);
  add("Lighthouse performance", prospect.url?.lighthousePerformanceScore);
  add("Lighthouse accessibilité", prospect.url?.lighthouseAccessibilityScore);
  add(
    "Lighthouse bonnes pratiques",
    prospect.url?.lighthouseBestPracticesScore,
  );
  add("Lighthouse SEO", prospect.url?.lighthouseSeoScore);
  add("Lighthouse observations", prospect.url?.lighthouseObservationsJson);
  add("Lighthouse report", prospect.url?.lighthouseReportJson);

  addSection("Qualification calculée");
  add("Positionnement CRM", crmPositioningLabel.value);
  add(
    "Qualification",
    formatQualificationPositioning(
      prospect.url?.qualification?.positioning || null,
    ),
  );
  add("Raison d’abandon", prospect.url?.qualification?.abandonReason || "—");
  add(
    "Erreur principale",
    prospect.url?.qualification?.mainObservation?.title || "—",
  );
  add(
    "Nombre d’observations",
    prospect.url?.qualification?.observations?.length ?? 0,
  );

  return rows;
});

const tableSections = computed<ProspectDetailTableSection[]>(() => {
  const sectionList: ProspectDetailTableSection[] = [];
  let currentSection: ProspectDetailTableSection | null = null;

  for (const row of rows.value) {
    if (row.section) {
      currentSection = { label: row.label, rows: [] };
      sectionList.push(currentSection);
      continue;
    }

    if (!currentSection) {
      continue;
    }

    currentSection.rows.push({
      label: row.label,
      value: row.value,
    });
  }

  return sectionList;
});

const leadScoreBreakdownSections = computed(() =>
  buildLeadScoreBreakdownSections(data.value, leadScoreSettings.value),
);

const leadScoreBreakdownTotal = computed(() =>
  leadScoreBreakdownSections.value.reduce(
    (sum, section) => sum + Number(section.total || 0),
    0,
  ),
);

const expandedTableSections = ref<string[]>([]);

watch(
  tableSections,
  (sections) => {
    const sectionLabels = sections.map((section) => section.label);

    if (expandedTableSections.value.length === 0) {
      expandedTableSections.value = [...sectionLabels];
      return;
    }

    expandedTableSections.value = expandedTableSections.value.filter((label) =>
      sectionLabels.includes(label),
    );
  },
  { immediate: true },
);

function toggleTableSection(label: string) {
  if (expandedTableSections.value.includes(label)) {
    expandedTableSections.value = expandedTableSections.value.filter(
      (item) => item !== label,
    );
    return;
  }

  expandedTableSections.value = [...expandedTableSections.value, label];
}

function isTableSectionExpanded(label: string) {
  return expandedTableSections.value.includes(label);
}
</script>

<template>
  <main class="min-h-screen bg-background text-slate-900">
    <section class="w-full px-5 py-6 lg:px-8">
      <div class="w-full flex justify-between">
        <div class="flex flex-col gap-3">
          <p
            class="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-700"
          >
            Prospection Magify
          </p>
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 class="page-title">Fiche prospect</h1>
              <div class="flex gap-3">
                <div
                  class="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900"
                >
                  <UIcon name="i-lucide-globe-2" class="h-4 w-4 shrink-0" />
                  <span class="truncate">
                    {{ data?.siteName || "Site non renseigné" }}
                  </span>
                </div>
                <div
                class="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-900"
                >
                <UIcon v-if="isShopify(data)" name="i-simple-icons-shopify" class="h-4 w-4 shrink-0" />
                  <span class="truncate">
                    {{ getShopifyLabel(data) }}
                  </span>
                </div>
              </div>
              <p class="mt-2 body-muted">
                Vue détaillée des informations enregistrées en base.
              </p>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <UButton
            :to="previousProspectId ? `/prospects/${previousProspectId}` : undefined"
            color="neutral"
            variant="outline"
            icon="i-lucide-chevron-left"
            :disabled="!previousProspectId"
          >
            Précédent
          </UButton>
          <UButton
            :to="nextProspectId ? `/prospects/${nextProspectId}` : undefined"
            color="neutral"
            variant="outline"
            trailing-icon="i-lucide-chevron-right"
            :disabled="!nextProspectId"
          >
            Suivant
          </UButton>
          <UButton
            to="/prospects"
            color="neutral"
            variant="outline"
            icon="i-lucide-arrow-left"
            class="justify-start"
          >
            Tout les prospects
          </UButton>
        </div>
      </div>
    </section>

    <div class="grid gap-6 px-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-8">
      <section class="w-full pb-6">
        <div
          v-if="pending"
          class="rounded-lg border border-slate-200 bg-white px-6 py-12 text-muted-sm"
        >
          Chargement du prospect...
        </div>

        <div
          v-else-if="error"
          class="rounded-lg border border-red-200 bg-white px-6 py-12 text-xs text-red-600"
        >
          Impossible de charger ce prospect.
        </div>

        <div v-else-if="data" class="space-y-8">
          <div
            class="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
          >
            <div class="flex flex-wrap gap-2">
              <button
                v-for="tab in prospectTabs"
                :key="tab.key"
                type="button"
                class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition"
                :class="
                  activeProspectTab === tab.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                "
                @click="activeProspectTab = tab.key"
              >
                <UIcon :name="tab.icon" class="size-4 shrink-0" />
                {{ tab.label }}
              </button>
            </div>
          </div>

          <div
            v-show="activeProspectTab === 'edit'"
            class="rounded-2xl border-2 bg-white p-6 shadow-sm ring-2 ring-transparent transition-all duration-300"
            :class="
              editSaveFeedbackState !== 'idle'
                ? 'border-emerald-500 bg-emerald-50/80 ring-emerald-300 shadow-lg shadow-emerald-200/70'
                : 'border-slate-200 bg-white ring-transparent'
            "
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div
                  class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                >
                  Edition rapide
                </div>
                <h2 class="mt-1 text-lg font-semibold text-slate-900">
                  Modifier la fiche contact
                </h2>
                <p class="mt-1 text-muted-sm">
                  Mets à jour les champs principaux du prospect sans ouvrir la
                  table complète.
                </p>
              </div>

              <div class="flex-1 flex flex-wrap justify-end items-center gap-3">
                <p
                  v-if="editSaveFeedbackState !== 'idle'"
                  class="text-xs font-medium text-emerald-600 transition-all duration-300"
                  :class="
                    editSaveFeedbackState === 'visible'
                      ? 'translate-x-0 opacity-100'
                      : 'translate-x-1 opacity-0'
                  "
                >
                  Modifications enregistrées.
                </p>
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-save"
                  :loading="saveState === 'saving'"
                  :disabled="saveState === 'saving' || !hasEditFormChanges"
                  @click="saveProspectDetails"
                >
                  Enregistrer
                </UButton>
                <UButton
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-refresh-cw"
                  :loading="autoUpdatingContact"
                  :disabled="autoUpdatingContact || !data?.urlId"
                  @click="updateContactAutomatically"
                >
                  Mettre à jour automatiquement
                </UButton>
              </div>
            </div>

            <div class="mt-6 space-y-8">
              <section class="space-y-4">
                <div>
                  <p
                    class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                  >
                    Infos client
                  </p>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                  <UFormField label="Nom" class="space-y-1">
                    <UInput
                      v-model="editForm.lastName"
                      placeholder="Nom"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField label="Prénom" class="space-y-1">
                    <UInput
                      v-model="editForm.firstName"
                      placeholder="Prénom"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField label="Email" class="space-y-1">
                    <UInput
                      v-model="editForm.email"
                      type="email"
                      placeholder="Email"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField label="Téléphone" class="space-y-1">
                    <UInput
                      v-model="editForm.phone"
                      placeholder="Téléphone"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField label="Owner name" class="space-y-1 md:col-span-2">
                    <UInput
              v-model="editForm.ownerName"
                      placeholder="Owner name"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>
                </div>
              </section>

              <section class="space-y-4">
                <div>
                  <p
                    class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                  >
                    Infos entreprise
                  </p>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                  <UFormField
                    label="Nom de l'entreprise"
                    class="space-y-1 md:col-span-2"
                  >
                    <UInput
                      v-model="editForm.companyName"
                      placeholder="Nom de l'entreprise"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField label="SIREN" class="space-y-1">
                    <UInput
                      v-model="editForm.siren"
                      placeholder="SIREN"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField label="Forme juridique" class="space-y-1">
                    <UInput
                      v-model="editForm.companyLegalForm"
                      placeholder="Forme juridique"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField label="Adresse" class="space-y-1 md:col-span-2">
                    <UInput
                      v-model="editForm.companyAddress"
                      placeholder="Adresse"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField
                    label="Complément d'adresse"
                    class="space-y-1 md:col-span-2"
                  >
                    <UInput
                      v-model="editForm.companyAddressExtra"
                      placeholder="Complément d'adresse"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField label="Code postal" class="space-y-1">
                    <UInput
                      v-model="editForm.companyPostalCode"
                      placeholder="Code postal"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField label="Ville" class="space-y-1">
                    <UInput
                      v-model="editForm.companyCity"
                      placeholder="Ville"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField label="Pays" class="space-y-1 md:col-span-2">
                    <UInput
                      v-model="editForm.companyCountry"
                      placeholder="Pays"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>
                </div>
              </section>

              <section class="space-y-4">
                <div>
                  <p
                    class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                  >
                    Infos site
                  </p>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                  <UFormField
                    label="Nom du site"
                    class="space-y-1 md:col-span-2"
                  >
                    <UInput
                      v-model="editForm.siteName"
                      placeholder="Nom du site"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField
                    label="URL mentions légales"
                    class="space-y-1 md:col-span-2"
                  >
                    <UInput
                      v-model="editForm.shopifyLegalNoticeUrl"
                      placeholder="URL mentions légales"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>

                  <UFormField
                    label="Langue du site"
                    class="space-y-1 md:col-span-2"
                  >
                    <USelect
                      v-model="editForm.siteLanguageCode"
                      :items="siteLanguageOptions"
                      value-attribute="value"
                      option-attribute="label"
                      color="neutral"
                      class="w-full min-w-0 rounded-xl bg-white"
                      trailing-icon="i-lucide-chevron-down"
                      :content="{
                        class:
                          'z-50 max-h-60 w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-200',
                      }"
                      :ui="{
                        base: 'bg-white dark:bg-white',
                        value: 'truncate min-w-0 pointer-events-none pr-8',
                        placeholder:
                          'truncate min-w-0 pointer-events-none pr-8 text-slate-400',
                        trailing:
                          'absolute inset-y-0 end-0 flex items-center pe-3',
                        trailingIcon: 'shrink-0 text-slate-400',
                        item: 'p-2 text-xs text-slate-700',
                        itemLabel: 'truncate text-slate-700',
                        itemDescription: 'truncate text-slate-500',
                        label:
                          'p-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
                      }"
                      placeholder="Choisir la langue du site"
                    />
                  </UFormField>
                </div>
              </section>

              <section class="space-y-4">
                <div>
                  <p
                    class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                  >
                    Documents
                  </p>
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                  <div id="quote">
                    <UFormField label="Devis" class="space-y-1">
                      <UInput
                        v-model="editForm.quoteFileName"
                        placeholder="Nom du devis"
                        class="w-full min-w-0 rounded-xl bg-white"
                      />
                    </UFormField>
                  </div>

                  <div>
                    <UFormField label="Devis envoyé" class="space-y-2">
                      <label
                        class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <input
                          v-model="editForm.quoteSent"
                          type="checkbox"
                          class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span class="text-xs text-slate-700">
                          Le devis a été envoyé
                        </span>
                      </label>
                    </UFormField>
                  </div>

                  <div id="contract">
                    <UFormField label="Contrat" class="space-y-1">
                      <UInput
                        v-model="editForm.contractFileName"
                        placeholder="Nom du contrat"
                        class="w-full min-w-0 rounded-xl bg-white"
                      />
                    </UFormField>
                  </div>

                  <div>
                    <UFormField label="Contrat envoyé" class="space-y-2">
                      <label
                        class="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <input
                          v-model="editForm.contractSent"
                          type="checkbox"
                          class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span class="text-xs text-slate-700">
                          Le contrat a été envoyé
                        </span>
                      </label>
                    </UFormField>
                  </div>
                </div>
              </section>
            </div>

            <p v-if="saveState === 'error'" class="mt-4 text-xs text-red-600">
              {{ saveError || "Impossible d’enregistrer les modifications." }}
            </p>
          </div>

          <div
            v-show="activeProspectTab === 'checklist'"
            class="rounded-2xl border bg-white p-6 shadow-sm transition-colors duration-300"
            :class="
              saveState === 'saved'
                ? 'border-emerald-300 shadow-emerald-100/60'
                : 'border-slate-200'
            "
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div
                  class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                >
                  Checklist site
                </div>
                <h2 class="mt-1 text-lg font-semibold text-slate-900">
                  Vérifications rapides à faire avant le positionnement
                </h2>
                <p class="mt-1 text-xs leading-6 text-slate-500">
                  Coche ce qui a déjà été vérifié pour garder une vue claire
                  avant de qualifier le prospect.
                </p>
              </div>

              <UButton
                v-if="siteObservations.length"
                color="neutral"
                variant="soft"
                class="sticky top-32 z-20 shrink-0 self-start"
                icon="i-lucide-eye"
                @click="activeProspectTab = 'observations'"
              >
                {{ siteObservations.length }} observation{{
                  siteObservations.length > 1 ? "s" : ""
                }}
              </UButton>
            </div>

            <div class="mt-5 space-y-6">
              <div
                v-for="section in verificationChecklistSections"
                :key="section.key"
                class="space-y-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {{ section.title }}
                  </div>
                </div>

                <div class="space-y-3">
                  <div
                    v-for="item in section.items"
                    :key="item.key"
                    class="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <template v-if="item.key === 'legalNotice'">
                      <div class="flex items-start gap-4">
                        <UCheckbox
                          :model-value="verificationChecklist.legalNotice"
                          @click="clearLegalNoticeChecklistStatus"
                          :ui="{ base: 'mt-1 shrink-0' }"
                        />

                        <div class="min-w-0 flex-1">
                          <div
                            class="truncate text-xs font-semibold text-slate-900"
                            :title="item.label"
                          >
                            {{ item.label }}
                          </div>
                          <p
                            class="mt-1 truncate text-xs leading-6 text-slate-500"
                            :title="item.description"
                          >
                            {{ item.description }}

                            <span
                              class="ml-2 cursor-pointer text-xs font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800"
                              @click="openLegalNoticePage"
                            >
                              Ouvrir la page
                            </span>
                          </p>

                          <div class="mt-3 flex flex-wrap items-center gap-2">
                            <UBadge
                              v-if="verificationChecklist.legalNoticeStatus"
                              color="primary"
                              variant="soft"
                            >
                              Choix enregistré ({{
                                verificationChecklist.legalNoticeStatus === 'valid'
                                  ? 'valide'
                                  : verificationChecklist.legalNoticeStatus === 'invalid'
                                    ? 'non valide'
                                    : 'manquante'
                              }})
                            </UBadge>
                            <p v-else class="flex gap-2 items-center">
                              <span class="mt-1 truncate text-xs leading-6 text-slate-500">La page est ?</span>
                              <UButton
                                size="xs"
                                color="success"
                                :variant="
                                  verificationChecklist.legalNoticeStatus === 'valid'
                                    ? 'solid'
                                    : 'soft'
                                "
                                @click="setLegalNoticeChecklistStatus('valid')"
                              >
                                valide
                              </UButton>
                              <UButton
                                size="xs"
                                color="warning"
                                :variant="
                                  verificationChecklist.legalNoticeStatus === 'invalid'
                                    ? 'solid'
                                    : 'soft'
                                "
                                @click="setLegalNoticeChecklistStatus('invalid')"
                              >
                                non valide
                              </UButton>
                              <UButton
                                size="xs"
                                color="error"
                                :variant="
                                  verificationChecklist.legalNoticeStatus === 'missing'
                                    ? 'solid'
                                    : 'soft'
                                "
                                @click="setLegalNoticeChecklistStatus('missing')"
                              >
                                manquante
                              </UButton>
                            </p>
                          </div>
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <div class="flex items-start gap-4">
                        <UCheckbox
                          :model-value="Boolean(getBinaryChecklistStatus(item))"
                          @click="clearBinaryChecklistStatus(item)"
                          :ui="{ base: 'mt-1 shrink-0' }"
                        />

                        <div class="min-w-0 flex-1">
                          <div
                            class="truncate text-xs font-semibold text-slate-900"
                            :title="item.label"
                          >
                            {{ item.label }}
                          </div>
                          <p
                            class="mt-1 truncate text-xs leading-6 text-slate-500"
                            :title="item.description"
                          >
                            {{ item.description }}
                          </p>

                          <div class="mt-3 flex flex-wrap items-center gap-2">
                            <UBadge
                              v-if="getBinaryChecklistStatus(item)"
                              color="primary"
                              variant="soft"
                            >
                              Choix enregistré ({{
                                getBinaryChecklistBadgeChoice(item, getBinaryChecklistStatus(item))
                              }})
                            </UBadge>
                            <p v-else class="flex flex-wrap items-center gap-2">
                              <span class="text-xs leading-6 text-slate-500">
                                {{ item.question }}
                              </span>
                              <UButton
                                size="xs"
                                color="success"
                                :variant="
                                  getBinaryChecklistStatus(item) === 'valid'
                                    ? 'solid'
                                    : 'soft'
                                "
                                @click="setBinaryChecklistStatus(item, 'valid')"
                              >
                                {{ getBinaryChecklistButtonLabel(item, 'valid') }}
                              </UButton>
                              <UButton
                                size="xs"
                                color="error"
                                :variant="
                                  getBinaryChecklistStatus(item) === 'invalid'
                                    ? 'solid'
                                    : 'soft'
                                "
                                @click="setBinaryChecklistStatus(item, 'invalid')"
                              >
                                {{ getBinaryChecklistButtonLabel(item, 'invalid') }}
                              </UButton>
                            </p>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            v-show="activeProspectTab === 'positioning'"
            class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div
                  class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                >
                  Positionnement
                </div>
                <h2 class="mt-1 text-lg font-semibold text-slate-900">
                  Qualifier le prospect
                </h2>
                <p v-if="false" class="mt-1 text-muted-sm">
                  Le CRM propose un point de départ, puis tu peux enregistrer le
                  vrai positionnement, les observations du site et la décision
                  finale.
                </p>
              </div>

              <div class="flex flex-wrap gap-2">
                <UButton
                  v-if="data?.sourceUrl || data?.url?.url"
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-external-link"
                  @click="openSitePreview"
                >
                  Voir le site
                </UButton>
                <UButton
                  color="primary"
                  variant="solid"
                  icon="i-lucide-check"
                  :loading="positioningSaving"
                  :disabled="!data.urlId || positioningSaving"
                  @click="saveQualification()"
                >
                  Enregistrer la qualification
                </UButton>
              </div>
            </div>

            <div
              class="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]"
            >
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div
                  class="text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  Proposition CRM
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span
                    class="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                  >
                    <UIcon name="i-lucide-sparkles" class="h-3.5 w-3.5" />
                    {{ crmPositioningLabel }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                  >
                    <UIcon name="i-lucide-badge-check" class="h-3.5 w-3.5" />
                    Décision: {{ positioningDecisionLabel }}
                  </span>
                  <span
                    class="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                  >
                    <UIcon name="i-lucide-link" class="h-3.5 w-3.5" />
                    {{ data.url?.redesignStatus || "Aucun signal" }}
                  </span>
                </div>
                <div class="mt-3">
                  <div
                    class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Raisons détectées
                  </div>
                  <ul class="mt-2 space-y-2 body-muted">
                    <li
                      v-for="(reason, index) in crmReasonItems"
                      :key="`${index}-${reason}`"
                      class="flex gap-2"
                    >
                      <UIcon
                        name="i-lucide-arrow-right"
                        class="mt-1 size-4 shrink-0 text-sky-500"
                      />
                      <span class="min-w-0">{{ reason }}</span>
                    </li>
                  </ul>
                </div>

                <div class="mt-5">
                  <div
                    class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Infos clés
                  </div>
                  <ul class="mt-2 space-y-2 body-muted">
                    <li
                      v-for="(item, index) in crmKeyInfoItems"
                      :key="`${index}-${item}`"
                      class="flex gap-2"
                    >
                      <UIcon
                        name="i-lucide-info"
                        class="mt-1 size-4 shrink-0 text-sky-500"
                      />
                      <span class="min-w-0">{{ item }}</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div class="rounded-xl border border-slate-200 bg-white p-4">
                <UFormField label="Positionnement à valider" class="space-y-1">
                  <USelect
                    v-model="positioningChoice"
                    :items="positioningOptions"
                    value-attribute="value"
                    option-attribute="label"
                    color="neutral"
                    class="w-full min-w-0 rounded-xl bg-white"
                    trailing-icon="i-lucide-chevron-down"
                    :content="{
                      class:
                        'z-50 max-h-60 w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-200',
                    }"
                    :ui="{
                      base: 'bg-white dark:bg-white',
                      value: 'truncate min-w-0 pointer-events-none pr-8',
                      placeholder:
                        'truncate min-w-0 pointer-events-none pr-8 text-slate-400',
                      trailing:
                        'absolute inset-y-0 end-0 flex items-center pe-3',
                      trailingIcon: 'shrink-0 text-slate-400',
                      item: 'p-2 text-xs text-slate-700',
                      itemLabel: 'truncate text-slate-700',
                      itemDescription: 'truncate text-slate-500',
                      label:
                        'p-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    }"
                    placeholder="Choisir un positionnement"
                  />
                </UFormField>

                <p class="mt-3 text-xs leading-6 text-slate-500">
                  {{ positioningLabel }}
                </p>

                <div v-if="positioningChoice === 'abandon'" class="mt-4">
                  <UFormField label="Raison d’abandon" class="space-y-1">
                    <UTextarea
                      v-model="abandonReason"
                      placeholder="Exemple: le prospect n’est pas qualifié."
                      :rows="4"
                      class="w-full min-w-0 rounded-xl bg-white"
                    />
                  </UFormField>
                </div>

                <div
                  v-else-if="positioningChoice === 'support-with-error'"
                  class="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900"
                >
                  Tu peux relier une erreur principale à mettre en avant dans
                  les emails.
                </div>

                <div
                  v-else
                  class="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 body-muted"
                >
                  La qualification peut rester sans observation. Si tu repères
                  un problème plus tard, tu peux quand même le renseigner dans
                  la liste ci-dessous.
                </div>
              </div>
            </div>
          </div>

          <div
            v-show="activeProspectTab === 'observations'"
            class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div
                  class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                >
                  Observations
                </div>
                <h2 class="mt-1 text-lg font-semibold text-slate-900">
                  Lister ce que tu as repéré
                </h2>
                <p v-if="false" class="mt-1 text-muted-sm">
                  Tu peux y noter des erreurs, des remarques de performance, des
                  points d’amélioration ou tout autre signal utile pour la
                  qualification.
                </p>
              </div>

              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-plus"
                @click="addObservation"
              >
                Ajouter une observation
              </UButton>
            </div>

            <div v-if="siteObservations.length" class="mt-4 space-y-3">
              <div
                v-for="(observation, index) in siteObservations"
                :key="observation.key"
                class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div class="flex items-start justify-between gap-4 px-4 py-3">
                  <button
                    type="button"
                    class="flex min-w-0 flex-1 items-start gap-3 text-left transition hover:opacity-90"
                    @click="toggleObservation(observation.key)"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <!-- Observation {{ index + 1 }} -->
                        <UBadge variant="soft">{{ index + 1 }}</UBadge>
                        <div class="text-xs font-semibold text-slate-900">
                          {{ observation.title || "Sans titre pour le moment" }}
                        </div>
                        <!-- <UBadge color="neutral" variant="soft">
                          {{
                            severityOptions.find(
                              (item) => item.value === observation.severity,
                            )?.label || observation.severity
                          }}
                        </UBadge> -->
                      </div>
                      <!-- <div class="mt-1 truncate text-xs text-slate-600">
                        {{ observation.title || "Sans titre pour le moment" }}
                      </div> -->
                    </div>

                    <UIcon
                      name="i-lucide-chevron-down"
                      class="size-5 shrink-0 self-center text-slate-400 transition-transform"
                      :class="
                        isObservationExpanded(observation.key)
                          ? 'rotate-180'
                          : ''
                      "
                    />
                  </button>

                  <UButton
                    color="red"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-x"
                    @click.stop="removeObservation(index)"
                  >
                    Retirer
                  </UButton>
                </div>

                <div
                  v-show="isObservationExpanded(observation.key)"
                  class="border-t border-slate-200 p-4"
                >
                  <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                    <UFormField label="Titre" class="space-y-1">
                      <UInput
                        v-model="observation.title"
                        placeholder="Exemple: Un header trop lourd"
                        class="w-full min-w-0 rounded-xl bg-white"
                        @focus="focusObservationTitleInput(observation.key)"
                        @blur="blurObservationTitleInput(observation.key)"
                      />
                      <ObservationTitleSuggestions
                        v-if="
                          focusedObservationTitleKey === observation.key
                        "
                        :query="observation.title"
                        @select="
                          applyObservationTitleSuggestion(observation, $event)
                        "
                      />
                    </UFormField>

                    <UFormField label="Sévérité" class="space-y-1">
                      <USelect
                        v-model="observation.severity"
                        :items="severityOptions"
                        value-attribute="value"
                        option-attribute="label"
                        color="neutral"
                        class="w-full min-w-0 rounded-xl bg-white"
                        trailing-icon="i-lucide-chevron-down"
                        :content="{
                          class:
                            'z-50 max-h-60 w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-200',
                        }"
                        :ui="{
                          base: 'bg-white dark:bg-white',
                          value: 'truncate min-w-0 pointer-events-none pr-8',
                          placeholder:
                            'truncate min-w-0 pointer-events-none pr-8 text-slate-400',
                          trailing:
                            'absolute inset-y-0 end-0 flex items-center pe-3',
                          trailingIcon: 'shrink-0 text-slate-400',
                          item: 'p-2 text-xs text-slate-700',
                          itemLabel: 'truncate text-slate-700',
                          itemDescription: 'truncate text-slate-500',
                          label:
                            'p-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
                        }"
                      />
                    </UFormField>

                    <UFormField label="Détail" class="space-y-1">
                      <UTextarea
                        v-model="observation.detail"
                        placeholder="Explique ce que tu as observé"
                        :rows="3"
                        class="w-full min-w-0 rounded-xl bg-white"
                      />
                    </UFormField>
                  </div>
                </div>
              </div>
            </div>

            <div
              v-else
              class="mt-4 rounded-xl border border-dashed border-slate-300/50 bg-white px-4 py-6 text-muted-sm/50"
            >
              Aucune observation enregistrée pour le moment.
            </div>

            <div v-if="siteObservations.length" class="mt-4">
              <UFormField
                label="Erreur principale à mettre en avant"
                class="space-y-1"
              >
                <USelect
                  v-model="selectedMainObservationKey"
                  :items="mainObservationOptions"
                  value-attribute="value"
                  option-attribute="label"
                  color="neutral"
                  class="w-full min-w-0 rounded-xl bg-white"
                  trailing-icon="i-lucide-chevron-down"
                  :content="{
                    class:
                      'z-50 max-h-60 w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-200',
                  }"
                  :ui="{
                    base: 'bg-white dark:bg-white',
                    value: 'truncate min-w-0 pointer-events-none pr-8',
                    placeholder:
                      'truncate min-w-0 pointer-events-none pr-8 text-slate-400',
                    trailing: 'absolute inset-y-0 end-0 flex items-center pe-3',
                    trailingIcon: 'shrink-0 text-slate-400',
                    item: 'p-2 text-xs text-slate-700',
                    itemLabel: 'truncate text-slate-700',
                    itemDescription: 'truncate text-slate-500',
                    label:
                      'p-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
                  }"
                  placeholder="Choisir l'erreur principale"
                />
              </UFormField>
            </div>
          </div>

          <div
            v-show="activeProspectTab === 'lighthouse'"
            class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div
                  class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                >
                  Lighthouse
                </div>
                <h2 class="mt-1 text-lg font-semibold text-slate-900">
                  Audit de la qualité du site
                </h2>
                <div class="mt-1 text-muted-sm">
                  Dernier audit: {{ data.url?.lighthouseCheckedAt || "—" }}
                </div>
              </div>

              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-refresh-cw"
                :loading="lighthouseAuditing"
                :disabled="!data.urlId || lighthouseAuditing"
                @click="rerunLighthouseAudit"
              >
                Refaire l’audit Lighthouse
              </UButton>
            </div>

            <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div
                v-for="score in lighthouseScoreItems"
                :key="score.label"
                class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div
                  class="text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  {{ score.label }}
                </div>
                <div
                  class="mt-2 text-2xl font-semibold"
                  :class="scoreTone(score.value)"
                >
                  {{ score.value ?? "—" }}
                </div>
              </div>
            </div>
          </div>

          <div v-show="activeProspectTab === 'email'">
            <ProspectEmailComposer
              :prospect-id="data.id"
              :disabled="!isPositioningValidated"
              :external-sent="data?.status !== 'Prospect froid'"
              :preferred-template-key="emailPreferredTemplateKey"
              @draft-changed="handleEmailDraftChanged"
              @external-sent="markProspectAsContacted"
              @queued="handleEmailQueued"
            />
          </div>

          <div
            v-show="activeProspectTab === 'ticket'"
            class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              class="flex w-full items-start justify-between gap-4 px-6 py-5 text-left"
              @click="magifyTicketPanelOpen = !magifyTicketPanelOpen"
            >
              <div>
                <div
                  class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                >
                  Ticket MagifyOS
                </div>
                <h2 class="mt-1 text-lg font-semibold text-slate-900">
                  Création du ticket externe
                </h2>
                <p class="mt-1 text-xs leading-6 text-slate-500">
                  Prépare le ticket avant envoi vers l’API externe.
                </p>
              </div>

              <div class="flex items-center gap-3">
                <span
                  v-if="data?.magifyTicketId"
                  class="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:inline-flex"
                >
                  Ticket enregistré
                </span>
                <UIcon
                  :name="
                    magifyTicketPanelOpen
                      ? 'i-lucide-chevron-up'
                      : 'i-lucide-chevron-down'
                  "
                  class="mt-1 h-5 w-5 text-slate-400"
                />
              </div>
            </button>

            <div
              v-show="magifyTicketPanelOpen"
              class="border-t border-slate-200 px-6 py-6"
            >
              <div
                v-if="magifyTicketState === 'success' || data?.magifyTicketId"
                class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-xs leading-6 text-emerald-900"
              >
                <p class="font-medium text-emerald-950">
                  {{ magifyTicketMessage || "Ticket créé avec succès." }}
                </p>
                <p class="mt-2">
                  <a
                    v-if="
                      magifyTicketResult?.ticketUrl || data?.magifyTicketUrl
                    "
                    :href="
                      magifyTicketResult?.ticketUrl ||
                      data?.magifyTicketUrl ||
                      '#'
                    "
                    target="_blank"
                    rel="noreferrer"
                    class="font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
                  >
                    Voir le ticket MagifyOS
                  </a>
                  <span v-else class="text-emerald-800">
                    ID du ticket:
                    {{
                      magifyTicketResult?.ticketId ||
                      data?.magifyTicketId ||
                      "—"
                    }}
                  </span>
                </p>
              </div>

              <div
                v-if="magifyTicketState === 'error'"
                class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-xs leading-6 text-rose-900"
              >
                <p class="font-medium text-rose-950">
                  {{ magifyTicketMessage || "Une erreur est survenue." }}
                </p>
              </div>

              <div class="mt-6 grid gap-4 md:grid-cols-2">
                <div class="md:col-span-2">
                  <h3
                    class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                  >
                    Entreprise
                  </h3>
                </div>

                <UFormField
                  label="Nom de l’entreprise"
                  class="space-y-1"
                >
                  <UInput
                    v-model="magifyTicketForm.companyName"
                    placeholder="Ma Boutique SAS"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="SIREN" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.companySiren"
                    placeholder="123456789"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="Site web" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.companyWebsite"
                    placeholder="https://maboutique.fr"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="Forme juridique" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.companyLegalForm"
                    placeholder="SAS, SARL, EI..."
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="Pays" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.companyCountry"
                    placeholder="France"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="Adresse" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.companyAddress"
                    placeholder="12 rue de la Paix"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField
                  label="Complément d’adresse"
                  class="space-y-1"
                >
                  <UInput
                    v-model="magifyTicketForm.companyAddressExtra"
                    placeholder="Bâtiment B"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="Code postal" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.companyPostalCode"
                    placeholder="75001"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="Ville" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.companyCity"
                    placeholder="Paris"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <div class="md:col-span-2 mt-2">
                  <h3
                    class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                  >
                    Contact
                  </h3>
                </div>

                <UFormField label="Prénom" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.contactFirstName"
                    placeholder="Marie"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="Nom" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.contactLastName"
                    placeholder="Dupont"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="Email" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.contactEmail"
                    placeholder="marie@maboutique.fr"
                    type="email"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="Téléphone" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.contactPhone"
                    placeholder="+33612345678"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="Poste" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.contactJobTitle"
                    placeholder="CEO"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <div class="md:col-span-2 mt-2">
                  <h3
                    class="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                  >
                    Ticket
                  </h3>
                </div>

                <UFormField label="Titre" class="space-y-1">
                  <UInput
                    :model-value="magifyTicketForm.title"
                    placeholder="Titre du ticket"
                    class="w-full min-w-0 rounded-xl bg-white"
                    @update:model-value="setMagifyTicketTitle"
                  />
                  <p class="text-xs text-slate-500">
                    Par défaut, ce titre reprend l’objet du mail de prospection.
                  </p>
                </UFormField>

                <UFormField label="Offer ID" class="space-y-1">
                  <USelect
                    v-model="magifyTicketForm.offerId"
                    :items="magifyTicketOfferOptions"
                    value-attribute="value"
                    option-attribute="label"
                    color="neutral"
                    class="w-full min-w-0 rounded-xl bg-white"
                    trailing-icon="i-lucide-chevron-down"
                    :content="{
                      class:
                        'z-50 max-h-60 w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-200',
                    }"
                    :ui="{
                      base: 'bg-white dark:bg-white',
                      value: 'truncate min-w-0 pointer-events-none pr-8',
                      placeholder:
                        'truncate min-w-0 pointer-events-none pr-8 text-slate-400',
                      trailing: 'absolute inset-y-0 end-0 flex items-center pe-3',
                      trailingIcon: 'shrink-0 text-slate-400',
                      item: 'p-2 text-xs text-slate-700',
                      itemLabel: 'truncate text-slate-700',
                      itemDescription: 'truncate text-slate-500',
                      label:
                        'p-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    }"
                    placeholder="Choisir l’offre"
                  />
                </UFormField>

                <UFormField label="Responsible user ID" class="space-y-1">
                  <USelect
                    v-model="magifyTicketForm.responsibleUserId"
                    :items="magifyTicketResponsibleOptions"
                    value-attribute="value"
                    option-attribute="label"
                    color="neutral"
                    class="w-full min-w-0 rounded-xl bg-white"
                    trailing-icon="i-lucide-chevron-down"
                    :content="{
                      class:
                        'z-50 max-h-60 w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-200',
                    }"
                    :ui="{
                      base: 'bg-white dark:bg-white',
                      value: 'truncate min-w-0 pointer-events-none pr-8',
                      placeholder:
                        'truncate min-w-0 pointer-events-none pr-8 text-slate-400',
                      trailing: 'absolute inset-y-0 end-0 flex items-center pe-3',
                      trailingIcon: 'shrink-0 text-slate-400',
                      item: 'p-2 text-xs text-slate-700',
                      itemLabel: 'truncate text-slate-700',
                      itemDescription: 'truncate text-slate-500',
                      label:
                        'p-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    }"
                    placeholder="Choisir le responsable"
                  />
                </UFormField>

                <UFormField label="Priorité" class="space-y-1">
                  <USelect
                    v-model="magifyTicketForm.priority"
                    :items="[
                      { label: 'Basse', value: 'basse' },
                      { label: 'Normale', value: 'normale' },
                      { label: 'Haute', value: 'haute' },
                      { label: 'Urgente', value: 'urgente' },
                    ]"
                    value-attribute="value"
                    option-attribute="label"
                    color="neutral"
                    class="w-full min-w-0 rounded-xl bg-white"
                    trailing-icon="i-lucide-chevron-down"
                    :content="{
                      class:
                        'z-50 max-h-60 w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-200',
                    }"
                    :ui="{
                      base: 'bg-white dark:bg-white',
                      value: 'truncate min-w-0 pointer-events-none pr-8',
                      placeholder:
                        'truncate min-w-0 pointer-events-none pr-8 text-slate-400',
                      trailing:
                        'absolute inset-y-0 end-0 flex items-center pe-3',
                      trailingIcon: 'shrink-0 text-slate-400',
                      item: 'p-2 text-xs text-slate-700',
                      itemLabel: 'truncate text-slate-700',
                      itemDescription: 'truncate text-slate-500',
                      label:
                        'p-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    }"
                  />
                </UFormField>

                <UFormField label="Shop URL" class="space-y-1">
                  <UInput
                    v-model="magifyTicketForm.shopUrl"
                    placeholder="https://..."
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                </UFormField>

                <UFormField label="Notes" class="space-y-1 md:col-span-2">
                  <UTextarea
                    v-model="magifyTicketForm.notes"
                    :rows="7"
                    placeholder="Description détaillée"
                    class="w-full min-w-0 rounded-xl bg-white"
                  />
                  <p class="text-xs text-slate-500">
                    Les notes sont générées automatiquement à partir de la liste
                    des observations.
                  </p>
                </UFormField>
              </div>

              <div class="mt-6 flex flex-wrap items-center gap-3">
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-ticket"
                  :loading="magifyTicketCreating"
                  :disabled="!data?.id"
                  @click="createMagifyTicket"
                >
                  Créer le ticket MagifyOS
                </UButton>
              </div>
            </div>
          </div>

          <div v-show="activeProspectTab === 'tables'" class="space-y-4">
            <div
              v-if="leadScoreBreakdownSections.length"
              class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div class="border-b border-slate-200 px-6 py-5">
                <div class="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p
                      class="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700"
                    >
                      Lead score
                    </p>
                    <h3 class="mt-1 text-lg font-semibold text-slate-900">
                      Explication du calcul
                    </h3>
                    <p class="mt-1 text-muted-sm">
                      Chaque critère affiche les points attribués au prospect.
                    </p>
                  </div>
                  <div
                    class="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-900"
                  >
                    {{ data?.leadScore || 0 }} points
                  </div>
                </div>
              </div>

              <div class="grid gap-4 p-6">
                <div
                  v-for="section in leadScoreBreakdownSections"
                  :key="section.label"
                  class="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/60"
                >
                  <div
                    class="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3"
                  >
                    <div>
                      <div class="text-sm font-semibold text-slate-900">
                        {{ section.label }}
                      </div>
                      <div class="mt-0.5 text-xs text-slate-500">
                        {{ section.rows.length }} critère(s)
                      </div>
                    </div>
                    <div class="text-sm font-semibold text-slate-700">
                      {{ section.total }} pts
                    </div>
                  </div>

                  <div class="divide-y divide-slate-200">
                    <div
                      v-for="row in section.rows"
                      :key="`${section.label}-${row.label}`"
                      class="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
                    >
                      <div>
                        <div class="text-sm font-medium text-slate-900">
                          {{ row.label }}
                        </div>
                        <div class="mt-1 text-xs text-slate-500">
                          {{ row.note }}
                        </div>
                      </div>

                      <div class="text-sm text-slate-700">
                        {{ row.value }}
                      </div>

                      <div
                        class="text-right text-sm font-semibold"
                        :class="row.points > 0 ? 'text-emerald-600' : 'text-slate-500'"
                      >
                        {{ formatLeadScorePoints(row.points) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
                Total calculé: {{ leadScoreBreakdownTotal }} points.
              </div>
            </div>

            <div
              v-for="section in tableSections"
              :key="section.label"
              class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <button
                type="button"
                class="flex w-full items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 text-left transition hover:bg-slate-50"
                @click="toggleTableSection(section.label)"
              >
                <div>
                  <div class="text-lg font-semibold text-slate-900">
                    {{ section.label }}
                  </div>
                  <div class="mt-1 text-muted-sm">
                    {{
                      section.label === "Prospect"
                        ? data.name || data.siteName || "Prospect"
                        : section.label === "Site"
                          ? data.siteName || "Site non renseigné"
                          : "Cliquer pour replier ou déplier les détails."
                    }}
                  </div>
                </div>

                <UIcon
                  name="i-lucide-chevron-down"
                  class="size-5 shrink-0 text-slate-400 transition-transform duration-200"
                  :class="
                    isTableSectionExpanded(section.label) ? 'rotate-180' : ''
                  "
                />
              </button>

              <div
                v-show="isTableSectionExpanded(section.label)"
                class="overflow-x-auto"
              >
                <table class="min-w-full divide-y divide-slate-200 text-xs">
                  <tbody class="divide-y divide-slate-100">
                    <tr
                      v-for="row in section.rows"
                      :key="`${section.label}-${row.label}`"
                    >
                      <th
                        class="w-80 bg-slate-50 px-6 py-3 text-left font-medium text-slate-600"
                      >
                        {{ row.label }}
                      </th>
                      <td
                        class="whitespace-pre-wrap break-words px-6 py-3 text-slate-900"
                      >
                        {{ formatTableValue(row.value) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside class="sticky top-[7.5rem] self-start justify-self-end z-30">
        <div class="w-full max-w-[20rem] h-fit">
          <div
            class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <p
                class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
              >
                Actions
              </p>
              <h2 class="mt-1 text-lg font-semibold text-slate-900">
                Prospect
              </h2>
            </div>
            <div class="mt-6 flex flex-col items-stretch gap-4">
              <div v-if="data?.id" class="min-w-[18rem]">
                <div
                  class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  Statut du prospect
                </div>
                <div class="flex items-stretch gap-2">
                  <USelect
                    v-model="prospectStatusChoice"
                    :items="prospectStatusOptions"
                    value-attribute="value"
                    option-attribute="label"
                    color="neutral"
                    class="min-w-0 flex-1 rounded-xl bg-white"
                    trailing-icon="i-lucide-chevron-down"
                    :content="{
                      class:
                        'z-50 max-h-60 w-(--reka-select-trigger-width) overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl ring-1 ring-slate-200 dark:bg-white dark:text-slate-900 dark:ring-slate-200',
                    }"
                    :ui="{
                      base: 'bg-white dark:bg-white',
                      value: 'truncate min-w-0 pointer-events-none pr-8',
                      placeholder:
                        'truncate min-w-0 pointer-events-none pr-8 text-slate-400',
                      trailing:
                        'absolute inset-y-0 end-0 flex items-center pe-3',
                      trailingIcon: 'shrink-0 text-slate-400',
                      item: 'p-2 text-xs text-slate-700',
                      itemLabel: 'truncate text-slate-700',
                      itemDescription: 'truncate text-slate-500',
                      label:
                        'p-2 text-xs font-semibold uppercase tracking-wide text-slate-500',
                    }"
                  />
                  <UButton
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-save"
                    :loading="statusSaving"
                    class="shrink-0 self-stretch"
                    @click="saveProspectStatus"
                  >
                    Appliquer
                  </UButton>
                </div>
              </div>
              <UButton
                v-if="data?.urlId"
                color="neutral"
                variant="soft"
                icon="i-lucide-refresh-cw"
                :loading="reanalyzingSite"
                class="justify-start"
                @click="reanalyzeProspectSite"
              >
                Réanalyser le site
              </UButton>
              <UButton
                v-if="data?.sourceUrl"
                :to="data.sourceUrl"
                color="neutral"
                variant="soft"
                icon="i-lucide-external-link"
                target="_blank"
                rel="noreferrer"
                class="justify-start"
              >
                Voir le site
              </UButton>
              <UButton
                v-if="legalNoticeUrl"
                color="neutral"
                variant="soft"
                icon="i-lucide-file-text"
                class="justify-start"
                @click="openLegalNoticePage"
              >
                Mentions légales
              </UButton>
              <UButton
                v-if="sirenSearchUrl"
                as="a"
                :href="sirenSearchUrl"
                color="neutral"
                variant="soft"
                icon="i-lucide-search"
                target="_blank"
                rel="noreferrer"
                class="justify-start"
              >
                Recherche entreprises
              </UButton>
              <UButton
                v-if="data?.urlId"
                :to="`/urls/${data.urlId}`"
                color="neutral"
                variant="soft"
                icon="i-lucide-link"
                class="justify-start"
              >
                Voir la fiche URL
              </UButton>
              <UButton
                v-if="data?.status === 'Prospect froid'"
                color="neutral"
                variant="soft"
                icon="i-lucide-mail-check"
                :loading="markingContacted"
                class="justify-start"
                @click="markProspectAsContacted"
              >
                Contacté par email externe
              </UButton>
              <UButton
                color="error"
                variant="soft"
                icon="i-lucide-trash-2"
                :loading="trashing"
                class="justify-start"
                @click="trashProspect"
              >
                Supprimer le contact
              </UButton>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </main>
</template>
