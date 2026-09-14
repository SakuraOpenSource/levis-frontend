<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Pencil, PlugZap, Plus, Trash2 } from 'lucide-vue-next'

import ConfirmDialog from '@/components/app/ConfirmDialog.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
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
import type { ModuleConfigField, UpstreamInterface } from '@/lib/types'

/**
 * 接口管理：同一个开通插件模块可以配置多个上游接口
 * （不同的站点地址与密钥），商品选择接口即可完成开通。
 * 表单字段由所选模块（插件）的 manifest 配置声明动态渲染。
 */

const { t } = useI18n()
const toast = useToast()

const items = ref<UpstreamInterface[]>([])
const modules = ref<{ id: string; name: string; config?: ModuleConfigField[] }[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const deleting = ref<number | null>(null)
const testing = ref<number | null>(null)

const dialogOpen = ref(false)
const editing = ref<UpstreamInterface | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)

const form = reactive({
  name: '',
  pluginId: '',
  config: {} as Record<string, string>,
})

/** 当前选中模块声明的配置字段，驱动表单渲染。 */
const configFields = computed(() => {
  const found = modules.value.find((m) => m.id === form.pluginId)
  return found?.config ?? []
})

const moduleName = (pluginId: string) => modules.value.find((m) => m.id === pluginId)?.name ?? pluginId

/** 配置里挑一个非密钥的值展示在列表（通常是 api_url）。 */
const displayValue = (item: UpstreamInterface) => {
  if (!item.config) return ''
  for (const [key, value] of Object.entries(item.config)) {
    if (key.includes('url')) return value
  }
  return ''
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const [list, mods] = await Promise.all([adminApi.interfaces(), adminApi.provisionPlugins()])
    items.value = list
    modules.value = mods
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
  form.pluginId = modules.value[0]?.id ?? ''
  form.config = {}
  dialogOpen.value = true
}

function openEdit(item: UpstreamInterface) {
  editing.value = item
  formError.value = null
  form.name = item.name
  form.pluginId = item.plugin_id
  form.config = { ...(item.config ?? {}) }
  dialogOpen.value = true
}

function pickModule(pluginId: string) {
  form.pluginId = pluginId
  form.config = {}
}

async function save() {
  formError.value = null
  if (!form.name.trim() || !form.pluginId) {
    formError.value = '请填写接口名称并选择模块'
    return
  }
  for (const field of configFields.value) {
    if (field.required && !(form.config[field.key] ?? '').trim()) {
      formError.value = `请填写「${field.label}」`
      return
    }
  }
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      plugin_id: form.pluginId,
      config: form.config,
    }
    if (editing.value) {
      await adminApi.updateInterface(editing.value.id, payload)
      toast.success(t('common.saved'))
    } else {
      await adminApi.createInterface(payload)
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
const confirmTarget = ref<UpstreamInterface | null>(null)

function askRemove(item: UpstreamInterface) {
  confirmTarget.value = item
  confirmOpen.value = true
}

async function remove() {
  const item = confirmTarget.value
  confirmOpen.value = false
  if (!item) return
  deleting.value = item.id
  try {
    await adminApi.deleteInterface(item.id)
    toast.success(t('common.deleted'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    deleting.value = null
  }
}

async function test(item: UpstreamInterface) {
  testing.value = item.id
  try {
    const result = await adminApi.testInterface(item.id)
    toast.success(result.message || '接口可用')
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    testing.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="接口管理" description="为开通插件模块配置上游接口：站点地址、密钥等。商品选择接口即可向上游开通。">
      <template #actions>
        <Button size="sm" :disabled="!modules.length" @click="openCreate">
          <Plus />
          新增接口
        </Button>
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
                <TableHead>名称</TableHead>
                <TableHead>模块</TableHead>
                <TableHead>API 地址</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="4">
                {{ modules.length ? '还没有接口，点击「新增接口」添加' : '没有可用的开通插件模块，请先在插件页启用' }}
              </TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="font-medium">{{ item.name }}</TableCell>
                <TableCell class="text-muted-foreground text-xs">{{ moduleName(item.plugin_id) }}</TableCell>
                <TableCell class="text-muted-foreground truncate text-xs">{{ displayValue(item) || '-' }}</TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :disabled="testing === item.id"
                      aria-label="测试连通"
                      title="测试连通"
                      @click="test(item)"
                    >
                      <Loader2 v-if="testing === item.id" class="animate-spin" />
                      <PlugZap v-else />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      aria-label="编辑"
                      @click="openEdit(item)"
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :disabled="deleting === item.id"
                      aria-label="删除"
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
    </template>

    <Dialog v-model:open="dialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editing ? '编辑接口' : '新增接口' }}</DialogTitle>
          <DialogDescription>选择插件模块后按其声明填写站点地址与密钥。</DialogDescription>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="save">
          <ErrorAlert :message="formError" />

          <div class="space-y-2">
            <Label for="if-name">接口名称</Label>
            <Input id="if-name" v-model="form.name" placeholder="如：主站 Virtualis" required />
          </div>

          <div class="space-y-2">
            <Label for="if-module">模块</Label>
            <Select
              :model-value="form.pluginId"
              :disabled="!!editing"
              @update:model-value="(v) => pickModule(String(v ?? ''))"
            >
              <SelectTrigger id="if-module">
                <SelectValue placeholder="选择开通插件模块" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="mod in modules" :key="mod.id" :value="mod.id">
                  {{ mod.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <template v-for="field in configFields" :key="field.key">
            <div class="space-y-2">
              <Label :for="`if-${field.key}`">
                {{ field.label }}<span v-if="field.required" class="text-destructive"> *</span>
              </Label>
              <Input
                :id="`if-${field.key}`"
                v-model="form.config[field.key]"
                :type="field.secret ? 'password' : 'text'"
                :placeholder="field.default || ''"
                :autocomplete="field.secret ? 'new-password' : 'off'"
              />
              <p v-if="field.hint" class="text-muted-foreground text-xs">{{ field.hint }}</p>
            </div>
          </template>

          <p v-if="form.pluginId && !configFields.length" class="text-muted-foreground text-xs">
            该模块没有声明配置项。
          </p>

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
      :description="confirmTarget ? t('admin.deleteInterfaceConfirm', { name: confirmTarget.name }) : ''"
      :confirm-text="t('common.delete')"
      danger
      @confirm="remove"
    />
  </div>
</template>
