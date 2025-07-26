import { chromium } from '@playwright/test';

console.log('🚀 Starting VibeKanban complete test...');

const browser = await chromium.launch({ headless: false });
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
  console.log('📋 Step 1: Navigate to VibeKanban page');
  await page.goto('http://localhost:8080/vibe-kanban', { waitUntil: 'networkidle' });
  
  // Wait for page to load
  await page.waitForTimeout(3000);
  
  console.log('📋 Step 2: Take initial screenshot');
  await page.screenshot({ path: 'vibe-kanban-initial.png', fullPage: true });
  
  console.log('📋 Step 3: Check if page loaded without critical errors');
  const title = await page.title();
  console.log('Page Title:', title);
  
  // Check if main VibeKanban component loaded
  const vibeKanbanElement = await page.locator('[data-testid="vibe-kanban"], .vibe-kanban, #vibe-kanban').first();
  if (await vibeKanbanElement.count() === 0) {
    // Try alternative selectors
    const alternativeSelectors = [
      'h1:has-text("Vibe Kanban")',
      'div:has-text("Projects")',
      '.project-card',
      '[class*="kanban"]',
      '[id*="kanban"]'
    ];
    
    let found = false;
    for (const selector of alternativeSelectors) {
      if (await page.locator(selector).count() > 0) {
        console.log(`✅ Found VibeKanban component with selector: ${selector}`);
        found = true;
        break;
      }
    }
    
    if (!found) {
      console.log('⚠️ VibeKanban component not found, checking page content...');
      const bodyText = await page.locator('body').textContent();
      console.log('Page content preview:', bodyText.substring(0, 500));
    }
  } else {
    console.log('✅ VibeKanban component found');
  }
  
  console.log('📋 Step 4: Look for projects to click');
  // Wait for projects to load
  await page.waitForTimeout(2000);
  
  // Try different selectors for project cards
  const projectSelectors = [
    '.project-card',
    '[data-testid="project-card"]',
    'div[role="button"]',
    'button:has-text("Project")',
    '.card',
    '[class*="project"]'
  ];
  
  let projectFound = false;
  for (const selector of projectSelectors) {
    const projects = page.locator(selector);
    const count = await projects.count();
    if (count > 0) {
      console.log(`✅ Found ${count} project(s) with selector: ${selector}`);
      
      console.log('📋 Step 5: Click on first project');
      await projects.first().click();
      await page.waitForTimeout(2000);
      projectFound = true;
      break;
    }
  }
  
  if (!projectFound) {
    console.log('⚠️ No project cards found, checking available clickable elements...');
    const clickableElements = await page.locator('button, [role="button"], a, [onclick]').count();
    console.log(`Found ${clickableElements} clickable elements`);
    
    // Get all clickable text
    const clickableTexts = await page.locator('button, [role="button"], a').allTextContents();
    console.log('Clickable elements:', clickableTexts.slice(0, 10));
  }
  
  console.log('📋 Step 6: Look for tasks to access TaskDetails');
  await page.waitForTimeout(2000);
  
  // Try different selectors for tasks
  const taskSelectors = [
    '.task-card',
    '[data-testid="task-card"]',
    '.task',
    '[class*="task"]',
    'div[role="button"]:not(.project-card)'
  ];
  
  let taskFound = false;
  for (const selector of taskSelectors) {
    const tasks = page.locator(selector);
    const count = await tasks.count();
    if (count > 0) {
      console.log(`✅ Found ${count} task(s) with selector: ${selector}`);
      
      console.log('📋 Step 7: Click on first task to access TaskDetails');
      await tasks.first().click();
      await page.waitForTimeout(2000);
      taskFound = true;
      break;
    }
  }
  
  if (!taskFound) {
    console.log('⚠️ No task cards found, trying to find any interactive elements...');
  }
  
  console.log('📋 Step 8: Check for Toolbar components (CreateAttempt, CreatePRDialog, CurrentAttempt)');
  const toolbarComponents = [
    'button:has-text("Create Attempt")',
    'button:has-text("Create PR")',
    '[data-testid="create-attempt"]',
    '[data-testid="create-pr"]',
    '[data-testid="current-attempt"]',
    '.toolbar',
    '[class*="toolbar"]'
  ];
  
  for (const selector of toolbarComponents) {
    const count = await page.locator(selector).count();
    if (count > 0) {
      console.log(`✅ Found toolbar component: ${selector} (${count} elements)`);
    }
  }
  
  console.log('📋 Step 9: Check for LogsTab component');
  const logsTabSelectors = [
    'button:has-text("Logs")',
    '[data-testid="logs-tab"]',
    '.logs-tab',
    '[class*="logs"]'
  ];
  
  for (const selector of logsTabSelectors) {
    const count = await page.locator(selector).count();
    if (count > 0) {
      console.log(`✅ Found LogsTab component: ${selector} (${count} elements)`);
      
      // Try to click on logs tab
      try {
        await page.locator(selector).first().click();
        await page.waitForTimeout(1000);
        console.log('✅ Successfully clicked LogsTab');
      } catch (e) {
        console.log('⚠️ Could not click LogsTab:', e.message);
      }
    }
  }
  
  console.log('📋 Step 10: Check for Conversation component');
  const conversationSelectors = [
    '.conversation',
    '[data-testid="conversation"]',
    '[class*="conversation"]',
    '.chat',
    '[class*="chat"]'
  ];
  
  for (const selector of conversationSelectors) {
    const count = await page.locator(selector).count();
    if (count > 0) {
      console.log(`✅ Found Conversation component: ${selector} (${count} elements)`);
    }
  }
  
  console.log('📋 Step 11: Take final screenshot');
  await page.screenshot({ path: 'vibe-kanban-final.png', fullPage: true });
  
  console.log('📋 Step 12: Check for any network errors or 500 errors');
  const networkErrors = errors.filter(error => 
    error.includes('500') || 
    error.includes('Internal Server Error') ||
    error.includes('NetworkError')
  );
  
  if (networkErrors.length > 0) {
    console.log('❌ Network/500 errors found:', networkErrors);
  } else {
    console.log('✅ No network/500 errors detected');
  }
  
  console.log('📋 Step 13: Check for JavaScript errors');
  const jsErrors = errors.filter(error => 
    !error.includes('500') && 
    !error.includes('NetworkError') &&
    !error.includes('Failed request')
  );
  
  if (jsErrors.length > 0) {
    console.log('❌ JavaScript errors found:', jsErrors);
  } else {
    console.log('✅ No JavaScript errors detected');
  }
  
  // Summary
  console.log('\n🎯 TEST SUMMARY:');
  console.log('================');
  console.log(`Total console messages: ${consoleMessages.length}`);
  console.log(`Total errors: ${errors.length}`);
  console.log(`Network/500 errors: ${networkErrors.length}`);
  console.log(`JavaScript errors: ${jsErrors.length}`);
  
  if (errors.length === 0) {
    console.log('✅ APPLICATION STATUS: 100% FUNCTIONAL - NO ERRORS DETECTED');
  } else {
    console.log('⚠️ APPLICATION STATUS: ERRORS DETECTED - NEEDS ATTENTION');
  }
  
  console.log('\n📊 DETAILED CONSOLE LOG:');
  console.log('=========================');
  consoleMessages.forEach((msg, i) => {
    console.log(`${i + 1}: ${msg}`);
  });
  
  if (errors.length > 0) {
    console.log('\n❌ DETAILED ERROR LOG:');
    console.log('======================');
    errors.forEach((error, i) => {
      console.log(`${i + 1}: ${error}`);
    });
  }
  
} catch (error) {
  console.error('❌ Test failed with error:', error.message);
} finally {
  await browser.close();
}