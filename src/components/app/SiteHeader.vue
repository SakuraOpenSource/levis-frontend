<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ShoppingCart, Store } from 'lucide-vue-next'

import UserMenu from '@/components/app/UserMenu.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { useCartStore } from '@/stores/cart'
import { useSiteStore } from '@/stores/site'

const { t } = useI18n()
const site = useSiteStore()
const auth = useAuthStore()
const cart = useCartStore()

onMounted(async () => {
  // 未登录时购物车在后端不存在，不必请求。
  await auth.restore()
  if (auth.isLoggedIn) {
    cart.load().catch(() => {})
  }
})
</script>

<template>
  <header class="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
    <div class="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
      <RouterLink :to="{ name: 'shop' }" class="flex items-center gap-2 font-semibold">
        <Store class="size-5" />
        <span class="truncate">{{ site.siteName }}</span>
      </RouterLink>

      <nav class="ml-2 hidden items-center gap-1 sm:flex">
        <Button variant="ghost" size="sm" as-child>
          <RouterLink :to="{ name: 'shop' }">{{ t('nav.shop') }}</RouterLink>
        </Button>
        <Button v-if="auth.isLoggedIn" variant="ghost" size="sm" as-child>
          <RouterLink :to="{ name: 'dashboard' }">{{ t('nav.dashboard') }}</RouterLink>
        </Button>
      </nav>

      <div class="ml-auto flex items-center gap-1">
        <Button
          v-if="auth.isLoggedIn"
          variant="ghost"
          size="sm"
          as-child
          :aria-label="t('nav.cart')"
        >
          <RouterLink :to="{ name: 'cart' }" class="relative">
            <ShoppingCart />
            <span class="hidden sm:inline">{{ t('nav.cart') }}</span>
            <Badge v-if="cart.count > 0" variant="destructive" class="ml-1 tabular">
              {{ cart.count }}
            </Badge>
          </RouterLink>
        </Button>
        <UserMenu />
      </div>
    </div>
  </header>
</template>
