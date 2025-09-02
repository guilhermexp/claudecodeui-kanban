import { query } from '@anthropic-ai/claude-code';

console.log('Testing Claude Code SDK query function with async iteration...');

try {
  console.time('Total time');
  
  // The query function returns an async iterable
  const queryResult = query({
    prompt: "What is 2 + 2? Reply in one word only.",
    maxTurns: 1
  });
  
  console.log('Query object created, starting iteration...');
  
  for await (const message of queryResult) {
    console.log('Message received:', message);
  }
  
  console.timeEnd('Total time');
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}