<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Copy, Gift, Loader2, RefreshCcw } from 'lucide-vue-next'
import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { affiliateApi } from '@/lib/endpoints'
import type { AffiliateCommission, AffiliateSummary, AffiliateWithdrawal } from '@/lib/types'
import { formatCents, formatDateTime, parseMoneyCents } from '@/lib/utils'

const toast = useToast()
const summary = ref<AffiliateSummary | null>(null)
const loading = ref(true)
const busy = ref(false)
const error = ref<string | null>(null)
const ledgerError = ref<string | null>(null)
const ledgerLoading = ref(false)
const commissions = ref<AffiliateCommission[]>([])
const withdrawals = ref<AffiliateWithdrawal[]>([])
const commissionPage = ref(1)
const commissionTotal = ref(0)
const withdrawalPage = ref(1)
const withdrawalTotal = ref(0)
const amount = ref('')
const remark = ref('')
const confirmOpen = ref(false)
const pendingAmount = ref(0)
const pendingRemark = ref('')
const amountCents = computed(() => parseMoneyCents(amount.value))
const canWithdraw = computed(() => !!summary.value?.code && summary.value.settings.enabled &&
  amountCents.value !== null && amountCents.value > 0 &&
  amountCents.value >= summary.value.settings.min_withdrawal_cents &&
  amountCents.value <= summary.value.balance_cents && remark.value.length <= 500)
const referralLink = computed(() => {
  if (!summary.value?.code) return ''
  const url = new URL('/register', window.location.origin)
  url.searchParams.set('ref', summary.value.code)
  return url.toString()
})
const statusLabels = { pending: '审核中 · 已预留', approved: '已转入钱包', rejected: '已拒绝 · 已解冻' }

