<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { LayoutGrid, List, PackageX, ShoppingCart } from 'lucide-vue-next'

import CategorySection from '@/components/app/CategorySection.vue'
import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import ProductCard from '@/components/app/ProductCard.vue'
import { Button } from '@/components/ui/button'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { catalogApi } from '@/lib/endpoints'
import type { Category, Product } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { usePreferencesStore } from '@/stores/preferences'

interface AgentSummary {
  enabled: boolean
  tier: { name: string } | null
  next_tier: { name: string; min_balance_cents: number } | null
  discounts: { category_id: number; discount_permille: number }[]
}

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()
const toast = useToast()
const preferences = usePreferencesStore()

const categories = ref<Category[]>([])
const agentSummary = ref<AgentSummary | null>(null)
/** 分组折扣展示行：分组名 → 折扣文案。 */
const agentDiscountRows = ref<{ name: string; label: string }[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
/** 正在加购的商品 ID，用于按钮的局部 loading。 */
const adding = ref<number | null>(null)

/**
 * 分组树导航节点：分组可以无限嵌套，导航里把任意深度的后代都平铺成
 * 可选 tab（名称前带父路径），挂在任何一层的商品都要能被看到。
 */
interface NavNode {
  category: Category
  /** 面包屑路径（父分组名 /），根为空。 */
  path: string
  ownProducts: Product[]
  children: NavNode[]
}

function buildNode(category: Category, prefix: string): NavNode {
  return {
    category,
    path: prefix,
    ownProducts: category.products ?? [],
    children: (category.children ?? []).map((child) => buildNode(child, `${prefix}${category.name} / `)),
  }
}

/** 收集节点自身的全部后代（不含自己），用于渲染子级 tab。 */
function collectDescendants(node: NavNode): NavNode[] {
  return node.children.flatMap((child) => [child, ...collectDescendants(child)])
}

/** 节点及其全部后代的商品合集。 */
function subtreeProducts(node: NavNode): Product[] {
  return [...node.ownProducts, ...node.children.flatMap((child) => subtreeProducts(child))]
}

const sections = computed<NavNode[]>(() => categories.value.map((root) => buildNode(root, '')))

const hasAnyProduct = computed(() =>
  sections.value.some((section) => subtreeProducts(section).length > 0),
)

// ---------- 导航视图 ----------

/** 0 表示「全部」，子分组的 ID 不会为 0，可安全用作哨兵。 */
const ALL_CHILDREN = 0
const activeParentId = ref(0)
const activeChildId = ref(ALL_CHILDREN)

const activeSection = computed(
  () => sections.value.find((section) => section.category.id === activeParentId.value) ?? null,
)

/** 当前大类的全部后代（任意深度），作为子级 tab 展示。 */
const activeDescendants = computed<NavNode[]>(() =>
  activeSection.value ? collectDescendants(activeSection.value) : [],
)

/** 选中分组时展示其全部商品（含所有后代分组），选中具体后代时看该子树。 */
const navProducts = computed<Product[]>(() => {
  const section = activeSection.value
  if (!section) return []
  if (activeChildId.value !== ALL_CHILDREN) {
    const node = activeDescendants.value.find((item) => item.category.id === activeChildId.value)
    return node ? subtreeProducts(node) : []
  }
  return subtreeProducts(section)
})

/** 描述条优先显示更具体的那一层：选了子分组就显示子分组的描述。 */
const navDescription = computed(() => {
  const section = activeSection.value
  if (!section) return ''
  if (activeChildId.value !== ALL_CHILDREN) {
    const node = activeDescendants.value.find((item) => item.category.id === activeChildId.value)
    if (node?.category.description) return node.category.description
  }
  return section.category.description
})

/** 默认落在第一个有商品的大类上，避免打开就是空页。 */
function pickDefaultParent() {
  const preferred = sections.value.find((section) => subtreeProducts(section).length > 0)
  activeParentId.value = (preferred ?? sections.value[0])?.category.id ?? 0
  activeChildId.value = ALL_CHILDREN
}

function selectParent(id: number) {
  activeParentId.value = id
  activeChildId.value = ALL_CHILDREN
}

// 切到导航视图时若还没有选中项（例如数据比切换先到），补一次默认值。
watch(
  () => preferences.shopView,
  (view) => {
    if (view === 'nav' && !activeSection.value) pickDefaultParent()
  },
)

async function addToCart(product: Product) {
  if (!auth.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: '/shop' } })
    return
  }
  adding.value = product.id
  try {
    await cart.add(product.id, 1, product.billing_cycle)
    toast.success(t('shop.added'))
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    adding.value = null
  }
}

