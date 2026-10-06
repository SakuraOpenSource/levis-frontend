import { expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RouteProgress from '../src/components/app/RouteProgress.vue'
import LoadingBlock from '../src/components/app/LoadingBlock.vue'

const hooks = vi.hoisted(() => ({ before: null as null | (() => void), after: null as null | (() => void) }))
vi.mock('vue-router', () => ({ useRouter: () => ({
  beforeEach: (fn: () => void) => { hooks.before = fn; return () => {} },
  afterEach: (fn: () => void) => { hooks.after = fn; return () => {} },
  onError: () => () => {},
}) }))
it('announces unknown route progress without a fabricated percentage', async () => {
  vi.useFakeTimers()
  const wrapper = mount(RouteProgress)
  hooks.before?.(); await vi.advanceTimersByTimeAsync(350)
  expect(wrapper.find('[role="status"]').exists()).toBe(true)
  expect(wrapper.find('[style*="width"]').exists()).toBe(false)
  expect(wrapper.text()).toContain('加载页面')
  hooks.after?.(); await vi.advanceTimersByTimeAsync(300)
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
  wrapper.unmount(); vi.useRealTimers()
})
it('exposes an accessible loading announcement rather than silent skeletons', () => {
  const wrapper = mount(LoadingBlock)
  expect(wrapper.attributes('role')).toBe('status')
  expect(wrapper.text()).toContain('正在加载')
})
