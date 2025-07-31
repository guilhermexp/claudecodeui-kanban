import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import ChatInterface from '../ChatInterface'

// Mock dependencies
vi.mock('../../utils/api', () => ({
  api: {
    chat: {
      send: vi.fn()
    }
  }
}))

vi.mock('../../utils/app-state-persistence', () => ({
  appStatePersistence: {
    markSessionActive: vi.fn(),
    markSessionInactive: vi.fn(),
    replaceActiveSession: vi.fn()
  }
}))

// Mock child components
vi.mock('../TodoList', () => ({
  default: () => <div data-testid="todo-list">TodoList</div>
}))

vi.mock('../ClaudeLogo.jsx', () => ({
  default: () => <div data-testid="claude-logo">ClaudeLogo</div>
}))

vi.mock('../ClaudeStatus', () => ({
  default: () => <div data-testid="claude-status">ClaudeStatus</div>
}))

vi.mock('../MicButton.jsx', () => ({
  MicButton: ({ onTranscription }) => (
    <button data-testid="mic-button" onClick={() => onTranscription('test audio')}>
      Mic
    </button>
  )
}))

describe('ChatInterface', () => {
  const mockWebSocket = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.OPEN
  }

  const defaultProps = {
    projectPath: '/test/project',
    sessionId: 'test-session-123',
    getWebSocket: vi.fn(() => mockWebSocket)
  }

  const renderComponent = (props = {}) => {
    const user = userEvent.setup()
    const utils = render(
      <BrowserRouter>
        <ChatInterface {...defaultProps} {...props} />
      </BrowserRouter>
    )
    return { user, ...utils }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Initial Rendering', () => {
    it('renders the chat interface with all components', () => {
      renderComponent()
      
      expect(screen.getByTestId('claude-logo')).toBeInTheDocument()
      expect(screen.getByTestId('claude-status')).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Type your message/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Send/i })).toBeInTheDocument()
      expect(screen.getByTestId('mic-button')).toBeInTheDocument()
    })

    it('loads messages from localStorage on mount', () => {
      const savedMessages = [
        { role: 'user', content: 'Hello', id: '1' },
        { role: 'assistant', content: 'Hi there!', id: '2' }
      ]
      localStorage.setItem(
        `chat_messages_${defaultProps.projectPath}_${defaultProps.sessionId}`,
        JSON.stringify(savedMessages)
      )

      renderComponent()
      
      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('Hi there!')).toBeInTheDocument()
    })

    it('shows welcome message when no messages exist', () => {
      renderComponent()
      
      expect(screen.getByText(/Welcome to Claude Code UI/i)).toBeInTheDocument()
    })
  })

  describe('Message Sending', () => {
    it('sends a message when submit button is clicked', async () => {
      const { user } = renderComponent()
      const input = screen.getByPlaceholderText(/Type your message/i)
      const sendButton = screen.getByRole('button', { name: /Send/i })

      await user.type(input, 'Test message')
      await user.click(sendButton)

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"content":"Test message"')
      )
      expect(input.value).toBe('')
    })

    it('sends a message when Enter key is pressed', async () => {
      const { user } = renderComponent()
      const input = screen.getByPlaceholderText(/Type your message/i)

      await user.type(input, 'Test message{Enter}')

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"content":"Test message"')
      )
    })

    it('does not send empty messages', async () => {
      const { user } = renderComponent()
      const sendButton = screen.getByRole('button', { name: /Send/i })

      await user.click(sendButton)

      expect(mockWebSocket.send).not.toHaveBeenCalled()
    })

    it('marks session as active when sending message', async () => {
      const { user } = renderComponent()
      const { appStatePersistence } = await import('../../utils/app-state-persistence')
      const input = screen.getByPlaceholderText(/Type your message/i)

      await user.type(input, 'Test message{Enter}')

      expect(appStatePersistence.markSessionActive).toHaveBeenCalledWith(
        defaultProps.sessionId
      )
    })
  })

  describe('File Upload', () => {
    it('handles file drop', async () => {
      renderComponent()
      const dropzone = screen.getByText(/Welcome to Claude Code UI/i).closest('div')
      
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
        types: ['Files']
      }

      fireEvent.drop(dropzone, { dataTransfer })

      await waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          expect.stringContaining('test.txt')
        )
      })
    })

    it('rejects invalid file types', async () => {
      renderComponent()
      const dropzone = screen.getByText(/Welcome to Claude Code UI/i).closest('div')
      
      const file = new File(['test'], 'test.exe', { type: 'application/x-msdownload' })
      const dataTransfer = {
        files: [file],
        items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
        types: ['Files']
      }

      fireEvent.drop(dropzone, { dataTransfer })

      await waitFor(() => {
        expect(mockWebSocket.send).not.toHaveBeenCalled()
      })
    })
  })

  describe('Voice Input', () => {
    it('handles voice transcription', async () => {
      const { user } = renderComponent()
      const micButton = screen.getByTestId('mic-button')

      await user.click(micButton)

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Type your message/i)
        expect(input.value).toBe('test audio')
      })
    })
  })

  describe('WebSocket Events', () => {
    it('handles session-created event', () => {
      renderComponent()
      const { appStatePersistence } = require('../../utils/app-state-persistence')
      
      const handler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')[1]
      
      handler({
        data: JSON.stringify({
          type: 'session-created',
          sessionId: 'new-session-456'
        })
      })

      expect(appStatePersistence.replaceActiveSession).toHaveBeenCalledWith(
        defaultProps.sessionId,
        'new-session-456'
      )
    })

    it('handles claude-complete event', () => {
      renderComponent()
      const { appStatePersistence } = require('../../utils/app-state-persistence')
      
      const handler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')[1]
      
      handler({
        data: JSON.stringify({
          type: 'claude-complete',
          sessionId: defaultProps.sessionId
        })
      })

      expect(appStatePersistence.markSessionInactive).toHaveBeenCalledWith(
        defaultProps.sessionId
      )
    })

    it('handles streaming messages', async () => {
      renderComponent()
      
      const handler = mockWebSocket.addEventListener.mock.calls
        .find(call => call[0] === 'message')[1]
      
      handler({
        data: JSON.stringify({
          type: 'claude-partial',
          content: 'Hello from Claude!'
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Hello from Claude!')).toBeInTheDocument()
      })
    })
  })

  describe('Message Management', () => {
    it('saves messages to localStorage', async () => {
      const { user } = renderComponent()
      const input = screen.getByPlaceholderText(/Type your message/i)

      await user.type(input, 'Test message{Enter}')

      await waitFor(() => {
        const saved = localStorage.getItem(
          `chat_messages_${defaultProps.projectPath}_${defaultProps.sessionId}`
        )
        expect(saved).toBeTruthy()
        const messages = JSON.parse(saved)
        expect(messages).toHaveLength(1)
        expect(messages[0].content).toBe('Test message')
      })
    })

    it('limits stored messages to 50', () => {
      const messages = Array.from({ length: 60 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`
      }))

      localStorage.setItem(
        `chat_messages_${defaultProps.projectPath}_${defaultProps.sessionId}`,
        JSON.stringify(messages)
      )

      renderComponent()

      const saved = localStorage.getItem(
        `chat_messages_${defaultProps.projectPath}_${defaultProps.sessionId}`
      )
      const savedMessages = JSON.parse(saved)
      expect(savedMessages).toHaveLength(50)
      expect(savedMessages[0].content).toBe('Message 10')
    })
  })

  describe('Error Handling', () => {
    it('handles WebSocket connection errors', () => {
      const errorProps = {
        ...defaultProps,
        getWebSocket: vi.fn(() => null)
      }
      
      renderComponent(errorProps)

      expect(screen.getByText(/WebSocket is not connected/i)).toBeInTheDocument()
    })

    it('recovers from localStorage errors', () => {
      const mockError = new Error('QuotaExceededError')
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw mockError
      })

      const { rerender } = renderComponent()
      
      // Should not crash and continue functioning
      expect(screen.getByPlaceholderText(/Type your message/i)).toBeInTheDocument()
      
      vi.restoreAllMocks()
    })
  })
})