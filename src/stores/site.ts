import { ref } from 'vue'
import { defineStore } from 'pinia'

import { siteApi } from '@/lib/endpoints'
import type { Bootstrap } from '@/lib/types'

export const useSiteStore = defineStore('site', () => {
  const installed = ref(false)
  const siteName = ref('Levis')
  const siteDescription = ref('')
  /** 是否已成功取到 bootstrap。取不到时守卫不应把用户困在安装页。 */
  const loaded = ref(false)

  function apply(data: Bootstrap) {
    installed.value = data.installed
    if (data.site_name) siteName.value = data.site_name
    siteDescription.value = data.site_description ?? ''
    loaded.value = true
    document.title = siteName.value
  }

  /** 拉取安装状态与站点信息。这也是 CSRF 令牌的播种时机。 */
  async function load(force = false) {
    if (loaded.value && !force) return
    const data = await siteApi.bootstrap()
    apply(data)
  }

  /** 安装完成后就地更新，避免再跑一次守卫重定向。 */
  function markInstalled(name: string, description: string) {
    installed.value = true
    siteName.value = name || 'Levis'
    siteDescription.value = description
    loaded.value = true
    document.title = siteName.value
  }

  return { installed, siteName, siteDescription, loaded, load, apply, markInstalled }
})
