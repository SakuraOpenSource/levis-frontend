import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { authApi } from '@/lib/endpoints'
import type { User } from '@/lib/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  /** 是否已尝试过恢复登录态。守卫据此决定要不要先探测一次 /me。 */
  const resolved = ref(false)

  const isLoggedIn = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const balanceCents = computed(() => user.value?.balance_cents ?? 0)

  /**
   * 恢复登录态。凭证在 httpOnly cookie 里，JS 读不到，
   * 只能靠 /me 探测。401 是未登录的正常结果，不是错误。
   */
  async function restore() {
    if (resolved.value) return user.value
    try {
      user.value = await authApi.me()
    } catch {
      user.value = null
    } finally {
      resolved.value = true
    }
    return user.value
  }

  async function login(identifier: string, password: string) {
    user.value = await authApi.login(identifier, password)
    resolved.value = true
    return user.value
  }

  async function register(payload: { username: string; email: string; password: string }) {
    user.value = await authApi.register(payload)
    resolved.value = true
    return user.value
  }

  async function logout() {
    try {
      await authApi.logout()
    } finally {
      // 即使请求失败也要清本地态，否则界面会停在「已登录」的错觉里。
      clear()
    }
  }

  /** 本地清除登录态，供 401 拦截器调用。 */
  function clear() {
    user.value = null
    resolved.value = true
  }

  /** 刷新当前用户（余额变动后调用）。 */
  async function refresh() {
    try {
      user.value = await authApi.me()
    } catch {
      user.value = null
    }
    return user.value
  }

  function setUser(next: User | null) {
    user.value = next
    resolved.value = true
  }

  return {
    user,
    resolved,
    isLoggedIn,
    isAdmin,
    balanceCents,
    restore,
    login,
    register,
    logout,
    clear,
    refresh,
    setUser,
  }
})
