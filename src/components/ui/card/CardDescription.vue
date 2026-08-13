<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('text-muted-foreground text-sm', props.class)">
    <slot />
  </div>
</template>
