<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
  modelValue?: string | number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  // number 类型的 input 也返回字符串，交由调用方转换，
  // 避免在这里静默把空串变成 0。
  emit('update:modelValue', target.value)
}
</script>

<template>
  <input
    :value="props.modelValue"
    :class="
      cn(
        'border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
        props.class,
      )
    "
    @input="onInput"
  />
</template>
