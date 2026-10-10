'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeLayout, detectFrontMatter } = require('../src/word-layout');
const { WordFormatService, validatePlan } = require('../src/word-format');
function paragraphs(texts) { let position = 0; return texts.map((text, i) => { const p = { index: i + 1, text, start: position, end: position + text.length + 1, editable: true, breakAfter: text.includes('\f') }; position = p.end; return p; }); }

test('layout options are bounded plain text and explicit enums, not templates or executable code', () => {
  assert.deepEqual(normalizeLayout().toc, { mode: 'keep', levels: 3 });
  assert.equal(normalizeLayout().imageCells, true);
  for (const value of [null, [], { cover: { mode: 'delete-all' } }, { cover: { mode: 'standard' } }, { cover: { company: '跨\n段' } }, { toc: { levels: 0 } }, { toc: { levels: 5 } }, { imageCells: 'false' }]) assert.throws(() => normalizeLayout(value));
});

test('cover and manual contents are only recognized inside explicit, conservative front-matter ranges', () => {
  const p = paragraphs(['风电工程初步设计', '编制单位：工程院', '审核：甲', '2026 年 10 月\f', '目 录', '1 项目概况\t1', '2 道路设计……3', '\f', '1 项目概况', '设计标高 10.000 m。']);
  const found = detectFrontMatter({ paragraphs: p });
  assert.equal(found.cover.first, 1); assert.equal(found.cover.last, 4);
  assert.equal(found.toc.kind, 'manual'); assert.equal(found.toc.first, 5); assert.equal(found.toc.last, 8);
  assert.equal(found.bodyFirst, 9);
  assert.equal(detectFrontMatter({ paragraphs: paragraphs(['工程设计', '项目概况', '编制：甲', '实际正文技术要求。']) }).cover, null);
  p[3].sectionBreak = true;
  assert.equal(detectFrontMatter({ paragraphs: p }).cover, null);
});

test('ambiguous contents are flagged, native contents have exact ranges and body prose is not consumed', () => {
  const p = paragraphs(['目录', '1 工程设计技术要求', '道路宽度为 4 m。']);
  assert.equal(detectFrontMatter({ paragraphs: p }).ambiguousToc, true);
  const native = detectFrontMatter({ paragraphs: p, nativeTocs: [{ first: 2, last: 2, start: p[1].start, end: p[1].end }] });
  assert.equal(native.toc.kind, 'native'); assert.equal(native.toc.first, 1); assert.equal(native.bodyFirst, 3);
  assert.equal(native.toc.end, p[1].end);
});

test('cover/TOC processing requires review even in local VBA mode and persists the reviewed options', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-layout-'));
  let formatted;
  const service = new WordFormatService({ dataDir, root: path.join(__dirname, '..'), runner: async request => {
    if (request.action === 'inspect') return { paragraphs: paragraphs(['1 项目概况', '道路宽度为 4 m。']), paragraphCount: 2 };
    formatted = request; fs.writeFileSync(request.outputPath, Buffer.from('PK\x03\x04')); return { report: 'Finished.', layoutReport: 'Native TOC', paragraphs: 2 };
  } });
  t.after(() => { service.shutdown(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const file = service.upload('test.docx', Buffer.from('PK\x03\x04'));
  const created = service.create({ fileId: file.id, confirmVba: true, layout: { cover: { mode: 'standard', title: '初步设计说明书' }, toc: { mode: 'rebuild' } } });
  await service.tail;
  const job = service.get(created.id); assert.equal(job.state, 'awaiting-review'); assert.equal(formatted, undefined);
  assert.throws(() => service.apply(job.id, { confirmApply: true, changes: [] }), /识别范围/);
  service.apply(job.id, { confirmApply: true, confirmLayout: true, changes: [] }); await service.tail;
  assert.equal(job.state, 'completed'); assert.equal(formatted.layout.cover.title, '初步设计说明书'); assert.equal(formatted.layout.toc.levels, 3);
  assert.equal(job.layoutReport, 'Native TOC');
  assert.throws(() => validatePlan({ changes: [{ index: 1, role: 'body', replacement: '改掉封面' }] }, [{ index: 1, text: '封面', editable: false }]), /拒绝/);
});

test('trusted image layout preserves existing cells and excludes headers, linked pictures and unsupported shapes', () => {
  const code = fs.readFileSync(path.join(__dirname, '../assets/word-format/SpecFlowLayout.bas'), 'ascii');
  assert.match(code, /wdMainTextStory/); assert.match(code, /wdLineSpaceSingle/); assert.match(code, /NumRows:=1, NumColumns:=1/);
  assert.match(code, /wdRowHeightAuto/); assert.match(code, /LockAspectRatio = msoTrue/);
  assert.match(code, /wdInlineShapeLinkedPicture/); assert.match(code, /UseHyperlinks:=True/);
  assert.doesNotMatch(code, /\b(?:Shell|CreateObject|FollowHyperlink|Selection|MsgBox)\b/);
});
