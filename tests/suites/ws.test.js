import WebSocket from 'ws'
import { post } from '../helpers/http.js'

export async function runWSTests() {
  const name = 'WebSocket'
  try {
    // login to obtain token
    const loginRes = await post('/api/auth/login', { username: 'test@test.com', password: 'nova12345' })
    const loginData = await loginRes.json()
    if (!loginRes.ok || !loginData.success) throw new Error('login failed')
    const token = loginData.token

    // connect to root ws and send auth
    const ws = new WebSocket('ws://localhost:7347')
    const authPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 3000)
      ws.on('open', () => {
        try { ws.send(JSON.stringify({ type: 'auth', token })) } catch {}
      })
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'auth-success') { clearTimeout(timer); resolve(true) }
          if (msg.type === 'pong') { /* ignore */ }
        } catch {}
      })
      ws.on('error', (e) => { clearTimeout(timer); reject(e) })
      ws.on('close', () => {})
    })

    const ok = await authPromise
    if (!ok) throw new Error('auth handshake failed')
    ws.close()
    return { name, success: true }
  } catch (error) {
    return { name, success: false, error: error.message }
  }
}