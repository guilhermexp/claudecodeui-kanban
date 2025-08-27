#!/usr/bin/env tsx

import fs from 'node:fs/promises';
import { stagewise } from './src/utils/config-path';
import chalk from 'chalk';

/**
 * Reset script to delete all Stagewise CLI data
 * Uses the same platform-independent path resolution as the CLI
 */
async function resetData() {
  console.log(chalk.yellow('\n🧹 Resetting Stagewise CLI data...\n'));

  const directoriesToDelete = [
    { name: 'Config', path: stagewise.configDir },
    { name: 'Data', path: stagewise.dataDir },
    { name: 'Cache', path: stagewise.cacheDir },
    { name: 'Logs', path: stagewise.logDir },
  ];

  let deletedCount = 0;
  let errorCount = 0;

  for (const { name, path } of directoriesToDelete) {
    try {
      await fs.access(path);
      await fs.rm(path, { recursive: true, force: true });
      console.log(chalk.green(`✓ Deleted ${name} directory: ${path}`));
      deletedCount++;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        console.log(chalk.gray(`- ${name} directory not found: ${path}`));
      } else {
        console.log(
          chalk.red(`✗ Failed to delete ${name} directory: ${err.message}`),
        );
        errorCount++;
      }
    }
  }

  console.log(chalk.blue('\n📁 Data locations that were processed:'));
  console.log(chalk.gray(`  Config: ${stagewise.configDir}`));
  console.log(chalk.gray(`  Data: ${stagewise.dataDir}`));
  console.log(chalk.gray(`  Cache: ${stagewise.cacheDir}`));
  console.log(chalk.gray(`  Logs: ${stagewise.logDir}`));

  if (errorCount === 0) {
    console.log(
      chalk.green(
        `\n✅ Reset complete! ${deletedCount} directories processed.`,
      ),
    );
    console.log(
      chalk.gray(
        'All telemetry settings, authentication data, and machine IDs have been cleared.',
      ),
    );
  } else {
    console.log(
      chalk.yellow(`\n⚠️  Reset completed with ${errorCount} errors.`),
    );
    process.exit(1);
  }
}

// Run the reset
resetData().catch((error) => {
  console.error(chalk.red('\n❌ Reset failed:'), error.message);
  process.exit(1);
});
