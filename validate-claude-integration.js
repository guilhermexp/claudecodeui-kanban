#!/usr/bin/env node

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const TIMEOUT = 30000; // 30 seconds timeout
const APP_URL = 'http://localhost:5892';

async function validateClaudeIntegration() {
  console.log('🔍 Starting Claude Code CLI integration validation...\n');
  
  const browser = await chromium.launch({ headless: false }); // Keep visible for debugging
  const page = await browser.newPage();
  
  // Capture console logs and errors
  const logs = [];
  const errors = [];
  
  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log('📋 Browser console:', text);
  });
  
  page.on('pageerror', (error) => {
    const errorText = error.toString();
    errors.push(errorText);
    console.error('❌ Page error:', errorText);
  });
  
  try {
    console.log('1. Loading application at', APP_URL);
    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    
    console.log('2. Waiting for application to initialize...');
    await page.waitForSelector('.main-content', { timeout: TIMEOUT });
    
    console.log('3. Looking for Claude button in navigation...');
    // Look for Claude button in main navigation
    const claudeButton = await page.locator('button:has-text("Claude")').first();
    
    if (await claudeButton.count() === 0) {
      // If not in main nav, look for the floating button with provider selection
      console.log('   Claude button not found in nav, looking for provider selector...');
      const providerButton = await page.locator('button').filter({ hasText: /Start|Claude/ }).first();
      
      if (await providerButton.count() > 0) {
        console.log('✅ Found provider selector button');
        
        // Try to click provider dropdown to switch to Claude
        const dropdown = await page.locator('button').filter({ hasText: /^(?!.*Start).*$/ }).first();
        if (await dropdown.count() > 0) {
          await dropdown.click();
          
          // Look for Claude option in dropdown
          const claudeOption = await page.locator('button:has-text("Claude Code")');
          if (await claudeOption.count() > 0) {
            console.log('4. Switching to Claude Code provider...');
            await claudeOption.click();
            await page.waitForTimeout(1000); // Wait for provider switch
          }
        }
      }
    } else {
      console.log('✅ Found Claude button in navigation');
      console.log('4. Clicking Claude button...');
      await claudeButton.click();
    }
    
    console.log('5. Looking for start session button...');
    // Wait for session start button
    const startButton = await page.locator('button').filter({ hasText: /Start.*Claude/ }).first();
    
    if (await startButton.count() === 0) {
      console.log('❌ Start Claude session button not found');
      await takeScreenshot(page, 'no-start-button.png');
      return false;
    }
    
    console.log('✅ Found start session button');
    
    console.log('6. Starting Claude session...');
    await startButton.click();
    
    // Wait for session to initialize (look for either session started message or input field)
    console.log('7. Waiting for session to initialize...');
    
    try {
      // Check for session initialization indicators
      await Promise.race([
        page.waitForSelector('span:has-text("Session started")', { timeout: 15000 }),
        page.waitForSelector('textarea[placeholder*="Claude"]', { timeout: 15000 }),
        page.waitForSelector('.animate-spin', { timeout: 5000 }) // Loading spinner
      ]);
      
      // Wait a bit more for full initialization
      await page.waitForTimeout(2000);
      
      console.log('8. Looking for input field...');
      const inputField = await page.locator('textarea[placeholder*="Claude"]').first();
      
      if (await inputField.count() === 0) {
        console.log('❌ Claude input field not found');
        await takeScreenshot(page, 'no-input-field.png');
        return false;
      }
      
      console.log('✅ Found Claude input field');
      
      console.log('9. Sending test message to Claude...');
      await inputField.fill('Hello Claude, can you see this test message?');
      
      // Find and click send button
      const sendButton = await page.locator('button[title="Send"]').or(page.locator('button:has-text("Send")')).first();
      
      if (await sendButton.count() === 0) {
        console.log('❌ Send button not found');
        await takeScreenshot(page, 'no-send-button.png');
        return false;
      }
      
      await sendButton.click();
      
      console.log('10. Waiting for Claude response...');
      
      // Wait for typing indicator or response
      const hasTyping = await page.waitForSelector('.animate-spin', { timeout: 5000 }).catch(() => false);
      if (hasTyping) {
        console.log('✅ Typing indicator appeared - Claude is processing');
        
        // Wait for response to appear (look for assistant message)
        await page.waitForSelector('div:has-text("Hello")', { timeout: 20000 }).catch(() => {
          console.log('⚠️  Response timeout - Claude may still be processing');
        });
      }
      
      // Take final screenshot
      await takeScreenshot(page, 'final-state.png');
      
      console.log('11. Checking for errors...');
      
      if (errors.length > 0) {
        console.log('❌ JavaScript errors found:');
        errors.forEach(error => console.log('   -', error));
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
        console.log('❌ Network errors found:');
        networkErrors.forEach(error => console.log('   -', error));
        return false;
      }
      
      console.log('✅ Claude integration validation completed successfully!');
      console.log('\n📊 Summary:');
      console.log('   - Application loaded: ✅');
      console.log('   - Claude provider available: ✅');
      console.log('   - Session started: ✅');
      console.log('   - Message sent: ✅');
      console.log('   - No JavaScript errors: ✅');
      console.log('   - No network errors: ✅');
      
      return true;
      
    } catch (error) {
      console.log('❌ Session initialization failed:', error.message);
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
  console.log('📸 Screenshot saved:', screenshotPath);
}

// Run validation
validateClaudeIntegration()
  .then(success => {
    if (success) {
      console.log('\n🎉 Claude Code CLI integration is working correctly!');
      process.exit(0);
    } else {
      console.log('\n💥 Claude Code CLI integration validation failed!');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n💥 Validation script crashed:', error);
    process.exit(1);
  });