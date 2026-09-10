'use strict';

const { spawn } = require('node:child_process');
const { createHttpServer } = require('./src/http-server');

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { windowsHide: true, shell: false });
  }
}

function parseArgs(argv = []) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    if (arg === '--no-open') options.open = false;
    else if (arg === '--port' && argv[index + 1]) options.port = Number(argv[++index]);
    else if (arg.startsWith('--port=')) options.port = Number(arg.slice(7));
    else if (arg === '--host' && argv[index + 1]) options.host = String(argv[++index]);
    else if (arg.startsWith('--host=')) options.host = arg.slice(7);
  }
  if (options.port !== undefined && (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535)) {
    throw new Error('--port 必须是 1–65535 的整数');
  }
  return options;
}

function start(options = {}) {
  const app = createHttpServer();
  const port = Number(options.port || app.service.settings.port);
  const host = String(options.host || app.service.settings.host);
  app.server.on('error', error => {
    if (error && error.code === 'EADDRINUSE') console.error(`端口 ${port} 已被占用`);
    else console.error(error);
    process.exitCode = 1;
  });
  app.server.listen(port, host, () => {
    const url = `http://${host}:${port}/`;
    console.log('[知识库工具] ' + url);
    if (options.open !== false && !process.argv.includes('--no-open')) setTimeout(() => openBrowser(url), 500);
  });
  return app;
}

if (require.main === module) start(parseArgs(process.argv.slice(2)));

module.exports = { parseArgs, start };
