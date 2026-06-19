<script setup lang="ts">
import {
  asideVariantOptions,
  blockFormatOptions,
  codeLanguageOptions,
} from "~/constants/editor";
import { applicationCustomElementStructureOptions } from "~/constants/custom-elements";
import type {
  AsideVariant,
  BlockFormatValue,
  TextAlignment,
} from "~/types/editor";

const props = defineProps<{
  currentBlockFormat: BlockFormatValue;
  editorReady: boolean;
  isBoldActive: boolean;
  isItalicActive: boolean;
  isUnderlineActive: boolean;
  isAlignLeftActive: boolean;
  isAlignCenterActive: boolean;
  isAlignRightActive: boolean;
  isAlignJustifyActive: boolean;
  isBulletListActive: boolean;
  isOrderedListActive: boolean;
  isInfoAsideActive: boolean;
  isCalloutBoxActive: boolean;
  isCodeBlockActive: boolean;
  isNonBreakingSpaceActive: boolean;
  isKeyboardInputActive: boolean;
  isImageSelected: boolean;
  isLinkActive: boolean;
  canUndo: boolean;
  canRedo: boolean;
  currentAsideVariant: AsideVariant;
  currentCodeLanguage: string;
  currentCalloutBoxBackgroundColor: string;
  currentCalloutBoxBorderColor: string;
  currentCustomElementStructureType: string;
  isColorPickerOpen: boolean;
  isCustomElementStructureActive: boolean;
  textColor: string;
  backgroundColor: string;
  onBlockFormatChange: (event: Event) => void;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
  onColorPopoverInteractOutside: (event: Event) => void;
  onResetTextColor: () => void;
  onColorPickerPointerDown: () => void;
  onColorPickerBlur: () => void;
  onApplyTextColor: (color: string) => void;
  onResetBackgroundColor: () => void;
  onApplyBackgroundColor: (color: string) => void;
  onSetTextAlignment: (alignment: TextAlignment) => void;
  onOpenLinkModal: () => void;
  onRemoveLink: () => void;
  onOpenImageModal: () => void;
  onOpenVideoModal: () => void;
  onInsertTable: () => void;
  onAsideVariantChange: (event: Event) => void;
  onCodeLanguageChange: (event: Event) => void;
  onInsertAside: () => void;
  onInsertCalloutBox: () => void;
  onInsertDetailsSummary: () => void;
  onInsertCustomElementStructure: (type: string) => void;
  onCalloutBoxBackgroundColorChange: (color: string) => void;
  onCalloutBoxBorderColorChange: (color: string) => void;
  onToggleBulletList: () => void;
  onToggleNonBreakingSpace: () => void;
  onToggleKeyboardInput: () => void;
  onToggleOrderedList: () => void;
  onDecreaseIndent: () => void;
  onIncreaseIndent: () => void;
  onClearFormatting: () => void;
  onDeleteCurrentElement: () => void;
  onRemoveCustomElementStructure: () => void;
  onUndo: () => void;
  onRedo: () => void;
}>();

const emit = defineEmits<{
  "update:isColorPickerOpen": [value: boolean];
  "update:textColor": [value: string];
  "update:backgroundColor": [value: string];
}>();

const colorPickerOpenModel = computed({
  get: () => props.isColorPickerOpen,
  set: (value: boolean) => emit("update:isColorPickerOpen", value),
});

const textColorModel = computed({
  get: () => props.textColor,
  set: (value: string) => emit("update:textColor", value),
});

const backgroundColorModel = computed({
  get: () => props.backgroundColor,
  set: (value: string) => emit("update:backgroundColor", value),
});

const isAsideVariantSelectInteracting = ref(false);
const isCodeLanguageSelectInteracting = ref(false);
const isCalloutBoxControlsInteracting = ref(false);
const isCustomElementStructureMenuOpen = ref(false);
const selectedCustomElementStructureType = ref(
  applicationCustomElementStructureOptions[0]?.value ?? "sitemap-generator",
);

