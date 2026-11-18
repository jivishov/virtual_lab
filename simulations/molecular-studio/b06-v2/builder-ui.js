// Build a molecule: studio layout (B06 redesign, phase 2, 2026-11-17).
// Applies the approved mock (plan/2026-11-15_b06-uiux-mock) to the Build a molecule bench: the kit
// on the left, the model in the middle with the bench head above it and the view tools and one coach
// line below it, one docked task panel (Task, Selection) on the right and a footer. The hand layout
// (main.ms-hand-layout, set by studio-shell.js) keeps the kit on the left edge, task tiles on the
// right edge and the hand bar at the foot.
// Live controls are moved, never cloned: their ids and listeners stay intact. Every action goes
// through window.b06Builder (builder.js), so this file adds no chemistry of its own; snapSites and
// environment are read only to decide which Selection actions apply.
import {CHALLENGES} from './challenges.js';
import {snapSites,environment,ELEMENTS} from './molecule-model.js';

const main=document.querySelector('main');
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const make=(tag,props={},html='')=>{const el=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')el.className=v;else el.setAttribute(k,v);}if(html)el.innerHTML=html;return el;};
// Replace a group's buttons only when they change, so a hand that is aiming at one keeps it.
const paint=(el,html)=>{if(el._msHtml===html)return false;el._msHtml=html;el.innerHTML=html;return true;};
const hands=()=>main.classList.contains('hands-on');
const layout=()=>main.classList.contains('ms-hand-layout');
const inBuilder=()=>main.dataset.mode==='builder';
const B={'data-b06-mode':'builder'};
// shell.js wraps some live nodes in a one-child mode scope; move the scope with its node.
const scoped=el=>{const p=el?.parentElement;return p?.classList.contains('b06-mode-scope')&&p.children.length===1?p:el;};
const GROUPS=[['covalent','Covalent challenges'],['ionic','Ionic compounds'],['free','Free bench']];
const groupOf=b=>CHALLENGES[b]?'covalent':b==='ionic'||b==='transfer'?'ionic':'free';
// Hand building places atoms through the Electron transfer bench (builder.js switches to it).
const benchesOf=g=>g==='covalent'?Object.keys(CHALLENGES):g==='ionic'?(hands()?['transfer']:['ionic','transfer']):['free'];
const ORDER=['','single','double','triple'],GLYPH=['','─','=','≡'];
const SHELF_PAGE=8;

function setup(){
 if(main.dataset.msBuilder||!window.b06Studio)return;
 const surface=main.querySelector('.lab-surface'),stage=$('builder-stage'),tray=$('builder-tray');
 if(!surface||!stage||!tray)return;
 main.dataset.msBuilder='true';main.classList.add('ms-builder');
 const api=window.b06Builder;
 const lastBench={};
 const ui={tab:'task',group:'',hint:new Map(),shelf:{open:false,group:'',page:0},display:false};

 // ---------- Bench head: group pills, then bench buttons (no visible select) ----------
 const head=make('div',{...B,class:'ms-stagehead ms-bhead',id:'ms-bhead'});
 const pills=make('div',{class:'ms-pills',id:'ms-bgroups',role:'tablist','aria-label':'Bench group'});
 pills.innerHTML=GROUPS.map(([g,label])=>`<button type="button" role="tab" data-group="${g}" aria-selected="false" tabindex="-1">${esc(label)}</button>`).join('');
 const row=make('div',{class:'ms-brow'});
 const benches=make('div',{class:'ms-mols',id:'ms-bbenches',role:'group','aria-label':'Bench'});
 const refs=make('div',{class:'ms-brefs',id:'ms-brefs',role:'group','aria-label':'Reference models'});
 refs.append(make('span',{class:'ms-brefs-label'},'Load a reference to edit:'));
 const examples=$('example-molecules');
 if(examples){
  for(const b of examples.querySelectorAll('button')){const name=b.title,formula=b.textContent;b.type='button';b.innerHTML=`<b>${esc(formula)}</b><small>${esc(name)}</small>`;b.removeAttribute('title');}
  refs.append(examples);
 }
 row.append(benches,refs);head.append(pills,row);
 function chooseGroup(g){
  if(g===groupOf(api.bench))return;
  const list=benchesOf(g),target=list.includes(lastBench[g])?lastBench[g]:list[0];
  api.setBench(target);
 }
 pills.addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b)chooseGroup(b.dataset.group);});
 pills.addEventListener('keydown',e=>{
  const keys={ArrowRight:1,ArrowLeft:-1,Home:'first',End:'last'};if(!(e.key in keys))return;e.preventDefault();
  const all=[...pills.querySelectorAll('[data-group]')],i=all.indexOf(e.target.closest('[data-group]'));
  const next=keys[e.key]==='first'?all[0]:keys[e.key]==='last'?all.at(-1):all[(i+keys[e.key]+all.length)%all.length];
  chooseGroup(next.dataset.group);next.focus({preventScroll:true});
 });
 benches.addEventListener('click',e=>{const b=e.target.closest('[data-bench]');if(b&&b.dataset.bench!==api.bench)api.setBench(b.dataset.bench);});
 function benchButton(id){
  const c=CHALLENGES[id],done=!!c&&api.passed(id);
  const label=c?`${c.name}, ${c.formula}`:id==='ionic'?'Ionic compounds':id==='transfer'?'Electron transfer':'Free bench';
  const inner=c?`<b>${esc(c.formula)}</b><small>${esc(c.name)}</small>`:`<b>${esc(label)}</b>`;
  return `<button type="button" data-bench="${id}" aria-pressed="${id===api.bench}" class="${done?'done':''}" aria-label="${esc(label+(done?', checked, matches':''))}">${inner}</button>`;
 }
 function renderHead(){
  const g=groupOf(api.bench);lastBench[g]=api.bench;
  for(const b of pills.children){const on=b.dataset.group===g;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;}
  const list=benchesOf(g),key=g+':'+list.join(',');
  if(benches.dataset.key!==key){
   const had=benches.contains(document.activeElement)?document.activeElement.dataset.bench:null;
   benches.dataset.key=key;benches.innerHTML=list.map(benchButton).join('');
   if(had)benches.querySelector(`[data-bench="${had}"]`)?.focus({preventScroll:true});
  }
  for(const b of benches.children){
   const id=b.dataset.bench,c=CHALLENGES[id],done=!!c&&api.passed(id);
   b.setAttribute('aria-pressed',String(id===api.bench));b.classList.toggle('done',done);
   if(c)b.setAttribute('aria-label',`${c.name}, ${c.formula}`+(done?', checked, matches':''));
  }
  refs.hidden=g!=='free';
 }

 // ---------- Over the model: title, then the rings of press, then press ----------
 const over=make('div',{...B,class:'ms-overlay ms-bover',id:'ms-bover','data-hand-zone':''});
 over.innerHTML=`<div class="ms-stagetitle"><h2 id="ms-btitle">Build a molecule</h2><small id="ms-bsub"></small></div><div class="ms-rings" id="ms-brings" role="group" aria-label="Rings on the model"><svg aria-hidden="true"></svg></div>`;
 const ringBox=over.querySelector('#ms-brings'),ringSvg=ringBox.querySelector('svg');
 const ringPool=[];
 ringBox.addEventListener('click',e=>{const b=e.target.closest('.ms-ring');if(b&&!b.hidden)api.pressRing(Number(b.dataset.index));});
 function renderTitle(){
  const c=api.challenge(),g=api.graph;
  const formula=$('molecule-formula')?.textContent.trim()||'';
  $('ms-btitle').textContent=c?`${c.name} · ${c.formula}`:api.benchName(api.bench);
  $('ms-bsub').textContent=g.atoms.length?(api.isIonic()?formula:'Your construction · '+formula):'Empty bench';
 }
 // One button per real snap site of the armed part (api.rings comes from builder.js ringSites, which
 // keeps a site only where the same drop is accepted). Buttons come from a pool and are never
 // re-created, so a hand aiming at one keeps it. Rings hide while a part is carried (CSS).
 let ringFrame=0,ringKey='',ringSites=null,ringsAway=null;
 function ringButton(i){
  while(ringPool.length<=i){
   const b=make('button',{type:'button',class:'ms-ring','data-index':String(ringPool.length)});b.hidden=true;
   const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.style.display='none';
   ringBox.append(b);ringSvg.append(line);ringPool.push({b,line});
  }
  return ringPool[i];
 }
 function ringsShown(){return inBuilder()&&!main.classList.contains('immersive')&&!!api.armed&&!api.isIonic()&&(api.rings?.length||0)>0;}
 function placeRings(){
  ringFrame=0;
  const sites=ringsShown()?api.rings:[];
  const camera=api.viewer.controls.camera;camera.updateMatrixWorld();
  const o=over.getBoundingClientRect();
  const key=[o.left,o.top,o.width,o.height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].map(v=>Math.round(v*1000)).join(',');
  if(sites===ringSites&&key===ringKey){if(sites.length)ringFrame=requestAnimationFrame(placeRings);return;}
  ringSites=sites;ringKey=key;
  ringSvg.setAttribute('viewBox',`0 0 ${Math.max(1,o.width)} ${Math.max(1,o.height)}`);
  const seen=new Map(),g=api.graph,pair=api.armed?.kind==='pair';
  const spots=sites.map((site,i)=>{
   const {b}=ringButton(i),p=api.viewer.projectPoint(site.position),a=g.atoms.find(x=>x.id===site.target);
   // projectPoint returns normalized device depth: in view between -1 (near) and 1 (far).
   const x=p.x-o.left,y=p.y-o.top,inside=p.z>-1&&p.z<1&&x>=0&&y>=0&&x<=o.width&&y<=o.height;
   const n=(seen.get(site.target)||0)+1;seen.set(site.target,n);
   const name=a?a.element+a.id:'',label=(pair?'Lone pair site':'Ring')+(n>1?' '+n:'')+' on '+name;
   if(b.getAttribute('aria-label')!==label)b.setAttribute('aria-label',label);
   b.title=label;b.classList.toggle('ms-pair',pair);b.hidden=!inside;
   return {i,a,x,y,inside};
  });
  // Two sites can project almost onto one spot (one in front of the atom, one behind). Their buttons are
  // pushed apart on screen until they are 8 px apart (box to box), staying inside the model box; the dashed
  // line still runs from the atom to its button. Nothing moves in 3D.
  const shown=spots.filter(s=>s.inside),size=shown.length>1?ringPool[shown[0].i].b.offsetWidth:0;
  if(size){
   const D=size+8,half=size/2,clamp=(v,max)=>Math.min(Math.max(v,half),Math.max(half,max-half));
   for(let pass=0;pass<12;pass++){
    let moved=false;
    for(let i=0;i<shown.length;i++)for(let j=i+1;j<shown.length;j++){
     const s=shown[i],t=shown[j],dx=t.x-s.x,dy=t.y-s.y,c=Math.max(Math.abs(dx),Math.abs(dy));
     if(c>=D-.01)continue;
     const push=(D-c)/2+.01,alongX=Math.abs(dx)>=Math.abs(dy),sign=(alongX?dx:dy)||((s.i<t.i)?1:-1);
     if(alongX){s.x-=Math.sign(sign)*push;t.x+=Math.sign(sign)*push;}else{s.y-=Math.sign(sign)*push;t.y+=Math.sign(sign)*push;}
     moved=true;
    }
    for(const s of shown){s.x=clamp(s.x,o.width);s.y=clamp(s.y,o.height);}
    if(!moved)break;
   }
  }
  for(const s of spots){
   const {b,line}=ringPool[s.i];b.style.left=s.x+'px';b.style.top=s.y+'px';
   if(s.a&&s.inside){const c=api.viewer.projectPoint(s.a.position);line.setAttribute('x1',c.x-o.left);line.setAttribute('y1',c.y-o.top);line.setAttribute('x2',s.x);line.setAttribute('y2',s.y);line.style.display='';line.classList.toggle('ms-pair',pair);}
   else line.style.display='none';
  }
  for(let i=sites.length;i<ringPool.length;i++){ringPool[i].b.hidden=true;ringPool[i].line.style.display='none';}
  ringBox.hidden=!sites.length;
  // Every ring is outside the model box: say so (the arming message asks for a ring the student cannot see),
  // and put the arming message back once a ring is in view again. Fit view brings the rings in (fitRings);
  // the camera never moves by itself.
  const away=sites.length>0&&sites.every((s,i)=>ringPool[i].b.hidden),st=$('builder-status');
  if(st&&away&&!ringsAway){const note=(sites.length>1?'The rings are':'The ring is')+' outside the view. Press Fit view to see '+(sites.length>1?'them.':'it.');
   ringsAway={note,before:st.textContent,error:st.classList.contains('error')};st.textContent=note;st.classList.remove('error');}
  else if(st&&!away&&ringsAway){if(st.textContent===ringsAway.note&&sites.length){st.textContent=ringsAway.before;st.classList.toggle('error',ringsAway.error);}ringsAway=null;}
  if(sites.length)ringFrame=requestAnimationFrame(placeRings);
 }
 const queueRings=()=>{if(!ringFrame)ringFrame=requestAnimationFrame(placeRings);};
 // Fit view frames the atoms (molecule-viewer.js). While a part is armed, the same press also steps
 // out (the Zoom out amount, at most four times) until every ring is inside the model box.
 function fitRings(){
  for(let i=0;i<4&&ringsShown();i++){
   const o=over.getBoundingClientRect(),m=16;api.viewer.controls.camera.updateMatrixWorld();
   const outside=api.rings.some(s=>{const p=api.viewer.projectPoint(s.position);return p.x<o.left+m||p.y<o.top+m||p.x>o.right-m||p.y>o.bottom-m;});
   if(!outside)break;
   api.viewer.zoom(1/1.2);
  }
  queueRings();
 }
 $('builder-fit')?.addEventListener('click',fitRings);

 // ---------- View tools under the model, then one coach line ----------
 // A hand zone: on a narrow screen with hands on, these tools replace the floating hand toolbars
 // (the hand layout and Immerse hide this bar).
 const viewbar=make('div',{...B,class:'ms-viewbar ms-bview',id:'ms-bview',role:'toolbar','aria-label':'View tools','data-hand-zone':''});
 viewbar.innerHTML=`<div class="ms-seg" role="group" aria-label="What a drag does"><button type="button" data-ms-bcam="move" aria-pressed="true" title="Drag parts on the model">Move</button><button type="button" data-ms-bcam="orbit" aria-pressed="false" title="Drag anywhere to turn the model">Rotate</button><button type="button" data-ms-bcam="pan" aria-pressed="false" title="Drag anywhere to slide the view">Pan</button></div>
  <div class="ms-seg" id="ms-bzoom" role="group" aria-label="Zoom"></div><div class="ms-seg" id="ms-btoggles" role="group" aria-label="Show on the model"></div>
  <div class="ms-bdisplay"><button type="button" class="ms-bpop-open" id="ms-bdisplay-open" aria-expanded="false" aria-controls="ms-bdisplay">Display <span aria-hidden="true">▾</span></button>
  <div class="ms-pop" id="ms-bdisplay" role="group" aria-label="Display" hidden><p class="ms-rowlabel" id="ms-bstyle-label">Model style</p><div class="ms-seg ms-bstyles" id="ms-bstyles" role="group" aria-labelledby="ms-bstyle-label"></div><p class="ms-rowlabel" id="ms-bextra-label">Extras</p><div class="ms-seg" id="ms-bextras" role="group" aria-labelledby="ms-bextra-label"></div><div class="ms-bnote" id="ms-bnote"></div></div></div>`;
 const textButton=(b,text,label=text)=>{if(!b)return;b.type='button';b.replaceChildren(text);b.classList.remove('model-tool-icon');b.setAttribute('aria-label',label);b.removeAttribute('title');};
 textButton($('builder-fit'),'Fit','Fit view');textButton($('builder-zoom-out'),'−','Zoom out');textButton($('builder-zoom-in'),'+','Zoom in');
 viewbar.querySelector('#ms-bzoom').append(...['builder-fit','builder-zoom-out','builder-zoom-in'].map($).filter(Boolean));
 textButton($('show-pairs'),'Lone pairs');textButton($('show-labels'),'Labels');textButton($('show-geometry'),'Geometry');textButton($('spin'),'Spin');
 // (Kept as references: the view bar is not in the document yet, so getElementById cannot find them later.)
 const toggles=['show-pairs','show-labels'].map($).filter(Boolean);
 viewbar.querySelector('#ms-btoggles').append(...toggles);
 viewbar.querySelector('#ms-bextras').append(...['show-geometry','spin'].map($).filter(Boolean));
 // Desktop screens up to 1180px wide leave the view bar too little room beside the task panel:
 // Lone pairs and Labels move into Display (first in Extras), so Display is never under the panel.
 const tightBar=matchMedia('(min-width:901px) and (max-width:1180px)');
 function placeToggles(){
  if(tightBar.matches)viewbar.querySelector('#ms-bextras').prepend(...toggles);
  else viewbar.querySelector('#ms-btoggles').append(...toggles);
 }
 placeToggles();tightBar.addEventListener('change',placeToggles);
 const note=$('representation-note');if(note)viewbar.querySelector('#ms-bnote').append(note);
 const palette=main.querySelector(':scope > .model-views'),styleBox=viewbar.querySelector('#ms-bstyles');
 const styles=[...document.querySelectorAll('[data-style]')];
 for(const b of styles)b.type='button';
 // Immerse keeps the floating style palette; the studio layout keeps the styles under Display.
 function placeStyles(){
  const immersive=main.classList.contains('immersive'),home=immersive&&palette?palette:styleBox;
  if(styles[0]&&styles[0].parentElement!==home)home.append(...styles);
 }
 const pop=viewbar.querySelector('#ms-bdisplay'),popOpen=viewbar.querySelector('#ms-bdisplay-open');
 function setDisplay(open,returnFocus=false){
  if(pop.hidden===!open)return;pop.hidden=!open;popOpen.setAttribute('aria-expanded',String(open));
  if(open)pop.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
  else if(returnFocus)popOpen.focus({preventScroll:true});
 }
 popOpen.addEventListener('click',()=>setDisplay(pop.hidden));
 document.addEventListener('pointerdown',e=>{if(!pop.hidden&&!pop.parentElement.contains(e.target))setDisplay(false);},true);
 pop.parentElement.addEventListener('keydown',e=>{if(e.key==='Escape'&&!pop.hidden){e.preventDefault();e.stopPropagation();setDisplay(false,true);}});
 pop.parentElement.addEventListener('focusout',e=>{if(!pop.hidden&&e.relatedTarget&&!pop.parentElement.contains(e.relatedTarget))setDisplay(false);});
 function renderCamera(){
  const cam=main.labCamera,now=cam?.mode||'move';
  for(const b of viewbar.querySelectorAll('[data-ms-bcam]')){b.disabled=!cam;b.setAttribute('aria-pressed',String(b.dataset.msBcam===now));}
 }
 viewbar.addEventListener('click',e=>{const b=e.target.closest('[data-ms-bcam]');if(b&&main.labCamera){main.labCamera.command(b.dataset.msBcam);renderCamera();}});
 document.addEventListener('lab-camera-ready',renderCamera);

 const coach=make('div',{...B,class:'ms-coach ms-bcoach',id:'ms-bcoach'});
 coach.append(make('span',{class:'ms-ico','aria-hidden':'true'},'i'));
 const status=$('builder-status');if(status)coach.append(status);

 // ---------- Task panel: Task and Selection tabs, one main button ----------
 const rail=make('aside',{...B,class:'ms-rail ms-brail',id:'ms-brail','data-hand-zone':'','aria-label':'Task panel'});
 rail.innerHTML=`<div class="ms-btabs" role="tablist" aria-label="Task panel"><button type="button" role="tab" id="ms-btab-task" data-tab="task" aria-selected="true" aria-controls="ms-bpane-task" tabindex="0">Task</button><button type="button" role="tab" id="ms-btab-sel" data-tab="sel" aria-selected="false" aria-controls="ms-bpane-sel" tabindex="-1">Selection<span id="ms-btab-note"></span></button></div>
  <div class="ms-task ms-btask" id="ms-btask">
   <section id="ms-bpane-task" role="tabpanel" aria-labelledby="ms-btab-task"><h2 id="ms-btask-title" tabindex="-1"></h2><div class="ms-box ms-bmodel" id="ms-bmodel"></div><div class="ms-bhint" id="ms-bhint"><button type="button" class="ms-btn ms-small" id="ms-bhint-btn" data-ms-desk aria-expanded="false" aria-controls="ms-bhint-text">Show a hint</button><p class="ms-note" id="ms-bhint-text" hidden></p></div><div class="ms-tiles" id="ms-btask-tiles" data-ms-hand></div></section>
   <section id="ms-bpane-sel" role="tabpanel" aria-labelledby="ms-btab-sel" hidden>
    <div id="ms-bsel-atom"><p class="ms-lead" id="ms-bsel-ionlead"></p><div class="ms-bfacts" id="ms-bfacts"></div><div class="ms-chips" id="ms-bacts" role="group" aria-label="Actions on the selected atom"></div>
     <div class="ms-bspread" id="ms-bspread"><p class="ms-rowlabel" id="ms-bspread-label">Spread the domains evenly. How many domains?</p><div class="ms-chips" style="--cols:5" role="group" aria-labelledby="ms-bspread-label">${[2,3,4,5,6].map(n=>`<button type="button" data-spread="${n}" aria-label="${n} domains">${n}</button>`).join('')}</div></div>
     <details class="ms-more" id="ms-bkeys" data-ms-desk><summary>Select with the keyboard</summary></details></div>
    <div id="ms-bsel-bond" hidden><h2 id="ms-bbond-title" tabindex="-1"></h2><p class="ms-lead" id="ms-bbond-lead"></p><div class="ms-chips" style="--cols:3" role="group" aria-label="Bond order">${[1,2,3].map(n=>`<button type="button" data-bond-order="${n}" aria-pressed="false">${ORDER[n][0].toUpperCase()+ORDER[n].slice(1)}</button>`).join('')}</div><div class="ms-chips ms-bone"><button type="button" id="ms-bbond-remove">Remove bond</button></div></div>
    <div id="ms-bsel-pair" hidden><h2 id="ms-bpair-title" tabindex="-1"></h2><p class="ms-lead">Two nonbonding electrons. One electron domain.</p><div class="ms-chips ms-bone"><button type="button" id="ms-bpair-remove">Remove lone pair</button></div></div>
    <div id="ms-bsel-none" hidden><h2>Nothing selected</h2><p class="ms-lead" id="ms-bnone-lead"></p></div>
   </section>
  </div>
  <div class="ms-actions" id="ms-bactions"></div>`;
 const paneTask=rail.querySelector('#ms-bpane-task'),paneSel=rail.querySelector('#ms-bpane-sel');
 const taskTitle=rail.querySelector('#ms-btask-title'),modelBox=rail.querySelector('#ms-bmodel');
 // Task: the live brief, charge balance, model readout, check results and the main button.
 const brief=$('assignment-brief'),balance=main.querySelector('.ionic-balance');
 taskTitle.after(...[brief,balance].filter(Boolean));
 const sceneHead=main.querySelector('.builder-scene-header');if(sceneHead)modelBox.append(scoped(sceneHead));
 const checkStatus=$('challenge-status'),feedback=$('challenge-feedback');
 if(checkStatus){checkStatus.classList.add('ms-sr');modelBox.after(checkStatus);}
 if(feedback){feedback.classList.add('ms-bcrit');(checkStatus||modelBox).after(feedback);}
 const check=$('check-challenge');
 if(check){check.type='button';check.classList.remove('primary');check.classList.add('ms-btn','ms-primary');rail.querySelector('#ms-bactions').append(check);}
 // Selection: the live heading, readouts, actions and the button editor.
 const atomBlock=rail.querySelector('#ms-bsel-atom'),facts=rail.querySelector('#ms-bfacts'),acts=rail.querySelector('#ms-bacts');
 const heading=main.querySelector('.selection-heading');if(heading)atomBlock.prepend(heading);
 const FACTS=[['local-shape','Local shape'],['pair-count','Lone pairs'],['hybrid-label','Hybridization'],['expected-angles','Angle trend'],['domain-count','Domains placed'],['electron-geometry','Electron geometry'],['ideal-angles','Ideal angles'],['bond-tally','σ and π bonds'],['spacing-status','Your spacing']];
 for(const [id,label] of FACTS){
  const value=$(id);if(!value)continue;
  const cell=make('div',{class:'ms-fact'});const title=value.parentElement?.title;if(title)cell.title=title;
  cell.append(make('small',{},esc(label)),value);facts.append(cell);
 }
 const join=make('button',{type:'button',id:'ms-bjoin','aria-pressed':'false'},'Join to…');
 acts.append(...['attach-atom','seat-pair','unseat-pair'].map($).filter(Boolean),join,...['unseat-atom','remove-ion'].map($).filter(Boolean));
 for(const b of acts.querySelectorAll('button'))b.type='button';
 const gauge=$('local-gauge'),editor=main.querySelector('.site-editor');
 atomBlock.querySelector('#ms-bspread').after(...[gauge,editor].filter(Boolean));
 if(editor){
  editor.classList.add('ms-more');
  const p=editor.querySelector(':scope > p');if(p)p.textContent='The selected atom is the center for these edits. The element and bond order come from the kit.';
  for(const el of [editor.querySelector('label[for=edit-arrangement]'),$('edit-arrangement'),$('align-domains')])el?.classList.add('ms-bk-hide');
  for(const b of editor.querySelectorAll('button'))b.type='button';
 }
 const keys=rail.querySelector('#ms-bkeys');keys.append(...['atom-list','selection-hint'].map($).filter(Boolean));
 // The native selects here (second atom, angle neighbors) are already shown as chip groups by the
 // shared choices.js, which keeps each group beside its select; the arrangement select is replaced
 // by the Spread row above (its chip group is hidden in builder-ui.css).
 // Selection actions: each goes through builder.js.
 join.addEventListener('click',()=>api.toggleJoin());
 atomBlock.querySelector('#ms-bspread').addEventListener('click',e=>{const b=e.target.closest('[data-spread]');if(b)api.spread(Number(b.dataset.spread));});
 rail.querySelector('#ms-bsel-bond').addEventListener('click',e=>{const b=e.target.closest('[data-bond-order]');if(b)api.setBondOrder(Number(b.dataset.bondOrder));});
 rail.querySelector('#ms-bbond-remove').addEventListener('click',()=>api.removeFocused());
 rail.querySelector('#ms-bpair-remove').addEventListener('click',()=>api.removeFocused());
 // Tabs: arrow keys move between them; a press moves focus to the pane heading only when asked.
 const tabs=[...rail.querySelectorAll('[role=tab]')];
 function setTab(tab,focusPane=false){
  ui.tab=tab;
  for(const t of tabs){const on=t.dataset.tab===tab;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;}
  paneTask.hidden=tab!=='task';paneSel.hidden=tab!=='sel';
  if(focusPane)(tab==='task'?taskTitle:paneSel.querySelector(':scope > div:not([hidden]) :is(h2,h3)'))?.focus?.({preventScroll:true});
 }
 rail.querySelector('.ms-btabs').addEventListener('click',e=>{const t=e.target.closest('[role=tab]');if(t)setTab(t.dataset.tab);});
 rail.querySelector('.ms-btabs').addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
  const next=e.key==='Home'?tabs[0]:e.key==='End'?tabs.at(-1):tabs[(tabs.indexOf(e.target.closest('[role=tab]'))+1)%2];
  setTab(next.dataset.tab);next.focus({preventScroll:true});
 });
 // Hints: one at a time from the challenge's own list, per bench, in memory only.
 const hintButton=rail.querySelector('#ms-bhint-btn'),hintText=rail.querySelector('#ms-bhint-text');
 const hints=()=>[...($('assignment-hints')?.children||[])].map(li=>li.textContent);
 function nextHint(){const n=hints().length,k=ui.hint.get(api.bench)||0;ui.hint.set(api.bench,k>=n?0:k+1);renderTask();}
 hintButton.addEventListener('click',nextHint);

 // ---------- Footer: history, files, help and the save line ----------
 const foot=make('footer',{...B,class:'ms-foot ms-bfoot',id:'ms-bfoot','aria-label':'Bench tools'});
 const label=(b,html,aria)=>{if(!b)return;b.type='button';b.innerHTML=html;b.classList.remove('model-tool-icon');b.classList.add('ms-btn','ms-small');if(aria)b.setAttribute('aria-label',aria);else b.removeAttribute('aria-label');};
 label($('builder-undo'),'<span aria-hidden="true">↶</span> Undo','Undo');label($('builder-redo'),'<span aria-hidden="true">↷</span> Redo','Redo');
 label($('new-molecule'),'Clear this bench');label($('save-model'),'Save file');label($('load-model'),'Open file');label($('snapshot'),'Save image');
 const helpOpen=make('button',{type:'button',class:'ms-btn ms-small',id:'ms-bhelp-open'},'Help');
 const saved=make('div',{class:'ms-saved'});const saveLine=$('builder-save-status');if(saveLine)saved.append(scoped(saveLine));
 const files=main.querySelector('.file-tools');
 foot.append(...['builder-undo','builder-redo','new-molecule'].map($).filter(Boolean),...(files?[scoped(files)]:[]),helpOpen,saved);
 // Help: how to build and handle the model, the keyboard kit and the model notes.
 const help=window.b06Studio.addDrawer?.('ms-bhelp-drawer','Help','builder',helpOpen);
 if(help){
  help.innerHTML=`<h3>Build with the kit</h3><ul>
   <li>Press an atom tile, then a ring on the model. Rings show where the atom can bond. You can also drag the tile there.</li>
   <li>Press open space on the bench to place a loose atom.</li>
   <li>Press the lone pair tile, then an amber ring.</li>
   <li>Press an atom, a bond or a lone pair on the model to see it in Selection.</li>
   <li>Join to… bonds the selected atom to the next atom you press.</li>
   <li>Drag a part to Delete in the kit to remove it.</li>
   <li>Electron transfer: press a metal atom, then a nonmetal atom, or drag one onto the other.</li></ul>
   <h3>Handle the model</h3><ul>
   <li>Drag open space to turn the model. Scroll to zoom.</li>
   <li>Move, Rotate and Pan under the model choose what a drag does.</li>
   <li>Escape puts down a chosen tile.</li></ul>`;
  const kitKeys=main.querySelector('.keyboard-kit');if(kitKeys){kitKeys.classList.add('ms-more');help.append(kitKeys);}
  const about=main.querySelector('.builder-foot');if(about)help.append(scoped(about));
 }

 // ---------- Kit: atoms, bond for the next atom, lone pair, Delete ----------
 tray.classList.add('ms-bkit');
 const steps=tray.querySelectorAll('.build-step');
 if(steps[1])steps[1].querySelector('h3').textContent='Bond for the next atom';
 steps[2]?.classList.add('ms-bk-hide');$('element-name')?.classList.add('ms-bk-hide');
 for(const b of tray.querySelectorAll('[data-order]')){b.type='button';if(!b.querySelector('.ms-glyph'))b.prepend(make('span',{class:'ms-glyph','aria-hidden':'true'},GLYPH[Number(b.dataset.order)]));}
 const pair=$('pair-piece');
 if(pair){pair.type='button';pair.title='Press the lone pair, then an amber ring on an atom. You can also drag it there.';const s=pair.querySelector('small');if(s)s.textContent='Then press a ring';}
 const trayNote=make('p',{class:'ms-traynote','data-ms-desk':''});
 const periodicZone=make('div',{class:'ms-bperiodic','data-hand-zone':'','data-ms-hand':''},'<button type="button" class="ms-tile" id="ms-bperiodic">Periodic table</button>');
 (pair||tray.querySelector('.builder-parts')?.lastElementChild)?.after(trayNote,periodicZone);
 const periodic=periodicZone.querySelector('button');
 periodic.addEventListener('click',()=>$('hand-periodic-orb')?.click());
 // The orb hands focus back to itself on close; it is hidden in this layout, so use the tile.
 document.addEventListener('close',e=>{if(e.target?.id!=='hand-periodic-panel'||!layout())return;requestAnimationFrame(()=>{const a=document.activeElement;if(!a||a===document.body||a.id==='hand-periodic-orb')periodic.focus({preventScroll:true});});},true);
 function renderKit(){
  const armed=api.armed,ionic=api.isIonic();
  trayNote.textContent=api.bench==='transfer'?'Press an atom to place it. Then press a metal and a nonmetal on the bench to move electrons.'
   :ionic?'Press an ion to place it. A bench holds one metal and one nonmetal.'
   :armed?'Press a ring on the model, or open bench space. Press the tile again to put it down.'
   :'Press an atom or the lone pair, then a ring on the model. You can also drag it there.';
  periodic.disabled=!$('hand-periodic-orb');
 }

 // ---------- Press open bench space (Move mode, a press without a drag, no part under it) ----------
 let down=null;
 window.addEventListener('pointerdown',e=>{
  down=null;
  if(!inBuilder()||e.button!==0||!e.isPrimary||!stage.contains(e.target))return;
  down={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,part:!!api.viewer.pick(e.clientX,e.clientY)};
 },true);
 window.addEventListener('pointermove',e=>{if(down&&e.pointerId===down.id&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;},true);
 window.addEventListener('pointerup',e=>{
  const d=down;down=null;
  if(!d||e.pointerId!==d.id||d.moved||d.part||!inBuilder()||(main.labCamera?.mode||'move')!=='move')return;
  api.pressSpace(e.clientX,e.clientY);
 },true);

 // ---------- Hide panels (top bar, More): the task panel and bench head step aside ----------
 const focusButton=main.querySelector('.lab-top .ms-focus');
 if(focusButton){
  // workspace.js toggles its floating panels (hidden here); this layout follows the button's state.
  document.addEventListener('click',e=>{
   if(!inBuilder()||!e.target.closest?.('.ms-focus'))return;
   const want=!main.classList.contains('ms-bfocus');
   queueMicrotask(()=>{focusButton.setAttribute('aria-pressed',String(want));main.classList.toggle('ms-bfocus',want);queueRings();});
  },true);
  new MutationObserver(()=>{const on=inBuilder()&&focusButton.getAttribute('aria-pressed')==='true';if(main.classList.contains('ms-bfocus')!==on){main.classList.toggle('ms-bfocus',on);queueRings();}}).observe(focusButton,{attributes:true,attributeFilter:['aria-pressed']});
 }

 // ---------- Bench shelf (hand layout): group tiles, bench cards with a pager, Close ----------
 const shelf=make('section',{...B,class:'ms-shelf ms-bshelf',id:'ms-bshelf','data-hand-zone':'','data-ms-hand':'','aria-labelledby':'ms-bshelf-title'});
 shelf.hidden=true;
 shelf.innerHTML=`<h2 id="ms-bshelf-title" tabindex="-1">Choose a bench</h2><div class="ms-tiles" style="--cols:3" id="ms-bshelf-groups" role="group" aria-label="Bench group">${GROUPS.map(([g,l])=>`<button type="button" class="ms-tile" data-shelf-group="${g}" aria-pressed="false">${esc(l)}</button>`).join('')}</div>
  <div class="ms-cards" id="ms-bshelf-cards" role="group" aria-label="Benches"></div>
  <div class="ms-pager" id="ms-bshelf-pager"><button type="button" class="ms-tile" data-shelf-page="-1" aria-label="Previous benches">◂</button><span id="ms-bshelf-count"></span><button type="button" class="ms-tile" data-shelf-page="1" aria-label="More benches">More ▸</button><button type="button" class="ms-tile" data-shelf-close>Close</button></div>`;
 const shelfCards=shelf.querySelector('#ms-bshelf-cards'),shelfPager=shelf.querySelector('#ms-bshelf-pager');
 // A card is a bench, or (Free bench group) a reference model loaded into the free bench.
 function shelfItems(g){
  const items=benchesOf(g).map(id=>({bench:id}));
  if(g==='free')[...(examples?.children||[])].forEach((b,i)=>items.push({ref:i,formula:b.querySelector('b')?.textContent||'',name:b.querySelector('small')?.textContent||''}));
  return items;
 }
 function shelfCard(item){
  if(item.ref!=null)return `<button type="button" class="ms-tile" data-shelf-ref="${item.ref}" aria-label="Load ${esc(item.name)} in the free bench"><b>${esc(item.formula)}</b><span>${esc(item.name)}</span></button>`;
  const id=item.bench,c=CHALLENGES[id],done=!!c&&api.passed(id);
  const label=c?`${c.name}, ${c.formula}`+(done?', checked, matches':''):api.benchName(id)==='Free construction'?'Free bench':api.benchName(id);
  return `<button type="button" class="ms-tile${done?' done':''}" data-shelf-bench="${id}" aria-pressed="false" aria-label="${esc(label)}"><b>${esc(c?c.formula:label)}${done?' <i aria-hidden="true">✓</i>':''}</b><span>${esc(c?c.name:id==='transfer'?'Atoms to ions':id==='ionic'?'Ions to a formula unit':'Build anything')}</span></button>`;
 }
 function renderShelf(){
  if(shelf.hidden)return;
  const g=ui.shelf.group||groupOf(api.bench),items=shelfItems(g),pages=Math.max(1,Math.ceil(items.length/SHELF_PAGE));
  ui.shelf.page=Math.min(ui.shelf.page,pages-1);
  for(const b of shelf.querySelectorAll('[data-shelf-group]'))b.setAttribute('aria-pressed',String(b.dataset.shelfGroup===g));
  paint(shelfCards,items.slice(ui.shelf.page*SHELF_PAGE,(ui.shelf.page+1)*SHELF_PAGE).map(shelfCard).join(''));
  for(const b of shelfCards.querySelectorAll('[data-shelf-bench]'))b.setAttribute('aria-pressed',String(b.dataset.shelfBench===api.bench));
  shelfPager.classList.toggle('ms-one',pages<2);
  for(const b of shelfPager.querySelectorAll('[data-shelf-page]'))b.hidden=pages<2;
  const count=shelf.querySelector('#ms-bshelf-count');count.hidden=pages<2;count.textContent=`${ui.shelf.page+1} / ${pages}`;
 }
 const benchTile=()=>$('ms-bt-benches');
 function setShelf(open,{returnFocus=false}={}){
  if(open&&!layout())return;
  if(shelf.hidden===!open)return;
  shelf.hidden=!open;benchTile()?.setAttribute('aria-expanded',String(open));
  if(open){ui.shelf.group=groupOf(api.bench);ui.shelf.page=0;renderShelf();(shelfCards.querySelector('[aria-pressed=true]')||shelf.querySelector('#ms-bshelf-title')).focus({preventScroll:true});}
  else if(returnFocus)benchTile()?.focus({preventScroll:true});
 }
 shelf.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.shelfGroup){ui.shelf.group=b.dataset.shelfGroup;ui.shelf.page=0;renderShelf();return;}
  if(b.dataset.shelfPage){const pages=Math.ceil(shelfItems(ui.shelf.group).length/SHELF_PAGE);ui.shelf.page=(ui.shelf.page+Number(b.dataset.shelfPage)+pages)%pages;renderShelf();return;}
  if(b.hasAttribute('data-shelf-close')){setShelf(false,{returnFocus:true});return;}
  if(b.dataset.shelfBench){api.setBench(b.dataset.shelfBench);setShelf(false);taskTitle.focus({preventScroll:true});return;}
  if(b.dataset.shelfRef!=null){api.setBench('free');examples?.children[Number(b.dataset.shelfRef)]?.click();setShelf(false);taskTitle.focus({preventScroll:true});}
 });
 shelf.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setShelf(false,{returnFocus:true});}});

 // ---------- Task tab ----------
 // Hand tiles are made once and only relabelled, so a hand aiming at one keeps it.
 const tiles=rail.querySelector('#ms-btask-tiles');
 // Row 1 edits the model (Undo, Redo, Clear bench: the desktop foot buttons, same rules); row 2 Hint
 // (challenges only), Benches, Fit view.
 tiles.innerHTML=`<button type="button" class="ms-tile" id="ms-bt-undo">Undo</button><button type="button" class="ms-tile" id="ms-bt-redo">Redo</button><button type="button" class="ms-tile" id="ms-bt-clear">Clear bench</button><button type="button" class="ms-tile" id="ms-bt-hint" aria-controls="ms-bhint-text">Hint</button><button type="button" class="ms-tile" id="ms-bt-benches" aria-expanded="false" aria-controls="ms-bshelf">Benches</button><button type="button" class="ms-tile" id="ms-bt-fit">Fit view</button>`;
 tiles.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.id==='ms-bt-hint')nextHint();
  else if(b.id==='ms-bt-clear')$('new-molecule')?.click();
  else if(b.id==='ms-bt-undo')$('builder-undo')?.click();
  else if(b.id==='ms-bt-redo')$('builder-redo')?.click();
  else if(b.id==='ms-bt-benches')setShelf(shelf.hidden);
  else if(b.id==='ms-bt-fit')$('builder-fit')?.click();
 });
 const eyebrow=main.querySelector('.builder-scene-header .eyebrow');
 const set=(el,text)=>{if(el&&el.textContent!==text)el.textContent=text;};
 function renderTask(){
  const c=api.challenge(),ionic=api.isIonic(),bench=api.bench,passed=!!c&&api.passed(bench);
  const title=c?`${esc(c.name)} <small>${esc(c.formula)}</small>`:esc(bench==='free'?'Free bench':api.benchName(bench));
  if(taskTitle._msHtml!==title){taskTitle._msHtml=title;taskTitle.innerHTML=title;}
  if(brief)brief.hidden=passed;
  set(eyebrow,ionic?'Formula unit':'Your molecule');
  modelBox.classList.toggle('ms-named',!c);
  // Hints: the challenge's own list, one at a time.
  const list=hints(),k=Math.min(ui.hint.get(bench)||0,list.length),showHints=!!c&&list.length>0&&!passed;
  $('ms-bhint').hidden=!showHints;
  set(hintButton,k===0?'Show a hint':k<list.length?'Next hint':'Hide hints');
  hintButton.setAttribute('aria-expanded',String(k>0));
  hintText.hidden=!k||!showHints;set(hintText,k?`Hint ${k} of ${list.length}: ${list[k-1]}`:'');
  const hintTile=$('ms-bt-hint');hintTile.hidden=!c;hintTile.disabled=!showHints;hintTile.setAttribute('aria-expanded',String(k>0&&showHints));
  set(hintTile,k===0?'Hint':k<list.length?'Next hint':'Hide hint');
  // Clear bench on every bench, as the desktop button (undoable, no confirm); Undo and Redo follow the desktop buttons.
  $('ms-bt-undo').disabled=!!$('builder-undo')?.disabled;
  $('ms-bt-redo').disabled=!!$('builder-redo')?.disabled;
  rail.querySelector('#ms-bactions').hidden=!check||check.hidden;
 }

 // ---------- Selection tab: only the actions that apply ----------
 const blocks={atom:atomBlock,bond:rail.querySelector('#ms-bsel-bond'),pair:rail.querySelector('#ms-bsel-pair'),none:rail.querySelector('#ms-bsel-none')};
 const tabNote=rail.querySelector('#ms-btab-note'),spreadBox=atomBlock.querySelector('#ms-bspread');
 const name=a=>a?a.element+a.id:'';
 const BOND_LEAD=['','One σ bond. Choose Double or Triple to add π bonds.','One σ bond and one π bond.','One σ bond and two π bonds.'];
 function selection(){
  const g=api.graph,a=g.atoms.find(x=>x.id===api.selected),f=api.focus;
  return {g,a,f,kind:!a?'none':f?.kind==='bond'?'bond':f?.kind==='pair'?'pair':'atom'};
 }
 function renderSelection(){
  const {g,a,f,kind}=selection(),ionic=api.isIonic(),transfer=api.bench==='transfer';
  for(const [k,el] of Object.entries(blocks))if(el.hidden!==(k!==kind))el.hidden=k!==kind;
  const at=id=>g.atoms.find(x=>x.id===id);
  set(tabNote,kind==='atom'?' · '+name(a):kind==='bond'?` · ${name(at(f.a))}–${name(at(f.b))}`:kind==='pair'?' · lone pair':'');
  if(kind==='atom'){
   const loose=!!ELEMENTS[a.element]?.looseOnly,env=!ionic&&!loose?environment(g,a.id):null;
   facts.hidden=ionic;
   const ionLead=$('ms-bsel-ionlead');ionLead.hidden=!ionic;set(ionLead,transfer?'To move electrons, press a metal and then a nonmetal on the bench.':'Drag an ion to move it.');
   const attachB=$('attach-atom');
   if(attachB){
    attachB.hidden=ionic||loose||!snapSites(g,a.id,{kind:'atom',element:api.element,order:api.order}).length;
    set(attachB,`Add ${api.element} · ${ORDER[api.order]} bond`);
   }
   const seat=$('seat-pair');if(seat){seat.hidden=ionic||loose||!snapSites(g,a.id,{kind:'pair'}).length;set(seat,'Add lone pair');}
   const unseat=$('unseat-pair');if(unseat){unseat.hidden=ionic||!(a.pairs>0);set(unseat,'Remove lone pair');}
   join.hidden=ionic||g.atoms.length<2;join.setAttribute('aria-pressed',String(api.joining));
   const removeAtom=$('unseat-atom'),removeIon=$('remove-ion');
   if(removeAtom)removeAtom.hidden=ionic;if(removeIon)removeIon.hidden=!ionic;
   const domains=env?env.neighbors.length+env.pairs:0;
   spreadBox.hidden=!(env&&!env.missing&&env.balanced&&domains>=2&&env.neighbors.length>=1);
  }else if(kind==='bond'){
   const bond=g.bonds.find(b=>b.a===f.a&&b.b===f.b||b.a===f.b&&b.b===f.a),n=bond?.order||1;
   set($('ms-bbond-title'),`${ORDER[n][0].toUpperCase()+ORDER[n].slice(1)} bond · ${name(at(f.a))}–${name(at(f.b))}`);
   set($('ms-bbond-lead'),BOND_LEAD[n]);
   for(const b of blocks.bond.querySelectorAll('[data-bond-order]'))b.setAttribute('aria-pressed',String(Number(b.dataset.bondOrder)===n));
  }else if(kind==='pair'){
   set($('ms-bpair-title'),`Lone pair on ${name(at(f.owner))}`);
  }else{
   set($('ms-bnone-lead'),!g.atoms.length?'The bench is empty. Place an atom from the kit first.':layout()?'Aim at an atom, a bond or a lone pair on the model. Close and open your hand to select it.':'Press an atom, a bond or a lone pair on the model.');
  }
 }

 // Hand layout: the same live buttons become big tiles.
 const tileGroups=[acts,spreadBox.querySelector('.ms-chips'),blocks.bond.querySelector('.ms-chips'),...rail.querySelectorAll('.ms-bone')];
 function applyTiles(){
  const on=layout();
  for(const box of tileGroups){if(!box)continue;box.classList.toggle('ms-tiles',on);box.classList.toggle('ms-chips',!on);for(const b of box.querySelectorAll('button'))b.classList.toggle('ms-tile',on);}
 }

 // ---------- Hand bar status and top-bar name ----------
 // shapes-ui.js mirrors its own coach into the hand bar when the layout changes, so the builder's
 // line is written after it (next frame) and whenever the builder status changes.
 const bar=main.querySelector('.hand-bar'),barStatus=bar?.querySelector('[role=status]');
 function writeBar(){
  if(!bar||!barStatus||!status||!layout()||!inBuilder())return;
  const text=status.textContent;if(barStatus.textContent!==text)barStatus.textContent=text;
  bar.classList.toggle('ms-bwarn',status.classList.contains('error'));
 }
 function writeSub(){
  if(!layout()||!inBuilder())return;
  const c=api.challenge();set($('ms-handsub'),'Hand building · '+(c?`${c.name} · ${c.formula}`:api.bench==='free'?'Free bench':api.benchName(api.bench)));
 }
 const later=()=>requestAnimationFrame(()=>{writeBar();writeSub();});
 if(status)new MutationObserver(writeBar).observe(status,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']});
 if(barStatus)new MutationObserver(()=>{if(status&&barStatus.textContent!==status.textContent)bar.classList.remove('ms-bwarn');}).observe(barStatus,{childList:true,characterData:true,subtree:true});

 // ---------- One render for every builder change ----------
 let shownBench=null;
 function render(){
  if(api.bench!==shownBench){
   const first=shownBench==null;shownBench=api.bench;
   setTab('task');
   if(!first&&!shelf.hidden)setShelf(false);
  }
  renderHead();renderTitle();renderTask();renderSelection();renderKit();renderCamera();renderShelf();queueRings();
 }
 document.addEventListener('b06-builder-render',e=>{
  const reason=e.detail?.reason;
  if(reason==='select'&&!api.isIonic()&&!api.armed&&ui.tab!=='sel')setTab('sel');
  if(reason==='check'&&ui.tab!=='task')setTab('task');
  render();later();
  // In the hand layout only the check list scrolls (inside itself); show its last row, the first failure.
  if(reason==='check'){const list=$('challenge-feedback');if(list)list.scrollTop=list.scrollHeight;}
 });
 // A bench-select change that builder.js handles (from a file or the hand periodic table) also renders.
 // Layout and mode changes: tiles, style buttons, open popovers, the hand bar and the rings.
 let layoutKey='';
 function applyLayout(){
  const key=[layout(),main.dataset.mode,main.classList.contains('immersive'),hands()].join(':');
  if(key===layoutKey)return;layoutKey=key;
  applyTiles();placeStyles();setDisplay(false);
  if(!layout())setShelf(false);
  if(!inBuilder()&&main.classList.contains('ms-bfocus'))main.classList.remove('ms-bfocus');
  render();later();
 }
 new MutationObserver(applyLayout).observe(main,{attributes:true,attributeFilter:['class','data-mode']});

 // ---------- Place the layout ----------
 surface.append(head,over,viewbar,coach,rail,shelf);
 main.append(foot);
 applyLayout();
}

// Run once both the studio shell and the builder are ready (either order).
const ready=()=>{if(window.b06Studio&&window.b06Builder)setup();};
document.addEventListener('b06-studio-ready',ready);
document.addEventListener('b06-builder-ready',ready);
ready();
