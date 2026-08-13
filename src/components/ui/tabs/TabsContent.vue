<script setup lang="ts">
import { TabsContent, type TabsContentProps } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<TabsContentProps & { class?: string }>()
</script>

<template>
  <TabsContent
    :value="props.value"
    :force-mount="props.forceMount"
    :as="props.as"
    :as-child="props.asChild"
    :class="cn('flex-1 outline-none', props.class)"
  >
    <slot />
  </TabsContent>
</template>
