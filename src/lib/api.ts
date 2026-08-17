import axios, { AxiosError, type AxiosInstance } from 'axios'

/** 后端统一的错误响应体。 */
export interface ApiErrorBody {
  code: string
  message: string
}

/** 后端错误码，与 internal/httpx 保持一致。 */
export const ErrorCode = {
  BadRequest: 'BAD_REQUEST',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  NotInstalled: 'NOT_INSTALLED',
  Internal: 'INTERNAL',
} as const

/** 规范化后的 API 错误，页面只需读 code / message。 */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }

  get isUnauthorized() {
    return this.status === 401
  }

  get isNotInstalled() {
    return this.code === ErrorCode.NotInstalled
  }
}

/** 从 document.cookie 读取指定 cookie。 */
function readCookie(name: string): string {
  const prefix = `${name}=`
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length))
    }
  }
  return ''
}

const CSRF_COOKIE = 'levis_csrf'
const CSRF_HEADER = 'X-CSRF-Token'
const SAFE_METHODS = new Set(['get', 'head', 'options'])

/**
 * 401 时的回调。由 auth store 注入，避免 api 模块反向依赖 store
 * （store 需要 api，形成环）。
 */
let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler
}

export const http: AxiosInstance = axios.create({
  baseURL: '/api',
  // 同源部署，cookie 会自动带上；显式声明以防未来改成跨域部署时忘记。
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

// CSRF 双提交：把非 httpOnly 的 levis_csrf cookie 复制到请求头。
http.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toLowerCase()
  if (!SAFE_METHODS.has(method)) {
    const token = readCookie(CSRF_COOKIE)
    if (token) {
      config.headers.set(CSRF_HEADER, token)
    }
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    // 网络层失败（断网、后端未启动）没有响应体。
    if (!error.response) {
      return Promise.reject(
        new ApiError(ErrorCode.Internal, '网络连接失败，请检查后端服务是否运行', 0),
      )
    }

    const { status, data } = error.response
    const code = data?.code ?? ErrorCode.Internal
    const message = data?.message ?? '请求失败'

    // 401 说明凭证已失效，清掉本地登录态。/me 的 401 是启动探测的
    // 正常结果，不触发回调，否则会造成无意义的跳转。
    const isProbe = error.config?.url === '/me'
    if (status === 401 && !isProbe) {
      onUnauthorized?.()
    }

    return Promise.reject(new ApiError(code, message, status))
  },
)

/**
 * 提交 multipart 表单。
 *
 * 必须清掉实例上默认的 application/json：axios 只有在没有该头时才会让浏览器
 * 自己填 multipart/form-data 与 boundary。留着默认值的话请求体是 FormData、
 * 头却写着 JSON，后端解不出表单，报出来的是个很难查的 400。
 * 所有 FormData 请求都走这里，就不会有哪个页面漏掉这一步。
 */
export async function postForm<T>(url: string, form: FormData): Promise<T> {
  const { data } = await http.post<T>(url, form, {
    headers: { 'Content-Type': null },
  })
  return data
}

/** 把未知异常统一成可展示的文案。 */
export function errorMessage(err: unknown, fallback = '操作失败'): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error && err.message) return err.message
  return fallback
}
