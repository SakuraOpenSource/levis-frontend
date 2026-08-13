<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowRight, FileText, Package, Wallet } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCycleLabel } from '@/composables/useCycleLabel'
import { errorMessage } from '@/lib/api'
import { serviceApi, walletApi } from '@/lib/endpoints'
import { formatDate, formatDateTime, isZeroTime } from '@/lib/utils'
import type { Service, Transaction, WalletOverview } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const { cycleLabel } = useCycleLabel()

const overview = ref<WalletOverview | null>(null)
const services = ref<Service[]>([])
const transactions = ref<Transaction[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const TX_LABELS: Record<Transaction['type'], string> = {
  recharge: 'wallet.typeRecharge',
  payment: 'wallet.typePayment',
  refund: 'wallet.typeRefund',
  adjust: 'wallet.typeAdjust',
}

onMounted(async () => {
  try {
    const [wallet, serviceList, txList] = await Promise.all([
      walletApi.overview(),
      serviceApi.list({ page_size: 5 }),
      walletApi.transactions({ page_size: 5 }),
    ])
    overview.value = wallet
    services.value = serviceList.items ?? []
    transactions.value = txList.items ?? []
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="t('dashboard.welcome', { name: auth.user?.username ?? '' })"
      :description="t('dashboard.subtitle')"
    />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else>
      <!-- 三张概览卡，均可点击跳到对应页面 -->
      <div class="grid gap-4 sm:grid-cols-3">
        <RouterLink :to="{ name: 'services' }" class="group focus-visible:outline-none">
          <Card class="group-hover:border-primary group-focus-visible:ring-ring/50 h-full gap-3 py-5 transition-colors group-focus-visible:ring-[3px]">
            <CardHeader class="px-5">
              <CardTitle class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <Package class="size-4" />
                {{ t('dashboard.services') }}
              </CardTitle>
            </CardHeader>
            <CardContent class="px-5">
              <p class="text-2xl font-semibold tabular">
                {{ overview?.active_service_count ?? 0 }}
              </p>
              <p class="text-muted-foreground mt-1 text-xs">{{ t('dashboard.servicesUnit') }}</p>
            </CardContent>
          </Card>
        </RouterLink>

        <RouterLink :to="{ name: 'wallet' }" class="group focus-visible:outline-none">
          <Card class="group-hover:border-primary group-focus-visible:ring-ring/50 h-full gap-3 py-5 transition-colors group-focus-visible:ring-[3px]">
            <CardHeader class="px-5">
              <CardTitle class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <Wallet class="size-4" />
                {{ t('dashboard.balance') }}
              </CardTitle>
            </CardHeader>
            <CardContent class="px-5">
              <Money :cents="overview?.balance_cents ?? 0" class="text-2xl font-semibold" />
              <p class="text-muted-foreground mt-1 text-xs">{{ t('dashboard.balanceHint') }}</p>
            </CardContent>
          </Card>
        </RouterLink>

        <RouterLink :to="{ name: 'invoices' }" class="group focus-visible:outline-none">
          <Card class="group-hover:border-primary group-focus-visible:ring-ring/50 h-full gap-3 py-5 transition-colors group-focus-visible:ring-[3px]">
            <CardHeader class="px-5">
              <CardTitle class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <FileText class="size-4" />
                {{ t('dashboard.invoices') }}
              </CardTitle>
            </CardHeader>
            <CardContent class="px-5">
              <p class="text-2xl font-semibold tabular">
                {{ overview?.unpaid_invoice_count ?? 0 }}
              </p>
              <p class="text-muted-foreground mt-1 text-xs">
                {{ t('dashboard.unpaidTotal') }}
                <Money :cents="overview?.unpaid_total_cents ?? 0" />
              </p>
            </CardContent>
          </Card>
        </RouterLink>
      </div>

      <!-- 最近服务 -->
      <Card>
        <CardHeader class="flex-row items-center justify-between">
          <CardTitle class="text-base">{{ t('dashboard.recentServices') }}</CardTitle>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink :to="{ name: 'services' }">
              {{ t('dashboard.viewAll') }}
              <ArrowRight />
            </RouterLink>
          </Button>
        </CardHeader>
        <CardContent>
          <p v-if="!services.length" class="text-muted-foreground py-4 text-sm">
            {{ t('services.empty') }}
          </p>
          <ul v-else class="divide-y">
            <li v-for="item in services" :key="item.id" class="flex items-center gap-3 py-3">
              <div class="min-w-0 flex-1">
                <RouterLink
                  :to="{ name: 'service-detail', params: { id: item.id } }"
                  class="truncate font-medium hover:underline"
                >
                  {{ item.name }}
                </RouterLink>
                <p class="text-muted-foreground text-xs">
                  {{ cycleLabel(item.billing_cycle) }}
                  <template v-if="!isZeroTime(item.next_due_at)">
                    · {{ t('services.nextDue') }} {{ formatDate(item.next_due_at) }}
                  </template>
                </p>
              </div>
              <StateBadge kind="service" :value="item.status" />
              <Money :cents="item.price_cents" class="w-20 text-right text-sm" />
            </li>
          </ul>
        </CardContent>
      </Card>

      <!-- 最近流水 -->
      <Card>
        <CardHeader class="flex-row items-center justify-between">
          <CardTitle class="text-base">{{ t('dashboard.recentTransactions') }}</CardTitle>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink :to="{ name: 'wallet' }">
              {{ t('dashboard.viewAll') }}
              <ArrowRight />
            </RouterLink>
          </Button>
        </CardHeader>
        <CardContent>
          <p v-if="!transactions.length" class="text-muted-foreground py-4 text-sm">
            {{ t('wallet.empty') }}
          </p>
          <ul v-else class="divide-y">
            <li v-for="item in transactions" :key="item.id" class="flex items-center gap-3 py-3">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium">{{ t(TX_LABELS[item.type]) }}</p>
                <p class="text-muted-foreground text-xs">{{ formatDateTime(item.created_at) }}</p>
              </div>
              <Money :cents="item.amount_cents" signed class="text-sm font-medium" />
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
