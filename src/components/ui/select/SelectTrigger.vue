<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { SelectIcon, SelectTrigger, type SelectTriggerProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<SelectTriggerProps & { class?: string }>()
</script>

<template>
  <SelectTrigger
    :as="props.as"
    :as-child="props.asChild"
    :disabled="props.disabled"
    :reference="props.reference"
    :class="
      cn(
        'border-input flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'data-[placeholder]:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        '*:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 *:data-[slot=select-value]:truncate',
        props.class,
      )
    "
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="size-4 opacity-50" />
    </SelectIcon>
  </SelectTrigger>
</template>
