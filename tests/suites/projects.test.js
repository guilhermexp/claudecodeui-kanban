import fs from 'fs'
import path from 'path'
import os from 'os'
import { post, get, put, del } from '../helpers/http.js'

export async function runProjectsTests() {
  const name = 'Projects'
  try {
    // login
    const loginRes = await post('/api/auth/login', { username: 'test@test.com', password: 'nova12345' })
    const loginData = await loginRes.json()
    if (!loginRes.ok || !loginData.success) throw new Error('login failed')
    const token = loginData.token

    // list
    const listRes = await get('/api/projects', token)
    if (!listRes.ok) throw new Error('list failed')
    const list = await listRes.json()
    if (!Array.isArray(list)) throw new Error('list not array')

    // create temp project
    const tmpDir = path.join(os.tmpdir(), 'codeui-test-project')
    try { fs.mkdirSync(tmpDir, { recursive: true }) } catch {}
    const createRes = await post('/api/projects/create', { path: tmpDir, name: 'Test Project' }, token)
    const createData = await createRes.json()
    if (!createRes.ok || !createData?.success) throw new Error('create failed')
    const projName = createData.project.name

    // sessions
    const sessionsRes = await get(`/api/projects/${encodeURIComponent(projName)}/sessions?limit=5&offset=0`, token)
    if (!sessionsRes.ok) throw new Error('sessions failed')
    const sessions = await sessionsRes.json()
    if (!sessions || typeof sessions.total !== 'number') throw new Error('sessions payload invalid')

    // rename
    const renameRes = await put(`/api/projects/${encodeURIComponent(projName)}/rename`, { displayName: 'Renamed Project' }, token)
    if (!renameRes.ok) throw new Error('rename failed')

    // delete
    const delRes = await del(`/api/projects/${encodeURIComponent(projName)}`, token)
    if (!delRes.ok) throw new Error('delete failed')

    return { name, success: true }
  } catch (error) {
    return { name, success: false, error: error.message }
  }
}