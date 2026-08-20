<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import type { PaymentMethodAdmin, PaymentPlugin } from '@/lib/types'

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

async function remove(item: PaymentMethodAdmin) {
  if (!window.confirm(t('admin.deletePaymentMethodConfirm', { name: item.name }))) return
  try {
    await adminApi.deletePaymentMethod(item.id)
    toast.success(t('common.deleted'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('admin.financeTitle')" :description="t('admin.financeSubtitle')">
      <template #actions>
        <Button @click="openCreate">
          <Plus />
          {{ t('admin.newPaymentMethod') }}
        </Button>
      </template>
    </PageHeader>

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
                    <Button variant="ghost" size="icon" class="size-8" @click="remove(item)">
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
  </div>
</template>
