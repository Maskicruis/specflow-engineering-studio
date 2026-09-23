'use strict';

(function () {
  var STORAGE_KEY = 'specflow-road-slope';
  var state = emptyState();

  function emptyState() {
    return { nodes: [], edges: [], mode: 'select', selected: { type: 'nodes', ids: [] }, drag: null, selectionBox: null, serial: 1, edgeSerial: 1, direction: 'right', lastResults: null, lastActivation: null };
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function attr(value) { return esc(value); }

  function report(message, tone) {
    var element = document.getElementById('slopeState');
    if (!element) return;
    element.textContent = message || '自动保存到本机';
    element.className = 'slope-state ' + (tone || '');
  }

  function decimals() {
    return Math.max(0, Math.min(6, Number(document.getElementById('slopeDecimals').value) || 3));
  }

  function pointFromEvent(event) {
    var canvas = document.getElementById('slopeCanvas');
    var rectangle = canvas.getBoundingClientRect();
    return {
      x: Math.round((event.clientX - rectangle.left) * 1000 / rectangle.width / 5) * 5,
      y: Math.round((event.clientY - rectangle.top) * 600 / rectangle.height / 5) * 5
    };
  }

  function nodeByKey(key) { return state.nodes.find(function (node) { return node.key === key; }); }
  function edgeById(id) { return state.edges.find(function (edge) { return edge.id === id; }); }
  function nodeLabel(key) { var node = nodeByKey(key); return node ? node.label : key; }
  function selectedNodeKeys() { return state.selected && state.selected.type === 'nodes' ? state.selected.ids || [] : []; }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        schemaVersion: 4,
        nodes: state.nodes,
        edges: state.edges,
        serial: state.serial,
        edgeSerial: state.edgeSerial,
        direction: state.direction
      }));
    } catch (_) {}
  }

  function edgeDefaults() {
    return {
      distance: Number(document.getElementById('slopeDistanceDefault').value) || 20,
      slope: Number(document.getElementById('slopeDefault').value) || 5,
      minSlope: Number(document.getElementById('slopeMinDefault').value) || 0,
      maxSlope: ''
    };
  }

  function migrate(data) {
    var nodes = (data.nodes || []).map(function (node, index) {
      return {
        key: String(node.key || node.id || ('N' + (index + 1))),
        label: String(node.label || node.id || ('P' + (index + 1))),
        x: Number(node.x) || 100 + index * 100,
        y: Number(node.y) || 100,
        elevation: node.elevation == null ? null : Number(node.elevation),
        fixed: Boolean(node.fixed)
      };
    });
    var known = new Set(nodes.map(function (node) { return node.key; }));
    var defaults = edgeDefaults();
    var edges = (data.edges || []).filter(function (edge) {
      return known.has(String(edge.from)) && known.has(String(edge.to));
    }).map(function (edge, index) {
      return {
        id: String(edge.id || ('E' + (index + 1))),
        from: String(edge.from),
        to: String(edge.to),
        distance: edge.distance === '' ? '' : Number(edge.distance) > 0 ? Number(edge.distance) : defaults.distance,
        slope: Number.isFinite(Number(edge.slope)) ? Number(edge.slope) : defaults.slope,
        minSlope: edge.minSlope === '' ? '' : Number.isFinite(Number(edge.minSlope)) ? Number(edge.minSlope) : defaults.minSlope,
        maxSlope: edge.maxSlope === '' ? '' : Number.isFinite(Number(edge.maxSlope)) ? Number(edge.maxSlope) : '',
        needsDistance: Boolean(edge.needsDistance)
      };
    });
    var normalized = window.SpecFlowRoadSlope.normalizeSegments({ nodes: nodes, edges: edges, tolerance: 30 });
    return {
      nodes: nodes,
      edges: normalized.edges,
      serial: Number(data.serial) || nodes.length + 1,
      edgeSerial: Number(data.edgeSerial) || edges.length + 1,
      direction: data.direction || 'right',
      normalization: normalized
    };
  }

  function load() {
    try {
      var data = migrate(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
      state.nodes = data.nodes;
      state.edges = data.edges;
      state.serial = data.serial;
      state.edgeSerial = data.edgeSerial;
      state.direction = data.direction;
      setDirection(state.direction);
      render();
      if (data.normalization.splitEdges) report('已将跨节点连线拆分为逐节点坡段，请检查各段实际距离。', 'bad');
    } catch (error) {
      state = emptyState();
      render();
      report('旧数据读取失败，已打开空白画布。', 'bad');
    }
  }

  function setMode(mode) {
    state.mode = mode === 'add' ? 'add' : 'select';
    document.querySelectorAll('[data-slope-mode]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-slope-mode') === state.mode);
    });
    render();
  }

  function setDirection(direction) {
    state.direction = ['up', 'right', 'down', 'left'].includes(direction) ? direction : 'right';
    document.querySelectorAll('[data-direction]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-direction') === state.direction);
    });
    save();
  }

  function lineFor(edge) {
    var from = nodeByKey(edge.from);
    var to = nodeByKey(edge.to);
    if (!from || !to) return null;
    var dx = to.x - from.x;
    var dy = to.y - from.y;
    var length = Math.max(1, Math.hypot(dx, dy));
    var ux = dx / length;
    var uy = dy / length;
    var offset = Math.min(38, length / 3);
    return {
      x1: from.x + ux * offset,
      y1: from.y + uy * offset,
      x2: to.x - ux * offset,
      y2: to.y - uy * offset,
      mx: (from.x + to.x) / 2,
      my: (from.y + to.y) / 2 - 13
    };
  }

  function render() {
    var canvas = document.getElementById('slopeCanvas');
    var selectedKeys = new Set(selectedNodeKeys());
    var markup = '<defs><pattern id="roadGrid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#252b35" stroke-width="1"/></pattern><marker id="slopeArrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0 9 4.5 0 9Z" fill="#7aa2ff"/></marker></defs><rect width="1000" height="600" fill="url(#roadGrid)"/>';
    markup += state.edges.map(function (edge, index) {
      var line = lineFor(edge);
      if (!line) return '';
      var selected = state.selected && state.selected.type === 'edge' && state.selected.id === edge.id;
      var label = edge.distance === '' ? '待填距离 · ' + Number(edge.slope || 0).toFixed(2) + '‰' : Number(edge.distance || 0).toFixed(1) + 'm · ' + Number(edge.slope || 0).toFixed(2) + '‰';
      return '<g class="road-edge ' + (selected ? 'selected' : '') + '" data-slope-edge="' + attr(edge.id) + '"><line class="road-edge-base" x1="' + line.x1 + '" y1="' + line.y1 + '" x2="' + line.x2 + '" y2="' + line.y2 + '"/><line class="road-edge-arrow" x1="' + line.x1 + '" y1="' + line.y1 + '" x2="' + line.x2 + '" y2="' + line.y2 + '" marker-end="url(#slopeArrow)"/><circle class="road-flow-dot" r="4"><animateMotion dur="1.35s" begin="-' + ((index % 4) * 0.23).toFixed(2) + 's" repeatCount="indefinite" path="M ' + line.x1 + ' ' + line.y1 + ' L ' + line.x2 + ' ' + line.y2 + '"/></circle><text x="' + line.mx + '" y="' + line.my + '">' + esc(label) + '</text></g>';
    }).join('');
    markup += state.nodes.map(function (node) {
      var selected = selectedKeys.has(node.key);
      var elevation = node.elevation == null ? '未定' : Number(node.elevation).toFixed(decimals()) + ' m';
      return '<g class="road-node ' + (node.fixed ? 'fixed ' : '') + (selected ? 'selected ' : '') + '" data-slope-node="' + attr(node.key) + '" transform="translate(' + node.x + ' ' + node.y + ')"><rect x="-38" y="-21" width="76" height="42" rx="9"/><text y="-2">' + esc(node.label) + '</text><text class="road-elevation" y="13">' + esc(elevation) + '</text></g>';
    }).join('');
    if (state.selectionBox) {
      var box = state.selectionBox;
      var x = Math.min(box.start.x, box.current.x);
      var y = Math.min(box.start.y, box.current.y);
      markup += '<rect class="road-selection" x="' + x + '" y="' + y + '" width="' + Math.abs(box.current.x - box.start.x) + '" height="' + Math.abs(box.current.y - box.start.y) + '"/>';
    }
    if (!state.nodes.length) markup += '<text class="road-empty" x="500" y="285">选择“连续插入节点”，在画布中单击</text><text class="road-empty-sub" x="500" y="310">后续节点会逐段连接；双击节点可按工具栏方向继续延伸</text>';
    canvas.innerHTML = markup;
    renderInspector();
    renderResults();
    save();
  }

  function renderInspector() {
    var container = document.getElementById('slopeInspectorContent');
    var selected = state.selected;
    if (!selected || (selected.type === 'nodes' && !selected.ids.length)) {
      container.innerHTML = '<div class="road-help">框选可一次选择多个节点并整体移动。画布坐标只用于示意布局；计算仅采用坡段实际距离、排水方向、坡度和规范限值。</div>';
      return;
    }
    if (selected.type === 'nodes') {
      if (selected.ids.length > 1) {
        container.innerHTML = '<div class="road-help">已选择 ' + selected.ids.length + ' 个节点。可连接选择顺序中的前两个节点；中间节点会自动拆成独立坡段。</div><button class="btn" style="margin-top:9px" data-slope-action="connect">连接前两个节点</button>';
        return;
      }
      var node = nodeByKey(selected.ids[0]);
      if (!node) return;
      var incident = state.edges.filter(function (edge) { return edge.from === node.key || edge.to === node.key; }).length;
      container.innerHTML = '<div class="studio-field"><label>节点编号</label><input data-slope-property="nodeLabel" value="' + attr(node.label) + '"></div><div class="studio-field"><label>已知设计标高（m）</label><input type="number" step="0.001" data-slope-property="elevation" value="' + (node.elevation == null ? '' : node.elevation) + '" placeholder="未知时留空"></div><label class="switch"><input type="checkbox" data-slope-property="fixed" ' + (node.fixed ? 'checked' : '') + '><span>设为已知控制标高</span></label>' + (incident ? '<div class="road-node-actions"><button class="btn" data-slope-action="high">设为分水高点</button><button class="btn" data-slope-action="low">设为汇水低点</button></div>' : '') + '<div class="road-help" style="margin-top:9px">分水高点会让相邻坡段向外排水；汇水低点会让相邻坡段汇入此节点。</div>';
      return;
    }
    var edge = edgeById(selected.id);
    if (!edge) return;
    container.innerHTML = '<div class="studio-field"><label>排水方向</label><input value="' + attr(nodeLabel(edge.from) + ' → ' + nodeLabel(edge.to)) + '" disabled></div><div class="road-inspector-grid"><div class="studio-field"><label>实际距离（m）</label><input type="number" min="0.01" step="0.1" data-slope-property="edgeDistance" value="' + attr(edge.distance) + '" placeholder="必须填写"></div><div class="studio-field"><label>设计坡度（‰）</label><input type="number" step="0.1" data-slope-property="edgeSlope" value="' + attr(edge.slope) + '"></div><div class="studio-field"><label>规范最小（‰）</label><input type="number" min="0" step="0.1" data-slope-property="edgeMinSlope" value="' + attr(edge.minSlope) + '"></div><div class="studio-field"><label>规范最大（‰）</label><input type="number" min="0" step="0.1" data-slope-property="edgeMaxSlope" value="' + attr(edge.maxSlope) + '" placeholder="可留空"></div></div><button class="btn" data-slope-action="reverse">反向排水</button><div class="road-help" style="margin-top:9px">水流动画仅在本坡段两个端点之间运行，不会越过中间节点。</div>';
  }

  function renderResults() {
    var table = document.getElementById('slopeResults');
    var results = state.lastResults && state.lastResults.edgeResults || [];
    table.innerHTML = '<thead><tr><th>坡段</th><th>实距</th><th>计算坡度</th><th>状态</th></tr></thead><tbody>' + state.edges.map(function (edge) {
      var result = results.find(function (item) { return item.id === edge.id; });
      var status = result ? result.status : 'pending';
      var actual = result && result.actualSlope != null ? result.actualSlope.toFixed(2) + '‰' : '—';
      var message = result && result.issues.length ? result.issues.join('；') : '通过';
      var distance = edge.distance === '' ? '待填' : Number(edge.distance || 0).toFixed(2) + 'm';
      return '<tr class="' + attr(status) + '" title="' + attr(message) + '"><td>' + esc(nodeLabel(edge.from) + '→' + nodeLabel(edge.to)) + '</td><td>' + esc(distance) + '</td><td>' + actual + '</td><td>' + esc(status === 'ok' ? '通过' : status === 'pending' ? '待计算' : message) + '</td></tr>';
    }).join('') + '</tbody>';
  }

  function createNode(point, label) {
    var number = state.serial++;
    var node = { key: 'N' + Date.now().toString(36) + '_' + number, label: label || ('P' + number), x: Math.max(50, Math.min(950, point.x)), y: Math.max(35, Math.min(565, point.y)), elevation: null, fixed: false };
    state.nodes.push(node);
    state.selected = { type: 'nodes', ids: [node.key] };
    state.lastResults = null;
    return node;
  }

  function pairKey(from, to) { return [from, to].sort().join('\n'); }

  function createEdge(from, to) {
    if (!from || !to || from === to) return [];
    var defaults = edgeDefaults();
    var keys = window.SpecFlowRoadSlope.segmentNodeKeys(from, to, state.nodes, 30);
    var created = [];
    for (var index = 0; index < keys.length - 1; index += 1) {
      var segmentFrom = keys[index];
      var segmentTo = keys[index + 1];
      var pair = pairKey(segmentFrom, segmentTo);
      if (state.edges.some(function (edge) { return pairKey(edge.from, edge.to) === pair; })) continue;
      var id;
      do { id = 'E' + state.edgeSerial++; } while (edgeById(id));
      var edge = { id: id, from: segmentFrom, to: segmentTo, distance: defaults.distance, slope: defaults.slope, minSlope: defaults.minSlope, maxSlope: defaults.maxSlope, needsDistance: false };
      state.edges.push(edge);
      created.push(edge);
    }
    state.lastResults = null;
    return created;
  }

  function normalizeSegments() {
    var result = window.SpecFlowRoadSlope.normalizeSegments({ nodes: state.nodes, edges: state.edges, tolerance: 30 });
    state.edges = result.edges;
    if (state.selected && state.selected.type === 'edge' && !edgeById(state.selected.id)) state.selected = { type: 'nodes', ids: [] };
    if (result.splitEdges) report('已将 ' + result.splitEdges + ' 条跨节点连线拆成逐节点坡段，请补充各段实际距离。', 'bad');
    return result;
  }

  function addNode(point) {
    var previous = selectedNodeKeys().length === 1 ? selectedNodeKeys()[0] : null;
    var target = createNode(point);
    if (previous) createEdge(previous, target.key);
    normalizeSegments();
    render();
  }

  function extendNode(key) {
    var source = nodeByKey(key);
    if (!source) return;
    var step = { up: { x: 0, y: -110 }, right: { x: 155, y: 0 }, down: { x: 0, y: 110 }, left: { x: -155, y: 0 } }[state.direction];
    var point = { x: source.x + step.x, y: source.y + step.y };
    for (var attempt = 0; attempt < 5; attempt += 1) {
      if (!state.nodes.some(function (node) { return Math.hypot(node.x - point.x, node.y - point.y) < 70; })) break;
      point.x += step.x;
      point.y += step.y;
    }
    point.x = Math.max(55, Math.min(945, point.x));
    point.y = Math.max(40, Math.min(560, point.y));
    var target = createNode(point);
    createEdge(source.key, target.key);
    render();
  }

  function connectSelected() {
    var keys = selectedNodeKeys();
    if (keys.length < 2) return report('请按住 Shift 选择两个节点后再连接。', 'bad');
    var created = createEdge(keys[0], keys[1]);
    render();
    report(created.length ? '已建立 ' + created.length + ' 个逐节点坡段。' : '所选节点之间已有逐节点连线。', created.length ? 'ok' : '');
  }

  function orientNode(kind) {
    var keys = selectedNodeKeys();
    if (keys.length !== 1) return;
    var key = keys[0];
    state.edges.forEach(function (edge) {
      if ((kind === 'high' && edge.to === key) || (kind === 'low' && edge.from === key)) {
        var from = edge.from;
        edge.from = edge.to;
        edge.to = from;
      }
    });
    state.lastResults = null;
    render();
    report(kind === 'high' ? '相邻坡段已从该高点向外排水。' : '相邻坡段已汇入该低点。', 'ok');
  }

  function calculate() {
    if (!state.nodes.some(function (node) { return node.fixed && node.elevation !== null && Number.isFinite(Number(node.elevation)); })) return report('请先为至少一个节点输入标高并设为控制标高。', 'bad');
    state.nodes.forEach(function (node) { if (!node.fixed) node.elevation = null; });
    var result = window.SpecFlowRoadSlope.calculateNetwork({ nodes: state.nodes, edges: state.edges, decimals: decimals() });
    Object.keys(result.elevations).forEach(function (key) { var node = nodeByKey(key); if (node) node.elevation = result.elevations[key]; });
    state.lastResults = result;
    render();
    var unresolved = state.nodes.length - result.resolved;
    report(result.issues.length ? '完成计算，发现 ' + result.issues.length + ' 项冲突或规范提示。' : '网络计算完成，当前输入条件均已通过。', result.issues.length || unresolved ? 'bad' : 'ok');
  }

  function deleteSelection() {
    if (!state.selected) return;
    if (state.selected.type === 'nodes') {
      var keys = new Set(state.selected.ids || []);
      state.nodes = state.nodes.filter(function (node) { return !keys.has(node.key); });
      state.edges = state.edges.filter(function (edge) { return !keys.has(edge.from) && !keys.has(edge.to); });
    } else {
      state.edges = state.edges.filter(function (edge) { return edge.id !== state.selected.id; });
    }
    state.selected = { type: 'nodes', ids: [] };
    state.lastResults = null;
    render();
  }

  function reverseEdge() {
    if (!state.selected || state.selected.type !== 'edge') return;
    var edge = edgeById(state.selected.id);
    if (!edge) return;
    var from = edge.from;
    edge.from = edge.to;
    edge.to = from;
    state.lastResults = null;
    render();
  }

  function exportNetwork() {
    var payload = JSON.stringify({ schemaVersion: 4, unit: 'm', layout: 'illustrative-only', flowRule: 'adjacent-nodes-only', nodes: state.nodes, edges: state.edges, calculation: state.lastResults }, null, 2);
    var blob = new Blob([payload], { type: 'application/json' });
    var anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = '道路排水坡度网络.json';
    anchor.click();
    setTimeout(function () { URL.revokeObjectURL(anchor.href); }, 1000);
  }

  function reset() {
    state = emptyState();
    setDirection('right');
    render();
    report('画布已清空。', 'ok');
  }

  function applyProperty(target, shouldRender) {
    var property = target.getAttribute && target.getAttribute('data-slope-property');
    if (!property || !state.selected) return false;
    if (state.selected.type === 'nodes' && state.selected.ids.length === 1) {
      var node = nodeByKey(state.selected.ids[0]);
      if (!node) return false;
      if (property === 'fixed') node.fixed = target.checked;
      else if (property === 'elevation') { node.elevation = target.value === '' ? null : Number(target.value); node.fixed = node.elevation !== null && Number.isFinite(node.elevation); }
      else if (property === 'nodeLabel') {
        var label = String(target.value || '').trim();
        if (label && !state.nodes.some(function (item) { return item.key !== node.key && item.label === label; })) node.label = label;
      }
    } else if (state.selected.type === 'edge') {
      var edge = edgeById(state.selected.id);
      if (!edge) return false;
      var field = { edgeDistance: 'distance', edgeSlope: 'slope', edgeMinSlope: 'minSlope', edgeMaxSlope: 'maxSlope' }[property];
      if (field) {
        edge[field] = target.value === '' ? '' : Number(target.value);
        if (field === 'distance') edge.needsDistance = target.value === '';
      }
    }
    state.lastResults = null;
    if (shouldRender) render(); else save();
    return true;
  }

  document.addEventListener('click', function (event) {
    var target = event.target.closest && event.target.closest('[data-slope-action]');
    if (!target) return;
    var action = target.getAttribute('data-slope-action');
    if (action === 'mode') setMode(target.getAttribute('data-slope-mode'));
    else if (action === 'direction') setDirection(target.getAttribute('data-direction'));
    else if (action === 'connect') connectSelected();
    else if (action === 'calculate') calculate();
    else if (action === 'delete') deleteSelection();
    else if (action === 'reverse') reverseEdge();
    else if (action === 'high' || action === 'low') orientNode(action);
    else if (action === 'export') exportNetwork();
    else if (action === 'clear' && window.confirm('清空当前道路排水网络？')) reset();
  });

  document.addEventListener('change', function (event) { applyProperty(event.target, true); });
  document.addEventListener('input', function (event) { applyProperty(event.target, false); });
  document.addEventListener('keydown', function (event) {
    if ((event.key === 'Delete' || event.key === 'Backspace') && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName || '')) {
      event.preventDefault();
      deleteSelection();
    }
  });

  var canvas = document.getElementById('slopeCanvas');
  canvas.addEventListener('pointerdown', function (event) {
    var nodeElement = event.target.closest && event.target.closest('[data-slope-node]');
    var edgeElement = event.target.closest && event.target.closest('[data-slope-edge]');
    var point = pointFromEvent(event);
    var activation = nodeElement ? { type: 'node', id: nodeElement.getAttribute('data-slope-node') } : edgeElement ? { type: 'edge', id: edgeElement.getAttribute('data-slope-edge') } : null;
    var now = Date.now();
    if (activation && state.lastActivation && activation.type === state.lastActivation.type && activation.id === state.lastActivation.id && now - state.lastActivation.at < 450) {
      event.preventDefault();
      state.drag = null;
      state.lastActivation = null;
      if (nodeElement) extendNode(activation.id);
      else { state.selected = { type: 'edge', id: activation.id }; reverseEdge(); }
      return;
    }
    state.lastActivation = activation ? { type: activation.type, id: activation.id, at: now } : null;
    if (nodeElement) {
      var key = nodeElement.getAttribute('data-slope-node');
      var selected = selectedNodeKeys().slice();
      if (event.shiftKey) selected = selected.includes(key) ? selected.filter(function (id) { return id !== key; }) : selected.concat(key);
      else if (!selected.includes(key)) selected = [key];
      state.selected = { type: 'nodes', ids: selected };
      if (state.mode === 'select' && selected.length) {
        var origins = {};
        selected.forEach(function (id) { var node = nodeByKey(id); origins[id] = { x: node.x, y: node.y }; });
        state.drag = { start: point, origins: origins };
        canvas.setPointerCapture(event.pointerId);
      }
      render();
      return;
    }
    if (edgeElement) { state.selected = { type: 'edge', id: edgeElement.getAttribute('data-slope-edge') }; render(); return; }
    if (state.mode === 'add') { addNode(point); return; }
    state.selected = { type: 'nodes', ids: [] };
    state.selectionBox = { start: point, current: point };
    canvas.setPointerCapture(event.pointerId);
    render();
  });

  canvas.addEventListener('pointermove', function (event) {
    var point = pointFromEvent(event);
    if (state.drag) {
      var dx = point.x - state.drag.start.x;
      var dy = point.y - state.drag.start.y;
      Object.keys(state.drag.origins).forEach(function (key) {
        var node = nodeByKey(key);
        var origin = state.drag.origins[key];
        if (node) { node.x = Math.max(45, Math.min(955, origin.x + dx)); node.y = Math.max(28, Math.min(572, origin.y + dy)); }
      });
      render();
    } else if (state.selectionBox) {
      state.selectionBox.current = point;
      render();
    }
  });

  canvas.addEventListener('pointerup', function () {
    var moved = Boolean(state.drag);
    if (state.selectionBox) {
      var box = state.selectionBox;
      var left = Math.min(box.start.x, box.current.x);
      var right = Math.max(box.start.x, box.current.x);
      var top = Math.min(box.start.y, box.current.y);
      var bottom = Math.max(box.start.y, box.current.y);
      state.selected = { type: 'nodes', ids: state.nodes.filter(function (node) { return node.x >= left && node.x <= right && node.y >= top && node.y <= bottom; }).map(function (node) { return node.key; }) };
      state.selectionBox = null;
    }
    state.drag = null;
    if (moved) normalizeSegments();
    render();
  });

  window.addEventListener('beforeunload', save);
  load();
})();
