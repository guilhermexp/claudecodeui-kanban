# MockFileSystem Implementation

A comprehensive mock file system provider using `memfs` for testing client runtime functions in the Stagewise platform.

## Overview

This package provides a complete mock implementation of the `IFileSystemProvider` interface, enabling developers to test functions that depend on file system operations without requiring actual files on disk.

## Features

- ✅ **Complete Implementation**: All 31 methods from `IFileSystemProvider` are implemented
- ✅ **Native memfs Integration**: Uses memfs's `DirectoryJSON` format for optimal performance
- ✅ **Builder Pattern**: Easy setup with `MockFileSystemBuilder`
- ✅ **Project Templates**: Pre-configured Node.js and React project structures
- ✅ **Test Utilities**: Assertion helpers and debugging tools
- ✅ **Configurable**: Support for different working directories and gitignore patterns
- ✅ **Fast & Isolated**: In-memory operations with clean state between tests
- ✅ **Type Safe**: Full TypeScript support with memfs's well-tested types

## Installation

```bash
pnpm add @stagewise-agent/implementation-client-runtime-mock --dev
```

## Basic Usage

### Simple Mock Runtime

```typescript
import { ClientRuntimeMock, type DirectoryJSON } from '@stagewise-agent/implementation-client-runtime-mock';

// Using DirectoryJSON format (memfs native format)
const initialFiles: DirectoryJSON = {
  'package.json': JSON.stringify({ name: 'test-project' }, null, 2),
  'src/index.ts': 'console.log("Hello world");',
  'src/utils/': null, // null = empty directory
};

const mockRuntime = new ClientRuntimeMock({
  workingDirectory: '/my-project',
  initialFiles,
});

// Test getCurrentWorkingDirectory
const cwd = mockRuntime.fileSystem.getCurrentWorkingDirectory();
console.log(cwd); // '/my-project'
```

### Testing get-project-path Function

```typescript
import { getProjectPath } from '@stagewise/client-prompt-snippets';
import { ClientRuntimeMock } from '@stagewise-agent/implementation-client-runtime-mock';

// Test with different project types
const testScenarios = [
  {
    name: 'Node.js project',
    runtime: ClientRuntimeMock.withNodeProject({
      packageName: 'my-node-app',
      hasTypeScript: true,
    }),
  },
  {
    name: 'React project', 
    runtime: ClientRuntimeMock.withReactProject({
      projectName: 'my-react-app',
    }),
  },
  {
    name: 'Custom project',
    runtime: new ClientRuntimeMock({
      workingDirectory: '/custom/path',
      initialFiles: {
        'main.py': 'print("Hello Python")',
      },
    }),
  },
];

for (const scenario of testScenarios) {
  console.log(`Testing ${scenario.name}:`);
  
  const result = await getProjectPath(scenario.runtime);
  console.log('✅ Result:', result);
  
  const expectedPath = scenario.runtime.fileSystem.getCurrentWorkingDirectory();
  console.log('✅ Path matches:', result.content === expectedPath);
}
```

## DirectoryJSON Format

This package uses memfs's native `DirectoryJSON` format for maximum compatibility and performance:

```typescript
import { type DirectoryJSON, type NestedDirectoryJSON } from '@stagewise-agent/implementation-client-runtime-mock';

// Simple DirectoryJSON format
const simpleFiles: DirectoryJSON = {
  'file.txt': 'content',           // string = file content
  'empty-dir/': null,              // null = empty directory
  'binary-file.png': Buffer.from([/* ... */]), // Buffer = binary content
};

// Nested DirectoryJSON format (more readable for complex structures)
const nestedFiles: NestedDirectoryJSON = {
  'package.json': JSON.stringify({ name: 'project' }),
  src: {
    'index.ts': 'export const main = () => {};',
    components: {
      'Header.tsx': 'export const Header = () => <header />;',
      'Footer.tsx': 'export const Footer = () => <footer />;',
    },
    utils: null, // empty directory
  },
  dist: null, // empty directory
};
```

