<script setup lang="ts">
import { TabsList, type TabsListProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<TabsListProps & { class?: string }>()
</script>

<template>
  <TabsList
    :loop="props.loop"
    :as="props.as"
    :as-child="props.asChild"
    :class="
      cn(
        'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-1',
        props.class,
      )
    "
  >
    <slot />
  </TabsList>
</template>
