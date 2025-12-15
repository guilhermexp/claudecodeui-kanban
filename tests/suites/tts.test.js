import { post } from '../helpers/http.js'

export async function runTTSTests() {
  const name = 'TTS'
  try {
    const loginRes = await post('/api/auth/login', { username: 'test@test.com', password: 'nova12345' })
    const loginData = await loginRes.json()
    if (!loginRes.ok || !loginData.success) throw new Error('login failed')
    const token = loginData.token

    const res = await post('/api/tts/gemini-summarize', { text: 'teste de síntese', voiceName: 'Zephyr' }, token)
    const data = await res.json()
    if (res.status !== 400 || !data?.error) throw new Error('tts should fail gracefully without keys')
    return { name, success: true }
  } catch (error) {
    return { name, success: false, error: error.message }
  }
}