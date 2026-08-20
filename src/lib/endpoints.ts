import { http, postForm } from './api'
import type {
  AdminStats,
  APIKeyCreated,
  APIKeyInput,
  APIKeyList,
  Bootstrap,
  CaptchaChallenge,
  CaptchaSettings,
  CartView,
  Category,
  CategoryInput,
  CreateUserInput,
  DatabaseConfig,
  InstallRequest,
  Invoice,
  KYCStatus,
  Order,
  Page,
  PayResult,
  PowerAction,
  Product,
  ProductInput,
  RenewResult,
  Service,
  ServiceStatus,
  Ticket,
  TicketReply,
  TicketStatus,
  Transaction,
  UpdateUserInput,
  User,
  Verification,
  WalletOverview,
  BillingCycle,
  Plugin,
  PluginConfigInput,
  PluginListResponse,
  ExternalPayment,
  PaymentMethod,
  PaymentMethodAdmin,
  PaymentPlugin,
  OSImage,
  UpstreamHost,
} from './types'
interface PageQuery {
  page?: number
  page_size?: number
}

/** 证件照的两面，与后端 service.SideFront / SideBack 一致。 */
export type PhotoSide = 'front' | 'back'

/**
 * 把工单的主题、正文与附件装进 FormData。
 *
 * 附件字段名固定为 files —— 后端按这个名字取多文件。
 */
function ticketForm(fields: Record<string, string>, files: File[]): FormData {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.append(name, value)
  }
  for (const file of files) {
    form.append('files', file)
  }
  return form
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

/** 图形验证码。签发接口无需登录 —— 登录、注册页正是在没有登录态时用它。 */
export const captchaApi = {
  async issue() {
    const { data } = await http.get<CaptchaChallenge>('/captcha')
    return data
  },
}

/** 带验证码的表单额外要提交的字段。 */
export interface CaptchaAnswer {
  captcha_id?: string
  captcha_code?: string
}

