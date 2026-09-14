<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ApiError, errorMessage } from '@/lib/api'
import { articleApi } from '@/lib/endpoints'
import { renderMarkdown } from '@/lib/markdown'
import { formatDateTime } from '@/lib/utils'
import type { Article } from '@/lib/types'

/**
 * 公开文章阅读页：商品购买协议的外链落点。
 * 只读已发布文章，草稿与不存在一律按 404 展示，避免探测草稿存在。
 */

const { t } = useI18n()
const route = useRoute()

const slug = computed(() => String(route.params.slug ?? ''))

const article = ref<Article | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notFound = ref(false)

const html = computed(() => renderMarkdown(article.value?.content_md ?? ''))

async function load() {
  const value = slug.value.trim()
  if (!value) {
    article.value = null
    notFound.value = true
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  notFound.value = false
  try {
    article.value = await articleApi.get(value)
  } catch (err) {
    article.value = null
    if (err instanceof ApiError && (err.status === 404 || err.code === 'NOT_FOUND')) {
      notFound.value = true
    } else {
      error.value = errorMessage(err)
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.slug, load)
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <LoadingBlock v-if="loading" :rows="4" />

    <div
      v-else-if="notFound"
      class="flex flex-col items-center justify-center gap-4 px-4 py-16 text-center"
    >
      <p class="text-muted-foreground text-6xl font-semibold tabular">404</p>
      <h1 class="text-xl font-semibold">{{ t('articles.notFound') }}</h1>
      <p class="text-muted-foreground text-sm">{{ t('error.notFoundHint') }}</p>
      <Button as-child>
        <RouterLink :to="{ name: 'shop' }">{{ t('error.backHome') }}</RouterLink>
      </Button>
    </div>

    <template v-else-if="error">
      <ErrorAlert :message="error" />
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" @click="load">
          {{ t('common.retry') }}
        </Button>
        <Button variant="ghost" size="sm" as-child>
          <RouterLink :to="{ name: 'shop' }">{{ t('error.backHome') }}</RouterLink>
        </Button>
      </div>
    </template>

    <article v-else-if="article" class="space-y-4">
      <header class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">{{ article.title }}</h1>
        <p class="text-muted-foreground text-xs tabular">
          {{ t('articles.updatedAt') }}：{{ formatDateTime(article.updated_at) }}
        </p>
      </header>
      <Card>
        <CardContent>
          <p v-if="!html" class="text-muted-foreground text-sm">{{ t('articles.previewEmpty') }}</p>
          <div v-else class="md-body" v-html="html" />
        </CardContent>
      </Card>
    </article>
  </div>
</template>
