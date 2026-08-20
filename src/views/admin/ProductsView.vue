<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-vue-next'

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
import {
  BILLING_CYCLES,
  type BillingCycle,
  type Category,
  type Product,
  type ProductStatus,
  type Spec,
} from '@/lib/types'

const { t } = useI18n()
const toast = useToast()
const { cycleLabel } = useCycleLabel()

const items = ref<Product[]>([])
const categories = ref<Category[]>([])
const provisionPlugins = ref<{ id: string; name: string }[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(true)
const error = ref<string | null>(null)

/** 上游产品列表：选择上游插件后加载，供挑选要关联的上游商品。 */
interface UpstreamProduct {
  id: string
  name: string
  description: string
  group_name: string
  price_cents: number
  billing_cycle: string
}
const upstreamProducts = ref<UpstreamProduct[]>([])
const upstreamLoading = ref(false)
const syncingInfo = ref<number | null>(null)

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
  upstreamPluginId: '',
  upstreamProductId: '',
})

/** 规格行独立于 form：行数可变，用数组比塞进 reactive 对象更直观。 */
const specs = ref<Spec[]>([])
/** 与后端 maxSpecs 一致，超出时提前挡掉而不是等 400。 */
const MAX_SPECS = 20

function addSpec() {
  if (specs.value.length >= MAX_SPECS) return
  specs.value.push({ label: '', value: '' })
}

function removeSpec(index: number) {
  specs.value.splice(index, 1)
}

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
    upstreamPluginId: '',
    upstreamProductId: '',
  })
  specs.value = []
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
    upstreamPluginId: item.upstream_plugin_id || '',
    upstreamProductId: item.upstream_product_id || '',
  })
  // 拷贝一份，避免直接编辑列表里的对象导致取消后表格也变了。
  specs.value = (item.specs ?? []).map((spec) => ({ ...spec }))
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
  // 全空行直接丢掉；只填一半的行留给后端报错，免得静默吞掉用户的输入。
  const cleanSpecs = specs.value
    .map((spec) => ({ label: spec.label.trim(), value: spec.value.trim() }))
    .filter((spec) => spec.label !== '' || spec.value !== '')

  saving.value = true
  try {
    const payload = {
      category_id: Number(form.categoryId),
      name: form.name.trim(),
      description: form.description.trim(),
      specs: cleanSpecs,
      price_cents: priceCents,
      billing_cycle: form.billingCycle,
      stock: Number(form.stock),
      status: form.status,
      sort: Number(form.sort) || 0,
      upstream_plugin_id: form.upstreamPluginId,
      upstream_product_id: form.upstreamProductId,
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

/** 选择上游插件后加载其商品列表，供挑选要关联的上游商品。 */
async function loadUpstreamProducts(pluginId: string) {
  form.upstreamProductId = ''
  upstreamProducts.value = []
  if (!pluginId) return
  upstreamLoading.value = true
  try {
    upstreamProducts.value = await adminApi.upstreamProducts(pluginId)
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    upstreamLoading.value = false
  }
}

/** 选中某个上游商品时，自动带出其名称与简介，方便直接保存。 */
function pickUpstreamProduct(productId: string) {
  const found = upstreamProducts.value.find((item) => item.id === productId)
  if (!found) return
  form.name = found.name
  form.description = found.description
}

/** 从上游拉取价格、计费周期与简介并更新本地商品。 */
async function syncInfo(item: Product) {
  syncingInfo.value = item.id
  try {
    const result = await adminApi.syncProductInfo(item.id)
    toast.success(result.message || '同步完成')
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    syncingInfo.value = null
  }
}

onMounted(async () => {
  try {
    const [cats, plugs] = await Promise.all([
      adminApi.categories(),
      adminApi.provisionPlugins().catch(() => [] as { id: string; name: string }[]),
      loadProducts(),
    ])
    categories.value = cats
    provisionPlugins.value = plugs
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
                <TableHead>{{ t('admin.productUpstream') }}</TableHead>
                <TableHead class="text-right">{{ t('common.actions') }}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty v-if="!items.length" :colspan="8">{{ t('common.empty') }}</TableEmpty>
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
                <TableCell class="text-muted-foreground text-xs">
                  {{ item.upstream_plugin_id || t('admin.productUpstreamNone') }}
                </TableCell>
                <TableCell class="text-right">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-if="item.upstream_plugin_id"
                      variant="ghost"
                      size="icon"
                      class="size-8"
                      :disabled="syncingInfo === item.id"
                      :aria-label="t('admin.syncProductInfo')"
                      :title="t('admin.syncProductInfo')"
                      @click="syncInfo(item)"
                    >
                      <Loader2 v-if="syncingInfo === item.id" class="animate-spin" />
                      <RefreshCw v-else />
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

          <div v-if="provisionPlugins.length" class="space-y-2">
            <Label for="p-upstream">{{ t('admin.productUpstream') }}</Label>
            <Select v-model="form.upstreamPluginId" @update:model-value="(v) => loadUpstreamProducts(String(v ?? ''))">
              <SelectTrigger id="p-upstream">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{{ t('admin.productUpstreamNone') }}</SelectItem>
                <SelectItem v-for="plug in provisionPlugins" :key="plug.id" :value="plug.id">
                  {{ plug.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div v-if="form.upstreamPluginId" class="space-y-2">
            <Label for="p-upstream-product">上游商品</Label>
            <Select v-model="form.upstreamProductId" @update:model-value="(v) => pickUpstreamProduct(String(v ?? ''))">
              <SelectTrigger id="p-upstream-product">
                <SelectValue :placeholder="upstreamLoading ? '加载中…' : '请选择上游商品'" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="up in upstreamProducts"
                  :key="up.id"
                  :value="up.id"
                >
                  {{ up.group_name ? `${up.group_name} / ` : '' }}{{ up.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-muted-foreground text-xs">选择上游商品后会自动带出名称与简介</p>
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

          <div class="space-y-2">
            <Label>{{ t('admin.productSpecs') }}</Label>
            <p class="text-muted-foreground text-xs">{{ t('admin.productSpecsHint') }}</p>

            <div v-for="(spec, index) in specs" :key="index" class="flex items-center gap-2">
              <Input
                v-model="spec.label"
                class="w-28 shrink-0"
                :aria-label="t('admin.specLabel')"
                :placeholder="t('admin.specLabelPlaceholder')"
              />
              <Input
                v-model="spec.value"
                :aria-label="t('admin.specValue')"
                :placeholder="t('admin.specValuePlaceholder')"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="size-9 shrink-0"
                :aria-label="t('admin.removeSpec')"
                @click="removeSpec(index)"
              >
                <X />
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              :disabled="specs.length >= MAX_SPECS"
              @click="addSpec"
            >
              <Plus />
              {{ t('admin.addSpec') }}
            </Button>
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