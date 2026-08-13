<script setup lang="ts">
import SiteHeader from '@/components/app/SiteHeader.vue'
</script>

<template>
  <div class="flex min-h-svh flex-col">
    <SiteHeader />
    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <RouterView />
    </main>
  </div>
</template>
