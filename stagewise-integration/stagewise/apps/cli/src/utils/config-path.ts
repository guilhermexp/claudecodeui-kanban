import envPaths from 'env-paths';
import fs from 'node:fs/promises';
import path from 'node:path';
import { log } from './logger';

// Check if running in dev mode by looking at the execution path
const isDevMode = () => {
  // When running with tsx (pnpm dev), the process will have tsx in the execArgv
  // or NODE_ENV will not be 'production'
  return (
    process.execArgv.some((arg) => arg.includes('tsx')) ||
    process.env.NODE_ENV !== 'production'
  );
};

// Use 'stagewise-dev' in dev mode to keep dev and production configs separate
const appName = isDevMode() ? 'stagewise-dev' : 'stagewise';
const paths = envPaths(appName);

export interface StagewiseConfig {
  configDir: string;
  dataDir: string;
  cacheDir: string;
  logDir: string;
  tempDir: string;
}

export const stagewise: StagewiseConfig = {
  configDir: paths.config,
  dataDir: paths.data,
  cacheDir: paths.cache,
  logDir: paths.log,
  tempDir: paths.temp,
};

/**
 * Ensures a directory exists, creating it if necessary
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true, mode: 0o700 });
  } catch (error) {
    log.debug(`Failed to create directory ${dirPath}: ${error}`);
    throw error;
  }
}

/**
 * Gets a file path within the stagewise config directory
 */
export function getConfigPath(filename: string): string {
  return path.join(stagewise.configDir, filename);
}

/**
 * Gets a file path within the stagewise data directory
 */
export function getDataPath(filename: string): string {
  return path.join(stagewise.dataDir, filename);
}

/**
 * Reads a JSON file from the config directory
 */
export async function readConfigFile<T>(filename: string): Promise<T | null> {
  const filePath = getConfigPath(filename);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    log.debug(`Failed to read config file ${filename}: ${error}`);
    throw error;
  }
}

/**
 * Writes a JSON file to the config directory
 */
export async function writeConfigFile<T>(
  filename: string,
  data: T,
): Promise<void> {
  const filePath = getConfigPath(filename);
  await ensureDir(stagewise.configDir);
  try {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, { mode: 0o600 });
  } catch (error) {
    log.debug(`Failed to write config file ${filename}: ${error}`);
    throw error;
  }
}

/**
 * Deletes a file from the config directory
 */
export async function deleteConfigFile(filename: string): Promise<void> {
  const filePath = getConfigPath(filename);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.debug(`Failed to delete config file ${filename}: ${error}`);
      throw error;
    }
  }
}

/**
 * Reads a JSON file from the data directory
 */
export async function readDataFile<T>(filename: string): Promise<T | null> {
  const filePath = getDataPath(filename);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    log.debug(`Failed to read data file ${filename}: ${error}`);
    throw error;
  }
}

/**
 * Writes a JSON file to the data directory
 */
export async function writeDataFile<T>(
  filename: string,
  data: T,
): Promise<void> {
  const filePath = getDataPath(filename);
  await ensureDir(stagewise.dataDir);
  try {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, { mode: 0o600 });
  } catch (error) {
    log.debug(`Failed to write data file ${filename}: ${error}`);
    throw error;
  }
}
