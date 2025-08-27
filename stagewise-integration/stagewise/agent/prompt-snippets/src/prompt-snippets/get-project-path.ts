import type { ClientRuntime } from '@stagewise/agent-runtime-interface';
import type { PromptSnippet } from '@stagewise/agent-types';

/**
 * Gets the current project path using the client runtime
 * Returns a PromptSnippet with the project path information for the AI context
 */
export async function getProjectPath(
  clientRuntime: ClientRuntime,
): Promise<PromptSnippet> {
  try {
    const projectPath = clientRuntime.fileSystem.getCurrentWorkingDirectory();
    return {
      type: 'project-path',
      description: 'Current Project Path',
      content: projectPath,
    };
  } catch (error) {
    return {
      type: 'project-path',
      description: 'Current Project Path',
      content: `Failed to get project path: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
