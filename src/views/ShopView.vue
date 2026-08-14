<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { LayoutGrid, List, PackageX, ShoppingCart } from 'lucide-vue-next'

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

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()
const toast = useToast()
const preferences = usePreferencesStore()

const categories = ref<Category[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
/** 正在加购的商品 ID，用于按钮的局部 loading。 */
const adding = ref<number | null>(null)

/**
 * 大类 → 小类 → 商品。挂在大类本身的商品也要展示，
 * 否则管理员把商品直接放在大类下就「不见了」。
 */
interface Section {
  category: Category
  ownProducts: Product[]
  children: { category: Category; products: Product[] }[]
}

const sections = computed<Section[]>(() =>
  categories.value.map((parent) => ({
    category: parent,
    ownProducts: parent.products ?? [],
    children: (parent.children ?? []).map((child) => ({
      category: child,
      products: child.products ?? [],
    })),
  })),
)

const hasAnyProduct = computed(() =>
  sections.value.some(
    (section) =>
      section.ownProducts.length > 0 || section.children.some((child) => child.products.length > 0),
  ),
)

// ---------- 导航视图 ----------

/** 0 表示「全部」，子分组的 ID 不会为 0，可安全用作哨兵。 */
const ALL_CHILDREN = 0
const activeParentId = ref(0)
const activeChildId = ref(ALL_CHILDREN)

const activeSection = computed(
  () => sections.value.find((section) => section.category.id === activeParentId.value) ?? null,
)

/** 选中大类时展示其全部商品（含小类），选中小类时只看该小类。 */
const navProducts = computed<Product[]>(() => {
  const section = activeSection.value
  if (!section) return []
  if (activeChildId.value !== ALL_CHILDREN) {
    return section.children.find((child) => child.category.id === activeChildId.value)?.products ?? []
  }
  return [...section.ownProducts, ...section.children.flatMap((child) => child.products)]
})

/** 描述条优先显示更具体的那一层：选了小类就显示小类的描述。 */
const navDescription = computed(() => {
  const section = activeSection.value
  if (!section) return ''
  if (activeChildId.value !== ALL_CHILDREN) {
    const child = section.children.find((item) => item.category.id === activeChildId.value)
    if (child?.category.description) return child.category.description
  }
  return section.category.description
})

/** 默认落在第一个有商品的大类上，避免打开就是空页。 */
function pickDefaultParent() {
  const preferred = sections.value.find(
    (section) =>
      section.ownProducts.length > 0 || section.children.some((child) => child.products.length > 0),
  )
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
          v-if="activeSection?.children.length"
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
            v-for="child in activeSection.children"
            :key="child.category.id"
            :variant="activeChildId === child.category.id ? 'default' : 'outline'"
            size="sm"
            :aria-pressed="activeChildId === child.category.id"
            @click="activeChildId = child.category.id"
          >
            {{ child.category.name }}
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

    <!-- 列表视图：所有分组纵向平铺 -->
    <template v-else>
      <section v-for="section in sections" :key="section.category.id" class="space-y-4">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold">{{ section.category.name }}</h2>
          <p v-if="section.category.description" class="text-muted-foreground text-sm">
            {{ section.category.description }}
          </p>
        </div>

        <!-- 直接挂在大类下的商品 -->
        <div v-if="section.ownProducts.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ProductCard
            v-for="product in section.ownProducts"
            :key="product.id"
            :product="product"
            :pending="adding === product.id"
            @add="addToCart"
          />
        </div>

        <!-- 小类分块 -->
        <div v-for="child in section.children" :key="child.category.id" class="space-y-3">
          <div class="flex items-baseline gap-2">
            <h3 class="text-sm font-medium">{{ child.category.name }}</h3>
            <p v-if="child.category.description" class="text-muted-foreground text-xs">
              {{ child.category.description }}
            </p>
          </div>

          <p v-if="!child.products.length" class="text-muted-foreground text-sm">
            {{ t('shop.empty') }}
          </p>
          <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProductCard
              v-for="product in child.products"
              :key="product.id"
              :product="product"
              :pending="adding === product.id"
              @add="addToCart"
            />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
