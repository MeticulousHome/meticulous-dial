// Runs the React Dial's own unit tests (tests/*.test.*) against the Qt Dial's JavaScript ports: each test's
// imports of a React module are pointed at the QML JS library that replaces it (MAP below), so the very
// assertions the React code passes now check the port. Node 22 (strip-types):
//   node --experimental-strip-types qt/tests/js/run.mjs           (qt/scripts/js-tests.sh runs it in Docker)
//
// A QML JS library is plain JavaScript with `.pragma library` / `.import` lines; it is loaded into a vm
// context and its top-level functions and constants become the module's exports.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const qml = (p) => path.join(repo, 'qt/qml/Dial', p);

// test file -> { React import specifier (as written in the test) -> QML JS library }
const MAP = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'map.json'), 'utf8'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qt-dial-js-'));
fs.writeFileSync(path.join(tmp, 'load-qml-js.mjs'), `
import fs from 'node:fs';
import vm from 'node:vm';
export function loadQmlJs(file, imports = {}) {
  const src = fs.readFileSync(file, 'utf8')
    .replace(/^\\s*\\.pragma\\s+library\\s*$/m, '')
    .replace(/^\\s*\\.import\\s+.*$/gm, '');
  const names = new Set();
  for (const m of src.matchAll(/^(?:function\\s+([A-Za-z_$][\\w$]*)|(?:const|let|var)\\s+([A-Za-z_$][\\w$]*))/gm)) names.add(m[1] || m[2]);
  const context = vm.createContext({ console, Math, JSON, Date, Number, String, Array, Object, Infinity, NaN,
    isNaN, isFinite, parseFloat, parseInt, Error, TypeError, RangeError, Set, Map, Symbol, RegExp, ...imports });
  vm.runInContext(src + '\\n;({' + [...names].join(',') + '})', context);
  return vm.runInContext('({' + [...names].join(',') + '})', context);
}
`);

let failed = 0;
for (const [test, imports] of Object.entries(MAP)) {
  let src = fs.readFileSync(path.join(repo, test), 'utf8');
  let n = 0;
  for (const [specifier, lib] of Object.entries(imports)) {
    const shim = path.join(tmp, `shim${n++}.mjs`);
    const libSrc = fs.readFileSync(qml(lib), 'utf8');
    const names = new Set();
    for (const m of libSrc.matchAll(/^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm)) names.add(m[1] || m[2]);
    // Values made in the vm context have its own prototypes: strict deepEqual would refuse them, so results
    // are cloned into this realm.
    fs.writeFileSync(shim, `import { loadQmlJs } from './load-qml-js.mjs';\nconst m = loadQmlJs(${JSON.stringify(qml(lib))});\n` +
      `const clone = (v) => (v === undefined || v === null || typeof v === 'function' ? v : structuredClone(v));\n` +
      `const wrap = (v) => (typeof v === 'function' ? (...a) => clone(v(...a)) : clone(v));\n` +
      [...names].map((x) => `export const ${x} = wrap(m.${x});`).join('\n') + '\nexport default m;\n');
    const quoted = new RegExp(`(['"])${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.tsx?|\\.mts|\\.js)?\\1`, 'g');
    src = src.replace(quoted, JSON.stringify(shim));
  }
  const out = path.join(tmp, path.basename(test).replace(/\.(ts|mts|mjs)$/, '.mts'));
  fs.writeFileSync(out, src);
  const r = spawnSync(process.execPath, ['--test', '--experimental-strip-types', '--disable-warning=ExperimentalWarning', out],
    { encoding: 'utf8' });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${test}`);
  if (!ok) console.log((r.stdout + r.stderr).split('\n').filter((l) => /not ok|Error|assert|expected|actual|\+|-/.test(l)).slice(0, 30).join('\n'));
}
process.exit(failed ? 1 : 0);
