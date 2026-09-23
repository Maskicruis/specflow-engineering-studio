(function(){
'use strict';

var workspaceState={settings:{defaultFolders:[]},projects:[],current:null};
var designToolState={items:[]};
function dataOf(value){return value&&value.data!==undefined?value.data:value;}
function studioState(id,text,kind){var el=document.getElementById(id);if(!el)return;el.textContent=text||'';el.className='studio-state '+(kind||'');}

async function loadEngineeringWorkspace(preferredId){
  try{
    var snapshot=dataOf(await api('v1/workspace'));
    workspaceState.settings=snapshot.settings||{defaultFolders:[]}; workspaceState.projects=snapshot.projects||[];
    var select=document.getElementById('projectSelect');
    if(select){select.innerHTML='<option value="">选择已有项目…</option>'+workspaceState.projects.map(function(p){return '<option value="'+attr(p.id)+'">'+esc(p.name)+'</option>';}).join('');}
    var id=preferredId||(workspaceState.current&&workspaceState.current.id)||(select&&select.value)||'';
    if(!id&&workspaceState.projects.length) id=workspaceState.projects[0].id;
    if(select) select.value=id;
    var folders=document.getElementById('projectFolderTemplates');if(folders)folders.value=(workspaceState.settings.defaultFolders||[]).join('\n');
    if(id) await openEngineeringProject(id); else renderEngineeringProject(null);
  }catch(error){studioState('projectCreateState','读取工程工作区失败：'+error.message,'bad');}
}

async function openEngineeringProject(id){
  if(!id){workspaceState.current=null;renderEngineeringProject(null);return;}
  try{workspaceState.current=dataOf(await api('v1/projects/'+encodeURIComponent(id)));renderEngineeringProject(workspaceState.current);}
  catch(error){studioState('projectCreateState','读取项目失败：'+error.message,'bad');}
}

function renderEngineeringProject(project){
  var empty=document.getElementById('projectEmpty'),content=document.getElementById('projectContent');
  if(empty)empty.style.display=project?'none':'block';if(content)content.style.display=project?'block':'none';
  if(!project)return;
  var title=document.getElementById('activeProjectTitle');if(title)title.textContent=project.name;
  var pathEl=document.getElementById('activeProjectPath');if(pathEl)pathEl.textContent=project.projectDirectory;
  var progress=project.checklistProgress||{ready:0,applicable:0,total:0,percent:0};
  var missing=Math.max(0,Number(progress.applicable||0)-Number(progress.ready||0));
  var metrics=document.getElementById('projectMetrics');if(metrics)metrics.innerHTML='<div class="metric-card"><strong>'+Number(project.folders.length||0)+'</strong><span>项目目录</span></div><div class="metric-card"><strong>'+Number(progress.percent||0)+'%</strong><span>资料完整率</span></div><div class="metric-card"><strong>'+missing+'</strong><span>待完善事项</span></div>';
  var folderList=document.getElementById('projectFolderList');if(folderList)folderList.innerHTML=(project.folders||[]).map(function(folder){return '<span class="folder-chip">'+esc(folder)+'</span>';}).join('');
  var bar=document.getElementById('checklistProgress');if(bar)bar.style.width=Number(progress.percent||0)+'%';
  var count=document.getElementById('checklistCount');if(count)count.textContent=progress.ready+' / '+progress.applicable+' 已具备';
  renderChecklist(project.checklist||[]);
}

function renderChecklist(items){
  var groups={};items.forEach(function(item){(groups[item.category]||(groups[item.category]=[])).push(item);});
  var list=document.getElementById('checklistList');if(!list)return;
  list.innerHTML=Object.keys(groups).map(function(category){return '<section class="check-group"><h4>'+esc(category)+'</h4>'+groups[category].map(function(item){return '<div class="check-item '+attr(item.status)+'" data-check-item="'+attr(item.id)+'"><select data-check-status="'+attr(item.id)+'"><option value="missing" '+(item.status==='missing'?'selected':'')+'>待收集</option><option value="ready" '+(item.status==='ready'?'selected':'')+'>已具备</option><option value="na" '+(item.status==='na'?'selected':'')+'>不适用</option></select><div class="check-label">'+esc(item.label)+'</div><input data-check-note="'+attr(item.id)+'" value="'+attr(item.note||'')+'" placeholder="备注、资料位置或责任人"></div>';}).join('')+'</section>';}).join('');
}

async function createEngineeringProject(){
  var name=document.getElementById('projectName').value.trim(),baseDirectory=document.getElementById('projectBase').value.trim();
  if(!name||!baseDirectory){studioState('projectCreateState','请填写项目名称并选择保存目录。','bad');return;}
  studioState('projectCreateState','正在创建标准项目目录…','');
  try{
    var created=dataOf(await api('v1/projects',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:name,baseDirectory:baseDirectory})}));
    studioState('projectCreateState','项目目录已创建：'+created.projectDirectory,'ok');
    await loadEngineeringWorkspace(created.id);
  }catch(error){studioState('projectCreateState','创建失败：'+error.message,'bad');}
}

