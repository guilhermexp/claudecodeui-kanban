# Test Suite for Stagewise CLI

## Test Coverage Summary

### Unit Tests Created

1. **CLI Arguments Parsing** (`tests/unit/config/argparse.test.ts`)
   - Tests command-line argument parsing
   - Validates default values
   - Tests validation rules (port conflicts, bridge mode restrictions)
   - Coverage: 80.82%

2. **Config File Management** (`tests/unit/config/config-file.test.ts`)
   - Tests loading and saving configuration files
   - Validates schema enforcement
   - Tests plugin configuration
   - Coverage: 100%

3. **Logger Utility** (`tests/unit/utils/logger.test.ts`)
   - Tests log level configuration
   - Validates color formatting
   - Tests verbose mode behavior
   - Coverage: 97.43%

4. **User Input Utility** (`tests/unit/utils/user-input.test.ts`)
   - Tests interactive prompts (input, number, confirm, select)
   - Validates prompt formatting
   - Tests default values and hints
   - Coverage: 100%

5. **Token Manager** (`tests/unit/auth/token-manager.test.ts`)
   - Tests token storage and retrieval
   - Validates token priority (CLI > stored)
   - Tests error handling
   - Coverage: 100%

6. **Proxy Server** (`tests/unit/server/proxy.test.ts`)
   - Tests proxy middleware configuration
   - Validates path filtering rules
   - Tests WebSocket support
   - Coverage: 100%

### Integration Tests

- **CLI Workflow** (`tests/integration/cli-workflow.test.ts`)
  - Tests end-to-end CLI behavior
  - Validates argument processing
  - Tests config file integration
  - Tests bridge mode

## Running Tests

```bash
# Run all tests
pnpm test --run

# Run tests in watch mode
pnpm test

# Run with coverage
pnpm test:coverage --run

# Run only unit tests
pnpm test --run tests/unit

# Run only integration tests
pnpm test --run tests/integration
```

## Current Coverage

- Overall: 39.31% statements, 93.67% branches, 75.86% functions
- Key modules with 100% coverage:
  - token-manager.ts
  - config-file.ts
  - proxy.ts
  - user-input.ts

## Areas Not Yet Tested

The following areas require additional testing based on the specs:

1. OAuth flow implementation (oauth.ts)
2. Main server implementation (server/index.ts)
3. Config resolver logic (config/index.ts)
4. Agent client functionality (spec 06)
5. Client runtime functionality (spec 07)
6. Plugin system (spec 08)

These components would require more complex mocking and integration testing to achieve full coverage.