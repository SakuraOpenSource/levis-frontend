/**
 * 与后端 internal/model 及 internal/service 的 JSON 结构一一对应。
 * 金额字段一律为整数分（int64），前端只在渲染时除 100。
 */

export type Role = 'user' | 'admin'
export type UserStatus = 'active' | 'disabled'

export type BillingCycle =
  | 'onetime'
  | 'monthly'
  | 'quarterly'
  | 'semiannually'
  | 'annually'
  | 'biennially'
  | 'triennially'

export const BILLING_CYCLES: BillingCycle[] = [
  'onetime',
  'monthly',
  'quarterly',
  'semiannually',
  'annually',
  'biennially',
  'triennially',
]

export type OrderStatus = 'pending' | 'paid' | 'cancelled'
/** failed/pending 为上游开通失败或待开通，可重试；suspended/terminated 只能由管理员变更。 */
export type ServiceStatus = 'pending' | 'failed' | 'active' | 'suspended' | 'terminated'
export type ProductStatus = 'active' | 'hidden'
export type TransactionType = 'recharge' | 'payment' | 'refund' | 'adjust'
export type DatabaseDriver = 'sqlite' | 'mysql' | 'postgres'

/** 工单状态。answered 表示客服已回复、等用户；open 表示等客服处理。 */
export type TicketStatus = 'open' | 'answered' | 'closed'

export const TICKET_STATUSES: TicketStatus[] = ['open', 'answered', 'closed']

export type KYCStatus = 'pending' | 'approved' | 'rejected'

export const KYC_STATUSES: KYCStatus[] = ['pending', 'approved', 'rejected']

export type APIKeyStatus = 'active' | 'revoked'

/** API Key 权限位，与后端 model.AllScopes() 一致。 */
export type APIScope = 'balance:read' | 'order:write' | 'service:write'

export interface Timestamps {
  id: number
  created_at: string
  updated_at: string
}

export interface User extends Timestamps {
  username: string
  email: string
  role: Role
  balance_cents: number
  status: UserStatus
}

/** Spec 是商品的一条展示规格，如 { label: 'CPU', value: '4 核' }。 */
export interface Spec {
  label: string
  value: string
}

 export interface Product extends Timestamps {
   category_id: number
   name: string
   description: string
   /** 后端可能返回 null（历史数据或空列表）。 */
   specs: Spec[] | null
   price_cents: number
   billing_cycle: BillingCycle
   /** 负数表示库存不限。 */
   stock: number
   status: ProductStatus
   sort: number
   upstream_plugin_id: string
   upstream_product_id: string
   /** 非零表示经「接口管理」的接口开通（Virtualis 等弹性/固定配置商品）。 */
   interface_id: number
   provision_config: ProvisionConfig | null
   /** 指向知识库文章：非空表示购买该商品前必须阅读并同意该协议。 */
   agreement_article_id: number | null
   /** 地区代码，'' 表示未设置，展示时经 regionInfo 解析。 */
   region: string
 }

/** 一项规格的取值区间；固定配置时 min === max 且 step/unit_price_cents 为 0。 */
export interface SpecRange {
  min: number
  max: number
  /** 历史配置可能没有这两个字段，按 1 / 0 兼容。 */
  step?: number
  unit_price_cents?: number
}

/** 接口商品的开通配置：驱动 + 各规格区间或固定值。 */
export interface ProvisionConfig {
  driver: 'incus' | 'qemu'
  mode: 'fixed' | 'elastic'
  cpu: SpecRange
  memory_mb: SpecRange
  disk_gb: SpecRange
  bandwidth_mbps: SpecRange
  traffic_gb: SpecRange
}

/** 「接口管理」里的一条上游接口。 */
export interface UpstreamInterface extends Timestamps {
  name: string
  plugin_id: string
  config: Record<string, string> | null
}

/** 开通插件模块声明的一个配置项（接口表单据此渲染）。 */
export interface ModuleConfigField {
  key: string
  label: string
  hint: string
  type: string
  required: boolean
  secret: boolean
  default: string
  options: { value: string; label: string }[]
}

