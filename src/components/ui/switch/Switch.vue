<script setup lang="ts">
import {
  SwitchRoot,
  SwitchThumb,
  useForwardPropsEmits,
  type SwitchRootEmits,
  type SwitchRootProps,
} from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<SwitchRootProps & { class?: string }>()
const emits = defineEmits<SwitchRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <SwitchRoot
    v-bind="forwarded"
    :class="
      cn(
        'peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        'disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  >
    <SwitchThumb
      class="bg-background pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
    />
  </SwitchRoot>
</template>
