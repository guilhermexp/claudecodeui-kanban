import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login form when not authenticated', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Login')
    await expect(page.getByPlaceholder('Username')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible()
  })

  test('should register a new user', async ({ page }) => {
    // Click register link
    await page.getByText("Don't have an account? Register").click()
    
    // Fill registration form
    const username = `testuser${Date.now()}`
    await page.getByPlaceholder('Username').fill(username)
    await page.getByPlaceholder('Password').fill('TestPass123!')
    
    // Submit form
    await page.getByRole('button', { name: 'Register' }).click()
    
    // Should redirect to main app
    await expect(page).toHaveURL(/\/app/)
    await expect(page.getByText('Claude Code UI')).toBeVisible()
  })

  test('should login with valid credentials', async ({ page }) => {
    // Create test user first
    const username = `testuser${Date.now()}`
    await page.getByText("Don't have an account? Register").click()
    await page.getByPlaceholder('Username').fill(username)
    await page.getByPlaceholder('Password').fill('TestPass123!')
    await page.getByRole('button', { name: 'Register' }).click()
    
    // Wait for registration to complete
    await page.waitForURL(/\/app/)
    
    // Logout
    await page.getByRole('button', { name: 'Logout' }).click()
    
    // Login again
    await page.getByPlaceholder('Username').fill(username)
    await page.getByPlaceholder('Password').fill('TestPass123!')
    await page.getByRole('button', { name: 'Login' }).click()
    
    // Should be logged in
    await expect(page).toHaveURL(/\/app/)
  })

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByPlaceholder('Username').fill('invaliduser')
    await page.getByPlaceholder('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Login' }).click()
    
    await expect(page.getByText(/Invalid credentials/i)).toBeVisible()
  })

  test('should logout successfully', async ({ page }) => {
    // Register and login
    const username = `testuser${Date.now()}`
    await page.getByText("Don't have an account? Register").click()
    await page.getByPlaceholder('Username').fill(username)
    await page.getByPlaceholder('Password').fill('TestPass123!')
    await page.getByRole('button', { name: 'Register' }).click()
    
    await page.waitForURL(/\/app/)
    
    // Logout
    await page.getByRole('button', { name: 'Logout' }).click()
    
    // Should redirect to login
    await expect(page).toHaveURL('/')
    await expect(page.locator('h2')).toContainText('Login')
  })

  test('should persist authentication on page refresh', async ({ page }) => {
    // Register and login
    const username = `testuser${Date.now()}`
    await page.getByText("Don't have an account? Register").click()
    await page.getByPlaceholder('Username').fill(username)
    await page.getByPlaceholder('Password').fill('TestPass123!')
    await page.getByRole('button', { name: 'Register' }).click()
    
    await page.waitForURL(/\/app/)
    
    // Refresh page
    await page.reload()
    
    // Should still be logged in
    await expect(page).toHaveURL(/\/app/)
    await expect(page.getByText('Claude Code UI')).toBeVisible()
  })
})