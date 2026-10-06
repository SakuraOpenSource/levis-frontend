<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

/** 路由耗时未知：仅显示不定进度；快速导航不闪动，不伪造完成百分比。 */
const router = useRouter()
const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null
function clearTimer() { if (timer) clearTimeout(timer); timer = null }
function start() {
  if (timer || visible.value) return
  timer = setTimeout(() => { visible.value = true; timer = null }, 300)
}
function done() { clearTimer(); visible.value = false }
const offBefore = router.beforeEach(start)
const offAfter = router.afterEach(done)
const offError = router.onError(done)
onUnmounted(() => { offBefore(); offAfter(); offError(); clearTimer() })
</script>

<template>
  <div v-if="visible" role="status" aria-live="polite" class="route-progress fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-primary/15">
    <span class="sr-only">正在加载页面</span>
    <div class="route-progress__bar h-full bg-primary" />
  </div>
</template>

<style scoped>
.route-progress__bar { width: 35%; animation: route-pending 1.2s ease-in-out infinite; }
@keyframes route-pending { from { transform: translateX(-100%); } to { transform: translateX(400%); } }
@media (prefers-reduced-motion: reduce) { .route-progress__bar { width: 100%; animation: none; } }
</style>
