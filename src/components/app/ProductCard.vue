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
