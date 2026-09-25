<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { BadgePercent, Loader2, Minus, Plus, ShoppingCart, TicketX, Trash2 } from 'lucide-vue-next'

import ErrorAlert from '@/components/app/ErrorAlert.vue'
import LoadingBlock from '@/components/app/LoadingBlock.vue'
import Money from '@/components/app/Money.vue'
import PageHeader from '@/components/app/PageHeader.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useCycleLabel } from '@/composables/useCycleLabel'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { cartApi, orderApi } from '@/lib/endpoints'
import type { CartItem } from '@/lib/types'
import { useCartStore } from '@/stores/cart'

const { t } = useI18n()
const router = useRouter()
const cart = useCartStore()
const toast = useToast()
const { cycleLabel } = useCycleLabel()

const error = ref<string | null>(null)
const loading = ref(true)
/** 正在改动的条目 ID，避免连点造成数量错乱。 */
const busy = ref<number | null>(null)
const creating = ref(false)

const MAX_QUANTITY = 99

async function changeQuantity(item: CartItem, delta: number) {
  const next = item.quantity + delta
  if (next < 1 || next > MAX_QUANTITY) return
  busy.value = item.id
  try {
    await cart.updateQuantity(item.id, next)
    await revalidateCoupon()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    busy.value = null
  }
}

async function remove(item: CartItem) {
  busy.value = item.id
  try {
    await cart.remove(item.id)
    toast.success(t('cart.removed'))
    await revalidateCoupon()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    busy.value = null
  }
}

/** 优惠码输入与试算状态。applied 非空 = 已生效的码（下单随单提交）。 */
const couponInput = ref('')
const couponChecking = ref(false)
const appliedCoupon = ref<{ code: string; name: string; discount_cents: number } | null>(null)
const couponError = ref<string | null>(null)

/** 验证优惠码：只试算不核销，真正占次数在下单事务里。 */
async function applyCoupon() {
  const code = couponInput.value.trim()
  if (!code) return
  couponChecking.value = true
  couponError.value = null
  try {
    const view = await cartApi.couponPreview(code)
    appliedCoupon.value = view.coupon ?? null
    if (!appliedCoupon.value) {
      couponError.value = t('cart.coupon.invalid')
    }
  } catch (err) {
    appliedCoupon.value = null
    couponError.value = errorMessage(err)
  } finally {
    couponChecking.value = false
  }
}

/** 移除已应用的优惠码。 */
function removeCoupon() {
  appliedCoupon.value = null
  couponError.value = null
  couponInput.value = ''
}

/** 购物车内容变化后已应用的优惠码需要重新验证（参与商品可能已被移除）。 */
async function revalidateCoupon() {
  if (!appliedCoupon.value) return
  const code = appliedCoupon.value.code
  appliedCoupon.value = null
  try {
    const view = await cartApi.couponPreview(code)
    if (view.coupon) appliedCoupon.value = view.coupon
  } catch {
    // 失效（如门槛不再满足）就静默移除，不打断用户的数量调整。
    couponInput.value = ''
  }
}

/** 下单后购物车已被后端清空，跳到结账页支付。 */
async function checkout() {
  creating.value = true
  try {
    const order = await orderApi.create(false, appliedCoupon.value?.code ?? '')
    cart.clear()
    await router.push({ name: 'checkout', params: { id: order.id } })
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    creating.value = false
  }
}

