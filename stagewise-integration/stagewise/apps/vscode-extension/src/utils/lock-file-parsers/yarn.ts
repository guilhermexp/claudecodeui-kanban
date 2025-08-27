import type { Dependencies } from './types';
import { compareVersions } from './version-comparator';
import { parse } from '@yarnpkg/lockfile';

export function getInstalledDependencies(
  lockFileContent: string,
): Dependencies {
  const dependencies: Dependencies = {};

  try {
    const parsed = parse(lockFileContent);
    const lockFileObject = parsed.object;

    for (const [key, value] of Object.entries(lockFileObject)) {
      const name = key.match(/^((?:@)?(?:[^@]+))(.*)$/)?.[1];
      const version = value.version;
      if (name && version) {
        if (
          !dependencies[name] ||
          compareVersions(dependencies[name], version) > 0
        ) {
          dependencies[name] = version;
        }
      }
    }

    return dependencies;
  } catch (error) {
    console.error(
      '[getInstalledDependencies] Failed to parse lock file',
      error,
    );
    return {};
  }
}
