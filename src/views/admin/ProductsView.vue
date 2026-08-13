<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import Pager from '@/components/app/Pager.vue'
import StateBadge from '@/components/app/StateBadge.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import { BILLING_CYCLES, type BillingCycle, type Category, type Product, type ProductStatus } from '@/lib/types'

const { t } = useI18n()
const toast = useToast()
const { cycleLabel } = useCycleLabel()

const items = ref<Product[]>([])
const categories = ref<Category[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref<string | null>(null)

/** '0' 为「全部分组」的哨兵值，SelectItem 不接受空字符串。 */
const ALL = '0'
const filterCategory = ref(ALL)

const dialogOpen = ref(false)
const editing = ref<Product | null>(null)
const saving = ref(false)
const formError = ref<string | null>(null)
const deleting = ref<number | null>(null)

const form = reactive({
  categoryId: '',
  name: '',
  description: '',
  priceYuan: '0',
  billingCycle: 'monthly' as BillingCycle,
  stock: '-1',
  status: 'active' as ProductStatus,
  sort: '0',
})

/** 分组下拉：大类直接显示，小类缩进一级，便于区分层级。 */
const categoryOptions = computed(() => {
  const out: { id: number; label: string }[] = []
  const parents = categories.value.filter((item) => item.parent_id === null)
  const byParent = new Map<number, Category[]>()
  for (const item of categories.value) {
    if (item.parent_id === null) continue
    const list = byParent.get(item.parent_id) ?? []
    list.push(item)
    byParent.set(item.parent_id, list)
  }
  for (const parent of parents) {
    out.push({ id: parent.id, label: parent.name })
    for (const child of byParent.get(parent.id) ?? []) {
      out.push({ id: child.id, label: `　└ ${child.name}` })
    }
  }
  return out
})

const categoryNames = computed(() => {
  const map = new Map<number, string>()
  for (const item of categories.value) map.set(item.id, item.name)
  return map
})

const hasCategory = computed(() => categories.value.length > 0)

async function loadProducts(target = page.value) {
  const result = await adminApi.products({
    page: target,
    page_size: pageSize.value,
    category_id: filterCategory.value === ALL ? undefined : Number(filterCategory.value),
  })
  items.value = result.items ?? []
  total.value = result.total
  page.value = result.page
  pageSize.value = result.page_size
}

async function load(target = page.value) {
  loading.value = true
  error.value = null
  try {
    await loadProducts(target)
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
    categoryId: categoryOptions.value[0] ? String(categoryOptions.value[0].id) : '',
    name: '',
    description: '',
    priceYuan: '0',
    billingCycle: 'monthly' as BillingCycle,
    stock: '-1',
    status: 'active' as ProductStatus,
    sort: '0',
  })
  dialogOpen.value = true
}

function openEdit(item: Product) {
  editing.value = item
  formError.value = null
  Object.assign(form, {
    categoryId: String(item.category_id),
    name: item.name,
    description: item.description,
    priceYuan: (item.price_cents / 100).toFixed(2),
    billingCycle: item.billing_cycle,
    stock: String(item.stock),
    status: item.status,
    sort: String(item.sort),
  })
  dialogOpen.value = true
}

