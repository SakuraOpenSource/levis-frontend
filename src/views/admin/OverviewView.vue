<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderTree, Package, Receipt, ShoppingBag, Users } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { errorMessage } from '@/lib/api'
import { adminApi } from '@/lib/endpoints'
import type { AdminStats } from '@/lib/types'

const { t } = useI18n()

const stats = ref<AdminStats | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    stats.value = await adminApi.stats()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('admin.overviewTitle')" :description="t('admin.overviewSubtitle')" />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="3" />

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card class="gap-3 py-5">
          <CardHeader class="px-5">
            <CardTitle class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <Users class="size-4" />
              {{ t('admin.userCount') }}
            </CardTitle>
          </CardHeader>
          <CardContent class="px-5">
            <p class="text-2xl font-semibold tabular">{{ stats?.user_count ?? 0 }}</p>
          </CardContent>
        </Card>

        <Card class="gap-3 py-5">
          <CardHeader class="px-5">
            <CardTitle class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <Package class="size-4" />
              {{ t('admin.productCount') }}
            </CardTitle>
          </CardHeader>
          <CardContent class="px-5">
            <p class="text-2xl font-semibold tabular">{{ stats?.product_count ?? 0 }}</p>
          </CardContent>
        </Card>

        <Card class="gap-3 py-5">
          <CardHeader class="px-5">
            <CardTitle class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <ShoppingBag class="size-4" />
              {{ t('admin.orderCount') }}
            </CardTitle>
          </CardHeader>
          <CardContent class="px-5">
            <p class="text-2xl font-semibold tabular">{{ stats?.order_count ?? 0 }}</p>
          </CardContent>
        </Card>

        <Card class="gap-3 py-5">
          <CardHeader class="px-5">
            <CardTitle class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <FolderTree class="size-4" />
              {{ t('admin.serviceCount') }}
            </CardTitle>
          </CardHeader>
          <CardContent class="px-5">
            <p class="text-2xl font-semibold tabular">{{ stats?.service_count ?? 0 }}</p>
          </CardContent>
        </Card>

        <Card class="gap-3 py-5">
          <CardHeader class="px-5">
            <CardTitle class="text-muted-foreground flex items-center gap-2 text-sm font-medium">
              <Receipt class="size-4" />
              {{ t('admin.revenue') }}
            </CardTitle>
          </CardHeader>
          <CardContent class="px-5">
            <Money :cents="stats?.revenue_cents ?? 0" class="text-2xl font-semibold" />
          </CardContent>
        </Card>
      </div>

      <div class="flex flex-wrap gap-3">
        <Button variant="outline" as-child>
          <RouterLink :to="{ name: 'admin-users' }">
            <Users />
            {{ t('adminNav.users') }}
          </RouterLink>
        </Button>
        <Button variant="outline" as-child>
          <RouterLink :to="{ name: 'admin-categories' }">
            <FolderTree />
            {{ t('adminNav.categories') }}
          </RouterLink>
        </Button>
        <Button variant="outline" as-child>
          <RouterLink :to="{ name: 'admin-products' }">
            <Package />
            {{ t('adminNav.products') }}
          </RouterLink>
        </Button>
      </div>
    </template>
  </div>
</template>
