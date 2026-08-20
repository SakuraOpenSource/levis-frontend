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
export type ServiceStatus = 'pending' | 'active' | 'suspended' | 'terminated'
export type InvoiceStatus = 'unpaid' | 'paid' | 'cancelled'
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
  upstream_plugin_id: string
  upstream_host_id: string
}

/** 电源操作动作：开机/关机/重启/重装系统。 */
export type PowerAction = 'boot' | 'shutdown' | 'reboot' | 'reinstall'

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
  status: InvoiceStatus
  total_cents: number
  due_at: string | null
  paid_at: string | null
  items?: InvoiceItem[]
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
}

export interface PaymentMethodAdmin extends Timestamps {
  name: string
  plugin_id: string
  config: Record<string, string>
  enabled: boolean
  sort_order: number
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
  /** 仅管理端列表返回。 */
  username?: string
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