onMounted(async () => {
  try {
    await cart.load()
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader :title="t('cart.title')" />

    <ErrorAlert :message="error" />
    <LoadingBlock v-if="loading" :rows="3" />

    <div
      v-else-if="cart.isEmpty"
      class="text-muted-foreground flex flex-col items-center gap-3 py-16"
    >
      <ShoppingCart class="size-10" />
      <p class="text-sm">{{ t('cart.empty') }}</p>
      <Button variant="outline" as-child>
        <RouterLink :to="{ name: 'shop' }">{{ t('cart.goShop') }}</RouterLink>
      </Button>
    </div>

    <template v-else>
      <Card>
        <CardContent class="space-y-4">
          <div
            v-for="item in cart.items"
            :key="item.id"
            class="flex flex-wrap items-center gap-4 border-b pb-4 last:border-0 last:pb-0"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium">{{ item.product?.name ?? '-' }}</p>
              <p class="text-muted-foreground text-xs">
                {{ cycleLabel(item.billing_cycle) }} ·
                {{ t('cart.unitPrice') }}
                <Money :cents="item.product?.price_cents ?? 0" />
              </p>
            </div>

            <div class="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                class="size-8"
                :disabled="busy === item.id || item.quantity <= 1"
                :aria-label="t('cart.quantity')"
                @click="changeQuantity(item, -1)"
              >
                <Minus />
              </Button>
              <span class="w-10 text-center text-sm tabular">{{ item.quantity }}</span>
              <Button
                variant="outline"
                size="icon"
                class="size-8"
                :disabled="busy === item.id || item.quantity >= MAX_QUANTITY"
                :aria-label="t('cart.quantity')"
                @click="changeQuantity(item, 1)"
              >
                <Plus />
              </Button>
            </div>

            <Money
              :cents="(item.product?.price_cents ?? 0) * item.quantity"
              class="w-24 text-right font-medium"
            />

            <Button
              variant="ghost"
              size="icon"
              class="size-8"
              :disabled="busy === item.id"
              :aria-label="t('common.delete')"
              @click="remove(item)"
            >
              <Loader2 v-if="busy === item.id" class="animate-spin" />
              <Trash2 v-else class="text-destructive" />
            </Button>
          </div>

          <Separator />

          <!-- 优惠码：未应用时显示输入框，已应用时显示减免摘要。 -->
          <div v-if="!appliedCoupon" class="space-y-2">
            <div class="flex max-w-sm items-center gap-2">
              <div class="relative flex-1">
                <BadgePercent class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                <Input
                  v-model="couponInput"
                  :placeholder="t('cart.coupon.placeholder')"
                  class="pl-8 uppercase"
                  autocomplete="off"
                  :disabled="couponChecking"
                  @keyup.enter="applyCoupon"
                />
              </div>
              <Button type="button" variant="outline" :disabled="couponChecking || !couponInput.trim()" @click="applyCoupon">
                <Loader2 v-if="couponChecking" class="animate-spin" />
                {{ couponChecking ? t('cart.coupon.applying') : t('cart.coupon.apply') }}
              </Button>
            </div>
            <p v-if="couponError" class="text-destructive text-xs">{{ couponError }}</p>
          </div>
          <div v-else class="bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2">
            <div class="flex items-center gap-2 text-sm">
              <BadgePercent class="text-success size-4" />
              <span class="font-mono font-medium">{{ appliedCoupon.code }}</span>
              <span v-if="appliedCoupon.name" class="text-muted-foreground text-xs">{{ appliedCoupon.name }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm">
                {{ t('cart.coupon.discount') }}
                <Money :cents="-appliedCoupon.discount_cents" class="text-success font-medium" />
              </span>
              <Button type="button" variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="removeCoupon">
                <TicketX class="size-3.5" />
                {{ t('cart.coupon.remove') }}
              </Button>
            </div>
          </div>

          <Separator />

          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ t('cart.total') }}</span>
            <div class="text-right">
              <Money
                v-if="appliedCoupon"
                :cents="cart.totalCents"
                class="text-muted-foreground text-sm line-through"
              />
              <Money
                :cents="appliedCoupon ? cart.totalCents - appliedCoupon.discount_cents : cart.totalCents"
                class="text-xl font-semibold"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div class="flex justify-end gap-3">
        <Button variant="outline" as-child>
          <RouterLink :to="{ name: 'shop' }">{{ t('cart.goShop') }}</RouterLink>
        </Button>
        <Button :disabled="creating" @click="checkout">
          <Loader2 v-if="creating" class="animate-spin" />
          {{ t('cart.checkout') }}
        </Button>
      </div>
    </template>
  </div>
</template>
