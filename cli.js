#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (typeof globalThis.Bun === 'undefined') {
  console.error(
    'This CLI bundle targets Bun. After building, run:\n  bun ./cli.js --help\nor from the repo root:\n  bun ./dist/cli.js --help',
  );
  process.exit(1);
}

const root = dirname(fileURLToPath(import.meta.url));
const distCli = join(root, 'dist', 'cli.js');
const sourceCli = join(root, 'src', 'entrypoints', 'cli.tsx');
const packageJson = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8'),
);
const bugsUrl =
  typeof packageJson.bugs === 'object' && packageJson.bugs?.url
    ? packageJson.bugs.url
    : packageJson.homepage;
const version = `${packageJson.version}-local`;

const entrypoint = existsSync(sourceCli) ? sourceCli : distCli;

if (!existsSync(entrypoint)) {
  console.error(`Missing CLI entrypoint. Checked:\n  ${sourceCli}\n  ${distCli}`);
  process.exit(1);
}

// External deps from `dist/cli.js` resolve via node_modules next to this package. Bun only walks
// up from cwd for bare specifiers, so ensure cwd is the package root when invoked from elsewhere.
process.chdir(root);

// Local builds do not receive the internal macro injection that the release
// pipeline provides. Seed safe defaults so the bundled CLI can boot.
globalThis.MACRO ??= {
  VERSION: version,
  PACKAGE_URL: packageJson.name,
  NATIVE_PACKAGE_URL: null,
  FEEDBACK_CHANNEL: bugsUrl,
  ISSUES_EXPLAINER: `report bugs at ${bugsUrl}`,
  VERSION_CHANGELOG: '',
  BUILD_TIME: '',
};

await import(entrypoint);
