<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <tr
    :class="cn('hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors', props.class)"
  >
    <slot />
  </tr>
</template>
