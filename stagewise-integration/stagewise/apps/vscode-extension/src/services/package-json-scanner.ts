import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEPRECATED_TOOLBAR_PACKAGES } from './workspace-service';

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface DeprecatedPackageInfo {
  packageName: string;
  version: string;
  filePath: string;
}

export class PackageJsonScanner {
  private static instance: PackageJsonScanner;

  private constructor() {}

  public static getInstance(): PackageJsonScanner {
    if (!PackageJsonScanner.instance) {
      PackageJsonScanner.instance = new PackageJsonScanner();
    }
    return PackageJsonScanner.instance;
  }

  public async scanWorkspace(): Promise<DeprecatedPackageInfo[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const deprecatedPackages: DeprecatedPackageInfo[] = [];

    for (const folder of workspaceFolders) {
      const packagesInFolder = await this.scanDirectory(folder.uri.fsPath);
      deprecatedPackages.push(...packagesInFolder);
    }

    return deprecatedPackages;
  }

  private async scanDirectory(
    dirPath: string,
  ): Promise<DeprecatedPackageInfo[]> {
    const deprecatedPackages: DeprecatedPackageInfo[] = [];
    const packageJsonPaths = await this.findPackageJsonFiles(dirPath);

    for (const packageJsonPath of packageJsonPaths) {
      const deprecated = await this.checkForDeprecatedPackages(packageJsonPath);
      deprecatedPackages.push(...deprecated);
    }

    return deprecatedPackages;
  }

  private async findPackageJsonFiles(dirPath: string): Promise<string[]> {
    const packageJsonFiles: string[] = [];

    const scanRecursive = async (currentPath: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(currentPath, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          if (entry.isDirectory()) {
            // Skip node_modules and common directories to ignore
            if (
              entry.name === 'node_modules' ||
              entry.name === '.git' ||
              entry.name === 'dist' ||
              entry.name === 'build' ||
              entry.name === 'coverage' ||
              entry.name === '.vscode' ||
              entry.name === '.idea'
            ) {
              continue;
            }

            await scanRecursive(fullPath);
          } else if (entry.isFile() && entry.name === 'package.json') {
            packageJsonFiles.push(fullPath);
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${currentPath}:`, error);
      }
    };

    await scanRecursive(dirPath);
    return packageJsonFiles;
  }

  private async checkForDeprecatedPackages(
    packageJsonPath: string,
  ): Promise<DeprecatedPackageInfo[]> {
    try {
      const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
      const packageJson: PackageJson = JSON.parse(content);
      const deprecatedPackages: DeprecatedPackageInfo[] = [];

      const allDependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
      };

      for (const [packageName, version] of Object.entries(allDependencies)) {
        if (
          DEPRECATED_TOOLBAR_PACKAGES.includes(packageName) &&
          version !== 'workspace:*'
        ) {
          deprecatedPackages.push({
            packageName,
            version,
            filePath: packageJsonPath,
          });
        }
      }

      return deprecatedPackages;
    } catch (error) {
      console.error(`Error parsing package.json at ${packageJsonPath}:`, error);
      return [];
    }
  }
}
