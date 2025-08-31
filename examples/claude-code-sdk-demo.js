/**
 * Claude Code SDK Demo
 * Example of using the Claude Code SDK in JavaScript/TypeScript
 */

import { ClaudeCodeSDK } from '@anthropic-ai/claude-code';

// Initialize the SDK
const claude = new ClaudeCodeSDK({
  // Options can be configured here
  debug: true,
  timeout: 30000
});

/**
 * Example 1: Simple query to Claude
 */
async function simpleQuery() {
  try {
    
    const response = await claude.query({
      prompt: "What is 2 + 2?",
      maxTurns: 1
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Example 2: Query with tool permissions
 */
async function queryWithTools() {
  try {
    
    const response = await claude.query({
      prompt: "List the files in the current directory",
      allowedTools: ['Bash', 'Read'],
      systemPrompt: "You are a helpful coding assistant",
      maxTurns: 1
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Example 3: Interactive session
 */
async function interactiveSession() {
  try {
    
    const session = claude.createSession({
      systemPrompt: "You are a helpful coding assistant",
      allowedTools: ['Read', 'Write', 'Bash'],
      workingDirectory: process.cwd()
    });
    
    // Send a message
    const response1 = await session.send("Create a simple hello.py file");
    
    // Send follow-up
    const response2 = await session.send("Now run the hello.py file");
    
    // Close session
    await session.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Example 4: Streaming responses
 */
async function streamingExample() {
  try {
    
    const stream = await claude.stream({
      prompt: "Write a function to calculate factorial in JavaScript",
      maxTurns: 1
    });
    
    for await (const chunk of stream) {
      process.stdout.write(chunk);
    }
    
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Example 5: Code generation with file operations
 */
async function codeGeneration() {
  try {
    
    const response = await claude.query({
      prompt: `Create a simple React component called Button.jsx that:
        - Has a prop for text
        - Has a prop for onClick handler
        - Uses Tailwind CSS for styling
        - Includes hover effects`,
      allowedTools: ['Write'],
      permissionMode: 'acceptEdits', // Auto-accept file edits
      maxTurns: 1
    });
    
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Main function to run examples
 */
async function main() {
  
  // Choose which example to run
  const example = process.argv[2] || 'simple';
  
  switch(example) {
    case 'simple':
      await simpleQuery();
      break;
    case 'tools':
      await queryWithTools();
      break;
    case 'interactive':
      await interactiveSession();
      break;
    case 'stream':
      await streamingExample();
      break;
    case 'codegen':
      await codeGeneration();
      break;
    default:
  }
}

// Run the demo
main().catch(console.error);