<script setup lang="ts">
import { SelectValue, type SelectValueProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<SelectValueProps & { class?: string }>()
</script>

<template>
  <SelectValue
    data-slot="select-value"
    :placeholder="props.placeholder"
    :as="props.as"
    :as-child="props.asChild"
    :class="cn(props.class)"
  >
    <slot />
  </SelectValue>
</template>
