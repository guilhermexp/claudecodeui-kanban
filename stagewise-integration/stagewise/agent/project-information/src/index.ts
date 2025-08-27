export { findProjectRoot, getProjectRoot } from './utils/get-project-root.js';
export {
  getProjectPackages,
  detectMonorepoInfo,
} from './utils/get-project-packages.js';
export { getPackageManager } from './utils/get-package-manager.js';
export { getFrameworksForPackage } from './utils/get-frameworks-for-package.js';

export type {
  MonorepoTool,
  MonorepoInfo,
  DetectedTool,
  WorkspacePackage,
} from './utils/get-project-packages.js';
export type {
  PackageManager,
  PackageManagerInfo,
} from './utils/get-package-manager.js';
export {
  Framework,
  type FrameworkSource,
  type FrameworkDetection,
  type PackageFrameworks,
} from './utils/get-frameworks-for-package.js';
