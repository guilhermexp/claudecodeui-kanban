import type { ClientRuntime } from '@stagewise/agent-runtime-interface';
import { join } from 'node:path';

/**
 * Comprehensive framework enumeration covering major web frameworks, meta-frameworks,
 * backend frameworks, build tools, and testing frameworks
 */
export enum Framework {
  // Meta Frameworks (higher priority)
  NEXTJS = 'nextjs',
  NUXTJS = 'nuxtjs',
  SVELTEKIT = 'sveltekit',
  SOLIDSTART = 'solid-start',
  REMIX = 'remix',
  ASTRO = 'astro',
  QWIK = 'qwik',
  GATSBY = 'gatsby',

  // Frontend Frameworks
  REACT = 'react',
  VUE = 'vue',
  ANGULAR = 'angular',
  SVELTE = 'svelte',
  SOLID = 'solid',
  PREACT = 'preact',
  LIT = 'lit',
  ALPINE = 'alpine',

  // Backend Frameworks
  EXPRESS = 'express',
  FASTIFY = 'fastify',
  KOA = 'koa',
  NESTJS = 'nestjs',
  HAPI = 'hapi',

  // Build Tools/Bundlers
  VITE = 'vite',
  WEBPACK = 'webpack',
  PARCEL = 'parcel',
  ROLLUP = 'rollup',
  ESBUILD = 'esbuild',

  // Testing Frameworks
  JEST = 'jest',
  VITEST = 'vitest',
  CYPRESS = 'cypress',
  PLAYWRIGHT = 'playwright',
  MOCHA = 'mocha',

  // Unknown/None
  UNKNOWN = 'unknown',
}

/**
 * Sources where a framework can be found in a package
 */
export type FrameworkSource =
  | 'dependencies'
  | 'devDependencies'
  | 'peerDependencies'
  | 'optionalDependencies'
  | 'scripts'
  | 'config-file'
  | 'package-name'
  | 'engines';

/**
 * Information about a detected framework
 */
export interface FrameworkDetection {
  /** The framework that was detected */
  framework: Framework;
  /** Version of the framework if available */
  version?: string;
  /** Where the framework was found */
  foundIn: FrameworkSource[];
}

/**
 * Comprehensive framework information for a package
 */
export interface PackageFrameworks {
  /** Path to the package directory */
  path: string;
  /** Meta-frameworks (Next.js, Nuxt.js, etc.) */
  metaFrameworks: FrameworkDetection[];
  /** Frontend frameworks (React, Vue, Angular, etc.) */
  frontendFrameworks: FrameworkDetection[];
  /** Backend frameworks (Express, NestJS, etc.) */
  backendFrameworks: FrameworkDetection[];
  /** Build tools (Vite, Webpack, etc.) */
  buildTools: FrameworkDetection[];
  /** Testing frameworks (Jest, Vitest, etc.) */
  testingFrameworks: FrameworkDetection[];
}

/**
 * Framework detection rule for identifying frameworks from package.json
 */
interface FrameworkRule {
  framework: Framework;
  dependencies?: string[];
  devDependencies?: string[];
  peerDependencies?: string[];
  optionalDependencies?: string[];
  scripts?: string[];
  packageNamePatterns?: string[];
  engines?: string[];
  // Additional check function for complex detection logic
  check?: (packageJson: any) => boolean;
}

/**
 * Comprehensive framework detection rules
 */