async function chooseProjectBase(){if(!DESKTOP||!DESKTOP.dialog.chooseProjectDirectory)return;var value=await DESKTOP.dialog.chooseProjectDirectory();if(value)document.getElementById('projectBase').value=value;}
async function updateChecklist(itemId,patch){if(!workspaceState.current)return;try{workspaceState.current=dataOf(await api('v1/projects/'+encodeURIComponent(workspaceState.current.id)+'/checklist/'+encodeURIComponent(itemId),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(patch)}));renderEngineeringProject(workspaceState.current);}catch(error){studioState('projectCreateState','检查项保存失败：'+error.message,'bad');}}
async function addChecklistItem(){if(!workspaceState.current)return;var category=document.getElementById('customCheckCategory').value.trim(),label=document.getElementById('customCheckLabel').value.trim();if(!label)return;try{workspaceState.current=dataOf(await api('v1/projects/'+encodeURIComponent(workspaceState.current.id)+'/checklist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({category:category,label:label})}));document.getElementById('customCheckLabel').value='';renderEngineeringProject(workspaceState.current);}catch(error){studioState('projectCreateState','添加失败：'+error.message,'bad');}}
async function syncProjectFolders(){if(!workspaceState.current)return;try{workspaceState.current=dataOf(await api('v1/projects/'+encodeURIComponent(workspaceState.current.id)+'/folders/sync',{method:'POST'}));renderEngineeringProject(workspaceState.current);studioState('projectCreateState','目录模板已同步到当前项目。','ok');}catch(error){studioState('projectCreateState','同步失败：'+error.message,'bad');}}
async function saveWorkspaceSettings(){var values=document.getElementById('projectFolderTemplates').value.split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);try{workspaceState.settings=dataOf(await api('v1/workspace',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({defaultFolders:values})}));studioState('workspaceSettingsState','目录模板已保存，新建项目时生效。','ok');}catch(error){studioState('workspaceSettingsState','保存失败：'+error.message,'bad');}}

async function refreshBalance(){
  var button=document.getElementById('balanceTitleButton'),label=document.getElementById('balanceTitleLabel');if(!button||!label||!DESKTOP||!DESKTOP.balance)return;
  button.classList.add('loading');label.textContent='余额 …';
  try{var result=await DESKTOP.balance.get();button.classList.toggle('ok',!!result.ok);button.classList.toggle('warn',!result.ok);if(result.ok){var info=(result.balanceInfos||[]).find(function(x){return x.currency==='CNY';})||(result.balanceInfos||[])[0];label.textContent=(info&&info.currency==='CNY'?'¥ ':'')+(info?info.total_balance:'0.00');button.title='DeepSeek API 余额，点击刷新';}else{label.textContent=result.configured?'查询失败':'余额未配置';button.title=result.message||'点击刷新';}}
  catch(error){label.textContent='查询失败';button.classList.add('warn');button.title=error.message;}finally{button.classList.remove('loading');}
}

function renderDesignToolCatalog(){var cards=document.getElementById('toolCards'),items=designToolState.items||[];if(!cards||!items.length)return;cards.innerHTML=items.map(function(tool){var mode=tool.launchMode==='window'?'独立窗口':'外部程序',status=tool.kind==='built-in'?'内置':tool.available?'可用':'未配置',button=tool.launchMode==='window'?'打开独立窗口':'启动工具',disabled=tool.kind!=='built-in'&&!tool.available?' disabled':'';return'<article class="tool-card" data-tool-card data-tool-category="'+attr(tool.category||'general')+'" data-tool-name="'+attr([tool.name,tool.discipline,tool.description].join(' '))+'"><div class="tool-card-top"><div class="tool-icon">'+esc(tool.icon||'◇')+'</div><div class="tool-copy"><div class="tool-title-row"><strong>'+esc(tool.name)+'</strong><span class="tool-window-badge">'+esc(mode)+'</span></div><p>'+esc(tool.description||'工程设计工具')+'</p></div></div><div class="tool-card-foot"><div class="tool-meta"><span>'+esc(tool.discipline||'通用')+'</span><kbd>'+esc(String(tool.hotkey||'').replace(/\+/g,' + '))+'</kbd></div><div class="tool-card-actions"><span class="engine-badge">'+esc(status)+'</span><button class="btn btn-primary" data-tool-launch="'+attr(tool.id)+'"'+disabled+'>'+esc(button)+'</button></div></div></article>';}).join('');applyToolFilter();}
async function loadDesignTools(){if(!DESKTOP||!DESKTOP.designTools)return;try{designToolState=await DESKTOP.designTools.list();renderDesignToolCatalog();var calc=(designToolState.items||[]).find(function(x){return x.id==='calculator';});var pathInput=document.getElementById('calculatorPath');if(pathInput&&calc)pathInput.value=calc.path||'';var state=document.getElementById('calculatorState');if(state&&calc){state.textContent=calc.available?'可用：'+calc.path:'未找到程序，请重新选择';state.className='studio-state '+(calc.available?'ok':'bad');}}catch(error){studioState('calculatorState','读取设计工具失败：'+error.message,'bad');}}
async function chooseCalculator(){if(!DESKTOP||!DESKTOP.dialog.chooseDesignTool)return;var value=await DESKTOP.dialog.chooseDesignTool();if(value)document.getElementById('calculatorPath').value=value;}
async function saveCalculator(){if(!DESKTOP||!DESKTOP.designTools)return;try{await DESKTOP.designTools.update('calculator',{path:document.getElementById('calculatorPath').value});await loadDesignTools();}catch(error){studioState('calculatorState','保存失败：'+error.message,'bad');}}
async function launchDesignTool(id){var tool=(designToolState.items||[]).find(function(item){return item.id===id;})||{id:id,name:id,launchMode:id==='road-slope'?'window':'external',route:id==='road-slope'?'/tools/road-slope':''};try{if(DESKTOP&&DESKTOP.designTools){if(tool.launchMode==='window')await DESKTOP.designTools.openWindow(tool.id);else await DESKTOP.designTools.launch(tool.id);}else if(tool.route){var popup=window.open(tool.route,'specflow-tool-'+tool.id,'popup,width=1280,height=820');if(!popup)throw new Error('浏览器阻止了工具窗口，请允许弹出窗口。');}else throw new Error('仅桌面版支持启动本地程序。');studioState('toolLaunchState',tool.name+'已'+(tool.launchMode==='window'?'在独立窗口中打开。':'启动。'),'ok');}catch(error){studioState('toolLaunchState','打开工具失败：'+error.message,'bad');}}
async function launchCalculator(){return launchDesignTool('calculator');}
async function openRoadSlopeWindow(){return launchDesignTool('road-slope');}
var activeToolFilter='all';
function applyToolFilter(){var search=String(document.getElementById('toolSearch')?.value||'').trim().toLowerCase(),visible=0;document.querySelectorAll('[data-tool-card]').forEach(function(card){var category=card.getAttribute('data-tool-category'),name=String(card.getAttribute('data-tool-name')||'').toLowerCase(),show=(activeToolFilter==='all'||category===activeToolFilter)&&(!search||name.includes(search));card.hidden=!show;if(show)visible+=1;});var count=document.getElementById('toolResultCount');if(count)count.textContent=visible+' 项';var empty=document.getElementById('toolEmpty');if(empty)empty.hidden=visible!==0;}
function selectToolFilter(value){activeToolFilter=value||'all';document.querySelectorAll('[data-tool-filter]').forEach(function(button){button.classList.toggle('active',button.getAttribute('data-tool-filter')===activeToolFilter);});applyToolFilter();}

var specMonitorState={items:[],editing:''};
function monitorStatusLabel(status){return{pending:'待建立基线',baseline:'基线已建立',unchanged:'未发现变化',changed:'发现更新',error:'检查失败'}[status]||status||'待检查';}
function monitorTime(value){if(!value)return'尚未检查';try{return new Date(value).toLocaleString();}catch(_){return value;}}
async function loadSpecMonitors(){try{var value=dataOf(await api('v1/spec-monitors'));specMonitorState.items=value.items||[];renderSpecMonitors();}catch(error){var summary=document.getElementById('specMonitorSummary');if(summary)summary.textContent='读取监测任务失败：'+error.message;}}
function renderSpecMonitors(){
  var items=specMonitorState.items||[],changed=items.filter(function(item){return item.status==='changed';}).length,errors=items.filter(function(item){return item.status==='error';}).length;
  var badge=document.getElementById('specMonitorBadge');if(badge)badge.textContent=items.length+' 个网站';
  var summary=document.getElementById('specMonitorSummary');if(summary)summary.textContent=changed?changed+' 个网站发现规范变化':errors?errors+' 个网站检查失败':'定时检查指定网站上的规范发布与更新。';
  var count=document.getElementById('specMonitorCount');if(count)count.textContent='· '+items.length+' 项';
  var list=document.getElementById('specMonitorList');if(!list)return;
  if(!items.length){list.innerHTML='<div class="spec-monitor-empty">尚未添加监测网站。<br>在左侧填写公开规范发布页即可建立更新基线。</div>';return;}
  list.innerHTML=items.map(function(item){var changes=item.lastChanges||{added:[],removed:[]},links=(changes.added||[]).map(function(link){return'<a href="'+attr(link.url)+'" target="_blank" rel="noopener">＋ '+esc(link.title)+'</a>';}).join(''),removed=(changes.removed||[]).map(function(link){return'<div>－ '+esc(link.title)+'</div>';}).join('');return'<article class="spec-monitor-item '+attr(item.status)+'"><div class="monitor-item-head"><div class="monitor-item-copy"><strong>'+esc(item.name)+'</strong><a class="monitor-item-url" href="'+attr(item.url)+'" target="_blank" rel="noopener">'+esc(item.url)+'</a></div><span class="monitor-status '+attr(item.status)+'">'+esc(monitorStatusLabel(item.status))+'</span></div><div class="monitor-meta"><span>周期 '+Math.round(Number(item.intervalMinutes||0)/60*10)/10+' 小时</span><span>上次 '+esc(monitorTime(item.lastCheckedAt))+'</span><span>识别 '+Number((item.entries||[]).length)+' 条</span><span>'+(item.enabled?'自动检查已开启':'已暂停')+'</span></div>'+(item.lastError?'<div class="monitor-error">'+esc(item.lastError)+'</div>':'')+((links||removed)?'<div class="monitor-change-list">'+links+removed+'</div>':'')+'<div class="monitor-actions"><button class="btn" data-studio-act="checkSpecMonitor" data-monitor-id="'+attr(item.id)+'">立即检查</button><button class="btn" data-studio-act="editSpecMonitor" data-monitor-id="'+attr(item.id)+'">编辑</button><button class="btn" data-studio-act="toggleSpecMonitor" data-monitor-id="'+attr(item.id)+'">'+(item.enabled?'暂停':'启用')+'</button><button class="btn btn-danger" data-studio-act="deleteSpecMonitor" data-monitor-id="'+attr(item.id)+'">删除</button></div></article>';}).join('');
}
function openSpecMonitors(){var dialog=document.getElementById('specMonitorDialog');dialog.style.display='flex';dialog.setAttribute('aria-hidden','false');loadSpecMonitors();}
function closeSpecMonitors(){var dialog=document.getElementById('specMonitorDialog');dialog.style.display='none';dialog.setAttribute('aria-hidden','true');}
function resetSpecMonitorForm(){specMonitorState.editing='';document.getElementById('specMonitorId').value='';document.getElementById('specMonitorName').value='';document.getElementById('specMonitorUrl').value='';document.getElementById('specMonitorInterval').value='1440';document.getElementById('specMonitorKeywords').value='';studioState('specMonitorFormState','','');}
function editSpecMonitor(id){var item=specMonitorState.items.find(function(entry){return entry.id===id;});if(!item)return;specMonitorState.editing=id;document.getElementById('specMonitorId').value=id;document.getElementById('specMonitorName').value=item.name||'';document.getElementById('specMonitorUrl').value=item.url||'';document.getElementById('specMonitorInterval').value=String(item.intervalMinutes||1440);document.getElementById('specMonitorKeywords').value=(item.keywords||[]).join(', ');studioState('specMonitorFormState','正在编辑“'+item.name+'”','');}
async function saveSpecMonitor(){var id=specMonitorState.editing,payload={name:document.getElementById('specMonitorName').value.trim(),url:document.getElementById('specMonitorUrl').value.trim(),intervalMinutes:Number(document.getElementById('specMonitorInterval').value),keywords:document.getElementById('specMonitorKeywords').value.trim()};if(!payload.name||!payload.url){studioState('specMonitorFormState','请填写监测名称和网站地址。','bad');return;}studioState('specMonitorFormState',id?'正在保存…':'正在建立网站基线…','');try{if(id){await api('v1/spec-monitors/'+encodeURIComponent(id),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});await api('v1/spec-monitors/'+encodeURIComponent(id)+'/check',{method:'POST'});}else await api('v1/spec-monitors',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});resetSpecMonitorForm();await loadSpecMonitors();}catch(error){studioState('specMonitorFormState','保存失败：'+error.message,'bad');}}
async function checkSpecMonitor(id){studioState('specMonitorFormState','正在检查网站…','');try{await api('v1/spec-monitors/'+encodeURIComponent(id)+'/check',{method:'POST'});await loadSpecMonitors();studioState('specMonitorFormState','检查完成。','ok');}catch(error){studioState('specMonitorFormState','检查失败：'+error.message,'bad');}}
async function checkAllSpecMonitors(){studioState('specMonitorFormState','正在检查所有启用的网站…','');try{await api('v1/spec-monitors/check-all',{method:'POST'});await loadSpecMonitors();studioState('specMonitorFormState','全部检查完成。','ok');}catch(error){studioState('specMonitorFormState','检查失败：'+error.message,'bad');}}
async function toggleSpecMonitor(id){var item=specMonitorState.items.find(function(entry){return entry.id===id;});if(!item)return;try{await api('v1/spec-monitors/'+encodeURIComponent(id),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({enabled:!item.enabled})});await loadSpecMonitors();studioState('specMonitorFormState',item.enabled?'监测已暂停。':'监测已启用。','ok');}catch(error){studioState('specMonitorFormState','操作失败：'+error.message,'bad');}}
async function deleteSpecMonitor(id){var item=specMonitorState.items.find(function(entry){return entry.id===id;});if(!item||!window.confirm('删除规范监测任务“'+item.name+'”？历史检查记录也会删除。'))return;try{await api('v1/spec-monitors/'+encodeURIComponent(id),{method:'DELETE'});if(specMonitorState.editing===id)resetSpecMonitorForm();await loadSpecMonitors();studioState('specMonitorFormState','监测任务已删除。','ok');}catch(error){studioState('specMonitorFormState','删除失败：'+error.message,'bad');}}

