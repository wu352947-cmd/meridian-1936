#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const venvPy = path.join(root, '.cache/venv/bin/python');
const py = fs.existsSync(venvPy) ? venvPy : 'python3';
const script = path.join(root, 'tools/map-compiler/build_europe_1936.py');

const res = spawnSync(py, [script], { cwd: root, stdio: 'inherit' });
process.exit(res.status ?? 1);
