import {addMoveGrip,panelBounds,panelGap} from './floating-control.js';
import {freeControlsCamera} from '../workspace-camera.js?v=20261115-mode-scope';

// Molecular studio inside the shared lab shell. Two products share one page:
// the VSEPR lab (a physical model kit for Lewis structures and VSEPR) and the
// molecule builder (a compact molecule-CAD tool). Live controls are moved, never cloned.
const main=document.querySelector('main');
const $=id=>document.getElementById(id);
const mode=()=>main.dataset.mode==='reaction'?'reaction':main.dataset.mode==='builder'?'builder':'guided';

// Shared camera bar: wrap each kit camera once, then publish the one for the visible mode.
const cameras=new Map();
function bridge(controls){
 if(controls?.element?.id==='reaction-stage')return;
 if(!controls?.element||[...cameras.values()].some(c=>c.controls===controls))return;
 const which=controls.element.id==='builder-stage'?'builder':'guided';
 const api=freeControlsCamera({element:controls.element,controls,home:()=>$(which==='builder'?'builder-fit':'fit')?.click()});
 cameras.set(which,{controls,api});publishCamera();
}
function publishCamera(){
 const entry=cameras.get(mode());
 const next=entry?.api||null;
 if((main.labCamera||null)===next)return;
 const previous=[...cameras.values()].find(camera=>camera.api===main.labCamera);
 previous?.api.cancel?.();previous?.controls.cancel?.();
 main.labCamera=next;document.dispatchEvent(new Event('lab-camera-ready'));
}
document.addEventListener('free-controls',e=>bridge(e.detail));