const FRAMEWORK_RULES: FrameworkRule[] = [
  // Meta Frameworks
  {
    framework: Framework.NEXTJS,
    dependencies: ['next'],
    scripts: ['next dev', 'next build', 'next start'],
  },
  {
    framework: Framework.NUXTJS,
    dependencies: ['nuxt'],
    scripts: ['nuxt dev', 'nuxt build'],
  },
  {
    framework: Framework.SVELTEKIT,
    dependencies: ['@sveltejs/kit'],
    devDependencies: ['@sveltejs/kit'],
  },
  {
    framework: Framework.SOLIDSTART,
    dependencies: ['@solidjs/start'],
    devDependencies: ['@solidjs/start'],
  },
  {
    framework: Framework.REMIX,
    dependencies: ['@remix-run/dev', '@remix-run/node', '@remix-run/react'],
    devDependencies: ['@remix-run/dev'],
  },
  {
    framework: Framework.ASTRO,
    dependencies: ['astro'],
    devDependencies: ['astro'],
  },
  {
    framework: Framework.QWIK,
    dependencies: ['@builder.io/qwik'],
    devDependencies: ['@builder.io/qwik'],
  },
  {
    framework: Framework.GATSBY,
    dependencies: ['gatsby'],
    scripts: ['gatsby develop', 'gatsby build'],
  },

  // Frontend Frameworks
  {
    framework: Framework.ANGULAR,
    dependencies: ['@angular/core'],
    devDependencies: ['@angular/cli'],
    scripts: ['ng serve', 'ng build'],
  },
  {
    framework: Framework.REACT,
    dependencies: ['react'],
    peerDependencies: ['react'],
  },
  {
    framework: Framework.VUE,
    dependencies: ['vue'],
    peerDependencies: ['vue'],
  },
  {
    framework: Framework.SVELTE,
    dependencies: ['svelte'],
    devDependencies: ['svelte'],
    peerDependencies: ['svelte'],
  },
  {
    framework: Framework.SOLID,
    dependencies: ['solid-js'],
    peerDependencies: ['solid-js'],
  },
  {
    framework: Framework.PREACT,
    dependencies: ['preact'],
    peerDependencies: ['preact'],
  },
  {
    framework: Framework.LIT,
    dependencies: ['lit'],
    peerDependencies: ['lit'],
  },
  {
    framework: Framework.ALPINE,
    dependencies: ['alpinejs'],
  },

  // Backend Frameworks
  {
    framework: Framework.NESTJS,
    dependencies: ['@nestjs/core'],
  },
  {
    framework: Framework.EXPRESS,
    dependencies: ['express'],
  },
  {
    framework: Framework.FASTIFY,
    dependencies: ['fastify'],
  },
  {
    framework: Framework.KOA,
    dependencies: ['koa'],
  },
  {
    framework: Framework.HAPI,
    dependencies: ['@hapi/hapi'],
  },

  // Build Tools
  {
    framework: Framework.VITE,
    dependencies: ['vite'],
    devDependencies: ['vite'],
  },
  {
    framework: Framework.WEBPACK,
    dependencies: ['webpack'],
    devDependencies: ['webpack'],
  },
  {
    framework: Framework.PARCEL,
    dependencies: ['parcel'],
    devDependencies: ['parcel'],
  },
  {
    framework: Framework.ROLLUP,
    dependencies: ['rollup'],
    devDependencies: ['rollup'],
  },
  {
    framework: Framework.ESBUILD,
    dependencies: ['esbuild'],
    devDependencies: ['esbuild'],
  },

  // Testing Frameworks
  {
    framework: Framework.VITEST,
    dependencies: ['vitest'],
    devDependencies: ['vitest'],
  },
  {
    framework: Framework.JEST,
    dependencies: ['jest'],
    devDependencies: ['jest'],
  },
  {
    framework: Framework.CYPRESS,
    dependencies: ['cypress'],
    devDependencies: ['cypress'],
  },
  {
    framework: Framework.PLAYWRIGHT,
    dependencies: ['playwright'],
    devDependencies: ['playwright', '@playwright/test'],
  },
  {
    framework: Framework.MOCHA,
    dependencies: ['mocha'],
    devDependencies: ['mocha'],
  },
];

/**
 * Framework categories for classification
 */
const FRAMEWORK_CATEGORIES = {
  META: [
    Framework.NEXTJS,
    Framework.NUXTJS,
    Framework.SVELTEKIT,
    Framework.SOLIDSTART,
    Framework.REMIX,
    Framework.ASTRO,
    Framework.QWIK,
    Framework.GATSBY,
  ],
  FRONTEND: [
    Framework.REACT,
    Framework.VUE,
    Framework.ANGULAR,
    Framework.SVELTE,
    Framework.SOLID,
    Framework.PREACT,
    Framework.LIT,
    Framework.ALPINE,
  ],
  BACKEND: [
    Framework.EXPRESS,
    Framework.FASTIFY,
    Framework.KOA,
    Framework.NESTJS,
    Framework.HAPI,
  ],
  BUILD_TOOL: [
    Framework.VITE,
    Framework.WEBPACK,
    Framework.PARCEL,
    Framework.ROLLUP,
    Framework.ESBUILD,
  ],
  TESTING: [
    Framework.JEST,
    Framework.VITEST,
    Framework.CYPRESS,
    Framework.PLAYWRIGHT,
    Framework.MOCHA,
  ],
} as const;

