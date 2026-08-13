<script setup lang="ts">
import { X } from 'lucide-vue-next'
import {
  DialogClose,
  DialogContent,
  DialogPortal,
  useForwardPropsEmits,
  type DialogContentEmits,
  type DialogContentProps,
} from 'reka-ui'

import { cn } from '@/lib/utils'
import DialogOverlay from './DialogOverlay.vue'

const props = defineProps<DialogContentProps & { class?: string }>()
const emits = defineEmits<DialogContentEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      v-bind="forwarded"
      :class="
        cn(
          'bg-background fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border p-6 shadow-lg sm:max-w-lg',
          'max-h-[calc(100dvh-4rem)] overflow-y-auto',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.class,
        )
      "
    >
      <slot />
      <DialogClose
        class="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none"
        aria-label="关闭"
      >
        <X class="size-4" />
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
