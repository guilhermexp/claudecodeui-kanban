import type { ClientRuntime } from '@stagewise/agent-runtime-interface';

import {
  MockFileSystemProvider,
  type MockFileSystemConfig,
} from './mock-file-system.js';

/**
 * Complete mock implementation of ClientRuntime for testing
 */
export class ClientRuntimeMock implements ClientRuntime {
  public fileSystem: MockFileSystemProvider;

  constructor(config?: MockFileSystemConfig) {
    this.fileSystem = new MockFileSystemProvider(config);
  }
}

// Re-export everything for easy access
export { MockFileSystemProvider, type MockFileSystemConfig };

// Re-export DirectoryJSON from memfs for convenience
export type { DirectoryJSON, NestedDirectoryJSON } from 'memfs';

// Legacy export for backward compatibility
export { MockFileSystemProvider as MockedFileSystemProvider };