const shouldShowAsideVariantSelect = computed(
  () => props.isInfoAsideActive || isAsideVariantSelectInteracting.value,
);

const shouldShowCodeLanguageSelect = computed(
  () => props.isCodeBlockActive || isCodeLanguageSelectInteracting.value,
);

const shouldShowCalloutBoxControls = computed(
  () => props.isCalloutBoxActive || isCalloutBoxControlsInteracting.value,
);

const isAdjustmentsMenuOpen = ref(false);

const customElementStructureButtonLabel = computed(() =>
  props.isCustomElementStructureActive
    ? "Supprimer l'application"
    : "Application",
);

const nonBreakingSpaceButtonLabel = computed(() =>
  props.isNonBreakingSpaceActive
    ? "Supprimer l'espace insécable"
    : "Espace insécable",
);

const keyboardInputButtonLabel = computed(() =>
  props.isKeyboardInputActive ? "Supprimer le kbd" : "Saisie clavier",
);

function onAsideVariantSelectPointerDown() {
  isAsideVariantSelectInteracting.value = true;
}

function onAsideVariantSelectBlur() {
  isAsideVariantSelectInteracting.value = false;
}

function onCodeLanguageSelectPointerDown() {
  isCodeLanguageSelectInteracting.value = true;
}

function onCodeLanguageSelectBlur() {
  isCodeLanguageSelectInteracting.value = false;
}

function onCalloutBoxControlsPointerDown() {
  isCalloutBoxControlsInteracting.value = true;
}

function onCalloutBoxControlsBlur() {
  window.setTimeout(() => {
    isCalloutBoxControlsInteracting.value = false;
  }, 0);
}

function onCustomElementStructureButtonClick() {
  if (props.isCustomElementStructureActive) {
    isCustomElementStructureMenuOpen.value = false;
    props.onRemoveCustomElementStructure();
    return;
  }

  selectedCustomElementStructureType.value =
    props.currentCustomElementStructureType ||
    selectedCustomElementStructureType.value ||
    applicationCustomElementStructureOptions[0]?.value ||
    "sitemap-generator";
  isCustomElementStructureMenuOpen.value =
    !isCustomElementStructureMenuOpen.value;
}