/**
 * Get the category of a framework
 */
function getFrameworkCategory(
  framework: Framework,
): keyof typeof FRAMEWORK_CATEGORIES | null {
  if ((FRAMEWORK_CATEGORIES.META as readonly Framework[]).includes(framework)) {
    return 'META';
  }
  if (
    (FRAMEWORK_CATEGORIES.FRONTEND as readonly Framework[]).includes(framework)
  ) {
    return 'FRONTEND';
  }
  if (
    (FRAMEWORK_CATEGORIES.BACKEND as readonly Framework[]).includes(framework)
  ) {
    return 'BACKEND';
  }
  if (
    (FRAMEWORK_CATEGORIES.BUILD_TOOL as readonly Framework[]).includes(
      framework,
    )
  ) {
    return 'BUILD_TOOL';
  }
  if (
    (FRAMEWORK_CATEGORIES.TESTING as readonly Framework[]).includes(framework)
  ) {
    return 'TESTING';
  }
  return null;
}

/**
 * Detects frameworks used in a specific package.
 *
 * This function analyzes the package.json file at the specified path and identifies
 * the frameworks being used. It categorizes frameworks into different types
 * (meta-frameworks, frontend frameworks, backend frameworks, build tools, testing frameworks)
 * and allows multiple frameworks to co-exist within their respective categories.
 *
 * @param clientRuntime - The client runtime providing filesystem access
 * @param packagePath - The path to the package directory to analyze
 * @returns Promise that resolves to framework information for the package
 *
 * @example
 * ```typescript
 * // Analyze a specific package:
 * const frameworks = await getFrameworksForPackage(
 *   clientRuntime,
 *   '/workspace/apps/web'
 * );
 * console.log(frameworks);
 * // {
 * //   path: '/workspace/apps/web',
 * //   metaFrameworks: [
 * //     { framework: Framework.NEXTJS, version: '13.0.0', foundIn: ['dependencies', 'scripts'] }
 * //   ],
 * //   frontendFrameworks: [
 * //     { framework: Framework.REACT, version: '18.0.0', foundIn: ['dependencies'] }
 * //   ],
 * //   backendFrameworks: [],
 * //   buildTools: [
 * //     { framework: Framework.WEBPACK, version: '5.0.0', foundIn: ['devDependencies'] }
 * //   ],
 * //   testingFrameworks: [
 * //     { framework: Framework.JEST, version: '29.0.0', foundIn: ['devDependencies'] },
 * //     { framework: Framework.CYPRESS, version: '12.0.0', foundIn: ['devDependencies'] }
 * //   ]
 * // }
 * ```
 */
export async function getFrameworksForPackage(
  clientRuntime: ClientRuntime,
  packagePath: string,
): Promise<PackageFrameworks> {
  const fileSystem = clientRuntime.fileSystem;
  const packageJsonPath = join(packagePath, 'package.json');

  // Initialize empty result
  const result: PackageFrameworks = {
    path: packagePath,
    metaFrameworks: [],
    frontendFrameworks: [],
    backendFrameworks: [],
    buildTools: [],
    testingFrameworks: [],
  };

  try {
    const fileResult = await fileSystem.readFile(packageJsonPath);
    if (!fileResult.success || !fileResult.content) {
      return result;
    }

    const packageJson = JSON.parse(fileResult.content);
    return detectFrameworksFromPackage(packageJson, packagePath);
  } catch {
    // Return empty result if package.json cannot be read or parsed
    return result;
  }
}

/**
 * Detect all frameworks from a parsed package.json
 */
