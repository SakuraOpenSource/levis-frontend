<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Boxes, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
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
import type { Role, UpdateUserInput, User, UserStatus } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()

const items = ref<User[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const loading = ref(true)
const error = ref<string | null>(null)

const dialogOpen = ref(false)
const editing = ref<User | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const deleting = ref<number | null>(null)

const form = reactive({
  username: '',
  email: '',
  password: '',
  role: 'user' as Role,
  status: 'active' as UserStatus,
  balanceYuan: '0',
})

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    const result = await adminApi.users({
      page: target,
      page_size: pageSize.value,
      keyword: keyword.value.trim() || undefined,
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

function openCreate() {
  editing.value = null
  formError.value = null
  Object.assign(form, {
    username: '',
    email: '',
    password: '',
    role: 'user' as Role,
    status: 'active' as UserStatus,
    balanceYuan: '0',
  })
  dialogOpen.value = true
}

function openEdit(user: User) {
  editing.value = user
  formError.value = null
  Object.assign(form, {
    username: user.username,
    email: user.email,
    // 编辑时留空表示不改密码。
    password: '',
    role: user.role,
    status: user.status,
    balanceYuan: (user.balance_cents / 100).toFixed(2),
  })
  dialogOpen.value = true
}

/** 元 → 分，四舍五入避免浮点误差。 */
function toCents(value: string) {
  return Math.round(Number(value) * 100)
}

async function save() {
  formError.value = null
  const cents = toCents(form.balanceYuan)
  if (!Number.isFinite(cents) || cents < 0) {
    formError.value = t('error.required')
    return
  }
  saving.value = true
  try {
    if (editing.value) {
      // 只提交实际变动的字段：后端按指针判断是否更新，
      // 全量提交会把「没改」也当成「改成同值」。
      const payload: UpdateUserInput = {}
      if (form.username.trim() !== editing.value.username) payload.username = form.username.trim()
      if (form.email.trim() !== editing.value.email) payload.email = form.email.trim()
      if (form.password) payload.password = form.password
      if (form.role !== editing.value.role) payload.role = form.role
      if (form.status !== editing.value.status) payload.status = form.status
      // balance_cents 是目标余额，差额由后端记为 adjust 流水。
      if (cents !== editing.value.balance_cents) payload.balance_cents = cents

      const updated = await adminApi.updateUser(editing.value.id, payload)
      // 改的是自己时同步本地登录态（例如刚给自己加了余额）。
      if (updated.id === auth.user?.id) auth.setUser(updated)
      toast.success(t('common.saved'))
    } else {
      if (!form.username.trim() || !form.email.trim() || !form.password) {
        formError.value = t('error.required')
        return
      }
      await adminApi.createUser({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        balance_cents: cents,
      })
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

async function remove(user: User) {
  if (!window.confirm(t('admin.deleteUserConfirm', { name: user.username }))) return
  deleting.value = user.id
  try {
    await adminApi.deleteUser(user.id)
    toast.success(t('common.deleted'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    deleting.value = null
  }
}

onMounted(() => load())
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('admin.usersTitle')" :description="t('admin.usersSubtitle')">
      <template #actions>
        <Button size="sm" @click="openCreate">
          <Plus />
          {{ t('admin.newUser') }}
        </Button>
      </template>
    </PageHeader>

    <form class="flex max-w-md gap-2" @submit.prevent="load(1)">
      <Input v-model="keyword" :placeholder="t('admin.searchUsers')" :aria-label="t('admin.searchUsers')" />
      <Button type="submit" variant="outline">
        <Search />
        {{ t('common.search') }}
      </Button>
    </form>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="5" />

    <template v-else>
      <Card class="py-0">
        <CardContent class="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{{ t('admin.username') }}</TableHead>
                <TableHead>{{ t('admin.email') }}</TableHead>
                <TableHead>{{ t('admin.role') }}</TableHead>
                <TableHead>{{ t('admin.status') }}</TableHead>
                <TableHead class="text-right">{{ t('dashboard.balance') }}</TableHead>
                <TableHead>{{ t('admin.createdAt') }}</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="7">{{ t('common.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="font-medium">{{ item.username }}</TableCell>
                <TableCell class="max-w-52 truncate">{{ item.email }}</TableCell>
                <TableCell>
                  <Badge :variant="item.role === 'admin' ? 'default' : 'secondary'">
                    {{ item.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser') }}
                  </Badge>
                </TableCell>
                <TableCell><StateBadge kind="user" :value="item.status" /></TableCell>
                <TableCell class="text-right"><Money :cents="item.balance_cents" /></TableCell>
                <TableCell class="text-muted-foreground text-xs tabular">
                  {{ formatDateTime(item.created_at) }}
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :aria-label="t('admin.viewProducts')"
                      as-child
                    >
                      <RouterLink
                        :to="{ name: 'admin-user-services', params: { id: item.id }, query: { name: item.username } }"
                      >
                        <Boxes />
                      </RouterLink>
                    </Button>
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
                      :disabled="item.id === auth.user?.id || deleting === item.id"
                      :aria-label="t('common.delete')"
                      @click="remove(item)"
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ editing ? t('admin.editUser') : t('admin.newUser') }}</DialogTitle>
          <DialogDescription>{{ t('admin.balanceAdjustHint') }}</DialogDescription>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="save">
          <ErrorAlert :message="formError" />

          <div class="space-y-2">
            <Label for="u-username">{{ t('admin.username') }}</Label>
            <Input id="u-username" v-model="form.username" autocomplete="off" required />
          </div>

          <div class="space-y-2">
            <Label for="u-email">{{ t('admin.email') }}</Label>
            <Input id="u-email" v-model="form.email" type="email" autocomplete="off" required />
          </div>

          <div class="space-y-2">
            <Label for="u-password">{{ t('admin.password') }}</Label>
            <Input
              id="u-password"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              :required="!editing"
            />
            <p v-if="editing" class="text-muted-foreground text-xs">
              {{ t('admin.passwordKeep') }}
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="u-role">{{ t('admin.role') }}</Label>
              <Select v-model="form.role">
                <SelectTrigger id="u-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{{ t('admin.roleUser') }}</SelectItem>
                  <SelectItem value="admin">{{ t('admin.roleAdmin') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div v-if="editing" class="space-y-2">
              <Label for="u-status">{{ t('admin.status') }}</Label>
              <Select v-model="form.status">
                <SelectTrigger id="u-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{{ t('admin.statusActive') }}</SelectItem>
                  <SelectItem value="disabled">{{ t('admin.statusDisabled') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="u-balance">{{ t('admin.balance') }}</Label>
            <Input id="u-balance" v-model="form.balanceYuan" type="number" min="0" step="0.01" />
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
  </div>
</template>
