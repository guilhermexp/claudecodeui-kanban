import { test, expect } from '@playwright/test'

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/')
    const username = `testuser${Date.now()}`
    await page.getByText("Don't have an account? Register").click()
    await page.getByPlaceholder('Username').fill(username)
    await page.getByPlaceholder('Password').fill('TestPass123!')
    await page.getByRole('button', { name: 'Register' }).click()
    await page.waitForURL(/\/app/)
    
    // Create a project
    await page.getByRole('button', { name: 'New Project' }).click()
    await page.getByPlaceholder('Project name').fill('Test Project')
    await page.getByPlaceholder('Project path').fill('/test/project')
    await page.getByRole('button', { name: 'Create' }).click()
    
    // Wait for project creation
    await page.waitForTimeout(1000)
  })

  test('should send and receive chat messages', async ({ page }) => {
    // Type a message
    const messageInput = page.getByPlaceholder(/Type your message/i)
    await messageInput.fill('Hello Claude!')
    
    // Send message
    await page.getByRole('button', { name: 'Send' }).click()
    
    // Check message appears in chat
    await expect(page.getByText('Hello Claude!')).toBeVisible()
    
    // Wait for response (mock or real)
    await expect(page.locator('.assistant-message')).toBeVisible({ timeout: 30000 })
  })

  test('should handle file uploads via drag and drop', async ({ page }) => {
    // Create a test file
    const buffer = Buffer.from('Test file content')
    
    // Simulate file drop
    await page.locator('.chat-container').evaluateHandle(
      async (element, buffer) => {
        const dataTransfer = new DataTransfer()
        const file = new File([buffer], 'test.txt', { type: 'text/plain' })
        dataTransfer.items.add(file)
        
        const dropEvent = new DragEvent('drop', {
          dataTransfer,
          bubbles: true,
          cancelable: true,
        })
        
        element.dispatchEvent(dropEvent)
      },
      buffer
    )
    
    // Check file upload indicator
    await expect(page.getByText('test.txt')).toBeVisible()
  })

  test('should show typing indicator when Claude is responding', async ({ page }) => {
    // Send a message
    await page.getByPlaceholder(/Type your message/i).fill('Test message')
    await page.getByRole('button', { name: 'Send' }).click()
    
    // Check for typing indicator
    await expect(page.locator('.typing-indicator')).toBeVisible()
    
    // Wait for response
    await expect(page.locator('.assistant-message')).toBeVisible({ timeout: 30000 })
    
    // Typing indicator should be gone
    await expect(page.locator('.typing-indicator')).not.toBeVisible()
  })

  test('should preserve chat history on page refresh', async ({ page }) => {
    // Send a message
    await page.getByPlaceholder(/Type your message/i).fill('Remember this message')
    await page.getByRole('button', { name: 'Send' }).click()
    
    // Wait for message to appear
    await expect(page.getByText('Remember this message')).toBeVisible()
    
    // Refresh page
    await page.reload()
    
    // Message should still be there
    await expect(page.getByText('Remember this message')).toBeVisible()
  })

  test('should handle keyboard shortcuts', async ({ page }) => {
    const messageInput = page.getByPlaceholder(/Type your message/i)
    
    // Test Enter to send
    await messageInput.fill('Enter key test')
    await messageInput.press('Enter')
    await expect(page.getByText('Enter key test')).toBeVisible()
    
    // Test Shift+Enter for new line
    await messageInput.fill('Line 1')
    await messageInput.press('Shift+Enter')
    await messageInput.type('Line 2')
    
    // Value should contain newline
    const value = await messageInput.inputValue()
    expect(value).toContain('\n')
  })

  test('should handle voice input', async ({ page }) => {
    // Check if mic button is visible
    const micButton = page.getByRole('button', { name: /mic/i })
    await expect(micButton).toBeVisible()
    
    // Mock browser permissions for audio
    await page.context().grantPermissions(['microphone'])
    
    // Click mic button
    await micButton.click()
    
    // Should show recording indicator
    await expect(page.locator('.recording-indicator')).toBeVisible()
  })

  test('should handle multiple sessions', async ({ page }) => {
    // Send message in first session
    await page.getByPlaceholder(/Type your message/i).fill('Session 1 message')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText('Session 1 message')).toBeVisible()
    
    // Create new session
    await page.getByRole('button', { name: 'New Session' }).click()
    await page.waitForTimeout(500)
    
    // Should not see previous message
    await expect(page.getByText('Session 1 message')).not.toBeVisible()
    
    // Send message in new session
    await page.getByPlaceholder(/Type your message/i).fill('Session 2 message')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText('Session 2 message')).toBeVisible()
    
    // Switch back to first session
    await page.locator('.session-item').first().click()
    
    // Should see first session message, not second
    await expect(page.getByText('Session 1 message')).toBeVisible()
    await expect(page.getByText('Session 2 message')).not.toBeVisible()
  })
})