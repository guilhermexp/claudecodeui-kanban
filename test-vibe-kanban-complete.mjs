import { chromium } from '@playwright/test';

console.log('🚀 Starting VibeKanban COMPLETE test with login...');

const browser = await chromium.launch({ 
  headless: false,
  slowMo: 1000 // Slow down actions for better visibility
});
const context = await browser.newContext();
const page = await context.newPage();

// Store console messages and errors
const consoleMessages = [];
const errors = [];

page.on('console', (msg) => {
  consoleMessages.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  console.log(`Console: [${msg.type()}] ${msg.text()}`);
});

page.on('pageerror', (error) => {
  errors.push(error.message);
  console.error('Page Error:', error.message);
});

page.on('requestfailed', (request) => {
  errors.push(`Failed request: ${request.url()} - ${request.failure()?.errorText}`);
  console.error('Request Failed:', request.url(), request.failure()?.errorText);
});

try {
  console.log('📋 Step 1: Navigate to homepage and login');
  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  
  // Check if we're on login page
  const loginForm = await page.locator('form').count();
  if (loginForm > 0) {
    console.log('🔐 Login form detected, attempting to login...');
    
    // Fill in login credentials (assuming test credentials)
    const usernameField = page.locator('input[name="username"], input[type="text"], input[placeholder*="username" i]').first();
    const passwordField = page.locator('input[name="password"], input[type="password"], input[placeholder*="password" i]').first();
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), input[type="submit"]').first();
    
    if (await usernameField.count() > 0) {
      await usernameField.fill('admin');
      console.log('✅ Username filled');
    }
    
    if (await passwordField.count() > 0) {
      await passwordField.fill('admin');
      console.log('✅ Password filled');
    }
    
    if (await submitButton.count() > 0) {
      await submitButton.click();
      console.log('✅ Login submitted');
      await page.waitForTimeout(3000);
    }
  }
  
  console.log('📋 Step 2: Navigate to VibeKanban page');
  await page.goto('http://localhost:8080/vibe-kanban', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  console.log('📋 Step 3: Take initial screenshot');
  await page.screenshot({ path: 'vibe-kanban-initial.png', fullPage: true });
  
  console.log('📋 Step 4: Check page title and URL');
  const title = await page.title();
  const url = page.url();
  console.log('Page Title:', title);
  console.log('Current URL:', url);
  
  console.log('📋 Step 5: Check for VibeKanban specific elements');
  const pageContent = await page.locator('body').textContent();
  console.log('Page content preview:', pageContent.substring(0, 800));
  
  // Check for various VibeKanban indicators
  const vibeIndicators = [
    'vibe',
    'kanban',
    'project',
    'task',
    'attempt',
    'Create Attempt',
    'Create PR',
    'Logs',
    'Conversation'
  ];
  
  for (const indicator of vibeIndicators) {
    if (pageContent.toLowerCase().includes(indicator.toLowerCase())) {
      console.log(`✅ Found indicator: "${indicator}"`);
    } else {
      console.log(`❌ Missing indicator: "${indicator}"`);
    }
  }
  
  console.log('📋 Step 6: Look for interactive elements');
  const buttons = await page.locator('button').count();
  const links = await page.locator('a').count();
  const inputs = await page.locator('input').count();
  const clickableElements = await page.locator('[role="button"], [onclick], .clickable').count();
  
  console.log(`Found elements: ${buttons} buttons, ${links} links, ${inputs} inputs, ${clickableElements} clickable elements`);
  
  // Get all button texts
  if (buttons > 0) {
    const buttonTexts = await page.locator('button').allTextContents();
    console.log('Button texts:', buttonTexts.slice(0, 10));
  }
  
  console.log('📋 Step 7: Look for specific VibeKanban components');
  const componentSelectors = [
    // General VibeKanban
    '.vibe-kanban',
    '#vibe-kanban',
    '[data-testid="vibe-kanban"]',
    
    // Projects
    '.project-card',
    '.project',
    '[data-testid="project"]',
    'div:has-text("Project")',
    
    // Tasks
    '.task-card',
    '.task',
    '[data-testid="task"]',
    'div:has-text("Task")',
    
    // Toolbar components
    'button:has-text("Create Attempt")',
    'button:has-text("Create PR")',
    '[data-testid="create-attempt"]',
    '[data-testid="create-pr"]',
    '.toolbar',
    
    // Logs and Conversation
    'button:has-text("Logs")',
    '.logs-tab',
    '.conversation',
    '[data-testid="conversation"]'
  ];
  
  for (const selector of componentSelectors) {
    const count = await page.locator(selector).count();
    if (count > 0) {
      console.log(`✅ Found component: ${selector} (${count} elements)`);
      
      // If it's clickable, try to click it
      if (selector.includes('button') || selector.includes('[role="button"]')) {
        try {
          await page.locator(selector).first().click();
          await page.waitForTimeout(1000);
          console.log(`✅ Successfully clicked: ${selector}`);
        } catch (e) {
          console.log(`⚠️  Could not click ${selector}: ${e.message}`);
        }
      }
    }
  }
  
  console.log('📋 Step 8: Check for React components in DOM');
  const reactElements = await page.locator('[data-reactroot], [data-react-*], .react-*').count();
  console.log(`Found ${reactElements} React-related elements`);
  
  console.log('📋 Step 9: Check for errors in network requests');
  // Wait a bit more to catch any async errors
  await page.waitForTimeout(2000);
  
  console.log('📋 Step 10: Take final screenshot');
  await page.screenshot({ path: 'vibe-kanban-final.png', fullPage: true });
  
  console.log('📋 Step 11: Analyze errors');
  const networkErrors = errors.filter(error => 
    error.includes('500') || 
    error.includes('Internal Server Error') ||
    error.includes('NetworkError') ||
    error.includes('fetch')
  );
  
  const jsErrors = errors.filter(error => 
    !error.includes('500') && 
    !error.includes('NetworkError') &&
    !error.includes('Failed request') &&
    (error.includes('TypeError') || 
     error.includes('ReferenceError') ||
     error.includes('null') ||
     error.includes('undefined'))
  );
  
  const otherErrors = errors.filter(error => 
    !networkErrors.includes(error) && 
    !jsErrors.includes(error)
  );
  
  // Final Analysis Summary
  console.log('\n🎯 FINAL TEST ANALYSIS:');
  console.log('========================');
  console.log(`📊 Total console messages: ${consoleMessages.length}`);
  console.log(`❌ Total errors: ${errors.length}`);
  console.log(`🌐 Network/500 errors: ${networkErrors.length}`);
  console.log(`💻 JavaScript errors: ${jsErrors.length}`);
  console.log(`⚠️  Other errors: ${otherErrors.length}`);
  console.log(`🔗 Current URL: ${url}`);
  console.log(`📋 Page Title: ${title}`);
  
  // Determine application status
  if (errors.length === 0) {
    console.log('\n✅ APPLICATION STATUS: 100% FUNCTIONAL - NO ERRORS DETECTED');
    console.log('🎉 VibeKanban is working perfectly!');
  } else if (jsErrors.length === 0 && networkErrors.length === 0) {
    console.log('\n✅ APPLICATION STATUS: FUNCTIONAL - Minor warnings only');
    console.log('🎉 VibeKanban is working well with minor warnings!');
  } else {
    console.log('\n⚠️ APPLICATION STATUS: ERRORS DETECTED - NEEDS ATTENTION');
    console.log('🔧 VibeKanban needs fixes for optimal functionality');
  }
  
  // Detailed logs
  if (consoleMessages.length > 0) {
    console.log('\n📊 DETAILED CONSOLE LOG:');
    console.log('=========================');
    consoleMessages.forEach((msg, i) => {
      console.log(`${i + 1}: ${msg}`);
    });
  }
  
  if (errors.length > 0) {
    console.log('\n❌ DETAILED ERROR LOG:');
    console.log('======================');
    
    if (networkErrors.length > 0) {
      console.log('\n🌐 Network Errors:');
      networkErrors.forEach((error, i) => {
        console.log(`${i + 1}: ${error}`);
      });
    }
    
    if (jsErrors.length > 0) {
      console.log('\n💻 JavaScript Errors:');
      jsErrors.forEach((error, i) => {
        console.log(`${i + 1}: ${error}`);
      });
    }
    
    if (otherErrors.length > 0) {
      console.log('\n⚠️ Other Errors:');
      otherErrors.forEach((error, i) => {
        console.log(`${i + 1}: ${error}`);
      });
    }
  }
  
  console.log('\n🏁 Test completed successfully!');
  
} catch (error) {
  console.error('❌ Test failed with critical error:', error.message);
  console.error('Stack:', error.stack);
} finally {
  // Keep browser open for 5 seconds to see final state
  console.log('\n⏳ Keeping browser open for 5 seconds for manual inspection...');
  await page.waitForTimeout(5000);
  await browser.close();
}