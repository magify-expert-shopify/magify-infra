<template>
  <div class="mt-5 overflow-x-auto animate-pulse">
    <table class="min-w-full divide-y divide-slate-200 text-sm">
      <thead>
        <tr class="text-left text-slate-500">
          <th class="w-0 px-4 py-3 font-medium">Favori</th>
          <th class="px-4 py-3 font-medium">Difficulté</th>
          <th class="px-4 py-3 font-medium">Mot-clé</th>
          <th class="px-4 py-3 font-medium">Longueur</th>
          <th class="px-4 py-3 font-medium">Volume</th>
          <th class="px-4 py-3 font-medium">Intent</th>
          <th class="px-4 py-3 font-medium">Groupe</th>
          <th class="px-4 py-3 font-medium">Template</th>
          <th class="px-4 py-3 font-medium">Page</th>
          <th class="px-4 py-3 font-medium">Statut</th>
          <th class="w-0 px-4 py-3 font-medium">Explorer</th>
          <th class="w-0 px-4 py-3 font-medium text-right">Supprimer</th>
        </tr>
      </thead>

      <tbody class="divide-y divide-slate-100">
        <tr v-for="index in 6" :key="index">
          <td class="px-4 py-3">
            <div class="h-4 w-8 rounded bg-slate-200" />
          </td>

          <td class="px-4 py-3">
            <div class="h-8 w-8 rounded-full bg-slate-200" />
          </td>

          <td class="px-4 py-3">
            <div class="h-4 w-48 rounded bg-slate-200" />
          </td>

          <td class="px-4 py-3">
            <div class="h-4 w-24 rounded bg-slate-200" />
          </td>

          <td class="px-4 py-3">
            <div class="h-4 w-28 rounded bg-slate-200" />
          </td>

          <td class="px-4 py-3">
            <div class="h-4 w-16 rounded bg-slate-200" />
          </td>

          <td class="px-4 py-3">
            <div class="h-4 w-28 rounded bg-slate-200" />
          </td>

          <td class="px-4 py-3">
            <div class="h-8 w-40 rounded bg-slate-200" />
          </td>

          <td class="px-4 py-3">
            <div class="h-8 w-28 rounded bg-slate-200" />
          </td>

          <td class="px-4 py-3">
            <div class="h-8 w-28 rounded bg-slate-200" />
          </td>

          <td class="px-4 py-3">
            <div class="h-8 w-40 rounded bg-slate-200" />
          </td>

          <td class="px-4 py-3">
            <div class="h-8 w-28 rounded bg-slate-200" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
