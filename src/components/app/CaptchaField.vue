<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from 'lucide-vue-next'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { captchaApi } from '@/lib/endpoints'
import type { CaptchaCharset } from '@/lib/types'

const props = withDefaults(
  defineProps<{
    /** 输入框 id，同页出现多个时需各自唯一。 */
    id?: string
    /** 字符集只用来决定移动端唤起哪种键盘，答案始终在服务端。 */
    charset?: CaptchaCharset
    disabled?: boolean
  }>(),
  { id: 'captcha', charset: 'digit', disabled: false },
)

/** 挑战 id 与用户输入分别双向绑定，父组件提交时一并带上。 */
const challengeId = defineModel<string>('challengeId', { default: '' })
const code = defineModel<string>('code', { default: '' })

const { t } = useI18n()
const image = ref('')
const loading = ref(false)

/**
 * 取一张新图。
 *
 * 后端的验证码是一次性的：无论答对答错都会作废，所以父组件在任何一次提交
 * 失败后都要调用它，否则用户看着同一张图却永远通不过。
 */
async function refresh() {
  loading.value = true
  code.value = ''
  try {
    const challenge = await captchaApi.issue()
    challengeId.value = challenge.id
    image.value = challenge.image
  } catch {
    // 取不到图时留空并清掉 id：提交会被后端拦下并给出提示，
    // 比在这里再弹一个错误更少打扰。
    challengeId.value = ''
    image.value = ''
  } finally {
    loading.value = false
  }
}

onMounted(refresh)

defineExpose({ refresh })
</script>

<template>
  <div class="space-y-2">
    <Label :for="props.id">{{ t('auth.captcha') }}</Label>
    <div class="flex items-center gap-2">
      <Input
        :id="props.id"
        v-model="code"
        :placeholder="t('auth.captchaPlaceholder')"
        :inputmode="props.charset === 'digit' ? 'numeric' : 'text'"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="8"
        :disabled="props.disabled"
        required
      />
      <!-- 图片本身就是刷新按钮：看不清时点一下换一张，这是用户的直觉动作。 -->
      <button
        type="button"
        class="border-input bg-muted focus-visible:ring-ring/50 relative h-9 w-28 shrink-0 overflow-hidden rounded-md border transition-opacity hover:opacity-80 focus-visible:ring-[3px] focus-visible:outline-none disabled:opacity-50"
        :title="t('auth.captchaRefresh')"
        :aria-label="t('auth.captchaRefresh')"
        :disabled="loading || props.disabled"
        @click="refresh"
      >
        <img v-if="image" :src="image" alt="" class="h-full w-full object-cover" />
        <RefreshCw
          v-else
          class="text-muted-foreground absolute inset-0 m-auto size-4"
          :class="{ 'animate-spin': loading }"
        />
      </button>
    </div>
    <p class="text-muted-foreground text-xs">{{ t('auth.captchaHint') }}</p>
  </div>
</template>
