<script lang="ts">
/** 支付图标取值表：key 存后端 PaymentMethod.icon，label 用于管理端下拉。 */
export const PAYMENT_ICONS: { key: string; label: string }[] = [
  { key: 'alipay', label: '支付宝' },
  { key: 'wechat', label: '微信支付' },
  { key: 'qq', label: 'QQ钱包' },
  { key: 'unionpay', label: '银联云闪付' },
  { key: 'visa', label: 'Visa' },
  { key: 'mastercard', label: 'Mastercard' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'bank', label: '储蓄卡' },
  { key: 'debit', label: '借记卡' },
  { key: 'credit', label: '信用卡' },
  { key: 'wallet', label: '余额钱包' },
  { key: 'cash', label: '现金' },
  { key: 'default', label: '默认' },
]
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{ icon: string; class?: string }>(), { class: '' })

const KNOWN = new Set(PAYMENT_ICONS.map((item) => item.key))

/** 空串与未知 key 统一回落默认图标，避免表格出现空白。 */
const key = computed(() => {
  const raw = (props.icon ?? '').trim().toLowerCase()
  if (!raw) return 'default'
  return KNOWN.has(raw) ? raw : 'default'
})
</script>

<template>
  <svg
    viewBox="0 0 32 32"
    role="img"
    aria-hidden="true"
    :class="cn('size-6 shrink-0 rounded-md', props.class)"
  >
    <!-- 支付宝：宝蓝底 + 白色支字 -->
    <template v-if="key === 'alipay'">
      <rect width="32" height="32" rx="7" fill="#1677FF" />
      <text x="16" y="22.5" text-anchor="middle" font-size="16" font-weight="700" fill="#fff" font-family="system-ui, sans-serif">支</text>
    </template>
    <!-- 微信支付：绿色底 + 双聊天气泡 -->
    <template v-else-if="key === 'wechat'">
      <rect width="32" height="32" rx="7" fill="#07C160" />
      <ellipse cx="13" cy="14" rx="7" ry="5.5" fill="#fff" />
      <ellipse cx="20.5" cy="19" rx="5" ry="4.2" fill="#fff" opacity="0.85" />
      <circle cx="11" cy="14" r="1.1" fill="#07C160" />
      <circle cx="15" cy="14" r="1.1" fill="#07C160" />
    </template>
    <!-- QQ钱包：浅蓝底 + 白色 Q -->
    <template v-else-if="key === 'qq'">
      <rect width="32" height="32" rx="7" fill="#12B7F5" />
      <text x="14.5" y="22" text-anchor="middle" font-size="15" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">Q</text>
      <circle cx="20" cy="21" r="3" fill="#fff" />
      <circle cx="20" cy="21" r="1.6" fill="#12B7F5" />
    </template>
    <!-- 银联云闪付：白底 + 红蓝绿三色条 -->
    <template v-else-if="key === 'unionpay'">
      <rect width="32" height="32" rx="7" fill="#fff" stroke="#E2E8F0" />
      <rect x="6" y="9" width="6" height="14" rx="1" fill="#DE1F26" transform="skewX(-8)" />
      <rect x="13" y="9" width="6" height="14" rx="1" fill="#007D8A" transform="skewX(-8)" />
      <rect x="20" y="9" width="6" height="14" rx="1" fill="#007A33" transform="skewX(-8)" opacity="0.9" />
    </template>
    <!-- Visa：深蓝斜体字 -->
    <template v-else-if="key === 'visa'">
      <rect width="32" height="32" rx="7" fill="#fff" stroke="#E2E8F0" />
      <text x="16" y="21.5" text-anchor="middle" font-size="10.5" font-weight="800" font-style="italic" fill="#1A1F71" font-family="system-ui, sans-serif" letter-spacing="0.5">VISA</text>
    </template>
    <!-- Mastercard：双圆交叠 -->
    <template v-else-if="key === 'mastercard'">
      <rect width="32" height="32" rx="7" fill="#F8FAFC" stroke="#E2E8F0" />
      <circle cx="13" cy="16" r="6.5" fill="#EB001B" />
      <circle cx="19" cy="16" r="6.5" fill="#F79E1B" opacity="0.9" />
    </template>
    <!-- Stripe：紫底 + 白色 S -->
    <template v-else-if="key === 'stripe'">
      <rect width="32" height="32" rx="7" fill="#635BFF" />
      <text x="16" y="22.5" text-anchor="middle" font-size="16" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">S</text>
    </template>
    <!-- 储蓄卡 / 借记卡：石墨底 + 卡片与芯片 -->
    <template v-else-if="key === 'bank' || key === 'debit'">
      <rect width="32" height="32" rx="7" fill="#334155" />
      <rect x="7" y="11" width="18" height="11" rx="2" fill="none" stroke="#fff" stroke-width="1.6" />
      <rect x="9.5" y="13.5" width="4" height="3" rx="0.8" fill="#FBBF24" />
      <line x1="7" y1="18.5" x2="25" y2="18.5" stroke="#fff" stroke-width="1.2" opacity="0.7" />
    </template>
    <!-- 信用卡：琥珀底 + 卡片与磁条 -->
    <template v-else-if="key === 'credit'">
      <rect width="32" height="32" rx="7" fill="#B45309" />
      <rect x="7" y="10" width="18" height="12" rx="2" fill="#fff" />
      <rect x="7" y="12.5" width="18" height="2.5" fill="#B45309" />
      <rect x="9.5" y="17.5" width="6" height="1.8" rx="0.9" fill="#B45309" opacity="0.55" />
    </template>
    <!-- 余额钱包：橙底 + 钱包形 -->
    <template v-else-if="key === 'wallet'">
      <rect width="32" height="32" rx="7" fill="#F59E0B" />
      <rect x="7" y="11" width="18" height="11" rx="2.5" fill="#fff" />
      <rect x="7" y="11" width="18" height="4" rx="2" fill="#FDE68A" />
      <circle cx="20.5" cy="18" r="1.4" fill="#F59E0B" />
    </template>
    <!-- 现金：绿色底 + 人民币符号 -->
    <template v-else-if="key === 'cash'">
      <rect width="32" height="32" rx="7" fill="#16A34A" />
      <text x="16" y="22.5" text-anchor="middle" font-size="15" font-weight="800" fill="#fff" font-family="system-ui, sans-serif">¥</text>
    </template>
    <!-- 默认：灰底 + 付字 -->
    <template v-else>
      <rect width="32" height="32" rx="7" fill="#64748B" />
      <text x="16" y="22.5" text-anchor="middle" font-size="16" font-weight="700" fill="#fff" font-family="system-ui, sans-serif">付</text>
    </template>
  </svg>
</template>
