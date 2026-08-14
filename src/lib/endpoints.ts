import { http } from './api'
import type {
  AdminStats,
  Bootstrap,
  CartView,
  Category,
  CategoryInput,
  CreateUserInput,
  DatabaseConfig,
  InstallRequest,
  Invoice,
  Order,
  Page,
  PayResult,
  Product,
  ProductInput,
  RenewResult,
  Service,
  ServiceStatus,
  Transaction,
  UpdateUserInput,
  User,
  WalletOverview,
  BillingCycle,
} from './types'

interface PageQuery {
  page?: number
  page_size?: number
}

/** 站点与安装。 */
export const siteApi = {
  async bootstrap() {
    const { data } = await http.get<Bootstrap>('/bootstrap')
    return data
  },
  async testDatabase(config: DatabaseConfig) {
    const { data } = await http.post<{ ok: boolean }>('/install/test-db', config)
    return data
  },
  async install(payload: InstallRequest) {
    const { data } = await http.post<{ ok: boolean; user?: User }>('/install', payload)
    return data
  },
}

/** 认证与个人资料。 */
export const authApi = {
  async register(payload: { username: string; email: string; password: string }) {
    const { data } = await http.post<{ user: User }>('/auth/register', payload)
    return data.user
  },
  async login(identifier: string, password: string) {
    const { data } = await http.post<{ user: User }>('/auth/login', { identifier, password })
    return data.user
  },
  async logout() {
    await http.post('/auth/logout')
  },
  async me() {
    const { data } = await http.get<{ user: User }>('/me')
    return data.user
  },
  async updateEmail(password: string, email: string) {
    const { data } = await http.patch<{ user: User }>('/me/email', { password, email })
    return data.user
  },
  async updatePassword(oldPassword: string, newPassword: string) {
    await http.post('/me/password', { old_password: oldPassword, new_password: newPassword })
  },
}

/** 商品目录（公开）。 */
export const catalogApi = {
  async categories() {
    const { data } = await http.get<{ items: Category[] | null }>('/catalog/categories')
    return data.items ?? []
  },
  async products(categoryId?: number) {
    const { data } = await http.get<{ items: Product[] | null }>('/catalog/products', {
      params: categoryId ? { category_id: categoryId } : undefined,
    })
    return data.items ?? []
  },
  async product(id: number) {
    const { data } = await http.get<Product>(`/catalog/products/${id}`)
    return data
  },
}

/** 购物车。写操作统一返回最新购物车，省一次拉取。 */
export const cartApi = {
  async list() {
    const { data } = await http.get<CartView>('/cart/items')
    return data
  },
  async add(productId: number, quantity: number, billingCycle: BillingCycle) {
    const { data } = await http.post<CartView>('/cart/items', {
      product_id: productId,
      quantity,
      billing_cycle: billingCycle,
    })
    return data
  },
  async updateQuantity(itemId: number, quantity: number) {
    const { data } = await http.patch<CartView>(`/cart/items/${itemId}`, { quantity })
    return data
  },
  async remove(itemId: number) {
    const { data } = await http.delete<CartView>(`/cart/items/${itemId}`)
    return data
  },
}

/** 订单与支付。 */
export const orderApi = {
  async create() {
    const { data } = await http.post<Order>('/orders')
    return data
  },
  async list(query: PageQuery = {}) {
    const { data } = await http.get<Page<Order>>('/orders', { params: query })
    return data
  },
  async get(id: number) {
    const { data } = await http.get<Order>(`/orders/${id}`)
    return data
  },
  async pay(id: number) {
    const { data } = await http.post<PayResult>(`/orders/${id}/pay`)
    return data
  },
  async cancel(id: number) {
    await http.post(`/orders/${id}/cancel`)
  },
}

/** 已购服务。 */
export const serviceApi = {
  async list(query: PageQuery = {}) {
    const { data } = await http.get<Page<Service>>('/services', { params: query })
    return data
  },
  async get(id: number) {
    const { data } = await http.get<Service>(`/services/${id}`)
    return data
  },
  async renew(id: number) {
    const { data } = await http.post<RenewResult>(`/services/${id}/renew`)
    return data
  },
}

/** 钱包。 */
export const walletApi = {
  async overview() {
    const { data } = await http.get<WalletOverview>('/wallet')
    return data
  },
  async transactions(query: PageQuery = {}) {
    const { data } = await http.get<Page<Transaction>>('/wallet/transactions', { params: query })
    return data
  },
  async recharge(amountCents: number) {
    const { data } = await http.post<Transaction>('/wallet/recharge', {
      amount_cents: amountCents,
    })
    return data
  },
}

/** 账单。 */
export const invoiceApi = {
  async list(query: PageQuery = {}) {
    const { data } = await http.get<Page<Invoice>>('/invoices', { params: query })
    return data
  },
  async get(id: number) {
    const { data } = await http.get<Invoice>(`/invoices/${id}`)
    return data
  },
}

/** 管理后台。 */
export const adminApi = {
  async stats() {
    const { data } = await http.get<AdminStats>('/admin/stats')
    return data
  },
  async users(query: PageQuery & { keyword?: string } = {}) {
    const { data } = await http.get<Page<User>>('/admin/users', { params: query })
    return data
  },
  async createUser(payload: CreateUserInput) {
    const { data } = await http.post<User>('/admin/users', payload)
    return data
  },
  async updateUser(id: number, payload: UpdateUserInput) {
    const { data } = await http.patch<User>(`/admin/users/${id}`, payload)
    return data
  },
  async deleteUser(id: number) {
    await http.delete(`/admin/users/${id}`)
  },
  async categories() {
    const { data } = await http.get<{ items: Category[] | null }>('/admin/categories')
    return data.items ?? []
  },
  async createCategory(payload: CategoryInput) {
    const { data } = await http.post<Category>('/admin/categories', payload)
    return data
  },
  async updateCategory(id: number, payload: CategoryInput) {
    const { data } = await http.patch<Category>(`/admin/categories/${id}`, payload)
    return data
  },
  async deleteCategory(id: number) {
    await http.delete(`/admin/categories/${id}`)
  },
  async products(query: PageQuery & { category_id?: number } = {}) {
    const { data } = await http.get<Page<Product>>('/admin/products', { params: query })
    return data
  },
  async createProduct(payload: ProductInput) {
    const { data } = await http.post<Product>('/admin/products', payload)
    return data
  },
  async updateProduct(id: number, payload: ProductInput) {
    const { data } = await http.patch<Product>(`/admin/products/${id}`, payload)
    return data
  },
  async deleteProduct(id: number) {
    await http.delete(`/admin/products/${id}`)
  },
  async userServices(userId: number, query: PageQuery = {}) {
    const { data } = await http.get<Page<Service>>(`/admin/users/${userId}/services`, {
      params: query,
    })
    return data
  },
  async updateService(id: number, status: ServiceStatus) {
    const { data } = await http.patch<Service>(`/admin/services/${id}`, { status })
    return data
  },
  async deleteService(id: number) {
    await http.delete(`/admin/services/${id}`)
  },
}
