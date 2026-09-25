<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Copy, Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-vue-next'

import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
import { adminApi } from '@/lib/endpoints'
import { formatDateTime } from '@/lib/utils'
import type { Coupon, CouponStatus, CouponType, Product } from '@/lib/types'

const { t } = useI18n()
const toast = useToast()

const items = ref<Coupon[]>([])
const products = ref<Product[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const status = ref<CouponStatus | 'all'>('all')
const loading = ref(true)
const error = ref<string | null>(null)
const deleting = ref<number | null>(null)

const dialogOpen = ref(false)
const editing = ref<Coupon | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
/** 生成模式：批量生成（code 自动），否则手写 code。 */
const generateMode = ref(false)
const generateCount = ref('10')

/**
 * 表单一律用字符串持有：金额以元输入（后端要分），时间用
 * datetime-local（提交时转 ISO）。
 */
const form = reactive({
  code: '',
  name: '',
  type: 'percent' as CouponType,
  percentOff: '20',
  amountYuan: '10.00',
  maxDiscountYuan: '0.00',
  minOrderYuan: '0.00',
  status: 'active' as CouponStatus,
  startsAt: '',
  expiresAt: '',
  maxUses: '0',
  maxUsesPerUser: '1',
  newUserOnly: false,
  productIds: [] as number[],
})

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    const result = await adminApi.coupons({
      page: target,
      page_size: pageSize.value,
      status: status.value === 'all' ? '' : status.value,
    })
    items.value = result.items ?? []
    total.value = result.total
    page.value = result.page
    pageSize.value = result.page_size
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

async function loadProducts() {
  try {
    const result = await adminApi.products({ page: 1, page_size: 100 })
    products.value = (result.items ?? []).filter((p) => p.status === 'active')
  } catch {
    products.value = []
  }
}

/** 元字符串 → 分；非法输入按 0 处理。 */
function yuanToCents(raw: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

/** datetime-local（本地时区）→ ISO；空串转 null。 */
function localToIso(raw: string): string | null {
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function openCreate() {
  editing.value = null
  generateMode.value = false
  formError.value = null
  Object.assign(form, {
    code: '',
    name: '',
    type: 'percent' as CouponType,
    percentOff: '20',
    amountYuan: '10.00',
    maxDiscountYuan: '0.00',
    minOrderYuan: '0.00',
    status: 'active' as CouponStatus,
    startsAt: '',
    expiresAt: '',
    maxUses: '0',
    maxUsesPerUser: '1',
    newUserOnly: false,
    productIds: [],
  })
  dialogOpen.value = true
}

function openEdit(item: Coupon) {
  editing.value = item
  generateMode.value = false
  formError.value = null
  Object.assign(form, {
    code: item.code,
    name: item.name,
    type: item.type,
    percentOff: String(item.percent_off || 20),
    amountYuan: (item.amount_cents / 100).toFixed(2),
    maxDiscountYuan: (item.max_discount_cents / 100).toFixed(2),
    minOrderYuan: (item.min_order_cents / 100).toFixed(2),
    status: item.status,
    startsAt: item.starts_at ? toLocalInput(item.starts_at) : '',
    expiresAt: item.expires_at ? toLocalInput(item.expires_at) : '',
    maxUses: String(item.max_uses),
    maxUsesPerUser: String(item.max_uses_per_user),
    newUserOnly: item.new_user_only,
    productIds: [...(item.product_ids ?? [])],
  })
  dialogOpen.value = true
}

/** ISO → datetime-local 的 value 格式（本地时区，分钟精度）。 */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 手工切换 code 框内容时大写化，减少后端 400。 */
function onCodeInput(e: Event) {
  const input = e.target as HTMLInputElement
  form.code = input.value.toUpperCase()
}

function buildPayload() {
  return {
    code: form.code.trim(),
    name: form.name.trim(),
    type: form.type,
    percent_off: Math.trunc(Number(form.percentOff) || 0),
    amount_cents: yuanToCents(form.amountYuan),
    max_discount_cents: yuanToCents(form.maxDiscountYuan),
    min_order_cents: yuanToCents(form.minOrderYuan),
    status: form.status,
    starts_at: localToIso(form.startsAt),
    expires_at: localToIso(form.expiresAt),
    max_uses: Math.max(0, Math.trunc(Number(form.maxUses) || 0)),
    max_uses_per_user: Math.max(0, Math.trunc(Number(form.maxUsesPerUser) || 0)),
    new_user_only: form.newUserOnly,
    product_ids: [...form.productIds],
  }
}

async function save() {
  formError.value = null
  if (!generateMode.value && !editing.value && !form.code.trim()) {
    formError.value = t('error.required')
    return
  }
  if (generateMode.value) {
    const count = Math.trunc(Number(generateCount) || 0)
    if (count < 1 || count > 100) {
      formError.value = t('couponsAdmin.generateHint')
      return
    }
    saving.value = true
    try {
      const payload = buildPayload()
      delete (payload as { code?: string }).code
      await adminApi.generateCoupons({ ...payload, count })
      toast.success(t('couponsAdmin.generated', { count }))
      dialogOpen.value = false
      await load(1)
    } catch (err) {
      formError.value = errorMessage(err)
    } finally {
      saving.value = false
    }
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      await adminApi.updateCoupon(editing.value.id, buildPayload())
      toast.success(t('common.saved'))
    } else {
      await adminApi.createCoupon(buildPayload())
      toast.success(t('common.created'))
    }
    dialogOpen.value = false
    await load()
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    toast.success(`${code} →`)
  } catch {
    toast.error(code)
  }
}

const confirmOpen = ref(false)
const confirmTarget = ref<Coupon | null>(null)

function askRemove(item: Coupon) {
  confirmTarget.value = item
  confirmOpen.value = true
}

async function remove() {
  const item = confirmTarget.value
  confirmOpen.value = false
  if (!item) return
  deleting.value = item.id
  try {
    await adminApi.deleteCoupon(item.id)
    toast.success(t('common.deleted'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    deleting.value = null
  }
}

/** 减免规则摘要：8 折 / 减 ¥10（封顶 ¥50）。 */
function ruleText(item: Coupon): string {
  if (item.type === 'percent') {
    const base = `${item.percent_off}%`
    return item.max_discount_cents > 0
      ? `${base} · ${t('couponsAdmin.maxDiscountYuan')} ¥${(item.max_discount_cents / 100).toFixed(2)}`
      : base
  }
  return `¥${(item.amount_cents / 100).toFixed(2)}`
}

function windowText(item: Coupon): string {
  const start = item.starts_at ? formatDateTime(item.starts_at) : '—'
  const end = item.expires_at ? formatDateTime(item.expires_at) : '—'
  if (!item.starts_at && !item.expires_at) return t('couponsAdmin.forever')
  return `${start} ~ ${end}`
}

function usesText(item: Coupon): string {
  const used = item.used_count
  const max = item.max_uses > 0 ? `${item.max_uses}` : '∞'
  return `${used} / ${max}`
}

onMounted(() => {
  void load()
  void loadProducts()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('couponsAdmin.title')" :description="t('couponsAdmin.subtitle')">
      <template #actions>
        <Button size="sm" variant="outline" @click="openCreate(); generateMode = true">
          <Sparkles />
          {{ t('couponsAdmin.generate') }}
        </Button>
        <Button size="sm" @click="openCreate">
          <Plus />
          {{ t('couponsAdmin.newCoupon') }}
        </Button>
      </template>
    </PageHeader>

    <div class="flex max-w-xs items-center gap-2">
      <Label for="coupon-status" class="shrink-0 text-sm">{{ t('couponsAdmin.status') }}</Label>
      <Select v-model="status" @update:model-value="load(1)">
        <SelectTrigger id="coupon-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{{ t('tickets.filterAll') }}</SelectItem>
          <SelectItem value="active">{{ t('couponsAdmin.statusActive') }}</SelectItem>
          <SelectItem value="disabled">{{ t('couponsAdmin.statusDisabled') }}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="5" />

    <template v-else>
      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('couponsAdmin.code') }}</TableHead>
                <TableHead>{{ t('couponsAdmin.name') }}</TableHead>
                <TableHead>减免</TableHead>
                <TableHead>限制</TableHead>
                <TableHead>{{ t('couponsAdmin.status') }}</TableHead>
                <TableHead>{{ t('couponsAdmin.usedCount') }}</TableHead>
                <TableHead>有效期</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="8">{{ t('common.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell>
                  <button
                    type="button"
                    class="group inline-flex items-center gap-1 font-mono text-sm font-medium"
                    :title="t('common.copy')"
                    @click="copyCode(item.code)"
                  >
                    {{ item.code }}
                    <Copy class="text-muted-foreground size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </TableCell>
                <TableCell class="max-w-40 truncate text-sm">{{ item.name || '—' }}</TableCell>
                <TableCell class="text-sm">{{ ruleText(item) }}</TableCell>
                <TableCell>
                  <div class="flex flex-wrap gap-1">
                    <Badge v-if="item.min_order_cents > 0" variant="secondary" class="text-xs">
                      满 ¥{{ (item.min_order_cents / 100).toFixed(0) }}
                    </Badge>
                    <Badge v-if="item.new_user_only" variant="secondary" class="text-xs">新用户</Badge>
                    <Badge v-if="item.max_uses_per_user > 0" variant="secondary" class="text-xs">
                      每人 {{ item.max_uses_per_user }}{{ t('couponsAdmin.times') }}
                    </Badge>
                    <Badge v-if="(item.product_ids ?? []).length > 0" variant="secondary" class="text-xs">
                      {{ (item.product_ids ?? []).length }} 个商品
                    </Badge>
                    <Badge v-if="!(item.product_ids ?? []).length" variant="outline" class="text-xs">
                      {{ t('couponsAdmin.allProducts') }}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge :variant="item.status === 'active' ? 'success' : 'secondary'">
                    {{ item.status === 'active' ? t('couponsAdmin.statusActive') : t('couponsAdmin.statusDisabled') }}
                  </Badge>
                </TableCell>
                <TableCell class="text-sm tabular">{{ usesText(item) }}</TableCell>
                <TableCell class="text-xs tabular text-muted-foreground">{{ windowText(item) }}</TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :aria-label="t('common.edit')"
                      @click="openEdit(item)"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :disabled="deleting === item.id"
                      :aria-label="t('common.delete')"
                      @click="askRemove(item)"
                    >
                      <Loader2 v-if="deleting === item.id" class="animate-spin" />
                      <Trash2 v-else class="text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pager :page="page" :page-size="pageSize" :total="total" @change="load" />
    </template>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {{ generateMode ? t('couponsAdmin.generate') : editing ? t('couponsAdmin.editCoupon') : t('couponsAdmin.newCoupon') }}
          </DialogTitle>
          <DialogDescription>{{ t('couponsAdmin.preview') }}</DialogDescription>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="save">
          <ErrorAlert :message="formError" />

          <div class="grid gap-4 sm:grid-cols-2">
            <div v-if="generateMode" class="space-y-2">
              <Label for="c-count">{{ t('couponsAdmin.generateCount') }}</Label>
              <Input id="c-count" v-model="generateCount" type="number" min="1" max="100" />
              <p class="text-xs text-muted-foreground">{{ t('couponsAdmin.generateHint') }}</p>
            </div>
            <div v-else class="space-y-2">
              <Label for="c-code">{{ t('couponsAdmin.code') }}</Label>
              <Input
                id="c-code"
                v-model="form.code"
                :disabled="!!editing"
                maxlength="64"
                autocomplete="off"
                class="font-mono uppercase"
                @input="onCodeInput"
              />
              <p class="text-xs text-muted-foreground">
                {{ editing ? t('couponsAdmin.codeHint') : '' }}
              </p>
            </div>
            <div class="space-y-2">
              <Label for="c-name">{{ t('couponsAdmin.name') }}</Label>
              <Input id="c-name" v-model="form.name" maxlength="128" :placeholder="t('couponsAdmin.nameHint')" />
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="c-type">{{ t('couponsAdmin.type') }}</Label>
              <Select v-model="form.type">
                <SelectTrigger id="c-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">{{ t('couponsAdmin.typePercent') }}</SelectItem>
                  <SelectItem value="fixed">{{ t('couponsAdmin.typeFixed') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="form.type === 'percent'" class="space-y-2">
              <Label for="c-percent">{{ t('couponsAdmin.percentOff') }}</Label>
              <Input id="c-percent" v-model="form.percentOff" type="number" min="1" max="99" />
            </div>
            <div v-else class="space-y-2">
              <Label for="c-amount">{{ t('couponsAdmin.amountYuan') }}</Label>
              <Input id="c-amount" v-model="form.amountYuan" type="number" min="0.01" step="0.01" />
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div v-if="form.type === 'percent'" class="space-y-2">
              <Label for="c-cap">{{ t('couponsAdmin.maxDiscountYuan') }}</Label>
              <Input id="c-cap" v-model="form.maxDiscountYuan" type="number" min="0" step="0.01" />
              <p class="text-xs text-muted-foreground">{{ t('couponsAdmin.maxDiscountHint') }}</p>
            </div>
            <div class="space-y-2">
              <Label for="c-min">{{ t('couponsAdmin.minOrderYuan') }}</Label>
              <Input id="c-min" v-model="form.minOrderYuan" type="number" min="0" step="0.01" />
              <p class="text-xs text-muted-foreground">{{ t('couponsAdmin.minOrderHint') }}</p>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="c-start">{{ t('couponsAdmin.startsAt') }}</Label>
              <Input id="c-start" v-model="form.startsAt" type="datetime-local" />
            </div>
            <div class="space-y-2">
              <Label for="c-expire">{{ t('couponsAdmin.expiresAt') }}</Label>
              <Input id="c-expire" v-model="form.expiresAt" type="datetime-local" />
            </div>
          </div>
          <p class="text-xs text-muted-foreground">{{ t('couponsAdmin.timeHint') }}</p>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="c-maxuses">{{ t('couponsAdmin.maxUses') }}</Label>
              <Input id="c-maxuses" v-model="form.maxUses" type="number" min="0" />
              <p class="text-xs text-muted-foreground">{{ t('couponsAdmin.maxUsesHint') }}</p>
            </div>
            <div class="space-y-2">
              <Label for="c-peruser">{{ t('couponsAdmin.maxUsesPerUser') }}</Label>
              <Input id="c-peruser" v-model="form.maxUsesPerUser" type="number" min="0" />
              <p class="text-xs text-muted-foreground">{{ t('couponsAdmin.maxUsesPerUserHint') }}</p>
            </div>
          </div>

          <div class="flex items-center justify-between gap-4 rounded-md border px-3 py-2">
            <div class="space-y-0.5">
              <Label for="c-newuser">{{ t('couponsAdmin.newUserOnly') }}</Label>
              <p class="text-muted-foreground text-xs">{{ t('couponsAdmin.newUserHint') }}</p>
            </div>
            <Switch id="c-newuser" v-model="form.newUserOnly" />
          </div>

          <div class="space-y-2">
            <Label>{{ t('couponsAdmin.products') }}</Label>
            <div class="grid max-h-40 gap-1.5 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
              <label
                v-for="p in products"
                :key="p.id"
                class="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  class="accent-primary size-4"
                  :value="p.id"
                  v-model="form.productIds"
                />
                <span class="truncate">{{ p.name }}</span>
              </label>
            </div>
            <p class="text-xs text-muted-foreground">{{ t('couponsAdmin.productsHint') }}</p>
          </div>

          <div class="space-y-2">
            <Label for="c-status">{{ t('couponsAdmin.status') }}</Label>
            <Select v-model="form.status">
              <SelectTrigger id="c-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{{ t('couponsAdmin.statusActive') }}</SelectItem>
                <SelectItem value="disabled">{{ t('couponsAdmin.statusDisabled') }}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" @click="dialogOpen = false">
              {{ t('common.cancel') }}
            </Button>
            <Button type="submit" :disabled="saving">
              <Loader2 v-if="saving" class="animate-spin" />
              {{ t('common.save') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="t('common.delete')"
      :description="(confirmTarget ? t('couponsAdmin.deleteConfirm', { name: confirmTarget.code }) : '') + ' ' + t('couponsAdmin.deleteHint')"
      :confirm-text="t('common.delete')"
      danger
      @confirm="remove"
    />
  </div>
</template>
