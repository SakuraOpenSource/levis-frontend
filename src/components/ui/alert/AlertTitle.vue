<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('font-medium tracking-tight', props.class)">
    <slot />
  </div>
</template>
