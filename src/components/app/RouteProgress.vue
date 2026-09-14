<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'

/**
 * 顶部路由进度条：beforeEach 开始、afterEach/错误结束。
 * 300ms 内就完成的导航不显示，避免短跳时顶条一闪。
 */
const router = useRouter()

const visible = ref(false)
const width = ref(0)

let showTimer: ReturnType<typeof setTimeout> | null = null
let finishTimer: ReturnType<typeof setTimeout> | null = null
let pending = 0

function clearShowTimer() {
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
}

function start() {
  pending += 1
  if (finishTimer) {
    clearTimeout(finishTimer)
    finishTimer = null
  }
  // 连续跳转（守卫里 redirect）时把条往前推一点，表示还在走。
  if (visible.value) {
    width.value = Math.min(90, Math.max(width.value, 45))
    return
  }
  if (showTimer) return
  width.value = 0
  showTimer = setTimeout(() => {
    showTimer = null
    visible.value = true
    // 先挂载 0 宽再推到 82，靠 CSS transition 滑过去。
    requestAnimationFrame(() => {
      width.value = 82
    })
  }, 300)
}

function done() {
  pending = Math.max(0, pending - 1)
  if (pending > 0) return
  // 还没露头就结束了：直接取消，不闪一下。
  if (showTimer) {
    clearShowTimer()
    width.value = 0
    return
  }
  if (!visible.value) return
  width.value = 100
  finishTimer = setTimeout(() => {
    visible.value = false
    width.value = 0
    finishTimer = null
  }, 250)
}

const offBefore = router.beforeEach(() => {
  start()
})
const offAfter = router.afterEach(() => {
  done()
})
const offError = router.onError(() => {
  done()
})

onUnmounted(() => {
  offBefore()
  offAfter()
  offError()
  clearShowTimer()
  if (finishTimer) clearTimeout(finishTimer)
})
</script>

<template>
  <div v-if="visible" class="route-progress fixed inset-x-0 top-0 z-[100] h-[3px]" aria-hidden="true">
    <div
      class="route-progress__bar h-full"
      :style="{ width: `${width}%`, backgroundColor: 'var(--primary)' }"
    />
  </div>
</template>

<style scoped>
.route-progress__bar {
  transition: width 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .route-progress__bar {
    transition: none;
  }
}
</style>
