<script setup lang="ts">
import {
  DropdownMenuItem,
  useForwardPropsEmits,
  type DropdownMenuItemEmits,
  type DropdownMenuItemProps,
} from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<
  DropdownMenuItemProps & { class?: string; variant?: 'default' | 'destructive' }
>()
const emits = defineEmits<DropdownMenuItemEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <DropdownMenuItem
    v-bind="forwarded"
    :class="
      cn(
        'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none',
        'focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        props.variant === 'destructive' && 'text-destructive focus:bg-destructive/10',
        props.class,
      )
    "
  >
    <slot />
  </DropdownMenuItem>
</template>