function onCustomElementStructureAdd() {
  props.onInsertCustomElementStructure(
    selectedCustomElementStructureType.value,
  );
  isCustomElementStructureMenuOpen.value = false;
}
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        :disabled="!editorReady || !canUndo"
        @click="onUndo"
      >
        <UIcon name="i-lucide-undo-2" class="h-4 w-4" />
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        :disabled="!editorReady || !canRedo"
        @click="onRedo"
      >
        <UIcon name="i-lucide-redo-2" class="h-4 w-4" />
      </UButton>
      <div class="h-7 w-px self-center bg-slate-200" />

      <select
        :value="currentBlockFormat"
        class="min-w-40 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
        :disabled="!editorReady"
        @change="onBlockFormatChange"
      >
        <option
          v-for="option in blockFormatOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <div class="h-7 w-px self-center bg-slate-200" />

      <UButton
        size="sm"
        color="neutral"
        :variant="isBoldActive ? 'solid' : 'soft'"
        :disabled="!editorReady"
        @click="onToggleBold"
      >
        <UIcon name="i-lucide-bold" class="h-4 w-4" />
        <!-- Gras -->
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        :variant="isItalicActive ? 'solid' : 'soft'"
        :disabled="!editorReady"
        @click="onToggleItalic"
      >
        <UIcon name="i-lucide-italic" class="h-4 w-4" />
        <!-- Italique -->
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        :variant="isUnderlineActive ? 'solid' : 'soft'"
        :disabled="!editorReady"
        @click="onToggleUnderline"
      >
        <UIcon name="i-lucide-underline" class="h-4 w-4" />
        <!-- Souligné -->
      </UButton>

      <UPopover
        v-model:open="colorPickerOpenModel"
        :content="{
          side: 'bottom',
          align: 'start',
          onInteractOutside: onColorPopoverInteractOutside,
        }"
      >
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          :disabled="!editorReady"
        >
          <UIcon name="i-lucide-palette" class="h-4 w-4" />
          <!-- Couleurs -->
        </UButton>

        <template #content="{ close }">
          <div class="w-72 space-y-4 rounded-2xl bg-white p-4">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <label class="text-sm font-medium text-slate-700">
                  Couleur de texte
                </label>
                <button
                  type="button"
                  class="text-xs font-medium text-slate-500 underline underline-offset-2 transition hover:text-slate-700"
                  @click="onResetTextColor"
                >
                  Réinitialiser
                </button>
              </div>
              <input
                v-model="textColorModel"
                type="color"
                class="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                @pointerdown="onColorPickerPointerDown"
                @blur="onColorPickerBlur"
                @input="onApplyTextColor(textColorModel)"
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <label class="text-sm font-medium text-slate-700">
                  Couleur de fond
                </label>
                <button
                  type="button"
                  class="text-xs font-medium text-slate-500 underline underline-offset-2 transition hover:text-slate-700"
                  @click="onResetBackgroundColor"
                >
                  Réinitialiser
                </button>
              </div>
              <input
                v-model="backgroundColorModel"
                type="color"
                class="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                @pointerdown="onColorPickerPointerDown"
                @blur="onColorPickerBlur"
                @input="onApplyBackgroundColor(backgroundColorModel)"
              />
            </div>

            <div class="flex justify-end">
              <UButton size="sm" color="neutral" variant="soft" @click="close">
                Fermer
              </UButton>
            </div>
          </div>
        </template>
      </UPopover>

      <div class="h-7 w-px self-center bg-slate-200" />

      <UButton
        size="sm"
        color="neutral"
        :variant="isLinkActive ? 'solid' : 'soft'"
        :disabled="!editorReady"
        @mousedown.prevent
        @click="onOpenLinkModal"
      >
        <UIcon name="i-lucide-link" class="h-4 w-4" />
        <!-- Lien -->
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        :variant="isLinkActive ? 'solid' : 'soft'"
        :disabled="!editorReady || !isLinkActive"
        @mousedown.prevent
        @click="onRemoveLink"
      >
        <UIcon name="i-lucide-link-2-off" class="h-4 w-4" />
        <!-- Retirer le lien -->
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        :variant="isImageSelected ? 'solid' : 'soft'"
        :disabled="!editorReady"
        @click="onOpenImageModal"
      >
        <UIcon name="i-lucide-image" class="h-4 w-4" />
        <!-- Image -->
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        :disabled="!editorReady"
        @click="onOpenVideoModal"
      >
        <UIcon name="i-lucide-video" class="h-4 w-4" />
        <!-- Vidéo -->
      </UButton>

      <div class="h-7 w-px self-center bg-slate-200" />

      <UButton
        size="sm"
        color="neutral"
        :variant="isNonBreakingSpaceActive ? 'solid' : 'soft'"
        :disabled="!editorReady"
        @mousedown.prevent
        @click="onToggleNonBreakingSpace"
      >
        <UIcon name="i-lucide-pilcrow" class="h-4 w-4" />
        <!-- {{ nonBreakingSpaceButtonLabel }} -->
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        :variant="isKeyboardInputActive ? 'solid' : 'soft'"
        :disabled="!editorReady"
        @mousedown.prevent
        @click="onToggleKeyboardInput"
      >
        <UIcon
          :name="
            isKeyboardInputActive
              ? 'i-lucide-keyboard-off'
              : 'i-lucide-keyboard'
          "
          class="h-4 w-4"
        />
        <!-- {{ keyboardInputButtonLabel }} -->
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        :disabled="!editorReady"
        @click="onInsertTable"
      >
        <UIcon name="i-lucide-table" class="h-4 w-4" />
        <!-- Tableau -->
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        :disabled="!editorReady"
        @mousedown.prevent
        @click="onInsertDetailsSummary"
      >
        <UIcon name="i-lucide-message-circle-question-mark" class="h-4 w-4" />
        <!-- FAQ -->
      </UButton>

      <div class="h-7 w-px self-center bg-slate-200" />

      <div class="relative">
        <UButton
          size="sm"
          color="neutral"
          :variant="isCustomElementStructureActive ? 'solid' : 'soft'"
          :disabled="!editorReady"
          @mousedown.prevent
          @click="onCustomElementStructureButtonClick"
        >
          <UIcon name="i-lucide-blocks" class="h-4 w-4" />
          {{ customElementStructureButtonLabel }}
        </UButton>

        <div
          v-if="isCustomElementStructureMenuOpen"
          class="absolute left-0 top-full z-20 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
        >
          <div class="space-y-4">
            <div class="space-y-1">
              <p class="text-sm font-semibold text-slate-800">
                Ajouter une structure
              </p>
              <p class="text-sm text-slate-500">
                Choisis le custom element à insérer dans l’article.
              </p>
            </div>

            <label class="block space-y-2">
              <span class="text-sm font-medium text-slate-700">
                Type de structure
              </span>
              <select
                v-model="selectedCustomElementStructureType"
                class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
              >
                <option
                  v-for="option in applicationCustomElementStructureOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </label>

            <div class="flex items-center justify-end gap-2">
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                @click="isCustomElementStructureMenuOpen = false"
              >
                Annuler
              </UButton>
              <UButton size="sm" @click="onCustomElementStructureAdd">
                Ajouter
              </UButton>
            </div>
          </div>
        </div>
      </div>

      <UButton
        size="sm"
        color="neutral"
        :variant="isInfoAsideActive ? 'solid' : 'soft'"
        :disabled="!editorReady"
        @mousedown.prevent
        @click="onInsertAside"
      >
        <UIcon name="i-lucide-scroll-text" class="h-4 w-4" />
        Encadré
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        :variant="isCalloutBoxActive ? 'solid' : 'soft'"
        :disabled="!editorReady"
        @mousedown.prevent
        @click="onInsertCalloutBox"
      >
        <UIcon name="i-lucide-scroll" class="h-4 w-4" />
        Encadré
      </UButton>

      <div class="h-7 w-px self-center bg-slate-200" />

      <UPopover v-model:open="isAdjustmentsMenuOpen">
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          :disabled="!editorReady"
        >
          <UIcon name="i-lucide-sliders-horizontal" class="h-4 w-4" />
          Ajustements
        </UButton>

        <template #content="{ close }">
          <div class="w-80 space-y-4 rounded-2xl bg-white p-4">
            <div class="space-y-1">
              <p class="text-sm font-semibold text-slate-800">Ajustements</p>
              <p class="text-sm text-slate-500">
                Aligne, structure ou nettoie le bloc sélectionné.
              </p>
            </div>

            <div class="space-y-3">
              <div class="space-y-2">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-slate-400"
                >
                  Alignement
                </p>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    size="sm"
                    color="neutral"
                    :variant="isAlignLeftActive ? 'solid' : 'soft'"
                    :disabled="!editorReady"
                    @click="onSetTextAlignment('left')"
                  >
                    <UIcon name="i-lucide-align-left" class="h-4 w-4" />
                  </UButton>
                  <UButton
                    size="sm"
                    color="neutral"
                    :variant="isAlignCenterActive ? 'solid' : 'soft'"
                    :disabled="!editorReady"
                    @click="onSetTextAlignment('center')"
                  >
                    <UIcon name="i-lucide-align-center" class="h-4 w-4" />
                  </UButton>
                  <UButton
                    size="sm"
                    color="neutral"
                    :variant="isAlignRightActive ? 'solid' : 'soft'"
                    :disabled="!editorReady"
                    @click="onSetTextAlignment('right')"
                  >
                    <UIcon name="i-lucide-align-right" class="h-4 w-4" />
                  </UButton>
                  <UButton
                    size="sm"
                    color="neutral"
                    :variant="isAlignJustifyActive ? 'solid' : 'soft'"
                    :disabled="!editorReady"
                    @click="onSetTextAlignment('justify')"
                  >
                    <UIcon name="i-lucide-align-justify" class="h-4 w-4" />
                  </UButton>
                </div>
              </div>
            </div>

            <div class="flex justify-end">
              <UButton size="sm" color="neutral" variant="soft" @click="close">
                Fermer
              </UButton>
            </div>
          </div>
        </template>
      </UPopover>

      <div class="h-7 w-px self-center bg-slate-200" />

      <UButton
        size="sm"
        color="neutral"
        :variant="isBulletListActive ? 'solid' : 'soft'"
        :disabled="!editorReady"
        @click="onToggleBulletList"
      >
        <UIcon name="i-lucide-list" class="h-4 w-4" />
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        :variant="isOrderedListActive ? 'solid' : 'soft'"
        :disabled="!editorReady"
        @click="onToggleOrderedList"
      >
        <UIcon name="i-lucide-list-ordered" class="h-4 w-4" />
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        :disabled="!editorReady"
        @click="onDecreaseIndent"
      >
        <UIcon name="i-lucide-indent-decrease" class="h-4 w-4" />
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        :disabled="!editorReady"
        @click="onIncreaseIndent"
      >
        <UIcon name="i-lucide-indent-increase" class="h-4 w-4" />
      </UButton>

      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        :disabled="!editorReady"
        @click="onClearFormatting"
      >
        <UIcon name="i-lucide-eraser" class="h-4 w-4" />
        Effacer
      </UButton>

      <div class="h-7 w-px self-center bg-slate-200" />

      <UButton
        size="sm"
        color="red"
        variant="soft"
        :disabled="!editorReady"
        @mousedown.prevent
        @click="onDeleteCurrentElement"
      >
        <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
        Supprimer
      </UButton>
    </div>

    <div class="min-h-10 flex flex-wrap items-center gap-2">
      <select
        v-if="shouldShowCodeLanguageSelect"
        :value="currentCodeLanguage"
        class="min-w-[10rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
        :disabled="!editorReady"
        @pointerdown="onCodeLanguageSelectPointerDown"
        @blur="onCodeLanguageSelectBlur"
        @change="onCodeLanguageChange"
      >
        <option
          v-for="option in codeLanguageOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>

      <select
        v-if="shouldShowAsideVariantSelect"
        :value="currentAsideVariant"
        class="min-w-[10rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
        :disabled="!editorReady"
        @pointerdown="onAsideVariantSelectPointerDown"
        @blur="onAsideVariantSelectBlur"
        @change="onAsideVariantChange"
      >
        <option
          v-for="option in asideVariantOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>

      <div
        v-if="shouldShowCalloutBoxControls"
        class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
        @pointerdown="onCalloutBoxControlsPointerDown"
      >
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <span>Fond</span>
          <input
            :value="currentCalloutBoxBackgroundColor"
            type="color"
            class="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-1"
            :disabled="!editorReady"
            @blur="onCalloutBoxControlsBlur"
            @input="
              onCalloutBoxBackgroundColorChange(
                ($event.target as HTMLInputElement).value,
              )
            "
          />
        </label>

        <label class="flex items-center gap-2 text-sm text-slate-700">
          <span>Bordure</span>
          <input
            :value="currentCalloutBoxBorderColor"
            type="color"
            class="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-1"
            :disabled="!editorReady"
            @blur="onCalloutBoxControlsBlur"
            @input="
              onCalloutBoxBorderColorChange(
                ($event.target as HTMLInputElement).value,
              )
            "
          />
        </label>
      </div>
    </div>
  </div>
</template>