async function loadCommissions(page = commissionPage.value) {
  const result = await affiliateApi.commissions({ page, page_size: 20 })
  commissions.value = result.items ?? []
  commissionTotal.value = result.total
  commissionPage.value = result.page
}
async function loadWithdrawals(page = withdrawalPage.value) {
  const result = await affiliateApi.withdrawals({ page, page_size: 20 })
  withdrawals.value = result.items ?? []
  withdrawalTotal.value = result.total
  withdrawalPage.value = result.page
}
async function loadLedgers(kind?: 'commissions' | 'withdrawals', page?: number) {
  if (ledgerLoading.value) return
  ledgerLoading.value = true
  ledgerError.value = null
  try {
    if (kind === 'commissions') await loadCommissions(page)
    else if (kind === 'withdrawals') await loadWithdrawals(page)
    else await Promise.all([loadCommissions(), loadWithdrawals()])
  } catch (err) { ledgerError.value = errorMessage(err) }
  finally { ledgerLoading.value = false }
}
async function load() {
  loading.value = true
  error.value = null
  try {
    summary.value = await affiliateApi.summary()
    if (summary.value.code) await loadLedgers()
  } catch (err) { error.value = errorMessage(err) }
  finally { loading.value = false }
}
async function join() {
  if (busy.value) return
  busy.value = true
  error.value = null
  try {
    await affiliateApi.join()
    summary.value = await affiliateApi.summary()
    await loadLedgers()
    toast.success('已加入推广计划')
  } catch (err) { error.value = errorMessage(err) }
  finally { busy.value = false }
}
async function copy(value: string) {
  try { await navigator.clipboard.writeText(value); toast.success('已复制') }
  catch { toast.error('无法访问剪贴板，请选择文本手动复制') }
}
function requestWithdrawal() {
  if (!canWithdraw.value || busy.value) return
  pendingAmount.value = amountCents.value!
  pendingRemark.value = remark.value.trim()
  confirmOpen.value = true
}
async function confirmWithdrawal() {
  if (busy.value || !confirmOpen.value) return
  busy.value = true
  error.value = null
  try {
    await affiliateApi.requestWithdrawal({ amount_cents: pendingAmount.value, account: 'Levis 钱包', remark: pendingRemark.value })
    confirmOpen.value = false
    amount.value = ''
    remark.value = ''
    // 写入后读取权威余额与预留状态，不能本地相减模拟成功。
    summary.value = await affiliateApi.summary()
    await loadLedgers('withdrawals', 1)
    toast.success('申请已提交，审核通过后转入 Levis 钱包')
  } catch (err) { error.value = errorMessage(err) }
  finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="推广计划 AFF" description="邀请新用户，查看真实佣金与结算记录。推广收益独立于代理等级权益。">
      <template #actions><Button variant="outline" size="sm" :disabled="loading || busy" @click="load"><RefreshCcw />刷新</Button></template>
    </PageHeader>
    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="3" />
    <template v-else-if="summary">
      <div v-if="!summary.settings.enabled" class="rounded-lg border bg-muted/40 p-4 text-sm">推广计划当前已关闭。历史记录仍可查看，暂停加入与新结算申请。</div>
      <Card v-if="!summary.code">
        <CardContent class="flex flex-col items-center gap-4 py-8 text-center">
          <Gift class="size-10 text-primary" />
          <h2 class="font-semibold">分享服务，获得推广佣金</h2>
          <p class="max-w-lg text-sm text-muted-foreground">当前佣金比例 {{ (summary.settings.rate_bps / 100).toFixed(2) }}%；最低结算 <Money :cents="summary.settings.min_withdrawal_cents" />。注册归因及订单退款以系统记录为准。</p>
          <Button :disabled="busy || !summary.settings.enabled" @click="join"><Loader2 v-if="busy" class="animate-spin" />加入推广计划</Button>
        </CardContent>
      </Card>
      <template v-else>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardContent><p class="text-xs text-muted-foreground">已邀请注册</p><p class="mt-2 text-2xl font-semibold tabular">{{ summary.referral_count }} <span class="text-sm font-normal">人</span></p></CardContent></Card>
          <Card><CardContent><p class="text-xs text-muted-foreground">可申请结算</p><p class="mt-2 text-2xl font-semibold"><Money :cents="summary.balance_cents" /></p></CardContent></Card>
          <Card><CardContent><p class="text-xs text-muted-foreground">审核预留金额</p><p class="mt-2 text-2xl font-semibold"><Money :cents="summary.pending_cents" /></p></CardContent></Card>
          <Card><CardContent><p class="text-xs text-muted-foreground">累计佣金（退款冲正后）</p><p class="mt-2 text-2xl font-semibold"><Money :cents="summary.total_earned_cents" /></p></CardContent></Card>
        </div>
        <Card><CardContent class="space-y-4">
          <div class="flex flex-wrap items-center gap-2"><h2 class="text-sm font-semibold">专属邀请码</h2><code class="rounded bg-muted px-3 py-1">{{ summary.code }}</code><Button variant="outline" size="sm" @click="copy(summary.code)"><Copy />复制邀请码</Button><Badge variant="outline">佣金 {{ (summary.settings.rate_bps / 100).toFixed(2) }}%</Badge></div>
          <div class="flex flex-col gap-2 sm:flex-row"><Input :model-value="referralLink" readonly aria-label="推广注册链接" /><Button variant="outline" @click="copy(referralLink)"><Copy />复制推广链接</Button></div>
          <p class="text-xs text-muted-foreground">链接中的 ref 会保留到注册成功；佣金仅在符合条件的订单实际支付后入账，退款会冲正。</p>
        </CardContent></Card>
        <Card><CardContent class="space-y-4">
          <h2 class="text-sm font-semibold">佣金结算到钱包</h2>
          <p class="text-sm text-muted-foreground">审核通过后转入本人 Levis 钱包，用于站内消费；此操作不是银行卡、支付宝等外部打款。提交申请会预留余额，拒绝后释放。</p>
          <div class="flex flex-wrap items-end gap-3">
            <div class="space-y-2"><Label for="withdrawal-amount">申请金额（元）</Label><Input id="withdrawal-amount" v-model="amount" inputmode="decimal" placeholder="例如 10.29" :disabled="busy" /></div>
            <div class="min-w-48 flex-1 space-y-2"><Label for="withdrawal-remark">备注（选填）</Label><Input id="withdrawal-remark" v-model="remark" maxlength="500" :disabled="busy" /></div>
            <Button data-testid="request-withdrawal" :disabled="busy || !canWithdraw" @click="requestWithdrawal">申请结算</Button>
          </div>
          <p class="text-xs text-muted-foreground">最低 <Money :cents="summary.settings.min_withdrawal_cents" />；最多 <Money :cents="summary.balance_cents" />。仅接受正数及最多两位小数。</p>
        </CardContent></Card>
        <ErrorAlert :message="ledgerError" />
        <Tabs default-value="commissions" class="space-y-4">
          <TabsList><TabsTrigger value="commissions">佣金流水</TabsTrigger><TabsTrigger value="withdrawals">结算历史</TabsTrigger></TabsList>
          <LoadingBlock v-if="ledgerLoading" :rows="2" />
          <TabsContent value="commissions" class="space-y-4">
            <div class="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow><TableHead>订单</TableHead><TableHead>佣金</TableHead><TableHead>已冲正</TableHead><TableHead>比例</TableHead><TableHead>入账时间</TableHead></TableRow></TableHeader><TableBody>
              <TableEmpty v-if="!commissions.length" :colspan="5">暂无佣金记录 · 真实订单付款后会自动记录</TableEmpty>
              <TableRow v-for="row in commissions" :key="row.id"><TableCell>#{{ row.order_id }}</TableCell><TableCell><Money :cents="row.amount_cents" /></TableCell><TableCell><Money :cents="row.reversed_cents" /></TableCell><TableCell>{{ (row.rate_bps / 100).toFixed(2) }}%</TableCell><TableCell class="text-xs">{{ formatDateTime(row.created_at) }}</TableCell></TableRow>
            </TableBody></Table></div>
            <Pager :page="commissionPage" :page-size="20" :total="commissionTotal" @change="(p) => loadLedgers('commissions', p)" />
          </TabsContent>
          <TabsContent value="withdrawals" class="space-y-4">
            <div class="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow><TableHead>申请</TableHead><TableHead>金额</TableHead><TableHead>状态</TableHead><TableHead>备注 / 审核说明</TableHead><TableHead>申请时间</TableHead></TableRow></TableHeader><TableBody>
              <TableEmpty v-if="!withdrawals.length" :colspan="5">暂无结算申请</TableEmpty>
              <TableRow v-for="row in withdrawals" :key="row.id"><TableCell>#{{ row.id }}</TableCell><TableCell><Money :cents="row.amount_cents" /></TableCell><TableCell><Badge variant="outline">{{ statusLabels[row.status] ?? row.status }}</Badge></TableCell><TableCell class="max-w-64 whitespace-normal text-xs">{{ row.remark || '—' }}<p class="text-muted-foreground">{{ row.review_remark }}</p></TableCell><TableCell class="text-xs">{{ formatDateTime(row.created_at) }}</TableCell></TableRow>
            </TableBody></Table></div>
            <Pager :page="withdrawalPage" :page-size="20" :total="withdrawalTotal" @change="(p) => loadLedgers('withdrawals', p)" />
          </TabsContent>
        </Tabs>
      </template>
    </template>
    <ConfirmDialog v-model:open="confirmOpen" title="确认佣金结算申请" :description="`申请 ${formatCents(pendingAmount)} 转入本人 Levis 钱包。余额将被预留，审核通过才会入账；不执行外部打款。`" :confirming="busy" confirm-text="确认申请" @confirm="confirmWithdrawal" />
  </div>
</template>