document.addEventListener('click',function(event){
  var target=event.target.closest&&event.target.closest('[data-studio-act],[data-tool-launch]');if(!target)return;var toolId=target.getAttribute('data-tool-launch');if(toolId){launchDesignTool(toolId);return;}var action=target.getAttribute('data-studio-act');
  var monitorId=target.getAttribute('data-monitor-id');
  if(action==='chooseProjectBase')chooseProjectBase();else if(action==='createProject')createEngineeringProject();else if(action==='openProjectDirectory'&&workspaceState.current&&DESKTOP&&DESKTOP.projects)DESKTOP.projects.openDirectory(workspaceState.current.projectDirectory);else if(action==='syncProjectFolders')syncProjectFolders();else if(action==='addChecklistItem')addChecklistItem();else if(action==='saveWorkspaceSettings')saveWorkspaceSettings();else if(action==='chooseCalculator')chooseCalculator();else if(action==='saveCalculator')saveCalculator();else if(action==='launchCalculator')launchCalculator();else if(action==='openRoadSlope')openRoadSlopeWindow();else if(action==='toolFilter')selectToolFilter(target.getAttribute('data-tool-filter'));else if(action==='refreshBalance')refreshBalance();else if(action==='openSpecMonitors')openSpecMonitors();else if(action==='closeSpecMonitors')closeSpecMonitors();else if(action==='resetSpecMonitor')resetSpecMonitorForm();else if(action==='saveSpecMonitor')saveSpecMonitor();else if(action==='checkSpecMonitor')checkSpecMonitor(monitorId);else if(action==='checkAllSpecMonitors')checkAllSpecMonitors();else if(action==='editSpecMonitor')editSpecMonitor(monitorId);else if(action==='toggleSpecMonitor')toggleSpecMonitor(monitorId);else if(action==='deleteSpecMonitor')deleteSpecMonitor(monitorId);
});
document.addEventListener('change',function(event){
  if(event.target.id==='projectSelect'){openEngineeringProject(event.target.value);return;}
  var statusId=event.target.getAttribute&&event.target.getAttribute('data-check-status');if(statusId){updateChecklist(statusId,{status:event.target.value});return;}
  var noteId=event.target.getAttribute&&event.target.getAttribute('data-check-note');if(noteId){updateChecklist(noteId,{note:event.target.value});return;}
});
document.addEventListener('input',function(event){
  if(event.target.id==='toolSearch'){applyToolFilter();return;}
});
document.addEventListener('keydown',function(event){if(event.ctrlKey&&event.altKey&&String(event.key).toLowerCase()==='c'){event.preventDefault();launchCalculator();}else if(event.ctrlKey&&event.altKey&&String(event.key).toLowerCase()==='r'){event.preventDefault();openRoadSlopeWindow();}else if(event.key==='Escape'&&document.getElementById('specMonitorDialog').style.display!=='none'){event.preventDefault();event.stopImmediatePropagation();closeSpecMonitors();}});

loadEngineeringWorkspace();loadDesignTools();loadSpecMonitors();window.setInterval(loadSpecMonitors,60000);applyToolFilter();if(DESKTOP&&DESKTOP.balance)refreshBalance();
})();
