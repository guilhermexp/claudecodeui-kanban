import express from 'express';
import fetch from 'node-fetch';
import { createLogger } from '../utils/logger.js';

const log = createLogger('PROMPT-ENHANCER');
const router = express.Router();

// Enhanced prompt templates for different modes
const enhancementTemplates = {
  standard: {
    name: 'Standard Enhancement',
    systemPrompt: `You are an expert prompt engineer. Transform the user's input into a clear, structured, and actionable prompt.

IMPORTANT: Output ONLY the enhanced prompt. No explanations, no markdown code blocks, no prefixes like "Here's the enhanced prompt:".

Structure the output as:
## Objective
[Clear, specific goal]

## Context
[Relevant background information]

## Requirements
- [Specific requirement 1]
- [Specific requirement 2]
- [Additional requirements...]

## Approach
1. [Step 1]
2. [Step 2]
3. [Additional steps...]

## Success Criteria
- [Measurable outcome 1]
- [Measurable outcome 2]

Make the prompt self-contained and immediately actionable.`
  },
  
  implementation: {
    name: 'Code Implementation',
    systemPrompt: `You are a senior software architect. Transform the input into a technical implementation prompt.

IMPORTANT: Output ONLY the enhanced prompt. No explanations, no code blocks unless part of the prompt itself.

Structure as:
## Implementation Task
[Clear technical objective]

## Technical Requirements
- Language/Framework: [Specify]
- Architecture: [Pattern/approach]
- Dependencies: [List if any]

## Implementation Steps
1. [Technical step 1]
2. [Technical step 2]
3. [Additional steps...]

## Code Structure
[Brief outline of classes/modules/functions]

## Testing Strategy
- Unit tests: [What to test]
- Integration: [Key flows]

## Acceptance Criteria
- [Technical criteria 1]
- [Performance requirements]
- [Quality metrics]`
  },
  
  debug: {
    name: 'Debug & Fix',
    systemPrompt: `You are a debugging expert. Transform the input into a systematic debugging prompt.

IMPORTANT: Output ONLY the enhanced prompt. No explanations or additional commentary.

Structure as:
## Issue Description
[Clear problem statement]

## Symptoms
- [Observable symptom 1]
- [Observable symptom 2]

## Expected vs Actual
- Expected: [What should happen]
- Actual: [What is happening]

## Debugging Steps
1. [Investigation step 1]
2. [Investigation step 2]
3. [Additional steps...]

## Potential Causes
- [Hypothesis 1]
- [Hypothesis 2]

## Fix Validation
- [How to verify the fix]
- [Regression tests needed]`
  },
  
  creative: {
    name: 'Creative & Design',
    systemPrompt: `You are a creative director and UX expert. Transform the input into a creative/design prompt.

IMPORTANT: Output ONLY the enhanced prompt. No explanations or preamble.

Structure as:
## Creative Brief
[Core concept/vision]

## Target Outcome
[What we're creating and why]

## Design Principles
- [Principle 1]
- [Principle 2]

## Creative Direction
- Style: [Visual/written style]
- Tone: [Voice and mood]
- Inspiration: [References]

## Deliverables
1. [Deliverable 1]
2. [Deliverable 2]

## Success Metrics
- [How to measure success]
- [User impact]`
  }
};

function buildSystemPrompt(mode, customSystem) {
  // Use template system prompt or custom
  const template = enhancementTemplates[mode] || enhancementTemplates.standard;
  
  if (customSystem && customSystem.trim()) {
    return customSystem;
  }
  
  return template.systemPrompt;
}

