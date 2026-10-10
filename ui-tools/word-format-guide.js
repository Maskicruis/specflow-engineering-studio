(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WordFormatGuide = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var activeStates = ['queued', 'inspecting', 'analyzing', 'formatting'];
  function active(job) { return !!job && activeStates.includes(job.state); }
  function readiness(input) {
    if (input.busy) return { ready: false, step: 1, hint: '正在接收文件或提交任务，请稍候…' };
    if (active(input.job)) return { ready: false, step: 3, hint: '任务正在后台运行，结果会实时显示在右侧。' };
    if (input.job && input.job.state === 'awaiting-review') return { ready: false, step: 3, hint: '下一步：在右侧审核建议，点击「按审核结果统一格式」。' };
    if (input.job && input.job.state === 'completed') return { ready: false, step: 4, hint: '下一步：点击右侧「下载标准化 DOCX」保存副本。' };
    if (input.job) return { ready: false, step: 3, hint: '请查看右侧原因，点击「返回准备，重新处理」或选择另一份文档。' };
    if (!input.file) return { ready: false, step: 1, hint: '下一步：拖入 Word 文档，或点击「选择文件」。' };
    if (input.checking) return { ready: false, step: 2, hint: '正在检查 Word 环境，通常需要几秒钟，请稍候…' };
    if (!input.environment) return { ready: false, step: 2, hint: '下一步：点击上方「重新检测」，确认 Word 与 VBA 可用。' };
    if (!input.environment.installed) return { ready: false, step: 2, hint: '需要安装并首次启动 Microsoft Word，再点击「重新检测」。' };
    if (!input.environment.vbaAccess) return { ready: false, step: 2, hint: 'Word 的 VBA 访问未开启，请按「使用说明」准备环境，再重新检测。' };
    if (input.mode === 'vba-llm' && !input.environment.llmConfigured) return { ready: false, step: 2, hint: '请在主程序「设置 → 模型接口」配置模型后重新检测，或改选「只统一格式」。' };
    if (!input.confirmVba) return { ready: false, step: 2, hint: '下一步：勾选左侧「允许执行随附 VBA」，仅处理文档副本。' };
    if (input.mode === 'vba-llm' && !input.confirmLlm) return { ready: false, step: 2, hint: '下一步：勾选左侧「同意将提取的文档文本发送到模型接口」。' };
    return { ready: true, step: 2, hint: input.mode === 'vba-llm' ? '准备就绪：点击下方按钮生成建议；审核后才会排版。' : '准备就绪：点击「开始统一格式」，完成后下载新 DOCX。' };
  }
  function errorHint(message) {
    var text = String(message || '');
    if (/VBA_ACCESS|VBA.*访问|VBProject|VBComponents/i.test(text)) return '打开右上角「使用说明」中的 VBA 环境说明。确认 Word 的「信任对 VBA 工程对象模型的访问」后，重新检测再重试。';
    if (/protected|protection|password|受保护|密码/i.test(text)) return '请在 Word 中打开独立副本，解除保护或密码并保存，再选择该副本。';
    if (/revision|修订/i.test(text)) return '请先在 Word 的独立副本中审核已有修订，再重新上传。不要覆盖原件。';
    if (/LLM|模型|401|403|429|API|fetch|连接|timeout|超时/i.test(text)) return '检查主程序模型与 API 设置。只需要排版时，可返回准备并改选「只统一格式」，不调用模型。';
    if (/Word.*(未安装|无法启动)|COM|RPC|class not registered/i.test(text)) return '先手动启动 Microsoft Word，完成首次启动，关闭 Word 的提示或对话框，再重新检测。';
    return '原件仍保持不变。检查 Word 是否有未关闭的提示；返回准备后重试。若仍失败，请保留上面的错误信息。';
  }
  function progress(message) {
    var map = {
      'Opening a protected copy of the Word file': '正在打开文档副本（输入宏已禁用）…',
      'Word document opened': '已打开副本，正在检查文档…',
      'Saving the macro-free working copy': '正在创建不含输入宏的工作副本…',
      'Created the macro-free working copy': '工作副本已创建…',
      'Loading the trusted VBA module': '正在载入随附 VBA 排版规则…',
      'Running the bundled V35.1 VBA formatter': '正在运行 V35.1 全文排版规则…'
    };
    return map[message] || (/^[\x00-\x7f]+$/.test(String(message || '')) ? '正在执行排版步骤：' + message : message);
  }
  return { readiness: readiness, active: active, errorHint: errorHint, progress: progress };
});