export interface Category extends Timestamps {
  parent_id: number | null
  name: string
  slug: string
  description: string
  sort: number
  children?: Category[]
  products?: Product[]
}

export interface CartItem extends Timestamps {
  user_id: number
  product_id: number
  billing_cycle: BillingCycle
  quantity: number
  product?: Product
}

export interface CartView {
  items: CartItem[]
  total_cents: number
}

export interface OrderItem extends Timestamps {
  order_id: number
  product_id: number
  product_name: string
  price_cents: number
  quantity: number
  billing_cycle: BillingCycle
}

export interface Order extends Timestamps {
  order_no: string
  user_id: number
  status: OrderStatus
  total_cents: number
  paid_at: string | null
  items?: OrderItem[]
}

export interface Service extends Timestamps {
  user_id: number
  product_id: number
  order_id: number
  name: string
  status: ServiceStatus
  billing_cycle: BillingCycle
  price_cents: number
  next_due_at: string | null
  expires_at: string | null
  /** 售后加购累计的额外流量配额（GB），结清流量包账单时由后端累加。 */
  traffic_extra_gb: number
  upstream_plugin_id: string
  upstream_host_id: string
  /** 最近一次上游开通失败的原因，成功后由后端清空；为空表示无失败。 */
  provision_error: string
}

/** 电源操作动作：开机/关机/重启/重装系统。 */
export type PowerAction = 'boot' | 'shutdown' | 'reboot' | 'hard_boot' | 'hard_stop' | 'hard_restart' | 'reinstall'

export interface InvoiceItem extends Timestamps {
  invoice_id: number
  service_id: number | null
  description: string
  amount_cents: number
}

 export interface Invoice extends Timestamps {
   invoice_no: string
   user_id: number
   order_id: number | null
   service_id: number | null
   status: InvoiceStatus
   total_cents: number
   due_at: string | null
   paid_at: string | null
   items?: InvoiceItem[]
 }

/**
 * 管理端账单详情：账单字段（含明细）平铺，附带关联的外部支付。
 * 对应后端 AdminInvoiceDetail：以账单为目标的支付 + 所属订单的支付。
 */
export interface AdminInvoiceDetail extends Invoice {
  external_payments: ExternalPayment[]
}

export interface Transaction extends Timestamps {
  user_id: number
  type: TransactionType
  /** 带符号：正为入账，负为出账。 */
  amount_cents: number
  balance_after_cents: number
  ref_type: string
  ref_id: number
  note: string
}

export interface WalletOverview {
  balance_cents: number
  unpaid_invoice_count: number
  unpaid_total_cents: number
  active_service_count: number
}

export interface PayResult {
  order: Order
  invoice: Invoice
  services: Service[]
}

export type ExternalPaymentPurpose = 'recharge' | 'order' | 'invoice' | 'renewal'
export type ExternalPaymentStatus = 'pending' | 'paid' | 'failed'
export interface PaymentMethod {
   id: string
   name: string
   /** 图标 key（alipay/wechat/…），'' 表示无图标，前端回落默认图标。 */
   icon: string
 }

 export interface PaymentMethodAdmin extends Timestamps {
   name: string
   plugin_id: string
   config: Record<string, string>
   enabled: boolean
   sort_order: number
   /** 图标 key，与 PaymentMethod.icon 同一取值表。 */
   icon: string
 }

export interface PaymentPlugin {
  id: string
  name: string
  config: PluginConfigField[]
}

export interface OSImage {
  id: string
  name: string
  group: string
}

export interface UpstreamHost {
  id: string
  product_id: string
  product_name: string
  status: string
  billing_cycle: string
  expiry: string
  upstream_order_id: string
  actions: string[]
  /** 上游返回的资源/网络/SSH 信息；旧插件可能全部为空，页面按能力降级。 */
  cpu?: number
  memory_mb?: number
  disk_gb?: number
  bandwidth_mbps?: number
  ipv4?: string
  ssh_host?: string
  ssh_port?: number
  ssh_username?: string
  ssh_password?: string
  ssh_ready?: boolean
}

