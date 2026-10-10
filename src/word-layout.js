'use strict';

// Conservative front-matter detection. A physical page number alone is not a
// deletion boundary: only an explicit page break / page-break-before is accepted.
const clean = text => String(text || '').replace(/[\r\x07\x0c]/g, '').trim();
const contentsTitle = text => /^(目录|目錄|contents|table of contents)$/i.test(clean(text).replace(/\s/g, ''));
const entry = text => /(?:\t|[.…·]{2,}|\s{2,})\s*[0-9ivxlcdm一二三四五六七八九十]+\s*$/i.test(clean(text));

function normalizeLayout(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('封面与目录设置无效。');
  const cover = value.cover || {}, mode = cover.mode || 'keep', preset = cover.preset || 'engineering';
  if (!['keep', 'standard'].includes(mode) || !['engineering', 'report'].includes(preset)) throw new Error('封面模式或预设无效。');
  const toc = value.toc || {}, tocMode = toc.mode || 'keep', levels = toc.levels === undefined ? 3 : Number(toc.levels);
  if (!['keep', 'rebuild'].includes(tocMode) || !Number.isInteger(levels) || levels < 1 || levels > 4) throw new Error('目录层级应为 1 到 4。');
  const result = { cover: { mode, preset }, toc: { mode: tocMode, levels }, imageCells: value.imageCells !== false };
  for (const key of ['project', 'title', 'company', 'author', 'reviewer', 'approver', 'date', 'number']) {
    const text = cover[key] === undefined ? '' : String(cover[key]).trim();
    if (text.length > (key === 'title' || key === 'project' ? 100 : 80) || /[\x00-\x1f\x7f]/.test(text)) throw new Error('封面内容过长或含有换行 / 控制字符。');
    result.cover[key] = text;
  }
  if (mode === 'standard' && !result.cover.title) throw new Error('请填写标准封面的文档名称。');
  if (value.imageCells !== undefined && typeof value.imageCells !== 'boolean') throw new Error('图片单元格选项无效。');
  return result;
}

function span(items, kind) {
  return { kind, first: items[0].index, last: items.at(-1).index,
    start: items[0].start, end: items.at(-1).end, firstText: items[0].text,
    lastText: items.at(-1).text, preview: items.map(p => clean(p.text)).filter(Boolean).slice(0, 8) };
}

function detectFrontMatter(inspection) {
  const items = inspection.paragraphs || [], warnings = [];
  const nativeTocs = inspection.nativeTocs || [];
  let toc = null, cover = null, ambiguousToc = false;
  // Restrict automatic replacement to the leading contents, not appendices or
  // tables of figures later in the engineering body.
  const titleIndex = items.findIndex(p => p.index <= 150 && contentsTitle(p.text));
  const firstNative = nativeTocs.find(t => t.first <= 150);
  if (firstNative) {
    const from = items.findIndex(p => p.index === firstNative.first);
    const to = items.findIndex(p => p.index === firstNative.last);
    if (from >= 0 && to >= from) {
      const heading = from > 0 && contentsTitle(items[from - 1].text) ? from - 1 : from;
      toc = { ...span(items.slice(heading, to + 1), 'native'), start: items[heading].start, end: firstNative.end };
    } else warnings.push('原生目录超出可安全识别的范围；不自动删除。');
  } else if (titleIndex >= 0) {
    let last = titleIndex, entries = 0;
    for (let i = titleIndex + 1; i < items.length && i < titleIndex + 180; i++) {
      const p = items[i];
      if (!clean(p.text)) { last = i; if (p.breakAfter) break; continue; }
      if (!entry(p.text) || p.inTable || p.pictures || p.sectionBreak) break;
      entries++; last = i;
      if (p.breakAfter) break;
    }
    if (entries >= 2) toc = span(items.slice(titleIndex, last + 1), 'manual');
    else { ambiguousToc = true; warnings.push('发现“目录”标题，但不能可靠区分目录条目与正文。请选择保留原目录，避免误删。'); }
  }
  // A cover must be an explicitly separated front page with repeated cover
  // metadata. This deliberately leaves title pages containing body prose alone.
  let boundary = -1;
  for (let i = 0; i < Math.min(items.length, 60); i++) {
    if (toc && items[i].index >= toc.first) { boundary = i - 1; break; }
    if (items[i].breakAfter) { boundary = i; break; }
    if (i > 0 && items[i].breakBefore) { boundary = i - 1; break; }
  }
  if (boundary >= 0) {
    const candidate = items.slice(0, boundary + 1), texts = candidate.map(p => clean(p.text)).filter(Boolean);
    const metadata = texts.filter(t => /(?:编制|编写|编制单位|设计单位|建设单位|审核|审定|批准|项目名称|工程名称|日期|[12][0-9]{3}\s*年)/.test(t)).length;
    const documentTitle = texts.some(t => t.length <= 100 && /(?:设计|报告|方案|说明书|技术|规划|工程)/.test(t));
    const bodyLike = texts.some(t => t.length > 180 || !/^[12][0-9]{3}\s*年/.test(t) && /^(?:第[一二三四五六七八九十0-9]+章|[1-9][0-9]*(?:[.．][0-9]+)*[\s、.．]+\S)/.test(t));
    const standard = inspection.standardCover && inspection.standardCover.start === 0 && inspection.standardCover.end === candidate.at(-1)?.end && candidate.every(p => !p.page || p.page === 1);
    if (metadata >= 2 && documentTitle && !bodyLike && !candidate.some(p => p.inTable || p.sectionBreak && !standard)) cover = { ...span(candidate, 'cover'), standard: !!standard };
    else if (documentTitle && metadata) warnings.push('首页可能是封面，但结构不够明确；旧首页保留，标准封面会插入在它前面。');
  }
  // Section breaks carry section/page/header configuration; never delete them.
  for (const key of ['cover', 'toc']) {
    const found = key === 'cover' ? cover : toc;
    if (found && !found.standard && items.some(p => p.index >= found.first && p.index <= found.last && p.sectionBreak)) {
      warnings.push('识别范围含分节符，保留原内容以保护页面和页眉设置。');
      if (key === 'cover') cover = null; else { toc = null; ambiguousToc = true; }
    }
  }
  const frontEnd = Math.max(cover?.last || 0, toc?.last || 0);
  return { cover, toc, ambiguousToc, warnings, bodyFirst: items.find(p => p.index > frontEnd && clean(p.text))?.index || 1 };
}

function layoutReview(options) { return options.cover.mode === 'standard' || options.toc.mode === 'rebuild'; }
module.exports = { normalizeLayout, detectFrontMatter, layoutReview };
