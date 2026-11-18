// Molecular studio shell (B06 redesign, phase 1, 2026-11-16).
// One top bar for all three modes; for Shapes a docked task rail beside the model,
// a slim footer, and drawers for Field notes, Help and Teacher view.
// Live controls are moved, never cloned: their ids and listeners stay intact.
import {MOLECULES,caseFacts,netOptions} from './chemistry.js';

const main=document.querySelector('main');
const $=id=>document.getElementById(id);
const mode=()=>main.dataset.mode==='reaction'?'reaction':main.dataset.mode==='builder'?'builder':'guided';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const make=(tag,props={},html='')=>{const el=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')el.className=v;else if(k in el&&typeof v!=='string')el[k]=v;else el.setAttribute(k,v);}if(html)el.innerHTML=html;return el;};

function setup(){
 if(main.dataset.b06Studio)return;
 const top=main.querySelector('.lab-top'),surface=main.querySelector('.lab-surface');
 if(!top||!surface||!main.dataset.b06Shell)return;
 main.dataset.b06Studio='true';
 main.classList.add('b06-studio');document.documentElement.classList.add('ms-root');
 if(!main.dataset.mode)main.dataset.mode='guided';

 // ---------- Top bar: ‹ Guide · title · mode tabs · hand, Immerse, full screen and room icons · Teacher view · More ----------
 const back=top.querySelector(':scope > a'),title=top.querySelector('h1'),step=top.querySelector('.lab-step');
 const switcher=top.querySelector('.lab-mode-switch');
 const buttons=[...top.querySelectorAll(':scope > button')];
 const focus=buttons.find(b=>b.textContent.trim()==='Focus');
 const full=top.querySelector('button[aria-label="Full screen"]');
 const hands=$('hand-building'),room=$('camera-backdrop'),immerse=$('immersive');
 const sub=make('span',{class:'ms-handsub',id:'ms-handsub'});
 const spacer=make('span',{class:'ms-spacer','aria-hidden':'true'});
 const teacherOpen=make('button',{type:'button',class:'ms-ghost',id:'ms-teacher-open','aria-pressed':'false','aria-controls':'ms-teacher-drawer'},'Teacher view');
 const moreWrap=make('div',{class:'ms-more-wrap'});
 const moreOpen=make('button',{type:'button',class:'ms-ghost',id:'ms-more-open','aria-expanded':'false','aria-controls':'ms-more-menu','aria-label':'More'},'More <span aria-hidden="true">▾</span>');
 const menu=make('div',{class:'ms-menu',id:'ms-more-menu',role:'group','aria-label':'More'});menu.hidden=true;
 moreWrap.append(moreOpen,menu);
 // Hand building, Immerse, Full screen and In your room stay one press away as icon buttons (user
 // rounds B5 and B6); the name is the tooltip and the accessible name.
 const iconButton=(button,text)=>{if(!button)return;const svg=button.querySelector('svg');button.replaceChildren(...(svg?[svg]:[]));button.classList.remove('model-tool-icon');button.classList.add('ms-ghost','ms-icon');button.setAttribute('aria-label',text);button.title=text;};
 iconButton(hands,'Hand building');iconButton(immerse,'Immerse');iconButton(full,'Full screen');iconButton(room,'In your room');
 if(focus){focus.textContent='Hide panels';focus.classList.add('ms-focus');focus.title='Hide or restore panels (F)';menu.append(focus);focus.classList.add('ms-menu-item');}
 top.append(...[back,title,sub,switcher,step,spacer,hands,immerse,full,room,teacherOpen,moreWrap].filter(Boolean));
 // More names what it holds in this mode and width, and steps aside when it holds nothing
 // (Shapes and Reactions on a wide screen).
 function syncMore(){
  const items=[...menu.children].filter(b=>!b.hidden&&getComputedStyle(b).display!=='none');
  const empty=!items.length;
  if(empty)setMenu(false);
  if(moreWrap.hidden!==empty)moreWrap.hidden=empty;
  const text='More: '+items.map(b=>(b.getAttribute('aria-label')||b.textContent.trim()).toLowerCase()).join(', ');
  if(moreOpen.getAttribute('aria-label')!==text)moreOpen.setAttribute('aria-label',text);
 }
 function syncBack(){if(!back)return;back.textContent='‹ Home';back.setAttribute('aria-label','Back to Virtual Lab home');back.title='Back to Virtual Lab home';}
 syncBack();
 function setMenu(open,returnFocus=false){
  if(menu.hidden===!open)return;menu.hidden=!open;moreOpen.setAttribute('aria-expanded',String(open));
  if(open)menu.querySelector('button:not([hidden]):not(:disabled)')?.focus({preventScroll:true});
  else if(returnFocus)moreOpen.focus({preventScroll:true});
 }
 moreOpen.addEventListener('click',()=>setMenu(menu.hidden));
 menu.addEventListener('click',e=>{if(e.target.closest('button'))setMenu(false);});
 document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!moreWrap.contains(e.target))setMenu(false);},true);
 moreWrap.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){e.preventDefault();e.stopPropagation();setMenu(false,true);}});
 moreWrap.addEventListener('focusout',e=>{if(!menu.hidden&&!moreWrap.contains(e.relatedTarget)&&e.relatedTarget)setMenu(false);});

 // ---------- Shapes: task rail beside the model, slim footer under it ----------
 const station=$('station'),rail=$('task-rail'),foot=$('ms-foot');
 surface.append(rail);main.append(foot);
 const saved=$('save-status');if(saved)$('ms-saved').append(saved.closest('.b06-mode-scope')||saved);
 // The overlap warning for end-on ethane belongs on the model, not inside the workshop.
 const overlap=$('vsepr-overlap-note');if(overlap)$('ms-overlap-slot').append(overlap);
 // Bond workshop and the button placement sheet live in Build.
 const workshop=$('vsepr-workshop');if(workshop)$('ms-build-more').prepend(workshop);
 for(const d of $('ms-build-more').querySelectorAll(':scope > details'))d.classList.add('ms-more');
 function syncRail(){
  const off=mode()!=='guided';
  for(const el of [rail,foot]){if(el.hidden!==off)el.hidden=off;const inert=off||station.inert;if(el.inert!==inert)el.inert=inert;}
 }
 new MutationObserver(syncRail).observe(station,{attributes:true,attributeFilter:['inert']});
 syncRail();

 // ---------- Drawers ----------
 const drawers=new Map();let opener=null;
 function drawer(id,heading,owner){
  const d=make('aside',{class:'ms-drawer',id,'aria-label':heading,tabindex:'-1'});d.hidden=true;
  if(owner)d.dataset.b06Mode=owner;
  const head=make('header'),h=make('h2',{tabindex:'-1'});h.textContent=heading;
  const tools=make('span',{class:'ms-drawer-tools'});
  const close=make('button',{type:'button',class:'ms-btn ms-small'},'Close');close.addEventListener('click',()=>closeDrawers(true));
  tools.append(close);head.append(h,tools);
  const body=make('div',{class:'ms-drawer-body'});d.append(head,body);main.append(d);
  drawers.set(id,{d,body,tools,h});return {d,body,tools};
 }
 const openers={'ms-notes-drawer':$('ms-notes-open'),'ms-help-drawer':$('ms-help-open'),'ms-teacher-drawer':teacherOpen};
 function syncOpeners(){for(const [id,b] of Object.entries(openers)){const open=!drawers.get(id).d.hidden;b.setAttribute(b===teacherOpen?'aria-pressed':'aria-expanded',String(open));}}
 function openDrawer(id,from){
  const entry=drawers.get(id);if(!entry)return;
  const wasOpen=!entry.d.hidden;closeDrawers(false);if(wasOpen){from?.focus({preventScroll:true});return;}
  opener=from||document.activeElement;entry.d.hidden=false;entry.d.dispatchEvent(new Event('ms-open'));
  syncOpeners();entry.h.focus({preventScroll:true});
 }
 function closeDrawers(returnFocus){
  let closed=false;
  for(const {d} of drawers.values())if(!d.hidden){d.hidden=true;d.dispatchEvent(new Event('ms-close'));closed=true;}
  syncOpeners();
  // An opener inside the closed More menu hands focus back to More.
  const back=opener?.closest?.('.ms-menu')?.hidden?moreOpen:opener;
  if(closed&&returnFocus&&back?.isConnected)back.focus({preventScroll:true});
  return closed;
 }
 document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||e.defaultPrevented)return;
  const inside=e.target.closest?.('.ms-drawer');
  if(inside||[...drawers.values()].some(x=>!x.d.hidden)&&!e.target.closest?.('input,textarea,dialog')){if(closeDrawers(true))e.preventDefault();}
 });

 // Field notes: the live notebook moves in. Opening it renders every entry for the molecule.
 const notes=drawer('ms-notes-drawer','Field notes','guided');
 const print=make('button',{type:'button',class:'ms-btn ms-small'},'Print / save PDF');print.addEventListener('click',()=>window.print());
 notes.tools.prepend(print);
 const notebook=$('notebook');
 if(notebook){notes.body.append(notebook.closest('.b06-mode-scope')||notebook);}
 notes.d.addEventListener('ms-open',()=>{if(notebook&&!notebook.open)notebook.open=true;});
 notes.d.addEventListener('ms-close',()=>{if(notebook?.open)notebook.open=false;});
 // Printing shows only the field notes, so their list must be open.
 let printClose=false;
 window.addEventListener('beforeprint',()=>{if(notebook&&!notebook.open){notebook.open=true;printClose=true;}});
 window.addEventListener('afterprint',()=>{if(printClose&&notes.d.hidden)notebook.open=false;printClose=false;});
 $('ms-notes-open').addEventListener('click',e=>openDrawer('ms-notes-drawer',e.currentTarget));

 // Help: how to handle the model, the kit contents and the model notes and credits.
 const help=drawer('ms-help-drawer','Help','guided');
 help.body.innerHTML=`<h3>Handle the model</h3><ul>
  <li>Drag a kit piece to a lettered socket, or press the piece and then a socket.</li>
  <li>Drag a fitted piece to another socket, or back to the kit to remove it.</li>
  <li>Drag open space to turn the model. Scroll to zoom. Shift + drag to pan.</li>
  <li>Move, Rotate and Pan under the model choose what a drag does.</li>
  <li>With the model selected, the arrow keys turn it. Escape lets go of a held piece.</li></ul>`;
 const inventory=main.querySelector('.vsepr-kit-inventory');if(inventory)help.body.append(inventory);
 const credits=main.querySelector('.notes');if(credits)help.body.append(credits.closest('.b06-mode-scope')||credits);
 $('ms-help-open').addEventListener('click',e=>openDrawer('ms-help-drawer',e.currentTarget));

 // Teacher view: per-mode intro, classroom settings and an answer key built from the bench's own data.
 const teacher=drawer('ms-teacher-drawer','Teacher view');
 teacher.body.innerHTML=`<div id="ms-teacher-mode"></div>
  <h3>Classroom settings</h3>
  <label class="ms-switch"><input type="checkbox" id="ms-projector"><span>Projector mode<small>Larger text and controls for the front of the room</small></span></label>
  <label class="ms-switch"><input type="checkbox" id="ms-key-toggle"><span>Show answer key for the current task<small>Uses the reference data the workbench already holds</small></span></label>
  <div id="ms-key" class="ms-note" hidden></div>
  <h3>Assign</h3>
  <p>Share this page’s link with students.</p>
  <p>Field notes stay on each student’s device. Print / save PDF in Field notes gives them something to hand in.</p>
  <div id="ms-teacher-extra"></div>`;
 const teachers={
  guided:{
   intro:()=>`<p>AP Chemistry · Topic 2.7 · VSEPR model kit</p><h3>Learning goal</h3><p>Build a Lewis/VSEPR model, name its molecular shape and electron geometry, and use two views to tell a 3D bond angle from its projection.</p>
    <h3>What students do</h3><ol><li><b>Build</b> the model from kit pieces.</li><li><b>Predict</b> domains, shape and the bond-arrow sum.</li><li><b>Observe</b> one bond angle from two camera directions and explain.</li><li><b>Compare</b>: five checks, then the reference model.</li></ol>`,
   key:()=>{const m=MOLECULES[$('species')?.value];if(!m)return '';const f=caseFacts(m),net=netOptions(m).find(([k])=>k===m.net)?.[1]||'';
    return `<b>${esc(m.formula)}</b>: ${f.domains} domains · ${esc(f.electron.toLowerCase())} electron geometry · ${esc(m.shape.toLowerCase())} · ${esc(net)}.<br>${esc(m.real)}`;},
   extra:()=>`<h3>Mix-ups the checks already diagnose</h3><ul><li>Counting a double or triple bond as more than one domain.</li><li>Naming the shape from the electron geometry when lone pairs are present.</li><li>Lone pairs in axial sites (five domains) or next to each other (six domains).</li><li>Reading the on-screen angle as the 3D angle.</li></ul>`},
  builder:{
   intro:()=>`<p>Build a molecule · advanced bench</p><h3>Learning goal</h3><p>Build a structure atom by atom: place every atom, bond order and lone pair, then read the local shape at each center.</p>
    <h3>What students do</h3><ol><li><b>Place</b> atoms on snap rings. Rings mark the ideal VSEPR directions.</li><li><b>Complete</b> each atom with the right bond orders and lone pairs.</li><li><b>Check construction</b>: atom inventory, connectivity, bond orders, lone pairs, then each center.</li></ol>
    <p>Ionic compounds and Electron transfer count ions and charges. Free construction has no check.</p>`,
   key:async()=>{const {CHALLENGES}=await import('./challenges.js');const c=CHALLENGES[$('bench-select')?.value];
    return c?`<b>${esc(c.formula)}</b> · ${esc(c.name)}<br>${esc(c.real)}`:'This bench has no single answer. The task panel shows the formula and charge balance as students build.';}},
  reaction:{
   intro:()=>`<p>Reactions · atom accounting</p><h3>Learning goal</h3><p>Follow every atom from reactants to products and see that atoms and charge are conserved while connections change.</p>
    <h3>What students do</h3><ol><li><b>Prepare</b>: load the reactants, or build them atom by atom.</li><li><b>React</b>: play, or step through five views.</li><li><b>Observe</b>: compare the inventory and follow one atom by its ID.</li></ol>
    <p>The model shows atom accounting, not a molecular mechanism. Playback speed is not reaction rate.</p>`,
   key:()=>{const root=$('reaction-mode')?.shadowRoot,text=id=>root?.getElementById(id)?.textContent.trim()||'';
    const eq=text('detail-equation');if(!eq)return 'Choose a reaction to see its balanced equation here.';
    const net=text('net-ionic'),lesson=text('lesson'),cond=text('conditions');
    return `<b>${esc(eq)}</b>${net?'<br>'+esc(net):''}${lesson?'<br>'+esc(lesson):''}${cond?'<br>'+esc(cond):''}`;}}
 };
 let teacherRun=0;
 async function renderTeacher(){
  if(teacher.d.hidden)return;
  const t=teachers[mode()]||teachers.guided,run=++teacherRun;
  $('ms-teacher-mode').innerHTML=t.intro?.()||'';$('ms-teacher-extra').innerHTML=t.extra?.()||'';
  if($('ms-key-toggle').checked){let key='';try{key=await t.key?.()||'';}catch{key='The answer key is not available for this task.';}if(run===teacherRun)$('ms-key').innerHTML=key;}
  $('ms-key').hidden=!$('ms-key-toggle').checked;
 }
 teacher.d.addEventListener('ms-open',renderTeacher);
 teacherOpen.addEventListener('click',e=>openDrawer('ms-teacher-drawer',e.currentTarget));
 $('ms-projector').addEventListener('change',e=>{document.documentElement.classList.toggle('projector',e.target.checked);});
 $('ms-key-toggle').addEventListener('change',renderTeacher);
 for(const type of ['change','b06-shapes','b06-reaction'])document.addEventListener(type,e=>{if(type==='change'&&e.target.closest?.('.ms-drawer'))return;if(!teacher.d.hidden)queueMicrotask(renderTeacher);});

 // ---------- Hand building layout ----------
 // While hands are tracked (main.hands-on) in a mode listed here, main gets .ms-hand-layout and
 // html gets .ms-hands: kit on the left edge, task tiles on the right edge, a dark hand bar at the
 // foot and nothing to press along the top. Reactions runs its own camera session inside its shadow
 // root and marks it with main.rx-hands (and main.rx-immersive for its own Immerse).
 const HAND_LAYOUT=new Set(['guided','builder','reaction']);
 const bar=main.querySelector('.hand-bar');
 if(bar&&!bar.querySelector('.ms-hcoach')){
  const status=bar.querySelector('[role=status]'),coach=make('div',{class:'ms-hcoach'});
  status.before(coach);
  coach.append(status,make('small',{class:'ms-hhint'},'Open palm aims · close to grab or press · open to let go or select · two closed hands spread to zoom · say “Rotate”, “Fit”, “Zoom in”'));
  const stop=bar.querySelector('[data-stop]');
  if(stop){stop.append(make('span',{class:'ms-stop-label'},'Exit hand building'));stop.setAttribute('aria-label','Exit hand building');stop.title='Exit hand building';}
 }
 // At 900px and below the page is one scrolling column; the hand layout needs a wide screen.
 const narrow=matchMedia('(max-width:900px)');
 function syncHands(){
  const c=main.classList,on=(mode()==='reaction'?c.contains('rx-hands')&&!c.contains('rx-immersive'):c.contains('hands-on')&&!c.contains('immersive'))&&HAND_LAYOUT.has(mode())&&!narrow.matches;
  if(main.classList.contains('ms-hand-layout')===on)return;
  main.classList.toggle('ms-hand-layout',on);document.documentElement.classList.toggle('ms-hands',on);
  // Drawers and the More menu are opened from the top bar and footer, which hands cannot reach.
  if(on){closeDrawers(false);setMenu(false);}
 }
 // More > Immerse shows the Immerse of the current mode: Reactions has its own (main.rx-immersive).
 function syncImmerse(){
  if(!immerse)return;const c=main.classList,on=String(mode()==='reaction'?c.contains('rx-immersive'):c.contains('immersive'));
  if(immerse.getAttribute('aria-pressed')!==on)immerse.setAttribute('aria-pressed',on);
 }
 new MutationObserver(()=>{syncHands();syncImmerse();syncMore();}).observe(main,{attributes:true,attributeFilter:['class','data-mode']});
 syncHands();syncImmerse();

 // ---------- Narrow screens ----------
 // Teacher view moves into More so every top-bar action stays reachable; the icon buttons stay
 // in the bar and the mode tabs scroll sideways (CSS). For the stacked Shapes column, --ms-headh is the stage head
 // height (it scrolls away while the model stays pinned) and --ms-stick the pinned height, which
 // keeps a focused step heading from hiding under the model.
 const moved=[teacherOpen];
 function showTab(){
  const tab=switcher?.querySelector('[aria-selected=true]');if(!tab||!narrow.matches)return;
  const r=tab.getBoundingClientRect(),q=switcher.getBoundingClientRect();
  if(r.left<q.left)switcher.scrollLeft-=q.left-r.left+8;else if(r.right>q.right)switcher.scrollLeft+=r.right-q.right+8;
 }
 function syncNarrow(){
  const n=narrow.matches;
  if(n&&moved.some(b=>b.parentElement!==menu)){
   for(const b of moved){b.classList.remove('ms-ghost');b.classList.add('ms-menu-item');}
   menu.prepend(...moved);
  }else if(!n&&moved.some(b=>b.parentElement===menu)){
   for(const b of moved){b.classList.remove('ms-menu-item');b.classList.add('ms-ghost');moreWrap.before(b);}
  }
  placeCoach();syncMore();syncHands();measure();showTab();
 }
 const head=$('ms-stagehead'),visual=$('visual');
 // Shapes: on a wide screen the coach line is an info card in the kit column under the pieces, so
 // its row goes to the model (user round B6); in the stacked column it stays under the view tools.
 // The node moves (not a copy), so its live regions and the hand bar mirror keep working.
 const coach=$('ms-coach'),tray=$('tray'),viewbar=$('ms-viewbar');
 function placeCoach(){
  if(!coach||!tray||!viewbar)return;
  if(narrow.matches){if(coach.previousElementSibling!==viewbar)viewbar.after(coach);}
  else if(coach.parentElement!==tray)tray.insertBefore(coach,tray.querySelector(':scope > .ms-kitview'));
 }
 function measure(){
  const on=narrow.matches&&mode()==='guided',h=on?head.offsetHeight:0,stick=on?Math.max(0,visual.offsetHeight-h):0;
  if(main.style.getPropertyValue('--ms-headh')!==h+'px')main.style.setProperty('--ms-headh',h+'px');
  if(main.style.getPropertyValue('--ms-stick')!==stick+'px')main.style.setProperty('--ms-stick',stick+'px');
 }
 new ResizeObserver(measure).observe(head);new ResizeObserver(measure).observe(visual);
 narrow.addEventListener('change',syncNarrow);
 // A new step moves focus to its heading without scrolling; on a narrow screen bring it into view
 // just under the pinned model.
 rail.addEventListener('focusin',e=>{if(narrow.matches&&e.target.matches?.('[data-step] > h2'))e.target.scrollIntoView({block:'start'});});
 syncNarrow();

 // ---------- Mode changes ----------
 let immersed=main.classList.contains('immersive');
 let shown=mode();
 function syncMode(){
  syncBack();syncRail();
  // The stacked column scrolls only in Shapes; another mode starts at the top.
  if(mode()!==shown){shown=mode();main.scrollTop=0;measure();showTab();}
  for(const {d} of drawers.values())if(!d.hidden&&d.dataset.b06Mode&&d.dataset.b06Mode!==mode())closeDrawers(false);
  renderTeacher();
  const now=main.classList.contains('immersive');
  if(immersed&&!now&&(!document.activeElement||document.activeElement===document.body))(immerse||moreOpen).focus({preventScroll:true});
  immersed=now;if(now)closeDrawers(false);
 }
 document.addEventListener('b06-mode',syncMode);
 syncMode();

 window.b06Studio={
  mode,openDrawer,closeDrawers,
  registerTeacher(name,spec){teachers[name]={...teachers[name],...spec};renderTeacher();},
  drawer:id=>drawers.get(id)?.body||null,
  // Phase 2+: a mode adds its own drawer (Builder Help) with an opener that tracks aria-expanded.
  addDrawer(id,heading,owner,from){
   if(drawers.has(id))return drawers.get(id).body;
   const d=drawer(id,heading,owner);
   if(from){openers[id]=from;from.setAttribute('aria-expanded','false');from.setAttribute('aria-controls',id);from.addEventListener('click',e=>openDrawer(id,e.currentTarget));}
   return d.body;
  },
 };
 document.dispatchEvent(new Event('b06-studio-ready'));
}
if(main.dataset.b06Shell)setup();
else document.addEventListener('lab-workspace-ready',()=>queueMicrotask(setup),{once:true});
