<script setup lang="ts">
import { DropdownMenuSeparator, type DropdownMenuSeparatorProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<DropdownMenuSeparatorProps & { class?: string }>()
</script>

<template>
  <DropdownMenuSeparator
    :as="props.as"
    :as-child="props.asChild"
    :class="cn('bg-border -mx-1 my-1 h-px', props.class)"
  />
</template>
