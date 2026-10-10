(function () {
  'use strict';
  var file = null, job = null, feed = null, environment = null, busy = false, checking = false, statusRequest = null;
  var guide = window.WordFormatGuide;
  var layoutIds = ['wordCoverMode', 'wordCoverPreset', 'wordCoverProject', 'wordCoverTitle', 'wordCoverCompany', 'wordCoverAuthor', 'wordCoverReviewer', 'wordCoverApprover', 'wordCoverDate', 'wordCoverNumber', 'wordRebuildToc', 'wordTocLevels', 'wordImageCells', 'saveWordCoverPreset'];
  function layoutOptions() {
    var cover = { mode: el('wordCoverMode').value || 'keep', preset: el('wordCoverPreset').value || 'engineering' };
    ['project', 'title', 'company', 'author', 'reviewer', 'approver', 'date', 'number'].forEach(function (key) { cover[key] = el('wordCover' + key[0].toUpperCase() + key.slice(1)).value.trim(); });
    return { cover: cover, toc: { mode: el('wordRebuildToc').checked ? 'rebuild' : 'keep', levels: Number(el('wordTocLevels').value) || 3 }, imageCells: el('wordImageCells').checked };
  }
  function syncLayout() { el('wordCoverFields').hidden = el('wordCoverMode').value !== 'standard'; el('wordTocLevelsField').hidden = !el('wordRebuildToc').checked; sync(); }
  function needsLayoutReview() { return !!job && !!job.layout && (job.layout.cover.mode === 'standard' || job.layout.toc.mode === 'rebuild'); }
  var states = { queued: '等待处理', inspecting: '正在读取文档结构', analyzing: '模型正在分析结构', 'awaiting-review': '请审核建议后继续', formatting: '正在统一全文格式', completed: '已完成，可以下载副本', cancelled: '任务已取消', error: '任务未完成' };
  function el(id) { return document.getElementById(id); }
  function escape(value) { return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function state(message, error) { el('wordState').textContent = message || ''; el('wordState').classList.toggle('error', !!error); }
  function readiness() {
    var ready = guide.readiness({ file: file, job: job, busy: busy, checking: checking, environment: environment, mode: el('wordMode').value, confirmVba: el('confirmWordVba').checked, confirmLlm: el('confirmWordLlm').checked });
    if (ready.ready && el('wordCoverMode').value === 'standard' && !el('wordCoverTitle').value.trim()) return { ready: false, step: 2, hint: '请填写标准封面的文档名称。' };
    if (ready.ready && el('wordMode').value !== 'vba-llm' && (el('wordCoverMode').value === 'standard' || el('wordRebuildToc').checked)) ready.hint = '准备就绪：先识别封面与目录，在右侧核对范围后再排版。';
    return ready;
  }
  function sync() {
    var value = readiness(), locked = busy || guide.active(job) || !!job && job.state === 'awaiting-review';
    var structure = el('wordCoverMode').value === 'standard' || el('wordRebuildToc').checked;
    if (el('wordMode').value !== 'vba-llm') {
      el('startWord').textContent = structure ? '先识别封面与目录' : '开始统一格式';
      el('wordStep3Label').textContent = structure ? '核对并排版' : '统一格式';
      el('wordWelcomeMode').textContent = structure ? '勾选 VBA 授权，点击「先识别封面与目录」，在右侧核对范围并确认后继续排版。' : '保持推荐模式，勾选 VBA 授权，点击「开始统一格式」。';
    }
    el('wordNextHint').textContent = value.hint; el('startWord').disabled = !value.ready;
    el('newWordTask').hidden = !job; el('newWordTask').disabled = locked;
    ['chooseWordFile', 'wordFile', 'wordMode', 'confirmWordVba', 'confirmWordLlm', 'wordInstructions'].concat(layoutIds).forEach(function (id) { el(id).disabled = locked; });
    el('wordDrop').classList.toggle('locked', locked);
    el('detectWord').disabled = checking || locked;
    for (var index = 1; index <= 4; index++) {
      var step = el('wordStep' + index);
      step.classList.toggle('current', index === value.step);
      step.classList.toggle('done', index < value.step);
      if (index === value.step) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
    }
  }
  async function api(url, payload) {
    var response = await fetch('/api/v1/word-format/' + url, payload);
    var body = await response.json();
    if (!response.ok || body.ok === false) throw new Error(body.error && body.error.message || '请求失败');
    return body.data || body;
  }
  function post(value) { return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value || {}) }; }
  function syncMode() {
    var llm = el('wordMode').value === 'vba-llm';
    el('instructionsField').hidden = !llm; el('llmConsentField').hidden = !llm;
    el('startWord').textContent = llm ? '先分析结构，生成审核建议' : '开始统一格式';
    el('wordStep3Label').textContent = llm ? '审核并排版' : '统一格式';
    el('wordModeDescription').textContent = llm ? '模型先提出结构建议，您审核后再排版。需要模型配置，并同意发送文档文本。' : '运行 V35.1 全文排版规则，整理标题、正文、图表与页面。不调用模型；编号与题注也会调整。';
    el('wordWelcomeMode').textContent = llm ? '勾选 VBA 与模型文本发送授权，生成建议。随后在这里审核并继续排版。' : '保持推荐模式，勾选 VBA 授权，点击「开始统一格式」。';
    sync();
  }
  function clearJob() {
    if (feed) { feed.close(); feed = null; }
    job = null;
    el('wordJobTitle').textContent = '准备处理文档'; el('wordJobStatus').textContent = '按左侧提示完成准备，再开始处理';
    ['wordProgress', 'cancelWordJob', 'wordJobError', 'wordAnalysis', 'wordReview', 'wordCompleted'].forEach(function (id) { el(id).hidden = true; });
    el('wordWelcome').hidden = false; state(''); syncMode(); recent();
  }
  async function upload(input) {
    if (busy || guide.active(job) || job && job.state === 'awaiting-review' || !input) return;
    if (!/\.(docx|doc)$/i.test(input.name) || input.size > 50 * 1024 * 1024) { state('请选择 50 MB 以内的 DOCX / DOC 文件。', true); return; }
    clearJob(); file = null; el('confirmWordVba').checked = false; el('confirmWordLlm').checked = false;
    busy = true; sync(); state('正在接收文档副本…');
    try {
      file = await api('files', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(input.name) }, body: input });
      el('wordFileInfo').textContent = file.name + ' · ' + (file.size / 1048576).toFixed(1) + ' MB';
      el('wordCoverTitle').value = file.name.replace(/\.(docx|doc)$/i, '').slice(0, 100);
      state('文档已接收。请按上面的「下一步」提示继续。');
    } catch (error) { el('wordFileInfo').textContent = '未能接收文件，请重新选择'; state(error.message, true); }
    finally { busy = false; sync(); }
  }
  async function detect() {
    if (statusRequest) return statusRequest;
    checking = true; environment = null; sync();
    el('wordEnvironmentTitle').textContent = '正在检查运行环境';
    el('wordEnvironment').textContent = '正在检查 Microsoft Word 与 VBA 权限，请稍候…';
    var banner = el('wordEnvironmentTitle').closest('.word-environment'); banner.classList.remove('ready', 'warning');
    statusRequest = (async function () {
      try {
        environment = await api('status');
        var usable = environment.installed && environment.vbaAccess;
        el('wordEnvironmentTitle').textContent = usable ? 'Word 排版环境可用' : '环境需要准备';
        banner.classList.toggle('ready', usable); banner.classList.toggle('warning', !usable);
        el('wordEnvironment').textContent = environment.installed ? 'Microsoft Word ' + environment.version + ' · VBA ' + (environment.vbaAccess ? '可用' : '未开启（见使用说明）') + ' · 模型 ' + (environment.llmConfigured ? '已配置' : '未配置；只统一格式不需要模型') : environment.error || '未检测到 Microsoft Word，请先安装并完成首次启动。';
      } catch (error) { el('wordEnvironmentTitle').textContent = '环境检测失败'; el('wordEnvironment').textContent = error.message; banner.classList.add('warning'); }
      finally { checking = false; statusRequest = null; sync(); }
    })();
    return statusRequest;
  }
  async function recent() {
    try {
      var value = await api('jobs');
      el('wordRecentJobs').innerHTML = value.items.length ? value.items.slice(0, 12).map(function (item) { return '<button data-word-job="' + escape(item.id) + '" class="' + (job && job.id === item.id ? 'active' : '') + '"><span>' + escape(item.name) + '</span><small>' + escape(states[item.state] || item.state) + '</small></button>'; }).join('') : '还没有任务。完成左侧准备后即可开始。';
    } catch (_) { el('wordRecentJobs').textContent = '任务列表暂时不可用，请稍后重新打开此窗口。'; }
  }
  function selectedChanges() {
    return Array.from(el('wordPlanRows').querySelectorAll('tr')).filter(function (row) { return row.querySelector('.plan-selected').checked; }).map(function (row) { return { index: Number(row.dataset.planIndex), role: row.querySelector('.plan-role').value, applyText: !!(row.querySelector('.plan-text') && row.querySelector('.plan-text').checked) }; });
  }
  function reviewCount() {
    var changes = selectedChanges(), textCount = changes.filter(function (item) { return item.applyText; }).length;
    el('wordSelectedCount').textContent = '采用 ' + changes.length + ' 项建议 · 文字修改 ' + textCount + ' 项';
    var layoutBlocked = !!(needsLayoutReview() && (!el('confirmWordLayout').checked || job.layout.toc.mode === 'rebuild' && job.frontMatter && job.frontMatter.ambiguousToc));
    el('applyWordPlan').disabled = !!textCount && !el('confirmWordText').checked || layoutBlocked;
    el('wordReviewHint').textContent = textCount && !el('confirmWordText').checked ? '勾选了文字建议，请另外勾选下方文字修订授权；也可以取消文字建议。' : job && job.plan && job.plan.length ? '审核下方建议。只需排版时，可取消全部建议后继续。' : '模型没有提出可应用的结构建议。仍可点击下方按钮执行全文规则排版。';
    if (needsLayoutReview()) el('wordReviewHint').textContent = layoutBlocked ? '先核对封面与目录识别结果，勾选上方确认；识别不明确时请取消并选择保留原目录。' : '封面与目录范围已确认，可以继续排版。';
  }
  function review(plan) {
    var labels = { keep: '保留原结构', body: '正文', heading1: '一级标题', heading2: '二级标题', heading3: '三级标题', heading4: '四级标题' };
    el('wordPlanRows').innerHTML = plan.map(function (item) {
      var options = Object.keys(labels).map(function (role) { return '<option value="' + role + '"' + (item.role === role ? ' selected' : '') + '>' + labels[role] + '</option>'; }).join('');
      return '<tr data-plan-index="' + item.index + '"><td><input class="plan-selected" type="checkbox"' + (item.selected ? ' checked' : '') + ' aria-label="采用第 ' + item.index + ' 段建议"></td><td><div class="word-plan-text"><b>第 ' + item.index + ' 段</b><br>' + escape(item.originalText.slice(0, 400)) + '</div><div class="word-plan-reason">' + escape(item.reason) + '</div></td><td><select class="plan-role" aria-label="目标结构">' + options + '</select></td><td>' + (item.replacement ? '<div class="word-plan-text">' + escape(item.replacement) + '</div><label class="word-check"><input class="plan-text" type="checkbox">采用文字建议</label>' : '<span class="word-muted">不改文字</span>') + '</td></tr>';
    }).join('');
    el('wordReviewTable').hidden = !plan.length;
    el('wordTextConsent').hidden = !plan.some(function (item) { return !!item.replacement; });
    el('confirmWordText').checked = false; reviewCount();
  }
  function render(value) {
    job = value;
    if (value.layout) {
      el('wordCoverMode').value = value.layout.cover.mode; el('wordCoverPreset').value = value.layout.cover.preset;
      ['project', 'title', 'company', 'author', 'reviewer', 'approver', 'date', 'number'].forEach(function (key) { el('wordCover' + key[0].toUpperCase() + key.slice(1)).value = value.layout.cover[key] || ''; });
      el('wordRebuildToc').checked = value.layout.toc.mode === 'rebuild'; el('wordTocLevels').value = String(value.layout.toc.levels); el('wordImageCells').checked = value.layout.imageCells;
      el('wordCoverFields').hidden = value.layout.cover.mode !== 'standard'; el('wordTocLevelsField').hidden = value.layout.toc.mode !== 'rebuild';
    }
    file = { id: value.fileId, name: value.name };
    el('wordFileInfo').textContent = value.name + ' · 已接收副本';
    el('wordJobTitle').textContent = job.name; el('wordJobStatus').textContent = states[job.state] || job.state;
    var active = guide.active(job);
    el('wordWelcome').hidden = true; el('wordProgress').hidden = !active; el('wordProgressText').textContent = states[job.state] || job.state;
    el('cancelWordJob').hidden = !active && job.state !== 'awaiting-review';
    el('wordAnalysis').hidden = !job.analysis; el('wordAnalysisText').textContent = job.analysis || '';
    el('wordReview').hidden = job.state !== 'awaiting-review'; el('wordCompleted').hidden = job.state !== 'completed';
    el('wordJobError').hidden = !['error', 'cancelled'].includes(job.state);
    el('wordLayoutReview').hidden = !needsLayoutReview();
    if (job.state === 'awaiting-review') {
      el('confirmWordLayout').checked = false;
      if (needsLayoutReview()) {
        var front = job.frontMatter || {}, messages = [];
        if (job.layout.cover.mode === 'standard') messages.push(front.cover ? '<p><b>旧封面：第 ' + front.cover.first + '–' + front.cover.last + ' 段，将替换</b></p><pre>' + escape(front.cover.preview.join('\n')) + '</pre>' : '<p>没有可靠识别到旧封面：插入新封面，旧首页保留。</p>');
        if (job.layout.toc.mode === 'rebuild') messages.push(front.toc ? '<p><b>旧目录：第 ' + front.toc.first + '–' + front.toc.last + ' 段，将重建为可更新目录</b></p><pre>' + escape(front.toc.preview.join('\n')) + '</pre>' : '<p>未识别到旧目录：将在正文前插入可更新目录。</p>');
        messages = messages.concat((front.warnings || []).map(function (text) { return '<p class="word-warning">' + escape(text) + '</p>'; }));
        el('wordLayoutSummary').innerHTML = messages.join('');
      }
      el('wordSummary').textContent = job.summary || '请选择要采用的结构建议。'; el('wordTruncated').hidden = !job.truncated; review(job.plan || []);
    }
    if (job.state === 'completed') { el('downloadWord').href = job.outputUrl; el('downloadWordReport').href = job.reportUrl; el('wordVbaReport').textContent = (job.layoutReport || '') + '\n' + (job.report || ''); state('已完成，请在右侧下载标准化副本。'); }
    if (['error', 'cancelled'].includes(job.state)) {
      el('wordJobErrorTitle').textContent = job.state === 'cancelled' ? '任务已取消' : '任务未完成';
      el('wordJobErrorText').textContent = job.error || '已停止处理，原件保持不变。';
      el('wordJobErrorHint').textContent = job.state === 'cancelled' ? '返回准备可重新运行。已取消的任务不会提供未完成的输出文件。' : guide.errorHint(job.error);
      state(job.state === 'error' ? '请查看右侧的错误原因与处理建议。' : '任务已取消。', job.state === 'error');
    }
    if (!active && feed) { feed.close(); feed = null; }
    sync(); recent();
  }
  function watch(id) {
    if (feed) feed.close();
    feed = new EventSource('/api/v1/word-format/jobs/' + encodeURIComponent(id) + '/events');
    feed.onmessage = function (message) {
      if (!job || job.id !== id) return;
      var event; try { event = JSON.parse(message.data); } catch (_) { return; }
      if (event.job) render(event.job);
      if (event.type === 'delta') { job.analysis = (job.analysis || '') + event.text; el('wordAnalysis').hidden = false; el('wordAnalysisText').textContent = job.analysis; }
      if (event.type === 'progress') el('wordProgressText').textContent = guide.progress(event.message);
    };
    feed.onerror = function () { if (guide.active(job)) el('wordProgressText').textContent = '连接暂时中断，正在重连…任务仍在后台运行。'; };
  }
  async function start() {
    var ready = readiness(); if (!ready.ready) { state(ready.hint, true); return; }
    busy = true; sync();
    try {
      var created = await api('jobs', post({ fileId: file.id, mode: el('wordMode').value, layout: layoutOptions(), instructions: el('wordInstructions').value, confirmVba: el('confirmWordVba').checked, confirmLlm: el('wordMode').value === 'vba-llm' && el('confirmWordLlm').checked }));
      state('任务已开始，右侧会实时显示进度。'); render(created); watch(created.id);
    } catch (error) { state(error.message, true); }
    finally { busy = false; sync(); }
  }
  async function apply() {
    if (busy || !job || job.state !== 'awaiting-review') return;
    var changes = selectedChanges();
    if (needsLayoutReview() && (!el('confirmWordLayout').checked || job.layout.toc.mode === 'rebuild' && job.frontMatter && job.frontMatter.ambiguousToc)) { state('请核对并确认封面、目录范围；识别不明确时请取消任务并选择保留。', true); return; }
    if (changes.some(function (item) { return item.applyText; }) && !el('confirmWordText').checked) { state('采用文字建议前，需要单独勾选文字修订授权。', true); return; }
    if (!confirm('按您审核的建议运行 VBA 并生成独立副本？未勾选的模型建议不会采用。')) return;
    busy = true; el('applyWordPlan').disabled = true; sync();
    try { var updated = await api('jobs/' + job.id + '/apply', post({ changes: changes, confirmApply: true, confirmLayout: el('confirmWordLayout').checked, confirmTextEdits: el('confirmWordText').checked })); render(updated); watch(updated.id); }
    catch (error) { state(error.message, true); }
    finally { busy = false; if (job && job.state === 'awaiting-review') reviewCount(); sync(); }
  }
  el('chooseWordFile').addEventListener('click', function () { el('wordFile').click(); });
  el('wordFile').addEventListener('change', function () { upload(el('wordFile').files[0]); el('wordFile').value = ''; });
  el('wordDrop').addEventListener('dragover', function (event) { event.preventDefault(); el('wordDrop').classList.add('dragging'); });
  el('wordDrop').addEventListener('dragleave', function () { el('wordDrop').classList.remove('dragging'); });
  el('wordDrop').addEventListener('drop', function (event) { event.preventDefault(); el('wordDrop').classList.remove('dragging'); upload(event.dataTransfer.files[0]); });
  document.addEventListener('dragover', function (event) { event.preventDefault(); }); document.addEventListener('drop', function (event) { event.preventDefault(); });
  el('wordMode').addEventListener('change', function () { state(''); syncMode(); });
  ['confirmWordVba', 'confirmWordLlm'].forEach(function (id) { el(id).addEventListener('change', function () { state(''); sync(); }); });
  el('startWord').addEventListener('click', start); el('detectWord').addEventListener('click', detect); el('applyWordPlan').addEventListener('click', apply);
  el('wordPlanRows').addEventListener('change', reviewCount); el('confirmWordText').addEventListener('change', reviewCount);
  el('confirmWordLayout').addEventListener('change', reviewCount);
  layoutIds.forEach(function (id) { el(id).addEventListener('change', syncLayout); });
  el('wordCoverTitle').addEventListener('input', sync);
  el('saveWordCoverPreset').addEventListener('click', function () {
    var value = layoutOptions().cover; delete value.project; delete value.title; delete value.mode; delete value.number;
    try { localStorage.setItem('specflow-word-cover-preset', JSON.stringify(value)); state('已记住单位、编审人员和日期；下次打开本窗口自动填入。'); } catch (_) { state('本机预设暂时无法保存。', true); }
  });
  el('wordHelpToggle').addEventListener('click', function () { el('wordHelp').hidden = !el('wordHelp').hidden; el('wordHelpToggle').setAttribute('aria-expanded', String(!el('wordHelp').hidden)); });
  el('newWordTask').addEventListener('click', function () { if (guide.active(job) || job && job.state === 'awaiting-review') return; file = null; el('wordFileInfo').textContent = '尚未选择文件'; el('confirmWordVba').checked = false; el('confirmWordLlm').checked = false; clearJob(); });
  el('retryWordTask').addEventListener('click', function () { if (!job || !['error', 'cancelled'].includes(job.state)) return; clearJob(); });
  el('cancelWordJob').addEventListener('click', async function () { try { if (job) { var cancelled = await api('jobs/' + job.id + '/cancel', post()); render(cancelled); state('正在停止专用排版任务，请稍候…'); } } catch (error) { state(error.message, true); } });
  el('wordRecentJobs').addEventListener('click', async function (event) {
    var button = event.target.closest('[data-word-job]');
    if (button && !busy && !guide.active(job)) {
      try {
        var value = await api('jobs/' + button.dataset.wordJob);
        if (feed) { feed.close(); feed = null; }
        el('wordMode').value = value.mode; el('confirmWordVba').checked = false; el('confirmWordLlm').checked = false;
        state(''); render(value); syncMode(); if (guide.active(value)) watch(value.id);
      } catch (error) { state(error.message, true); }
    }
  });
  el('wordTheme').addEventListener('click', function () { var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('kb-theme', theme); });
  window.addEventListener('storage', function (event) { if (event.key === 'kb-theme') document.documentElement.setAttribute('data-theme', event.newValue || 'dark'); });
  window.addEventListener('beforeunload', function () { if (feed) feed.close(); });
  try {
    var preset = JSON.parse(localStorage.getItem('specflow-word-cover-preset') || '{}');
    ['company', 'author', 'reviewer', 'approver', 'date'].forEach(function (key) { if (typeof preset[key] === 'string') el('wordCover' + key[0].toUpperCase() + key.slice(1)).value = preset[key].slice(0, 80); });
    el('wordCoverPreset').value = preset.preset === 'report' ? 'report' : 'engineering';
  } catch (_) {}
  syncLayout(); syncMode(); recent(); detect();
})();