function installModeScopes(){
 const selectors={
  guided:'#visual,.inspector,#lab-panel-tools,.bench-bar,.camera-bar,.instrument-line,#notebook,.notes,#save-status,#loading',
  builder:'#builder-stage,#builder-tray,#builder-ribbon,.builder-panel,.examples,.builder-scene-header,.insight-strip,.file-tools,#builder-save-status,.builder-foot'
 };
 const scopes=[];
 for(const [owner,selector] of Object.entries(selectors)){
  for(const content of main.querySelectorAll(selector)){
   if(content.closest('[data-b06-mode]'))continue;
   // The workspace moves these live nodes out of their original mode panels.
   // A separate guard preserves application-owned hidden/loading state on each node.
   const scope=document.createElement('div');scope.className='b06-mode-scope';scope.dataset.b06Mode=owner;
   content.before(scope);scope.append(content);scopes.push(scope);
  }
 }
 const palette=main.querySelector(':scope > .model-views');
 if(palette){palette.dataset.b06Mode='builder';scopes.push(palette);}
 const guidedTools=main.querySelector('#lab-dock [aria-controls="lab-panel-tools"]');
 if(guidedTools)guidedTools.dataset.b06Mode='guided';
 function sync(){
  const now=mode(),focused=document.activeElement?.closest('[data-b06-mode]');
  const staleFocus=!!focused&&focused.dataset.b06Mode!==now;
  if(staleFocus)document.activeElement.blur();
  for(const scope of scopes){
   const inactive=scope.dataset.b06Mode!==now;
   if(scope.hidden!==inactive)scope.hidden=inactive;
   if(scope.inert!==inactive)scope.inert=inactive;
  }
  return staleFocus;
 }
 // A queued gesture or synthetic click can outlive a mode change. Check ownership
 // at dispatch time as well as keeping the inactive interface hidden and inert.
 for(const type of ['click','dblclick','pointerdown','keydown','input','change'])main.addEventListener(type,event=>{
  const owner=event.target.closest?.('[data-b06-mode]');
  if(owner&&owner.dataset.b06Mode!==mode()){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 return sync;
}

function installModelPalette(){
 const surface=main.querySelector('.lab-surface'),stage=$('builder-stage');
 const palette=main.querySelector('#builder-ribbon .model-views');
 for(const button of palette.querySelectorAll('[data-style]'))button.title=button.textContent.trim();
 main.append(palette);
 function bounds(){
  if(mode()!=='builder'||!stage.clientWidth)return null;
  const scene=stage.getBoundingClientRect(),available=Math.max(0,scene.width-2*panelGap);
  palette.classList.toggle('compact-palette',available<206);
  palette.style.maxWidth=available+'px';
  return panelBounds(scene,palette);
 }
 function corner(b){
  // Find the closest space to the upper right that clears the visible camera controls and panels.
  const occupied=[...main.querySelectorAll('.lab-camera,.immerse-hud,.room-bar,.lab-panel:not([hidden])')]
   .map(el=>el.getBoundingClientRect()).filter(r=>r.width&&r.height).sort((a,c)=>a.top-c.top);
  let best={x:b.right,y:b.top},cost=Infinity;
  for(const x of [b.right,...occupied.map(r=>r.left-b.width-panelGap)]){
   if(x<b.left||x>b.right)continue;
   let y=b.top;
   for(const r of occupied){
    if(x<r.right+panelGap && x+b.width>r.left-panelGap && y<r.bottom+panelGap && y+b.height>r.top-panelGap)y=r.bottom+panelGap;
   }
   const distance=b.right-x+y-b.top;
   if(y<=b.bottom && distance<cost){best={x,y};cost=distance;}
  }
  return best;
 }
 const {layout}=addMoveGrip(palette,{
  className:'model-style-grip',label:'Move model styles',homeName:'the corner',bounds,home:corner
 });
 const observer=new ResizeObserver(layout);
 for(const el of [stage,surface,...main.querySelectorAll('.lab-camera,.immerse-hud,.lab-panel')])observer.observe(el);
 new MutationObserver(layout).observe(surface,{childList:true});
 document.addEventListener('fullscreenchange',layout);
 return layout;
}

function installHandToolbars(hud){
 const surface=main.querySelector('.lab-surface'),camera=main.querySelector('.lab-camera');
 const tray=$('builder-tray'),status=main.querySelector('.hand-bar'),ticket=surface.querySelector('.lab-ticket');
 const bars=[hud,camera];
 // Reserve five percent of the tracked image on each side. Dragging and Home
 // use the same bounds, so the grip stays reachable after repositioning.
 function bounds(bar){
  if(!main.classList.contains('hands-on'))return null;
  const scene=surface.getBoundingClientRect(),b=panelBounds(scene,bar);
  const inset=Math.min(scene.width*.05,Math.max(0,(scene.width-b.width)/2));
  return {...b,left:scene.left+inset,right:scene.right-inset-b.width};
 }
 let homeY=0;
 const grips=bars.map((bar,index)=>{
  bar.classList.add('hand-toolbar');
  return addMoveGrip(bar,{className:'hand-toolbar-grip',
   label:index===0?'Move model controls':'Move camera controls',homeName:index===0?'the left side':'the right side',
   bounds:()=>bounds(bar),home:b=>({x:index===0?b.left:b.right,y:homeY})});
 });
 function dock(){
  const scene=surface.getBoundingClientRect(),parts=tray.getBoundingClientRect();
  let top=scene.top+panelGap,bottom=scene.bottom-panelGap;
  for(const el of [ticket,status,$('builder-ribbon')]){
   const r=el?.getBoundingClientRect();
   if(!r?.height)continue;
   if(r.top>scene.top+scene.height/2)bottom=Math.min(bottom,r.top-panelGap);
   else top=Math.max(top,r.bottom+panelGap);
  }
  if(parts.width){
   tray.style.setProperty('--hand-tray-bottom',(scene.bottom-bottom)+'px');
   bottom-=parts.height+panelGap;
  }
  const height=Math.max(0,Math.min(388,bottom-top));
  main.style.setProperty('--hand-toolbar-height',height+'px');
  homeY=Math.min(bottom-height,Math.max(top,scene.top+(scene.height-height)/2));
 }
 let floating=false,toolbarMode=mode();
 function layout(){
  const now=mode();
  if(now!==toolbarMode){
   for(const grip of grips)grip.clear();
   toolbarMode=now;
  }
  if(!main.classList.contains('hands-on')){
   if(floating){
    for(const grip of grips)grip.clear();
    for(const bar of bars)bar.removeAttribute('aria-orientation');
    main.style.removeProperty('--hand-toolbar-height');
    tray.style.removeProperty('--hand-tray-bottom');
   }
   floating=false;return;
  }
  if(!floating)for(const bar of bars)bar.setAttribute('aria-orientation','vertical');
  floating=true;
  dock();
  for(const grip of grips)grip.layout();
 }
 new MutationObserver(layout).observe(main,{attributes:true,attributeFilter:['class','data-mode']});
 const observer=new ResizeObserver(layout);
 for(const el of [surface,...bars,tray,status,ticket])if(el)observer.observe(el);
 document.addEventListener('fullscreenchange',layout);
 layout();
 return layout;
}

function setup(){
 const top=main.querySelector('.lab-top');if(!top||main.dataset.b06Shell)return;
 main.dataset.b06Shell='true';
 const step=top.querySelector('.lab-step'),focus=[...top.querySelectorAll('button')].find(b=>b.textContent==='Focus');
 const back=top.querySelector('a');

 // Top bar: product switch beside the title, scene experiences beside Focus.
 const switcher=main.querySelector('.mode-switch');
 if(switcher){switcher.classList.add('lab-mode-switch');step.before(switcher);}
 for(const id of ['hand-building','camera-backdrop','immersive']){const b=$(id);if(b){b.classList.add('lab-experience');focus.before(b);}}
 const syncBack=()=>{back.href='../../../index.html';back.textContent='‹ Home';};

 // Short notices (camera, full screen) become a toast instead of a header row.
 const caption=$('mode-caption');
 if(caption){caption.classList.add('lab-toast');main.append(caption);let timer=0;
  new MutationObserver(()=>{clearTimeout(timer);if(caption.textContent.trim())timer=setTimeout(()=>{caption.textContent='';},7000);}).observe(caption,{childList:true,characterData:true,subtree:true});}

 // Model kit naming for the VSEPR lab tray.
 const trayTitle=document.querySelector('#tray h3');if(trayTitle)trayTitle.textContent='Model kit';

 // Immerse: a presentation view with a small floating control strip.
 const hud=document.createElement('div');hud.className='immerse-hud';hud.setAttribute('role','toolbar');hud.setAttribute('aria-label','Immerse controls');
 const proxies=[
  ['exit','Exit','Leave Immerse (Esc)',()=>$('immersive'),null],
  ['hands','Hand building','Set up camera hand controls',()=>$('hand-building'),null],
  ['room','In your room','Show the model over your camera view',()=>$('camera-backdrop'),null],
  ['atoms','Atoms only','Show only the atoms and bonds',()=>$('atoms'),'guided'],
  ['roll','Roll','Roll the model about the line of sight',()=>$('roll'),'guided'],
  ['pairs','Lone pairs','Show lone pairs',()=>$('show-pairs'),'builder'],
  ['labels','Labels','Show atom labels',()=>$('show-labels'),'builder'],
  ['spin','Spin','Turn the model slowly',()=>$('spin'),'builder'],
  ['full','Full screen','Fill the screen',null,null]];
 const fullButton=top.querySelector('button[aria-label="Full screen"]');
 async function toggleFullScreen(event){
  const control=event.currentTarget;
  try{
   if(document.fullscreenElement)await document.exitFullscreen();else await main.requestFullscreen();
  }catch{
   if(!event.isTrusted && typeof main.requestFullscreen==='function'){
    control.focus({preventScroll:true});
    if(caption)caption.textContent='To enter browser full screen, press Enter or click the Full screen icon.';
   }else if(caption)caption.textContent='Full screen is unavailable here.';
  }
 }
 fullButton.onclick=toggleFullScreen;
 const iconKeys=new Set(['hands','room','pairs','labels','spin','full']);
 for(const [key,label,title,source,only] of proxies){
  const b=document.createElement('button');b.type='button';b.dataset.hud=key;b.textContent=label;b.title=title;
  if(only){b.dataset.only=only;b.dataset.b06Mode=only;}
  b.onclick=key==='full'?toggleFullScreen:()=>{
   const src=source?.();
   if(b.hidden||b.disabled||(only&&only!==mode())||!src||src.disabled||src.closest('[inert]'))return;
   src.click();syncHud();
  };
  if(iconKeys.has(key)){
   const original=key==='full'?fullButton:source();
   const glyph=(key==='full'?$('fullscreen'):original).querySelector('svg');
   for(const control of [original,b]){
    control.replaceChildren(glyph.cloneNode(true));control.classList.add('model-tool-icon');
    control.setAttribute('aria-label',label);control.title=label;
   }
  }
  if(key==='hands')b.setAttribute('aria-haspopup','dialog');
  hud.append(b);
 }
 main.append(hud);
 // Write only changed values: the strip watches the same attributes it mirrors.
 const set=(el,name,value)=>{if(el.getAttribute(name)!==value)el.setAttribute(name,value);};
 const flag=(el,name,on)=>{if(el.hasAttribute(name)!==on)el.toggleAttribute(name,on);};
 let queued=0;
 function syncHud(){
  queued=0;const now=mode();
  set(hud,'aria-label',now==='builder'?'Molecule builder controls':'VSEPR model kit controls');
  set(hud,'data-active-mode',now);
  const camera=main.querySelector('.lab-camera');
  set(camera,'aria-label',now==='builder'?'Molecule builder camera controls':'VSEPR model kit camera controls');
  set(camera,'data-active-mode',now);
  for(const b of hud.querySelectorAll('[data-hud]')){
   const exitOutsideImmerse=b.dataset.hud==='exit'&&!main.classList.contains('immersive');
   const inactive=exitOutsideImmerse||!!b.dataset.only&&b.dataset.only!==now;
   flag(b,'hidden',inactive);flag(b,'inert',inactive);
   const p=proxies.find(x=>x[0]===b.dataset.hud),src=p[3]?.();
   flag(b,'disabled',inactive||!!p[3]&&(!src||src.disabled||!!src.closest('[inert]')));
   if(b.dataset.hud==='exit'||!p[3])continue;
   if(src?.type==='checkbox')set(b,'aria-pressed',String(src.checked));
   else if(src?.hasAttribute('aria-pressed'))set(b,'aria-pressed',src.getAttribute('aria-pressed'));
  }
  for(const control of [fullButton,hud.querySelector('[data-hud=full]')])set(control,'aria-pressed',String(!!document.fullscreenElement));
 }
 const queueHud=()=>{if(!queued)queued=requestAnimationFrame(syncHud);};
 new MutationObserver(queueHud).observe(main,{subtree:true,attributes:true,attributeFilter:['aria-pressed','disabled','inert','data-mode']});
 document.addEventListener('change',queueHud);document.addEventListener('fullscreenchange',queueHud);

 // Entering Immerse moves keyboard focus to the strip so Esc and Tab stay predictable.
 let immersed=false;
 const syncImmerse=()=>{const on=main.classList.contains('immersive');if(on===immersed)return;immersed=on;
  if(on)hud.querySelector('[data-hud=exit]').focus({preventScroll:true});else $('immersive')?.focus({preventScroll:true});};

 const layoutToolbars=installHandToolbars(hud);
 const layoutPalette=installModelPalette();
 const syncScopes=installModeScopes();
 const sync=()=>{
  const staleFocus=syncScopes();
  syncBack();publishCamera();syncHud();syncImmerse();layoutPalette();layoutToolbars();
  if(staleFocus){
   const focus=main.classList.contains('immersive')?hud.querySelector('button:not([hidden]):not(:disabled)'):$('tab-'+mode());
   focus?.focus({preventScroll:true});
  }
 };
 document.addEventListener('b06-mode',sync);
 sync();
}
for(const c of window.__freeControls||[])bridge(c);
if(main.dataset.workspaceReady)setup();else document.addEventListener('lab-workspace-ready',setup,{once:true});

