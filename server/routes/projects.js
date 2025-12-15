import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { getProjects, getSessions, getSessionMessages, renameProject, deleteProject, deleteProjectCompletely, addProjectManually } from '../projects.js'

const router = express.Router()

router.get('/', authenticateToken, async (req, res) => {
  try {
    const projects = await getProjects()
    res.json(projects)
  } catch (e) {
    res.status(500).json({ error: 'Failed to retrieve projects' })
  }
})

router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { path, name } = req.body || {}
    if (!path || typeof path !== 'string') return res.status(400).json({ error: 'Path is required' })
    const project = await addProjectManually(path, name || null)
    res.json({ success: true, project })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.get('/:projectName/sessions', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params
    const { limit = 5, offset = 0 } = req.query
    const result = await getSessions(projectName, limit, offset)
    res.json(result)
  } catch (e) {
    res.status(500).json({ error: 'Failed to retrieve sessions' })
  }
})

router.get('/:projectName/sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { projectName, sessionId } = req.params
    const messages = await getSessionMessages(projectName, sessionId)
    res.json(messages)
  } catch (e) {
    res.status(500).json({ error: 'Failed to retrieve session messages' })
  }
})

router.put('/:projectName/rename', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params
    const { displayName } = req.body || {}
    await renameProject(projectName, displayName || '')
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:projectName', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params
    await deleteProject(projectName)
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

router.delete('/:projectName/force', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params
    await deleteProjectCompletely(projectName)
    res.json({ success: true })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

export default router