import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { cartApi } from '@/lib/endpoints'
import type { BillingCycle, CartItem } from '@/lib/types'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const totalCents = ref(0)
  const loading = ref(false)

  /** 徽标显示的是件数总和，而不是条目数。 */
  const count = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))
  const isEmpty = computed(() => items.value.length === 0)

  function apply(view: { items: CartItem[] | null; total_cents: number }) {
    items.value = view.items ?? []
    totalCents.value = view.total_cents
  }

  async function load() {
    loading.value = true
    try {
      apply(await cartApi.list())
    } finally {
      loading.value = false
    }
  }

  async function add(productId: number, quantity: number, cycle: BillingCycle) {
    apply(await cartApi.add(productId, quantity, cycle))
  }

  async function updateQuantity(itemId: number, quantity: number) {
    apply(await cartApi.updateQuantity(itemId, quantity))
  }

  async function remove(itemId: number) {
    apply(await cartApi.remove(itemId))
  }

  /** 下单成功后后端已清空购物车，本地跟着清即可。 */
  function clear() {
    items.value = []
    totalCents.value = 0
  }

  return { items, totalCents, loading, count, isEmpty, load, add, updateQuantity, remove, clear }
})
