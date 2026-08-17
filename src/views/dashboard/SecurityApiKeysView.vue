<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Copy, IdCard, Loader2, Plus, Trash2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { apiKeyApi, kycApi } from '@/lib/endpoints'
import { formatDateTime } from '@/lib/utils'
import type { APIKey, APIScope } from '@/lib/types'

const { t } = useI18n()
const toast = useToast()

const items = ref<APIKey[]>([])
// 可选权限位由后端给出，前端不另存一份 —— 两处各自维护迟早不一致。
const scopes = ref<APIScope[]>([])
const approved = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const revoking = ref<number | null>(null)

const dialogOpen = ref(false)
const form = reactive({ name: '', expiresIn: '0' })
const picked = ref<APIScope[]>([])
const formError = ref<string | null>(null)
const saving = ref(false)

// 明文只在创建响应里出现一次，之后系统里任何地方都取不回，
// 所以单独用一个对话框把它摊开给用户复制。
const secret = ref<string | null>(null)
const copied = ref(false)

/** 对外接口的基址，与后端 mountOpenAPI 一致。 */
const API_BASE = '/api/open/v1'

const curlExample = `curl -H "Authorization: Bearer lvs_xxxxxxxx" \\
  ${window.location.origin}${API_BASE}/account`

/** 各权限位覆盖的接口，写在页面里作为说明 —— 路径是字面量，不进 i18n。 */
const ENDPOINTS: Record<APIScope, string[]> = {
  'balance:read': ['GET /account', 'GET /transactions'],
  'order:write': [
    'GET /products',
    'GET /orders',
    'POST /orders',
    'GET /orders/:id',
    'POST /orders/:id/pay',
  ],
  'service:write': ['GET /services', 'GET /services/:id', 'POST /services/:id/renew'],
}

