<script setup lang="ts">
import KeywordGroupSuggestionCard from "~/components/suggestions/KeywordGroupSuggestionCard.vue";
import type { KeywordGroupSuggestionRecord } from "~/types/keywords";

withDefaults(
  defineProps<{
    suggestions: KeywordGroupSuggestionRecord[];
    cardClass?: string;
    sprintClusterId?: string | null;
    currentUserId?: string | null;
  }>(),
  {
    cardClass: "flex-[1_1_24rem]",
    sprintClusterId: null,
    currentUserId: null,
  },
);

const emit = defineEmits<{
  assigned: [suggestion: KeywordGroupSuggestionRecord];
  associated: [payload: { suggestionId: string; pageId: string; pageTitle: string }];
}>();

function handleAssigned(suggestion: KeywordGroupSuggestionRecord) {
  emit("assigned", suggestion);
}

function handleAssociated(payload: {
  suggestionId: string;
  pageId: string;
  pageTitle: string;
}) {
  emit("associated", payload);
}
</script>

<template>
  <div class="grid md:grid-cols-2 2xl:grid-cols-4 gap-4">
    <KeywordGroupSuggestionCard
      v-for="suggestion in suggestions"
      :key="suggestion.id"
      :suggestion="suggestion"
      :sprint-cluster-id="sprintClusterId"
      :current-user-id="currentUserId"
      :class="cardClass"
      @assigned="handleAssigned"
      @associated="handleAssociated"
    />
  </div>
</template>
