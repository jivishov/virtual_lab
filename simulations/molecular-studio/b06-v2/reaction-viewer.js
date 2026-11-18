import {THREE as T,GLTFLoader} from '../vendor/three-bundle.js';
import {FreeControls} from './free-controls.js';
import {studioRoom,lightRig} from './studio-look.js';
import {ELEMENTS} from './molecule-model.js';
import {atomRadius,particleText,sub} from './reaction-model.js';
const extra={Zn:'#98a9bc',Fe:'#b77751',Cu:'#b9784b',Ag:'#bdc9d3'};
export const colorFor=el=>ELEMENTS[el]?.color||extra[el]||'#88a3a0';
const PHASE_NAMES={s:'solid',l:'liquid',g:'gas',aq:'aqueous solution'};
const captionText=term=>'<strong>'+(term.coefficient===1?'':term.coefficient+' ')+sub(term.formula)+'('+term.phase+')</strong><small>'+PHASE_NAMES[term.phase]+'</small>';
export async function createReactionViewer(host,callbacks){
 const asset=await new GLTFLoader().loadAsync(new URL('./studio-parts.glb',import.meta.url).href);
 const source=asset.scene.getObjectByName('Atom_cad')||asset.scene.getObjectByName('Atom_sculpt');
 if(!source?.geometry)throw Error('The studio atom asset is missing.');
 const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.toneMapping=T.ACESFilmicToneMapping;
 host.prepend(renderer.domElement);
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-16,16,10,-10,.1,300);
 const rig=lightRig(scene,studioRoom(renderer,'cad'),'cad');
 const atoms=new Map(),bonds=new Map(),labels=document.createElement('div');labels.className='rx-atom-labels';host.append(labels);
 const notation=document.createElement('div');notation.className='rx-equation-notation';host.prepend(notation);
 const materials=new Map(),cylinder=new T.CylinderGeometry(1,1,1,20),up=new T.Vector3(0,1,0);
 const ray=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(),hitPoint=new T.Vector3();
 let state={atoms:[],bonds:[]},selected=[],drag=null,active=true,dirty=true,showIds=false,hoveredId=null,trackedId=null,fitEnvelope=null;
 let notationKey='',notationItems=[],equationState={},yaw=0,pitch=0;
 const particleLabels=new Map();
 function hit(e){const r=host.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects([...atoms.values()].map(a=>a.mesh))[0];}
 // Claim atom drags before the shared orbit handler receives pointerdown.
 host.addEventListener('pointerdown',e=>{
  if(!active||e.button!==0||!callbacks.editable())return;
  const found=hit(e);if(!found)return;e.stopImmediatePropagation();e.preventDefault();
  const id=found.object.userData.atomId,a=state.atoms.find(a=>a.id===id);
  drag={id,pointerId:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()),new T.Vector3(...a.p));
  host.setPointerCapture(e.pointerId);host.focus({preventScroll:true});
 },true);
 host.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointerId)return;e.stopImmediatePropagation();e.preventDefault();
  if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>4){callbacks.beforeMove();drag.moved=true;}
  if(drag.moved){hit(e);if(ray.ray.intersectPlane(plane,hitPoint))callbacks.move(drag.id,hitPoint.toArray());}
 },true);
 function release(e){if(!drag||e.pointerId!==drag.pointerId)return;e.stopImmediatePropagation();
  const d=drag;drag=null;if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);
  if(e.type==='pointerup'&&!d.moved)callbacks.select(d.id);
 }
 for(const type of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(type,release,true);
 host.addEventListener('pointermove',e=>{if(!active||drag)return;const id=hit(e)?.object.userData.atomId??null;if(id!==hoveredId){hoveredId=id;dirty=true;}});
 host.addEventListener('pointerleave',()=>{hoveredId=null;dirty=true;});
 // Observation selection is separate from editing: an ID can stay pinned in
 // playback without authorizing any change to the atoms or connections.
 host.addEventListener('click',e=>{if(!active||callbacks.editable())return;const id=hit(e)?.object.userData.atomId??null;trackedId=trackedId===id?null:id;callbacks.track?.(trackedId);dirty=true;});
 const controls=new FreeControls(camera,host);controls.addEventListener('change',()=>dirty=true);
 // Mild tilting preserves left-to-right reading. The equation cannot be flipped
 // or panned off its two sides by the shared free-camera controls.
 controls.rotate=(dx,dy)=>{yaw=T.MathUtils.clamp(yaw-dx,-.32,.32);pitch=T.MathUtils.clamp(pitch-dy,-.28,.28);camera.up.set(0,1,0);camera.position.set(80*Math.sin(yaw)*Math.cos(pitch),80*Math.sin(pitch),80*Math.cos(yaw)*Math.cos(pitch));controls.update();};
 controls.pan=()=>{};controls.minZoom=.8;controls.maxZoom=1.5;
 host.addEventListener('keydown',e=>{if(e.target!==host)return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();controls.rotate(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0,e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0);}
 });
 // The scale comes from the room the notation really takes: the side headings and one row of atom
 // labels above the groups, a caption under each group (beside it when the sides are stacked) and
 // the note at the foot of the model. Caption sizes come from the final captions, so the scale is
 // the same at load, while predicting and at the end.
 function captionSizes(terms){
  const probe=document.createElement('div');probe.className='rx-term-caption';probe.style.visibility='hidden';notation.append(probe);
  const sizes=terms.map(term=>{probe.innerHTML=captionText(term);return {w:Math.max(54,probe.offsetWidth),h:probe.offsetHeight};});
  probe.remove();return sizes;
 }
 function reserves(h){
  const r=host.getBoundingClientRect();let top=0,bottom=0;
  for(const el of host.parentElement.querySelectorAll('.rx-title,.rx-side-headings,.rx-view-tools,.rx-stage-caption')){
   if(el.hidden||!el.getClientRects().length)continue;const b=el.getBoundingClientRect();
   if(b.right<=r.left||b.left>=r.right||b.bottom<=r.top||b.top>=r.top+h)continue;
   if(b.top+b.bottom<2*r.top+h)top=Math.max(top,b.bottom-r.top);else bottom=Math.max(bottom,r.top+h-b.top);
  }
  return {top,bottom};
 }
 function fit(all=state.atoms){
  fitEnvelope=all;
  const w=host.clientWidth||800,h=host.clientHeight||500,d=state.diagram;
  let scale,top;
  if(!d){scale=Math.max(1,Math.min((w-32)/28,Math.max(150,h-160)/14));top=(h/2+38)/scale;}
  else{
   notation.classList.toggle('rx-beside',!!d.vertical);notation.classList.remove('rx-wrap','rx-terse');notation.style.setProperty('--rx-cap-k','1');
   const terms=[...d.reactants.terms,...d.products.terms],room=reserves(h),above=room.top+30,avail=h-above-room.bottom-8;
   const centre=t=>t.y+.65,half=t=>t.atomTopY-centre(t),edge=d.arrowGap/2+d.sideWidth;
   const solve=sizes=>{
    const capW=Math.max(...sizes.map(c=>c.w)),capH=Math.max(...sizes.map(c=>c.h));
    // Widest scale that keeps every group and caption inside the model, then the tallest one.
    const sW=d.vertical?(w/2-14-capW)/edge:Math.min((w-32)/d.width,...terms.map((t,i)=>(w/2-8-sizes[i].w/2)/Math.max(.1,Math.abs(t.x))));
    const upper=s=>Math.max(...terms.map(t=>d.vertical?centre(t)*s+Math.max(half(t)*s,capH/2):t.atomTopY*s));
    const lower=s=>Math.min(...terms.map(t=>d.vertical?centre(t)*s-Math.max(half(t)*s,capH/2):t.captionY*s-capH));
    const span=s=>upper(s)-lower(s);let s;
    if(span(Math.max(1,sW))<=avail)s=Math.max(1,sW);
    else if(avail<=0||span(1)>avail)s=Math.max(1,Math.min(sW,150/((upper(1)-lower(1))||1)));
    else{let lo=1,hi=sW;for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(span(mid)<=avail)lo=mid;else hi=mid;}s=lo;}
    // Only when the model is too small for full-size captions (short Chromebook screens, narrow phones)
    // do they shrink with the scale, so neighbouring captions still stand apart.
    // Side by side, a caption is as wide as its text or the line under its group, whichever is wider,
    // and only the text shrinks: k is the largest text factor that keeps 6 px between neighbours. When
    // even the lines would touch, smaller captions still help: they leave the model more height.
    let k=1;const bar=i=>Math.max(54,terms[i].width*s),fits=(f,a,space)=>Math.max(sizes[a].w*f,bar(a))+Math.max(sizes[a+1].w*f,bar(a+1))<=2*space;
    for(const side of ['reactants','products']){const t=d[side].terms,first=d.reactants.terms.length*(side==='products');
     for(let i=0;i+1<t.length;i++){
      if(d.vertical){k=Math.min(k,((centre(t[i])-centre(t[i+1]))*s-4)/capH);continue;}
      const a=first+i,space=(t[i+1].x-t[i].x)*s-6;if(fits(1,a,space))continue;
      if(!fits(0,a,space)){k=Math.min(k,space/((sizes[a].w+sizes[a+1].w)/2));continue;}
      let lo=0,hi=1;for(let n=0;n<12;n++){const m=(lo+hi)/2;if(fits(m,a,space))lo=m;else hi=m;}k=Math.min(k,lo);
     }}
    return {scale:s,top:(above+Math.max(0,avail-span(s))/2+upper(s))/s,k};
   };
   // Side by side, the captions are measured as drawn at each trial size (a few passes, only here):
   // first they shrink to three quarters; then the phase name (10 px at most, so it no longer shrinks)
   // wraps under the formula (rx-wrap) and the formula may shrink to .65 (11 px or more); on the shortest
   // screens the phase name finally steps aside (rx-terse; the formula keeps its state symbol).
   // Smaller captions also leave the model more height. The camera is set once, below, as before.
   let k=1,fitted=solve(captionSizes(terms));
   if(d.vertical)k=Math.max(.75,Math.min(1,fitted.k));
   else for(const [cls,floor] of [['',.75],['rx-wrap',.65],['rx-terse',.65]]){
    if(cls){notation.classList.add(cls);fitted=solve(captionSizes(terms));}
    for(let i=0;i<4&&fitted.k<1&&k>floor;i++){k=Math.max(floor,k*fitted.k);notation.style.setProperty('--rx-cap-k',k.toFixed(3));fitted=solve(captionSizes(terms));}
    if(fitted.k>=1)break;
   }
   scale=fitted.scale;top=fitted.top;
   notation.style.setProperty('--rx-cap-k',k.toFixed(3));
  }
  camera.left=-w/(2*scale);camera.right=w/(2*scale);camera.top=top;camera.bottom=top-h/scale;
  controls.target.set(0,0,0);camera.position.set(0,0,80);yaw=pitch=0;camera.up.set(0,1,0);camera.zoom=1;camera.updateProjectionMatrix();controls.update();dirty=true;
 }
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);fit(fitEnvelope||state.atoms);}
 new ResizeObserver(resize).observe(host);
 function atomMaterial(el){if(!materials.has(el)){const m=source.material.clone();m.color.set(colorFor(el));materials.set(el,m);}return materials.get(el);}
 function updateNotation(){
  const d=state.diagram;if(!d){notation.replaceChildren();notationItems=[];notationKey='';return;}
  const key=JSON.stringify([d.vertical,d.width,d.height,d.reactants.terms.map(t=>[t.formula,t.coefficient,t.phase,t.x,t.y]),d.products.terms.map(t=>[t.formula,t.coefficient,t.phase,t.x,t.y])]);
  if(key!==notationKey){
   notationKey=key;notation.replaceChildren();notationItems=[];
   for(const side of ['reactants','products']){
    // Stacked sides: each caption sits beside its group at the outer edge of the column, and each
    // plus sits halfway between the atoms of the groups it joins.
    const edge=(side==='reactants'?-1:1)*(d.arrowGap/2+d.sideWidth),terms=d[side].terms;
    terms.forEach((term,index)=>{const el=document.createElement('div');el.className='rx-term-caption';el.dataset.rxSide=side;el.dataset.rxTerm=index;notation.append(el);notationItems.push({el,term,side,x:d.vertical?edge:term.x,y:d.vertical?term.y+.65:term.captionY});});
    d[side].plus.forEach((p,index)=>{const el=document.createElement('span');el.className='rx-equation-plus';el.dataset.rxSymbol='plus';el.dataset.rxSide=side;el.textContent='+';el.setAttribute('aria-label','plus');notation.append(el);
     const a=terms[index],b=terms[index+1],y=d.vertical&&a&&b?(2*(a.y+.65)-a.atomTopY+b.atomTopY)/2:p.y;notationItems.push({el,side,afterIndex:index,...p,y});});
   }
   notation.classList.toggle('rx-beside',!!d.vertical);
   const arrow=document.createElement('div');arrow.className='rx-equation-arrow';arrow.dataset.rxSymbol='arrow';arrow.setAttribute('role','img');arrow.setAttribute('aria-label','Reactants form products, left to right');arrow.innerHTML='<span aria-hidden="true">→</span><small>same atoms</small>';notation.append(arrow);notationItems.push({el:arrow,x:0,y:.65});
  }
  for(const item of notationItems)if(item.term){
   const {el,term,side}=item,pending=side==='products'&&!equationState.showProducts;
   el.classList.toggle('pending',pending);el.classList.toggle('reference',side==='reactants'&&equationState.progress>0);
   const text=pending?'<strong>?</strong><small>Predict</small>':captionText(term);
   if(el.innerHTML!==text)el.innerHTML=text;
  }
 }
 function update(next,selection=selected,options=equationState){
  const oldDiagram=state.diagram;
  state=next;selected=selection;
  equationState=options;updateNotation();
  if(oldDiagram?.width!==state.diagram?.width||oldDiagram?.height!==state.diagram?.height||oldDiagram?.vertical!==state.diagram?.vertical)fit();
  const alive=new Set(next.atoms.map(a=>a.id));
  for(const [id,a] of atoms)if(!alive.has(id)){scene.remove(a.mesh);a.label.remove();a.leader.remove();atoms.delete(id);}
  for(const a of next.atoms){
   if(!atoms.has(a.id)){const mesh=new T.Mesh(source.geometry,atomMaterial(a.el));mesh.userData.atomId=a.id;scene.add(mesh);
    const label=document.createElement('span'),leader=document.createElement('span');label.className='rx-atom-label';leader.className='rx-particle-leader rx-atom-leader';leader.setAttribute('aria-hidden','true');labels.append(leader,label);atoms.set(a.id,{mesh,label,leader});}
   const entry=atoms.get(a.id),r=atomRadius(a.el);entry.mesh.position.set(...a.p);entry.mesh.scale.setScalar(r*(selected.includes(a.id)?1.12:1));
   entry.label.textContent=a.el+' '+a.id;entry.label.dataset.rxAtomId=a.id;entry.label.classList.toggle('selected',selected.includes(a.id)||trackedId===a.id);
  }
  const liveParticles=new Set();
  for(const particle of (next.particles||[]).filter(p=>p.charge||p.spectator)){
   const key=particle.ids.slice().sort((a,b)=>a-b).join(':');liveParticles.add(key);
   if(!particleLabels.has(key)){const label=document.createElement('span'),leader=document.createElement('span');label.className='rx-particle-label';leader.className='rx-particle-leader';leader.setAttribute('aria-hidden','true');labels.append(leader,label);particleLabels.set(key,{label,leader});}
   const entry=particleLabels.get(key);entry.particle=particle;
   entry.label.textContent=particleText(particle)+(particle.spectator?' · spectator':'')+(particle.solidUnit?' · solid sample':'');
   entry.label.classList.toggle('spectator',!!particle.spectator);
  }
  for(const [key,entry] of particleLabels)if(!liveParticles.has(key)){entry.label.remove();entry.leader.remove();particleLabels.delete(key);}
  const aliveBonds=new Set();
  for(const b of next.bonds){
   const opacity=b.opacity??1;if(opacity<.002)continue;
   const key=[Math.min(b.a,b.b),Math.max(b.a,b.b),b.order].join(':');aliveBonds.add(key);
   if(!bonds.has(key)){const group=new T.Group(),mat=new T.MeshStandardMaterial({color:b.order===0?0x8d9e9b:0x8a999e,roughness:.4,metalness:.18,transparent:true});
    const number=b.order===0?7:b.order;
    for(let i=0;i<number;i++)group.add(new T.Mesh(cylinder,mat));scene.add(group);bonds.set(key,group);}
   const group=bonds.get(key),a=atoms.get(b.a)?.mesh.position,c=atoms.get(b.b)?.mesh.position;if(!a||!c)continue;
   const direction=new T.Vector3().subVectors(c,a),length=direction.length(),side=new T.Vector3().crossVectors(direction,new T.Vector3(0,0,1)).normalize();if(side.lengthSq()<.1)side.set(1,0,0);
   group.children.forEach((mesh,i)=>{mesh.material.opacity=opacity;mesh.material.color.set(opacity<.99?0x579a93:b.order===0?0x8d9e9b:0x8a999e);
    if(b.order===0){mesh.position.copy(a).addScaledVector(direction,(i+.5)/7);mesh.scale.set(.035,length/12,.035);}
    else{mesh.position.copy(a).add(c).multiplyScalar(.5).addScaledVector(side,(i-(b.order-1)/2)*.15);mesh.scale.set(.065,length,.065);}
    mesh.quaternion.setFromUnitVectors(up,direction.clone().normalize());
   });
  }
  for(const [key,group] of bonds)if(!aliveBonds.has(key)){scene.remove(group);group.children[0]?.material.dispose();bonds.delete(key);}
  dirty=true;
 }
 function draw(){
  if(!active||!dirty||!host.clientWidth)return;dirty=false;rig.align(camera);renderer.render(scene,camera);
  const w=host.clientWidth,h=host.clientHeight,hostRect=host.getBoundingClientRect();
  for(const item of notationItems){
   const p=new T.Vector3(item.x,item.y,0).project(camera);item.el.style.left=(p.x*.5+.5)*w+'px';item.el.style.top=(-p.y*.5+.5)*h+'px';
   if(item.term){const a=new T.Vector3(item.term.x-item.term.width/2,item.y,0).project(camera),b=new T.Vector3(item.term.x+item.term.width/2,item.y,0).project(camera);item.el.style.width=state.diagram?.vertical?'':Math.max(54,(b.x-a.x)*w/2)+'px';}
   else if(item.afterIndex===undefined&&state.diagram){const gap=state.diagram.arrowGap*camera.zoom*w/(camera.right-camera.left),k=Math.max(.5,Math.min(1,(gap-8)/82));item.el.style.setProperty('--rx-arrow-k',k.toFixed(3));}
  }
  // Labels avoid projected sphere silhouettes as well as notation and controls.
  // Camera magnification must never be compensated by text covering the model.
  const spheres=[],hard=[],badges=[],projected=new Map(),placed=[],leaders=[];
  for(const [id,entry] of atoms){const p=entry.mesh.position.clone().project(camera),r=entry.mesh.scale.x*camera.zoom*w/(camera.right-camera.left);
   const x=(p.x*.5+.5)*w,y=(-p.y*.5+.5)*h;projected.set(id,{x,y,r});
   spheres.push({x,y,r:r+2});
   entry.label.hidden=p.z>1||p.z< -1||(!showIds&&!selected.includes(id)&&hoveredId!==id&&trackedId!==id);entry.leader.hidden=true;
   entry.label.classList.toggle('selected',selected.includes(id)||trackedId===id);
   if(!entry.label.hidden){const s=entry.label.getBoundingClientRect();badges.push({label:entry.label,leader:entry.leader,x,y:y-r,cx:x,cy:y,r,width:s.width,height:s.height});}
  }
  for(const el of host.parentElement.querySelectorAll('.rx-view-tools,.rx-title,#rx-periodic-orb,.rx-stage-caption,.rx-side-headings,.rx-term-caption,.rx-equation-plus,.rx-equation-arrow')){
   if(el.hidden)continue;const r=el.getBoundingClientRect();
   hard.push({left:r.left-hostRect.left,top:r.top-hostRect.top,right:r.right-hostRect.left,bottom:r.bottom-hostRect.top});
  }
  for(const {label,leader,particle} of particleLabels.values()){
   const pts=particle.ids.map(id=>atoms.get(id)?.mesh.position.clone().project(camera)).filter(Boolean);
   label.hidden=!pts.length||pts.every(p=>p.z>1||p.z< -1);leader.hidden=true;if(label.hidden)continue;
   const x=pts.reduce((s,p)=>s+(p.x*.5+.5)*w/pts.length,0),y=Math.min(...particle.ids.map(id=>projected.get(id)).filter(Boolean).map(p=>p.y-p.r));
   const s=label.getBoundingClientRect();badges.push({label,leader,x,y,cx:x,cy:y,r:0,width:s.width,height:s.height});
  }
  // Each label takes the free spot with the shortest leader (label edge to sphere edge). Spots hugging the
  // sphere are tried first, then a fine grid row by row above and below the atom and across the whole model
  // width; on a tie the spot nearer straight above the atom wins. Other labels, the notation and other
  // labels' leaders are never covered, and a leader never crosses another label, while a free spot exists;
  // a sphere is covered only when no spot is free, and then the least covered spot wins. Labels whose
  // atoms sit farthest from the middle of their group (spheres within 90 px) go first: they have room just
  // outside the group, and the inner ones then reach out between them with shorter leaders.
  // Sizes come from getBoundingClientRect, so the boxes tested here are the boxes drawn.
  const cover=(box,list)=>{let sum=0;for(const r of list)sum+=Math.max(0,Math.min(box.right+4,r.right)-Math.max(box.left-4,r.left))*Math.max(0,Math.min(box.bottom+4,r.bottom)-Math.max(box.top-4,r.top));return sum;};
  const coverSpheres=box=>{let sum=0;for(const c of spheres){const p=c.r-Math.hypot(Math.max(0,box.left-4-c.x,c.x-box.right-4),Math.max(0,box.top-4-c.y,c.y-box.bottom-4));if(p>.5)sum+=p*p;}return sum;};
  const crosses=(x1,y1,x2,y2,b)=>{let t0=0,t1=1;const dx=x2-x1,dy=y2-y1;
   for(const [p,q] of [[-dx,x1-b.left-1],[dx,b.right-1-x1],[-dy,y1-b.top-1],[dy,b.bottom-1-y1]]){if(!p){if(q<0)return false;continue;}const t=q/p;if(p<0){if(t>t1)return false;if(t>t0)t0=t;}else{if(t<t0)return false;if(t<t1)t1=t;}}
   return t1-t0>1e-6;};
  for(const b of badges){let n=0,sx=0,sy=0;for(const c of spheres)if(Math.hypot(c.x-b.cx,c.y-b.cy)<=90){n++;sx+=c.x;sy+=c.y;}b.out=n?Math.hypot(b.cx-sx/n,b.cy-sy/n):0;}
  badges.sort((a,b)=>b.out-a.out||a.y-b.y||a.x-b.x);
  for(const b of badges){
   const ideal=b.y-8,stepY=(b.height+6)/2,stepX=(b.width+8)/3,minX=b.width/2+8,maxX=Math.max(minX,w-b.width/2-8),minB=b.height+8,maxB=Math.max(minB,h-8);
   const gapAt=(x,bottom)=>Math.max(0,Math.hypot(Math.max(0,Math.abs(x-b.cx)-b.width/2),Math.max(0,bottom-b.height-b.cy,b.cy-bottom))-b.r);
   const leaderOf=box=>{const px=Math.max(box.left,Math.min(box.right,b.cx)),py=Math.max(box.top,Math.min(box.bottom,b.cy)),d=Math.hypot(b.cx-px,b.cy-py),len=d-b.r;
    return len<5?{px,py,ex:px,ey:py,len:Math.max(0,len)}:{px,py,ex:b.cx+(px-b.cx)*b.r/d,ey:b.cy+(py-b.cy)*b.r/d,len};};
   let best=null;
   const free=()=>best&&!best.hard&&!best.soft;
   const test=(rawX,rawBottom)=>{
    const x=Math.max(minX,Math.min(maxX,rawX)),bottom=Math.max(minB,Math.min(maxB,rawBottom));
    const score=gapAt(x,bottom)+.15*Math.hypot(bottom-ideal,x-b.x);if(free()&&score>=best.score)return;
    const box={left:x-b.width/2,right:x+b.width/2,top:bottom-b.height,bottom};let hd=cover(box,hard);if(best&&hd>best.hard)return;
    const ld=leaderOf(box);let n=0;
    if(ld.len>=5)for(const o of placed)if(crosses(ld.px,ld.py,ld.ex,ld.ey,o))n++;
    for(const s of leaders)if(crosses(s.px,s.py,s.ex,s.ey,box))n++;
    hd+=n*b.width*b.height;if(best&&hd>best.hard)return;
    const sf=coverSpheres(box);if(best&&hd===best.hard&&(sf>best.soft||sf===best.soft&&score>=best.score))return;
    best={...box,x,score,hard:hd,soft:sf,ld};
   };
   const hw=b.width/2,g=b.r+6,q=g*Math.SQRT1_2;
   test(b.x,ideal);test(b.cx+g+hw,b.cy+b.height/2);test(b.cx-g-hw,b.cy+b.height/2);
   test(b.cx+q+hw,b.cy-q);test(b.cx-q-hw,b.cy-q);test(b.cx+q+hw,b.cy+q+b.height);test(b.cx-q-hw,b.cy+q+b.height);test(b.x,b.cy+g+b.height);
   // Rows outward from the ideal one. Going up the leader only grows; going down it shrinks until the
   // label passes the atom's middle, so a direction stops only when its rows can no longer win.
   const done={'-1':false,'1':false},seen=new Set();
   for(let row=0;row<=Math.ceil(h/stepY)&&!(done[-1]&&done[1]);row++){
    for(const sign of row?[-1,1]:[1]){
     if(done[sign])continue;
     const bottom=Math.max(minB,Math.min(maxB,ideal+sign*row*stepY));
     if(seen.has(bottom)){if(row)done[sign]=true;continue;}seen.add(bottom);
     if(free()&&gapAt(b.cx,bottom)>=best.score){if(sign<0||bottom-b.height>b.cy)done[sign]=true;continue;}
     for(const dir of [1,-1])for(let k=dir>0?0:1;;k++){
      const raw=b.x+dir*k*stepX,x=Math.max(minX,Math.min(maxX,raw));
      if(free()&&gapAt(x,bottom)>=best.score)break;
      test(x,bottom);if(dir>0?raw>=maxX:raw<=minX)break;
     }
    }
   }
   hard.push(best);placed.push(best);b.label.style.left=best.x+'px';b.label.style.top=best.bottom+'px';
   const {px,py,ex,ey,len}=best.ld;
   b.leader.hidden=len<5;if(len>=5)leaders.push(best.ld);
   b.leader.style.left=px+'px';b.leader.style.top=py+'px';b.leader.style.width=len+'px';b.leader.style.transform='rotate('+Math.atan2(ey-py,ex-px)+'rad)';
  }
 }
 function tick(){requestAnimationFrame(tick);draw();}resize();fit();tick();
 return {update,fit,zoom:f=>controls.zoom(f),setIds:on=>{showIds=on;if(!on)hoveredId=null;update(state);},trackAtom:id=>{trackedId=id;dirty=true;},setActive:on=>{active=on;controls.enabled=on;if(!on){drag=null;controls.cancel();}else{resize();dirty=true;}},getAtomIds:()=>[...atoms.keys()],getAtomIdentities:()=>[...atoms].map(([id,a])=>({id,uuid:a.mesh.uuid})),getProjectedAtoms:()=>[...atoms].map(([id,a])=>{const p=a.mesh.position.clone().project(camera);return {id,x:(p.x*.5+.5)*host.clientWidth,y:(-p.y*.5+.5)*host.clientHeight,r:a.mesh.scale.x*camera.zoom*host.clientWidth/(camera.right-camera.left),tracked:trackedId===id};})};
}