async function load() {
  loading.value = true
  error.value = null
  try {
    // 两个请求互不依赖，并发发出。
    const [list, record] = await Promise.all([apiKeyApi.list(), kycApi.mine()])
    items.value = list.items ?? []
    scopes.value = list.scopes
    approved.value = record?.status === 'approved'
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.name = ''
  form.expiresIn = '0'
  picked.value = []
  formError.value = null
  dialogOpen.value = true
}

function toggle(scope: APIScope, on: boolean) {
  picked.value = on
    ? [...picked.value, scope]
    : picked.value.filter((item) => item !== scope)
}

async function create() {
  formError.value = null
  if (!form.name.trim()) {
    formError.value = t('error.required')
    return
  }
  if (!picked.value.length) {
    formError.value = t('apiKeys.scopeRequired')
    return
  }
  const days = Number(form.expiresIn)
  if (!Number.isInteger(days) || days < 0) {
    formError.value = t('apiKeys.expiresInvalid')
    return
  }
  saving.value = true
  try {
    const created = await apiKeyApi.create({
      name: form.name.trim(),
      scopes: picked.value,
      expires_in_days: days,
    })
    dialogOpen.value = false
    copied.value = false
    secret.value = created.secret
    await load()
  } catch (err) {
    formError.value = errorMessage(err)
  } finally {
    saving.value = false
  }
}

async function copySecret() {
  if (!secret.value) return
  try {
    await navigator.clipboard.writeText(secret.value)
    copied.value = true
    toast.success(t('apiKeys.copied'))
  } catch {
    // 非 HTTPS 或权限被拒时剪贴板不可用，明文本身就在页面上，手动选中即可。
    toast.error(t('apiKeys.copyFailed'))
  }
}

async function revoke(key: APIKey) {
  if (!window.confirm(t('apiKeys.revokeConfirm'))) return
  revoking.value = key.id
  try {
    await apiKeyApi.revoke(key.id)
    toast.success(t('apiKeys.revoked'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    revoking.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('apiKeys.title')" :description="t('apiKeys.subtitle')">
      <template #actions>
        <Button size="sm" :disabled="loading || !approved" @click="openCreate">
          <Plus />
          {{ t('apiKeys.create') }}
        </Button>
      </template>
    </PageHeader>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else>
      <Alert v-if="!approved" variant="warning">
        <IdCard />
        <AlertDescription class="flex flex-wrap items-center gap-3">
          {{ t('apiKeys.requireKyc') }}
          <Button as-child variant="outline" size="sm">
            <RouterLink :to="{ name: 'verification' }">{{ t('apiKeys.goVerify') }}</RouterLink>
          </Button>
        </AlertDescription>
      </Alert>

      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('apiKeys.name') }}</TableHead>
                <TableHead>{{ t('apiKeys.prefix') }}</TableHead>
                <TableHead>{{ t('apiKeys.scopes') }}</TableHead>
                <TableHead>{{ t('apiKeys.status') }}</TableHead>
                <TableHead>{{ t('apiKeys.expiresAt') }}</TableHead>
                <TableHead>{{ t('apiKeys.lastUsedAt') }}</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="7">{{ t('apiKeys.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="font-medium">{{ item.name }}</TableCell>
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ item.prefix }}…
                </TableCell>
                <TableCell>
                  <div class="flex flex-wrap gap-1">
                    <Badge v-for="scope in item.scopes ?? []" :key="scope" variant="secondary">
                      {{ t(`scope.${scope}`) }}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell><StateBadge kind="apiKey" :value="item.status" /></TableCell>
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ item.expires_at ? formatDateTime(item.expires_at) : t('apiKeys.noExpiry') }}
                </TableCell>
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ item.last_used_at ? formatDateTime(item.last_used_at) : t('apiKeys.never') }}
                </TableCell>
                <TableCell class="text-right">
                  <Button
                    v-if="item.status === 'active'"
                    variant="ghost"
                    size="icon"
                    class="size-8"
                    :disabled="revoking === item.id"
                    :aria-label="t('apiKeys.revoke')"
                    @click="revoke(item)"
                  >
                    <Loader2 v-if="revoking === item.id" class="animate-spin" />
                    <Trash2 v-else class="text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-base">{{ t('apiKeys.usage') }}</CardTitle>
          <CardDescription>{{ t('apiKeys.usageHint') }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <pre class="bg-muted/50 overflow-x-auto rounded-md p-3 text-xs">{{ curlExample }}</pre>
          <div>
            <p class="mb-2 text-sm font-medium">{{ t('apiKeys.usageEndpoints') }}</p>
            <dl class="space-y-3">
              <div v-for="scope in scopes" :key="scope">
                <dt class="text-xs font-medium">{{ t(`scope.${scope}`) }}</dt>
                <dd class="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular">
                  <span v-for="endpoint in ENDPOINTS[scope] ?? []" :key="endpoint">
                    {{ endpoint }}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>
    </template>

    <Dialog v-model:open="dialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('apiKeys.createTitle') }}</DialogTitle>
          <DialogDescription>{{ t('apiKeys.nameHint') }}</DialogDescription>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="create">
          <ErrorAlert :message="formError" />

          <div class="space-y-2">
            <Label for="key-name">{{ t('apiKeys.name') }}</Label>
            <Input id="key-name" v-model="form.name" maxlength="64" autocomplete="off" required />
          </div>

          <div class="space-y-2">
            <Label>{{ t('apiKeys.scopes') }}</Label>
            <ul class="space-y-2">
              <li
                v-for="scope in scopes"
                :key="scope"
                class="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <Label :for="`scope-${scope}`" class="text-sm font-normal">
                  {{ t(`scope.${scope}`) }}
                  <span class="text-muted-foreground ml-1 text-xs tabular">{{ scope }}</span>
                </Label>
                <Switch
                  :id="`scope-${scope}`"
                  :model-value="picked.includes(scope)"
                  @update:model-value="toggle(scope, $event)"
                />
              </li>
            </ul>
          </div>

          <div class="space-y-2">
            <Label for="key-expires">{{ t('apiKeys.expiresIn') }}（{{ t('apiKeys.days') }}）</Label>
            <Input
              id="key-expires"
              v-model="form.expiresIn"
              type="number"
              min="0"
              max="3650"
              step="1"
            />
            <p class="text-muted-foreground text-xs">{{ t('apiKeys.expiresInHint') }}</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" @click="dialogOpen = false">
              {{ t('common.cancel') }}
            </Button>
            <Button type="submit" :disabled="saving">
              <Loader2 v-if="saving" class="animate-spin" />
              {{ t('common.create') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="secret !== null" @update:open="secret = $event ? secret : null">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('apiKeys.secretTitle') }}</DialogTitle>
          <DialogDescription>{{ t('apiKeys.secretHint') }}</DialogDescription>
        </DialogHeader>

        <div class="flex items-center gap-2">
          <code class="bg-muted/60 flex-1 overflow-x-auto rounded-md px-3 py-2 text-xs tabular">
            {{ secret }}
          </code>
          <Button type="button" variant="outline" size="sm" @click="copySecret">
            <Check v-if="copied" />
            <Copy v-else />
            {{ t('common.copy') }}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" @click="secret = null">{{ t('common.close') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
