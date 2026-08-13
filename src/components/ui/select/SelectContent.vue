<script setup lang="ts">
import {
  SelectContent,
  SelectPortal,
  SelectViewport,
  useForwardPropsEmits,
  type SelectContentEmits,
  type SelectContentProps,
} from 'reka-ui'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<SelectContentProps & { class?: string }>(), {
  position: 'popper',
})
const emits = defineEmits<SelectContentEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <SelectPortal>
    <SelectContent
      v-bind="forwarded"
      :class="
        cn(
          'bg-popover text-popover-foreground relative z-50 max-h-96 min-w-32 overflow-y-auto overflow-x-hidden rounded-md border shadow-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          props.class,
        )
      "
    >
      <SelectViewport
        :class="
          cn(
            'p-1',
            props.position === 'popper' &&
              'h-[var(--reka-select-trigger-height)] w-full min-w-[var(--reka-select-trigger-width)]',
          )
        "
      >
        <slot />
      </SelectViewport>
    </SelectContent>
  </SelectPortal>
</template>
