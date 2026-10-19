#!/usr/bin/env node
// Fails when a test file exists that CI does not run.
//
// CI runs test:all, test:scale-overlay and test:idle-screen (see
// .github/workflows/continuous-integration.yml). A test file is run when one of
// the commands behind those scripts names it, or names a glob that matches it,
// or when it sits under a Playwright testDir. A new test that matches none of
// them would pass locally and never protect a merge (tests/sw120-heating-long-
// press.test.mjs was such a file: `npm test` only globbed *.test.mts).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const TEST_FILE =
  /(\.test\.(c|m)?(j|t)s|\.spec\.(c|m)?(j|t)s)$|^scripts\/test-.*\.(c|m)?js$/;
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'src-tauri',
  '.git',
  'test-results'
]);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return IGNORED_DIRS.has(name) ? [] : walk(path);
    return [relative(root, path)];
  });
}

// The commands CI runs: test:all expanded into the scripts it calls.
function commands(scriptName, seen = new Set()) {
  if (seen.has(scriptName)) return [];
  seen.add(scriptName);
  const command = pkg.scripts[scriptName];
  if (!command) throw new Error(`package.json has no "${scriptName}" script`);
  const nested = [...command.matchAll(/npm (?:run |test\b)([\w:-]*)/g)].flatMap(
    ([, name]) => commands(name || 'test', seen)
  );
  return [command, ...nested];
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

function playwrightTestDirs(configs) {
  return configs.map((config) => {
    const source = readFileSync(join(root, config), 'utf8');
    const match = source.match(/testDir:\s*['"`]([^'"`]+)['"`]/);
    if (!match) throw new Error(`${config} has no literal testDir`);
    return relative(root, join(root, match[1])) + '/';
  });
}

const ciCommands = [
  ...commands('test:all'),
  ...commands('test:scale-overlay'),
  ...commands('test:idle-screen')
];
const words = ciCommands.flatMap((command) => command.split(/\s+/));
const globs = words
  .filter((word) => /[*]/.test(word))
  .map((w) => w.replace(/^['"]|['"]$/g, ''));
const configs = ciCommands.flatMap((c) =>
  [...c.matchAll(/--config\s+(\S+)/g)].map(([, f]) => f)
);
const testDirs = playwrightTestDirs(configs);

const tests = walk(root).filter((file) => TEST_FILE.test(file));
const unrun = tests.filter(
  (file) =>
    !words.includes(file) &&
    !globs.some((glob) => globToRegExp(glob).test(file)) &&
    !testDirs.some((dir) => file.startsWith(dir))
);

if (unrun.length) {
  console.error('These test files are not run by the CI test scripts:');
  for (const file of unrun) console.error(`  ${file}`);
  console.error(
    'Add them to a script that test:all runs, or match them with its glob.'
  );
  process.exit(1);
}
console.log(`CI runs all ${tests.length} test files.`);
