#!/usr/bin/env node

import { 
  getProjects, 
  getSessions, 
  getProjectManager,
  ProjectError,
  ValidationError
} from './server/projects.js';

console.log('🧪 Testing Refactored Projects Module\n');

async function test() {
  try {
    // Test 1: Get Projects
    console.log('📋 Test 1: Getting projects list...');
    const projects = await getProjects();
    console.log(`✅ Found ${projects.length} projects`);
    
    if (projects.length > 0) {
      console.log(`   First project: ${projects[0].displayName} (${projects[0].path})`);
      console.log(`   Has ${projects[0].sessionMeta?.total || 0} sessions`);
    }
    
    // Test 2: Get Sessions
    if (projects.length > 0) {
      console.log('\n📋 Test 2: Getting sessions for first project...');
      const sessions = await getSessions(projects[0].name, 5, 0);
      console.log(`✅ Found ${sessions.total} total sessions`);
      console.log(`   Showing ${sessions.sessions.length} sessions`);
      
      if (sessions.sessions.length > 0) {
        console.log(`   First session: ${sessions.sessions[0].summary}`);
        console.log(`   Updated: ${sessions.sessions[0].updated_at}`);
      }
    }
    
    // Test 3: Cache Manager
    console.log('\n📋 Test 3: Testing cache manager...');
    const manager = getProjectManager();
    const cacheStats = manager.getCacheStats();
    console.log('✅ Cache statistics:');
    Object.entries(cacheStats).forEach(([key, value]) => {
      console.log(`   ${key}: ${value.size} items cached`);
    });
    
    // Test 4: Validation
    console.log('\n📋 Test 4: Testing input validation...');
    try {
      await getSessions('../../../etc/passwd', 1, 0);
      console.log('❌ Validation failed - should have thrown error');
    } catch (error) {
      if (error instanceof ValidationError) {
        console.log('✅ Validation working - caught path traversal attempt');
      } else {
        console.log('❌ Wrong error type:', error.message);
      }
    }
    
    // Test 5: Performance
    console.log('\n📋 Test 5: Testing performance...');
    const start = Date.now();
    await getProjects(); // Should be cached
    const cached = Date.now() - start;
    
    manager.clearCache();
    const start2 = Date.now();
    await getProjects(); // Fresh load
    const fresh = Date.now() - start2;
    
    console.log(`✅ Cached load: ${cached}ms`);
    console.log(`   Fresh load: ${fresh}ms`);
    console.log(`   Cache speedup: ${Math.round(fresh/cached)}x faster`);
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

test();