import { ref, watchEffect } from 'vue'
import { defineStore } from 'pinia'

/** 商店的两种浏览方式：list 是按分组纵向平铺，nav 是先筛分组再看商品。 */
export type ShopView = 'list' | 'nav'

const SHOP_VIEW_KEY = 'levis_shop_view'

function initialShopView(): ShopView {
  const saved = localStorage.getItem(SHOP_VIEW_KEY)
  return saved === 'list' || saved === 'nav' ? saved : 'list'
}

/**
 * 纯前端的界面偏好，不入库。
 *
 * 与 theme store 分开：主题在 <html> 上有副作用且全站生效，
 * 这里只是页面内的展示选择，混在一起反而难找。
 */
export const usePreferencesStore = defineStore('preferences', () => {
  const shopView = ref<ShopView>(initialShopView())

  watchEffect(() => localStorage.setItem(SHOP_VIEW_KEY, shopView.value))

  function setShopView(value: ShopView) {
    shopView.value = value
  }

  return { shopView, setShopView }
})