onMounted(async () => {
  try {
    categories.value = await catalogApi.categories()
    pickDefaultParent()
    if (auth.isLoggedIn) {
      try {
        const summary = await catalogApi.agentProgramSummary()
        agentSummary.value = summary
        if (summary.enabled && summary.tier && summary.discounts.length) {
          // 折扣挂的分组可能嵌套很深：按目录树递归找名字。
          const names = new Map<number, string>()
          const walk = (items: Category[]) => {
            for (const item of items) {
              names.set(item.id, item.name)
              walk(item.children ?? [])
            }
          }
          walk(categories.value)
          agentDiscountRows.value = summary.discounts.map((d: { category_id: number; discount_permille: number }) => ({
            name: names.get(d.category_id) ?? `分组 #${d.category_id}`,
            label: `${(d.discount_permille / 10).toFixed(1)} 折`,
          }))
        }
      } catch {}
    }
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-8">
    <PageHeader :title="t('shop.title')" :description="t('shop.subtitle')">
      <template #actions>
        <!-- 两种视图共用同一份商品卡片，只是找商品的方式不同 -->
        <div
          class="bg-muted flex items-center rounded-md p-0.5"
          role="group"
          :aria-label="t('shop.switchView')"
        >
          <Button
            :variant="preferences.shopView === 'list' ? 'outline' : 'ghost'"
            size="sm"
            class="gap-1.5"
            :aria-pressed="preferences.shopView === 'list'"
            @click="preferences.setShopView('list')"
          >
            <List />
            {{ t('shop.viewList') }}
          </Button>
          <Button
            :variant="preferences.shopView === 'nav' ? 'outline' : 'ghost'"
            size="sm"
            class="gap-1.5"
            :aria-pressed="preferences.shopView === 'nav'"
            @click="preferences.setShopView('nav')"
          >
            <LayoutGrid />
            {{ t('shop.viewNav') }}
          </Button>
        </div>

        <Button v-if="auth.isLoggedIn" variant="outline" size="sm" as-child>
          <RouterLink :to="{ name: 'cart' }">
            <ShoppingCart />
            {{ t('shop.viewCart') }}
          </RouterLink>
        </Button>
      </template>
    </PageHeader>

    <ErrorAlert :message="error" />
    <div
      v-if="agentSummary?.enabled && agentSummary.tier"
      class="bg-primary/10 border-primary/30 rounded-md border px-4 py-3 text-sm"
    >
      <span class="font-medium">{{ agentSummary.tier.name }}</span>
      <template v-if="agentDiscountRows.length">
        生效折扣：
        <span
          v-for="(row, i) in agentDiscountRows"
          :key="row.name"
          class="text-muted-foreground"
        >{{ i > 0 ? '、' : '' }}{{ row.name }} {{ row.label }}</span>
        ，下单自动按折后价结算。
      </template>
      <template v-else>暂无适用折扣。</template>
      <span v-if="agentSummary.next_tier" class="text-muted-foreground">
        （余额再充 ¥{{ (agentSummary.next_tier.min_balance_cents / 100).toFixed(2) }} 升级 {{ agentSummary.next_tier.name }}）
      </span>
    </div>
    <LoadingBlock v-if="loading" :rows="4" />

    <div
      v-else-if="!hasAnyProduct"
      class="text-muted-foreground flex flex-col items-center gap-3 py-16"
    >
      <PackageX class="size-10" />
      <p class="text-sm">{{ t('shop.empty') }}</p>
    </div>

    <!-- 导航视图：先按分组筛选，再看当前分组的商品 -->
    <template v-else-if="preferences.shopView === 'nav'">
      <div class="space-y-4">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span class="text-muted-foreground shrink-0 text-sm">{{ t('shop.selectCategory') }}</span>
          <Button
            v-for="section in sections"
            :key="section.category.id"
            :variant="activeParentId === section.category.id ? 'default' : 'outline'"
            size="sm"
            :aria-pressed="activeParentId === section.category.id"
            @click="selectParent(section.category.id)"
          >
            {{ section.category.name }}
          </Button>
        </div>

        <div
          v-if="activeDescendants.length"
          class="flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          <span class="text-muted-foreground shrink-0 text-sm">
            {{ t('shop.selectSubcategory') }}
          </span>
          <Button
            :variant="activeChildId === ALL_CHILDREN ? 'default' : 'outline'"
            size="sm"
            :aria-pressed="activeChildId === ALL_CHILDREN"
            @click="activeChildId = ALL_CHILDREN"
          >
            {{ t('shop.allSubcategories') }}
          </Button>
          <Button
            v-for="child in activeDescendants"
            :key="child.category.id"
            :variant="activeChildId === child.category.id ? 'default' : 'outline'"
            size="sm"
            :aria-pressed="activeChildId === child.category.id"
            @click="activeChildId = child.category.id"
          >
            {{ child.path }}{{ child.category.name }}
          </Button>
        </div>

        <!-- 分组描述：这批商品的共性说明，放在筛选栏与卡片之间 -->
        <p
          v-if="navDescription"
          class="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm whitespace-pre-line"
        >
          {{ navDescription }}
        </p>
      </div>

      <p v-if="!navProducts.length" class="text-muted-foreground py-12 text-center text-sm">
        {{ t('shop.noProductInGroup') }}
      </p>
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <ProductCard
          v-for="product in navProducts"
          :key="product.id"
          :product="product"
          :pending="adding === product.id"
          @add="addToCart"
        />
      </div>
    </template>

    <!-- 列表视图：分组树递归纵向平铺 -->
    <template v-else>
      <template v-for="section in sections" :key="section.category.id">
        <CategorySection :node="section" :adding="adding" @add="addToCart" />
      </template>
    </template>
  </div>
</template>
