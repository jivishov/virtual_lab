const inside=(x,y,r)=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;

// Shared carrying and drop validation. A hand can complete an electron
// transfer on contact while still closed; the next grasp requires a release.
export function createDragKit(viewer,actions){
 const host=document.getElementById('builder-stage'),tray=document.getElementById('return-tray');
 let gesture=null,suppressClick=false,scrollFrame=0;
 let tapButton=null;
 const ionic=()=>host.closest('main').dataset.chemistry==='ionic';
 const transfer=()=>host.closest('main').dataset.transfer==='true';
 function autoScroll(){
  scrollFrame=0;const g=gesture;if(!g?.lifted||g.keyboard)return;
  const margin=58,dy=g.overTray?0:g.y<margin?-Math.ceil((margin-g.y)/5):g.y>innerHeight-margin?Math.ceil((g.y-innerHeight+margin)/5):0;
  if(dy){const before=scrollY;window.scrollBy(0,dy);if(scrollY!==before)move(g.x,g.y);}
  scrollFrame=requestAnimationFrame(autoScroll);
 }
 function sourceFor(target){
  const element=target.closest('[data-element]');if(element)return element.disabled?null:{kind:'atom',element:element.dataset.element,order:actions.order()};
  const bond=target.closest('[data-order]');if(bond)return {kind:'bond',order:Number(bond.dataset.order),anchor:actions.selected()};
  if(target.closest('#pair-piece'))return {kind:'pair'};
  return null;
 }
 function lift(g){
  if(g.source.kind==='bond'&&g.source.anchor==null){actions.status('Select the starting atom, then drag a bond onto the second atom.',true);return false;}
  actions.prepare(g.source);viewer.beginHold(g.source);g.lifted=true;
  document.body.classList.add('holding-part');g.owner?.classList.add('part-lifted');tray.classList.add('accepting-part');
  if(!g.keyboard&&!g.hand&&!scrollFrame)scrollFrame=requestAnimationFrame(autoScroll);
  return true;
 }
 function move(x,y){
  const g=gesture;if(!g?.lifted)return;g.x=x;g.y=y;
  const overShelf=host.closest('main').classList.contains('hands-on') && inside(x,y,tray.parentElement.getBoundingClientRect());
  const overScene=!overShelf && inside(x,y,host.getBoundingClientRect())
   && (!g.hand||!transfer()||host.contains(document.elementFromPoint(x,y)));
  const overTray=inside(x,y,tray.getBoundingClientRect());
  const point=viewer.worldAt(x,y),snap=overScene&&!overTray?viewer.findSnap(x,y,g.touch,point):null;
  g.point=point;g.snap=snap;g.overScene=overScene;g.overTray=overTray;
  viewer.moveHold(x,y,point,snap,overScene&&!overTray);tray.classList.toggle('drop-ready',overTray);
  if(g.hand && snap?.type==='transfer'){
   clear();
   return actions.drop(g.source,snap,point)?'snapped':'returned';
  }
  let text;
  if(overTray)text=g.source.id!=null||g.source.owner!=null||g.source.edge?'Release to return this part to the tray.':'Release to put the unused part back.';
  else if(snap?.type==='transfer')text='Release to snap the atoms together and transfer electrons.';
  else if(overScene&&transfer())text='Bring a metal and a nonmetal together to transfer electrons.';
  else if(overScene&&ionic())text=g.source.id!=null?'Release to move this ion.':'Release in open space to add this ion.';
  else if(snap)text=snap.type==='replace-bond'?'Release to change this bond to the held bond order.':g.source.kind==='pair'?'Release to seat this lone pair.':'Release to snap the parts together.';
  else if(overScene)text=g.source.kind==='atom'?g.source.id!=null?'Move this atom freely. Release to keep its position, or use a lit site to snap.':'Drop in empty space to place a free atom. Move toward an open ring to make a bond.':g.source.kind==='bond'?'Bring the free end to an atom, or bring the bond onto an existing bond to change its order.':'Move the lone pair to a visible ring around an atom.';
  else text='Carry the part into the scene. Escape puts it back.';
  actions.status(text);
 }
 function clear(){
  const g=gesture;gesture=null;if(scrollFrame){cancelAnimationFrame(scrollFrame);scrollFrame=0;}if(!g)return null;
  if(g.owner&&g.pointer!=null&&g.owner.hasPointerCapture?.(g.pointer))g.owner.releasePointerCapture(g.pointer);
  if(g.lifted)viewer.endHold();g.owner?.classList.remove('part-lifted');document.body.classList.remove('holding-part');tray.classList.remove('accepting-part','drop-ready');return g;
 }
 function finish(cancel=false){
  const g=clear();if(!g)return;
  if(cancel){actions.status('Part returned. Your model is unchanged.');return;}
  if(!g.lifted){
   // Pointer release on a tray tile already pressed it (selectTray). Consume the ensuing native
   // click on that same button; keyboard activation still uses the button's click.
   if(g.pointer!=null&&g.owner!==host&&g.source.id==null&&g.source.owner==null&&!g.source.edge){
    tapButton=g.owner;setTimeout(()=>{if(tapButton===g.owner)tapButton=null;},0);
   }
   if(g.source.id!=null)actions.select(g.source.id,g.source);
   else if(g.source.owner!=null)actions.select(g.source.owner,g.source);
   else if(g.source.edge)actions.select(g.source.anchor,g.source);
   else actions.selectTray(g.source);
   return;
  }
  if(!g.hand){suppressClick=true;setTimeout(()=>suppressClick=false,300);}
  if(g.overTray){actions.returnPart(g.source);return;}
  if(g.overScene&&(g.snap||g.source.kind==='atom')){actions.drop(g.source,g.snap,g.point);return;}
  actions.status('No connection made. The part returned to its starting place.');
 }
 document.addEventListener('pointerdown',e=>{
  if(document.getElementById('builder-mode').hidden||gesture||e.button!==0||!e.isPrimary||e.altKey||e.shiftKey)return;
  // Rings over the model are buttons of their own (press, then press).
  if(e.target.closest?.('.ms-rings'))return;
  let source=sourceFor(e.target),owner=e.target.closest('[data-element],[data-order],#pair-piece');
  if(!source&&host.contains(e.target)){source=viewer.pick(e.clientX,e.clientY);owner=host;if(source?.kind==='atom')source.order=actions.order();}
  if(!source)return;
  e.preventDefault();e.stopImmediatePropagation();owner.setPointerCapture(e.pointerId);
  gesture={source,owner,pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,touch:e.pointerType==='touch',lifted:false};
 },true);
 document.addEventListener('pointermove',e=>{
  const g=gesture;if(!g||g.pointer!==e.pointerId)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(!g.lifted&&Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>5){if(!lift(g)){finish(true);return;}}
  move(e.clientX,e.clientY);
 },true);
 document.addEventListener('pointerup',e=>{if(gesture?.pointer===e.pointerId){e.preventDefault();e.stopImmediatePropagation();if(gesture.lifted)move(e.clientX,e.clientY);finish();}},true);
 document.addEventListener('pointercancel',e=>{if(gesture?.pointer===e.pointerId)finish(true);},true);
 document.addEventListener('lostpointercapture',e=>{if(gesture?.pointer===e.pointerId)finish(true);},true);
 document.addEventListener('click',e=>{if(suppressClick||(tapButton&&e.detail>0&&tapButton.contains(e.target))){suppressClick=false;tapButton=null;e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('keydown',e=>{
  if(document.getElementById('builder-mode').hidden)return;
  if(gesture){
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(true);return;}
   if(e.key==='Tab'){finish(true);return;}
   if(gesture.keyboard){
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
    if(delta){e.preventDefault();e.stopImmediatePropagation();const step=e.shiftKey?3:14;move(gesture.x+delta[0]*step,gesture.y+delta[1]*step);}
    if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopImmediatePropagation();finish();}
   }return;
  }
  if(e.key!==' '||e.ctrlKey||e.metaKey)return;
  let source=sourceFor(e.target);const atomButton=e.target.closest('[data-atom]');
  if(atomButton){const a=actions.atom(Number(atomButton.dataset.atom));source={kind:'atom',id:a.id,element:a.element,order:actions.order()};}
  if(!source)return;
  e.preventDefault();e.stopImmediatePropagation();host.scrollIntoView({block:'center'});host.focus({preventScroll:true});
  const r=host.getBoundingClientRect(),point=source.id?viewer.projectPoint(actions.atom(source.id).position):{x:r.left+r.width/2,y:r.top+r.height/2};
  gesture={source,owner:e.target.closest('button'),keyboard:true,lifted:false,x:point.x,y:point.y};
  if(!lift(gesture)){finish(true);return;}move(point.x,point.y);actions.status('Part held. Arrow keys move it; Shift makes fine moves. Enter drops it. Escape returns it.');
 },true);
 window.addEventListener('blur',()=>{if(gesture)finish(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden&&gesture)finish(true);});
 document.addEventListener('b06-mode',()=>{if(gesture)finish(true);});
 // Hand, mouse and keyboard releases all use finish() and the same graph checks.
 // A hand that closes and opens on open bench space while an atom tile is armed, without turning
 // the model, presses the bench there (the second press of press, then press). A second hand
 // (two-hand zoom) cancels it, and so does a lost hand: only a deliberate open hand, which
 // hand-controls.js reports as endTurn(true), places the atom.
 let spacePress=null;
 host.handKit={
  targetAt(target,x,y){
   if(target.closest('#builder-tray'))return target.closest('[data-element]:not(:disabled),[data-order],#pair-piece');
   if(!host.contains(target))return null;
   const part=viewer.pick(x,y);
   if(!part)return 'turn';
   if(part.kind==='bond')return 'bond:'+part.edge.a+','+part.edge.b;
   if(part.kind==='pair')return 'pair:'+part.owner+','+part.index;
   return 'atom:'+part.id;
  },
  begin(target,x,y){
   if(gesture||document.getElementById('builder-mode').hidden)return null;
   let source=target.closest('#builder-tray')?sourceFor(target):null;
   if(!source&&host.contains(target)){
    source=viewer.pick(x,y);
    if(!source){spacePress=!spacePress&&actions.armedAtom?.()?{x,y,moved:0}:null;return 'turn';}
    if(source.kind==='atom')source.order=actions.order();
   }
   if(!source)return null;
   spacePress=null;
   gesture={source,hand:true,touch:true,owner:target.closest('button'),lifted:false,startX:x,startY:y,x,y};
   return 'part';
  },
  move(x,y){
   const g=gesture;if(!g?.hand)return;
   if(!g.lifted&&Math.hypot(x-g.startX,y-g.startY)>9){if(!lift(g)){finish(true);return;}}
   return move(x,y);
  },
  release(x,y){if(gesture?.hand){if(gesture.lifted)move(x,y);finish();}},
  cancel(){if(gesture)finish(true);},
  canTurn:(target,x,y)=>host.contains(target)&&!viewer.pick(x,y),
  turn(dx,dy){if(spacePress)spacePress.moved+=Math.hypot(dx,dy);viewer.controls.rotate(dx*.005,dy*.005);},
  pan:(dx,dy)=>viewer.controls.pan(dx,dy),
  zoom(factor){
   spacePress=null;
   if(gesture || !viewer.controls.enabled)return false;
   viewer.zoom(factor);return viewer.controls.camera.zoom;
  },
  endTurn(opened=false){
   const press=spacePress;spacePress=null;
   viewer.controls.dispatchEvent({type:'end'});
   if(opened&&press&&press.moved<10&&actions.armedAtom?.())actions.pressSpace?.(press.x,press.y);
  }
 };
 return {cancel:()=>{if(gesture)finish(true);},active:()=>!!gesture};
}
