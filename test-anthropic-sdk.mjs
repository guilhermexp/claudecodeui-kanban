import Anthropic from '@anthropic-ai/sdk';

console.log('Testing direct Anthropic SDK...');

// Check if API key is set
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is not set');
  console.log('Please run: export ANTHROPIC_API_KEY=your-api-key');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: apiKey,
});

try {
  console.time('Direct API call');
  
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 50,
    messages: [
      {
        role: 'user',
        content: 'What is 2 + 2? Reply in one word only.'
      }
    ]
  });
  
  console.timeEnd('Direct API call');
  console.log('Response:', message.content[0].text);
  
} catch (error) {
  console.error('Error:', error.message);
}