/** NAT 端口映射：公网 host_port 转发到实例 guest_port。 */
export interface NatMapping {
  mapping_id: number
  protocol: 'tcp' | 'udp'
  host_port: number
  guest_port: number
  remark: string
}

/** 新增 NAT 映射的入参：host_port 省略或 0 表示由系统自动分配。 */
export interface NatCreateInput {
  protocol?: 'tcp' | 'udp'
  host_port?: number
  guest_port: number
  remark?: string
}
 /** 上游主机实时监控：CPU 占用、内存占用、上下行流量与速率。 */
 export interface HostMetrics {
   cpu_percent: number
   memory_used_mb: number
   memory_total_mb: number
   network_rx_bytes: number
   network_tx_bytes: number
   bandwidth_rx_bps: number
   bandwidth_tx_bps: number
   collected_at: string
 }

 export interface ExternalPayment extends Timestamps {
   plugin_id: string
   external_id: string
   user_id: number
   purpose: ExternalPaymentPurpose
   target_id: number
   amount_cents: number
   currency: string
   subject: string
   return_url: string
   pay_url: string
   gateway_ref: string
   paid_amount_cents: number
   status: ExternalPaymentStatus
   failure_reason: string
   paid_at: string | null
   /** 本次已抵扣的余额（分），后端随 intent 下发。 */
   balance_cents: number
 }

 /** 服务 VNC 可用性：不可用时 message 说明原因。 */
 export interface HostVNC {
   available: boolean
   message: string
   /** 上游页面控制台地址（魔方财务类上游）：有值时新窗口打开，不走站内 RFB 中继。 */
   viewer_url?: string
 }

export interface RenewResult {
  service: Service
  invoice: Invoice
}

/**
 * 工单附件的元数据。文件本体走 /tickets/:id/attachments/:aid 下载，
 * 落盘路径是实现细节，后端不下发。
 */
export interface TicketAttachment extends Timestamps {
  reply_id: number
  ticket_id: number
  file_name: string
  /** 由服务端嗅探内容得出，不是客户端声明的类型。 */
  mime_type: string
  size_bytes: number
}

/**
 * 工单里的一条回复。is_staff 与 author_name 是成文时的快照：
 * 作者日后被删号或降权，历史对话仍显示当时的身份。
 */
export interface TicketReply extends Timestamps {
  ticket_id: number
  user_id: number
  is_staff: boolean
  author_name: string
  body: string
  attachments?: TicketAttachment[] | null
}

export interface Ticket extends Timestamps {
  ticket_no: string
  user_id: number
  subject: string
  status: TicketStatus
  last_reply_at: string | null
  replies?: TicketReply[] | null
  /** 仅管理端列表返回。 */
  username?: string
}

/**
 * 实名认证记录。id_number 在用户侧接口里是打码的（前 6 后 4），
 * 完整号码只出现在管理员审核详情。
 */
export interface Verification extends Timestamps {
  user_id: number
  real_name: string
  id_number: string
  status: KYCStatus
  reject_reason: string
  reviewed_by: number
  reviewed_at: string | null
  submitted_at: string
  /** 第三方认证流程才有：处理认证的插件 ID 与认证单号。 */
  plugin_id?: string
  certify_id?: string
  /** 仅管理端列表返回。 */
  username?: string
}

/**
 * 实名认证插件要求用户提交的字段定义，来自插件 manifest 的 kyc_fields。
 * 结构与 PluginConfigField 对齐，但没有 value/has_value —— 用户填的值
 * 不回显。
 */
export interface KYCFieldSchema {
  key: string
  label: string
  type: PluginFieldType
  required: boolean
  secret: boolean
  hint?: string
  options?: PluginConfigOption[]
}

/** 实名认证模式：人工审核或实名认证插件 ID。 */
export const KYC_MODE_MANUAL = 'manual'

/** GET /api/kyc 的响应：状态 + 站点当前采用的认证模式。 */
export interface KYCMine {
  record: Verification | null
  mode: string
  plugin_name: string
  fields: KYCFieldSchema[]
}