function detectFrameworksFromPackage(
  packageJson: any,
  packagePath: string,
): PackageFrameworks {
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};
  const peerDependencies = packageJson.peerDependencies || {};
  const optionalDependencies = packageJson.optionalDependencies || {};
  const scripts = packageJson.scripts || {};
  const engines = packageJson.engines || {};
  const packageName = packageJson.name || '';

  // Store detected frameworks by category
  const detectedByCategory: {
    META: Map<Framework, FrameworkDetection>;
    FRONTEND: Map<Framework, FrameworkDetection>;
    BACKEND: Map<Framework, FrameworkDetection>;
    BUILD_TOOL: Map<Framework, FrameworkDetection>;
    TESTING: Map<Framework, FrameworkDetection>;
  } = {
    META: new Map(),
    FRONTEND: new Map(),
    BACKEND: new Map(),
    BUILD_TOOL: new Map(),
    TESTING: new Map(),
  };

  for (const rule of FRAMEWORK_RULES) {
    const foundIn: FrameworkSource[] = [];
    let version: string | undefined;

    // Check dependencies
    if (rule.dependencies) {
      for (const dep of rule.dependencies) {
        if (dependencies[dep]) {
          if (!foundIn.includes('dependencies')) {
            foundIn.push('dependencies');
          }
          version = version || dependencies[dep];
        }
      }
    }

    // Check devDependencies
    if (rule.devDependencies) {
      for (const dep of rule.devDependencies) {
        if (devDependencies[dep]) {
          if (!foundIn.includes('devDependencies')) {
            foundIn.push('devDependencies');
          }
          version = version || devDependencies[dep];
        }
      }
    }

    // Check peerDependencies
    if (rule.peerDependencies) {
      for (const dep of rule.peerDependencies) {
        if (peerDependencies[dep]) {
          if (!foundIn.includes('peerDependencies')) {
            foundIn.push('peerDependencies');
          }
          version = version || peerDependencies[dep];
        }
      }
    }

    // Check optionalDependencies
    if (rule.optionalDependencies) {
      for (const dep of rule.optionalDependencies) {
        if (optionalDependencies[dep]) {
          if (!foundIn.includes('optionalDependencies')) {
            foundIn.push('optionalDependencies');
          }
          version = version || optionalDependencies[dep];
        }
      }
    }

    // Check scripts
    if (rule.scripts) {
      for (const script of rule.scripts) {
        const scriptValues = Object.values(scripts);
        if (
          scriptValues.some((s) => typeof s === 'string' && s.includes(script))
        ) {
          if (!foundIn.includes('scripts')) {
            foundIn.push('scripts');
          }
        }
      }
    }

    // Check package name patterns
    if (rule.packageNamePatterns) {
      for (const pattern of rule.packageNamePatterns) {
        if (packageName.includes(pattern)) {
          if (!foundIn.includes('package-name')) {
            foundIn.push('package-name');
          }
        }
      }
    }

    // Check engines
    if (rule.engines) {
      for (const engine of rule.engines) {
        if (engines[engine]) {
          if (!foundIn.includes('engines')) {
            foundIn.push('engines');
          }
        }
      }
    }

    // Run custom check if provided
    if (rule.check && !rule.check(packageJson)) {
      continue;
    }

    // If we found the framework, add it to the appropriate category
    if (foundIn.length > 0) {
      const category = getFrameworkCategory(rule.framework);
      if (category) {
        const existing = detectedByCategory[category].get(rule.framework);
        if (existing) {
          // Merge foundIn sources
          const mergedFoundIn = Array.from(
            new Set([...existing.foundIn, ...foundIn]),
          );
          existing.foundIn = mergedFoundIn;
          // Update version if we found a more specific one
          if (!existing.version && version) {
            existing.version = cleanVersion(version);
          }
        } else {
          detectedByCategory[category].set(rule.framework, {
            framework: rule.framework,
            version: cleanVersion(version),
            foundIn,
          });
        }
      }
    }
  }

  // Convert maps to arrays
  return {
    path: packagePath,
    metaFrameworks: Array.from(detectedByCategory.META.values()),
    frontendFrameworks: Array.from(detectedByCategory.FRONTEND.values()),
    backendFrameworks: Array.from(detectedByCategory.BACKEND.values()),
    buildTools: Array.from(detectedByCategory.BUILD_TOOL.values()),
    testingFrameworks: Array.from(detectedByCategory.TESTING.values()),
  };
}

/**
 * Clean version string (preserves semantic versioning prefixes)
 */
function cleanVersion(version: string | undefined): string | undefined {
  if (!version) return undefined;
  return version.trim();
}
