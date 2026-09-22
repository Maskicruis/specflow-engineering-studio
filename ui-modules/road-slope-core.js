(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SpecFlowRoadSlope=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function finite(value){return value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value));}
  function rounded(value,decimals){return Number(Number(value).toFixed(Math.max(0,Math.min(6,Number(decimals)||0))));}
  function segmentNodeKeys(from,to,nodes,tolerance){
    nodes=Array.isArray(nodes)?nodes:[];var a=nodes.find(function(node){return node.key===from;}),b=nodes.find(function(node){return node.key===to;});
    if(!a||!b||!finite(a.x)||!finite(a.y)||!finite(b.x)||!finite(b.y)||from===to)return[from,to];
    var dx=Number(b.x)-Number(a.x),dy=Number(b.y)-Number(a.y),lengthSquared=dx*dx+dy*dy;if(lengthSquared<1)return[from,to];
    var corridor=Math.max(4,Number(tolerance)||28),between=nodes.map(function(node){
      if(node.key===from||node.key===to||!finite(node.x)||!finite(node.y))return null;
      var px=Number(node.x)-Number(a.x),py=Number(node.y)-Number(a.y),position=(px*dx+py*dy)/lengthSquared;
      if(position<=0.02||position>=0.98)return null;
      var projectedX=Number(a.x)+position*dx,projectedY=Number(a.y)+position*dy;
      return Math.hypot(Number(node.x)-projectedX,Number(node.y)-projectedY)<=corridor?{key:node.key,position:position}:null;
    }).filter(Boolean).sort(function(left,right){return left.position-right.position;});
    return[from].concat(between.map(function(node){return node.key;}),[to]);
  }
  function normalizeSegments(input){
    input=input||{};var nodes=Array.isArray(input.nodes)?input.nodes:[],edges=Array.isArray(input.edges)?input.edges:[],chosen=new Map(),splitEdges=0,clearedDistances=0,duplicates=0;
    edges.forEach(function(edge,edgeIndex){
      var keys=segmentNodeKeys(edge.from,edge.to,nodes,input.tolerance),direct=keys.length===2;if(!direct)splitEdges+=1;
      for(var index=0;index<keys.length-1;index+=1){
        var from=keys[index],to=keys[index+1],pair=[from,to].sort().join('\n'),candidate=Object.assign({},edge,{id:direct?edge.id:String(edge.id||('edge_'+edgeIndex))+'__segment_'+(index+1),from:from,to:to});
        if(!direct){candidate.distance='';candidate.needsDistance=true;clearedDistances+=1;}
        var existing=chosen.get(pair),record={edge:candidate,direct:direct,order:edgeIndex};
        if(!existing)chosen.set(pair,record);else{duplicates+=1;if(direct&&!existing.direct)chosen.set(pair,record);}
      }
    });
    return{edges:Array.from(chosen.values()).sort(function(left,right){return left.order-right.order;}).map(function(record){return record.edge;}),splitEdges:splitEdges,clearedDistances:clearedDistances,duplicates:duplicates};
  }
  function calculateNetwork(input){
    input=input||{};var decimals=Math.max(0,Math.min(6,Number(input.decimals)||3)),nodes=Array.isArray(input.nodes)?input.nodes:[],edges=Array.isArray(input.edges)?input.edges:[],elevations={},issues=[],edgeResults=[];
    nodes.forEach(function(node){if(node.fixed&&finite(node.elevation))elevations[node.key]=rounded(node.elevation,decimals);});
    var limit=Math.max(1,nodes.length*edges.length+nodes.length);
    for(var pass=0;pass<limit;pass+=1){var changed=false;edges.forEach(function(edge){var distance=Number(edge.distance),slope=Number(edge.slope);if(!(distance>0)||!Number.isFinite(slope))return;var drop=distance*slope/1000,from=elevations[edge.from],to=elevations[edge.to];if(finite(from)&&!finite(to)){elevations[edge.to]=rounded(Number(from)-drop,decimals);changed=true;}else if(finite(to)&&!finite(from)){elevations[edge.from]=rounded(Number(to)+drop,decimals);changed=true;}});if(!changed)break;}
    var tolerance=Math.pow(10,-decimals)*1.1;
    edges.forEach(function(edge){var distance=Number(edge.distance),designSlope=Number(edge.slope),from=elevations[edge.from],to=elevations[edge.to],result={id:edge.id,from:edge.from,to:edge.to,distance:distance,designSlope:designSlope,actualSlope:null,drop:null,status:'pending',issues:[]};if(!(distance>0)){result.status='error';result.issues.push('实际距离必须大于 0');}else if(!Number.isFinite(designSlope)){result.status='error';result.issues.push('设计坡度无效');}else if(finite(from)&&finite(to)){result.drop=Number(from)-Number(to);result.actualSlope=result.drop/distance*1000;var expected=distance*designSlope/1000;if(Math.abs(result.drop-expected)>tolerance){result.issues.push('已知标高与设计坡度形成网络冲突');}var min=finite(edge.minSlope)?Number(edge.minSlope):null,max=finite(edge.maxSlope)?Number(edge.maxSlope):null;if(result.actualSlope<0)result.issues.push('实际高程方向与排水箭头相反');if(min!==null&&result.actualSlope+tolerance<min)result.issues.push('实际坡度小于规范最小值');if(max!==null&&result.actualSlope-tolerance>max)result.issues.push('实际坡度大于规范最大值');result.status=result.issues.length?'warning':'ok';}else{result.status='unresolved';result.issues.push('该坡段尚未连接到已知控制标高');}edgeResults.push(result);result.issues.forEach(function(message){issues.push({edgeId:edge.id,message:message});});});
    nodes.forEach(function(node){if(!finite(elevations[node.key]))issues.push({nodeKey:node.key,message:'节点未连接到任何已知控制标高'});});
    return{elevations:elevations,edgeResults:edgeResults,issues:issues,resolved:Object.keys(elevations).length,total:nodes.length,ok:issues.length===0};
  }
  return{calculateNetwork:calculateNetwork,finite:finite,rounded:rounded,segmentNodeKeys:segmentNodeKeys,normalizeSegments:normalizeSegments};
});
