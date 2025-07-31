import { test, expect, devices } from '@playwright/test'

// Test mobile-specific functionality
test.use({ ...devices['iPhone 12'] })

test.describe('Mobile Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    
    // Register and login
    const username = `mobileuser${Date.now()}`
    await page.getByText("Don't have an account? Register").click()
    await page.getByPlaceholder('Username').fill(username)
    await page.getByPlaceholder('Password').fill('TestPass123!')
    await page.getByRole('button', { name: 'Register' }).click()
    await page.waitForURL(/\/app/)
  })

  test('should show mobile navigation', async ({ page }) => {
    // Bottom navigation should be visible on mobile
    const bottomNav = page.locator('.bottom-navigation')
    await expect(bottomNav).toBeVisible()
    
    // Check navigation items
    await expect(bottomNav.getByRole('button', { name: /Chat/i })).toBeVisible()
    await expect(bottomNav.getByRole('button', { name: /Terminal/i })).toBeVisible()
    await expect(bottomNav.getByRole('button', { name: /Files/i })).toBeVisible()
    await expect(bottomNav.getByRole('button', { name: /Git/i })).toBeVisible()
    await expect(bottomNav.getByRole('button', { name: /Vibe/i })).toBeVisible()
  })

  test('should toggle sidebar with hamburger menu', async ({ page }) => {
    // Sidebar should be hidden by default on mobile
    const sidebar = page.locator('.sidebar')
    await expect(sidebar).not.toBeVisible()
    
    // Click hamburger menu
    await page.getByRole('button', { name: /menu/i }).click()
    
    // Sidebar should slide in
    await expect(sidebar).toBeVisible()
    
    // Click overlay to close
    await page.locator('.sidebar-overlay').click()
    await expect(sidebar).not.toBeVisible()
  })

  test('should handle touch gestures for chat', async ({ page }) => {
    // Navigate to chat
    await page.getByRole('button', { name: /Chat/i }).click()
    
    // Simulate swipe down to refresh (pull-to-refresh)
    const chatContainer = page.locator('.chat-messages')
    await chatContainer.evaluate(element => {
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientY: 100 }],
        bubbles: true
      })
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientY: 200 }],
        bubbles: true
      })
      const touchEnd = new TouchEvent('touchend', {
        bubbles: true
      })
      
      element.dispatchEvent(touchStart)
      element.dispatchEvent(touchMove)
      element.dispatchEvent(touchEnd)
    })
    
    // Should show refresh indicator
    await expect(page.locator('.refresh-indicator')).toBeVisible()
  })

  test('should optimize input for mobile keyboards', async ({ page }) => {
    // Navigate to chat
    await page.getByRole('button', { name: /Chat/i }).click()
    
    const messageInput = page.getByPlaceholder(/Type your message/i)
    
    // Check input has proper mobile attributes
    await expect(messageInput).toHaveAttribute('autocomplete', 'off')
    await expect(messageInput).toHaveAttribute('autocorrect', 'off')
    await expect(messageInput).toHaveAttribute('autocapitalize', 'sentences')
    
    // Focus should bring up keyboard and adjust viewport
    await messageInput.click()
    
    // Input area should be visible above keyboard
    await expect(messageInput).toBeInViewport()
  })

  test('should handle mobile file selection', async ({ page }) => {
    // Navigate to chat
    await page.getByRole('button', { name: /Chat/i }).click()
    
    // File input should accept mobile-specific attributes
    const fileInput = page.locator('input[type="file"]')
    
    // Check for camera/gallery access
    await expect(fileInput).toHaveAttribute('accept', /image/)
    await expect(fileInput).toHaveAttribute('capture')
  })

  test('should adapt terminal for mobile', async ({ page }) => {
    // Navigate to terminal
    await page.getByRole('button', { name: /Terminal/i }).click()
    
    // Terminal should be visible
    await expect(page.locator('.terminal-container')).toBeVisible()
    
    // Should have mobile-optimized controls
    await expect(page.getByRole('button', { name: /keyboard/i })).toBeVisible()
    
    // Virtual keyboard button
    const keyboardButton = page.getByRole('button', { name: /keyboard/i })
    await keyboardButton.click()
    
    // Should show terminal input
    await expect(page.locator('.terminal-input')).toBeVisible()
  })

  test('should handle orientation changes', async ({ page, context }) => {
    // Start in portrait
    await page.setViewportSize({ width: 390, height: 844 })
    
    // Check layout
    await expect(page.locator('.bottom-navigation')).toBeVisible()
    
    // Switch to landscape
    await page.setViewportSize({ width: 844, height: 390 })
    
    // Layout should adapt
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('.bottom-navigation')).not.toBeVisible()
  })

  test('should show mobile-specific settings', async ({ page }) => {
    // Open hamburger menu
    await page.getByRole('button', { name: /menu/i }).click()
    
    // Navigate to settings
    await page.getByRole('button', { name: /Settings/i }).click()
    
    // Should have mobile-specific options
    await expect(page.getByText(/Mobile Layout/i)).toBeVisible()
    await expect(page.getByText(/Touch Gestures/i)).toBeVisible()
    await expect(page.getByText(/Haptic Feedback/i)).toBeVisible()
  })
})