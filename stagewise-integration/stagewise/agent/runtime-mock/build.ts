import * as esbuild from 'esbuild';
import type { BuildOptions } from 'esbuild';

const isWatch = process.argv.includes('--watch');

const buildOptions: BuildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  format: 'esm',
  platform: 'node',
  target: 'node16',
  sourcemap: false, // Disable source maps for security
  minify: false, // Disable minify for development/testing
  treeShaking: true,
  // Keep names for better debugging
  keepNames: true,
  legalComments: 'none', // Remove all comments
};

if (isWatch) {
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete');
}
