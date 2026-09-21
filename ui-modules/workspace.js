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

async function loadDesignTools(){if(!DESKTOP||!DESKTOP.designTools)return;try{designToolState=await DESKTOP.designTools.list();var calc=(designToolState.items||[]).find(function(x){return x.id==='calculator';});var pathInput=document.getElementById('calculatorPath');if(pathInput&&calc)pathInput.value=calc.path||'';var state=document.getElementById('calculatorState');if(state&&calc){state.textContent=calc.available?'可用：'+calc.path:'未找到程序，请重新选择';state.className='studio-state '+(calc.available?'ok':'bad');}var badge=document.getElementById('calculatorBadge');if(badge)badge.textContent=calc&&calc.available?'可用':'未配置';}catch(error){studioState('calculatorState','读取设计工具失败：'+error.message,'bad');}}
async function chooseCalculator(){if(!DESKTOP||!DESKTOP.dialog.chooseDesignTool)return;var value=await DESKTOP.dialog.chooseDesignTool();if(value)document.getElementById('calculatorPath').value=value;}
async function saveCalculator(){if(!DESKTOP||!DESKTOP.designTools)return;try{await DESKTOP.designTools.update('calculator',{path:document.getElementById('calculatorPath').value});await loadDesignTools();}catch(error){studioState('calculatorState','保存失败：'+error.message,'bad');}}
async function launchCalculator(){if(!DESKTOP||!DESKTOP.designTools){studioState('toolLaunchState','仅桌面版支持启动本地程序。','bad');return;}try{await DESKTOP.designTools.launch('calculator');studioState('toolLaunchState','多功能计算器已启动。','ok');}catch(error){studioState('toolLaunchState',error.message,'bad');}}

