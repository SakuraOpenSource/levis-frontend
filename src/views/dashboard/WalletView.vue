<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info, Loader2, Wallet as WalletIcon, ExternalLink, RefreshCcw } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { paymentApi, walletApi } from '@/lib/endpoints'
import { formatDateTime } from '@/lib/utils'
import type { ExternalPayment, PaymentMethod, Transaction, WalletOverview } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()

const overview = ref<WalletOverview | null>(null)
const items = ref<Transaction[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref<string | null>(null)

const amountYuan = ref('100')
const methods = ref<PaymentMethod[]>([])
const selectedMethod = ref('')
const payment = ref<ExternalPayment | null>(null)
const recharging = ref(false)
const querying = ref(false)

const TX_LABELS: Record<Transaction['type'], string> = {
  recharge: 'wallet.typeRecharge',
  payment: 'wallet.typePayment',
  refund: 'wallet.typeRefund',
  adjust: 'wallet.typeAdjust',
}

/** 元 → 分。四舍五入避免 19.99 * 100 = 1998.9999 这类浮点误差。 */
const amountCents = computed(() => Math.round(Number(amountYuan.value) * 100))

async function loadTransactions(target = page.value) {
  const result = await walletApi.transactions({ page: target, page_size: pageSize.value })
  items.value = result.items ?? []
  total.value = result.total
  page.value = result.page
  pageSize.value = result.page_size
}

async function changePage(target: number) {
  loading.value = true
  try {
    await loadTransactions(target)
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function recharge() {
  if (!Number.isFinite(amountCents.value) || amountCents.value <= 0) {
    toast.error(t('error.required'))
    return
  }
  if (!selectedMethod.value) {
    toast.error(t('payment.methodRequired'))
    return
  }
  recharging.value = true
  error.value = null
  try {
    payment.value = await paymentApi.create('recharge', 0, selectedMethod.value, amountCents.value)
    if (payment.value.pay_url) window.open(payment.value.pay_url, '_blank', 'noopener,noreferrer')
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    recharging.value = false
  }
}

function openPayment() {
  if (payment.value?.pay_url) window.open(payment.value.pay_url, '_blank', 'noopener,noreferrer')
}

async function queryPayment() {
  if (!payment.value) return
  querying.value = true
  try {
    payment.value = await paymentApi.query(payment.value.id)
    if (payment.value.status === 'paid') {
      const [wallet] = await Promise.all([walletApi.overview(), loadTransactions(1), auth.refresh()])
      overview.value = wallet
      toast.success(t('payment.paid'))
    }
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    querying.value = false
  }
}

onMounted(async () => {
  try {
    const [wallet, availableMethods] = await Promise.all([
      walletApi.overview(),
      paymentApi.methods(),
    ])
    await loadTransactions()
    overview.value = wallet
    methods.value = availableMethods
    selectedMethod.value = availableMethods[0]?.id ?? ''
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('wallet.title')" :description="t('wallet.subtitle')" />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading && !overview" :rows="4" />

    <template v-else>
      <div class="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <WalletIcon class="size-4" />
              {{ t('wallet.balance') }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Money :cents="overview?.balance_cents ?? 0" class="text-3xl font-semibold" />
            <p class="text-muted-foreground mt-2 text-xs">
              {{ t('dashboard.invoices') }}
              <span class="tabular">{{ overview?.unpaid_invoice_count ?? 0 }}</span>
              ·
              {{ t('dashboard.unpaidTotal') }}
              <Money :cents="overview?.unpaid_total_cents ?? 0" />
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="text-base">{{ t('wallet.recharge') }}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <Alert>
              <Info />
              <AlertDescription>{{ t('payment.externalHint') }}</AlertDescription>
            </Alert>
            <div class="space-y-2">
              <Label for="wallet-payment-method">{{ t('payment.method') }}</Label>
              <select id="wallet-payment-method" v-model="selectedMethod" class="border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none" :disabled="!methods.length || recharging">
                <option value="" disabled>{{ methods.length ? t('payment.selectMethod') : t('payment.unavailable') }}</option>
                <option v-for="method in methods" :key="method.id" :value="method.id">{{ method.name }}</option>
              </select>
            </div>
            <form class="flex items-end gap-3" @submit.prevent="recharge">
              <div class="flex-1 space-y-2">
                <Label for="amount">{{ t('wallet.rechargeAmount') }}</Label>
                <Input id="amount" v-model="amountYuan" type="number" min="0.01" step="0.01" />
              </div>
              <Button type="submit" :disabled="recharging || !methods.length">
                <Loader2 v-if="recharging" class="animate-spin" />
                {{ recharging ? t('payment.creating') : t('wallet.recharge') }}
              </Button>
            </form>
            <div v-if="payment" class="space-y-3 rounded-lg border p-3 text-sm">
              <div class="flex items-center justify-between gap-3">
                <span>{{ t('payment.status') }}</span>
                <span :class="payment.status === 'failed' ? 'text-destructive' : 'font-medium'">{{ t(`payment.${payment.status}`) }}</span>
              </div>
              <p v-if="payment.status === 'failed'" class="text-destructive text-xs">{{ payment.failure_reason || t('payment.failed') }}</p>
              <div v-if="payment.status === 'pending'" class="flex flex-wrap gap-2">
                <Button v-if="payment.pay_url" variant="outline" size="sm" @click="openPayment">
                  <ExternalLink />
                  {{ t('payment.open') }}
                </Button>
                <Button variant="outline" size="sm" :disabled="querying" @click="queryPayment">
                  <RefreshCcw :class="querying ? 'animate-spin' : ''" />
                  {{ querying ? t('payment.querying') : t('payment.query') }}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('wallet.type') }}</TableHead>
                <TableHead class="text-right">{{ t('wallet.amount') }}</TableHead>
                <TableHead class="text-right">{{ t('wallet.balanceAfter') }}</TableHead>
                <TableHead>{{ t('wallet.note') }}</TableHead>
                <TableHead>{{ t('wallet.time') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="5">{{ t('wallet.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="font-medium">{{ t(TX_LABELS[item.type]) }}</TableCell>
                <TableCell class="text-right">
                  <Money :cents="item.amount_cents" signed class="font-medium" />
                </TableCell>
                <TableCell class="text-right">
                  <Money :cents="item.balance_after_cents" />
                </TableCell>
                <TableCell class="text-muted-foreground max-w-60 truncate text-xs">
                  {{ item.note || '-' }}
                </TableCell>
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ formatDateTime(item.created_at) }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pager :page="page" :page-size="pageSize" :total="total" @change="changePage" />
    </template>
  </div>
</template>