/** 发起第三方实名认证：values 的键由插件声明的字段决定。 */
export interface KYCExternalStart {
  record: Verification
  certify_id: string
  certify_url: string
  certify_html: string
  message: string
}

/** 管理端实名详情：完整号码的记录 + 插件认证时用户提交的字段键值。 */
export interface KYCVerificationDetail {
  record: Verification
  input: Record<string, string> | null
}

/** 查询第三方实名认证结果。passed: T 通过 / F 未通过 / P 处理中。 */
export interface KYCExternalStatus {
  record: Verification
  passed: string
}

export interface APIKey extends Timestamps {
  user_id: number
  name: string
  /** 明文的前若干位，用于在列表里辨认是哪一把。 */
  prefix: string
  scopes: APIScope[] | null
  status: APIKeyStatus
  expires_at: string | null
  last_used_at: string | null
}

/** Key 列表连同可选权限位一起返回，前端不必再硬编码一份清单。 */
export interface APIKeyList {
  items: APIKey[] | null
  scopes: APIScope[]
}

/** 创建结果。secret 是明文，且是它在系统里唯一一次露面。 */
export interface APIKeyCreated {
  key: APIKey
  secret: string
}

export interface APIKeyInput {
  name: string
  scopes: APIScope[]
  /** 0 表示永不过期。 */
  expires_in_days: number
}

export interface AdminStats {
  user_count: number
  product_count: number
  order_count: number
  service_count: number
  revenue_cents: number
}

export type PluginState = 'stopped' | 'running' | 'error' | 'crashed' | 'skipped'
export type PluginFieldType = 'text' | 'number' | 'bool' | 'select' | 'textarea'
export type PluginScope = 'wallet:credit' | 'user:read' | 'order:read'

export interface PluginConfigOption {
  value: string
  label: string
}

export interface PluginConfigField {
  key: string
  label: string
  type: PluginFieldType
  required: boolean
  secret: boolean
  hint?: string
  options?: PluginConfigOption[]
  value: string
  has_value: boolean
  default_value?: string
}

export interface Plugin {
  id: string
  state: PluginState
  last_error?: string
  name?: string
  version?: string
  description?: string
  author?: string
  capabilities: string[]
  required_scopes: string[]
  granted_scopes: string[]
  enabled: boolean
  has_frontend: boolean
  frontend_url?: string
  config: PluginConfigField[]
  configured: boolean
  config_schema_ready: boolean
}

export interface PluginListResponse {
  items: Plugin[]
  scopes: PluginScope[]
}

export interface PluginConfigInput {
  values: Record<string, string>
  scopes?: PluginScope[]
}

/** 验证码字符集：数字+字母 / 纯数字 / 纯字母。 */
export type CaptchaCharset = 'mixed' | 'digit' | 'letter'

export const CAPTCHA_CHARSETS: CaptchaCharset[] = ['mixed', 'digit', 'letter']

/** 验证码位数的取值范围，与后端 internal/captcha 的 MinLength/MaxLength 一致。 */
export const CAPTCHA_MIN_LENGTH = 4
export const CAPTCHA_MAX_LENGTH = 8

/** 管理端可配置的验证码设置。 */
export interface CaptchaSettings {
  login_enabled: boolean
  register_enabled: boolean
  charset: CaptchaCharset
  length: number
}

/** 实名认证插件的模式下拉选项。 */
export interface KYCPluginOption {
  id: string
  name: string
}

/** 管理端实名认证模式设置。 */
export interface KYCSettings {
  mode: string
  plugins: KYCPluginOption[]
}

/**
 * 一次验证码挑战。image 是可直接塞进 <img src> 的 PNG data URL；
 * 答案只留在服务端，前端拿不到也不需要。
 */
export interface CaptchaChallenge {
  id: string
  image: string
  expires_in: number
}

/**
 * bootstrap 里的验证码信息：只有开关与字符集。
 * 位数不下发 —— 那是穷举时的关键信息，前端也用不到。
 */
