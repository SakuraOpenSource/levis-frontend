<script setup lang="ts">
import { Separator, type SeparatorProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<SeparatorProps & { class?: string }>(), {
  orientation: 'horizontal',
  decorative: true,
})
</script>

<template>
  <Separator
    :orientation="props.orientation"
    :decorative="props.decorative"
    :as="props.as"
    :as-child="props.asChild"
    :class="
      cn(
        'bg-border shrink-0',
        props.orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full',
        props.class,
      )
    "
  />
</template>