// Enhanced local fallback with mode-specific intelligence
function enhanceLocally(input, mode) {
  const template = enhancementTemplates[mode] || enhancementTemplates.standard;
  
  // Smart local enhancement based on mode
  const lines = input.split('\n').filter(Boolean);
  const firstLine = lines[0] || input;
  
  switch (mode) {
    case 'implementation':
      return `## Implementation Task
${input}

## Technical Requirements
- Language/Framework: Node.js with Express or framework of choice
- Architecture: MVC pattern with service layer
- Database: PostgreSQL or MongoDB
- Dependencies: Minimal, production-ready packages only

## Implementation Steps
1. Set up project structure and dependencies
2. Design database schema and models
3. Implement business logic in service layer
4. Create REST API endpoints or GraphQL schema
5. Add input validation and error handling
6. Implement authentication and authorization
7. Write comprehensive tests
8. Add logging and monitoring
9. Document API and setup instructions

## Code Structure
\`\`\`
src/
├── models/       # Data models
├── services/     # Business logic
├── controllers/  # Request handlers
├── middleware/   # Auth, validation, error handling
├── routes/       # API routes
├── utils/        # Helper functions
└── tests/        # Test suites
\`\`\`

## Testing Strategy
- Unit tests: All services and utilities (80% coverage minimum)
- Integration tests: API endpoints and database operations
- E2E tests: Critical user flows
- Performance tests: Load testing for key endpoints

## Acceptance Criteria
- All tests passing with >80% coverage
- API documented with OpenAPI/Swagger
- Security best practices implemented (OWASP Top 10)
- Performance: <200ms response time for 95% of requests
- Scalable architecture supporting horizontal scaling`;

    case 'debug':
      return `## Issue Description
${input}

## Symptoms
- Issue manifests when: [Describe conditions]
- Frequency: [Always/Sometimes/Rarely]
- Environment: [Development/Production/Specific conditions]
- Error messages: [Any console errors or logs]

## Expected vs Actual
- Expected: System should function normally without errors
- Actual: ${input}

## Debugging Steps
1. Reproduce the issue consistently
   - Steps to reproduce
   - Environment setup needed
2. Check error logs and console output
   - Application logs
   - System logs
   - Browser console (if applicable)
3. Isolate the problem area
   - Identify the component/module
   - Find the specific function/method
4. Test with different inputs/conditions
   - Edge cases
   - Different data types
   - Boundary conditions
5. Review recent changes
   - Git history
   - Dependency updates
   - Configuration changes

## Potential Causes
- Logic error in implementation
- Missing edge case handling
- Race condition or timing issue
- External dependency failure
- Configuration or environment issue
- Data corruption or invalid state

## Fix Validation
- Issue no longer reproducible
- All existing tests still pass
- New test covers this specific case
- No performance regression
- No new errors introduced`;

    case 'creative':
      return `## Creative Brief
${input}

## Target Outcome
Create an innovative solution that addresses the user's needs while providing an exceptional experience

## Design Principles
- User-Centered: Focus on user needs and pain points
- Simplicity: Clean, intuitive, and easy to understand
- Accessibility: Inclusive design for all users
- Consistency: Coherent visual language and interactions
- Innovation: Fresh approach while maintaining usability

## Creative Direction
- Style: Modern, clean, and professional
- Tone: Friendly, helpful, and encouraging
- Color Palette: Harmonious and purposeful
- Typography: Clear hierarchy and readability
- Interactions: Smooth, responsive, and delightful

## Deliverables
1. Concept designs and wireframes
2. High-fidelity mockups
3. Interactive prototype
4. Design system documentation
5. Implementation guidelines

## Success Metrics
- User satisfaction score >4.5/5
- Task completion rate >90%
- Time to complete primary task reduced by 30%
- Accessibility score WCAG 2.1 AA compliant
- Positive user feedback on aesthetics and usability`;

    default: // standard
      return `## Objective
${input}

## Context
This request requires a comprehensive solution that addresses all aspects of the problem while maintaining high quality standards.

## Requirements
- Complete understanding of the problem domain
- Systematic approach to solution development
- High-quality, maintainable output
- Proper documentation and testing
- Security and performance considerations

## Approach
1. Analyze requirements thoroughly
   - Understand the problem
   - Identify constraints
   - Define success criteria
2. Design the solution
   - Architecture planning
   - Technology selection
   - Risk assessment
3. Implement step by step
   - Core functionality first
   - Iterative improvements
   - Continuous testing
4. Validate and refine
   - Test all scenarios
   - Performance optimization
   - Security review
5. Document and deliver
   - User documentation
   - Technical documentation
   - Deployment guide

## Success Criteria
- All functional requirements met
- Solution is robust and scalable
- Code is clean and maintainable
- Comprehensive test coverage
- Documentation is complete and clear
- Performance meets or exceeds expectations`;
  }
}

// POST /api/prompt-enhancer/enhance
router.post('/enhance', async (req, res) => {
  const { 
    input, 
    mode = 'standard', 
    format = 'text',
    system = '',
    temperature = 0.7,
    useAPI = true 
  } = req.body || {};
  
  if (!input || !input.trim()) {
    return res.status(400).json({ error: 'Input is required' });
  }

  // Check for Gemini API key first, then OpenAI
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!geminiKey && !openaiKey) {
    log.info('No API keys available, using enhanced local generation');
    const enhanced = enhanceLocally(input, mode);
    return res.json({ 
      output: enhanced, 
      mode,
      format,
      provider: 'local'
    });
  }

  // Use Gemini API if available
  if (geminiKey) {
    try {
      log.info('Using Gemini API for prompt enhancement');
      const systemPrompt = buildSystemPrompt(mode, system);
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt + '\n\nUser Input:\n' + input }
            ]
          }],
          generationConfig: {
            temperature,
            maxOutputTokens: 2000,
            topP: 0.95,
            topK: 40
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const output = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (output) {
          log.info('Gemini API response received successfully');
          return res.json({ 
            output,
            mode,
            format,
            provider: 'gemini',
            model
          });
        }
      } else {
        const error = await response.text();
        log.error(`Gemini API error: ${error}`);
      }
    } catch (error) {
      log.error(`Gemini enhancement error: ${error.message}`);
    }
  }

  // Try OpenAI as fallback
  if (openaiKey) {
    try {
      log.info('Using OpenAI API as fallback');
      const systemPrompt = buildSystemPrompt(mode, system);
      const model = 'gpt-4o-mini';
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input }
          ],
          max_tokens: 2000
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const output = data?.choices?.[0]?.message?.content || '';
        
        if (output) {
          return res.json({ 
            output,
            mode,
            format,
            provider: 'openai',
            model
          });
        }
      }
    } catch (error) {
      log.error(`OpenAI enhancement error: ${error.message}`);
    }
  }

  // Ultimate fallback to enhanced local
  log.info('All APIs failed, using enhanced local generation');
  const enhanced = enhanceLocally(input, mode);
  return res.json({ 
    output: enhanced, 
    mode,
    format,
    provider: 'local',
    fallback: true
  });
});

// GET /api/prompt-enhancer/modes - List available modes
router.get('/modes', (req, res) => {
  const modes = Object.entries(enhancementTemplates).map(([key, value]) => ({
    id: key,
    name: value.name,
    description: value.systemPrompt.split('\n')[0]
  }));
  
  res.json({ modes });
});

// GET /api/prompt-enhancer/status - Check API status
router.get('/status', (req, res) => {
  const geminiAvailable = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  const openaiAvailable = !!process.env.OPENAI_API_KEY;
  
  res.json({
    gemini: geminiAvailable,
    openai: openaiAvailable,
    local: true,
    preferredProvider: geminiAvailable ? 'gemini' : openaiAvailable ? 'openai' : 'local'
  });
});

export default router;