async function save() {
  formError.value = null
  if (!form.name.trim() || !form.categoryId) {
    formError.value = t('error.required')
    return
  }
  // 元 → 分，四舍五入避免 19.99 * 100 的浮点误差。
  const priceCents = Math.round(Number(form.priceYuan) * 100)
  if (!Number.isFinite(priceCents) || priceCents < 0) {
    formError.value = t('error.required')
    return
  }
  saving.value = true
  try {
    const payload = {
      category_id: Number(form.categoryId),
      name: form.name.trim(),
      description: form.description.trim(),
      price_cents: priceCents,
      billing_cycle: form.billingCycle,
      stock: Number(form.stock),
      status: form.status,
      sort: Number(form.sort) || 0,
    }
    if (editing.value) {
      await adminApi.updateProduct(editing.value.id, payload)
      toast.success(t('common.saved'))
    } else {
      await adminApi.createProduct(payload)
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

async function remove(item: Product) {
  if (!window.confirm(t('admin.deleteProductConfirm', { name: item.name }))) return
  deleting.value = item.id
  try {
    await adminApi.deleteProduct(item.id)
    toast.success(t('common.deleted'))
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    deleting.value = null
  }
}

onMounted(async () => {
  try {
    const [cats] = await Promise.all([adminApi.categories(), loadProducts()])
    categories.value = cats
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('admin.productsTitle')" :description="t('admin.productsSubtitle')">
      <template #actions>
        <Button size="sm" :disabled="!hasCategory" @click="openCreate">
          <Plus />
          {{ t('admin.newProduct') }}
        </Button>
      </template>
    </PageHeader>

    <Alert v-if="!loading && !hasCategory" variant="warning">
      <AlertDescription class="flex flex-wrap items-center gap-3">
        {{ t('admin.noCategoryYet') }}
        <Button variant="outline" size="sm" as-child>
          <RouterLink :to="{ name: 'admin-categories' }">{{ t('adminNav.categories') }}</RouterLink>
        </Button>
      </AlertDescription>
    </Alert>

    <div class="max-w-60">
      <Label for="filter-category" class="mb-2">{{ t('admin.filterByCategory') }}</Label>
      <Select v-model="filterCategory" @update:model-value="load(1)">
        <SelectTrigger id="filter-category">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem :value="ALL">{{ t('shop.allCategories') }}</SelectItem>
          <SelectItem v-for="item in categoryOptions" :key="item.id" :value="String(item.id)">
            {{ item.label }}
          </SelectItem>
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
                <TableHead>{{ t('admin.productName') }}</TableHead>
                <TableHead>{{ t('admin.productCategory') }}</TableHead>
                <TableHead class="text-right">{{ t('admin.productPrice') }}</TableHead>
                <TableHead>{{ t('admin.productCycle') }}</TableHead>
                <TableHead class="text-right">{{ t('admin.productStock') }}</TableHead>
                <TableHead>{{ t('admin.productStatus') }}</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="7">{{ t('common.empty') }}</TableEmpty>
              <TableRow v-for="item in items" v-else :key="item.id">
                <TableCell class="font-medium">{{ item.name }}</TableCell>
                <TableCell class="text-muted-foreground text-xs">
                  {{ categoryNames.get(item.category_id) ?? '-' }}
                </TableCell>
                <TableCell class="text-right"><Money :cents="item.price_cents" /></TableCell>
                <TableCell>{{ cycleLabel(item.billing_cycle) }}</TableCell>
                <TableCell class="text-right tabular">
                  {{ item.stock < 0 ? t('common.unlimited') : item.stock }}
                </TableCell>
                <TableCell><StateBadge kind="product" :value="item.status" /></TableCell>
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
          <DialogTitle>{{ editing ? t('admin.editProduct') : t('admin.newProduct') }}</DialogTitle>
          <DialogDescription>{{ t('admin.productsSubtitle') }}</DialogDescription>
        </DialogHeader>

        <form class="space-y-4" @submit.prevent="save">
          <ErrorAlert :message="formError" />

          <div class="space-y-2">
            <Label for="p-name">{{ t('admin.productName') }}</Label>
            <Input id="p-name" v-model="form.name" required />
          </div>

          <div class="space-y-2">
            <Label for="p-category">{{ t('admin.productCategory') }}</Label>
            <Select v-model="form.categoryId">
              <SelectTrigger id="p-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="item in categoryOptions" :key="item.id" :value="String(item.id)">
                  {{ item.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="p-desc">{{ t('admin.productDescription') }}</Label>
            <Textarea id="p-desc" v-model="form.description" rows="3" />
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="p-price">{{ t('admin.productPrice') }}</Label>
              <Input id="p-price" v-model="form.priceYuan" type="number" min="0" step="0.01" required />
            </div>
            <div class="space-y-2">
              <Label for="p-cycle">{{ t('admin.productCycle') }}</Label>
              <Select v-model="form.billingCycle">
                <SelectTrigger id="p-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="cycle in BILLING_CYCLES" :key="cycle" :value="cycle">
                    {{ cycleLabel(cycle) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="p-stock">{{ t('admin.productStock') }}</Label>
              <Input id="p-stock" v-model="form.stock" type="number" />
              <p class="text-muted-foreground text-xs">{{ t('admin.productStockHint') }}</p>
            </div>
            <div class="space-y-2">
              <Label for="p-status">{{ t('admin.productStatus') }}</Label>
              <Select v-model="form.status">
                <SelectTrigger id="p-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{{ t('admin.productStatusActive') }}</SelectItem>
                  <SelectItem value="hidden">{{ t('admin.productStatusHidden') }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="p-sort">{{ t('admin.productSort') }}</Label>
              <Input id="p-sort" v-model="form.sort" type="number" />
              <p class="text-muted-foreground text-xs">{{ t('admin.categorySortHint') }}</p>
            </div>
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
