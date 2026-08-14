import { ref } from 'vue'
import { defineStore } from 'pinia'

import { siteApi } from '@/lib/endpoints'
import type { Bootstrap, CaptchaCharset } from '@/lib/types'

export const useSiteStore = defineStore('site', () => {
  const installed = ref(false)
  const siteName = ref('Levis')
  const siteDescription = ref('')
  /** 是否已成功取到 bootstrap。取不到时守卫不应把用户困在安装页。 */
  const loaded = ref(false)
  /** 登录、注册页是否要显示验证码，以及输入框该按哪种字符集取值。 */
  const captchaLogin = ref(false)
  const captchaRegister = ref(false)
  const captchaCharset = ref<CaptchaCharset>('digit')

  function apply(data: Bootstrap) {
    installed.value = data.installed
    if (data.site_name) siteName.value = data.site_name
    siteDescription.value = data.site_description ?? ''
    // 未安装时后端不返回 captcha，此时按「都不显示」处理：
    // 安装页本身没有验证码，装完会重新取一次 bootstrap。
    captchaLogin.value = data.captcha?.login ?? false
    captchaRegister.value = data.captcha?.register ?? false
    captchaCharset.value = data.captcha?.charset ?? 'digit'
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

  return {
    installed,
    siteName,
    siteDescription,
    loaded,
    captchaLogin,
    captchaRegister,
    captchaCharset,
    load,
    apply,
    markInstalled,
  }
})
