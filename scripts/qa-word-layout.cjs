'use strict';
const fs = require('node:fs'), path = require('node:path');
const { WordFormatService, runWordWorker } = require('../src/word-format');
const { detectFrontMatter } = require('../src/word-layout');
const root = path.resolve(__dirname, '..');
(async () => {
  const directory = path.join(root, '.build', 'word-layout-qa');
  const service = new WordFormatService({ root, dataDir: directory });
  try {
    const file = service.upload('layout-input.docx', fs.readFileSync(path.join(directory, process.argv[2] || 'input.docx')));
    const created = service.create({ fileId: file.id, confirmVba: true, layout: { cover: { mode: 'standard', preset: 'engineering', project: '新能源工程排版验证', title: '初步设计说明书', company: '测试工程设计院', author: '测试编制', reviewer: '测试审核', approver: '测试批准', date: '2026 年 10 月', number: 'QA-001' }, toc: { mode: 'rebuild', levels: 3 }, imageCells: true } });
    service.on(created.id, event => { if (event.type !== 'delta') console.log(event.type, event.job?.state || event.message || ''); });
    await service.tail;
    const job = service.get(created.id);
    if (job.state !== 'awaiting-review') throw Error(job.error);
    console.log(JSON.stringify(job.frontMatter));
    if (!job.frontMatter.cover || !job.frontMatter.toc) throw Error('Fixture front matter not recognized');
    service.apply(job.id, { confirmApply: true, confirmLayout: true, changes: [] });
    await service.tail;
    if (job.state !== 'completed') throw Error(job.error);
    fs.copyFileSync(service.artifact(job.id, 'output').file, path.join(directory, 'formatted.docx'));
    console.log(JSON.stringify({ output: path.join(directory, 'formatted.docx'), report: job.layoutReport }));
    const checkDir = path.join(directory, 'output-inspection'); fs.mkdirSync(checkDir, { recursive: true });
    const inspection = await runWordWorker({ action: 'inspect', inputPath: service.artifact(job.id, 'output').file, workDirectory: checkDir, progressPath: path.join(checkDir, 'progress.txt') }, { root });
    const recognized = detectFrontMatter(inspection);
    if (!recognized.cover?.standard || recognized.toc?.kind !== 'native') throw Error('Generated standard cover / native TOC were not recognized for subsequent processing: ' + JSON.stringify(recognized));
    console.log('PASS: generated standard cover and native TOC are recognized on a subsequent inspection.');
  } finally { service.shutdown(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
