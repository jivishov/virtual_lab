import {choiceStrips} from './choices.js?v=20261110-p3';
// Shared scene workspace. Move live controls: never clone stateful inputs or handlers.
const profiles = {
 b01:{ref:1,scene:'#viewport',procedure:['.procedure'],tools:['#trials','.instrument-head'],readings:['.caption'],notes:['#notebook'],about:['#model-notes'],title:'#stage-title',hint:'#status',ticket:[['','#station'],['','#caption']]},
 b02:{ref:1,scene:'#benchView',procedure:['.wizard'],tools:['.workflow','.instrument-head','#fresh'],readings:['.meters','.scope'],notes:['#book'],about:['.model','#storage'],title:'#stageName',hint:'#status'},
 b03:{scene:'#stage',procedure:['.guide'],tools:['.tools','.bench-head','#reset'],readings:['.instruments','.paths','#flows','.placement-status'],notes:['#notebook'],about:['details.sheet','footer'],title:'#step-title',hint:'#gesture'},
 b04:{ref:1,scene:'#view',procedure:['.procedure'],tools:['.panel-header','#reset'],readings:['.instrument','#instruments'],notes:['.notebook'],about:['.model'],title:'#step-title',hint:'#feedback'},
 b06:{ref:1,defaultMode:'guided',scene:['#visual','#builder-stage'],overlays:['#builder-tray','#builder-ribbon'],procedure:['.inspector','.builder-panel','.examples'],tools:['.bench-bar','.camera-bar'],readings:['.instrument-line','.builder-scene-header','.insight-strip'],notes:['#notebook','.file-tools','#builder-save-status'],about:['.notes','#save-status','.builder-foot'],title:'.inspector [data-step]:not([hidden]) h2',hint:'#live-guide',loading:'#loading',modes:{builder:{title:'#assignment-title',hint:'#builder-status',labels:{procedure:'Inspector',tools:null,readings:'Analysis',notes:'File'}}},ticket:[['Your model','#counts','','guided'],['','#molecule-formula','','builder'],['','#model-count','','builder'],['VSEPR','#local-shape','','builder'],['Domains','#domain-count','','builder'],['Ideal','#ideal-angles','','builder'],['Arrangement','#spacing-status','','builder']]},
 b07:{ref:1,scene:'#stage',procedure:['.setup'],tools:['.bench-head','#reset'],readings:['.readouts','.cue'],notes:['#book'],about:['.limits'],title:'#step-title',hint:'#cue',ticket:[['Balance','#scale-chip-value'],['','#scene-caption']]},
 b08:{scene:'.frame',procedure:['.operation'],tools:['.parts','.cases','.camera','#reset'],readings:['.stage-heading','.readout','#instruments'],notes:['#records'],about:['.limits','#storage-status'],title:'#operation-title',hint:'#status'},
 b09:{ref:1,scene:'#scene',procedure:['.cue','.operation'],tools:['.bench-head','#reset'],readings:['.instruments','.keyboard-help'],notes:['#journal'],about:['.limits','footer','#storageNotice'],title:'#stepTitle',hint:'#feedback',ticket:[['Gas','#wetVolume'],['Bath','#bathReading',' °C'],['Barometer','#barometerReading',' mmHg']]},
 b10:{scene:'#stage',procedure:['.operation'],tools:['.parts','#view-tools','#reset'],readings:['.instrument-strip','.key','#gauge'],notes:['#notebook'],about:['footer'],title:'#op-title',hint:'#notice'},
 b11:{scene:'#stage',procedure:['.operation'],tools:['#tools'],readings:['.bar','.readouts'],notes:['#notebook'],about:['#limits'],title:'#op-title',hint:'#notice'},
 b12:{scene:'#instrument',extra:'#plot-panel',procedure:['.procedure'],tools:['.instrument-head','#reset'],readings:['.readouts','.equation','#atom-key','#rack-key','#frame-panel'],notes:['#history'],about:['#limits','footer','#save-note'],title:'#step-title',hint:'#hint'},
 b13:{scene:'#stage',procedure:['.wizard'],tools:['.bench-head','#reset'],readings:['.volumes','.instruments'],notes:['#notebook'],about:['.limits'],title:'#step-title',hint:'#notice'},
 b14:{ref:1,scene:'#viewport',procedure:['#controls'],tools:['.stage-head','.trial-tools'],readings:['.instruments','.secondary-drawer'],notes:['#notebook'],about:['#model-info','footer'],title:'#action-title',hint:'#gesture',ticket:[['Jacket','#flow'],['Mantle','#thermal'],['Head vapor','#temperature'],['Receiver','#quantity']]},
 b15:{scene:'#viewport',procedure:['.controls'],tools:['.instrument-head'],readings:['.meters','.target-strip'],notes:['.notebook'],about:['.reference'],title:'#action-heading',hint:'#target'}
};
const $=s=>document.querySelector(s);
const icon={procedure:'☷',tools:'⌘',readings:'◴',notes:'▤',about:'?'};
function setup(){
 // A version folder (b06-v2) uses its activity's profile.
 const id=location.pathname.match(/\/(b\d{2})(?:-v\d+)?\//)?.[1],p=profiles[id];
 if(!p||$('#lab-dock'))return;
 const main=$('main'),scenes=[].concat(p.scene).map(s=>$(s)).filter(Boolean),scene=scenes[0],heading=$('h1');
 if(!main||!scene)return;
 function preserveInert(el){const guard=el.parentElement?.closest('[inert]');if(!guard)return;el.inert=guard.inert;new MutationObserver(()=>el.inert=guard.inert).observe(guard,{attributes:true,attributeFilter:['inert']});}
 const old=[...main.children],back=$('nav[aria-label="Activity navigation"] a');
 document.body.classList.add('lab-mode');main.classList.add('lab-workspace');main.dataset.lab=id;if(p.ref)main.classList.add('lab-ref');
 const surface=document.createElement('div');surface.className='lab-surface';
 for(const s of scenes){preserveInert(s);s.classList.add('lab-scene');surface.append(s);}
 for(const sel of p.overlays||[]){const o=$(sel);if(o){preserveInert(o);surface.append(o);}}
 const extra=p.extra && $(p.extra);
 if(extra){extra.classList.add('lab-scene','lab-plot');surface.append(extra);}
 if(p.loading){const load=$(p.loading);if(load)surface.append(load);}
 main.append(surface);
 let ticket=null;
 if(p.ticket){ticket=document.createElement('div');ticket.className='lab-ticket';ticket.setAttribute('aria-hidden','true');
  for(const [label] of p.ticket){const item=document.createElement('span');if(label){const b=document.createElement('small');b.textContent=label;item.append(b);}item.append(document.createElement('strong'));ticket.append(item);}
  surface.append(ticket);}
 const top=document.createElement('div');top.className='lab-top';
 const link=document.createElement('a');link.href=back?.getAttribute('href')||'../../../index.html';link.textContent='‹ Activity guide';top.append(link);
 if(heading)top.append(heading);
 const title=document.createElement('span');title.className='lab-step';top.append(title);
 const focus=document.createElement('button');focus.type='button';focus.textContent='Focus';focus.title='Hide or restore panels (F)';focus.setAttribute('aria-pressed','false');top.append(focus);
 const fullscreen=document.createElement('button');fullscreen.type='button';fullscreen.textContent='⛶';fullscreen.title='Full screen';fullscreen.setAttribute('aria-label','Full screen');top.append(fullscreen);main.append(top);
 const dock=document.createElement('div');dock.id='lab-dock';dock.setAttribute('role','toolbar');dock.setAttribute('aria-label','Workspace panels');main.append(dock);
 const panels=new Map();let z=10;
 function move(selectors,to){for(const selector of selectors||[])for(const el of [...document.querySelectorAll(selector)])if(!el.closest('.lab-panel')&&!to.contains(el)){preserveInert(el);to.append(el);}}
 function panel(key,label,selectors){
  const box=document.createElement('div');box.className='lab-panel lab-'+key;box.id='lab-panel-'+key;box.hidden=key!=='procedure';box.setAttribute('role','region');box.setAttribute('aria-label',label);
  const head=document.createElement('div');head.className='lab-panel-head';
  const handle=document.createElement('span');handle.textContent=label;handle.title='Drag to move this panel';
  const close=document.createElement('button');close.type='button';close.textContent='−';close.setAttribute('aria-label','Collapse '+label);
  const content=document.createElement('div');content.className='lab-panel-body';head.append(handle,close);box.append(head,content);
  move(selectors,content);main.append(box);
  const button=document.createElement('button');button.type='button';button.innerHTML='<span aria-hidden="true">'+icon[key]+'</span><span class="lab-dock-label">'+label+'</span>';button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-controls',box.id);button.setAttribute('aria-expanded',String(!box.hidden));dock.append(button);
  function show(open){box.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open){box.style.zIndex=++z;focus.setAttribute('aria-pressed','false');clampPanel(box);} }
  button.onclick=()=>show(box.hidden);close.onclick=()=>{show(false);button.focus({preventScroll:true});};
  let drag=null;
  head.addEventListener('pointerdown',e=>{if(e.button||e.target.closest('button'))return;const b=box.getBoundingClientRect(),m=main.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:b.left-m.left,top:b.top-m.top};head.setPointerCapture(e.pointerId);box.style.zIndex=++z;e.preventDefault();});
  head.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;box.style.right='auto';box.style.bottom='auto';box.style.left=drag.left+e.clientX-drag.x+'px';box.style.top=drag.top+e.clientY-drag.y+'px';clampPanel(box);});
  const stop=()=>drag=null;head.addEventListener('pointerup',stop);head.addEventListener('pointercancel',stop);head.addEventListener('lostpointercapture',stop);
  box.addEventListener('focusin',()=>box.style.zIndex=++z);
  new ResizeObserver(()=>clampPanel(box)).observe(box);panels.set(key,{box,button,show,content,label,handle,close});return content;
 }
 panel('procedure','Procedure',p.procedure);panel('tools','Tools',p.tools);panel('readings','Readings',p.readings);panel('notes','Notebook',p.notes);const about=panel('about','Help',p.about);
 const help=document.createElement('div');help.className='lab-help';help.innerHTML='<p><b>Grab · move · release.</b> Drag a part toward its seat. A highlighted target previews a snap; release to place it. Each action keeps the experiment’s checks.</p><p>Use Tools for inspection views and keyboard alternatives. Open panels from the bottom bar, drag their headers to reposition, or use Focus to clear the bench. Escape cancels a held part.</p><p id="lab-camera-help">Use the activity’s inspection views in Tools.</p>';
 about.prepend(help);
 const resetPanels=document.createElement('button');resetPanels.textContent='Reset panel positions';resetPanels.setAttribute('data-lab-chrome','');resetPanels.onclick=()=>{for(const {box} of panels.values()){box.style.removeProperty('left');box.style.removeProperty('right');box.style.removeProperty('top');box.style.removeProperty('bottom');box.style.removeProperty('width');box.style.removeProperty('height');}};about.prepend(resetPanels);
 // Keep original layout anchors alive for application bindings; none consumes scene space.
 const stash=document.createElement('div');stash.hidden=true;stash.className='lab-original';for(const el of old)if(el.parentElement===main)stash.append(el);main.append(stash);
 // The original h1 was moved to the top bar; old branding outside main is redundant.
 for(const el of [...document.body.children])if(el!==main&&el.tagName==='HEADER')el.hidden=true;
 const bottom=document.createElement('div');bottom.className='lab-status';bottom.setAttribute('aria-live','polite');bottom.setAttribute('role','status');main.append(bottom);
 const camera=document.createElement('div');camera.className='lab-camera';camera.setAttribute('role','toolbar');camera.setAttribute('aria-label','Scene navigation');camera.setAttribute('data-lab-chrome','');
 const cameraButtons=[['move','↖','Move','Drag individual parts'],['orbit','↻','Rotate','Drag anywhere to rotate; right drag also rotates'],['pan','✥','Pan','Drag anywhere to pan; Shift + right drag or middle drag also pans'],['home','⌖','Fit','Restore the inspection view without changing your work'],['out','−','','Zoom out'],['in','+','','Zoom in']];
 const cameraIcons={move:'M4 3l13 8-6 1-3 6z',orbit:'M18 8a7 7 0 1 0 1 6M18 3v5h-5',pan:'M10 2v16M2 10h16M7 5l3-3 3 3M7 15l3 3 3-3M5 7l-3 3 3 3M15 7l3 3-3 3',home:'M7 3H3v4M13 3h4v4M3 13v4h4M17 13v4h-4M7 10h6M10 7v6'};
 for(const [action,glyph,label,help] of cameraButtons){const b=document.createElement('button');b.type='button';b.dataset.camera=action;b.disabled=true;b.title=help;b.setAttribute('aria-label',label||help);const mark=cameraIcons[action]?'<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="'+cameraIcons[action]+'"/></svg>':glyph;b.innerHTML='<span aria-hidden="true">'+mark+'</span>'+(label?'<span>'+label+'</span>':'');if(['move','orbit','pan'].includes(action))b.setAttribute('aria-pressed',String(action==='move'));camera.append(b);}main.append(camera);
 const cameraReady=()=>{const api=main.labCamera;for(const b of camera.querySelectorAll('button')){b.disabled=!api;if(b.hasAttribute('aria-pressed'))b.setAttribute('aria-pressed',String(b.dataset.camera===api?.mode));}if(api)$('#lab-camera-help').textContent=api.help;};document.addEventListener('lab-camera-ready',cameraReady);cameraReady();
 camera.onclick=e=>{const action=e.target.closest('[data-camera]')?.dataset.camera;if(action)main.labCamera?.command(action);};
 let saved=[];function toggleFocus(){const visible=[...panels.values()].filter(p=>!p.box.hidden);if(visible.length){saved=visible;visible.forEach(p=>p.show(false));focus.setAttribute('aria-pressed','true');}else{(saved.length?saved:[panels.get('procedure')]).forEach(p=>p.show(true));focus.setAttribute('aria-pressed','false');}}
 focus.onclick=toggleFocus;
 fullscreen.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await main.requestFullscreen();}catch{bottom.textContent='Full screen is unavailable here. Focus still clears the bench.';}};
 function clampPanel(box){if(box.hidden)return;const b=box.getBoundingClientRect(),r=main.getBoundingClientRect();if(box.style.left)box.style.left=Math.max(8,Math.min(parseFloat(box.style.left),r.width-b.width-8))+'px';if(box.style.top)box.style.top=Math.max(r.height<500?53:102,Math.min(parseFloat(box.style.top),r.height-Math.min(b.height,r.height-105)-55))+'px';}
 window.addEventListener('resize',()=>panels.forEach(p=>clampPanel(p.box)));
 document.addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea,[contenteditable="true"]'))return;if(e.key.toLowerCase()==='f'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();toggleFocus();}});
 // Collapse oversized content only when the learner explicitly chooses Focus.
 // Keep status/current step visible even with every panel closed.
 const current=()=>main.dataset.mode||p.defaultMode||'',cfg=()=>({...p,...(p.modes?.[current()]||{})});
 let scheduled=false;function sync(){scheduled=false;const c=cfg(),t=$(c.title)?.textContent?.trim()||'3D practice',hint=$(c.hint)?.textContent?.trim()||'Drag a part to a highlighted seat. Open Procedure for the next step.';if(title.textContent!==t){title.textContent=t;title.title=t;}if(bottom.textContent!==hint){bottom.textContent=hint;bottom.title=hint;}
  const labels=c.labels||{};for(const [key,e] of panels){const l=key in labels?labels[key]:e.label,off=l===null;if(e.button.hidden!==off){e.button.hidden=off;if(off&&!e.box.hidden)e.show(false);}if(!off&&e.handle.textContent!==l){e.handle.textContent=l;e.box.setAttribute('aria-label',l);e.button.setAttribute('aria-label',l);e.button.title=l;e.button.querySelector('.lab-dock-label').textContent=l;e.close.setAttribute('aria-label','Collapse '+l);}}
  if(ticket){let any=false;const now=current();p.ticket.forEach(([,sel,unit,only],i)=>{const v=only&&only!==now?'':($(sel)?.textContent||'').trim(),out=ticket.children[i].querySelector('strong'),text=v?v+(unit&&v!=='—'?unit:''):'';if(ticket.children[i].hidden!==!text)ticket.children[i].hidden=!text;if(text)any=true;if(out.textContent!==text)out.textContent=text;});if(ticket.hidden!==!any)ticket.hidden=!any;}}
 const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(sync);}});observer.observe(main,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','data-mode']});sync();
 // Existing links that open notebooks must also reveal their new containing panel.
 document.addEventListener('click',e=>{const a=e.target.closest('a[href^="#"]');if(!a)return;const target=document.getElementById(a.getAttribute('href').slice(1));const entry=[...panels.values()].find(p=>p.box.contains(target));if(entry){entry.show(true);const drawer=target?.tagName==='DETAILS'?target:target?.closest('details');if(drawer)drawer.open=true;}});
 document.addEventListener('toggle',e=>{if(e.target.tagName==='DETAILS'&&e.target.open){const entry=[...panels.values()].find(p=>p.box.hidden&&p.box.contains(e.target));entry?.show(true);}},true);
 let held=null;
 surface.addEventListener('pointerdown',e=>{if(e.button===0)held={target:e.target,id:e.pointerId,x:e.clientX,y:e.clientY};},true);
 window.addEventListener('pointermove',e=>{if(held?.id===e.pointerId&&Math.hypot(e.clientX-held.x,e.clientY-held.y)>5)main.classList.add('lab-handling');},true);
 for(const name of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(name,e=>{if(held?.id===e.pointerId){held=null;main.classList.remove('lab-handling');}},true);
 function cancelHeld(){if(!held)return;const h=held;held=null;main.classList.remove('lab-handling');h.target.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:h.id,clientX:h.x,clientY:h.y,button:0}));}
 window.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(held){cancelHeld();return;}if(focus.getAttribute('aria-pressed')==='true'&&!document.querySelector('dialog[open]'))toggleFocus();});
 window.addEventListener('blur',cancelHeld);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelHeld();});
 choiceStrips(main);
 main.dataset.workspaceReady='true';
 document.dispatchEvent(new Event('lab-workspace-ready'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
