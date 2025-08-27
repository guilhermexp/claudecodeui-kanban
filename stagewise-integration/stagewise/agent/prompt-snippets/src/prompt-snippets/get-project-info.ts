import type { ClientRuntime } from '@stagewise/agent-runtime-interface';
import type { PromptSnippet } from '@stagewise/agent-types';
import {
  findProjectRoot,
  getProjectPackages,
  getPackageManager,
  getFrameworksForPackage,
} from '@stagewise/agent-project-information';

/**
 * Gets comprehensive project structure information including:
 * - Project root path
 * - Monorepo detection and tools
 * - Package manager information
 * - List of all packages/workspaces
 *
 * Returns a PromptSnippet with formatted project structure for AI context
 */
export async function getProjectInfo(
  clientRuntime: ClientRuntime,
): Promise<PromptSnippet> {
  try {
    // Gather all project information
    const projectRoot = await findProjectRoot(clientRuntime);
    const packages = await getProjectPackages(clientRuntime);
    const packageManager = await getPackageManager(clientRuntime);

    // Build the content in a structured format
    const sections: string[] = [];

    // Project Root Section
    sections.push(`PROJECT ROOT:\n${projectRoot || 'Not found'}`);

    // Package Manager Section
    if (packageManager) {
      const pmInfo = [`PACKAGE MANAGER: ${packageManager.name}`];
      if (packageManager.version) {
        pmInfo.push(`Version: ${packageManager.version}`);
      }
      sections.push(pmInfo.join('\n'));
    } else {
      sections.push('PACKAGE MANAGER: Not detected');
    }

    // Monorepo Detection Section
    const isMonorepo = packages.isMonorepo;
    sections.push(
      `PROJECT TYPE: ${isMonorepo ? 'Monorepo' : 'Single Package'}`,
    );

    if (isMonorepo && packages.tools.length > 0) {
      const toolsInfo = ['MONOREPO TOOLS:'];
      for (const tool of packages.tools) {
        toolsInfo.push(`- ${tool.name} (${tool.configFile})`);
      }
      sections.push(toolsInfo.join('\n'));
    }

    // Packages/Workspaces Section with Framework Detection
    if (packages.packages.length > 0) {
      const packagesInfo = [
        `${isMonorepo ? 'WORKSPACES' : 'PACKAGE'} (${packages.packages.length} total):`,
      ];

      for (const pkg of packages.packages) {
        const pkgLines: string[] = [];

        // Package basic info
        pkgLines.push(`\n- ${pkg.name || 'Unnamed package'}`);
        if (pkg.version) {
          pkgLines.push(`  Version: ${pkg.version}`);
        }
        pkgLines.push(`  Path: ${pkg.path}`);

        // Get frameworks for this package
        try {
          const frameworks = await getFrameworksForPackage(
            clientRuntime,
            pkg.path,
          );

          // Meta frameworks (highest priority)
          if (frameworks.metaFrameworks.length > 0) {
            const metaList = frameworks.metaFrameworks
              .map((f) =>
                f.version ? `${f.framework}@${f.version}` : f.framework,
              )
              .join(', ');
            pkgLines.push(`  Meta-frameworks: ${metaList}`);
          }

          // Frontend frameworks
          if (frameworks.frontendFrameworks.length > 0) {
            const frontendList = frameworks.frontendFrameworks
              .map((f) =>
                f.version ? `${f.framework}@${f.version}` : f.framework,
              )
              .join(', ');
            pkgLines.push(`  Frontend: ${frontendList}`);
          }

          // Backend frameworks
          if (frameworks.backendFrameworks.length > 0) {
            const backendList = frameworks.backendFrameworks
              .map((f) =>
                f.version ? `${f.framework}@${f.version}` : f.framework,
              )
              .join(', ');
            pkgLines.push(`  Backend: ${backendList}`);
          }

          // Build tools
          if (frameworks.buildTools.length > 0) {
            const buildList = frameworks.buildTools
              .map((f) =>
                f.version ? `${f.framework}@${f.version}` : f.framework,
              )
              .join(', ');
            pkgLines.push(`  Build tools: ${buildList}`);
          }

          // Testing frameworks
          if (frameworks.testingFrameworks.length > 0) {
            const testList = frameworks.testingFrameworks
              .map((f) =>
                f.version ? `${f.framework}@${f.version}` : f.framework,
              )
              .join(', ');
            pkgLines.push(`  Testing: ${testList}`);
          }
        } catch (_error) {
          // If framework detection fails for a package, just note it
          pkgLines.push(`  Frameworks: Unable to detect`);
        }

        packagesInfo.push(...pkgLines);
      }

      sections.push(packagesInfo.join('\n'));
    }

    return {
      type: 'project-info',
      description: 'Complete Project Information and Structure',
      content: sections.join('\n'),
    };
  } catch (error) {
    return {
      type: 'project-info',
      description: 'Complete Project Information and Structure',
      content: `Failed to gather project information: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
