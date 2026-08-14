<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { FolderTree, Gauge, Menu, Package, Settings, Store, Users } from 'lucide-vue-next'

import SidebarNav, { type NavItem } from '@/components/app/SidebarNav.vue'
import UserMenu from '@/components/app/UserMenu.vue'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useSiteStore } from '@/stores/site'

const { t } = useI18n()
const route = useRoute()
const site = useSiteStore()

const mobileOpen = ref(false)

const items = computed<NavItem[]>(() => [
  { key: 'overview', label: t('adminNav.overview'), icon: Gauge, to: { name: 'admin' }, exact: true },
  { key: 'users', label: t('adminNav.users'), icon: Users, to: { name: 'admin-users' } },
  {
    key: 'categories',
    label: t('adminNav.categories'),
    icon: FolderTree,
    to: { name: 'admin-categories' },
  },
  { key: 'products', label: t('adminNav.products'), icon: Package, to: { name: 'admin-products' } },
  { key: 'settings', label: t('adminNav.settings'), icon: Settings, to: { name: 'admin-settings' } },
])

watch(() => route.fullPath, () => (mobileOpen.value = false))
</script>

<template>
  <div class="flex min-h-svh">
    <aside
      class="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 shrink-0 flex-col border-r md:flex"
    >
      <div class="flex h-14 items-center gap-2 border-b px-4 font-semibold">
        <Gauge class="size-5" />
        <span class="truncate">{{ t('adminNav.title') }}</span>
      </div>
      <SidebarNav :items="items" :title="t('adminNav.title')" class="flex-1 overflow-y-auto" />
      <div class="border-sidebar-border border-t p-3">
        <Button variant="ghost" size="sm" class="w-full justify-start" as-child>
          <RouterLink :to="{ name: 'shop' }">
            <Store />
            {{ t('adminNav.backToSite') }}
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

      <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <RouterView />
      </main>
    </div>

    <Sheet v-model:open="mobileOpen">
      <SheetContent side="left" class="bg-sidebar text-sidebar-foreground">
        <div class="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <Gauge class="size-5" />
          <SheetTitle>{{ t('adminNav.title') }}</SheetTitle>
        </div>
        <SidebarNav
          :items="items"
          :title="t('adminNav.title')"
          class="flex-1 overflow-y-auto"
          @navigate="mobileOpen = false"
        />
      </SheetContent>
    </Sheet>
  </div>
</template>