**Benefits of DirectoryJSON:**
- **Native memfs format**: Leverages memfs's optimized initialization
- **Type safety**: Uses memfs's well-tested TypeScript types
- **Performance**: Direct integration without custom file creation logic
- **Flexibility**: Supports string content, Buffer for binary files, and null for directories

## Builder Pattern

Use `MockFileSystemBuilder` for complex file system setups:

```typescript
import { MockFileSystemBuilder } from '@stagewise-agent/implementation-client-runtime-mock';

const mockFs = new MockFileSystemBuilder('/my-project')
  .withFile('package.json', JSON.stringify({ name: 'test' }, null, 2))
  .withFiles({
    'src/main.ts': 'export function main() {}',
    'src/utils.ts': 'export function helper() {}',
  })
  .withDirectories(['dist', 'node_modules'])
  .withGitignoreFile(['node_modules/', 'dist/', '*.log'])
  .build();

const runtime = new ClientRuntimeMock();
runtime.fileSystem = mockFs;
```

## Project Templates

### Node.js Project

```typescript
const nodeRuntime = ClientRuntimeMock.withNodeProject({
  packageName: 'my-node-app',
  hasTypeScript: true,
  srcFiles: {
    'src/server.ts': 'import express from "express";',
    'src/routes/api.ts': 'export const routes = {};',
  },
  testFiles: {
    'tests/server.test.ts': 'describe("server", () => {});',
  },
});
```

### React Project

```typescript
const reactRuntime = ClientRuntimeMock.withReactProject({
  projectName: 'my-react-app',
  hasTypeScript: true,
  components: {
    'src/components/Header.tsx': 'export const Header = () => <header>App</header>;',
    'src/components/Footer.tsx': 'export const Footer = () => <footer>© 2023</footer>;',
  },
});
```

## Test Utilities

```typescript
import { createTestUtils } from '@stagewise-agent/implementation-client-runtime-mock';

const mockFs = /* ... create mock file system ... */;
const testUtils = createTestUtils(mockFs);

// Assertions
await testUtils.assertFileExists('package.json');
await testUtils.assertFileContent('src/index.ts', 'expected content');
await testUtils.assertFileContains('README.md', 'description');
await testUtils.assertDirectoryExists('src');

// Debugging
await testUtils.printFileSystemStructure();
const allFiles = await testUtils.getAllFiles();
```

## Factory Functions

Quick creation for common scenarios:

```typescript
import { createMockFileSystem } from '@stagewise-agent/implementation-client-runtime-mock';

// Empty file system
const emptyFs = createMockFileSystem.empty('/project');

// Node.js project
const nodeFs = createMockFileSystem.nodeProject({
  packageName: 'my-app',
  hasTypeScript: true,
});

// React project
const reactFs = createMockFileSystem.reactProject({
  projectName: 'my-react-app',
});

// Custom builder
const customFs = createMockFileSystem.custom(builder =>
  builder
    .withWorkingDirectory('/custom')
    .withFile('config.json', '{"env": "test"}')
    .withDirectories(['src', 'dist'])
);
```

## Available File System Methods

The mock implementation supports all `IFileSystemProvider` methods:

### File Operations
- `readFile(path, options?)` - Read file content with optional line range
- `writeFile(path, content)` - Write content to file
- `editFile(path, content, startLine, endLine)` - Edit specific line range
- `deleteFile(path)` - Delete a file
- `copyFile(source, destination)` - Copy file
- `moveFile(source, destination)` - Move/rename file

### Directory Operations
- `createDirectory(path)` - Create directory (recursive)
- `listDirectory(path, options?)` - List directory contents with filters

### Search Operations
- `grep(path, pattern, options?)` - Search for patterns in files
- `glob(pattern, options?)` - Find files matching glob patterns
- `searchAndReplace(filePath, searchString, replaceString, options?)` - Find and replace

### Path Operations
- `resolvePath(path)` - Convert relative to absolute path
- `getDirectoryName(path)` - Get parent directory
- `joinPaths(...paths)` - Join path segments
- `getRelativePath(from, to)` - Get relative path between locations
- `getFileExtension(path)` - Extract file extension

