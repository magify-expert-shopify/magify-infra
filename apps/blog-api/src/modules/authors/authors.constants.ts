export const SHOPIFY_AUTHOR_METAOBJECT_FIELD_ALIASES = {
  displayName: ['name', 'display_name', 'title'],
  firstName: ['first_name', 'firstname', 'given_name'],
  lastName: ['last_name', 'lastname', 'family_name'],
  jobTitle: ['job_title'],
  bio: ['bio', 'description'],
  shopifyAvatarId: ['avatar', 'avatar_url', 'image', 'picture', 'photo'],
  email: ['email', 'mail'],
  phoneNumber: ['phone_number', 'phone', 'telephone'],
  shopifyPageId: ['page'],
  linkedinProfileUrl: ['linkedin_url', 'linkedin_profile_url', 'linkedin_profile', 'linkedin'],
  slug: ['slug', 'page_slug'],
} as const;

export const SHOPIFY_AUTHOR_METAOBJECT_DEFINITION_FIELDS = [
  {
    key: 'name',
    name: "Nom d'affichage",
    description: "Le nom public affiché pour l'auteur sur les contenus et les pages.",
    type: 'single_line_text_field',
  },
  {
    key: 'job_title',
    name: 'Intitulé du poste',
    description: "Le rôle ou l'intitulé de poste de l'auteur au sein de Magify.",
    type: 'single_line_text_field',
  },
  {
    key: 'avatar',
    name: 'Photo de profil',
    description: "L'image de profil utilisée pour représenter l'auteur.",
    type: 'file_reference',
  },
  {
    key: 'bio',
    name: 'Bio',
    description: "La biographie éditoriale de l'auteur affichée sur sa fiche.",
    type: 'multi_line_text_field',
  },
  {
    key: 'last_name',
    name: 'Nom de famille',
    description: "Le nom de famille de l'auteur.",
    type: 'single_line_text_field',
  },
  {
    key: 'first_name',
    name: 'Prénom',
    description: "Le prénom de l'auteur.",
    type: 'single_line_text_field',
  },
  {
    key: 'email',
    name: 'Email',
    description: "L'adresse email professionnelle de l'auteur.",
    type: 'single_line_text_field',
  },
  {
    key: 'phone_number',
    name: 'Numéro de téléphone',
    description: "Le numéro de téléphone professionnel de l'auteur.",
    type: 'single_line_text_field',
  },
  {
    key: 'page',
    name: "Page de détail de l'auteur",
    description:
      "La page Shopify du site associée à la fiche publique de l'auteur.",
    type: 'page_reference',
  },
  {
    key: 'linkedin_url',
    name: 'Lien de profil LinkedIn',
    description: "L'URL complète du profil LinkedIn public de l'auteur.",
    type: 'url',
  },
  {
    key: 'slug',
    name: "Slug / handle de la page de détail de l'auteur",
    description: "Le slug utilisé pour construire l'URL de la page publique de l'auteur.",
    type: 'single_line_text_field',
  },
] as const;
