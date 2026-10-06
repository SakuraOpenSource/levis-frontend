<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Loader2, RefreshCcw } from 'lucide-vue-next'
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
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { affiliateApi } from '@/lib/endpoints'
import type { AffiliateSettings, AffiliateWithdrawal, AffiliateWithdrawalStatus } from '@/lib/types'
import { formatCents, formatDateTime, parseMoneyCents } from '@/lib/utils'

const toast = useToast()
const enabled = ref(false)
const rate = ref('')
const minimum = ref('')
const ready = ref(false)
const loading = ref(true)
const busy = ref(false)
const error = ref<string | null>(null)
const rows = ref<AffiliateWithdrawal[]>([])
const page = ref(1)
const total = ref(0)
const status = ref<AffiliateWithdrawalStatus | ''>('pending')
const reviewRemark = ref('')
const confirmOpen = ref(false)
const pending = ref<{ kind: 'settings'; settings: AffiliateSettings } | { kind: 'review'; row: AffiliateWithdrawal; action: 'approve' | 'reject'; remark: string } | null>(null)
const rateBps = computed(() => parseMoneyCents(rate.value))
const minimumCents = computed(() => parseMoneyCents(minimum.value))
const validSettings = computed(() => ready.value && rateBps.value !== null && rateBps.value <= 10000 && minimumCents.value !== null && minimumCents.value > 0)
const statusLabels = { pending: '待审核', approved: '已转入 Levis 钱包', rejected: '已拒绝 / 已解冻' }
const confirmDescription = computed(() => {
  if (!pending.value) return ''
  if (pending.value.kind === 'settings') return `确认${pending.value.settings.enabled ? '启用' : '关闭'}推广计划，佣金比例 ${(pending.value.settings.rate_bps / 100).toFixed(2)}%，最低结算 ${formatCents(pending.value.settings.min_withdrawal_cents)}。新设置由后端生效，历史流水不改写。`
  const p = pending.value
  return p.action === 'approve' ? `确认通过申请 #${p.row.id}，将 ${formatCents(p.row.amount_cents)} 转入用户 #${p.row.user_id} 的 Levis 钱包。不是外部打款，审核为最终操作，请核实申请。` : `确认拒绝申请 #${p.row.id}，释放 ${formatCents(p.row.amount_cents)} 预留佣金。原因：${p.remark}`
})
function applySettings(settings: AffiliateSettings) {
  enabled.value = settings.enabled
  rate.value = (settings.rate_bps / 100).toFixed(2)
  minimum.value = (settings.min_withdrawal_cents / 100).toFixed(2)
  ready.value = true
}
async function loadRows(target = page.value) {
  const result = await affiliateApi.adminWithdrawals({ page: target, page_size: 20, status: status.value })
  rows.value = result.items ?? []
  total.value = result.total
  page.value = result.page
}
async function load(target = page.value, settings = true) {
  if (busy.value) return
  loading.value = true
  error.value = null
  try {
    if (settings) applySettings(await affiliateApi.settings())
    await loadRows(target)
  } catch (err) { error.value = errorMessage(err) }
  finally { loading.value = false }
}
function askSettings() {
  if (!validSettings.value || busy.value) return
  pending.value = { kind: 'settings', settings: { enabled: enabled.value, rate_bps: rateBps.value!, min_withdrawal_cents: minimumCents.value! } }
  confirmOpen.value = true
}
function askReview(row: AffiliateWithdrawal, action: 'approve' | 'reject') {
  if (busy.value || row.status !== 'pending') return
  if (action === 'reject' && !reviewRemark.value.trim()) { error.value = '拒绝申请必须填写审核原因'; return }
  pending.value = { kind: 'review', row: { ...row }, action, remark: reviewRemark.value.trim() }
  confirmOpen.value = true
}
async function confirmAction() {
  if (busy.value || !pending.value || !confirmOpen.value) return
  const target = pending.value
  busy.value = true
  error.value = null
  try {
    if (target.kind === 'settings') {
      await affiliateApi.saveSettings(target.settings)
      applySettings(await affiliateApi.settings())
      toast.success('推广设置已保存')
    } else {
      await affiliateApi.review(target.row.id, { action: target.action, remark: target.remark })
      await loadRows()
      reviewRemark.value = ''
      toast.success(target.action === 'approve' ? '已转入用户 Levis 钱包' : '已拒绝并释放预留佣金')
    }
    confirmOpen.value = false
    pending.value = null
  } catch (err) { error.value = errorMessage(err) }
  finally { busy.value = false }
}
onMounted(() => load())
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="AFF 推广与结算" description="管理推广规则，审核佣金转入钱包申请。所有金额均以整数分结算。">
      <template #actions><Button variant="outline" size="sm" :disabled="loading || busy" @click="() => load()"><RefreshCcw />刷新</Button></template>
    </PageHeader>
    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading && !ready" />
    <Card v-if="ready"><CardContent class="space-y-4">
      <div class="flex items-center justify-between gap-4"><div><h2 class="font-semibold text-sm">推广设置</h2><p class="text-xs text-muted-foreground">AFF 与代理折扣独立，历史订单费率以流水快照为准。</p></div><div class="flex items-center gap-2"><Label for="affiliate-enabled">启用</Label><Switch id="affiliate-enabled" v-model="enabled" :disabled="busy" /></div></div>
      <div class="grid gap-4 sm:grid-cols-2"><div class="space-y-2"><Label for="affiliate-rate">佣金比例（%）</Label><Input id="affiliate-rate" v-model="rate" inputmode="decimal" :disabled="busy" /><p class="text-xs text-muted-foreground">0–100%，最多两位小数，按整数基点保存。</p></div><div class="space-y-2"><Label for="affiliate-minimum">最低结算金额（元）</Label><Input id="affiliate-minimum" v-model="minimum" inputmode="decimal" :disabled="busy" /><p class="text-xs text-muted-foreground">正数，最多两位小数；禁止自动四舍五入。</p></div></div>
      <Button data-testid="save-settings" :disabled="busy || !validSettings" @click="askSettings"><Loader2 v-if="busy" class="animate-spin" />保存推广设置</Button>
    </CardContent></Card>
    <div class="rounded-lg border bg-muted/40 p-4 text-sm leading-6">审核通过仅将佣金转入申请人的 <strong>Levis 钱包</strong>，不表示银行卡或任何外部账户已付款。审核前核对金额、用户和订单；最终审核后不能重复处理。</div>
    <div class="flex flex-wrap items-end gap-4"><div class="space-y-2"><Label for="affiliate-filter">申请状态</Label><select id="affiliate-filter" v-model="status" class="h-9 rounded-md border bg-background px-3 text-sm" :disabled="loading || busy" @change="() => load(1, false)"><option value="">全部</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已拒绝</option></select></div><div class="min-w-48 flex-1 space-y-2"><Label for="review-remark">本次审核说明（拒绝必填）</Label><Input id="review-remark" v-model="reviewRemark" maxlength="500" :disabled="busy" placeholder="填写核查结论或拒绝原因" /></div></div>
    <LoadingBlock v-if="loading && ready" :rows="2" />
    <div v-else class="overflow-hidden rounded-lg border"><Table><TableHeader><TableRow><TableHead>申请 / 用户</TableHead><TableHead>金额</TableHead><TableHead>状态</TableHead><TableHead>备注</TableHead><TableHead>申请时间</TableHead><TableHead class="text-right">审核</TableHead></TableRow></TableHeader><TableBody>
      <TableEmpty v-if="!rows.length" :colspan="6">暂无符合条件的申请</TableEmpty>
      <TableRow v-for="row in rows" :key="row.id"><TableCell>#{{ row.id }}<p class="text-muted-foreground text-xs">用户 #{{ row.user_id }}</p></TableCell><TableCell><Money :cents="row.amount_cents" /></TableCell><TableCell><Badge variant="outline">{{ statusLabels[row.status] ?? row.status }}</Badge></TableCell><TableCell class="max-w-64 whitespace-normal text-xs">{{ row.account }}<p>{{ row.remark }}</p><p class="text-muted-foreground">{{ row.review_remark }}</p></TableCell><TableCell class="text-xs">{{ formatDateTime(row.created_at) }}</TableCell><TableCell class="text-right"><div v-if="row.status === 'pending'" class="flex justify-end gap-2"><Button :data-testid="`approve-${row.id}`" size="sm" :disabled="busy" @click="askReview(row, 'approve')">通过并入钱包</Button><Button size="sm" variant="outline" :disabled="busy || !reviewRemark.trim()" @click="askReview(row, 'reject')">拒绝</Button></div><span v-else class="text-xs text-muted-foreground">已完成审核</span></TableCell></TableRow>
    </TableBody></Table></div>
    <Pager :page="page" :page-size="20" :total="total" @change="(p) => load(p, false)" />
    <ConfirmDialog v-model:open="confirmOpen" :title="pending?.kind === 'settings' ? '确认推广设置' : '确认最终审核'" :description="confirmDescription" :confirming="busy" :danger="pending?.kind === 'review' && pending.action === 'reject'" @confirm="confirmAction" />
  </div>
</template>