var slope={nodes:[],edges:[],mode:'select',selected:null,pending:'',drag:null,serial:1};
function slopeRound(value){var decimals=Math.max(0,Math.min(6,Number(document.getElementById('slopeDecimals')?.value)||3));return Number(Number(value).toFixed(decimals));}
function slopePoint(event){var svg=document.getElementById('slopeCanvas'),rect=svg.getBoundingClientRect();return{x:Math.round((event.clientX-rect.left)*1000/rect.width/10)*10,y:Math.round((event.clientY-rect.top)*600/rect.height/10)*10};}
function slopeNode(id){return slope.nodes.find(function(n){return n.id===id;});}
function slopeEdge(id){return slope.edges.find(function(n){return n.id===id;});}
function slopeLength(edge){var a=slopeNode(edge.from),b=slopeNode(edge.to);return a&&b?Math.hypot(b.x-a.x,b.y-a.y):0;}
function saveSlope(){try{localStorage.setItem('specflow-road-slope',JSON.stringify({nodes:slope.nodes,edges:slope.edges,serial:slope.serial}));}catch(_){}}
function loadSlope(){try{var data=JSON.parse(localStorage.getItem('specflow-road-slope')||'{}');if(Array.isArray(data.nodes))slope.nodes=data.nodes;if(Array.isArray(data.edges))slope.edges=data.edges;if(data.serial)slope.serial=data.serial;}catch(_){}renderSlope();}
function setSlopeMode(mode){slope.mode=mode;slope.pending='';document.querySelectorAll('[data-slope-mode]').forEach(function(b){b.classList.toggle('active',b.getAttribute('data-slope-mode')===mode);});renderSlope();}
function renderSlope(){
  var svg=document.getElementById('slopeCanvas');if(!svg)return;
  var markup='<defs><pattern id="roadGrid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#252b35" stroke-width="1"/></pattern><marker id="slopeArrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0 9 4.5 0 9Z" fill="#7aa2ff"/></marker></defs><rect width="1000" height="600" fill="url(#roadGrid)"/>';
  markup+=slope.edges.map(function(edge){var a=slopeNode(edge.from),b=slopeNode(edge.to);if(!a||!b)return'';var mx=(a.x+b.x)/2,my=(a.y+b.y)/2-8,selected=slope.selected&&slope.selected.type==='edge'&&slope.selected.id===edge.id;return '<g class="road-edge '+(selected?'selected':'')+'" data-slope-edge="'+attr(edge.id)+'"><line x1="'+a.x+'" y1="'+a.y+'" x2="'+b.x+'" y2="'+b.y+'" marker-end="url(#slopeArrow)"/><text x="'+mx+'" y="'+my+'">'+slopeLength(edge).toFixed(1)+' m · '+Number(edge.slope).toFixed(2)+'‰</text></g>';}).join('');
  markup+=slope.nodes.map(function(node){var selected=slope.selected&&slope.selected.type==='node'&&slope.selected.id===node.id;return '<g class="road-node '+(node.fixed?'fixed ':'')+(selected?'selected ':'')+(slope.pending===node.id?'road-pending':'')+'" data-slope-node="'+attr(node.id)+'" transform="translate('+node.x+' '+node.y+')"><circle r="13"/><text y="-19">'+esc(node.id)+' · '+(node.elevation==null?'—':Number(node.elevation).toFixed(Math.max(0,Math.min(6,Number(document.getElementById('slopeDecimals')?.value)||3)))+' m')+'</text><text y="4" style="font-size:8px">'+esc(node.id)+'</text></g>';}).join('');
  if(!slope.nodes.length)markup+='<text class="road-empty" x="500" y="300">选择“布置节点”，然后在画布中单击</text>';
  svg.innerHTML=markup;renderSlopeInspector();renderSlopeResults();saveSlope();
}
function renderSlopeInspector(){var box=document.getElementById('slopeInspectorContent');if(!box)return;var selected=slope.selected;if(!selected){box.innerHTML='<div class="road-help">布置节点后，选择节点设置已知标高；使用“连接箭头”从高点指向低点。自动计算会沿箭头按坡度推算其余标高。</div>';return;}if(selected.type==='node'){var node=slopeNode(selected.id);box.innerHTML='<div class="studio-field"><label>节点</label><input value="'+attr(node.id)+'" disabled></div><div class="studio-field"><label>X 坐标（m）</label><input type="number" data-slope-prop="x" value="'+node.x+'"></div><div class="studio-field"><label>Y 坐标（m）</label><input type="number" data-slope-prop="y" value="'+node.y+'"></div><div class="studio-field"><label>设计标高（m）</label><input type="number" step="0.001" data-slope-prop="elevation" value="'+(node.elevation==null?'':node.elevation)+'" placeholder="至少设置一个已知标高"></div><label class="switch"><input type="checkbox" data-slope-prop="fixed" '+(node.fixed?'checked':'')+'><span>已知控制标高</span></label>';return;}var edge=slopeEdge(selected.id);box.innerHTML='<div class="studio-field"><label>排水方向</label><input value="'+attr(edge.from+' → '+edge.to)+'" disabled></div><div class="studio-field"><label>设计坡度（‰）</label><input type="number" step="0.1" data-slope-prop="edgeSlope" value="'+edge.slope+'"></div><button class="btn" data-studio-act="reverseSlopeEdge">反向箭头</button>';}
function renderSlopeResults(){var table=document.getElementById('slopeResults');if(!table)return;table.innerHTML='<thead><tr><th>方向</th><th>长度</th><th>坡度</th><th>高差</th></tr></thead><tbody>'+slope.edges.map(function(edge){var length=slopeLength(edge),a=slopeNode(edge.from),b=slopeNode(edge.to),drop=a&&b&&a.elevation!=null&&b.elevation!=null?Number(a.elevation)-Number(b.elevation):length*Number(edge.slope)/1000;return '<tr><td>'+esc(edge.from+'→'+edge.to)+'</td><td>'+length.toFixed(1)+' m</td><td>'+Number(edge.slope).toFixed(2)+'‰</td><td>'+drop.toFixed(3)+' m</td></tr>';}).join('')+'</tbody>';}
function addSlopeNode(point){var id='P'+slope.serial++;slope.nodes.push({id:id,x:point.x,y:point.y,elevation:null,fixed:false});slope.selected={type:'node',id:id};renderSlope();}
function connectSlopeNode(id){if(!slope.pending){slope.pending=id;renderSlope();return;}if(slope.pending===id){slope.pending='';renderSlope();return;}var exists=slope.edges.some(function(e){return e.from===slope.pending&&e.to===id;});if(!exists){var defaultSlope=Number(document.getElementById('slopeDefault').value)||5;slope.edges.push({id:'E'+Date.now()+'_'+slope.edges.length,from:slope.pending,to:id,slope:defaultSlope});}slope.pending='';renderSlope();}
function autoSlope(){var fixed=slope.nodes.filter(function(n){return n.fixed&&n.elevation!=null&&Number.isFinite(Number(n.elevation));});if(!fixed.length){studioState('slopeState','请先选择至少一个节点并设置“已知控制标高”。','bad');return;}slope.nodes.forEach(function(n){if(!n.fixed)n.elevation=null;else n.elevation=slopeRound(n.elevation);});for(var pass=0;pass<slope.nodes.length*3;pass++){var changed=false;slope.edges.forEach(function(edge){var a=slopeNode(edge.from),b=slopeNode(edge.to),drop=slopeLength(edge)*Number(edge.slope||0)/1000;if(a.elevation!=null&&b.elevation==null){b.elevation=slopeRound(Number(a.elevation)-drop);changed=true;}else if(b.elevation!=null&&a.elevation==null){a.elevation=slopeRound(Number(b.elevation)+drop);changed=true;}});if(!changed)break;}var missing=slope.nodes.filter(function(n){return n.elevation==null;}).length;renderSlope();studioState('slopeState',missing?'已计算连通节点，仍有 '+missing+' 个节点未连接到控制标高。':'设计标高已按箭头方向和坡度自动计算。',missing?'bad':'ok');}
function deleteSlopeSelection(){if(!slope.selected)return;if(slope.selected.type==='node'){var id=slope.selected.id;slope.nodes=slope.nodes.filter(function(n){return n.id!==id;});slope.edges=slope.edges.filter(function(e){return e.from!==id&&e.to!==id;});}else{slope.edges=slope.edges.filter(function(e){return e.id!==slope.selected.id;});}slope.selected=null;renderSlope();}
function reverseSlopeEdge(){if(!slope.selected||slope.selected.type!=='edge')return;var edge=slopeEdge(slope.selected.id),from=edge.from;edge.from=edge.to;edge.to=from;renderSlope();}
function exportSlope(){var payload=JSON.stringify({schemaVersion:1,unit:'m',nodes:slope.nodes,edges:slope.edges},null,2),blob=new Blob([payload],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='道路排水坡度设计.json';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);}

