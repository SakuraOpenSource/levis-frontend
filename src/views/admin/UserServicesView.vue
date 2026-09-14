<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft, Link2, Loader2, Pause, Play, Plus, Trash2 } from 'lucide-vue-next'

import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
import StateBadge from '@/components/app/StateBadge.vue'
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
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import type { BatchResult } from '@/lib/endpoints'
import { formatDate, formatDateTime, isZeroTime } from '@/lib/utils'
import type { Product, Service } from '@/lib/types'
import { BILLING_CYCLES } from '@/lib/types'

void formatDateTime

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const { cycleLabel } = useCycleLabel()

const userId = Number(route.params.id)
const username = (route.query.name as string) ?? ''

const items = ref<Service[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref<string | null>(null)
const busyId = ref<number | null>(null)

// 添加服务对话框
const addOpen = ref(false)
const addSaving = ref(false)
const addError = ref<string | null>(null)
const products = ref<Product[]>([])
const provisionPlugins = ref<{ id: string; name: string }[]>([])
const addForm = reactive({
  product_id: 0 as number,
  quantity: 1,
  billing_cycle: '',
  provision: false,
})

// 绑定上游对话框
const bindOpen = ref(false)
const bindSaving = ref(false)
const bindError = ref<string | null>(null)
const bindTarget = ref<Service | null>(null)
const bindForm = reactive({
  upstream_plugin_id: '',
  upstream_host_id: '',
})

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    const result = await adminApi.userServices(userId, {
      page: target,
      page_size: pageSize.value,
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

const suspendOpen = ref(false)
const suspendTarget = ref<Service | null>(null)

async function toggleStatus(item: Service, confirmed = false) {
  const next = item.status === 'active' ? 'suspended' : 'active'
  if (next === 'suspended' && !confirmed) {
    suspendTarget.value = item
    suspendOpen.value = true
    return
  }
  busyId.value = item.id
  try {
    await adminApi.updateService(item.id, next)
    toast.success(next === 'suspended' ? t('admin.suspended') : t('admin.resumed'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    busyId.value = null
  }
}

async function confirmSuspend() {
  const item = suspendTarget.value
  suspendOpen.value = false
  suspendTarget.value = null
  if (!item) return
  await toggleStatus(item, true)
}

const deleteOpen = ref(false)
const deleteTarget = ref<Service | null>(null)

function askRemove(item: Service) {
  deleteTarget.value = item
  deleteOpen.value = true
}

async function remove() {
  const item = deleteTarget.value
  deleteOpen.value = false
  if (!item) return
  busyId.value = item.id
  try {
    await adminApi.deleteService(item.id)
    toast.success(t('common.deleted'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    busyId.value = null
  }
}

/** 批量选择：存所选服务 ID，翻页保留，批量执行后清空。 */
const selected = ref<Set<number>>(new Set())
const allChecked = computed(
  () => items.value.length > 0 && items.value.every((item) => selected.value.has(item.id)),
)

function toggleAll(checked: boolean) {
  const next = new Set(selected.value)
  for (const item of items.value) {
    if (checked) next.add(item.id)
    else next.delete(item.id)
  }
  selected.value = next
}

function toggleOne(id: number, checked: boolean) {
  const next = new Set(selected.value)
  if (checked) next.add(id)
  else next.delete(id)
  selected.value = next
}

type BatchAction = 'suspend' | 'resume' | 'delete'
const batchOpen = ref(false)
const batchAction = ref<BatchAction>('suspend')
const batchBusy = ref(false)

const batchDialog = computed(() => {
  const count = selected.value.size
  if (batchAction.value === 'suspend')
    return {
      title: t('admin.suspend'),
      description: t('admin.batchSuspendConfirm', { count }),
      confirm: t('admin.suspend'),
    }
  if (batchAction.value === 'resume')
    return {
      title: t('admin.resume'),
      description: t('admin.batchResumeConfirm', { count }),
      confirm: t('admin.resume'),
    }
  return {
    title: t('common.delete'),
    description: t('admin.batchDeleteConfirm', { count }),
    confirm: t('common.delete'),
  }
})

function askBatch(action: BatchAction) {
  if (!selected.value.size) return
  batchAction.value = action
  batchOpen.value = true
}

/** 批量结果播报：全成功走成功提示，有失败则列出前几条原因。 */
function reportBatch(result: BatchResult, okMessage: string) {
  if (!result.failed.length) {
    toast.success(okMessage)
    return
  }
  const detail = result.failed
    .slice(0, 5)
    .map((f) => `#${f.id} ${f.reason}`)
    .join('；')
  toast.error(t('admin.batchPartial', { ok: result.ok.length, fail: result.failed.length, detail }))
 }

 async function runBatch() {
   const ids = [...selected.value]
   batchOpen.value = false
   if (!ids.length) return
   batchBusy.value = true
   try {
     // 后端单次最多 100 条：分片串行调用再合并结果，避免整批被拒。
     const merged: BatchResult = { ok: [], failed: [] }
     for (let i = 0; i < ids.length; i += 100) {
       const chunk = ids.slice(i, i + 100)
       let part: BatchResult
       if (batchAction.value === 'suspend') part = await adminApi.batchServicesStatus(chunk, 'suspended')
       else if (batchAction.value === 'resume') part = await adminApi.batchServicesStatus(chunk, 'active')
       else part = await adminApi.batchDeleteServices(chunk)
       merged.ok.push(...part.ok)
       merged.failed.push(...part.failed)
     }
     reportBatch(merged, batchAction.value === 'delete' ? t('common.deleted') : t('common.updated'))
     selected.value = new Set()
     await load()
   } catch (err) {
     toast.error(errorMessage(err))
   } finally {
     batchBusy.value = false
   }
 }

async function openAdd() {
  addError.value = null
  addForm.product_id = 0
  addForm.quantity = 1
  addForm.billing_cycle = ''
  addForm.provision = false
  addOpen.value = true
  try {
    const [prodRes, provRes] = await Promise.all([
      adminApi.products({ page: 1, page_size: 200 }),
      adminApi.provisionPlugins(),
    ])
    products.value = prodRes.items ?? []
    provisionPlugins.value = provRes
  } catch {
    // ignore
  }
}

async function submitAdd() {
  if (!addForm.product_id) {
    addError.value = t('error.required')
    return
  }
  addSaving.value = true
  addError.value = null
  try {
    await adminApi.createServiceForUser(userId, {
      product_id: addForm.product_id,
      quantity: addForm.quantity,
      billing_cycle: addForm.billing_cycle || undefined,
      provision: addForm.provision,
    } as any)
    toast.success(t('common.created'))
    addOpen.value = false
    await load()
  } catch (err) {
    addError.value = errorMessage(err)
  } finally {
    addSaving.value = false
  }
}

function openBind(item: Service) {
  bindTarget.value = item
  bindError.value = null
  bindForm.upstream_plugin_id = item.upstream_plugin_id || provisionPlugins.value[0]?.id || ''
  bindForm.upstream_host_id = item.upstream_host_id || ''
  // 确保插件列表已加载
  if (!provisionPlugins.value.length) {
    adminApi.provisionPlugins().then((res) => (provisionPlugins.value = res))
  }
  bindOpen.value = true
}

async function submitBind() {
  if (!bindTarget.value) return
  if (!bindForm.upstream_host_id.trim() && !bindForm.upstream_plugin_id.trim()) {
    // 解绑
  } else if (!bindForm.upstream_plugin_id || !bindForm.upstream_host_id.trim()) {
    bindError.value = t('error.required')
    return
  }
  bindSaving.value = true
  bindError.value = null
  try {
    await adminApi.bindService(bindTarget.value.id, {
      upstream_plugin_id: bindForm.upstream_plugin_id.trim(),
      upstream_host_id: bindForm.upstream_host_id.trim(),
    })
    toast.success(t('common.updated'))
    bindOpen.value = false
    await load()
  } catch (err) {
    bindError.value = errorMessage(err)
  } finally {
    bindSaving.value = false
  }
}

onMounted(() => load())
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      :title="username ? t('admin.userServicesTitle', { name: username }) : t('admin.userServicesTitleRaw')"
      :description="t('admin.userServicesSubtitle')"
    >
      <template #actions>
        <div class="flex gap-2">
          <Button size="sm" @click="openAdd">
            <Plus />
            {{ t('admin.addService') }}
          </Button>
          <Button variant="outline" size="sm" as-child>
            <RouterLink :to="{ name: 'admin-users' }">
              <ArrowLeft />
              {{ t('common.back') }}
            </RouterLink>
          </Button>
        </div>
      </template>
    </PageHeader>

    <ErrorAlert :message="error" />
    <div v-if="selected.size" class="flex flex-wrap items-center gap-2">
      <span class="text-muted-foreground text-sm">{{ t('common.selectedCount', { count: selected.size }) }}</span>
      <Button size="sm" variant="outline" :disabled="batchBusy" @click="askBatch('suspend')">
        {{ t('admin.suspend') }}
      </Button>
      <Button size="sm" variant="outline" :disabled="batchBusy" @click="askBatch('resume')">
        {{ t('admin.resume') }}
      </Button>
      <Button size="sm" variant="destructive" :disabled="batchBusy" @click="askBatch('delete')">
        {{ t('common.delete') }}
      </Button>
    </div>
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else>
      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-10">
                  <input
                    type="checkbox"
                    class="size-4"
                    :checked="allChecked"
                    :aria-label="t('common.selectAll')"
                    @change="toggleAll(($event.target as HTMLInputElement).checked)"
                  />
                </TableHead>
                <TableHead>{{ t('services.name') }}</TableHead>
                <TableHead>{{ t('services.status') }}</TableHead>
                <TableHead>{{ t('services.cycle') }}</TableHead>
                <TableHead class="text-right">{{ t('services.price') }}</TableHead>
                <TableHead>{{ t('services.expires') }}</TableHead>
                <TableHead>{{ t('admin.upstream') }}</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="8">{{ t('services.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell>
                  <input
                    type="checkbox"
                    class="size-4"
                    :checked="selected.has(item.id)"
                    :aria-label="item.name"
                    @change="toggleOne(item.id, ($event.target as HTMLInputElement).checked)"
                  />
                </TableCell>
                <TableCell class="font-medium">{{ item.name }}</TableCell>
                <TableCell><StateBadge kind="service" :value="item.status" /></TableCell>
                <TableCell>{{ cycleLabel(item.billing_cycle) }}</TableCell>
                <TableCell class="text-right"><Money :cents="item.price_cents" /></TableCell>
                <TableCell class="tabular">
                  {{ isZeroTime(item.expires_at) ? '-' : formatDate(item.expires_at) }}
                </TableCell>
                <TableCell class="text-xs">
                  <span v-if="item.upstream_plugin_id" class="rounded bg-muted px-1.5 py-0.5">
                    {{ item.upstream_plugin_id }}#{{ item.upstream_host_id }}
                  </span>
                  <span v-else class="text-muted-foreground">-</span>
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      :disabled="busyId === item.id"
                      @click="openBind(item)"
                    >
                      <Link2 class="size-4" />
                      {{ t('admin.bindUpstream') }}
                    </Button>
                    <Button
                      v-if="item.status === 'active'"
                      variant="ghost"
                      size="sm"
                      :disabled="busyId === item.id"
                      @click="toggleStatus(item)"
                    >
                      <Loader2 v-if="busyId === item.id" class="animate-spin" />
                      <Pause v-else />
                      {{ t('admin.suspend') }}
                    </Button>
                    <Button
                      v-else-if="item.status === 'suspended'"
                      variant="ghost"
                      size="sm"
                      :disabled="busyId === item.id"
                      @click="toggleStatus(item)"
                    >
                      <Loader2 v-if="busyId === item.id" class="animate-spin" />
                      <Play v-else />
                      {{ t('admin.resume') }}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :disabled="busyId === item.id"
                      :aria-label="t('common.delete')"
                      @click="askRemove(item)"
                    >
                      <Trash2 class="text-destructive" />
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

    <!-- 添加服务对话框 -->
    <Dialog v-model:open="addOpen">
      <DialogContent class="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{{ t('admin.addService') }}</DialogTitle>
          <DialogDescription>{{ t('admin.addServiceSubtitle') }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <ErrorAlert :message="addError" />
          <div class="space-y-2">
            <Label>{{ t('admin.productName') }} *</Label>
            <Select :model-value="String(addForm.product_id || '')" @update:model-value="(v: any) => (addForm.product_id = Number(v))">
              <SelectTrigger>
                <SelectValue placeholder="请选择商品" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in products" :key="p.id" :value="String(p.id)">
                  {{ p.name }} ({{ p.billing_cycle }})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label>{{ t('admin.quantity') }}</Label>
              <Input v-model.number="addForm.quantity" type="number" min="1" />
            </div>
            <div class="space-y-2">
              <Label>{{ t('services.cycle') }}</Label>
              <Select :model-value="addForm.billing_cycle" @update:model-value="(v: any) => (addForm.billing_cycle = String(v))">
                <SelectTrigger>
                  <SelectValue placeholder="跟随商品" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">跟随商品</SelectItem>
                  <SelectItem v-for="c in BILLING_CYCLES" :key="c" :value="c">{{ cycleLabel(c) }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="flex items-center gap-2 rounded border p-3">
            <Switch :model-value="addForm.provision" @update:model-value="(v: boolean) => (addForm.provision = v)" />
            <div class="text-sm">
              <p class="font-medium">{{ t('admin.provision') }}</p>
              <p class="text-muted-foreground text-xs">{{ t('admin.provisionHint') }}</p>
            </div>
          </div>
          <p v-if="!addForm.provision" class="text-muted-foreground text-xs">{{ t('admin.emptyShell') }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="addOpen = false">{{ t('common.cancel') }}</Button>
          <Button :disabled="addSaving" @click="submitAdd">
            <Loader2 v-if="addSaving" class="animate-spin" />
            {{ t('common.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 绑定上游对话框 -->
    <Dialog v-model:open="bindOpen">
      <DialogContent class="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{{ t('admin.bindUpstream') }}</DialogTitle>
          <DialogDescription>{{ t('admin.bindUpstreamSubtitle') }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-4">
          <ErrorAlert :message="bindError" />
          <div class="space-y-2">
            <Label>{{ t('admin.upstreamPluginId') }}</Label>
            <Select :model-value="bindForm.upstream_plugin_id" @update:model-value="(v: any) => (bindForm.upstream_plugin_id = String(v))">
              <SelectTrigger>
                <SelectValue placeholder="选择上游插件" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in provisionPlugins" :key="p.id" :value="p.id">{{ p.name || p.id }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="space-y-2">
            <Label>{{ t('admin.upstreamHostId') }}</Label>
            <Input v-model="bindForm.upstream_host_id" :placeholder="t('admin.upstreamHostIdHint')" />
          </div>
          <p class="text-muted-foreground text-xs">留空两项可解绑</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="bindOpen = false">{{ t('common.cancel') }}</Button>
          <Button :disabled="bindSaving" @click="submitBind">
            <Loader2 v-if="bindSaving" class="animate-spin" />
            {{ t('common.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      v-model:open="suspendOpen"
      :title="t('admin.suspend')"
      :description="suspendTarget ? t('admin.suspendServiceConfirm', { name: suspendTarget.name }) : ''"
      :confirm-text="t('admin.suspend')"
      @confirm="confirmSuspend"
    />
    <ConfirmDialog
      v-model:open="deleteOpen"
      :title="t('common.delete')"
      :description="deleteTarget ? t('admin.deleteServiceConfirm', { name: deleteTarget.name }) : ''"
      :confirm-text="t('common.delete')"
      danger
      @confirm="remove"
    />
    <ConfirmDialog
      v-model:open="batchOpen"
      :title="batchDialog.title"
      :description="batchDialog.description"
      :confirm-text="batchDialog.confirm"
      :danger="batchAction === 'delete'"
      :confirming="batchBusy"
      @confirm="runBatch"
    />
  </div>
</template>
