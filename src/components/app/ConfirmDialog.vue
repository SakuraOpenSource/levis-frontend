<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2 } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    /** 删除类操作传 danger，确认按钮走 destructive 样式。 */
    danger?: boolean
    /** 执行中：按钮禁用并在确认按钮上转菊花。 */
    confirming?: boolean
  }>(),
  {
    danger: false,
    confirming: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

const { t } = useI18n()
const cancelLabel = computed(() => props.cancelText || t('common.cancel'))
const confirmLabel = computed(() => props.confirmText || t('common.confirm'))
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ props.title }}</DialogTitle>
        <DialogDescription>{{ props.description }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button type="button" variant="outline" :disabled="props.confirming" @click="emit('update:open', false)">
          {{ cancelLabel }}
        </Button>
        <Button
          type="button"
          :variant="props.danger ? 'destructive' : 'default'"
          :disabled="props.confirming"
          @click="emit('confirm')"
        >
          <Loader2 v-if="props.confirming" class="animate-spin" />
          {{ confirmLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