export interface BootstrapCaptcha {
  login: boolean
  register: boolean
  charset: CaptchaCharset
}

 export interface Bootstrap {
 installed: boolean
 site_name: string
 site_description: string
 /** 未安装时后端不返回该字段，因此是可选的。 */
 captcha?: BootstrapCaptcha
 /** 主页未启用时后端省略该字段（null/undefined 都视为关闭）。 */
 home?: HomeConfig | null
 }

 /** 主页上的行动按钮：text 为空时前端不渲染该按钮。 */
 export interface HomeButton {
 text: string
 link: string
 }

 /** 主视觉下方的一条数据，如 { value: '99.9%', label: '服务可用性' }。 */
 export interface HomeStat {
 value: string
 label: string
 }

 /** 主页特性卡片：icon 取 HOME_FEATURE_ICONS 中的 lucide 图标名。 */
 export interface HomeFeature {
 icon: string
 title: string
 desc: string
 link: string
 }

 /** 公开主页的完整配置，与后端 service.HomeConfig 一致。 */
 export interface HomeConfig {
 enabled: boolean
 badge: string
 title: string
 subtitle: string
 description: string
 primary_button: HomeButton
 secondary_button: HomeButton
 hero_image_url: string
 stats: HomeStat[]
 features: HomeFeature[]
 show_products: boolean
 }

 /**
 * 特性卡片可选的图标取值表（lucide 图标名），与后端
 * service.HomeFeatureIcons 保持一致，改一边必须改另一边。
 */
 export const HOME_FEATURE_ICONS = [
 'zap',
 'rocket',
 'shield-check',
 'server',
 'cloud',
 'database',
 'cpu',
 'globe',
 'lock',
 'sparkles',
 'package',
 'credit-card',
 ] as const

 /** 管理端站点名称与简介的读写体。 */
 export interface SiteSettings {
 site_name: string
 site_description: string
 }

export interface DatabaseConfig {
  driver: DatabaseDriver
  path?: string
  host?: string
  port?: number
  user?: string
  password?: string
  name?: string
}

export interface InstallRequest {
  database: DatabaseConfig
  site_name: string
  site_description: string
  admin_username: string
  admin_email: string
  admin_password: string
}

export interface Page<T> {
  items: T[] | null
  total: number
  page: number
  page_size: number
}

export interface CategoryInput {
  parent_id: number | null
  name: string
  slug: string
  description: string
  sort: number
}

export interface ProductInput {
  category_id: number
  name: string
  description: string
  specs: Spec[]
  price_cents: number
  billing_cycle: BillingCycle
  stock: number
  status: ProductStatus
  sort: number
  upstream_plugin_id: string
  upstream_product_id: string
  interface_id?: number
  provision_config?: ProvisionConfig | null
   /** 璐拱鍗忚鏂囩珷 ID锛歯ull 琛ㄧず鏃犻渶鍚屾剰锛涘紩鐢ㄦ枃绔犲繀椤诲瓨鍦ㄣ€?*/
   agreement_article_id?: number | null
   /** 地区代码，'' 表示未设置。 */
   region?: string
 }

/** 璐﹀崟鐘舵€侊細寰呬粯/宸蹭粯/宸插彇娑堛€?*/
export type InvoiceStatus = 'unpaid' | 'paid' | 'cancelled'

export type ArticleStatus = 'draft' | 'published'

export const ARTICLE_STATUSES: ArticleStatus[] = ['draft', 'published']

/**
 * 知识库文章，可被商品引用为购买协议。
 * 公开接口只返回已发布的；草稿仅管理端可见。
 */
export interface Article extends Timestamps {
  slug: string
  title: string
  content_md: string
  status: ArticleStatus
  sort_order: number
}

export interface ArticleInput {
  slug: string
  title: string
  content_md: string
  status: ArticleStatus
  sort_order: number
}

export interface CreateUserInput {
  username: string
  email: string
  password: string
  role: Role
  balance_cents: number
}

/** 全部字段可选：只提交需要改动的键，后端按指针判断是否更新。 */
export interface UpdateUserInput {
  username?: string
  email?: string
  password?: string
  role?: Role
  status?: UserStatus
  balance_cents?: number
}
