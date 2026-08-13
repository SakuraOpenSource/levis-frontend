<script setup lang="ts">
import { X } from 'lucide-vue-next'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
  type DialogContentEmits,
  type DialogContentProps,
} from 'reka-ui'

import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<DialogContentProps & { class?: string; side?: 'left' | 'right' }>(),
  { side: 'left' },
)
const emits = defineEmits<DialogContentEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50"
    />
    <DialogContent
      v-bind="forwarded"
      :class="
        cn(
          'bg-background fixed z-50 flex h-svh w-3/4 max-w-sm flex-col gap-4 border-r p-0 shadow-lg transition ease-in-out',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300',
          props.side === 'left'
            ? 'inset-y-0 left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left'
            : 'inset-y-0 right-0 border-l border-r-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          props.class,
        )
      "
    >
      <slot />
      <DialogClose
        class="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:outline-none"
        aria-label="关闭"
      >
        <X class="size-4" />
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
