<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ImagePlus } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { formatBytes } from '@/lib/utils'

/**
 * 单张照片选择器，带预览。证件照正反面各用一个。
 *
 * 与多文件的 FilePicker 分开：这里的关键是「看清选的是哪张」，而不是管理一个
 * 列表 —— 上传证件照时选错正反面是最常见的失误。
 */
const props = withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: File | null
    maxBytes: number
    /** 已提交过的照片地址；未选新文件时显示它。 */
    currentUrl?: string
    disabled?: boolean
  }>(),
  { currentUrl: undefined, disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [File | null]
  reject: [string]
}>()

const { t } = useI18n()
const input = ref<HTMLInputElement | null>(null)
const objectUrl = ref<string | null>(null)

// 选中的文件优先，其次才是已提交的旧照片。
const preview = computed(() => objectUrl.value ?? props.currentUrl ?? null)

function release() {
  if (objectUrl.value) {
    URL.revokeObjectURL(objectUrl.value)
    objectUrl.value = null
  }
}

// 父组件清空选择（例如提交成功后重置表单）时，预览也要跟着回到旧照片。
watch(
  () => props.modelValue,
  (file) => {
    if (!file) release()
  },
)

onBeforeUnmount(release)

function pick() {
  input.value?.click()
}

function onChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  target.value = ''
  if (!file) return

  // 类型与大小都在这里先拦一道：等 8 MiB 传完再被后端拒掉太浪费。
  // 真正的判定仍在服务端按文件内容嗅探，前端这层只为体验。
  if (!file.type.startsWith('image/')) {
    emit('reject', t('kyc.photoTypeError', { name: file.name }))
    return
  }
  if (file.size > props.maxBytes) {
    emit('reject', t('tickets.fileTooLarge', { name: file.name, size: formatBytes(props.maxBytes) }))
    return
  }

  release()
  objectUrl.value = URL.createObjectURL(file)
  emit('update:modelValue', file)
}
</script>

<template>
  <div class="space-y-2">
    <Label :for="props.id">{{ props.label }}</Label>
    <input
      :id="props.id"
      ref="input"
      type="file"
      class="hidden"
      accept="image/jpeg,image/png,image/webp"
      @change="onChange"
    />

    <button
      type="button"
      class="border-input bg-muted/30 hover:bg-muted/60 focus-visible:ring-ring/50 flex aspect-[8/5] w-full items-center justify-center overflow-hidden rounded-md border border-dashed transition-colors focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-60"
      :disabled="props.disabled"
      :aria-label="props.label"
      @click="pick"
    >
      <img v-if="preview" :src="preview" :alt="props.label" class="size-full object-contain" />
      <span v-else class="text-muted-foreground flex flex-col items-center gap-2 text-xs">
        <ImagePlus class="size-6" />
        {{ t('kyc.pickPhoto') }}
      </span>
    </button>

    <div v-if="props.modelValue" class="text-muted-foreground flex items-center gap-2 text-xs">
      <span class="truncate">{{ props.modelValue.name }}</span>
      <span class="shrink-0 tabular">{{ formatBytes(props.modelValue.size) }}</span>
    </div>
    <Button
      v-if="preview"
      type="button"
      variant="ghost"
      size="sm"
      :disabled="props.disabled"
      @click="pick"
    >
      {{ t('kyc.replacePhoto') }}
    </Button>
  </div>
</template>
