<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('font-semibold leading-none', props.class)">
    <slot />
  </div>
</template>
