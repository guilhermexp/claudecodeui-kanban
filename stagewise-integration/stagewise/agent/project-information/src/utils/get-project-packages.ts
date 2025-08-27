import type {
  BaseFileSystemProvider,
  ClientRuntime,
} from '@stagewise/agent-runtime-interface';
import { join, dirname } from 'node:path';
import { findProjectRoot } from './get-project-root.js';

/**
 * Represents a single resolved package or workspace within the monorepo.
 * This provides the agent with a concrete, actionable location and identity for each package.
 */
export interface WorkspacePackage {
  /** The name of the package from its package.json */
  name: string;
  /** The absolute path to the package's root directory */
  path: string;
  /** The version of the package from its package.json (if available) */
  version?: string;
}

/**
 * Information about a monorepo tool that was detected in the project.
 * The list will only contain tools that are actually present.
 */
export interface DetectedTool {
  /** Name of the detected monorepo tool */
  name: 'pnpm' | 'lerna' | 'nx' | 'turbo' | 'rush' | 'yarn' | 'lage';
  /** Path to the configuration file that confirmed the tool's presence */
  configFile: string;
}

/**
 * Comprehensive and precise information about the project's monorepo structure.
 * This structure is designed to be directly consumable by the agent.
 */
export interface MonorepoInfo {
  /** Whether this project is a monorepo */
  isMonorepo: boolean;
  /** A list of monorepo tools that were actually detected */
  tools: DetectedTool[];
  /** A detailed list of all resolved packages/workspaces within the monorepo */
  packages: WorkspacePackage[];
  /** The absolute path to the monorepo root */
  rootPath: string | null;
}

// For backwards compatibility, export the old interfaces with deprecated notices
/** @deprecated Use DetectedTool instead */
export interface MonorepoTool {
  name: 'pnpm' | 'lerna' | 'nx' | 'turbo' | 'rush' | 'yarn' | 'lage';
  configFile: string;
  detected: boolean;
}

/**
 * Gets project packages and monorepo structure information.
 *
 * This function performs comprehensive analysis to detect various monorepo tools and configurations
 * including pnpm workspaces, Lerna, Nx, Turborepo, Rush, Yarn workspaces, and Lage. It analyzes
 * both dedicated configuration files and package.json workspace configurations, and resolves
 * workspace patterns to actual package locations.
 *
 * @param clientRuntime - The client runtime providing filesystem access
 * @returns Promise that resolves to comprehensive monorepo information
 *
 * @example
 * ```typescript
 * // In a pnpm + Turbo monorepo:
 * const info = await getProjectPackages(clientRuntime);
 * console.log(info);
 * // {
 * //   isMonorepo: true,
 * //   tools: [
 * //     { name: 'pnpm', configFile: 'pnpm-workspace.yaml' },
 * //     { name: 'turbo', configFile: 'turbo.json' }
 * //   ],
 * //   packages: [
 * //     { name: '@myorg/app', path: '/workspace/monorepo/apps/app', version: '1.0.0' },
 * //     { name: '@myorg/lib', path: '/workspace/monorepo/packages/lib', version: '0.1.0' }
 * //   ],
 * //   rootPath: '/workspace/monorepo'
 * // }
 * ```
 *
 * @example
 * ```typescript
 * // In a regular single-package project:
 * const info = await getProjectPackages(clientRuntime);
 * console.log(info);
 * // {
 * //   isMonorepo: false,
 * //   tools: [],
 * //   packages: [],
 * //   rootPath: '/project'
 * // }
 * ```
 */
