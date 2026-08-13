import { createI18n } from 'vue-i18n'

import zhCN from './zh-CN'

export const DEFAULT_LOCALE = 'zh-CN'

export const i18n = createI18n({
  // Composition API 模式，组件里用 useI18n()。
  legacy: false,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  messages: { 'zh-CN': zhCN },
  // 中文是唯一语言，缺失警告只会淹没控制台。
  missingWarn: false,
  fallbackWarn: false,
})

export default i18n