document.addEventListener('click',function(event){
  var target=event.target.closest&&event.target.closest('[data-studio-act]');if(!target)return;var action=target.getAttribute('data-studio-act');
  if(action==='chooseProjectBase')chooseProjectBase();else if(action==='createProject')createEngineeringProject();else if(action==='openProjectDirectory'&&workspaceState.current&&DESKTOP&&DESKTOP.projects)DESKTOP.projects.openDirectory(workspaceState.current.projectDirectory);else if(action==='syncProjectFolders')syncProjectFolders();else if(action==='addChecklistItem')addChecklistItem();else if(action==='saveWorkspaceSettings')saveWorkspaceSettings();else if(action==='chooseCalculator')chooseCalculator();else if(action==='saveCalculator')saveCalculator();else if(action==='launchCalculator')launchCalculator();else if(action==='openRoadSlope'){showPage('tools');document.getElementById('roadDesigner').scrollIntoView({behavior:'smooth'});}else if(action==='refreshBalance')refreshBalance();else if(action==='autoSlope')autoSlope();else if(action==='deleteSlope')deleteSlopeSelection();else if(action==='reverseSlopeEdge')reverseSlopeEdge();else if(action==='exportSlope')exportSlope();else if(action==='clearSlope'){if(window.confirm('清空当前道路坡度图？')){slope={nodes:[],edges:[],mode:'select',selected:null,pending:'',drag:null,serial:1};renderSlope();}}else if(action==='slopeMode')setSlopeMode(target.getAttribute('data-slope-mode'));
});
document.addEventListener('change',function(event){
  if(event.target.id==='projectSelect'){openEngineeringProject(event.target.value);return;}
  var statusId=event.target.getAttribute&&event.target.getAttribute('data-check-status');if(statusId){updateChecklist(statusId,{status:event.target.value});return;}
  var noteId=event.target.getAttribute&&event.target.getAttribute('data-check-note');if(noteId){updateChecklist(noteId,{note:event.target.value});return;}
  var prop=event.target.getAttribute&&event.target.getAttribute('data-slope-prop');if(!prop||!slope.selected)return;
  if(slope.selected.type==='node'){var node=slopeNode(slope.selected.id);if(prop==='fixed')node.fixed=event.target.checked;else if(prop==='elevation'){node.elevation=event.target.value===''?null:Number(event.target.value);node.fixed=node.elevation!=null;}else node[prop]=Number(event.target.value)||0;}else if(prop==='edgeSlope'){slopeEdge(slope.selected.id).slope=Number(event.target.value)||0;}renderSlope();
});
document.addEventListener('input',function(event){
  var prop=event.target.getAttribute&&event.target.getAttribute('data-slope-prop');if(!prop||!slope.selected)return;
  if(slope.selected.type==='node'){var node=slopeNode(slope.selected.id);if(prop==='fixed')node.fixed=event.target.checked;else if(prop==='elevation'){node.elevation=event.target.value===''?null:Number(event.target.value);node.fixed=node.elevation!=null;}else node[prop]=Number(event.target.value)||0;}else if(prop==='edgeSlope'){slopeEdge(slope.selected.id).slope=Number(event.target.value)||0;}saveSlope();
});
document.addEventListener('keydown',function(event){if(event.ctrlKey&&event.altKey&&String(event.key).toLowerCase()==='c'){event.preventDefault();launchCalculator();}else if(event.ctrlKey&&event.altKey&&String(event.key).toLowerCase()==='r'){event.preventDefault();showPage('tools');document.getElementById('roadDesigner').scrollIntoView();}});
var canvas=document.getElementById('slopeCanvas');
if(canvas){canvas.addEventListener('pointerdown',function(event){var nodeEl=event.target.closest&&event.target.closest('[data-slope-node]'),edgeEl=event.target.closest&&event.target.closest('[data-slope-edge]');if(nodeEl){var id=nodeEl.getAttribute('data-slope-node');if(slope.mode==='connect'){connectSlopeNode(id);return;}slope.selected={type:'node',id:id};if(slope.mode==='select'){var n=slopeNode(id);slope.drag={id:id,dx:slopePoint(event).x-n.x,dy:slopePoint(event).y-n.y};canvas.setPointerCapture(event.pointerId);}renderSlope();return;}if(edgeEl){slope.selected={type:'edge',id:edgeEl.getAttribute('data-slope-edge')};renderSlope();return;}if(slope.mode==='add')addSlopeNode(slopePoint(event));else{slope.selected=null;renderSlope();}});canvas.addEventListener('pointermove',function(event){if(!slope.drag)return;var p=slopePoint(event),n=slopeNode(slope.drag.id);n.x=Math.max(10,Math.min(990,p.x-slope.drag.dx));n.y=Math.max(20,Math.min(590,p.y-slope.drag.dy));renderSlope();});canvas.addEventListener('pointerup',function(){slope.drag=null;});}

loadEngineeringWorkspace();loadDesignTools();loadSlope();if(DESKTOP&&DESKTOP.balance)refreshBalance();
})();
