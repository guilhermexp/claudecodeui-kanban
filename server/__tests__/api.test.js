import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

// Mock dependencies
vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => ({
    prepare: vi.fn(() => ({
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn()
    })),
    exec: vi.fn(),
    close: vi.fn()
  }))
}))

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    write: vi.fn(),
    kill: vi.fn(),
    on: vi.fn(),
    resize: vi.fn()
  }))
}))

// Import server setup
import { setupRoutes } from '../routes/index.js'

describe('Backend API Tests', () => {
  let app
  let mockDb
  
  beforeAll(() => {
    // Set up Express app
    app = express()
    app.use(express.json())
    
    // Mock database
    const Database = require('better-sqlite3').default
    mockDb = Database()
    
    // Set up routes
    setupRoutes(app, mockDb)
    
    // Mock JWT secret
    process.env.JWT_SECRET = 'test-secret'
  })
  
  afterAll(() => {
    mockDb.close()
  })
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('registers a new user successfully', async () => {
        const mockPrepare = mockDb.prepare
        mockPrepare.mockReturnValueOnce({
          get: vi.fn().mockReturnValue(null) // User doesn't exist
        }).mockReturnValueOnce({
          run: vi.fn().mockReturnValue({ lastInsertRowid: 1 })
        })

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'testuser',
            password: 'testpass123'
          })

        expect(response.status).toBe(201)
        expect(response.body).toHaveProperty('token')
        expect(response.body).toHaveProperty('user')
        expect(response.body.user.username).toBe('testuser')
      })

      it('rejects registration with existing username', async () => {
        const mockPrepare = mockDb.prepare
        mockPrepare.mockReturnValueOnce({
          get: vi.fn().mockReturnValue({ id: 1, username: 'testuser' })
        })

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'testuser',
            password: 'testpass123'
          })

        expect(response.status).toBe(400)
        expect(response.body.error).toContain('already exists')
      })

      it('validates required fields', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'testuser'
            // Missing password
          })

        expect(response.status).toBe(400)
        expect(response.body.error).toContain('required')
      })
    })

    describe('POST /api/auth/login', () => {
      it('logs in successfully with valid credentials', async () => {
        const hashedPassword = await bcrypt.hash('testpass123', 10)
        const mockPrepare = mockDb.prepare
        mockPrepare.mockReturnValueOnce({
          get: vi.fn().mockReturnValue({
            id: 1,
            username: 'testuser',
            password: hashedPassword
          })
        })

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password: 'testpass123'
          })

        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('token')
        expect(response.body.user.username).toBe('testuser')
      })

      it('rejects login with invalid password', async () => {
        const hashedPassword = await bcrypt.hash('correctpass', 10)
        const mockPrepare = mockDb.prepare
        mockPrepare.mockReturnValueOnce({
          get: vi.fn().mockReturnValue({
            id: 1,
            username: 'testuser',
            password: hashedPassword
          })
        })

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password: 'wrongpass'
          })

        expect(response.status).toBe(401)
        expect(response.body.error).toContain('Invalid')
      })

      it('rejects login with non-existent user', async () => {
        const mockPrepare = mockDb.prepare
        mockPrepare.mockReturnValueOnce({
          get: vi.fn().mockReturnValue(null)
        })

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'nonexistent',
            password: 'anypass'
          })

        expect(response.status).toBe(401)
        expect(response.body.error).toContain('Invalid')
      })
    })
  })

  describe('Project Management Endpoints', () => {
    const authToken = jwt.sign({ userId: 1 }, 'test-secret')

    describe('GET /api/projects', () => {
      it('returns list of projects for authenticated user', async () => {
        const mockProjects = [
          { id: 1, name: 'Project 1', path: '/path1', user_id: 1 },
          { id: 2, name: 'Project 2', path: '/path2', user_id: 1 }
        ]
        
        const mockPrepare = mockDb.prepare
        mockPrepare.mockReturnValueOnce({
          all: vi.fn().mockReturnValue(mockProjects)
        })

        const response = await request(app)
          .get('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        expect(response.body).toHaveLength(2)
        expect(response.body[0].name).toBe('Project 1')
      })

      it('requires authentication', async () => {
        const response = await request(app)
          .get('/api/projects')

        expect(response.status).toBe(401)
      })
    })

    describe('POST /api/projects', () => {
      it('creates a new project', async () => {
        const mockPrepare = mockDb.prepare
        mockPrepare
          .mockReturnValueOnce({
            run: vi.fn().mockReturnValue({ lastInsertRowid: 3 })
          })
          .mockReturnValueOnce({
            get: vi.fn().mockReturnValue({
              id: 3,
              name: 'New Project',
              path: '/new/path',
              user_id: 1
            })
          })

        const response = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'New Project',
            path: '/new/path'
          })

        expect(response.status).toBe(201)
        expect(response.body.name).toBe('New Project')
        expect(response.body.path).toBe('/new/path')
      })

      it('validates required fields', async () => {
        const response = await request(app)
          .post('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Project without path'
          })

        expect(response.status).toBe(400)
        expect(response.body.error).toContain('required')
      })
    })

    describe('DELETE /api/projects/:id', () => {
      it('deletes a project owned by user', async () => {
        const mockPrepare = mockDb.prepare
        mockPrepare
          .mockReturnValueOnce({
            get: vi.fn().mockReturnValue({ id: 1, user_id: 1 })
          })
          .mockReturnValueOnce({
            run: vi.fn()
          })

        const response = await request(app)
          .delete('/api/projects/1')
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        expect(response.body.success).toBe(true)
      })

      it('prevents deleting projects not owned by user', async () => {
        const mockPrepare = mockDb.prepare
        mockPrepare.mockReturnValueOnce({
          get: vi.fn().mockReturnValue({ id: 1, user_id: 999 })
        })

        const response = await request(app)
          .delete('/api/projects/1')
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(403)
      })
    })
  })

  describe('Session Management Endpoints', () => {
    const authToken = jwt.sign({ userId: 1 }, 'test-secret')

    describe('GET /api/sessions/:projectId', () => {
      it('returns sessions for a project', async () => {
        const mockSessions = [
          { id: 1, project_id: 1, name: 'Session 1' },
          { id: 2, project_id: 1, name: 'Session 2' }
        ]

        const mockPrepare = mockDb.prepare
        mockPrepare
          .mockReturnValueOnce({
            get: vi.fn().mockReturnValue({ id: 1, user_id: 1 })
          })
          .mockReturnValueOnce({
            all: vi.fn().mockReturnValue(mockSessions)
          })

        const response = await request(app)
          .get('/api/sessions/1')
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        expect(response.body).toHaveLength(2)
      })

      it('prevents access to sessions of other users', async () => {
        const mockPrepare = mockDb.prepare
        mockPrepare.mockReturnValueOnce({
          get: vi.fn().mockReturnValue({ id: 1, user_id: 999 })
        })

        const response = await request(app)
          .get('/api/sessions/1')
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(403)
      })
    })

    describe('POST /api/sessions', () => {
      it('creates a new session', async () => {
        const mockPrepare = mockDb.prepare
        mockPrepare
          .mockReturnValueOnce({
            get: vi.fn().mockReturnValue({ id: 1, user_id: 1 })
          })
          .mockReturnValueOnce({
            run: vi.fn().mockReturnValue({ lastInsertRowid: 3 })
          })
          .mockReturnValueOnce({
            get: vi.fn().mockReturnValue({
              id: 3,
              project_id: 1,
              name: 'New Session'
            })
          })

        const response = await request(app)
          .post('/api/sessions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            project_id: 1,
            name: 'New Session'
          })

        expect(response.status).toBe(201)
        expect(response.body.name).toBe('New Session')
      })
    })
  })

  describe('Git Operations Endpoints', () => {
    const authToken = jwt.sign({ userId: 1 }, 'test-secret')

    describe('GET /api/git/status', () => {
      it('returns git status for a project', async () => {
        const mockPrepare = mockDb.prepare
        mockPrepare.mockReturnValueOnce({
          get: vi.fn().mockReturnValue({ 
            id: 1, 
            user_id: 1,
            path: '/test/project'
          })
        })

        // Mock git command execution
        const { exec } = require('child_process')
        vi.mock('child_process', () => ({
          exec: vi.fn((cmd, opts, callback) => {
            callback(null, 'On branch main\nnothing to commit', '')
          })
        }))

        const response = await request(app)
          .get('/api/git/status')
          .query({ projectId: 1 })
          .set('Authorization', `Bearer ${authToken}`)

        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('branch')
        expect(response.body).toHaveProperty('status')
      })
    })
  })

  describe('WebSocket Connection', () => {
    it('handles WebSocket upgrade requests', async () => {
      const response = await request(app)
        .get('/ws')
        .set('Upgrade', 'websocket')
        .set('Connection', 'Upgrade')
        .set('Sec-WebSocket-Key', 'dGhlIHNhbXBsZSBub25jZQ==')
        .set('Sec-WebSocket-Version', '13')

      // WebSocket upgrade returns 101 status
      expect([101, 426]).toContain(response.status)
    })
  })

  describe('Error Handling', () => {
    it('handles 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-endpoint')

      expect(response.status).toBe(404)
    })

    it('handles malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{ invalid json')

      expect(response.status).toBe(400)
    })

    it('handles database errors gracefully', async () => {
      const mockPrepare = mockDb.prepare
      mockPrepare.mockImplementationOnce(() => {
        throw new Error('Database connection failed')
      })

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${jwt.sign({ userId: 1 }, 'test-secret')}`)

      expect(response.status).toBe(500)
      expect(response.body.error).toContain('error')
    })
  })
})