<script setup lang="ts">
import RouteProgress from '@/components/app/RouteProgress.vue'
import ToastHost from '@/components/app/ToastHost.vue'
// 主题 store 在初始化时就把 .dark 类挂到 <html>，主题色 store 则恢复上次选的 accent，这里引一次即可生效。
import { useAccentStore } from '@/stores/accent'
import { useThemeStore } from '@/stores/theme'

useThemeStore()
useAccentStore()
</script>

<template>
  <RouteProgress />
  <RouterView />
  <ToastHost />
</template>
