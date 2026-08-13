<script setup lang="ts">
import { cn } from '@/lib/utils'
import { alertVariants, type AlertVariants } from '.'

const props = defineProps<{ variant?: AlertVariants['variant']; class?: string }>()
</script>

<template>
  <div role="alert" :class="cn(alertVariants({ variant: props.variant }), props.class)">
    <slot />
  </div>
</template>
