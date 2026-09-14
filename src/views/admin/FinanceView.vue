<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-vue-next'

import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import Pager from '@/components/app/Pager.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import StateBadge from '@/components/app/StateBadge.vue'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import { formatDateTime, isZeroTime } from '@/lib/utils'
import type {
  AdminInvoiceDetail,
  Invoice,
  InvoiceStatus,
  PaymentMethodAdmin,
  PaymentPlugin,
} from '@/lib/types'

const { t } = useI18n()
const toast = useToast()

const loading = ref(true)
const error = ref<string | null>(null)
const methods = ref<PaymentMethodAdmin[]>([])
const plugins = ref<PaymentPlugin[]>([])

const dialogOpen = ref(false)
const editing = ref<PaymentMethodAdmin | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)

const form = reactive({
  name: '',
  plugin_id: '',
  enabled: true,
  sort_order: 0,
  config: {} as Record<string, string>,
})

const selectedPlugin = computed(() => plugins.value.find((p) => p.id === form.plugin_id))
const selectedFields = computed(() => selectedPlugin.value?.config ?? [])
const exampleNotifyUrl = computed(() => {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  if (editing.value) return `${base}/api/plugin/v1/payment-notify/${editing.value.plugin_id}/${editing.value.id}`
  if (form.plugin_id) return `${base}/api/plugin/v1/payment-notify/${form.plugin_id}/{id}`
  return `${base}/api/plugin/v1/payment-notify/epay/{id}`
})

function pluginName(id: string) {
  return plugins.value.find((p) => p.id === id)?.name ?? id
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const [m, p] = await Promise.all([adminApi.paymentMethods(), adminApi.paymentPlugins()])
    methods.value = m
    plugins.value = p
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  formError.value = null
  form.name = ''
  form.plugin_id = plugins.value[0]?.id ?? ''
  form.enabled = true
  form.sort_order = 0
  form.config = {}
  // 初始化 config 键
  const fields = plugins.value.find((p) => p.id === form.plugin_id)?.config ?? []
  for (const f of fields) {
    form.config[f.key] = f.default_value ?? ''
  }
  dialogOpen.value = true
}

function openEdit(item: PaymentMethodAdmin) {
  editing.value = item
  formError.value = null
  form.name = item.name
  form.plugin_id = item.plugin_id
  form.enabled = item.enabled
  form.sort_order = item.sort_order
  // 克隆配置，未覆盖的字段补默认值
  form.config = { ...item.config }
  const fields = plugins.value.find((p) => p.id === form.plugin_id)?.config ?? []
  for (const f of fields) {
    if (!(f.key in form.config)) form.config[f.key] = f.default_value ?? ''
  }
  dialogOpen.value = true
}

function onPluginChange(val: string) {
  form.plugin_id = val
  const fields = plugins.value.find((p) => p.id === val)?.config ?? []
  const next: Record<string, string> = {}
  for (const f of fields) {
    // 保留已填写的同名键
    next[f.key] = form.config[f.key] ?? f.default_value ?? ''
  }
  form.config = next
}

