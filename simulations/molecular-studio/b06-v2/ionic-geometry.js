import {ELEMENTS, V, atom, removeAtom} from './molecule-model.js';
import {atomCharge, chargeRadiusScale, clusterIds, ionFor, transferCapacity} from './ionic-model.js';

const distance=(a,b)=>Math.hypot(...V.sub(a,b));
export function particleRadius(graph, part, charge=atomCharge(graph,part.id)){
  return ELEMENTS[part.element].r*chargeRadiusScale(part.element,charge);
}

// Keep previous contacts tangent as the central particle changes radius.
// The transfer ledger connects trees, so branches retain their orientation.
function settledGroup(graph, root, center, radii){
  const positions=new Map([[root,center]]), pending=[root];
  while(pending.length){
    const from=pending.pop();
    for(const {donor,acceptor} of graph.transfers){
      const next=donor===from?acceptor:acceptor===from?donor:null;
      if(next===null||positions.has(next))continue;
      const direction=V.unit(V.sub(atom(graph,next).position,atom(graph,from).position));
      positions.set(next,V.add(positions.get(from),V.mul(direction,radii.get(from)+radii.get(next))));
      pending.push(next);
    }
  }
  return positions;
}

function fits(graph,positions,radii){
  for(const [id,p] of positions){
    if(!p.every(v=>Number.isFinite(v)&&Math.abs(v)<=100))return false;
    for(const part of graph.atoms){
      if(id===part.id)continue;
      const other=positions.get(part.id)||part.position;
      if(distance(p,other)+.003<radii.get(id)+radii.get(part.id))return false;
    }
  }
  return true;
}

export function findTransferSnap(graph,source,point,viewRight=[1,0,0],viewUp=[0,1,0]){
  if(!point||source.kind!=='atom'||!graph.transfers)return null;
  const sourceId=source.id??null, moving={id:sourceId,element:source.element};
  const sourceCharge=atomCharge(graph,sourceId), sign=Math.sign(ionFor(source.element)?.charge);
  if(!sign)return null;
  const sourceRadius=particleRadius(graph,moving,sourceCharge);
  const near=graph.atoms.map(part=>({part,d:distance(point,part.position)}))
    .filter(({part,d})=>part.id!==sourceId&&Math.sign(ionFor(part.element)?.charge)===-sign&&d<=sourceRadius+particleRadius(graph,part)+.24)
    .sort((a,b)=>a.d-b.d);
  for(const {part:target} of near){
    const electrons=transferCapacity(graph,sourceId,source.element,target.id);
    if(!electrons)continue;
    const after=new Map(graph.atoms.map(part=>[part.id,particleRadius(graph,part)]));
    after.set(sourceId,particleRadius(graph,moving,sourceCharge+sign*electrons));
    after.set(target.id,particleRadius(graph,target,atomCharge(graph,target.id)-sign*electrons));
    const fixed=settledGroup(graph,target.id,target.position,after);
    const movingOffsets=settledGroup(graph,sourceId,[0,0,0],after);
    const approach=V.sub(point,target.position), normal=V.cross(viewRight,viewUp);
    const first=Math.hypot(...approach)>.001?V.unit(approach):viewRight;
    // A nearly end-on approach otherwise hides one entire participant in the
    // current camera view, making the electron exchange impossible to see.
    const directions=Math.abs(V.dot(first,normal))>.7?[viewRight]:[first];
    // When the preferred side is occupied, try the opposite side of an
    // existing contact, followed by camera-relative alternatives in 3D.
    for(const {donor,acceptor} of graph.transfers){
      const neighbor=donor===target.id?acceptor:acceptor===target.id?donor:null;
      if(neighbor!==null)directions.push(V.unit(V.sub(target.position,atom(graph,neighbor).position)));
    }
    for(const axis of [viewRight,viewUp,normal])directions.push(axis,V.mul(axis,-1));
    // Try the directions that separate the projected labels first, even
    // when the next atom approaches on a side already taken by a partner.
    directions.sort((a,b)=>Number(Math.abs(V.dot(a,normal))>.7)-Number(Math.abs(V.dot(b,normal))>.7));
    const contact=after.get(sourceId)+after.get(target.id);
    for(const direction of directions){
      const position=V.add(target.position,V.mul(direction,contact)), positions=new Map(fixed);
      for(const [id,offset] of movingOffsets)positions.set(id,V.add(position,offset));
      if(fits(graph,positions,after))return {type:'transfer',target:target.id,position,positions,electrons};
    }
  }
  return null;
}

export function moveTransferGroup(graph,id,position,snap=null){
  const part=atom(graph,id), radii=new Map(graph.atoms.map(a=>[a.id,particleRadius(graph,a)]));
  const positions=new Map();
  if(snap){
    const electrons=transferCapacity(graph,id,part.element,snap.target);
    if(!electrons||electrons!==snap.electrons)throw Error('This contact is no longer available.');
    const sign=Math.sign(ionFor(part.element).charge), target=atom(graph,snap.target);
    radii.set(id,particleRadius(graph,part,atomCharge(graph,id)+sign*electrons));
    radii.set(target.id,particleRadius(graph,target,atomCharge(graph,target.id)-sign*electrons));
    for(const [key,p] of snap.positions)positions.set(key??id,p);
  }else{
    const delta=part.position?V.sub(position,part.position):[0,0,0];
    for(const key of clusterIds(graph,id))positions.set(key,key===id?position:V.add(atom(graph,key).position,delta));
  }
  if(!fits(graph,positions,radii))throw Error('Move the group into clear space or approach an available contact.');
  for(const [key,p] of positions)atom(graph,key).position=[...p];
}

export function removeTransferParticle(graph,id){
  const affected=graph.transfers.filter(t=>t.donor===id||t.acceptor===id)
    .map(t=>t.donor===id?t.acceptor:t.donor);
  removeAtom(graph,id);
  const radii=new Map(graph.atoms.map(a=>[a.id,particleRadius(graph,a)]));
  for(const root of new Set(affected)){
    const rest=settledGroup(graph,root,atom(graph,root).position,radii);
    for(const [key,p] of rest)atom(graph,key).position=p;
  }
}
