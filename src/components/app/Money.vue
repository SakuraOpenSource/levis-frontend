<script setup lang="ts">
import { computed } from 'vue'

import { cn, formatCents } from '@/lib/utils'

const props = defineProps<{
  cents: number
  /** 带符号展示（资金流水用），正数会显示 +。 */
  signed?: boolean
  class?: string
}>()

const text = computed(() => {
  const formatted = formatCents(props.cents)
  return props.signed && props.cents > 0 ? `+${formatted}` : formatted
})

const tone = computed(() => {
  if (!props.signed) return ''
  if (props.cents > 0) return 'text-success'
  if (props.cents < 0) return 'text-destructive'
  return ''
})
</script>

<template>
  <span :class="cn('tabular', tone, props.class)">{{ text }}</span>
</template>
