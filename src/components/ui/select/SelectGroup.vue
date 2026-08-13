<script setup lang="ts">
import { SelectGroup, type SelectGroupProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<SelectGroupProps & { class?: string }>()
</script>

<template>
  <SelectGroup :as="props.as" :as-child="props.asChild" :class="cn('p-1', props.class)">
    <slot />
  </SelectGroup>
</template>
