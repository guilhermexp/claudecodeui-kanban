#!/usr/bin/env node

import { runAuthTests } from './suites/auth.test.js'
import { runProjectsTests } from './suites/projects.test.js'
import { runEnhancerTests } from './suites/prompt-enhancer.test.js'
import { runTTSTests } from './suites/tts.test.js'
import { runWSTests } from './suites/ws.test.js'

async function main() {
  const results = []
  results.push(await runAuthTests())
  results.push(await runEnhancerTests())
  results.push(await runProjectsTests())
  results.push(await runTTSTests())
  results.push(await runWSTests())

  const failed = results.filter(r => !r.success)
  console.log('\nTest Summary:')
  for (const r of results) {
    console.log(`- ${r.name}: ${r.success ? 'PASS' : 'FAIL'}`)
    if (!r.success && r.error) console.log(`  Error: ${r.error}`)
  }

  if (failed.length > 0) {
    process.exit(1)
  }
}

main().catch(err => { console.error(err); process.exit(1) })