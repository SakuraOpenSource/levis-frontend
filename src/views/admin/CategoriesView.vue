<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CornerDownRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-vue-next'

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
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import type { Category } from '@/lib/types'

const { t } = useI18n()
const toast = useToast()

const all = ref<Category[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const dialogOpen = ref(false)
const editing = ref<Category | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const deleting = ref<number | null>(null)

/**
 * parentId 用字符串存（Select 的值必须是字符串）。
 * '0' 是「顶级分组」的哨兵值：reka-ui 的 SelectItem 不允许空字符串 value
 * —— 空串被它保留用于清空选择。
 */
const TOP_LEVEL = '0'

const form = reactive({
  name: '',
  slug: '',
  description: '',
  sort: '0',
  parentId: TOP_LEVEL,
})

/** 后端返回的是平铺列表，这里按 parent_id 递归平铺成带缩进层级的行。 */
const rows = computed(() => {
  const out: { item: Category; depth: number }[] = []
  const byParent = new Map<number | null, Category[]>()
  for (const item of all.value) {
    const key = item.parent_id ?? null
    const list = byParent.get(key) ?? []
    list.push(item)
    byParent.set(key, list)
  }
  const walk = (parentId: number | null, depth: number) => {
    for (const item of byParent.get(parentId) ?? []) {
      out.push({ item, depth })
      walk(item.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

/**
 * 父级候选：全部分组（递归平铺带层级缩进），排除自己——后端还会做
 * 环检测（不能挂到自己的子孙下面），这里把直接的一层挡掉即可。
 */
const parentOptions = computed(() =>
  rows.value.filter((row) => row.item.id !== editing.value?.id),
)

async function load() {
  loading.value = true
  error.value = null
  try {
    all.value = await adminApi.categories()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
}

function openCreate(parentId?: number) {
  editing.value = null
  formError.value = null
  Object.assign(form, {
    name: '',
    slug: '',
    description: '',
    sort: '0',
    parentId: parentId ? String(parentId) : TOP_LEVEL,
  })
  dialogOpen.value = true
}

function openEdit(item: Category) {
  editing.value = item
  formError.value = null
  Object.assign(form, {
    name: item.name,
    slug: item.slug,
    description: item.description,
    sort: String(item.sort),
    parentId: item.parent_id ? String(item.parent_id) : TOP_LEVEL,
  })
  dialogOpen.value = true
}

async function save() {
  formError.value = null
  if (!form.name.trim()) {
    formError.value = t('error.required')
    return
  }
  saving.value = true
  try {
    const payload = {
      // slug 留空时后端会按名称生成（中文名走哈希兜底）。
      parent_id: form.parentId === TOP_LEVEL ? null : Number(form.parentId),
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      sort: Number(form.sort) || 0,
    }
    if (editing.value) {
      await adminApi.updateCategory(editing.value.id, payload)
      toast.success(t('common.saved'))
    } else {
      await adminApi.createCategory(payload)
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
const confirmTarget = ref<Category | null>(null)

function askRemove(item: Category) {
  confirmTarget.value = item
  confirmOpen.value = true
}

async function remove() {
  const item = confirmTarget.value
  confirmOpen.value = false
  if (!item) return
  deleting.value = item.id
  try {
    await adminApi.deleteCategory(item.id)
    toast.success(t('common.deleted'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    deleting.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('admin.categoriesTitle')" :description="t('admin.categoriesSubtitle')">
      <template #actions>
        <Button size="sm" @click="openCreate()">
          <Plus />
          {{ t('admin.newCategory') }}
        </Button>
      </template>
    </PageHeader>

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="4" />

    <Card v-else class="py-0">
      <CardContent class="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{{ t('admin.categoryName') }}</TableHead>
              <TableHead>{{ t('admin.categorySlug') }}</TableHead>
              <TableHead>{{ t('admin.categoryDescription') }}</TableHead>
              <TableHead class="text-right">{{ t('admin.categorySort') }}</TableHead>
              <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableEmpty v-if="!rows.length" :colspan="5">{{ t('common.empty') }}</TableEmpty>
            <TableRow v-for="row in rows" v-else :key="row.item.id">
              <TableCell :class="row.depth > 0 ? '' : 'font-medium'">
                <span
                  class="flex items-center gap-1.5"
                  :style="{ paddingLeft: `${row.depth * 1.25}rem` }"
                >
                  <CornerDownRight v-if="row.depth > 0" class="text-muted-foreground size-3.5" />
                  {{ row.item.name }}
                </span>
              </TableCell>
              <TableCell class="text-muted-foreground text-xs">{{ row.item.slug }}</TableCell>
              <TableCell class="text-muted-foreground max-w-60 truncate text-xs">
                {{ row.item.description || '-' }}
              </TableCell>
              <TableCell class="text-right tabular">{{ row.item.sort }}</TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" @click="openCreate(row.item.id)">
                    <Plus />
                    {{ t('admin.subcategories') }}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-8"
                    :aria-label="t('common.edit')"
                    @click="openEdit(row.item)"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-8"
                    :disabled="deleting === row.item.id"
                    :aria-label="t('common.delete')"
                    @click="askRemove(row.item)"
                  >
                    <Loader2 v-if="deleting === row.item.id" class="animate-spin" />
                    <Trash2 v-else class="text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>

    <Dialog v-model:open="dialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {{ editing ? t('admin.editCategory') : t('admin.newCategory') }}
          </DialogTitle>
          <DialogDescription>{{ t('admin.categoriesSubtitle') }}</DialogDescription>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="save">
          <ErrorAlert :message="formError" />

          <div class="space-y-2">
            <Label for="c-name">{{ t('admin.categoryName') }}</Label>
            <Input id="c-name" v-model="form.name" required />
          </div>

          <div class="space-y-2">
            <Label for="c-parent">{{ t('admin.categoryParent') }}</Label>
            <Select v-model="form.parentId">
              <SelectTrigger id="c-parent">
                <SelectValue :placeholder="t('admin.categoryTopLevel')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="TOP_LEVEL">{{ t('admin.categoryTopLevel') }}</SelectItem>
                <SelectItem v-for="row in parentOptions" :key="row.item.id" :value="String(row.item.id)">
                  {{ row.depth > 0 ? '　'.repeat(row.depth) + '└ ' : '' }}{{ row.item.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="c-slug">{{ t('admin.categorySlug') }}</Label>
            <Input id="c-slug" v-model="form.slug" autocomplete="off" />
            <p class="text-muted-foreground text-xs">{{ t('admin.categorySlugHint') }}</p>
          </div>

          <div class="space-y-2">
            <Label for="c-desc">{{ t('admin.categoryDescription') }}</Label>
            <Textarea id="c-desc" v-model="form.description" rows="2" />
          </div>

          <div class="space-y-2">
            <Label for="c-sort">{{ t('admin.categorySort') }}</Label>
            <Input id="c-sort" v-model="form.sort" type="number" />
            <p class="text-muted-foreground text-xs">{{ t('admin.categorySortHint') }}</p>
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
      :description="confirmTarget ? t('admin.deleteCategoryConfirm', { name: confirmTarget.name }) : ''"
      :confirm-text="t('common.delete')"
      danger
      @confirm="remove"
    />
  </div>
</template>
