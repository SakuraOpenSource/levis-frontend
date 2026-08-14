<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2 } from 'lucide-vue-next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useCycleLabel } from '@/composables/useCycleLabel'
import type { Product } from '@/lib/types'

const props = defineProps<{ product: Product; pending?: boolean }>()
const emit = defineEmits<{ add: [product: Product] }>()

const { t } = useI18n()
const { priceLabel, cycleLabel } = useCycleLabel()

/** stock 为负表示不限；恰好为 0 才是售罄。 */
const soldOut = computed(() => props.product.stock === 0)
const stockText = computed(() =>
  props.product.stock < 0 ? t('common.unlimited') : String(props.product.stock),
)
/** 历史商品没有规格字段，后端会返回 null。 */
const specs = computed(() => props.product.specs ?? [])
</script>

<template>
  <Card class="gap-4 py-5">
    <CardHeader class="px-5">
      <CardTitle class="flex items-start justify-between gap-2 text-base">
        <span class="min-w-0 break-words">{{ props.product.name }}</span>
        <Badge variant="secondary">{{ cycleLabel(props.product.billing_cycle) }}</Badge>
      </CardTitle>
      <CardDescription v-if="props.product.description" class="whitespace-pre-line">
        {{ props.product.description }}
      </CardDescription>
    </CardHeader>

    <CardContent class="px-5">
      <!-- 规格行：左侧名称固定宽度，右侧内容右对齐，多张卡片并排时列能对齐 -->
      <dl v-if="specs.length" class="mb-4 space-y-1.5 text-sm">
        <div v-for="(spec, index) in specs" :key="index" class="flex items-baseline gap-3">
          <dt class="text-muted-foreground w-16 shrink-0 text-xs">{{ spec.label }}</dt>
          <dd class="min-w-0 flex-1 break-words text-right">{{ spec.value }}</dd>
        </div>
      </dl>

      <p class="text-xl font-semibold tabular">
        {{ priceLabel(props.product.price_cents, props.product.billing_cycle) }}
      </p>
      <p class="text-muted-foreground mt-1 text-xs">{{ t('shop.stock') }}：{{ stockText }}</p>
    </CardContent>

    <CardFooter class="px-5">
      <Button class="w-full" :disabled="soldOut || props.pending" @click="emit('add', props.product)">
        <Loader2 v-if="props.pending" class="animate-spin" />
        {{ soldOut ? t('shop.soldOut') : t('shop.addToCart') }}
      </Button>
    </CardFooter>
  </Card>
</template>
