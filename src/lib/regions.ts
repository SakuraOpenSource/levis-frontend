/** 商品地区：code 为后端 Product.region 的取值，'' 表示未设置。 */
export interface RegionInfo {
  code: string
  name: string
  flag: string
}

export const REGIONS: RegionInfo[] = [
  { code: 'cn', name: '中国大陆', flag: '🇨🇳' },
  { code: 'hk', name: '中国香港', flag: '🇭🇰' },
  { code: 'tw', name: '中国台湾', flag: '🇨🇳' },
  { code: 'mo', name: '中国澳门', flag: '🇲🇴' },
  { code: 'jp', name: '日本', flag: '🇯🇵' },
  { code: 'kr', name: '韩国', flag: '🇰🇷' },
  { code: 'sg', name: '新加坡', flag: '🇸🇬' },
  { code: 'us', name: '美国', flag: '🇺🇸' },
  { code: 'de', name: '德国', flag: '🇩🇪' },
  { code: 'uk', name: '英国', flag: '🇬🇧' },
  { code: 'fr', name: '法国', flag: '🇫🇷' },
  { code: 'nl', name: '荷兰', flag: '🇳🇱' },
  { code: 'au', name: '澳大利亚', flag: '🇦🇺' },
  { code: 'ca', name: '加拿大', flag: '🇨🇦' },
  { code: 'ru', name: '俄罗斯', flag: '🇷🇺' },
  { code: 'global', name: '全球', flag: '🌍' },
]

/** 未知 code 回落为白旗并原样展示 code，避免表格出现空白。 */
export function regionInfo(code: string): RegionInfo {
  if (!code) return { code: '', name: '', flag: '' }
  const found = REGIONS.find((r) => r.code === code)
  if (found) return found
  return { code, name: code, flag: '🏳️' }
}
