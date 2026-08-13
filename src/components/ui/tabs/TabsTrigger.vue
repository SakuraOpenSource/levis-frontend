<script setup lang="ts">
import { TabsTrigger, useForwardProps, type TabsTriggerProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<TabsTriggerProps & { class?: string }>()

const forwarded = useForwardProps(props)
</script>

<template>
  <TabsTrigger
    v-bind="forwarded"
    :class="
      cn(
        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap transition-all',
        'focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none',
        'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        'disabled:pointer-events-none disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </TabsTrigger>
</template>
