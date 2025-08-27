import { generateDeclarationFile } from './utils.js';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import { resolve } from 'node:path';
import fs from 'node:fs/promises';
import path from 'node:path';

export default async function buildPluginSdk() {
  generateDeclarationFile(
    {
      [resolve(process.cwd(), 'src/plugin-sdk/index.tsx')]: 'index',
    },
    resolve(process.cwd(), 'tmp/plugin-sdk/unbundled-types'),
  );

  // Copy karton-contract types to plugin-sdk dependencies

  const sourceDir = resolve(
    process.cwd(),
    '../../packages/karton-contract/dist',
  );
  const targetDir = resolve(
    process.cwd(),
    'tmp/plugin-sdk/dependencies/karton-contract',
  );

  // Ensure target directory exists
  await fs.mkdir(targetDir, { recursive: true });

  // Read all files from source directory
  const files = await fs.readdir(sourceDir, { withFileTypes: true });

  // Copy all .d.ts files
  for (const file of files) {
    if (file.isFile() && file.name.endsWith('.d.ts')) {
      const sourcePath = path.join(sourceDir, file.name);
      const targetPath = path.join(targetDir, file.name);
      await fs.copyFile(sourcePath, targetPath);
    }
  }

  const extractorConfig = ExtractorConfig.loadFileAndPrepare(
    resolve(process.cwd(), 'api-extractor-configs/plugin-sdk.json'),
  );

  Extractor.invoke(extractorConfig, {});
}
