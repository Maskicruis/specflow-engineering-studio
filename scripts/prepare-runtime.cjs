'use strict';

const fs = require('node:fs');
const path = require('node:path');

const destination = path.resolve(__dirname, '..', 'assets', 'runtime', process.platform === 'win32' ? 'node.exe' : 'node');
fs.mkdirSync(path.dirname(destination), { recursive: true });
if (path.resolve(process.execPath) !== destination) {
  const sourceStat = fs.statSync(process.execPath);
  const currentStat = fs.existsSync(destination) ? fs.statSync(destination) : null;
  if (!currentStat || currentStat.size !== sourceStat.size) fs.copyFileSync(process.execPath, destination);
}
console.log('Bundled Node runtime ready: ' + destination);
