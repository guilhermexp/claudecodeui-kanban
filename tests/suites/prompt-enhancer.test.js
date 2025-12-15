import { get, post } from '../helpers/http.js'

export async function runEnhancerTests() {
  const name = 'PromptEnhancer'
  try {
    const loginRes = await post('/api/auth/login', { username: 'test@test.com', password: 'nova12345' })
    const loginData = await loginRes.json()
    if (!loginRes.ok || !loginData.success) throw new Error('login failed')
    const token = loginData.token

    const statusRes = await get('/api/prompt-enhancer/status', token)
    if (!statusRes.ok) throw new Error('status failed')
    const status = await statusRes.json()
    if (!status || typeof status.local !== 'boolean') throw new Error('status invalid')

    const enhanceRes = await post('/api/prompt-enhancer/enhance', { input: 'build a todo app', mode: 'implementation' }, token)
    const enhanceData = await enhanceRes.json()
    if (!enhanceRes.ok || !enhanceData?.output) throw new Error('enhance failed')

    return { name, success: true }
  } catch (error) {
    return { name, success: false, error: error.message }
  }
}