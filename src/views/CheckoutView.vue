<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircle2, Loader2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import PayPanel from '@/components/app/PayPanel.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { orderApi, walletApi } from '@/lib/endpoints'
import type { Order } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()
const { cycleLabel } = useCycleLabel()

const order = ref<Order | null>(null)
const balanceCents = ref(0)
const loading = ref(true)
const error = ref<string | null>(null)
const cancelling = ref(false)

const orderId = computed(() => Number(route.params.id))
const payable = computed(() => order.value?.status === 'pending')

async function loadAll() {
  const [fetched, wallet] = await Promise.all([
    orderApi.get(orderId.value),
    walletApi.overview(),
  ])
  order.value = fetched
  balanceCents.value = wallet.balance_cents
}

async function cancel() {
  if (!order.value) return
  cancelling.value = true
  try {
    await orderApi.cancel(order.value.id)
    toast.success(t('checkout.cancelled'))
    await router.push({ name: 'shop' })
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    cancelling.value = false
  }
}

/** PayPanel 结算完成后刷新订单与余额，成功卡片由 order.status 驱动保留。 */
async function onPaid() {
  await Promise.all([auth.refresh(), loadAll()])
  toast.success(t('checkout.success'))
}

onMounted(async () => {
  if (!Number.isFinite(orderId.value) || orderId.value <= 0) {
    // 没有订单号时无从结账，退回购物车。
    await router.replace({ name: 'cart' })
    return
  }
  try {
    await loadAll()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('checkout.title')" />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="3" />

    <template v-else-if="order">
      <!-- 支付成功：余额或外部渠道结算后订单已变为已付 -->
      <Card v-if="order.status === 'paid'">
        <CardContent class="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 class="text-success size-12" />
          <div class="space-y-1">
            <p class="text-lg font-semibold">{{ t('checkout.success') }}</p>
            <p class="text-muted-foreground text-sm">{{ t('checkout.successHint') }}</p>
          </div>
          <div class="flex flex-wrap justify-center gap-3">
            <Button as-child>
              <RouterLink :to="{ name: 'services' }">{{ t('checkout.viewServices') }}</RouterLink>
            </Button>
            <Button variant="outline" as-child>
              <RouterLink :to="{ name: 'invoices' }">
                {{ t('checkout.viewInvoice') }}
              </RouterLink>
            </Button>
          </div>
        </CardContent>
      </Card>

      <template v-else>
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center justify-between gap-2 text-base">
              <span>{{ t('checkout.summary') }}</span>
              <StateBadge kind="order" :value="order.status" />
            </CardTitle>
            <p class="text-muted-foreground text-xs">
              {{ t('checkout.orderNo') }}：<span class="tabular">{{ order.order_no }}</span>
            </p>
          </CardHeader>

          <CardContent class="space-y-4">
            <div
              v-for="item in order.items ?? []"
              :key="item.id"
              class="flex items-center justify-between gap-4 text-sm"
            >
              <div class="min-w-0">
                <p class="truncate font-medium">{{ item.product_name }}</p>
                <p class="text-muted-foreground text-xs">
                  {{ cycleLabel(item.billing_cycle) }} ×
                  <span class="tabular">{{ item.quantity }}</span>
                </p>
              </div>
              <Money :cents="item.price_cents * item.quantity" />
            </div>

            <Separator />

            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">{{ t('cart.total') }}</span>
              <Money :cents="order.total_cents" class="text-xl font-semibold" />
            </div>
          </CardContent>
        </Card>

        <PayPanel
          v-if="payable"
          :total-cents="order.total_cents"
          :balance-cents="balanceCents"
          purpose="order"
          :target-id="order.id"
          @paid="onPaid"
        />

        <div v-if="payable" class="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" :disabled="cancelling" @click="cancel">
            <Loader2 v-if="cancelling" class="animate-spin" />
            {{ t('checkout.cancelOrder') }}
          </Button>
        </div>
      </template>
    </template>
  </div>
</template>
