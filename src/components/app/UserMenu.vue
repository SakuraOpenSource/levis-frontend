<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { LayoutDashboard, LogOut, Moon, Settings, Sun, User } from 'lucide-vue-next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/composables/useToast'
import { formatCents } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const theme = useThemeStore()
const toast = useToast()

async function onLogout() {
  await auth.logout()
  toast.success(t('auth.loggedOut'))
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="flex items-center gap-1">
    <Button
      variant="ghost"
      size="icon"
      :aria-label="t('nav.toggleTheme')"
      @click="theme.toggle()"
    >
      <Sun v-if="theme.theme === 'dark'" />
      <Moon v-else />
    </Button>

    <template v-if="auth.isLoggedIn">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="sm" :aria-label="t('nav.userMenu')">
            <User />
            <span class="max-w-24 truncate">{{ auth.user?.username }}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="min-w-48">
          <DropdownMenuLabel class="flex flex-col gap-0.5">
            <span class="truncate">{{ auth.user?.email }}</span>
            <span class="text-muted-foreground text-xs tabular">
              {{ t('dashboard.balance') }} {{ formatCents(auth.balanceCents) }}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem as-child>
            <RouterLink :to="{ name: 'dashboard' }" class="flex w-full items-center gap-2">
              <LayoutDashboard />
              {{ t('nav.dashboard') }}
            </RouterLink>
          </DropdownMenuItem>
          <DropdownMenuItem v-if="auth.isAdmin" as-child>
            <RouterLink :to="{ name: 'admin' }" class="flex w-full items-center gap-2">
              <Settings />
              {{ t('nav.admin') }}
            </RouterLink>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" @select="onLogout">
            <LogOut />
            {{ t('nav.logout') }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>

    <template v-else>
      <Button variant="ghost" size="sm" as-child>
        <RouterLink :to="{ name: 'login' }">{{ t('nav.login') }}</RouterLink>
      </Button>
      <Button size="sm" as-child>
        <RouterLink :to="{ name: 'register' }">{{ t('nav.register') }}</RouterLink>
      </Button>
    </template>
  </div>
</template>
