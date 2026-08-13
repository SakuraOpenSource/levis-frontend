<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'

const props = defineProps<{ page: number; pageSize: number; total: number }>()
const emit = defineEmits<{ change: [page: number] }>()

const { t } = useI18n()

const lastPage = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const canPrev = computed(() => props.page > 1)
const canNext = computed(() => props.page < lastPage.value)
</script>

<template>
  <div v-if="total > pageSize" class="flex items-center justify-between gap-4">
    <p class="text-muted-foreground text-sm">{{ t('common.total', { count: total }) }}</p>
    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        :disabled="!canPrev"
        :aria-label="t('common.prev')"
        @click="emit('change', page - 1)"
      >
        <ChevronLeft />
        {{ t('common.prev') }}
      </Button>
      <span class="text-sm tabular">{{ page }} / {{ lastPage }}</span>
      <Button
        variant="outline"
        size="sm"
        :disabled="!canNext"
        :aria-label="t('common.next')"
        @click="emit('change', page + 1)"
      >
        {{ t('common.next') }}
        <ChevronRight />
      </Button>
    </div>
  </div>
</template>
