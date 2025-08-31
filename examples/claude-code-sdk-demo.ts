/**
 * Claude Code SDK TypeScript Demo
 * Example of using the Claude Code SDK with TypeScript types
 */

import { 
  ClaudeCodeSDK,
  ClaudeOptions,
  ClaudeResponse,
  Tool,
  PermissionMode
} from '@anthropic-ai/claude-code';

interface SessionOptions {
  systemPrompt?: string;
  allowedTools?: Tool[];
  workingDirectory?: string;
  maxTurns?: number;
}

/**
 * Custom wrapper class for Claude Code SDK
 */
class ClaudeCodeClient {
  private sdk: ClaudeCodeSDK;
  
  constructor(options?: ClaudeOptions) {
    this.sdk = new ClaudeCodeSDK(options);
  }
  
  /**
   * Execute a simple query
   */
  async query(prompt: string, options?: SessionOptions): Promise<ClaudeResponse> {
    return await this.sdk.query({
      prompt,
      ...options
    });
  }
  
  /**
   * Execute code analysis
   */
  async analyzeCode(filePath: string): Promise<ClaudeResponse> {
    return await this.sdk.query({
      prompt: `Analyze the code in ${filePath} and provide:
        1. Brief summary of what it does
        2. Any potential issues or improvements
        3. Security considerations if any`,
      allowedTools: ['Read' as Tool],
      maxTurns: 1
    });
  }
  
  /**
   * Generate unit tests for a file
   */
  async generateTests(filePath: string, framework: 'jest' | 'mocha' | 'vitest' = 'jest'): Promise<ClaudeResponse> {
    return await this.sdk.query({
      prompt: `Generate comprehensive unit tests for ${filePath} using ${framework}`,
      allowedTools: ['Read' as Tool, 'Write' as Tool],
      permissionMode: 'acceptEdits' as PermissionMode,
      maxTurns: 2
    });
  }
  
  /**
   * Refactor code with specific improvements
   */
  async refactorCode(
    filePath: string, 
    improvements: string[]
  ): Promise<ClaudeResponse> {
    const improvementsList = improvements.map((i, idx) => `${idx + 1}. ${i}`).join('\n');
    
    return await this.sdk.query({
      prompt: `Refactor the code in ${filePath} with these improvements:\n${improvementsList}`,
      allowedTools: ['Read' as Tool, 'Edit' as Tool],
      permissionMode: 'acceptEdits' as PermissionMode,
      maxTurns: 3
    });
  }
  
  /**
   * Create a complete feature with multiple files
   */
  async createFeature(
    featureName: string,
    description: string,
    tech: string[]
  ): Promise<ClaudeResponse> {
    const techStack = tech.join(', ');
    
    return await this.sdk.query({
      prompt: `Create a complete ${featureName} feature with:
        Description: ${description}
        Tech stack: ${techStack}
        
        Include:
        - Main component/module
        - Tests
        - Documentation
        - Any necessary configuration`,
      allowedTools: ['Write' as Tool, 'Read' as Tool, 'Bash' as Tool],
      permissionMode: 'acceptEdits' as PermissionMode,
      maxTurns: 5
    });
  }
}

/**
 * Example usage of the TypeScript client
 */
async function main() {
  // Initialize the client
  const claude = new ClaudeCodeClient({
    debug: true,
    timeout: 60000
  });
  
  try {
    // Example 1: Simple query
    const simpleResponse = await claude.query('What is TypeScript?');
    
    // Example 2: Analyze existing code
    const analysis = await claude.analyzeCode('./src/App.jsx');
    
    // Example 3: Generate tests
    const tests = await claude.generateTests('./src/utils/helpers.js', 'vitest');
    
    // Example 4: Refactor code
    const refactored = await claude.refactorCode('./src/components/OldComponent.jsx', [
      'Convert to TypeScript',
      'Add proper error handling',
      'Improve performance with memoization',
      'Add JSDoc comments'
    ]);
    
    // Example 5: Create new feature
    const feature = await claude.createFeature(
      'UserAuthentication',
      'Complete user authentication system with login, signup, and password reset',
      ['React', 'TypeScript', 'JWT', 'Express']
    );
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Type-safe error handling
async function safeExecute<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    return null;
  }
}

// Advanced example with error handling
async function advancedExample() {
  const claude = new ClaudeCodeClient();
  
  // Safe execution with type checking
  const result = await safeExecute(
    () => claude.query('Create a TypeScript interface for a User model'),
    'Failed to create interface'
  );
  
  if (result) {
  }
}

// Export for use in other modules
export { ClaudeCodeClient, type SessionOptions };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}