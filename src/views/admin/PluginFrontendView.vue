<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ExternalLink, Loader2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { adminApi } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import type { Plugin } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const plugin = ref<Plugin | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const pluginID = computed(() => String(route.params.id))
const frontendURL = computed(() => plugin.value?.frontend_url ?? '')

onMounted(async () => {
  try {
    plugin.value = await adminApi.plugin(pluginID.value)
    if (!plugin.value.has_frontend || !frontendURL.value) {
      error.value = '该插件没有可用的管理页面'
    }
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex min-h-[calc(100svh-7rem)] flex-col gap-6">
    <PageHeader
      :title="plugin?.name || pluginID"
      :description="plugin?.description || '插件管理页面'"
    >
      <template #actions>
        <Button v-if="frontendURL" variant="outline" as-child>
          <a :href="frontendURL" target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            在新窗口打开
          </a>
        </Button>
        <Button variant="outline" @click="router.push({ name: 'admin-plugins' })">返回插件管理</Button>
      </template>
    </PageHeader>

    <ErrorAlert :message="error" />
    <div v-if="loading" class="text-muted-foreground flex flex-1 items-center justify-center">
      <Loader2 class="size-6 animate-spin" />
    </div>
    <div v-else-if="frontendURL" class="bg-background min-h-0 flex-1 overflow-hidden rounded-lg border shadow-sm">
      <iframe :src="frontendURL" class="block h-full min-h-[calc(100svh-13rem)] w-full" :title="plugin?.name || pluginID" />
    </div>
  </div>
</template>
