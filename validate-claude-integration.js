#!/usr/bin/env node

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TIMEOUT = 30000; // 30 seconds timeout
const APP_URL = 'http://localhost:5892';

async function validateClaudeIntegration() {
  
  const browser = await chromium.launch({ headless: false }); // Keep visible for debugging
  const page = await browser.newPage();
  
  // Capture console logs and errors
  const logs = [];
  const errors = [];
  
  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
  });
  
  page.on('pageerror', (error) => {
    const errorText = error.toString();
    errors.push(errorText);
    console.error('❌ Page error:', errorText);
  });
  
  try {
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    
    await page.waitForSelector('.main-content', { timeout: TIMEOUT });
    
    // Look for Claude button in main navigation
    const claudeButton = await page.locator('button:has-text("Claude")').first();
    
    if (await claudeButton.count() === 0) {
      // If not in main nav, look for the floating button with provider selection
      const providerButton = await page.locator('button').filter({ hasText: /Start|Claude/ }).first();
      
      if (await providerButton.count() > 0) {
        
        // Try to click provider dropdown to switch to Claude
        const dropdown = await page.locator('button').filter({ hasText: /^(?!.*Start).*$/ }).first();
        if (await dropdown.count() > 0) {
          await dropdown.click();
          
          // Look for Claude option in dropdown
          const claudeOption = await page.locator('button:has-text("Claude Code")');
          if (await claudeOption.count() > 0) {
            await claudeOption.click();
            await page.waitForTimeout(1000); // Wait for provider switch
          }
        }
      }
    } else {
      await claudeButton.click();
    }
    
    // Wait for session start button
    const startButton = await page.locator('button').filter({ hasText: /Start.*Claude/ }).first();
    
    if (await startButton.count() === 0) {
      await takeScreenshot(page, 'no-start-button.png');
      return false;
    }
    
    
    await startButton.click();
    
    // Wait for session to initialize (look for either session started message or input field)
    
    try {
      // Check for session initialization indicators
      await Promise.race([
        page.waitForSelector('span:has-text("Session started")', { timeout: 15000 }),
        page.waitForSelector('textarea[placeholder*="Claude"]', { timeout: 15000 }),
        page.waitForSelector('.animate-spin', { timeout: 5000 }) // Loading spinner
      ]);
      
      // Wait a bit more for full initialization
      await page.waitForTimeout(2000);
      
      const inputField = await page.locator('textarea[placeholder*="Claude"]').first();
      
      if (await inputField.count() === 0) {
        await takeScreenshot(page, 'no-input-field.png');
        return false;
      }
      
      
      await inputField.fill('Hello Claude, can you see this test message?');
      
      // Find and click send button
      const sendButton = await page.locator('button[title="Send"]').or(page.locator('button:has-text("Send")')).first();
      
      if (await sendButton.count() === 0) {
        await takeScreenshot(page, 'no-send-button.png');
        return false;
      }
      
      await sendButton.click();
      
      
      // Wait for typing indicator or response
      const hasTyping = await page.waitForSelector('.animate-spin', { timeout: 5000 }).catch(() => false);
      if (hasTyping) {
        
        // Wait for response to appear (look for assistant message)
        await page.waitForSelector('div:has-text("Hello")', { timeout: 20000 }).catch(() => {
        });
      }
      
      // Take final screenshot
      await takeScreenshot(page, 'final-state.png');
      
      
      if (errors.length > 0) {
        return false;
      }
      
      // Check for network errors in console
      const networkErrors = logs.filter(log => 
        log.includes('404') || 
        log.includes('500') || 
        log.includes('Failed to fetch') ||
        log.includes('ERR_')
      );
      
      if (networkErrors.length > 0) {
        return false;
      }
      
      
      return true;
      
    } catch (error) {
      await takeScreenshot(page, 'session-init-failed.png');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    await takeScreenshot(page, 'validation-failed.png');
    return false;
  } finally {
    await browser.close();
  }
}

async function takeScreenshot(page, filename) {
  const screenshotPath = path.join(process.cwd(), '.playwright-mcp', filename);
  await fs.promises.mkdir(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });
}

// Run validation
validateClaudeIntegration()
  .then(success => {
    if (success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Validation script crashed:', error);
    process.exit(1);
  });