<script setup lang="ts">
import { DialogOverlay, type DialogOverlayProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<DialogOverlayProps & { class?: string }>()
</script>

<template>
  <DialogOverlay
    :as="props.as"
    :as-child="props.asChild"
    :force-mount="props.forceMount"
    :class="
      cn(
        'fixed inset-0 z-50 bg-black/50',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        props.class,
      )
    "
  />
</template>
