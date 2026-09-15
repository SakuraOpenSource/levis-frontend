<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  Cloud,
  Cpu,
  CreditCard,
  Database,
  Globe,
  Loader2,
  Lock,
  Package,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import ProductCard from '@/components/app/ProductCard.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { catalogApi } from '@/lib/endpoints'
import type { Product } from '@/lib/types'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useSiteStore } from '@/stores/site'

/** 图标名到组件的映射，键与后端 service.HomeFeatureIcons 保持一致。 */
const ICONS: Record<string, Component> = {
  zap: Zap,
  rocket: Rocket,
  'shield-check': ShieldCheck,
  server: Server,
  cloud: Cloud,
  database: Database,
  cpu: Cpu,
  globe: Globe,
  lock: Lock,
  sparkles: Sparkles,
  package: Package,
  'credit-card': CreditCard,
}

const { t } = useI18n()
const router = useRouter()
const site = useSiteStore()
const auth = useAuthStore()
const cart = useCartStore()
const toast = useToast()

const products = ref<Product[]>([])
const productsLoading = ref(false)
const productsError = ref<string | null>(null)
const adding = ref<number | null>(null)

/**
 * 主页关闭时的回落：组件级重定向到商店。
 * 守卫里做不到这一点 —— bootstrap 在全局守卫中才加载，而路由表是静态的；
 * 组件级还能覆盖管理员在本站会话中关掉主页的情形。
 */
function ensureEnabled() {
  if (site.loaded && !site.home) {
    router.replace({ name: 'shop' })
  }
}

watch(
  () => site.home,
  () => ensureEnabled(),
)

const showProducts = computed(() => !!site.home?.show_products)

function isInternal(link: string) {
  return link.startsWith('/') && !link.startsWith('//')
}

function iconOf(name: string): Component {
  return ICONS[name] ?? Sparkles
}

async function loadProducts() {
  if (!showProducts.value) return
  productsLoading.value = true
  productsError.value = null
  try {
    const items = await catalogApi.products()
    products.value = items.slice(0, 4)
  } catch (err) {
    productsError.value = errorMessage(err)
  } finally {
    productsLoading.value = false
  }
}

async function addToCart(product: Product) {
  if (!auth.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: '/' } })
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

onMounted(() => {
  ensureEnabled()
  void loadProducts()
})

watch(showProducts, () => {
  void loadProducts()
})
</script>

