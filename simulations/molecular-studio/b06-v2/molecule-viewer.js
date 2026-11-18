import {THREE as T,GLTFLoader} from '../vendor/three-bundle.js';
import {FreeControls} from './free-controls.js';
import {ELEMENTS,layout,clone,connect,snapSites,atom,V} from './molecule-model.js';
import {ionLabel, atomCharge, particleLabel, clusterIds} from './ionic-model.js';
import {findTransferSnap, particleRadius} from './ionic-geometry.js';
import {studioRoom,lightRig,translucent,contactShadow} from './studio-look.js';

const up=new T.Vector3(0,1,0),vec=p=>new T.Vector3(...p);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
// Clean molecule-CAD look (studio-look.js 'cad'): satin CPK spheres from the
// Atom_cad part, uniform bond cylinders, a restrained lone-pair lobe, soft
// self-shadows and a contact shadow, all camera-relative.
const lobeLook=material=>translucent(material,{opacity:.55,edge:1.55,core:.75,max:.88});
export async function createMoleculeViewer(host,callbacks){
 const asset=await new GLTFLoader().loadAsync(new URL('./studio-parts.glb',import.meta.url).href);
 const part=(cad,kit)=>asset.scene.getObjectByName(cad)||asset.scene.getObjectByName(kit);
 const atomSource=part('Atom_cad','Atom_sculpt'),pairSource=part('Lone_pair_cad','Lone_pair_sculpt');
 if(!atomSource?.geometry||!pairSource)throw Error('The authored molecule assets are incomplete.');
 const sphere=atomSource.geometry;
 const cylinder=new T.CylinderGeometry(1,1,1,48),smallSphere=new T.SphereGeometry(1,24,16);
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0,0);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;host.prepend(renderer.domElement);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
 const scene=new T.Scene(),lights=lightRig(scene,studioRoom(renderer,'cad'),'cad',{shadow:true,extent:5});
 const ground=contactShadow();scene.add(ground.mesh);
 pairSource.traverse(obj=>{if(obj.isMesh){obj.castShadow=false;if(obj.name.includes('lobe'))lobeLook(obj.material);}});
 let reach=4,middle=new T.Vector3();
 const camera=new T.PerspectiveCamera(34,1,.1,200);camera.position.set(7,4.8,11);
 const controls=new FreeControls(camera,host);controls.minZoom=.25;controls.maxZoom=4;controls.update();
 const root=new T.Group();scene.add(root);const overlay=new T.Group();scene.add(overlay);
 const materials=new Map(),wireMaterials=new Map();
 for(const [symbol,e] of Object.entries(ELEMENTS)){
  const satin=atomSource.material.clone();satin.color.set(e.color);materials.set(symbol,satin);
  wireMaterials.set(symbol,new T.MeshBasicMaterial({color:e.color}));
 }
 const ghostMaterial=new T.MeshPhysicalMaterial({color:0x53a382,transparent:true,opacity:.2,roughness:.2,depthWrite:false});
 const ringMaterial=new T.MeshBasicMaterial({color:0x34876a,transparent:true,opacity:.78,depthTest:false});
 const selectionRing=new T.Mesh(new T.TorusGeometry(1,.014,8,72),ringMaterial);selectionRing.renderOrder=4;scene.add(selectionRing);
 const labelLayer=document.getElementById('builder-labels');let labels=[],atomMeshes=[],targets=[],bondMeshes=[],pairTargets=[];
 const portGeometry=new T.TorusGeometry(.16,.018,8,40),portMaterial=new T.MeshBasicMaterial({color:0x5a907a,transparent:true,opacity:.65,depthTest:false});
 const activePortMaterial=new T.MeshBasicMaterial({color:0x1cba84,transparent:true,opacity:1,depthTest:false});
 const dragLayer=new T.Group();scene.add(dragLayer);let hold=null,avatar=null,avatarRenderer=null,avatarScene=null,avatarCamera=null,avatarEnvironment=null;
 let graph=null,selected=null,geometry=null,options={style:'ball',pairs:false,cage:false,labels:true,spin:false,element:'C',order:1},anim=null,raf=0,lastTime=0;
 let previous=new Map(),transferMotion=null;
 function request(){if(!raf)raf=requestAnimationFrame(draw);}
 controls.addEventListener('change',request);
 function cleanup(group){group.traverse(obj=>{if(obj.userData.temporary){obj.geometry?.dispose();obj.material?.dispose();}else if(obj.userData.temporaryMaterial)obj.material?.dispose();});group.clear();}
 function size(el,id=null){
  if(graph?.transfers)return particleRadius(graph,{element:el,id});
  const r=ELEMENTS[el].r;return options.style==='space'?r*2.2:options.style==='stick'?.145:options.style==='wire'?.055:r;
 }
 function line(points,color=0x6e9d7c,opacity=.5){const object=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color,transparent:true,opacity}));object.userData.temporary=true;overlay.add(object);return object;}
 function bond(a,b,order,symbolA,symbolB){
  const meshes=[];
  for(let i=0;i<order;i++)for(const [side,symbol] of [[0,symbolA],[1,symbolB]]){
   const mesh=new T.Mesh(cylinder,options.style==='wire'?wireMaterials.get(symbol):materials.get(symbol));mesh.userData.bond={a,b};mesh.userData.segment={i,side,order};mesh.castShadow=mesh.receiveShadow=options.style!=='wire';root.add(mesh);meshes.push(mesh);targets.push(mesh);
  }return meshes;
 }
 function placeBonds(){
  for(const info of bondMeshes){
   const {a,direction,length,unit,side}=bondFrame(info);
   for(const mesh of info.meshes){const s=mesh.userData.segment,{offset,r}=rodSize(s);
    mesh.position.copy(a).addScaledVector(direction,s.side===0?.25:.75).addScaledVector(side,offset);mesh.quaternion.setFromUnitVectors(up,unit);mesh.scale.set(r,length/2,r);mesh.visible=options.style!=='space';
   }
  }
 }
 // Uniform rods; a multiple bond splits into thinner parallel rods, spread
 // across the line of sight so they stay visibly separate from any view.
 function rodSize(s){
  const multi=s.order>1,style=options.style;
  const gap=style==='wire'?.12:style==='stick'?(s.order>2?.13:.17):.19;
  const r=style==='wire'?.018:style==='stick'?(multi?(s.order>2?.05:.06):.12):(multi?.062:.085);
  return {offset:(s.i-(s.order-1)/2)*gap,r};
 }
 function bondFrame(info){
  const a=atomMeshes.find(x=>x.userData.id===info.a).position,b=atomMeshes.find(x=>x.userData.id===info.b).position;
  const direction=b.clone().sub(a),unit=direction.clone().normalize();
  const side=new T.Vector3().crossVectors(unit,camera.position.clone().sub(a).addScaledVector(direction,-.5).normalize());
  if(side.lengthSq()<.01){side.crossVectors(unit,new T.Vector3(0,0,1));if(side.lengthSq()<.01)side.crossVectors(unit,up);}
  return {a,direction,length:direction.length(),unit,side:side.normalize()};
 }
 function faceBonds(){
  for(const info of bondMeshes){if(info.order<2)continue;const {a,direction,side}=bondFrame(info);
   for(const mesh of info.meshes){const s=mesh.userData.segment;mesh.position.copy(a).addScaledVector(direction,s.side===0?.25:.75).addScaledVector(side,rodSize(s).offset);}
  }
 }
 function label(text,position,kind='atom-label'){
  const el=document.createElement('span');el.className=kind;el.textContent=text;labelLayer.append(el);labels.push({el,position});return el;
 }
 function addOverlays(){
  cleanup(overlay);labelLayer.replaceChildren();labels=[];pairTargets=[];
  for(const mesh of atomMeshes){
   const a=graph.atoms.find(a=>a.id===mesh.userData.id);
   if(!options.labels){delete mesh.userData.label;continue;}
   const kind=a.id===selected?'atom-label selected':'atom-label';
   if(graph.kind==='ionic'){
    mesh.userData.label=label(particleLabel(graph,a.id),()=>mesh.position.clone(),kind);
    mesh.userData.label.dataset.atomId=a.id;
   }else if(graph.atoms.length<=18||a.element!=='H'||a.id===selected){
    label(a.element+a.id,()=>mesh.position.clone().addScaledVector(new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1),size(a.element)+.14),kind);
   }
  }
  const a=graph.atoms.find(a=>a.id===selected);selectionRing.visible=!!a;
  if(!a||graph.kind==='ionic')return;
  const center=vec(geometry.positions.get(a.id)),frame=geometry.frames.get(a.id);
  if(options.pairs){
   for(const [index,direction] of frame.pairs.entries()){
    const pair=pairSource.clone(true);pair.position.copy(center);pair.quaternion.setFromUnitVectors(up,vec(direction));pair.scale.setScalar(1.05);
    pair.userData={pairOwner:a.id,pairIndex:index};
    pair.traverse(obj=>{if(obj.isMesh){obj.userData.pair={owner:a.id,index};pairTargets.push(obj);}if(obj.isMesh&&obj.name.includes('lobe')){obj.material=lobeLook(obj.material.clone());obj.userData.temporaryMaterial=true;}});
    overlay.add(pair);
   }
  }
  if(options.cage){
   const endpoints=[...frame.bonds,...frame.pairs].map(d=>center.clone().addScaledVector(vec(d),1.7));
   for(const p of endpoints)line([center,p],0x51957b,.35);
   for(let i=0;i<endpoints.length;i++)for(let j=i+1;j<endpoints.length;j++)line([endpoints[i],endpoints[j]],0x579e7b,.24);
   if(options.anglePair?.length===2){
    const [first,second]=options.anglePair;
    const d1=vec(geometry.positions.get(first)).sub(center).normalize(),d2=vec(geometry.positions.get(second)).sub(center).normalize();
    const angle=d1.angleTo(d2),tangent=d2.clone().addScaledVector(d1,-d1.dot(d2));if(tangent.lengthSq()<.001)tangent.crossVectors(d1,up).normalize();else tangent.normalize();
    if(tangent.lengthSq()<.001)tangent.set(0,0,1);
    const points=Array.from({length:49},(_,i)=>center.clone().addScaledVector(d1,Math.cos(angle*i/48)*1.02).addScaledVector(tangent,Math.sin(angle*i/48)*1.02));line(points,0x308464,.9);
    const mid=center.clone().addScaledVector(d1,Math.cos(angle/2)*1.3).addScaledVector(tangent,Math.sin(angle/2)*1.3);
    const triplet=[first,selected,second].map(id=>atom(graph,id).element+id).join('–');
    label(`${triplet} · ${T.MathUtils.radToDeg(angle).toFixed(1)}°`,()=>mid,'atom-label angle-label');
   }
  }
 }
 function show(next,id,settings={}){
  // An inspection click or a display toggle can redraw the same assembly
  // between two electrons. Keep the running playhead and its endpoint meshes.
  if(transferMotion&&next===graph){
   selected=id;options={...options,...settings,style:'ball'};
   addOverlays();labelLayer.append(transferMotion.marker);
   drawTransfer(performance.now(),host.clientWidth,host.clientHeight);request();
   return;
  }
  cancelTransferAnimation();
  previous=graph?.kind===next.kind&&!!graph?.transfers===!!next.transfers?new Map(atomMeshes.map(m=>[m.userData.id,{pos:m.position.clone(),size:m.scale.x}])):new Map();
  graph=next;selected=id;options={...options,...settings};geometry=layout(graph);
  if(graph.kind==='ionic')options.style='ball';
  cleanup(root);atomMeshes=[];bondMeshes=[];targets=[];
  for(const a of graph.atoms){
   const mesh=new T.Mesh(options.style==='wire'?smallSphere:sphere,options.style==='wire'?wireMaterials.get(a.element):materials.get(a.element));mesh.castShadow=mesh.receiveShadow=options.style!=='wire';
   const end=vec(geometry.positions.get(a.id)),start=previous.get(a.id);
   const radius=size(a.element,a.id);
   mesh.position.copy(start?.pos||end);mesh.scale.setScalar(start?.size??radius);mesh.userData={id:a.id,element:a.element,end,from:mesh.position.clone(),fromSize:mesh.scale.x,toSize:radius};
   atomMeshes.push(mesh);root.add(mesh);targets.push(mesh);
  }
  for(const b of graph.bonds){const a=graph.atoms.find(a=>a.id===b.a),c=graph.atoms.find(a=>a.id===b.b);bondMeshes.push({...b,meshes:bond(b.a,b.b,b.order,a.element,c.element)});}
  anim={start:performance.now(),duration:reduced?0:360};
  const spots=[...geometry.positions.values()].map(vec);
  if(spots.length){middle=new T.Box3().setFromPoints(spots).getCenter(new T.Vector3());reach=Math.max(...spots.map(p=>p.distanceTo(middle)))+2.4;}
  addOverlays();placeBonds();request();
 }
 // The graph has already accepted the contact. Play each transferred
 // electron once, between the two particles, before revealing its new charges.
 function cancelTransferAnimation(){
  if(!transferMotion)return;
  for(const {mesh} of transferMotion.ends){
   mesh.scale.setScalar(mesh.userData.toSize);mesh.userData.fromSize=mesh.userData.toSize;
   if(mesh.userData.label)mesh.userData.label.textContent=particleLabel(graph,mesh.userData.id);
  }
  transferMotion.marker.remove();transferMotion=null;request();
 }
 function animateTransfer(edge){
  cancelTransferAnimation();
  if(reduced||!graph?.transfers?.some(e=>e.donor===edge.donor&&e.acceptor===edge.acceptor&&e.electrons===edge.electrons))return;
  const ends=[edge.donor,edge.acceptor].map((id,i)=>{
   const step=i===0?1:-1, mesh=atomMeshes.find(m=>m.userData.id===id), part=atom(graph,id);
   return {mesh,part,step,startCharge:atomCharge(graph,id)-step*edge.electrons};
  });
  const marker=document.createElement('span');
  marker.className='transfer-electron';marker.textContent='e⁻';marker.setAttribute('aria-hidden','true');labelLayer.append(marker);
  transferMotion={start:performance.now(),electrons:edge.electrons,ends,marker};
  drawTransfer(transferMotion.start,host.clientWidth,host.clientHeight);
  request();
 }
 function drawTransfer(now,width,height){
  if(!transferMotion)return;
  const {start,electrons,ends,marker}=transferMotion;
  const elapsed=Math.max(0,now-start), interval=1150;
  if(elapsed>=electrons*interval){cancelTransferAnimation();return;}
  const index=Math.floor(elapsed/interval), progress=(elapsed%interval)/interval;
  const flight=Math.min(1,Math.max(0,(progress-.08)/.65));
  const settle=Math.min(1,Math.max(0,(progress-.73)/.27));
  for(const {mesh,part,step,startCharge} of ends){
   const charge=startCharge+step*index;
   mesh.scale.setScalar(T.MathUtils.lerp(particleRadius(graph,part,charge),particleRadius(graph,part,charge+step),settle));
   if(mesh.userData.label)mesh.userData.label.textContent=ionLabel(part.element,charge+(flight>=1?step:0));
  }
  const [a,b]=ends.map(e=>e.mesh.position);
  const startAt=a.clone().project(camera),endAt=b.clone().project(camera);
  const x=(1+startAt.x+(endAt.x-startAt.x)*flight)*width/2;
  const y=(1-startAt.y-(endAt.y-startAt.y)*flight)*height/2;
  const rise=Math.min(36,Math.max(16,Math.hypot((endAt.x-startAt.x)*width,(endAt.y-startAt.y)*height)*.13));
  marker.style.left=x+'px';marker.style.top=(y-Math.sin(flight*Math.PI)*rise)+'px';
  marker.hidden=false;request();
 }
 function fit(){
  if(!geometry?.positions.size){controls.target.set(0,0,0);camera.position.set(4.2,2.4,6.6);camera.up.copy(up);camera.zoom=1;controls.update();return;}
  camera.aspect=Math.max(.25,host.clientWidth/Math.max(1,host.clientHeight));
  const box=new T.Box3().setFromPoints([...geometry.positions.values()].map(vec)),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
  const vertical=Math.max(size.y+1.9,(size.x+1.9)/Math.max(.4,camera.aspect)),distance=vertical/(2*Math.tan(camera.fov*Math.PI/360))+size.z*.35;
  controls.target.copy(center);camera.up.copy(up);camera.position.copy(center).add(new T.Vector3(.35,.22,1).normalize().multiplyScalar(Math.max(7,distance)));camera.zoom=1;camera.updateProjectionMatrix();controls.update();
 }
 function draw(now=performance.now()){
  raf=0;const width=host.clientWidth,height=host.clientHeight;if(!width||!height){lastTime=0;return;}
  const ratio=Math.min(devicePixelRatio,1.75);if(renderer.domElement.width!==Math.round(width*ratio)||renderer.domElement.height!==Math.round(height*ratio)){
   renderer.setSize(width,height,false);
   const aspect=width/height;
   if(graph?.kind==='ionic'&&camera.aspect!==aspect){
    // Preserve the field of view on the shorter axis as the stage or drawer resizes.
    const scale=Math.min(1,camera.aspect)/Math.min(1,aspect);
    camera.position.sub(controls.target).multiplyScalar(scale).add(controls.target);
   }
   camera.aspect=aspect;camera.updateProjectionMatrix();
  }
  const dt=lastTime?Math.min((now-lastTime)/1000,.05):0;lastTime=now;
  if(options.spin&&!hold&&!reduced&&!document.hidden){controls.rotate(dt*.24,0);}
  if(anim){const t=anim.duration?Math.min(1,(now-anim.start)/anim.duration):1,e=1-(1-t)**3;
   for(const mesh of atomMeshes){mesh.position.lerpVectors(mesh.userData.from,mesh.userData.end,e);mesh.scale.setScalar(T.MathUtils.lerp(mesh.userData.fromSize,mesh.userData.toSize,e));}
   placeBonds();if(t===1)anim=null;else request();
  }
  drawTransfer(now,width,height);
  const chosen=atomMeshes.find(m=>m.userData.id===selected);
  if(chosen){selectionRing.position.copy(chosen.position);selectionRing.quaternion.copy(camera.quaternion);selectionRing.scale.setScalar(chosen.scale.x+.13);}
  overlay.traverse(o=>{if(o.userData.billboard)o.quaternion.copy(camera.quaternion);});
  if(hold){
   hold.targetRing.quaternion.copy(camera.quaternion);
   for(const port of hold.ports){port.mesh.quaternion.copy(camera.quaternion);const pos=vec(port.position).project(camera);port.cue.hidden=!port.mesh.visible;port.cue.style.left=(pos.x*.5+.5)*width+'px';port.cue.style.top=(-pos.y*.5+.5)*height+'px';}
   const transferSnap=hold.snap?.type==='transfer';
   const newIon=!transferSnap&&graph.kind==='ionic'&&options.labels&&hold.source.id==null&&hold.held.visible;
   const pos=newIon?hold.held.position.clone().project(camera):hold.snap?vec(hold.snap.position).project(camera):null;
   hold.label.hidden=!pos;
   if(pos){hold.label.style.left=(pos.x*.5+.5)*width+'px';hold.label.style.top=((-pos.y*.5+.5)*height-(newIon?0:26))+'px';}
  }
  camera.updateMatrixWorld();faceBonds();lights.align(camera,controls.target);lights.fit(reach+middle.distanceTo(controls.target));
  ground.update(options.style==='wire'?[]:atomMeshes.filter(m=>m.visible).map(m=>({position:m.position,radius:m.scale.x})),camera);
  scene.updateMatrixWorld();
  for(const l of labels){const pos=l.position().project(camera);l.el.hidden=pos.z>1||pos.z<0||Math.abs(pos.x)>1.1||Math.abs(pos.y)>1.1;l.el.style.left=(pos.x*.5+.5)*width+'px';l.el.style.top=(-pos.y*.5+.5)*height+'px';}
  renderer.render(scene,camera);if(options.spin&&!hold&&!reduced&&!document.hidden)request();
 }
 const ray=new T.Raycaster();
 function rayAt(x,y){const r=host.getBoundingClientRect();ray.setFromCamera(new T.Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2),camera);return ray;}
 function projectPoint(p){const r=host.getBoundingClientRect(),v=vec(p).project(camera);return {x:r.left+(v.x*.5+.5)*r.width,y:r.top+(-v.y*.5+.5)*r.height,z:v.z};}
 function pick(x,y){
  const hit=rayAt(x,y).intersectObjects([...pairTargets,...targets].filter(o=>o.visible),false)[0]?.object;
  if(hit?.userData.pair)return {kind:'pair',...hit.userData.pair};
  if(hit?.userData.id)return {kind:'atom',id:hit.userData.id,element:hit.userData.element};
  if(hit?.userData.bond){const edge=graph.bonds.find(b=>b.a===hit.userData.bond.a&&b.b===hit.userData.bond.b);return {kind:'bond',edge:{...edge},anchor:[edge.a,edge.b].includes(selected)?selected:edge.a,order:edge.order};}
  return null;
 }
 function piece(source){
  if(source.kind==='atom'){const mesh=new T.Mesh(sphere,materials.get(source.element));mesh.scale.setScalar(size(source.element,source.id));return mesh;}
  if(source.kind==='pair'){const group=pairSource.clone(true);group.position.set(0,-.95,0);const wrapper=new T.Group();wrapper.add(group);return wrapper;}
  const group=new T.Group();for(let i=0;i<source.order;i++){const rod=new T.Mesh(cylinder,materials.get('C'));rod.scale.set(.065,1.3,.065);rod.position.x=(i-(source.order-1)/2)*.2;group.add(rod);}return group;
 }
 function prepareAvatar(source){
  if(!avatarRenderer){avatar=document.createElement('div');avatar.className='held-part';avatar.setAttribute('aria-hidden','true');document.body.append(avatar);avatarRenderer=new T.WebGLRenderer({alpha:true,antialias:true});avatarRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));avatarRenderer.setSize(104,104);avatarRenderer.setClearColor(0,0);avatarRenderer.toneMapping=T.ACESFilmicToneMapping;avatarRenderer.toneMappingExposure=1;avatar.append(avatarRenderer.domElement);avatarCamera=new T.PerspectiveCamera(34,1,.1,30);avatarCamera.position.set(1.4,.7,3.7);avatarCamera.lookAt(0,0,0);}
  avatarScene=new T.Scene();avatarEnvironment||=studioRoom(avatarRenderer,'cad');lightRig(avatarScene,avatarEnvironment,'cad').align(avatarCamera);avatarScene.add(piece(source));avatarRenderer.render(avatarScene,avatarCamera);
 }
 function beginHold(source){
  cancelTransferAnimation();
  anim=null;controls.enabled=false;controls.pointers.clear();
  const origin=source.id!=null?atom(graph,source.id).position:source.owner!=null?atom(graph,source.owner).position:atom(graph,selected)?.position||controls.target.toArray();
  const held=piece(source);dragLayer.add(held);prepareAvatar(source);
  const ports=[];
  if(source.kind!=='bond')for(const a of graph.atoms)for(const site of snapSites(graph,a.id,source)){
   const mesh=new T.Mesh(portGeometry,portMaterial);mesh.position.copy(vec(site.position));mesh.renderOrder=8;mesh.visible=false;dragLayer.add(mesh);const cue=document.createElement('span');cue.className='port-cue';cue.dataset.portTarget=site.target;cue.dataset.portIndex=site.index;cue.textContent='+';cue.hidden=true;labelLayer.append(cue);ports.push({...site,mesh,cue});
  }
  const tag=document.createElement('span');tag.className='atom-label snap-label';tag.hidden=true;labelLayer.append(tag);
  const lineGeo=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]),preview=new T.Line(lineGeo,new T.LineDashedMaterial({color:0x2f9b75,dashSize:.09,gapSize:.06}));preview.visible=false;dragLayer.add(preview);
  const targetRing=new T.Mesh(portGeometry,activePortMaterial);targetRing.visible=false;targetRing.renderOrder=9;dragLayer.add(targetRing);
  hold={source,held,plane:new T.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()),vec(origin)),ports,label:tag,preview,targetRing,snap:null,origin,
   cluster:graph.transfers?clusterIds(graph,source.id):null};
  if(source.kind==='atom'&&source.id!=null)atomMeshes.find(m=>m.userData.id===source.id).visible=false;
  if(source.kind==='pair'&&source.owner!=null)for(const group of overlay.children)if(group.userData.pairOwner===source.owner&&group.userData.pairIndex===source.index)group.visible=false;
  if(source.kind==='bond'&&source.edge)for(const b of bondMeshes)if(b.a===source.edge.a&&b.b===source.edge.b)for(const mesh of b.meshes)mesh.visible=false;
  request();
 }
 function worldAt(x,y){
  const plane=hold?.plane||new T.Plane();
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()),hold?vec(hold.origin):controls.target);
  return rayAt(x,y).ray.intersectPlane(plane,new T.Vector3())?.toArray();
 }
 function findSnap(x,y,touch=false,point=null){
  if(!hold)return null;
  if(graph.transfers)return findTransferSnap(graph,hold.source,point||worldAt(x,y),
    new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0).toArray(),new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1).toArray());
  if(graph.kind==='ionic')return null;const s=hold.source,threshold=touch?38:30;
  if(s.kind==='bond'){
   let best=null,distance=threshold;
   for(const a of graph.atoms){if(a.id===s.anchor)continue;const p=projectPoint(a.position),d=Math.hypot(p.x-x,p.y-y);if(d>=distance)continue;try{const g=clone(graph);if(s.edge)g.bonds=g.bonds.filter(b=>!(b.a===s.edge.a&&b.b===s.edge.b));connect(g,s.anchor,a.id,s.order);best={target:a.id,position:[...a.position],type:'bond'};distance=d;}catch{}}
   if(best)return best;
   for(const b of graph.bonds){const a=projectPoint(atom(graph,b.a).position),c=projectPoint(atom(graph,b.b).position),dx=c.x-a.x,dy=c.y-a.y,denom=dx*dx+dy*dy;if(denom<1)continue;const t=((x-a.x)*dx+(y-a.y)*dy)/denom;if(t<.2||t>.8)continue;const d=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);if(d>18)continue;try{const g=clone(graph);connect(g,b.a,b.b,s.order);return {edge:{...b},position:V.mul(V.add(atom(graph,b.a).position,atom(graph,b.b).position),.5),type:'replace-bond'};}catch{}}
   return null;
  }
  const nearby=graph.atoms.map(a=>({id:a.id,p:projectPoint(a.position)})).map(a=>({...a,d:Math.hypot(a.p.x-x,a.p.y-y)})).sort((a,b)=>a.d-b.d).slice(0,2).filter(a=>a.d<260);
  let best=null,distance=threshold;
  for(const port of hold.ports){const p=projectPoint(port.position);port.mesh.visible=nearby.some(a=>a.id===port.target)&&p.z>0&&p.z<1;port.mesh.material=portMaterial;if(!port.mesh.visible)continue;const d=Math.hypot(p.x-x,p.y-y);if(d<distance){best=port;distance=d;}}
  if(best)best.mesh.material=activePortMaterial;return best;
 }
 function moveHold(x,y,point,snap,inside){
  if(!hold)return;const s=hold.source;hold.snap=snap;
  avatar.hidden=inside;avatar.style.transform=`translate(${x-52}px,${y-52}px)`;hold.held.visible=inside;
  const location=snap?.position||point;if(!location)return;
  hold.held.position.copy(vec(location));
  if(s.kind==='pair'&&snap)hold.held.quaternion.setFromUnitVectors(up,vec(snap.direction));
  if(graph.transfers&&s.kind==='atom'){
   const delta=V.sub(location,hold.origin);
   for(const mesh of atomMeshes){
    const {id,end}=mesh.userData,aligned=inside&&snap?.positions?.get(id);
    mesh.position.copy(end);
    if(aligned)mesh.position.copy(vec(aligned));
    else if(inside&&hold.cluster.has(id))mesh.position.add(vec(delta));
   }
  }else if(s.kind==='atom'&&s.id!=null&&inside){atomMeshes.find(m=>m.userData.id===s.id).position.copy(vec(location));for(const group of overlay.children)if(group.userData.pairOwner===s.id)group.position.copy(vec(location));placeBonds();}
  if(s.kind==='atom'&&s.id!=null)for(const mesh of atomMeshes)if(mesh.userData.id===s.id)mesh.visible=!inside;
  const transfer=snap?.type==='transfer';
  hold.label.textContent=transfer?'Transfer '+snap.electrons+' e⁻':graph.transfers?s.element:graph.kind==='ionic'&&s.kind==='atom'?ionLabel(s.element):snap?(snap.type==='replace-bond'?'Release to change this bond':'Release to snap · '+atom(graph,snap.target).element+snap.target):'';
  hold.targetRing.visible=inside&&(transfer||s.kind==='bond'&&snap?.type==='bond');
  if(hold.targetRing.visible){const target=atom(graph,snap.target);hold.targetRing.position.copy(vec(target.position));hold.targetRing.scale.setScalar((size(target.element,target.id)+.13)/.16);}
  let anchor=snap?.target!=null?atom(graph,snap.target).position:null;
  if(s.kind==='bond')anchor=atom(graph,s.anchor)?.position;
  hold.preview.visible=inside&&!!anchor&&!transfer;
  if(anchor){hold.preview.geometry.setFromPoints([vec(anchor),vec(location)]);hold.preview.computeLineDistances();}
  if(s.kind==='bond'&&inside&&anchor){const midpoint=vec(anchor).lerp(vec(location),.5),d=vec(location).sub(vec(anchor));hold.held.position.copy(midpoint);hold.held.quaternion.setFromUnitVectors(up,d.clone().normalize());hold.held.scale.set(1,d.length()/1.3,1);}
  request();
 }
 function endHold(){
  if(!hold)return;hold.label.remove();for(const port of hold.ports)port.cue.remove();hold.preview.geometry.dispose();hold.preview.material.dispose();dragLayer.clear();hold=null;controls.enabled=true;if(avatar)avatar.hidden=true;
  show(graph,selected,options);request();
 }
 host.addEventListener('keydown',e=>{
  const turns={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]};
  if(turns[e.key]){e.preventDefault();controls.rotate(...turns[e.key]);}else if(e.key==='Home'){e.preventDefault();fit();}else if(e.key==='+'||e.key==='='){e.preventDefault();controls.zoom(1.15);}else if(e.key==='-'){e.preventDefault();controls.zoom(1/1.15);}else if(e.key.toLowerCase()==='q'||e.key.toLowerCase()==='e'){e.preventDefault();controls.rotate(0,0,e.key.toLowerCase()==='q'?.15:-.15);}
 });
 new ResizeObserver(request).observe(host);document.addEventListener('b06-mode',()=>{cancelTransferAnimation();request();});document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelTransferAnimation();lastTime=0;request();});
 function snapshot(){
  draw();
  const c=document.createElement('canvas');c.width=renderer.domElement.width;c.height=renderer.domElement.height;
  const x=c.getContext('2d'),g=x.createRadialGradient(c.width/2,c.height/2,0,c.width/2,c.height/2,c.width*.65);
  g.addColorStop(0,'#fffefa');g.addColorStop(1,'#dde7dc');x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
  x.drawImage(renderer.domElement,0,0);
  if(graph.kind==='ionic'&&options.labels){
   const scale=c.width/host.clientWidth;
   x.save();x.font=`650 ${12*scale}px system-ui`;x.textAlign='center';x.textBaseline='middle';
   for(const {el,position} of labels){
    if(el.hidden)continue;
    const p=position().project(camera),cx=(.5+p.x/2)*c.width,cy=(.5-p.y/2)*c.height;
    const width=x.measureText(el.textContent).width+8*scale;
    x.fillStyle='#fbfcf5e8';x.fillRect(cx-width/2,cy-8*scale,width,16*scale);
    x.fillStyle='#244d40';x.fillText(el.textContent,cx,cy);
   }
   x.restore();
  }
  x.fillStyle='#294e40';x.font=`${Math.max(16,c.width/70)}px Segoe UI`;
  x.fillText(graph.kind==='ionic'?'Ionic compounds':graph.name+' · '+options.style,24,30);
  return c.toDataURL('image/png');
 }
 return {show,fit,controls,element:host,zoom:f=>controls.zoom(f),snapshot,pick,beginHold,moveHold,endHold,worldAt,findSnap,projectPoint,animateTransfer,cancelTransferAnimation,getPose:()=>({position:camera.position.toArray(),up:camera.up.toArray(),target:controls.target.toArray()}),project:id=>{const mesh=atomMeshes.find(m=>m.userData.id===id);if(!mesh)return null;const p=mesh.position.clone().project(camera);return {x:(p.x/2+.5)*host.clientWidth,y:(.5-p.y/2)*host.clientHeight};}};
}
