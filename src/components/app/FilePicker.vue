<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Paperclip, X } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { formatBytes } from '@/lib/utils'

/**
 * 附件选择器。数量与单文件大小在这里就拦下来，不等提交后由后端报错 ——
 * 用户传了个 30 MiB 的文件，等上传完再告诉他超限是很糟的体验。
 *
 * 校验放在组件里而不是各页面里：三个上传入口共用同一份上限判断，
 * 分散写迟早有一处漏掉。
 */
const props = withDefaults(
  defineProps<{
    /** 已选文件，由父组件持有。 */
    modelValue: File[]
    max: number
    maxBytes: number
    accept?: string
    disabled?: boolean
  }>(),
  { accept: undefined, disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [File[]]
  /** 校验不通过时把文案交给页面展示，组件自己不弹提示。 */
  reject: [string]
}>()

const { t } = useI18n()
const input = ref<HTMLInputElement | null>(null)

function pick() {
  input.value?.click()
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const picked = Array.from(target.files ?? [])
  // 立刻清空 input：同一个文件被移除后再次选中也要能触发 change。
  target.value = ''
  if (!picked.length) return

  const oversized = picked.find((file) => file.size > props.maxBytes)
  if (oversized) {
    emit('reject', t('tickets.fileTooLarge', {
      name: oversized.name,
      size: formatBytes(props.maxBytes),
    }))
    return
  }
  const merged = [...props.modelValue, ...picked]
  if (merged.length > props.max) {
    emit('reject', t('tickets.tooManyFiles', { count: props.max }))
    return
  }
  emit('update:modelValue', merged)
}

function remove(index: number) {
  const next = [...props.modelValue]
  next.splice(index, 1)
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="space-y-2">
    <input
      ref="input"
      type="file"
      class="hidden"
      multiple
      :accept="props.accept"
      @change="onChange"
    />
    <Button
      type="button"
      variant="outline"
      size="sm"
      :disabled="props.disabled || props.modelValue.length >= props.max"
      @click="pick"
    >
      <Paperclip />
      {{ t('tickets.pickFiles') }}
    </Button>

    <ul v-if="props.modelValue.length" class="space-y-1">
      <li
        v-for="(file, index) in props.modelValue"
        :key="`${file.name}-${index}`"
        class="bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2 text-sm"
      >
        <Paperclip class="text-muted-foreground size-4 shrink-0" />
        <span class="truncate">{{ file.name }}</span>
        <span class="text-muted-foreground shrink-0 text-xs tabular">
          {{ formatBytes(file.size) }}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="ml-auto size-7 shrink-0"
          :aria-label="t('tickets.remove')"
          :disabled="props.disabled"
          @click="remove(index)"
        >
          <X />
        </Button>
      </li>
    </ul>
  </div>
</template>
