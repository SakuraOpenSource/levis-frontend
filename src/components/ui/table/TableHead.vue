<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: string }>()
</script>

<template>
  <th
    scope="col"
    :class="
      cn(
        'text-muted-foreground h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap',
        props.class,
      )
    "
  >
    <slot />
  </th>
</template>
