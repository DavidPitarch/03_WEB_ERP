import fs from 'node:fs';
import { EventEmitter } from 'node:events';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const childProcess = require('node:child_process');

if (process.platform === 'win32') {
  const originalExec = childProcess.exec;

  childProcess.exec = function patchedExec(command, options, callback) {
    let resolvedOptions = options;
    let resolvedCallback = callback;

    if (typeof resolvedOptions === 'function') {
      resolvedCallback = resolvedOptions;
      resolvedOptions = undefined;
    }

    if (typeof command === 'string' && command.trim().toLowerCase() === 'net use') {
      const fakeProcess = new EventEmitter();
      fakeProcess.stdout = new EventEmitter();
      fakeProcess.stderr = new EventEmitter();

      queueMicrotask(() => {
        resolvedCallback?.(new Error('net use disabled for sandbox-safe Vitest bootstrap'), '', '');
        fakeProcess.emit('close', 1);
      });

      return fakeProcess;
    }

    return originalExec.call(childProcess, command, resolvedOptions, resolvedCallback);
  };

  syncBuiltinESMExports();
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distRoot = path.join(root, '.vitest-dist');
const distAppRoot = path.join(distRoot, 'apps', 'edge-api');
const tsconfigPath = path.join(root, 'tsconfig.vitest.json');
const rawArgs = process.argv.slice(2);
const watch = rawArgs.includes('--watch') || process.env.npm_lifecycle_event === 'test:watch';
const filters = rawArgs.filter(arg => arg !== '--watch');

const ts = await import('typescript');

function formatDiagnostics(diagnostics) {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  });
}

function compileTests() {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

  if (configFile.error) {
    throw new Error(formatDiagnostics([configFile.error]));
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    root,
    undefined,
    tsconfigPath,
  );

  if (parsedConfig.errors.length > 0) {
    throw new Error(formatDiagnostics(parsedConfig.errors));
  }

  fs.rmSync(distRoot, { recursive: true, force: true });
  fs.mkdirSync(distRoot, { recursive: true });

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });

  const preEmitDiagnostics = ts.getPreEmitDiagnostics(program);
  const emitResult = program.emit();
  const diagnostics = [...preEmitDiagnostics, ...emitResult.diagnostics];

  if (diagnostics.length > 0) {
    throw new Error(formatDiagnostics(diagnostics));
  }

  if (emitResult.emitSkipped) {
    throw new Error('TypeScript no pudo emitir los artefactos de prueba para Vitest.');
  }
}

compileTests();

const { startVitest } = await import('vitest/node');

const ctx = await startVitest(
  'test',
  filters,
  {
    root: distAppRoot,
    config: false,
    run: !watch,
    watch,
    include: ['**/*.test.js'],
    environment: 'node',
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    fileParallelism: false,
    isolate: false,
    passWithNoTests: false,
  },
  {
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@erp/types': path.join(distRoot, 'packages', 'types', 'src', 'index.js'),
        '@erp/domain': path.join(distRoot, 'packages', 'domain', 'src', 'index.js'),
      },
    },
  },
);

if (ctx?.state?.getCountOfFailedTests?.() > 0) {
  process.exitCode = 1;
}
