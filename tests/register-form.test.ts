import { expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { i18n } from '../src/locales'
import RegisterView from '../src/views/RegisterView.vue'
import { http } from '../src/lib/api'
import { captureReferral, clearReferral, readReferral } from '../src/lib/utils'
it('prefills URL attribution in actual registration form and submits explicit edited referral', async () => {
  clearReferral(); captureReferral('?ref=Aff-29')
  const pinia = createPinia(); setActivePinia(pinia)
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'register', component: RegisterView }, { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } }] })
  await router.push('/')
  let payload: any
  http.defaults.adapter = async config => { payload = JSON.parse(config.data); return { data: { user: { id: 1, role: 'user' } }, status: 200, statusText: 'OK', headers: {}, config } }
  const wrapper = mount(RegisterView, { global: { plugins: [pinia, i18n, router], stubs: { RouterLink: true } } })
  expect(wrapper.get('#referral-code').element.value).toBe('Aff-29')
  await wrapper.get('#referral-code').setValue('Aff-42')
  await wrapper.get('#username').setValue('test')
  await wrapper.get('#email').setValue('test@example.com')
  await wrapper.get('#password').setValue('test-only-placeholder')
  await wrapper.get('#confirm').setValue('test-only-placeholder')
  await wrapper.get('form').trigger('submit'); await flushPromises()
  expect(payload.referral_code).toBe('Aff-42')
  expect(readReferral()).toBe('')
  expect(router.currentRoute.value.name).toBe('dashboard')
  wrapper.unmount()
})
