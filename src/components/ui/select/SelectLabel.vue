<script setup lang="ts">
import { SelectLabel, type SelectLabelProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<SelectLabelProps & { class?: string }>()
</script>

<template>
  <SelectLabel
    :as="props.as"
    :as-child="props.asChild"
    :class="cn('text-muted-foreground px-2 py-1.5 text-xs', props.class)"
  >
    <slot />
  </SelectLabel>
</template>
