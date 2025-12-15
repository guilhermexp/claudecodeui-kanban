import { post, get } from '../helpers/http.js'

export async function runAuthTests() {
  const name = 'Auth'
  try {
    // status
    const statusRes = await get('/api/auth/status')
    const status = await statusRes.json()

    // ensure test user exists (register if setup phase)
    let token = null
    const cred = { username: 'test@test.com', password: 'nova12345' }

    if (status.needsSetup) {
      const regRes = await post('/api/auth/register', cred)
      const regData = await regRes.json()
      if (!regRes.ok || !regData.success) throw new Error('register failed')
      token = regData.token
    } else {
      const loginRes = await post('/api/auth/login', cred)
      const loginData = await loginRes.json()
      if (!loginRes.ok || !loginData.success) throw new Error('login failed')
      token = loginData.token
    }

    // user
    const meRes = await get('/api/auth/user', token)
    if (!meRes.ok) throw new Error('user failed')
    const me = await meRes.json()
    if (!me?.user?.username) throw new Error('user payload invalid')

    return { name, success: true }
  } catch (error) {
    return { name, success: false, error: error.message }
  }
}