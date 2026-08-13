<script setup lang="ts">
import { CheckCircle2, Info, XCircle } from 'lucide-vue-next'

import { useToast } from '@/composables/useToast'
import { cn } from '@/lib/utils'

const { toasts, dismiss } = useToast()

const ICONS = { success: CheckCircle2, error: XCircle, info: Info }
const TONES = {
  success: 'border-success/40 bg-success/10 text-success',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  info: 'border-border bg-card text-card-foreground',
}
</script>

<template>
  <!-- aria-live 让屏幕阅读器播报操作结果。 -->
  <div
    class="pointer-events-none fixed inset-x-0 top-4 z-100 flex flex-col items-center gap-2 px-4"
    role="status"
    aria-live="polite"
  >
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <button
        v-for="toast in toasts"
        :key="toast.id"
        type="button"
        :class="
          cn(
            'pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg backdrop-blur',
            TONES[toast.tone],
          )
        "
        @click="dismiss(toast.id)"
      >
        <component :is="ICONS[toast.tone]" class="size-4 shrink-0" />
        <span class="text-left">{{ toast.message }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>
