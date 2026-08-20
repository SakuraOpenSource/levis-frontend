<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ArrowLeft, Link2, Loader2, Pause, Play, Plus, Trash2 } from 'lucide-vue-next'

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

async function toggleStatus(item: Service) {
  const next = item.status === 'active' ? 'suspended' : 'active'
  if (next === 'suspended' && !window.confirm(t('admin.suspendServiceConfirm', { name: item.name }))) {
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

async function remove(item: Service) {
  if (!window.confirm(t('admin.deleteServiceConfirm', { name: item.name }))) return
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
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else>
      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('services.name') }}</TableHead>
                <TableHead>{{ t('services.status') }}</TableHead>
                <TableHead>{{ t('services.cycle') }}</TableHead>
                <TableHead class="text-right">{{ t('services.price') }}</TableHead>
                <TableHead>{{ t('services.expires') }}</TableHead>
                <TableHead>上游</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="7">{{ t('services.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
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
                      @click="remove(item)"
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
  </div>
</template>
