<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'

import { cn } from '@/lib/utils'
import { ACCENTS, useAccentStore } from '@/stores/accent'

const { t } = useI18n()
const accentStore = useAccentStore()
</script>

<template>
  <div class="flex items-center gap-2" role="group" :aria-label="t('appearance.accent')">
    <button
      v-for="preset in ACCENTS"
      :key="preset.id"
      type="button"
      :title="t(`appearance.accent_${preset.id}`)"
      :aria-label="t(`appearance.accent_${preset.id}`)"
      :aria-pressed="accentStore.accent === preset.id"
      :class="
        cn(
          'flex size-7 items-center justify-center rounded-full border transition-transform duration-150 ease-out hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none active:scale-95',
          accentStore.accent === preset.id ? 'border-transparent ring-2 ring-ring ring-offset-2' : 'border-border',
        )
      "
      :style="{ backgroundColor: preset.swatch }"
      @click="accentStore.setAccent(preset.id)"
    >
      <Check v-if="accentStore.accent === preset.id" class="size-4 text-white" />
    </button>
  </div>
</template>
