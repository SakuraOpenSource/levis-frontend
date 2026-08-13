<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { orderApi } from '@/lib/endpoints'
import type { CartItem } from '@/lib/types'
import { useCartStore } from '@/stores/cart'

const { t } = useI18n()
const router = useRouter()
const cart = useCartStore()
const toast = useToast()
const { cycleLabel } = useCycleLabel()

const error = ref<string | null>(null)
const loading = ref(true)
/** 正在改动的条目 ID，避免连点造成数量错乱。 */
const busy = ref<number | null>(null)
const creating = ref(false)

const MAX_QUANTITY = 99

async function changeQuantity(item: CartItem, delta: number) {
  const next = item.quantity + delta
  if (next < 1 || next > MAX_QUANTITY) return
  busy.value = item.id
  try {
    await cart.updateQuantity(item.id, next)
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    busy.value = null
  }
}

async function remove(item: CartItem) {
  busy.value = item.id
  try {
    await cart.remove(item.id)
    toast.success(t('cart.removed'))
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    busy.value = null
  }
}

/** 下单后购物车已被后端清空，跳到结账页支付。 */
async function checkout() {
  creating.value = true
  try {
    const order = await orderApi.create()
    cart.clear()
    await router.push({ name: 'checkout', params: { id: order.id } })
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  try {
    await cart.load()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('cart.title')" />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="3" />

    <div
      v-else-if="cart.isEmpty"
      class="text-muted-foreground flex flex-col items-center gap-3 py-16"
    >
      <ShoppingCart class="size-10" />
      <p class="text-sm">{{ t('cart.empty') }}</p>
      <Button variant="outline" as-child>
        <RouterLink :to="{ name: 'shop' }">{{ t('cart.goShop') }}</RouterLink>
      </Button>
    </div>

    <template v-else>
      <Card>
        <CardContent class="space-y-4">
          <div
            v-for="item in cart.items"
            :key="item.id"
            class="flex flex-wrap items-center gap-4 border-b pb-4 last:border-0 last:pb-0"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ item.product?.name ?? '-' }}</p>
              <p class="text-muted-foreground text-xs">
                {{ cycleLabel(item.billing_cycle) }} ·
                {{ t('cart.unitPrice') }}
                <Money :cents="item.product?.price_cents ?? 0" />
              </p>
            </div>

            <div class="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                class="size-8"
                :disabled="busy === item.id || item.quantity <= 1"
                :aria-label="t('cart.quantity')"
                @click="changeQuantity(item, -1)"
              >
                <Minus />
              </Button>
              <span class="w-10 text-center text-sm tabular">{{ item.quantity }}</span>
              <Button
                variant="outline"
                size="icon"
                class="size-8"
                :disabled="busy === item.id || item.quantity >= MAX_QUANTITY"
                :aria-label="t('cart.quantity')"
                @click="changeQuantity(item, 1)"
              >
                <Plus />
              </Button>
            </div>

            <Money
              :cents="(item.product?.price_cents ?? 0) * item.quantity"
              class="w-24 text-right font-medium"
            />

            <Button
              variant="ghost"
              size="icon"
              class="size-8"
              :disabled="busy === item.id"
              :aria-label="t('common.delete')"
              @click="remove(item)"
            >
              <Loader2 v-if="busy === item.id" class="animate-spin" />
              <Trash2 v-else class="text-destructive" />
            </Button>
          </div>

          <Separator />

          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ t('cart.total') }}</span>
            <Money :cents="cart.totalCents" class="text-xl font-semibold" />
          </div>
        </CardContent>
      </Card>

      <div class="flex justify-end gap-3">
        <Button variant="outline" as-child>
          <RouterLink :to="{ name: 'shop' }">{{ t('cart.goShop') }}</RouterLink>
        </Button>
        <Button :disabled="creating" @click="checkout">
          <Loader2 v-if="creating" class="animate-spin" />
          {{ t('cart.checkout') }}
        </Button>
      </div>
    </template>
  </div>
</template>
