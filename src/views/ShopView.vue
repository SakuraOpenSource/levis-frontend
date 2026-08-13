<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { PackageX, ShoppingCart } from 'lucide-vue-next'

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

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()
const toast = useToast()

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
