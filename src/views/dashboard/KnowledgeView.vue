<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen, ChevronRight } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import { Card, CardContent } from '@/components/ui/card'
import { errorMessage } from '@/lib/api'
import { articleApi } from '@/lib/endpoints'
import { formatDateTime } from '@/lib/utils'
import type { Article } from '@/lib/types'

/**
 * 用户中心知识库列表页：只读已发布文章的索引（不含正文），
 * 点击进入公开文章阅读页。
 */

const { t } = useI18n()

const articles = ref<Article[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    articles.value = await articleApi.list()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold tracking-tight">{{ t('knowledge.title') }}</h1>
      <p class="text-muted-foreground text-sm">{{ t('knowledge.subtitle') }}</p>
    </header>

    <LoadingBlock v-if="loading" :rows="4" />

    <template v-else-if="error">
      <ErrorAlert :message="error" />
    </template>

    <Card v-else-if="articles.length === 0">
      <CardContent class="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center">
        <BookOpen class="size-8" />
        <p class="text-sm">{{ t('knowledge.empty') }}</p>
      </CardContent>
    </Card>

    <Card v-else>
      <CardContent class="p-2">
        <ul class="divide-y">
          <li v-for="item in articles" :key="item.id">
            <RouterLink
              :to="{ name: 'article-detail', params: { slug: item.slug } }"
              class="hover:bg-accent flex items-center gap-3 rounded-md px-3 py-3 transition-colors"
            >
              <BookOpen class="text-muted-foreground size-4 shrink-0" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ item.title }}</span>
                <span class="text-muted-foreground block text-xs tabular">
                  {{ t('knowledge.updatedAt') }}：{{ formatDateTime(item.updated_at) }}
                </span>
              </span>
              <ChevronRight class="text-muted-foreground size-4 shrink-0" />
            </RouterLink>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