async function save() {
  if (!form.name.trim()) {
    formError.value = t('error.required')
    return
  }
  if (!form.plugin_id) {
    formError.value = t('admin.paymentPluginHint')
    return
  }
  saving.value = true
  formError.value = null
  try {
    const payload = {
      name: form.name.trim(),
      plugin_id: form.plugin_id,
      config: { ...form.config },
      enabled: form.enabled,
      sort_order: Number(form.sort_order) || 0,
    }
    if (editing.value) {
      await adminApi.updatePaymentMethod(editing.value.id, payload)
      toast.success(t('common.updated'))
    } else {
      await adminApi.createPaymentMethod(payload)
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

const confirmOpen = ref(false)
const confirmTarget = ref<PaymentMethodAdmin | null>(null)

function askRemove(item: PaymentMethodAdmin) {
  confirmTarget.value = item
  confirmOpen.value = true
}

async function remove() {
  const item = confirmTarget.value
  confirmOpen.value = false
  if (!item) return
  try {
    await adminApi.deletePaymentMethod(item.id)
    toast.success(t('common.deleted'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  }
}

const tab = ref<'methods' | 'invoices'>('methods')

const invItems = ref<Invoice[]>([])
const invTotal = ref(0)
const invPage = ref(1)
const invPageSize = ref(20)
const invLoading = ref(false)
const invError = ref<string | null>(null)
const invStatus = ref<InvoiceStatus | 'all'>('all')
const invUserId = ref('')
const invDetailOpen = ref(false)
const invDetail = ref<AdminInvoiceDetail | null>(null)
const invDetailLoading = ref(false)

const INV_STATUSES: InvoiceStatus[] = ['unpaid', 'paid', 'cancelled']

async function loadInvoices(target = invPage.value) {
  invLoading.value = true
  invError.value = null
  try {
    const userId = Number(invUserId.value)
    const result = await adminApi.invoices({
      page: target,
      page_size: invPageSize.value,
      user_id: invUserId.value.trim() && Number.isFinite(userId) && userId > 0 ? userId : undefined,
      status: invStatus.value === 'all' ? undefined : invStatus.value,
    })
    invItems.value = result.items ?? []
    invTotal.value = result.total
    invPage.value = result.page
    invPageSize.value = result.page_size
  } catch (err) {
    invError.value = errorMessage(err)
  } finally {
    invLoading.value = false
  }
}

async function openInvoice(id: number) {
  invDetail.value = null
  invDetailLoading.value = true
  invDetailOpen.value = true
  try {
    invDetail.value = await adminApi.invoice(id)
  } catch (err) {
    toast.error(errorMessage(err))
    invDetailOpen.value = false
  } finally {
    invDetailLoading.value = false
  }
}

onMounted(() => {
  load()
  loadInvoices()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('admin.financeTitle')" :description="t('admin.financeSubtitle')">
      <template #actions>
        <Button v-if="tab === 'methods'" @click="openCreate">
          <Plus />
          {{ t('admin.newPaymentMethod') }}
        </Button>
      </template>
    </PageHeader>

    <Tabs v-model="tab">
      <TabsList>
        <TabsTrigger value="methods">{{ t('adminInvoices.tabMethods') }}</TabsTrigger>
        <TabsTrigger value="invoices">{{ t('adminInvoices.tabInvoices') }}</TabsTrigger>
      </TabsList>
      <TabsContent value="methods">
    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else>
      <Card v-if="plugins.length === 0" class="border-dashed">
        <CardContent class="py-8 text-center text-sm text-muted-foreground">
          {{ t('admin.noPaymentPluginsHint') }}
        </CardContent>
      </Card>

      <Card v-else class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>{{ t('admin.paymentMethodName') }}</TableHead>
                <TableHead>{{ t('admin.paymentPlugin') }}</TableHead>
                <TableHead>回调地址</TableHead>
                <TableHead>{{ t('admin.paymentMethodSort') }}</TableHead>
                <TableHead>{{ t('common.status') }}</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!methods.length" :colspan="7">{{ t('admin.noPaymentMethods') }}</TableEmpty>
              <TableRow v-for="item in methods" v-else :key="item.id">
                <TableCell class="font-mono text-xs">{{ item.id }}</TableCell>
                <TableCell class="font-medium">{{ item.name }}</TableCell>
                <TableCell>{{ pluginName(item.plugin_id) }}</TableCell>
                <TableCell class="max-w-[260px] truncate font-mono text-xs" :title="`/api/plugin/v1/payment-notify/${item.plugin_id}/${item.id}`">
                  /api/plugin/v1/payment-notify/{{ item.plugin_id }}/{{ item.id }}
                </TableCell>
                <TableCell>{{ item.sort_order }}</TableCell>
                <TableCell>
                  <Badge :variant="item.enabled ? 'default' : 'secondary'">
                    {{ item.enabled ? t('admin.paymentMethodEnabled') : t('admin.paymentMethodDisabled') }}
                  </Badge>
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" class="size-8" @click="openEdit(item)">
                      <Pencil class="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" class="size-8" @click="askRemove(item)">
                      <Trash2 class="text-destructive size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </template>
      </TabsContent>
      <TabsContent value="invoices" class="space-y-4">
        <Card class="py-0">
          <CardContent class="flex flex-wrap items-end gap-3 py-4">
            <div class="space-y-1.5">
              <Label>{{ t('adminInvoices.status') }}</Label>
              <Select
                :model-value="invStatus"
                @update:model-value="(v: any) => { invStatus = v as InvoiceStatus | 'all'; loadInvoices(1) }"
              >
                <SelectTrigger class="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{{ t('tickets.filterAll') }}</SelectItem>
                  <SelectItem v-for="st in INV_STATUSES" :key="st" :value="st">
                    {{ t(`invoiceStatus.${st}`) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <Label for="inv-user">{{ t('adminInvoices.payer') }} ID</Label>
              <Input
                id="inv-user"
                v-model="invUserId"
                class="w-36"
                inputmode="numeric"
                @keyup.enter="loadInvoices(1)"
              />
            </div>
            <Button variant="outline" @click="loadInvoices(1)">{{ t('common.search') }}</Button>
          </CardContent>
        </Card>

        <ErrorAlert :message="invError" />
        <LoadingBlock v-if="invLoading" :rows="4" />

        <template v-else>
          <Card class="py-0">
            <CardContent class="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{{ t('adminInvoices.invoiceNo') }}</TableHead>
                    <TableHead>{{ t('adminInvoices.payer') }}</TableHead>
                    <TableHead>{{ t('adminInvoices.orderId') }}</TableHead>
                    <TableHead>{{ t('adminInvoices.status') }}</TableHead>
                    <TableHead class="text-right">{{ t('adminInvoices.total') }}</TableHead>
                    <TableHead>{{ t('adminInvoices.paidAt') }}</TableHead>
                    <TableHead>{{ t('adminInvoices.createdAt') }}</TableHead>
                    <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableEmpty v-if="!invItems.length" :colspan="8">{{ t('adminInvoices.empty') }}</TableEmpty>
                  <TableRow v-for="item in invItems" v-else :key="item.id">
                    <TableCell class="font-medium tabular">{{ item.invoice_no }}</TableCell>
                    <TableCell class="tabular">#{{ item.user_id }}</TableCell>
                    <TableCell class="tabular">{{ item.order_id ?? '-' }}</TableCell>
                    <TableCell><StateBadge kind="invoice" :value="item.status" /></TableCell>
                    <TableCell class="text-right"><Money :cents="item.total_cents" /></TableCell>
                    <TableCell class="tabular">
                      {{ isZeroTime(item.paid_at) ? '-' : formatDateTime(item.paid_at) }}
                    </TableCell>
                    <TableCell class="text-muted-foreground text-xs tabular">
                      {{ formatDateTime(item.created_at) }}
                    </TableCell>
                    <TableCell class="text-right">
                      <Button variant="ghost" size="sm" @click="openInvoice(item.id)">
                        {{ t('common.detail') }}
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Pager :page="invPage" :page-size="invPageSize" :total="invTotal" @change="loadInvoices" />
        </template>
      </TabsContent>
    </Tabs>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{{ editing ? t('admin.editPaymentMethod') : t('admin.newPaymentMethod') }}</DialogTitle>
          <DialogDescription>{{ t('admin.paymentConfig') }}</DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <ErrorAlert :message="formError" />

          <div class="space-y-2">
            <Label>{{ t('admin.paymentMethodName') }} *</Label>
            <Input v-model="form.name" :placeholder="t('admin.paymentMethodNameHint')" />
          </div>

          <div class="space-y-2">
            <Label>{{ t('admin.paymentPlugin') }} *</Label>
            <Select :model-value="form.plugin_id" @update:model-value="(v: any) => onPluginChange(v as string)">
              <SelectTrigger>
                <SelectValue :placeholder="t('admin.paymentPluginHint')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in plugins" :key="p.id" :value="p.id">{{ p.name }} ({{ p.id }})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="editing" class="space-y-1">
            <Label>ID</Label>
            <Input :model-value="String(editing.id)" disabled />
            <p class="text-muted-foreground break-all text-xs">回调：{{ exampleNotifyUrl }}</p>
          </div>
          <div v-else class="text-muted-foreground text-xs">保存后将生成 ID，回调示例：{{ exampleNotifyUrl }}</div>

          <div class="flex items-center gap-2">
            <Switch :model-value="form.enabled" @update:model-value="(v: boolean) => (form.enabled = v)" />
            <Label>{{ form.enabled ? t('admin.paymentMethodEnabled') : t('admin.paymentMethodDisabled') }}</Label>
          </div>

          <div class="space-y-2">
            <Label>{{ t('admin.paymentMethodSort') }}</Label>
            <Input v-model.number="form.sort_order" type="number" />
          </div>

          <div v-if="selectedFields.length" class="space-y-4 rounded-lg border p-4">
            <p class="text-sm font-medium">{{ t('admin.paymentConfig') }}</p>
            <div v-for="field in selectedFields" :key="field.key" class="space-y-1">
              <Label>
                {{ field.label }}
                <span v-if="field.required" class="text-destructive">*</span>
              </Label>
              <p v-if="field.hint" class="text-muted-foreground text-xs">{{ field.hint }}</p>

              <Select
                v-if="field.type === 'select'"
                :model-value="form.config[field.key] ?? ''"
                @update:model-value="(v: any) => (form.config[field.key] = String(v))"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in field.options ?? []" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <div v-else-if="field.type === 'bool'" class="flex items-center gap-2 py-1">
                <Switch
                  :model-value="form.config[field.key] === '1' || form.config[field.key] === 'true'"
                  @update:model-value="(v: boolean) => (form.config[field.key] = v ? '1' : '0')"
                />
                <span class="text-sm">{{ field.label }}</span>
              </div>

              <Textarea
                v-else-if="field.type === 'textarea'"
                :model-value="form.config[field.key] ?? ''"
                :placeholder="field.default_value"
                @update:model-value="(v: any) => (form.config[field.key] = String(v))"
              />

              <Input
                v-else
                :model-value="form.config[field.key] ?? ''"
                :type="field.secret ? 'password' : field.type === 'number' ? 'number' : 'text'"
                :placeholder="field.default_value"
                @update:model-value="(v: any) => (form.config[field.key] = String(v))"
              />
              <p v-if="field.key === 'notify_url'" class="text-muted-foreground break-all text-xs">留空自动：{{ exampleNotifyUrl }}</p>
            </div>
          </div>

          <p v-else class="text-muted-foreground text-sm">{{ t('admin.pluginNoConfig') }}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">{{ t('common.cancel') }}</Button>
          <Button :disabled="saving" @click="save">
            <Loader2 v-if="saving" class="animate-spin" />
            {{ saving ? t('common.saving') : t('common.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog v-model:open="invDetailOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{{ t('adminInvoices.detailTitle') }}</DialogTitle>
          <DialogDescription v-if="invDetail" class="font-mono">{{ invDetail.invoice_no }}</DialogDescription>
        </DialogHeader>
        <LoadingBlock v-if="invDetailLoading" :rows="3" />
        <div v-else-if="invDetail" class="space-y-4">
          <div>
            <p class="mb-2 text-sm font-medium">{{ t('adminInvoices.items') }}</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{{ t('adminInvoices.description') }}</TableHead>
                  <TableHead class="text-right">{{ t('adminInvoices.amount') }}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="line in invDetail.items ?? []" :key="line.id">
                  <TableCell>{{ line.description }}</TableCell>
                  <TableCell class="text-right"><Money :cents="line.amount_cents" /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div>
            <p class="mb-2 text-sm font-medium">{{ t('adminInvoices.relatedPayments') }}</p>
            <p v-if="!invDetail.external_payments?.length" class="text-muted-foreground text-sm">
              {{ t('adminInvoices.noPayments') }}
            </p>
            <div
              v-for="p in invDetail.external_payments ?? []"
              :key="p.id"
              class="mb-2 space-y-1 rounded-lg border p-3 text-sm"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="font-medium tabular">#{{ p.id }} · {{ p.plugin_id }}</span>
                <Badge :variant="p.status === 'paid' ? 'success' : p.status === 'failed' ? 'destructive' : 'warning'">
                  {{ t(`payment.${p.status}`) }}
                </Badge>
              </div>
              <div class="text-muted-foreground text-xs tabular">
                {{ t('adminInvoices.paidAmount') }}: <Money :cents="p.paid_amount_cents" />
                <span v-if="!isZeroTime(p.paid_at)"> · {{ formatDateTime(p.paid_at) }}</span>
              </div>
              <p v-if="p.failure_reason" class="text-destructive text-xs">
                {{ t('adminInvoices.failureReason') }}: {{ p.failure_reason }}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      v-model:open="confirmOpen"
      :title="t('common.delete')"
      :description="confirmTarget ? t('admin.deletePaymentMethodConfirm', { name: confirmTarget.name }) : ''"
      :confirm-text="t('common.delete')"
      danger
      @confirm="remove"
    />
  </div>
</template>
