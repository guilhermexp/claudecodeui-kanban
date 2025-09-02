import { query } from '@anthropic-ai/claude-code';

console.log('Testing Claude Code SDK query function...');

try {
  console.time('Query time');
  const response = await query({
    prompt: "What is 2 + 2?",
    maxTurns: 1
  });
  console.timeEnd('Query time');
  console.log('Response:', response);
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}