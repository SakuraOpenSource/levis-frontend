<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import {
  FileText,
  Home,
  IdCard,
  KeyRound,
  Menu,
  MessageSquarePlus,
  Package,
  Store,
  Ticket,
  UserCog,
  Wallet,
} from 'lucide-vue-next'

import SidebarNav, { type NavItem } from '@/components/app/SidebarNav.vue'
import UserMenu from '@/components/app/UserMenu.vue'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useSiteStore } from '@/stores/site'

const { t } = useI18n()
const route = useRoute()
const site = useSiteStore()

const mobileOpen = ref(false)

// 侧边栏结构按需求固定：主页 / 业务管理→已购买的产品 / 财务→钱包、账单 / 安全中心
const items = computed<NavItem[]>(() => [
  { key: 'home', label: t('sidebar.home'), icon: Home, to: { name: 'dashboard' }, exact: true },
  {
    key: 'business',
    label: t('sidebar.business'),
    group: true,
    children: [
      { key: 'services', label: t('sidebar.services'), icon: Package, to: { name: 'services' } },
    ],
  },
  {
    key: 'finance',
    label: t('sidebar.finance'),
    group: true,
    children: [
      { key: 'wallet', label: t('sidebar.wallet'), icon: Wallet, to: { name: 'wallet' } },
      { key: 'invoices', label: t('sidebar.invoices'), icon: FileText, to: { name: 'invoices' } },
    ],
  },
  {
    key: 'support',
    label: t('sidebar.support'),
    group: true,
    children: [
      {
        key: 'ticket-new',
        label: t('sidebar.ticketNew'),
        icon: MessageSquarePlus,
        to: { name: 'ticket-new' },
      },
      { key: 'tickets', label: t('sidebar.tickets'), icon: Ticket, to: { name: 'tickets' }, exact: true },
    ],
  },
  {
    key: 'security',
    label: t('sidebar.security'),
    group: true,
    children: [
      // exact 必需：/dashboard/security 是另两个子路由的前缀，
      // 默认的前缀匹配会让「账号设置」在三个页面上一直亮着。
      {
        key: 'account',
        label: t('sidebar.account'),
        icon: UserCog,
        to: { name: 'security' },
        exact: true,
      },
      {
        key: 'verification',
        label: t('sidebar.verification'),
        icon: IdCard,
        to: { name: 'verification' },
      },
      { key: 'api-keys', label: t('sidebar.apiKeys'), icon: KeyRound, to: { name: 'api-keys' } },
    ],
  },
])

// 移动端点导航后要收起抽屉，否则新页面被遮住。
watch(() => route.fullPath, () => (mobileOpen.value = false))
</script>

<template>
  <div class="flex min-h-svh">
    <!-- 桌面端固定侧边栏 -->
    <aside
      class="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 shrink-0 flex-col border-r md:flex"
    >
      <div class="flex h-14 items-center gap-2 border-b px-4 font-semibold">
        <Store class="size-5" />
        <span class="truncate">{{ t('sidebar.dashboard') }}</span>
      </div>
      <SidebarNav :items="items" :title="t('sidebar.dashboard')" class="flex-1 overflow-y-auto" />
      <div class="border-sidebar-border border-t p-3">
        <Button variant="ghost" size="sm" class="w-full justify-start" as-child>
          <RouterLink :to="{ name: 'shop' }">
            <Store />
            {{ t('nav.shop') }}
          </RouterLink>
        </Button>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="bg-background/80 sticky top-0 z-40 flex h-14 items-center gap-2 border-b px-4 backdrop-blur"
      >
        <Button
          variant="ghost"
          size="icon"
          class="md:hidden"
          :aria-label="t('nav.toggleSidebar')"
          @click="mobileOpen = true"
        >
          <Menu />
        </Button>
        <RouterLink :to="{ name: 'shop' }" class="truncate font-semibold">
          {{ site.siteName }}
        </RouterLink>
        <div class="ml-auto">
          <UserMenu />
        </div>
      </header>

      <main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <RouterView />
      </main>
    </div>

    <!-- 移动端抽屉 -->
    <Sheet v-model:open="mobileOpen">
      <SheetContent side="left" class="bg-sidebar text-sidebar-foreground">
        <div class="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <Store class="size-5" />
          <SheetTitle>{{ t('sidebar.dashboard') }}</SheetTitle>
        </div>
        <SidebarNav
          :items="items"
          :title="t('sidebar.dashboard')"
          class="flex-1 overflow-y-auto"
          @navigate="mobileOpen = false"
        />
      </SheetContent>
    </Sheet>
  </div>
</template>