<template>
  <div v-if="site.home" class="space-y-16 py-8">
    <!-- 主视觉：居中排版，徽标 + 大标题 + 副标题 + 双 CTA。 -->
    <section class="mx-auto max-w-3xl space-y-6 text-center">
      <Badge v-if="site.home.badge" variant="secondary" class="gap-1.5 px-3 py-1 text-sm">
        <Sparkles class="size-3.5" />
        {{ site.home.badge }}
      </Badge>
      <h1 class="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        {{ site.home.title || site.siteName }}
      </h1>
      <p v-if="site.home.subtitle" class="text-muted-foreground text-xl text-balance">
        {{ site.home.subtitle }}
      </p>
      <p
        v-if="site.home.description || site.siteDescription"
        class="text-muted-foreground mx-auto max-w-2xl whitespace-pre-line"
      >
        {{ site.home.description || site.siteDescription }}
      </p>
      <div
        v-if="site.home.primary_button.text || site.home.secondary_button.text"
        class="flex flex-wrap items-center justify-center gap-3"
      >
        <Button v-if="site.home.primary_button.text" size="lg" as-child>
          <RouterLink
            v-if="isInternal(site.home.primary_button.link || '/shop')"
            :to="site.home.primary_button.link || '/shop'"
          >
            {{ site.home.primary_button.text }}
            <ArrowRight />
          </RouterLink>
          <a
            v-else
            :href="site.home.primary_button.link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ site.home.primary_button.text }}
            <ArrowRight />
          </a>
        </Button>
        <Button v-if="site.home.secondary_button.text" size="lg" variant="outline" as-child>
          <RouterLink
            v-if="isInternal(site.home.secondary_button.link || '/shop')"
            :to="site.home.secondary_button.link || '/shop'"
          >
            {{ site.home.secondary_button.text }}
          </RouterLink>
          <a
            v-else
            :href="site.home.secondary_button.link"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ site.home.secondary_button.text }}
          </a>
        </Button>
      </div>
    </section>

    <!-- 主视觉横幅图：URL 由管理端配置，外链或站内路径均可。 -->
    <section v-if="site.home.hero_image_url" class="mx-auto max-w-4xl">
      <img
        :src="site.home.hero_image_url"
        :alt="site.home.title || site.siteName"
        class="border-border w-full rounded-xl border object-cover shadow-lg"
        loading="lazy"
      />
    </section>

    <!-- 数据条：2 列（移动）/ 4 列（桌面）。 -->
    <section v-if="site.home.stats.length" class="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
      <div
        v-for="(stat, index) in site.home.stats"
        :key="index"
        class="space-y-1 rounded-lg text-center"
      >
        <p class="text-2xl font-bold tabular sm:text-3xl">{{ stat.value }}</p>
        <p class="text-muted-foreground text-sm">{{ stat.label }}</p>
      </div>
    </section>

    <!-- 特性卡片：有链接时整卡可点，无链接时纯展示。 -->
    <section v-if="site.home.features.length" class="mx-auto max-w-5xl space-y-6">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <template v-for="(feature, index) in site.home.features" :key="index">
          <component
            :is="feature.link ? (isInternal(feature.link) ? 'RouterLink' : 'a') : 'div'"
            :to="feature.link && isInternal(feature.link) ? feature.link : undefined"
            :href="feature.link && !isInternal(feature.link) ? feature.link : undefined"
            :target="feature.link && !isInternal(feature.link) ? '_blank' : undefined"
            :rel="feature.link && !isInternal(feature.link) ? 'noopener noreferrer' : undefined"
            class="block h-full"
          >
            <Card
              class="h-full gap-3 py-5 transition-colors"
              :class="feature.link ? 'hover:border-primary/50 hover:bg-accent/50' : ''"
            >
              <CardHeader class="px-5">
                <span
                  class="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-lg"
                >
                  <component :is="iconOf(feature.icon)" class="size-5" />
                </span>
                <CardTitle class="text-base">{{ feature.title }}</CardTitle>
              </CardHeader>
              <CardContent v-if="feature.desc" class="px-5">
                <p class="text-muted-foreground text-sm whitespace-pre-line">{{ feature.desc }}</p>
              </CardContent>
            </Card>
          </component>
        </template>
      </div>
    </section>

    <!-- 商品预览：取前 4 个上架商品，加购逻辑与商店一致。 -->
    <section v-if="showProducts" class="mx-auto max-w-6xl space-y-6">
      <div class="flex items-end justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-2xl font-semibold tracking-tight">{{ t('home.productsTitle') }}</h2>
          <p class="text-muted-foreground text-sm">{{ t('home.productsSubtitle') }}</p>
        </div>
        <Button variant="outline" size="sm" as-child>
          <RouterLink :to="{ name: 'shop' }">
            {{ t('home.viewAll') }}
            <ArrowRight />
          </RouterLink>
        </Button>
      </div>
      <ErrorAlert :message="productsError" />
      <div v-if="productsLoading" class="flex items-center gap-2 py-8">
        <Loader2 class="animate-spin" />
        <span class="text-muted-foreground text-sm">{{ t('common.loading') }}</span>
      </div>
      <div v-else-if="products.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ProductCard
          v-for="product in products"
          :key="product.id"
          :product="product"
          :pending="adding === product.id"
          @add="addToCart"
        />
      </div>
    </section>
  </div>
  <LoadingBlock v-else-if="!site.loaded" :rows="4" />
</template>
