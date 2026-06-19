<script setup lang="ts">
import { pageTypeLabels } from "~/constants/pages";

const webContentTypes = [
  {
    type: "BLOG_ARTICLE",
    definition:
      "Contenu éditorial qui informe, explique ou répond à une question précise.",
  },
  {
    type: "PRODUCT_PAGE",
    definition:
      "Page dédiée à un produit précis avec ses caractéristiques, bénéfices et appel à l'action.",
  },
  {
    type: "COLLECTION",
    definition:
      "Page qui regroupe plusieurs produits ou offres autour d'une même famille.",
  },
  {
    type: "LANDING_PAGE",
    definition:
      "Page d'atterrissage pensée pour convertir sur une offre, une campagne ou un objectif précis.",
  },
  {
    type: "SERVICE_PAGE",
    definition:
      "Page qui présente un service, une prestation ou une offre commerciale.",
  },
  {
    type: "CATEGORY_PAGE",
    definition:
      "Page de catégorie qui organise un ensemble de contenus ou de produits par thème.",
  },
  {
    type: "TUTORIAL",
    definition:
      "Contenu pas à pas qui explique comment faire quelque chose ou utiliser un outil.",
  },
  {
    type: "GUIDE",
    definition:
      "Contenu complet et structuré qui aide l'utilisateur à comprendre un sujet en profondeur.",
  },
  {
    type: "DEFINITION",
    definition:
      "Contenu court et direct qui explique clairement la signification d'un terme ou d'un concept.",
  },
  {
    type: "FORM",
    definition:
      "Page centrée sur un formulaire, une prise de contact ou une demande d'information.",
  },
  {
    type: "HOMEPAGE",
    definition:
      "Page d'accueil du site, souvent la porte d'entrée principale vers les autres contenus.",
  },
  {
    type: "FAQ",
    definition:
      "Page de questions fréquentes qui rassemble les réponses aux interrogations les plus courantes.",
  },
] as const;
</script>

<template>
  <section
    aria-labelledby="definition-cluster"
    class="my-8 rounded-xl border border-gray-200 bg-gray-50 p-6"
  >
    <h2 id="definition-cluster" class="mb-4 text-2xl font-bold text-gray-900">
      Définition
    </h2>

    <dl class="space-y-3">
      <dt class="text-lg font-semibold text-gray-900">Cluster SEO</dt>

      <dd class="text-base leading-relaxed text-gray-700">
        Un
        <a
          class="underline"
          href="https://www.lemon-interactive.fr/actualites/seo/cluster-thematique-seo-definition-methodes-optimisation/"
        >
          <strong class="font-semibold text-gray-900"> cluster SEO </strong>
        </a>
        est un groupe de contenus reliés entre eux autour d’un
        <strong>même sujet</strong> pour aider Google à comprendre ton expertise
        et mieux référencer ton site.
      </dd>
    </dl>
  </section>

  <section
    aria-labelledby="web-content-types"
    class="my-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
  >
    <h2
      id="web-content-types"
      class="mb-4 text-2xl font-bold tracking-tight text-slate-900"
    >
      Types de contenu web
    </h2>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="contentType in webContentTypes"
        :key="contentType.type"
        class="rounded-xl border border-slate-200 bg-slate-50 p-4"
      >
        <h3 class="text-lg font-semibold text-slate-900">
          {{ pageTypeLabels[contentType.type] }}
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-slate-600">
          {{ contentType.definition }}
        </p>
      </article>
    </div>
  </section>
</template>