export async function getProjectPackages(
  clientRuntime: ClientRuntime,
): Promise<MonorepoInfo> {
  const fileSystem = clientRuntime.fileSystem;
  const rootPath = await findProjectRoot(clientRuntime);

  if (!rootPath) {
    return {
      isMonorepo: false,
      tools: [],
      packages: [],
      rootPath: null,
    };
  }

  // Define all monorepo tools to check
  const toolConfigs: Array<{ name: DetectedTool['name']; configFile: string }> =
    [
      { name: 'pnpm', configFile: 'pnpm-workspace.yaml' },
      { name: 'lerna', configFile: 'lerna.json' },
      { name: 'nx', configFile: 'nx.json' },
      { name: 'turbo', configFile: 'turbo.json' },
      { name: 'rush', configFile: 'rush.json' },
      { name: 'yarn', configFile: 'yarn.lock' }, // Yarn workspaces detected via package.json
      { name: 'lage', configFile: 'lage.config.js' },
    ];

  const detectedTools: DetectedTool[] = [];
  const workspacePatterns: string[] = [];

  // Check each tool configuration
  for (const config of toolConfigs) {
    const configPath = join(rootPath, config.configFile);
    const exists = await fileSystem.fileExists(configPath);

    if (exists) {
      // Only add tools that are actually detected
      detectedTools.push({
        name: config.name,
        configFile: config.configFile,
      });

      // Extract workspace patterns based on tool type
      await extractWorkspacePatterns(
        fileSystem,
        configPath,
        config.name,
        workspacePatterns,
      );
    }
  }

  // Check package.json for workspace configuration
  const packageJsonPath = join(rootPath, 'package.json');
  if (await fileSystem.fileExists(packageJsonPath)) {
    try {
      const packageJsonResult = await fileSystem.readFile(packageJsonPath);
      if (packageJsonResult.success && packageJsonResult.content) {
        const packageJson = JSON.parse(packageJsonResult.content);

        // Extract workspaces from package.json
        if (packageJson.workspaces) {
          const workspaces = Array.isArray(packageJson.workspaces)
            ? packageJson.workspaces
            : packageJson.workspaces.packages || [];
          workspacePatterns.push(...workspaces);
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }
  }

  // Remove duplicates from workspace patterns
  const uniquePatterns = Array.from(new Set(workspacePatterns));

  // Resolve workspace patterns to actual packages
  const packages = await resolveWorkspacePackages(
    fileSystem,
    rootPath,
    uniquePatterns,
  );

  // Determine if this is a monorepo
  const isMonorepo = detectedTools.length > 0 || packages.length > 0;

  return {
    isMonorepo,
    tools: detectedTools,
    packages,
    rootPath,
  };
}

/**
 * Resolves workspace patterns to actual package locations
 */
async function resolveWorkspacePackages(
  fileSystem: BaseFileSystemProvider,
  rootPath: string,
  patterns: string[],
): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];
  const processedPaths = new Set<string>();

  for (const pattern of patterns) {
    // Handle different pattern types
    if (pattern.includes('*')) {
      // Glob pattern - need to find matching directories
      await findPackagesInPattern(
        fileSystem,
        rootPath,
        pattern,
        packages,
        processedPaths,
      );
    } else {
      // Direct path - check if it's a package
      const packagePath = join(rootPath, pattern);
      const packageJsonPath = join(packagePath, 'package.json');

      if (
        !processedPaths.has(packagePath) &&
        (await fileSystem.fileExists(packageJsonPath))
      ) {
        const packageInfo = await readPackageInfo(fileSystem, packageJsonPath);
        if (packageInfo) {
          packages.push({
            name: packageInfo.name,
            path: packagePath,
            ...(packageInfo.version && { version: packageInfo.version }),
          });
          processedPaths.add(packagePath);
        }
      }
    }
  }

  // Sort packages by path for consistent output
  packages.sort((a, b) => a.path.localeCompare(b.path));

  return packages;
}

/**
 * Find packages matching a glob pattern
 */
async function findPackagesInPattern(
  fileSystem: BaseFileSystemProvider,
  rootPath: string,
  pattern: string,
  packages: WorkspacePackage[],
  processedPaths: Set<string>,
): Promise<void> {
  // Convert workspace pattern to directory search pattern
  // e.g., "packages/*" -> search in "packages" directory
  // e.g., "apps/**" -> search recursively in "apps" directory

  const parts = pattern.split('/');

  // Build base path before wildcards
  let basePath = rootPath;
  for (const part of parts) {
    if (part.includes('*')) {
      break;
    }
    basePath = join(basePath, part);
  }

  // Check if base path exists
  if (!(await fileSystem.fileExists(basePath))) {
    return;
  }

  // List directories and check for packages
  try {
    const result = await fileSystem.listDirectory(basePath);
    if (!result.success || !result.files) {
      return;
    }

    for (const entry of result.files) {
      if (entry.type === 'directory') {
        const dirPath = join(basePath, entry.name);
        const packageJsonPath = join(dirPath, 'package.json');

        // Check if this directory has a package.json
        if (
          !processedPaths.has(dirPath) &&
          (await fileSystem.fileExists(packageJsonPath))
        ) {
          const packageInfo = await readPackageInfo(
            fileSystem,
            packageJsonPath,
          );
          if (packageInfo) {
            packages.push({
              name: packageInfo.name,
              path: dirPath,
              ...(packageInfo.version && { version: packageInfo.version }),
            });
            processedPaths.add(dirPath);
          }
        }

        // If pattern has **, search recursively
        if (pattern.includes('**')) {
          await findPackagesInPattern(
            fileSystem,
            rootPath,
            pattern.replace(
              pattern.substring(0, pattern.indexOf('**')),
              join(pattern.substring(0, pattern.indexOf('**')), entry.name),
            ),
            packages,
            processedPaths,
          );
        }
      }
    }
  } catch {
    // Ignore errors when listing directories
  }
}

