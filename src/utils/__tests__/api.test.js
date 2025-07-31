import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api, authenticatedFetch } from '../api'
import { authPersistence } from '../auth-persistence'

// Mock dependencies
vi.mock('../auth-persistence', () => ({
  authPersistence: {
    getToken: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn()
  }
}))

// Mock fetch globally
global.fetch = vi.fn()

describe('API Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('authenticatedFetch', () => {
    it('adds authorization header when token exists', async () => {
      authPersistence.getToken.mockReturnValue('test-token-123')
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      await authenticatedFetch('/api/test')
      
      expect(fetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token-123'
        }
      })
    })

    it('does not add authorization header when no token', async () => {
      authPersistence.getToken.mockReturnValue(null)
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      await authenticatedFetch('/api/test')
      
      expect(fetch).toHaveBeenCalledWith('/api/test', {
        headers: {
          'Content-Type': 'application/json'
        }
      })
    })

    it('does not set Content-Type for FormData', async () => {
      authPersistence.getToken.mockReturnValue('test-token')
      const formData = new FormData()
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      await authenticatedFetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      expect(fetch).toHaveBeenCalledWith('/api/upload', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': 'Bearer test-token'
        }
      })
    })
  })

  describe('Auth API', () => {
    it('calls login endpoint with credentials', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'new-token', user: { id: 1 } })
      })

      await api.auth.login('testuser', 'password123')
      
      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'password123' })
      })
    })

    it('calls register endpoint with credentials', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'new-token', user: { id: 1 } })
      })

      await api.auth.register('newuser', 'password123')
      
      expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'newuser', password: 'password123' })
      })
    })

    it('calls logout with authentication', async () => {
      authPersistence.getToken.mockReturnValue('test-token')
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      await api.auth.logout()
      
      expect(fetch).toHaveBeenCalledWith('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
    })
  })

  describe('Projects API', () => {
    beforeEach(() => {
      authPersistence.getToken.mockReturnValue('test-token')
    })

    it('fetches projects list', async () => {
      const mockProjects = [
        { name: 'project1', path: '/path1' },
        { name: 'project2', path: '/path2' }
      ]
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects
      })

      await api.projects()
      
      expect(fetch).toHaveBeenCalledWith('/api/projects', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
    })

    it('creates a new project', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'newproject', path: '/new/path' })
      })

      await api.createProject('/new/path')
      
      expect(fetch).toHaveBeenCalledWith('/api/projects/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({ path: '/new/path' })
      })
    })

    it('deletes a project', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      await api.deleteProject('project1')
      
      expect(fetch).toHaveBeenCalledWith('/api/projects/project1', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      })
    })
  })

  describe('Sessions API', () => {
    beforeEach(() => {
      authPersistence.getToken.mockReturnValue('test-token')
    })

    it('fetches sessions with pagination', async () => {
      const mockSessions = [
        { id: 'session1', name: 'Session 1' },
        { id: 'session2', name: 'Session 2' }
      ]
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSessions
      })

      await api.sessions('project1', 10, 20)
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/projects/project1/sessions?limit=10&offset=20',
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }
        }
      )
    })

    it('fetches session messages', async () => {
      const mockMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessages
      })

      await api.sessionMessages('project1', 'session1')
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/projects/project1/sessions/session1/messages',
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }
        }
      )
    })

    it('deletes a session', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      await api.deleteSession('project1', 'session1')
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/projects/project1/sessions/session1',
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }
        }
      )
    })
  })

  describe('Files API', () => {
    beforeEach(() => {
      authPersistence.getToken.mockReturnValue('test-token')
    })

    it('reads a file', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: 'file content' })
      })

      await api.readFile('project1', 'src/test.js')
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/projects/project1/file?filePath=src%2Ftest.js',
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }
        }
      )
    })

    it('saves a file', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })

      await api.saveFile('project1', 'src/test.js', 'new content')
      
      expect(fetch).toHaveBeenCalledWith(
        '/api/projects/project1/file',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          body: JSON.stringify({
            filePath: 'src/test.js',
            content: 'new content'
          })
        }
      )
    })
  })
})