<script setup lang="ts">
import { Primitive, type PrimitiveProps } from 'reka-ui'

import { cn } from '@/lib/utils'
import { badgeVariants, type BadgeVariants } from '.'

const props = withDefaults(
  defineProps<PrimitiveProps & { variant?: BadgeVariants['variant']; class?: string }>(),
  { as: 'span' },
)
</script>

<template>
  <Primitive
    :as="props.as"
    :as-child="props.asChild"
    :class="cn(badgeVariants({ variant: props.variant }), props.class)"
  >
    <slot />
  </Primitive>
</template>
