<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info, Loader2, Wallet as WalletIcon } from 'lucide-vue-next'

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
import { walletApi } from '@/lib/endpoints'
import { formatDateTime } from '@/lib/utils'
import type { Transaction, WalletOverview } from '@/lib/types'
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
const recharging = ref(false)

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
  recharging.value = true
  try {
    await walletApi.recharge(amountCents.value)
    // 余额、流水、顶栏三处都要刷新，否则显示会不一致。
    const [wallet] = await Promise.all([walletApi.overview(), loadTransactions(1), auth.refresh()])
    overview.value = wallet
    toast.success(t('wallet.recharged'))
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    recharging.value = false
  }
}

onMounted(async () => {
  try {
    const [wallet] = await Promise.all([walletApi.overview(), loadTransactions()])
    overview.value = wallet
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
              <AlertDescription>{{ t('wallet.rechargeHint') }}</AlertDescription>
            </Alert>
            <form class="flex items-end gap-3" @submit.prevent="recharge">
              <div class="flex-1 space-y-2">
                <Label for="amount">{{ t('wallet.rechargeAmount') }}</Label>
                <Input id="amount" v-model="amountYuan" type="number" min="0.01" step="0.01" />
              </div>
              <Button type="submit" :disabled="recharging">
                <Loader2 v-if="recharging" class="animate-spin" />
                {{ recharging ? t('wallet.recharging') : t('wallet.recharge') }}
              </Button>
            </form>
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