/** 认证与个人资料。 */
export const authApi = {
  async register(
    payload: { username: string; email: string; password: string } & CaptchaAnswer,
  ) {
    const { data } = await http.post<{ user: User }>('/auth/register', payload)
    return data.user
  },
  async login(identifier: string, password: string, captcha: CaptchaAnswer = {}) {
    const { data } = await http.post<{ user: User }>('/auth/login', {
      identifier,
      password,
      ...captcha,
    })
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

/** 外部支付。金额与目标由后端根据 purpose 校验并派生。 */
export const paymentApi = {
  async methods() {
    const { data } = await http.get<{ items: PaymentMethod[] }>('/payments/methods')
    return data.items ?? []
  },
  async create(
    purpose: ExternalPayment['purpose'],
    targetId: number,
    pluginId: string,
    amountCents?: number,
  ) {
    const { data } = await http.post<ExternalPayment>('/payments', {
      purpose,
      target_id: targetId,
      plugin_id: pluginId,
      ...(amountCents === undefined ? {} : { amount_cents: amountCents }),
    })
    return data
  },
  async get(id: number) {
    const { data } = await http.get<ExternalPayment>(`/payments/${id}`)
    return data
  },
  async query(id: number) {
    const { data } = await http.post<ExternalPayment>(`/payments/${id}/query`)
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
  async power(id: number, action: PowerAction, os?: string) {
    const { data } = await http.post<{ message: string }>(`/services/${id}/power`, { action, ...(os ? { os } : {}) })
    return data
  },
  async upstream(id: number) {
    const { data } = await http.get<UpstreamHost>(`/services/${id}/upstream`)
    return data
  },
  async osList(id: number) {
    const { data } = await http.get<{ items: OSImage[] }>(`/services/${id}/os`)
    return data.items ?? []
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

/** 工单。建单与回复都是 multipart，因此走 postForm。 */
export const ticketApi = {
  async list(query: PageQuery = {}) {
    const { data } = await http.get<Page<Ticket>>('/tickets', { params: query })
    return data
  },
  async get(id: number) {
    const { data } = await http.get<Ticket>(`/tickets/${id}`)
    return data
  },
  async create(subject: string, body: string, files: File[] = []) {
    return postForm<Ticket>('/tickets', ticketForm({ subject, body }, files))
  },
  async reply(id: number, body: string, files: File[] = []) {
    return postForm<TicketReply>(`/tickets/${id}/replies`, ticketForm({ body }, files))
  },
  async close(id: number) {
    await http.post(`/tickets/${id}/close`)
  },
  /**
   * 附件下载地址。同源请求，cookie 自动带上，直接放进 <a href download> 即可，
   * 不必绕 blob URL。
   */
  attachmentUrl(ticketId: number, attachmentId: number) {
    return `/api/tickets/${ticketId}/attachments/${attachmentId}`
  },
}

/** 实名认证。 */
export const kycApi = {
  /** 从未提交过时后端返回 record: null，前端据此显示提交表单。 */
  async mine() {
    const { data } = await http.get<{ record: Verification | null }>('/kyc')
    return data.record
  },
  async submit(realName: string, idNumber: string, front: File, back: File) {
    const form = new FormData()
    form.append('real_name', realName)
    form.append('id_number', idNumber)
    form.append('front', front)
    form.append('back', back)
    return postForm<Verification>('/kyc', form)
  },
  /** 证件照地址，可直接作为 <img src>。 */
  photoUrl(side: PhotoSide) {
    return `/api/kyc/photo/${side}`
  },
}

/** API Key。管理这些 Key 走的是浏览器登录态，不是 Key 自己。 */
export const apiKeyApi = {
  async list() {
    const { data } = await http.get<APIKeyList>('/api-keys')
    return data
  },
  async create(payload: APIKeyInput) {
    const { data } = await http.post<APIKeyCreated>('/api-keys', payload)
    return data
  },
  async revoke(id: number) {
    await http.delete(`/api-keys/${id}`)
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
  async provisionPlugins() {
    const { data } = await http.get<{ items: { id: string; name: string }[] }>('/admin/provision-plugins')
    return data.items ?? []
  },
  async upstreamProducts(pluginId: string) {
    const { data } = await http.get<{
      items: {
        id: string
        name: string
        description: string
        group_name: string
        price_cents: number
        billing_cycle: string
      }[]
    }>('/admin/upstream-products', { params: { plugin_id: pluginId } })
    return data.items ?? []
  },
  async syncProductInfo(productId: number) {
    const { data } = await http.post<{ message: string }>(`/admin/products/${productId}/sync-info`)
    return data
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
  async createServiceForUser(userId: number, payload: { product_id: number; quantity?: number; billing_cycle?: string; provision: boolean }) {
    const { data } = await http.post<Service>(`/admin/users/${userId}/services`, payload)
    return data
  },
  async bindService(id: number, payload: { upstream_plugin_id: string; upstream_host_id: string }) {
    const { data } = await http.post<Service>(`/admin/services/${id}/bind`, payload)
    return data
  },
  async paymentPlugins() {
    const { data } = await http.get<{ items: PaymentPlugin[] }>('/admin/payment-plugins')
    return data.items ?? []
  },
  async paymentMethods() {
    const { data } = await http.get<{ items: PaymentMethodAdmin[] }>('/admin/payment-methods')
    return data.items ?? []
  },
  async createPaymentMethod(payload: { name: string; plugin_id: string; config: Record<string, string>; enabled?: boolean; sort_order?: number }) {
    const { data } = await http.post<PaymentMethodAdmin>('/admin/payment-methods', payload)
    return data
  },
  async updatePaymentMethod(id: number, payload: { name?: string; plugin_id?: string; config?: Record<string, string>; enabled?: boolean; sort_order?: number }) {
    const { data } = await http.patch<PaymentMethodAdmin>(`/admin/payment-methods/${id}`, payload)
    return data
  },
  async deletePaymentMethod(id: number) {
    await http.delete(`/admin/payment-methods/${id}`)
  },
  async captchaSettings() {
    const { data } = await http.get<CaptchaSettings>('/admin/settings/captcha')
    return data
  },
  async updateCaptchaSettings(payload: CaptchaSettings) {
    const { data } = await http.put<CaptchaSettings>('/admin/settings/captcha', payload)
    return data
  },
  async tickets(query: PageQuery & { status?: TicketStatus } = {}) {
    const { data } = await http.get<Page<Ticket>>('/admin/tickets', { params: query })
    return data
  },
  async ticket(id: number) {
    const { data } = await http.get<Ticket>(`/admin/tickets/${id}`)
    return data
  },
  async replyTicket(id: number, body: string, files: File[] = []) {
    return postForm<TicketReply>(`/admin/tickets/${id}/replies`, ticketForm({ body }, files))
  },
  async closeTicket(id: number) {
    await http.post(`/admin/tickets/${id}/close`)
  },
  async reopenTicket(id: number) {
    await http.post(`/admin/tickets/${id}/reopen`)
  },
  ticketAttachmentUrl(ticketId: number, attachmentId: number) {
    return `/api/admin/tickets/${ticketId}/attachments/${attachmentId}`
  },
  async verifications(query: PageQuery & { status?: KYCStatus } = {}) {
    const { data } = await http.get<Page<Verification>>('/admin/verifications', { params: query })
    return data
  },
  /** 详情里的 id_number 是完整号码，管理员要拿它与照片比对。 */
  async verification(id: number) {
    const { data } = await http.get<Verification>(`/admin/verifications/${id}`)
    return data
  },
  verificationPhotoUrl(id: number, side: PhotoSide) {
    return `/api/admin/verifications/${id}/photo/${side}`
  },
  async approveVerification(id: number) {
    const { data } = await http.post<Verification>(`/admin/verifications/${id}/approve`)
    return data
  },
  async rejectVerification(id: number, reason: string) {
    const { data } = await http.post<Verification>(`/admin/verifications/${id}/reject`, { reason })
    return data
  },
  async plugins() {
    const { data } = await http.get<PluginListResponse>('/admin/plugins')
    return data
  },
  async plugin(id: string) {
    const { data } = await http.get<Plugin>(`/admin/plugins/${id}`)
    return data
  },
  async installPlugin(file: File) {
    const form = new FormData()
    form.append('file', file)
    return postForm<{ id: string }>('/admin/plugins/install', form)
  },
  async reloadPlugins() {
    const { data } = await http.post<PluginListResponse>('/admin/plugins/reload')
    return data
  },
  async updatePluginConfig(id: string, payload: PluginConfigInput) {
    const { data } = await http.put<Plugin>(`/admin/plugins/${id}/config`, payload)
    return data
  },
  async frontendPluginConfig(id: string) {
    const { data } = await http.get<{ pid: string; gateway_url: string; payment_type: string; key_set: boolean }>(`/admin/plugins/${id}/frontend-config`)
    return data
  },
  async updateFrontendPluginConfig(id: string, values: Record<string, string>) {
    await http.put(`/admin/plugins/${id}/frontend-config`, { values })
  },
  async enablePlugin(id: string) {
    const { data } = await http.post<Plugin>(`/admin/plugins/${id}/enable`)
    return data
  },
  async disablePlugin(id: string) {
    const { data } = await http.post<Plugin>(`/admin/plugins/${id}/disable`)
    return data
  },
  async pluginLogs(id: string) {
    const { data } = await http.get<{ lines: string[] }>(`/admin/plugins/${id}/logs`)
    return data.lines
  },
}