### Utility Operations
- `fileExists(path)` - Check if file/directory exists
- `isDirectory(path)` - Check if path is directory
- `getFileStats(path)` - Get file size and modification time
- `getCurrentWorkingDirectory()` - Get current working directory
- `getGitignorePatterns()` - Get gitignore patterns
- `isIgnored(path)` - Check if path should be ignored

## Testing Examples

### Testing File Reading
```typescript
const runtime = new ClientRuntimeMock({
  workingDirectory: '/test',
  initialFiles: {
    'config.json': '{"debug": true}',
  },
});

const result = await runtime.fileSystem.readFile('config.json');
console.log(result.success); // true
console.log(result.content); // '{"debug": true}'
```

### Testing Search Operations
```typescript
const runtime = new ClientRuntimeMock({
  workingDirectory: '/project',
  initialFiles: {
    'src/app.ts': 'console.log("debug message");',
    'src/utils.ts': 'export function log(msg: string) { console.log(msg); }',
  },
});

const grepResult = await runtime.fileSystem.grep('.', 'console.log', {
  recursive: true,
  filePattern: '*.ts',
});

console.log(grepResult.totalMatches); // 2
console.log(grepResult.matches?.map(m => m.path)); // ['src/app.ts', 'src/utils.ts']
```

### Testing Directory Operations
```typescript
const runtime = new ClientRuntimeMock({
  workingDirectory: '/project',
  initialFiles: {
    'src/index.ts': 'export {};',
    'tests/index.test.ts': 'test("works", () => {});',
  },
});

const listResult = await runtime.fileSystem.listDirectory('.', {
  recursive: true,
  includeDirectories: true,
});

console.log(listResult.totalFiles); // 2
console.log(listResult.totalDirectories); // 2 (src, tests)
```

## Error Handling

The mock file system properly handles errors and returns appropriate error responses:

```typescript
const runtime = new ClientRuntimeMock();

// File not found
const result = await runtime.fileSystem.readFile('missing.txt');
console.log(result.success); // false
console.log(result.error); // Error message about file not found

// Invalid operations
const writeResult = await runtime.fileSystem.writeFile('', 'content');
console.log(writeResult.success); // false
```

## Integration with Tests

Perfect for unit testing functions that depend on file system operations:

```typescript
import { describe, it, expect } from 'your-test-framework';
import { ClientRuntimeMock } from '@stagewise-agent/implementation-client-runtime-mock';
import { someFunction } from './your-module';

describe('someFunction', () => {
  it('should work with Node.js project structure', async () => {
    const mockRuntime = ClientRuntimeMock.withNodeProject({
      packageName: 'test-project',
    });

    const result = await someFunction(mockRuntime);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it('should handle missing files gracefully', async () => {
    const mockRuntime = new ClientRuntimeMock({
      workingDirectory: '/empty-project',
      initialFiles: {},
    });

    const result = await someFunction(mockRuntime);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('file not found');
  });
});
```

## Configuration Options

### MockFileSystemConfig

```typescript
interface MockFileSystemConfig {
  workingDirectory: string;           // Base directory path
  initialFiles?: Record<string, string | null>; // Files to create (null = directory)
  gitignorePatterns?: string[];       // Patterns to ignore
}
```

### Common Options

Most file system methods support common options:
- `recursive` - Enable recursive operations
- `maxDepth` - Limit recursion depth
- `respectGitignore` - Honor .gitignore patterns
- `caseSensitive` - Case-sensitive pattern matching
- `maxMatches` - Limit number of results

## Performance

The mock file system is designed for testing performance:
- ✅ All operations are in-memory (no disk I/O)
- ✅ Fast setup and teardown
- ✅ Isolated between test runs
- ✅ Supports large file structures
- ✅ Efficient pattern matching and search

## Limitations

- Not suitable for testing actual file I/O performance
- Some advanced file system features are simplified
- Pattern matching uses basic regex (not full glob spec)
- No file permissions or ownership simulation
- No symlink support

## Contributing

When adding new features:
1. Implement the interface method completely
2. Add proper error handling
3. Include TypeScript type safety
4. Add examples to this README
5. Test with various scenarios

## License

This package is part of the Stagewise platform and follows the same license terms.