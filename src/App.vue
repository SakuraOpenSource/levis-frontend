<script setup lang="ts">
import ToastHost from '@/components/app/ToastHost.vue'
// 主题 store 在初始化时就把 .dark 类挂到 <html>，这里引一次即可生效。
import { useThemeStore } from '@/stores/theme'

useThemeStore()
</script>

<template>
  <RouterView />
  <ToastHost />
</template>
