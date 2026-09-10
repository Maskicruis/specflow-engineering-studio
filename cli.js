#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadSettings } = require('./src/config');
const { convertArtifacts, parseFile } = require('./src/pipeline');
const { start } = require('./server');

function parseArgs(values) {
  const result = { _: [] };
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (!value.startsWith('--')) result._.push(value);
    else {
      const [key, inline] = value.slice(2).split('=', 2);
      if (inline !== undefined) result[key] = inline;
      else if (values[index + 1] && !values[index + 1].startsWith('--')) result[key] = values[++index];
      else result[key] = true;
    }
  }
  return result;
}

function required(args, name) {
  if (!args[name]) throw new Error('缺少 --' + name);
  return path.resolve(String(args[name]));
}

function parserOptions(args, defaults) {
  return Object.assign({}, defaults, {
    backend: args.backend || defaults.backend,
    method: args.method || defaults.method,
    language: args.language || defaults.language,
    effort: args.effort || defaults.effort
  });
}

function print(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

function usage() {
  process.stdout.write(`知识库文件解析工具\n\n` +
    `  node cli.js serve [--port 8790] [--host 127.0.0.1] [--no-open]\n` +
    `  node cli.js parse --input file.pdf --output directory [--work directory] [--mineru command]\n` +
    `  node cli.js convert --work mineru-output-directory --output directory [--title title]\n` +
    `  node cli.js inspect --document document.json\n\n` +
    `所有非 serve 命令把机器可读 JSON 写到 stdout，诊断进度写到 stderr。\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] || 'help';
  if (command === 'help' || args.help) return usage();
  if (command === 'serve') {
    start({ port: args.port, host: args.host, open: !args['no-open'] });
    return;
  }
  if (command === 'inspect') {
    const document = JSON.parse(fs.readFileSync(required(args, 'document'), 'utf8'));
    return print({
      ok: true,
      schemaVersion: document.schemaVersion,
      document: document.document,
      items: Array.isArray(document.items) ? document.items.length : 0,
      types: (document.items || []).reduce((counts, item) => {
        counts[item.type] = (counts[item.type] || 0) + 1;
        return counts;
      }, {})
    });
  }
  const outputDir = required(args, 'output');
  const id = String(args.id || 'doc_' + crypto.randomUUID());
  if (command === 'convert') {
    const workDir = required(args, 'work');
    const title = String(args.title || path.basename(outputDir));
    const result = convertArtifacts({ id, title, sourceName: args.source || '', workDir, outputDir });
    return print({ ok: true, document: result.document.document, files: result.files });
  }
  if (command === 'parse') {
    const settings = loadSettings();
    const inputPath = required(args, 'input');
    const title = String(args.title || path.parse(inputPath).name);
    const workDir = path.resolve(String(args.work || path.join(outputDir, '.mineru-work')));
    const result = await parseFile({
      id,
      title,
      sourceName: path.basename(inputPath),
      inputPath,
      workDir,
      outputDir,
      executable: String(args.mineru || settings.mineru),
      parserOptions: parserOptions(args, settings.parser),
      onProgress: progress => process.stderr.write(`\rMinerU ${progress}%`),
      onLog: () => {}
    });
    process.stderr.write('\n');
    return print({ ok: true, document: result.document.document, files: result.files });
  }
  throw new Error('未知命令: ' + command);
}

main().catch(error => {
  process.stderr.write(JSON.stringify({ ok: false, error: { message: error.message } }, null, 2) + '\n');
  process.exitCode = 1;
});
