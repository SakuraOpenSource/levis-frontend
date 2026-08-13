<script setup lang="ts">
import { Label, type LabelProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<LabelProps & { class?: string }>()
</script>

<template>
  <Label
    :for="props.for"
    :as="props.as"
    :as-child="props.asChild"
    :class="
      cn(
        'flex items-center gap-2 text-sm font-medium leading-none select-none',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        props.class,
      )
    "
  >
    <slot />
  </Label>
</template>
