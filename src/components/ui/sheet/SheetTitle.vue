<script setup lang="ts">
import { DialogTitle, type DialogTitleProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<DialogTitleProps & { class?: string }>()
</script>

<template>
  <DialogTitle
    :as="props.as"
    :as-child="props.asChild"
    :class="cn('font-semibold', props.class)"
  >
    <slot />
  </DialogTitle>
</template>