/**
 * Read package information from a package.json file
 */
async function readPackageInfo(
  fileSystem: BaseFileSystemProvider,
  packageJsonPath: string,
): Promise<{ name: string; version?: string } | null> {
  try {
    const result = await fileSystem.readFile(packageJsonPath);
    if (result.success && result.content) {
      const packageJson = JSON.parse(result.content);
      return {
        name:
          packageJson.name ||
          dirname(packageJsonPath).split('/').pop() ||
          'unnamed',
        version: packageJson.version,
      };
    }
  } catch {
    // Ignore parsing errors
  }
  return null;
}

/**
 * Extract workspace patterns from configuration files based on tool type
 */
async function extractWorkspacePatterns(
  fileSystem: BaseFileSystemProvider,
  configPath: string,
  toolName: DetectedTool['name'],
  patterns: string[],
): Promise<void> {
  try {
    const result = await fileSystem.readFile(configPath);
    if (!result.success || !result.content) return;

    switch (toolName) {
      case 'pnpm': {
        // Parse YAML-like structure for pnpm-workspace.yaml
        const lines = result.content.split('\n');
        let inPackages = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === 'packages:') {
            inPackages = true;
            continue;
          }
          if (
            inPackages &&
            (trimmed.startsWith('- ') ||
              trimmed.startsWith('-"') ||
              trimmed.startsWith("- '"))
          ) {
            // Handle various YAML list formats:
            // - "pattern"
            // - 'pattern'
            // - pattern
            let pattern = trimmed.substring(2).trim();
            // Remove quotes if present
            if (
              (pattern.startsWith('"') && pattern.endsWith('"')) ||
              (pattern.startsWith("'") && pattern.endsWith("'"))
            ) {
              pattern = pattern.slice(1, -1);
            }
            patterns.push(pattern);
          } else if (
            inPackages &&
            trimmed &&
            !trimmed.startsWith('-') &&
            !trimmed.startsWith('#')
          ) {
            // Stop when we hit a non-list item that's not a comment
            inPackages = false;
          }
        }
        break;
      }

      case 'lerna': {
        const config = JSON.parse(result.content);
        if (config.packages) {
          patterns.push(...config.packages);
        }
        break;
      }

      case 'nx': {
        const config = JSON.parse(result.content);
        if (config.workspaceLayout?.appsDir) {
          patterns.push(`${config.workspaceLayout.appsDir}/*`);
        }
        if (config.workspaceLayout?.libsDir) {
          patterns.push(`${config.workspaceLayout.libsDir}/*`);
        }
        // Default Nx patterns if no custom layout
        if (!config.workspaceLayout) {
          patterns.push('apps/*', 'libs/*');
        }
        break;
      }

      case 'rush': {
        const config = JSON.parse(result.content);
        if (config.projects) {
          // Rush uses explicit project paths, not patterns
          for (const project of config.projects) {
            const projectPath = project.projectFolder;
            if (projectPath) {
              patterns.push(projectPath);
            }
          }
        }
        break;
      }

      // Turbo and Lage don't define workspace patterns directly
      // They rely on the package manager's workspace configuration
      default:
        break;
    }
  } catch {
    // Ignore parsing errors for individual config files
  }
}

// Backwards compatibility export with the old name
/** @deprecated Use getProjectPackages instead */
export const detectMonorepoInfo = getProjectPackages;
