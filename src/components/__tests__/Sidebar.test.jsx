import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Sidebar from '../Sidebar'

// Mock API
vi.mock('../../utils/api', () => ({
  api: {
    projects: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    sessions: {
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn()
    }
  }
}))

describe('Sidebar', () => {
  const mockProjects = [
    {
      id: 'proj-1',
      name: 'Test Project 1',
      path: '/test/project1',
      created_at: new Date().toISOString()
    },
    {
      id: 'proj-2', 
      name: 'Test Project 2',
      path: '/test/project2',
      created_at: new Date().toISOString()
    }
  ]

  const mockSessions = [
    {
      id: 'sess-1',
      project_id: 'proj-1',
      name: 'Session 1',
      created_at: new Date().toISOString()
    },
    {
      id: 'sess-2',
      project_id: 'proj-1', 
      name: 'Session 2',
      created_at: new Date().toISOString()
    }
  ]

  const defaultProps = {
    currentProjectId: 'proj-1',
    currentSessionId: 'sess-1',
    onProjectChange: vi.fn(),
    onSessionChange: vi.fn(),
    activeSessions: new Set(),
    onRefresh: vi.fn()
  }

  const renderComponent = (props = {}) => {
    const user = userEvent.setup()
    const utils = render(
      <BrowserRouter>
        <Sidebar {...defaultProps} {...props} />
      </BrowserRouter>
    )
    return { user, ...utils }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    const { api } = require('../../utils/api')
    api.projects.list.mockResolvedValue(mockProjects)
    api.sessions.list.mockResolvedValue(mockSessions)
  })

  describe('Initial Rendering', () => {
    it('renders sidebar with projects and sessions', async () => {
      renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Test Project 1')).toBeInTheDocument()
        expect(screen.getByText('Test Project 2')).toBeInTheDocument()
        expect(screen.getByText('Session 1')).toBeInTheDocument()
        expect(screen.getByText('Session 2')).toBeInTheDocument()
      })
    })

    it('shows loading state initially', () => {
      renderComponent()
      expect(screen.getByText(/Loading projects/i)).toBeInTheDocument()
    })

    it('highlights current project and session', async () => {
      renderComponent()

      await waitFor(() => {
        const currentProject = screen.getByText('Test Project 1').closest('div')
        const currentSession = screen.getByText('Session 1').closest('div')
        
        expect(currentProject).toHaveClass('selected')
        expect(currentSession).toHaveClass('selected')
      })
    })
  })

  describe('Project Management', () => {
    it('creates a new project', async () => {
      const { api } = require('../../utils/api')
      api.projects.create.mockResolvedValue({
        id: 'proj-3',
        name: 'New Project',
        path: '/new/project'
      })

      const { user } = renderComponent()
      
      await waitFor(() => {
        expect(screen.getByText('Test Project 1')).toBeInTheDocument()
      })

      const newProjectButton = screen.getByRole('button', { name: /New Project/i })
      await user.click(newProjectButton)

      const nameInput = screen.getByPlaceholderText(/Project name/i)
      const pathInput = screen.getByPlaceholderText(/Project path/i)
      const createButton = screen.getByRole('button', { name: /Create/i })

      await user.type(nameInput, 'New Project')
      await user.type(pathInput, '/new/project')
      await user.click(createButton)

      expect(api.projects.create).toHaveBeenCalledWith({
        name: 'New Project',
        path: '/new/project'
      })
    })

    it('switches between projects', async () => {
      const { user } = renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Test Project 2')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Test Project 2'))

      expect(defaultProps.onProjectChange).toHaveBeenCalledWith('proj-2')
    })

    it('deletes a project', async () => {
      const { api } = require('../../utils/api')
      api.projects.delete.mockResolvedValue({ success: true })

      const { user } = renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Test Project 1')).toBeInTheDocument()
      })

      // Open project menu
      const projectElement = screen.getByText('Test Project 1').closest('div')
      const menuButton = projectElement.querySelector('[data-testid="project-menu"]')
      await user.click(menuButton)

      const deleteButton = screen.getByRole('button', { name: /Delete/i })
      await user.click(deleteButton)

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /Confirm/i })
      await user.click(confirmButton)

      expect(api.projects.delete).toHaveBeenCalledWith('proj-1')
    })
  })

  describe('Session Management', () => {
    it('creates a new session', async () => {
      const { api } = require('../../utils/api')
      api.sessions.create.mockResolvedValue({
        id: 'sess-3',
        project_id: 'proj-1',
        name: 'New Session'
      })

      const { user } = renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Session 1')).toBeInTheDocument()
      })

      const newSessionButton = screen.getByRole('button', { name: /New Session/i })
      await user.click(newSessionButton)

      expect(api.sessions.create).toHaveBeenCalledWith({
        project_id: 'proj-1',
        name: expect.stringContaining('New Session')
      })
    })

    it('switches between sessions', async () => {
      const { user } = renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Session 2')).toBeInTheDocument()
      })

      await user.click(screen.getByText('Session 2'))

      expect(defaultProps.onSessionChange).toHaveBeenCalledWith('sess-2')
    })

    it('shows active session indicator', async () => {
      const propsWithActive = {
        ...defaultProps,
        activeSessions: new Set(['sess-2'])
      }

      renderComponent(propsWithActive)

      await waitFor(() => {
        const activeSession = screen.getByText('Session 2').closest('div')
        expect(activeSession.querySelector('.active-indicator')).toBeInTheDocument()
      })
    })
  })

  describe('Search and Filter', () => {
    it('filters projects by search term', async () => {
      const { user } = renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Test Project 1')).toBeInTheDocument()
        expect(screen.getByText('Test Project 2')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search projects/i)
      await user.type(searchInput, 'Project 1')

      expect(screen.getByText('Test Project 1')).toBeInTheDocument()
      expect(screen.queryByText('Test Project 2')).not.toBeInTheDocument()
    })

    it('shows no results message when search has no matches', async () => {
      const { user } = renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Test Project 1')).toBeInTheDocument()
      })

      const searchInput = screen.getByPlaceholderText(/Search projects/i)
      await user.type(searchInput, 'NonExistent')

      expect(screen.getByText(/No projects found/i)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('shows error message when projects fail to load', async () => {
      const { api } = require('../../utils/api')
      api.projects.list.mockRejectedValue(new Error('Network error'))

      renderComponent()

      await waitFor(() => {
        expect(screen.getByText(/Failed to load projects/i)).toBeInTheDocument()
      })
    })

    it('handles session creation errors gracefully', async () => {
      const { api } = require('../../utils/api')
      api.sessions.create.mockRejectedValue(new Error('Creation failed'))

      const { user } = renderComponent()

      await waitFor(() => {
        expect(screen.getByText('Session 1')).toBeInTheDocument()
      })

      const newSessionButton = screen.getByRole('button', { name: /New Session/i })
      await user.click(newSessionButton)

      await waitFor(() => {
        expect(screen.getByText(/Failed to create session/i)).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Behavior', () => {
    it('collapses sidebar on mobile', () => {
      // Mock mobile viewport
      global.innerWidth = 375
      global.dispatchEvent(new Event('resize'))

      renderComponent()

      const sidebar = screen.getByRole('navigation')
      expect(sidebar).toHaveClass('collapsed')
    })

    it('expands sidebar on desktop', () => {
      // Mock desktop viewport
      global.innerWidth = 1024
      global.dispatchEvent(new Event('resize'))

      renderComponent()

      const sidebar = screen.getByRole('navigation')
      expect(sidebar).not.toHaveClass('collapsed')
    })
  })
})