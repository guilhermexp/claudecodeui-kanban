import { render } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'

// Custom render function that includes commonly needed providers
export function renderWithProviders(ui, options = {}) {
  const { initialEntries = ['/'], ...renderOptions } = options

  function Wrapper({ children }) {
    return (
      <BrowserRouter initialEntries={initialEntries}>
        {children}
      </BrowserRouter>
    )
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Mock WebSocket factory
export function createMockWebSocket(overrides = {}) {
  return {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.OPEN,
    ...overrides
  }
}

// Mock API response factory
export function createMockApiResponse(data, options = {}) {
  const { status = 200, headers = {} } = options
  
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => data,
    text: async () => JSON.stringify(data),
    blob: async () => new Blob([JSON.stringify(data)], { type: 'application/json' })
  }
}

// Wait for async updates
export async function waitForLoadingToFinish() {
  const { waitFor } = await import('@testing-library/react')
  
  await waitFor(() => {
    const loadingElements = document.querySelectorAll('[data-loading="true"]')
    expect(loadingElements.length).toBe(0)
  })
}

// Mock file creator
export function createMockFile(content, name, type = 'text/plain') {
  const file = new File([content], name, { type })
  
  // Add additional properties that might be needed
  Object.defineProperty(file, 'size', { value: content.length })
  Object.defineProperty(file, 'lastModified', { value: Date.now() })
  
  return file
}

// Local storage mock helper
export const localStorageMock = {
  store: {},
  
  getItem(key) {
    return this.store[key] || null
  },
  
  setItem(key, value) {
    this.store[key] = value.toString()
  },
  
  removeItem(key) {
    delete this.store[key]
  },
  
  clear() {
    this.store = {}
  },
  
  reset() {
    this.clear()
  }
}

// Session storage mock helper (same interface as localStorage)
export const sessionStorageMock = { ...localStorageMock }

// Common test data factories
export const testData = {
  createProject: (overrides = {}) => ({
    id: 'test-project-1',
    name: 'Test Project',
    path: '/test/project',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),
  
  createSession: (overrides = {}) => ({
    id: 'test-session-1',
    project_id: 'test-project-1',
    name: 'Test Session',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),
  
  createMessage: (overrides = {}) => ({
    id: 'test-message-1',
    role: 'user',
    content: 'Test message content',
    timestamp: Date.now(),
    ...overrides
  }),
  
  createGitStatus: (overrides = {}) => ({
    branch: 'main',
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    ...overrides
  })
}

// Event helpers
export const fireDropEvent = (element, files) => {
  const { fireEvent } = require('@testing-library/react')
  
  const dataTransfer = {
    files,
    items: files.map(file => ({
      kind: 'file',
      type: file.type,
      getAsFile: () => file
    })),
    types: ['Files']
  }
  
  fireEvent.drop(element, { dataTransfer })
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react'