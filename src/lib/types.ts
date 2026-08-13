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

export interface Product extends Timestamps {
  category_id: number
  name: string
  description: string
  price_cents: number
  billing_cycle: BillingCycle
  /** 负数表示库存不限。 */
  stock: number
  status: ProductStatus
  sort: number
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
}

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

export interface AdminStats {
  user_count: number
  product_count: number
  order_count: number
  service_count: number
  revenue_cents: number
}

export interface Bootstrap {
  installed: boolean
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
  price_cents: number
  billing_cycle: BillingCycle
  stock: number
  status: ProductStatus
  sort: number
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
