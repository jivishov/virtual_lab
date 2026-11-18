import {TYPES,SPECIES,REACTIONS,sub,sideText,equation,clone,empty,counts,batch,arrange,validate,annotate,particleSummary,totalCharge,equationTemplate,arrangeEquationReactants,planReaction,frame,atomRadius} from './reaction-model.js';
import {periodicTable} from './periodic-elements.js';
import {ELEMENTS} from './molecule-model.js';
import {installReactionExperience} from './reaction-experience.js?v=20261118-u1';
import {reactionTemplate} from './reaction-template.js?v=20261118-u1';
import {studioCamera} from './studio-camera.js';

// The five views of the real step() stops, named as in the approved mock.
const STOPS=[[0,'Reactants'],[.18,'Bonds marked'],[.5,'Atoms move'],[.9,'New bonds'],[1,'Products']];
const SPEEDS=[.25,.5,1,2];
// Connection signs: the en dash Shapes uses for a single bond (H–C–H), each with a spoken name.
const BONDS=[[1,'–','Single','Single bond'],[2,'=','Double','Double bond'],[3,'≡','Triple','Triple bond'],[0,'···','Ionic','Ionic link']];
const bondSign=order=>{const [,g,,name]=BONDS.find(b=>b[0]===order)||BONDS[0];return `<span role="img" aria-label="${name.toLowerCase()}">${g}</span>`;};
const PHASEWORD={s:'solid',l:'liquid',g:'gas',aq:'dissolved in water'};
const EXTRA_COLORS={Zn:'#98a9bc',Fe:'#b77751',Cu:'#b9784b',Ag:'#bdc9d3'};
const colorFor=el=>ELEMENTS[el]?.color||EXTRA_COLORS[el]||'#88a3a0';
const elementName=el=>periodicTable.find(e=>e.symbol===el)?.name||el;
const HELP=`<h3>Handle the model</h3><ul>
 <li>Drag open space on the model to tilt it a little. Scroll or pinch to zoom.</li>
 <li>With the model selected, the arrow keys tilt it.</li>
 <li>Fit view puts the whole reaction back in view.</li></ul>
 <h3>Run the reaction</h3><ul>
 <li>Load reactants puts the reactant particles on the bench.</li>
 <li>React plays the reaction. Pause stops it so you can look closely. Resume carries on.</li>
 <li>The five views jump to Reactants, Bonds marked, Atoms move, New bonds and Products.</li>
 <li>Step through stops at each of the five views.</li>
 <li>Press an atom on the model to follow it by its ID. Press it again to stop.</li>
 <li>Show products shows the product particles early. The full equation appears when the reaction is done.</li>
 <li>Reset / edit takes you back to the reactants.</li>
 <li>You can choose another reaction at any time from the row above the model.</li></ul>
 <h3>Build by hand</h3><ul>
 <li>Press an element in the kit to add one atom. Other elements has the rest.</li>
 <li>Press two atoms on the model, choose a connection, then press Connect.</li>
 <li>Drag an atom to move it. Arrange tidies the reactants.</li></ul>
 <h3>What this model shows</h3>
 <p>Atom accounting, not a molecular mechanism. Separated atoms are an accounting step, not free atoms. Playback speed is not reaction rate.</p>
 <h3>Hand building</h3>
 <p>Hand building in the top bar starts the camera controls. Open your palm to aim, close and open to press. Close and open on the model to tilt it or to follow an atom.</p>`;

export function installReactionLab(main){
 const panel=document.createElement('section');panel.id='reaction-mode';panel.dataset.b06Mode='reaction';panel.hidden=true;panel.inert=true;
 panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-reaction');
 const root=panel.attachShadow({mode:'open'});
 const sheet=href=>'<link rel="stylesheet" href="'+new URL(href,import.meta.url).href+'">';
 root.innerHTML=sheet('./reaction-ui.css?v=20261115-approved-design')+sheet('./reaction-studio.css?v=20261118-u1')+reactionTemplate;
 const $=id=>root.getElementById(id);
 let active=false,mounted=false,loading=null;
 for(const type of ['click','pointerdown','keydown','input','change'])root.addEventListener(type,event=>{if(!active){event.preventDefault();event.stopImmediatePropagation();}},true);
 // Keep shared studio shortcuts out of this tab's form fields and dialogs.
 root.addEventListener('keydown',event=>event.stopPropagation());
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
let reaction=REACTIONS[0];
let state=empty(),plan=null,progress=0,phase='build',viewer=null,selection=[],history=[],vertical=false,diagram=null,lastTime=0,speed=1;
let shelfOpen=false,shelfFamily=reaction.type,trackedId=null,autoArranged=true,resizeToken=0,lastMessage='',noticeText='',pendingChoice=null,handBuilt=false;
let stepKey='',kitKey='';
let experience=null;
const isBuild=()=>active&&phase==='build';
const editable=()=>isBuild()&&$('manual').open;
const handLayout=()=>panel.hasAttribute('data-hand-layout');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const arrowText=r=>r.reversible?' ⇌ ':' → ';

// One coach line: the guide for the current state, or an amber notice that lasts until the next press.
function renderCoach(){
 const text=noticeText||lastMessage;
 if($('status').textContent!==text)$('status').textContent=text;
 if($('hand-bar-status').textContent!==text)$('hand-bar-status').textContent=text;
 $('coach').classList.toggle('rx-warn',!!noticeText);$('hand-bar').classList.toggle('rx-warn',!!noticeText);
 fitHandStatus();
}
// On short screens the hand bar runs under the kit and the model only, so a long line may need a third line:
// it then takes the place of the hint line (rx-long, reaction-studio.css). Checked again when the bar resizes.
function fitHandStatus(){
 const bar=$('hand-bar'),s=$('hand-bar-status');bar.classList.remove('rx-long');
 if(s.getClientRects().length&&s.scrollHeight>s.clientHeight+1)bar.classList.add('rx-long');
}
function message(text){if(lastMessage===text)return;lastMessage=text;renderCoach();}
function notice(text){noticeText=text;renderCoach();}
function hintPulse(el){if(reduced.matches)return;el.classList.remove('just-enabled');void el.offsetWidth;el.classList.add('just-enabled');setTimeout(()=>el.classList.remove('just-enabled'),650);}
// The reaction shelf: a chooser over the model for hand building and Immerse.
// While it is open only its own tiles work (a hand aims inside it): everything else is made inert and dimmed,
// so nothing looks pressable that is not. Close (a 60 px tile) or Escape closes it. Status lines stay live.
const SHELF_OFF=['#kit','#stagehead','#viewbar','#observation-rail','#foot','#hand-bar>button','.experience-tools','.hand-navigation','.hand-session-actions','#immersive-playback>button','#immersive-playback>input','#reaction-stage'];
let shelfOff=[];
function renderShelf(){
 $('shelf').hidden=!shelfOpen;
 for(const el of shelfOff){el.inert=false;el.classList.remove('rx-shelf-off');}
 shelfOff=shelfOpen?[...root.querySelectorAll(SHELF_OFF.join(','))].filter(el=>!el.inert):[];
 for(const el of shelfOff){el.inert=true;el.classList.add('rx-shelf-off');}
 for(const b of root.querySelectorAll('[data-shelf]'))b.setAttribute('aria-expanded',String(shelfOpen));
 if(!shelfOpen)return;
 $('shelf-families').innerHTML=TYPES.map(([id,name])=>`<button type="button" class="rx-tile" data-shelf-family="${id}" aria-pressed="${id===shelfFamily}">${name}</button>`).join('');
 $('shelf-cards').innerHTML=REACTIONS.filter(r=>r.type===shelfFamily).map(r=>`<button type="button" class="rx-tile" data-reaction="${r.id}" aria-pressed="${r.id===reaction.id}"><b>${escape(r.name)}</b><span>${escape(sideText(r.reactants))}${arrowText(r)}?</span></button>`).join('');
}
function setLibrary(open,{focus=false}={}){
 if(open&&phase==='running'){phase='paused';draw();}
 if(open&&!shelfOpen)shelfFamily=reaction.type;
 shelfOpen=open;renderShelf();
 if(focus&&open)$('shelf-title').focus({preventScroll:true});
 else if(focus&&!open){const back=root.querySelector('[data-shelf]:not([hidden])');const opener=[...root.querySelectorAll('[data-shelf]')].find(b=>b.getClientRects().length);(opener||back)?.focus({preventScroll:true});}
}
function chooseLayout(){
 const w=$('reaction-stage').clientWidth||800,h=$('reaction-stage').clientHeight||600;
 const options=[false,true].map(v=>{const t=equationTemplate(reaction,{vertical:v});return {vertical:v,template:t,scale:Math.min((w-40)/t.diagram.width,Math.max(150,h-180)/t.diagram.height)};});
 const preferred=w<660?options[1]:options.reduce((a,b)=>b.scale>a.scale*1.04?b:a);
 vertical=preferred.vertical;diagram=preferred.template.diagram;return preferred.template;
}
function resetLabels(){trackedId=null;selection=[];$('ids').checked=false;viewer?.setIds(false);viewer?.trackAtom(null);$('track').value='';setTrackNote();}
function syncAtomControls(){
 $('track').innerHTML='<option value="">Choose an atom</option>'+state.atoms.map(a=>`<option value="${a.id}">${a.el} ${a.id}</option>`).join('');
 if(state.atoms.some(a=>a.id===trackedId))$('track').value=String(trackedId);else trackedId=null;
 $('build-atoms').innerHTML=state.atoms.map(a=>`<button type="button" data-atom="${a.id}" aria-pressed="${selection.includes(a.id)}">${a.el} ${a.id}</button>`).join('');
 $('track-atoms').innerHTML=state.atoms.map(a=>`<button type="button" data-track-atom="${a.id}" aria-pressed="${trackedId===a.id}">${a.el} ${a.id}</button>`).join('');
}
function catalog(){
 const focused=root.activeElement,refocus=focused?.closest('#stagehead')?(focused.dataset.reaction?`[data-reaction="${reaction.id}"]`:focused.dataset.family?`[data-family="${reaction.type}"]`:null):null;
 $('families').innerHTML=TYPES.map(([id,name])=>`<label><input type="radio" name="family" value="${id}" ${reaction.type===id?'checked':''}>${name}</label>`).join('');
 const examples=REACTIONS.filter(r=>r.type===reaction.type);
 $('example').innerHTML=examples.map((r,i)=>`<option value="${r.id}" ${r.id===reaction.id?'selected':''}>${i+1}. ${escape(r.name)}</option>`).join('');
 $('example-count').textContent=(examples.findIndex(r=>r.id===reaction.id)+1)+' of 5';
 $('family-pills').innerHTML=TYPES.map(([id,name,about])=>`<button type="button" data-family="${id}" aria-pressed="${id===reaction.type}" title="${escape(about)}">${name}</button>`).join('');
 $('example-buttons').innerHTML=examples.map(r=>`<button type="button" data-reaction="${r.id}" aria-pressed="${r.id===reaction.id}" title="${escape(r.name)}"><span>${escape(r.name)}</span><small>${escape(sideText(r.reactants))}${arrowText(r)}?</small></button>`).join('');
 if(refocus)$('stagehead').querySelector(refocus)?.focus({preventScroll:true});
 $('family-description').textContent=TYPES.find(t=>t[0]===reaction.type)[2];
 $('reaction-title').textContent=reaction.name;$('recipe').textContent=sideText(reaction.reactants,true);
 $('reactant-terms').innerHTML=reaction.reactants.map(([id,n,p])=>{const name=SPECIES[id]?.name;return `<div class="rx-term">${n} × ${sub(id)}<small>${name&&name!==id?escape(name)+(p?' · ':''):''}${p?PHASEWORD[p]||p:''}</small></div>`;}).join('');
 $('details-title').textContent=reaction.name;$('detail-family').textContent=TYPES.find(t=>t[0]===reaction.type)[1];
 $('conditions').textContent=reaction.condition;$('lesson').textContent=reaction.lesson;$('conditions-line').textContent=reaction.condition;
 const hasSolid=[...reaction.reactants,...reaction.products].some(([id,,p])=>p==='s'&&SPECIES[id].kind==='ionic');
 const representation=[reaction.netIonic?'Solution view: separate ions; solvent water omitted.':'Molecular equation with reaction-specific physical states.',hasSolid?'Dashed links are solid formula-unit samples, not covalent bonds.':'',reaction.reversible?'One forward event is shown; equilibrium conversion is not predicted.':''].filter(Boolean).join(' ');
 $('representation-note').textContent=representation;$('detail-representation').textContent=representation;
 const guide=reaction.reactants.map(entry=>{const [id,n,p]=entry,s=batch([[id,1,p]]),label=i=>s.atoms.find(a=>a.id===i).el+i;return `<p><strong>${n} × ${sub(id)}(${p})</strong><br>${escape(particleSummary(s.particles))}<br>${s.bonds.map(b=>label(b.a)+' '+bondSign(b.order)+' '+label(b.b)).join('; ')||'Leave particles separate; no connections.'}</p>`;}).join('');
 $('connection-guide').innerHTML=guide;$('detail-guide').innerHTML=guide;
 const needed=counts(batch(reaction.reactants).atoms);
 for(const b of $('element-choices').children)b.classList.toggle('needed',!!needed[b.dataset.element]);
 kitKey='';renderShelf();
 if(active)document.dispatchEvent(new Event('b06-reaction'));
}
function renderKit(){
 const need=counts(batch(reaction.reactants).atoms),have=counts(state.atoms),build=isBuild(),hand=handLayout();
 const key=JSON.stringify([reaction.id,have,build]);if(key===kitKey)return;kitKey=key;
 $('kit-elements').innerHTML=Object.keys(need).map(el=>`<button type="button" class="rx-el need" data-element="${el}" ${build?'':'disabled'} aria-label="Add ${escape(elementName(el))}. ${have[el]||0} of ${need[el]} placed"><span><i class="rx-dot" style="background:${colorFor(el)}"></i>${el}</span><small>${have[el]||0}${hand?'/':' of '}${need[el]}</small></button>`).join('');
}
function updateEquation(){
 const reveal=$('reveal').checked||progress>=1;
 const text=reveal?equation(reaction):sideText(reaction.reactants,true)+arrowText(reaction)+'?';
 if($('equation').textContent!==text){$('equation').textContent=text;$('detail-equation').textContent=text;}
 $('net-ionic-section').hidden=!reaction.netIonic||!reveal;$('net-ionic').textContent=reaction.netIonic||'';
}
function setPressed(selector,test){for(const b of root.querySelectorAll(selector)){const v=String(!!test(b));if(b.getAttribute('aria-pressed')!==v)b.setAttribute('aria-pressed',v);}}
function setTrackNote(){
 const a=state.atoms.find(x=>x.id===trackedId);
 $('tracking-note').innerHTML=a?`Following <b>${a.el} ${a.id}</b> through this reaction. Press it again to stop.`:'<b>Track one atom:</b> press it on the model.';
}
function draw(){
 const shown=plan?frame(plan,progress):{...annotate(state,reaction),diagram};
 viewer?.update(shown,selection,{showProducts:$('reveal').checked||progress>=.76,progress});
 const arrow=$('reaction-stage').querySelector('.rx-equation-arrow small');if(arrow)arrow.textContent=reaction.reversible?'forward event':'same atoms';
 const check=validate(state,reaction),ready=!plan&&check.ok,hasAtoms=state.atoms.length>0,build=phase==='build',manual=$('manual').open,stepped=$('stepped').checked;
 $('empty-state').hidden=hasAtoms;
 $('empty-copy').textContent=manual?'Add atoms from the kit, then connect them.':'Load them from the task panel, or build them by hand.';
 $('load').textContent=hasAtoms?'Reload reactants':'Load reactants';
 $('left-caption').textContent=progress>0?'Initial inventory · formula reference':reaction.netIonic?'Dissolved ions remain separate':'Starting particles';
 $('right-caption').textContent=progress>=1?'Same IDs · new arrangement':'Made from the same atoms';
 // Steps: Prepare, React, Observe.
 const stage=build?0:phase==='complete'?2:1,key=stage+':'+ready;
 if(key!==stepKey){stepKey=key;[...$('steps').children].forEach((li,i)=>{const done=i<stage||(i===0&&ready)||(i===2&&stage===2);li.classList.toggle('done',done);if(i===stage)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');li.querySelector('i').textContent=done?'✓':String(i+1);});}
 // Task: Prepare (with Build by hand inside it), or the playback controls.
 if($('task-build').hidden===build){$('task-build').hidden=!build;$('task-play').hidden=build;}
 $('task-manual').hidden=!manual;$('manual-toggle').setAttribute('aria-pressed',String(manual));$('task-build').classList.toggle('rx-manual-on',manual);
 $('kit-atoms').hidden=!(manual&&build);$('kit').classList.toggle('rx-building',manual&&build);
 const slot=root.querySelector(`[data-acct=${build?'build':'play'}]`);if($('accounting').parentElement!==slot)slot.append($('accounting'));
 renderKit();
 // One main button. While it cannot act, it stays focusable and says why.
 const label=phase==='stopped'?'Reset reactants':phase==='running'?'Pause':phase==='complete'?'Replay':stepped?'Next view':phase==='paused'?'Resume':'React';
 if($('play').dataset.label!==label){$('play').dataset.label=label;$('play').innerHTML=escape(label)+(label==='React'?' <span aria-hidden="true">▶</span>':'');}
 const blocked=build&&!ready;
 $('play').disabled=!active||!viewer;$('play').setAttribute('aria-disabled',String(blocked));
 const why=blocked?(hasAtoms?check.message:'Load reactants to begin.'):'';
 if($('why').textContent!==why)$('why').textContent=why;
 if(blocked)$('play').setAttribute('aria-describedby','why');else $('play').removeAttribute('aria-describedby');
 $('reset').hidden=build;$('reset').disabled=!plan||phase==='stopped';
 $('progress').disabled=!plan||phase==='stopped';$('progress').value=Math.round(progress*1000);$('progress-value').textContent=Math.round(progress*100)+'%';
 $('phase-label').textContent=plan?shown.phase:ready?'Ready to react':'Starting particles';
 $('progress').setAttribute('aria-valuetext',Math.round(progress*100)+' percent; '+$('phase-label').textContent);
 $('phase-note').textContent=plan?shown.note:'';
 const stop=progress<.06?0:progress<.24?1:progress<.76?2:progress<.96?3:4;
 setPressed('[data-stop]',b=>STOPS.findIndex(s=>String(s[0])===b.dataset.stop)===stop);
 setPressed('[data-speed]',b=>+b.dataset.speed===speed);for(const b of root.querySelectorAll('[data-speed]'))b.disabled=stepped;
 setPressed('[data-stepped]',()=>stepped);setPressed('[data-reveal]',()=>$('reveal').checked);setPressed('[data-ids]',()=>$('ids').checked);
 setPressed('[data-bond]',b=>root.querySelector('[name=bond]:checked')?.value===b.dataset.bond);
 setPressed('#hand-move-tile',()=>$('hand-move').getAttribute('aria-pressed')==='true');
 $('speed').disabled=stepped;$('track').disabled=!hasAtoms;
 $('conserved').textContent=plan?state.atoms.length+' atoms → '+shown.atoms.length+' atoms':state.atoms.length+' atoms on bench';
 $('inventory').textContent=Object.entries(counts(state.atoms)).map(([el,n])=>el+' '+n).join(' · ')||'No atoms loaded';
 $('charge').hidden=!reaction.netIonic||!hasAtoms;$('charge').textContent=plan?'Net charge: '+totalCharge(plan.start)+' → '+totalCharge(plan.end)+' (endpoints)':'Net charge: '+totalCharge(shown);
 $('particles').textContent=shown.particles?.length?particleSummary(shown.particles):hasAtoms?'Particle identities are shown at the endpoints.':'Load reactants to inspect particles.';
 for(const e of root.querySelectorAll('#load,#manual-toggle,#add-atoms,[name=bond],[data-bond],#kit-elements button'))e.disabled=!isBuild();
 $('connect').disabled=!isBuild()||selection.length!==2;$('disconnect').disabled=!isBuild()||selection.length!==2;$('delete-atoms').disabled=!isBuild()||!selection.length;$('undo').disabled=!isBuild()||!history.length;
 $('arrange').disabled=!isBuild()||!hasAtoms;$('clear').disabled=!isBuild()||!hasAtoms;
 for(const p of root.querySelectorAll('[data-proxy]')){const t=$(p.dataset.proxy);if(t&&p.disabled!==t.disabled)p.disabled=t.disabled;}
 $('selection-note').textContent=selection.length?'Selected: '+selection.map(id=>{const a=state.atoms.find(a=>a.id===id);return a.el+' '+id;}).join(' + ')+(selection.length===1?'. Press one more atom.':''):'Press two atoms on the model to connect them.';
 setPressed('#build-atoms [data-atom]',b=>selection.includes(+b.dataset.atom));setPressed('#track-atoms [data-track-atom]',b=>trackedId===+b.dataset.trackAtom);
 if(phase==='build')message(!hasAtoms?'Load reactants to begin.':ready?'Ready. Follow the same atoms.':check.message);
 else if(phase==='running')message('Watch the atoms. Pause to inspect.');
 else if(phase==='paused')message(stepped?'Inspect this view, then choose Next view.':'Paused. Inspect, then resume.');
 else if(phase==='stopped')message('Stopped. Restore reactants to continue.');
 else message('Every product atom came from the reactants.');
 if(active){const s=main.querySelector('#ms-handsub'),t='Hand building · Reactions · '+reaction.name;if(s&&s.textContent!==t)s.textContent=t;}
 updateEquation();
 experience?.sync();
}
function choose(id){if(!isBuild())return;experience?.resetInput();reaction=REACTIONS.find(r=>r.id===id)||REACTIONS[0];state=empty();plan=null;history=[];progress=0;autoArranged=true;handBuilt=false;pendingChoice=null;resetLabels();$('reveal').checked=false;chooseLayout();catalog();syncAtomControls();draw();viewer?.fit();}
// Another reaction can be chosen at any time: playback goes back to Reset / edit first, and atoms
// built by hand are only replaced after a second press of the same choice.
function chooseAny(id){
 if(!active)return;
 const next=REACTIONS.find(r=>r.id===id);if(!next)return;
 if(next.id===reaction.id){pendingChoice=null;if(shelfOpen)setLibrary(false,{focus:true});return;}
 if(handBuilt&&state.atoms.length&&pendingChoice!==next.id){pendingChoice=next.id;notice('Choosing '+next.name+' replaces the atoms you built. Press it again to choose it.');return;}
 pendingChoice=null;
 if(phase!=='build')reset();
 if(phase!=='build')return;
 const fromShelf=shelfOpen;choose(next.id);
 if(fromShelf)setLibrary(false,{focus:true});
}
function load({collapse=true}={}){
 if(!isBuild())return;experience?.resetInput();plan=null;progress=0;history=[];handBuilt=false;resetLabels();$('reveal').checked=false;state=chooseLayout().start;autoArranged=true;
 syncAtomControls();draw();viewer?.fit();
 if(collapse&&shelfOpen)setLibrary(false);
 requestAnimationFrame(()=>{if(collapse)experience?experience.focusPlay():$('play').focus({preventScroll:true});hintPulse($(experience?.isImmersive()?'imm-play':'play'));});
}
function createPlan(){if(!active)return false;if(plan)return true;const validation=validate(state,reaction);if(!validation.ok){notice(validation.message);return false;}arrangeEquationReactants(state,reaction,{vertical});plan=planReaction(state,reaction,{equationLayout:true,vertical});selection=[];viewer?.fit(plan.bounds);syncAtomControls();return true;}
function step(){if(!createPlan())return;progress=STOPS.map(s=>s[0]).find(p=>p>progress+.001)??1;phase=progress>=1?'complete':'paused';draw();}
function goStop(p){if(!active)return;experience?.resetInput();if(!createPlan())return;progress=p;phase=progress>=1?'complete':'paused';draw();}
function play(){
 if(!active)return;
 experience?.resetInput();
 if(phase==='stopped'){reset();return;}
 if(phase==='running'){phase='paused';draw();return;}
 if(phase==='build'){const check=validate(state,reaction);if(!check.ok){notice(state.atoms.length?check.message:'Load reactants to begin.');return;}}
 if(phase==='complete'){progress=0;phase='paused';}
 if(!createPlan())return;
 if($('stepped').checked){step();return;}
 phase='running';lastTime=performance.now();draw();
}
function reset(){if(!active||!plan)return;const refocus=root.activeElement===$('reset');experience?.resetInput();state=clone(plan.start);plan=null;progress=0;phase='build';history=[];resetLabels();$('reveal').checked=false;chooseLayout();arrangeEquationReactants(state,reaction,{vertical});autoArranged=true;syncAtomControls();draw();viewer?.fit();if(refocus)$('play').focus({preventScroll:true});}
function stash(){if(!isBuild())return;history.push(clone(state));if(history.length>40)history.shift();}
function edited(){plan=null;phase='build';progress=0;selection=selection.filter(id=>state.atoms.some(a=>a.id===id));syncAtomControls();draw();}
function selectAtom(id){if(!editable())return;selection=selection.includes(id)?selection.filter(x=>x!==id):[...selection.slice(-1),id];draw();}
function track(id){trackedId=id;viewer?.trackAtom(id);$('track').value=id===null?'':String(id);setTrackNote();setPressed('#track-atoms [data-track-atom]',b=>trackedId===+b.dataset.trackAtom);}
function pauseForDialog(){if(phase==='running'){phase='paused';draw();}}
function openDialog(id){if(!active)return;experience?.resetInput();pauseForDialog();$(id).showModal();}
function openAtoms(){if(!isBuild())return;$('manual').open=true;draw();openDialog('atom-dialog');}
// A new atom goes to the first spot of the reactant-side grid (4 across, 1.55 apart) that no atom is near,
// so it never lands on another atom. The camera stays where the student left it: when the new atom is
// outside the view, the coach says so and Fit view brings it in.
function freeSpot(el){
 const r=atomRadius(el),cx=diagram.reactants.center,spot=k=>[cx+(k%4-1.5)*1.55,(1-Math.floor(k/4))*1.55,0];
 for(let k=0;k<400;k++){const p=spot(k);if(state.atoms.every(a=>Math.hypot(a.p[0]-p[0],a.p[1]-p[1],a.p[2]-p[2])>=r+atomRadius(a.el)+.25))return p;}
 return spot(state.atoms.length);
}
function atomInView(id){
 const s=$('reaction-stage'),a=viewer?.getProjectedAtoms().find(x=>x.id===id);
 return !viewer||!!a&&a.x>=0&&a.y>=0&&a.x<=s.clientWidth&&a.y<=s.clientHeight;
}
function addAtom(el,say=()=>{}){
 if(!isBuild())return;
 if(state.atoms.length>=64){say('The bench holds up to 64 atoms.');return;}
 if(!$('manual').open)$('manual').open=true;
 stash();autoArranged=false;handBuilt=true;
 const id=state.nextId++;state.atoms.push({id,el,p:freeSpot(el)});
 selection=[id];edited();
 const seen=atomInView(id);
 say('Added '+el+' '+id+'. '+state.atoms.length+' atoms on the bench.'+(seen?'':' It is outside the view. Press Fit view to see it.'));
 if(!seen)notice('Added '+el+' '+id+' outside the view. Press Fit view to see it.');
}
function resize(){
 if(!active)return;
 cancelAnimationFrame(resizeToken);resizeToken=requestAnimationFrame(()=>{if(!isBuild())return;const old=vertical;chooseLayout();if(old!==vertical&&autoArranged&&state.atoms.length)arrangeEquationReactants(state,reaction,{vertical});draw();viewer?.fit();});
}
const toggle=(id,event='change')=>{const el=$(id);el.checked=!el.checked;el.dispatchEvent(new Event(event,{bubbles:true}));};

// Static button groups: bond orders, the five views, playback speeds.
$('bond-buttons').innerHTML=BONDS.map(([o,g,t,name])=>`<button type="button" data-bond="${o}" aria-pressed="${o===1}" aria-label="${name}"><b aria-hidden="true">${g}</b><small aria-hidden="true">${t}</small></button>`).join('');
$('stops').innerHTML=STOPS.map(([p,t],i)=>`<button type="button" data-stop="${p}" aria-pressed="${i===0}" aria-label="View ${i+1}: ${t}"><b>${i+1}</b>${t}</button>`).join('');
const speedButtons=cls=>SPEEDS.map(s=>`<button type="button" ${cls} data-speed="${s}" aria-pressed="${s===1}" aria-label="Playback speed ${s} times">${s}×</button>`).join('');
$('speeds').innerHTML=speedButtons('');$('hand-speeds').innerHTML=speedButtons('class="rx-tile"');

// A press anywhere ends the last notice; a pending replace waits only for a second press of its choice.
root.addEventListener('click',e=>{
 if(!active)return;
 const target=e.target.closest?.('button,input,summary');if(!target)return;
 if(!target.closest('[data-reaction],[data-family],#example,#families'))pendingChoice=null;
 if(noticeText){noticeText='';renderCoach();}
},true);
root.addEventListener('click',e=>{
 if(!active)return;
 const b=e.target.closest?.('button');if(!b||b.disabled)return;
 const d=b.dataset;
 if('proxy' in d){$(d.proxy)?.click();return;}
 if('reaction' in d){chooseAny(d.reaction);return;}
 if('family' in d){chooseAny(REACTIONS.find(r=>r.type===d.family).id);return;}
 if('shelfFamily' in d){shelfFamily=d.shelfFamily;renderShelf();root.querySelector(`[data-shelf-family="${shelfFamily}"]`)?.focus({preventScroll:true});return;}
 if('shelf' in d){setLibrary(!shelfOpen,{focus:true});return;}
 if('stop' in d){goStop(+d.stop);return;}
 if('speed' in d){$('speed').value=d.speed;$('speed').dispatchEvent(new Event('input',{bubbles:true}));draw();return;}
 if('stepped' in d){toggle('stepped');return;}
 if('reveal' in d){toggle('reveal');return;}
 if('ids' in d){toggle('ids');draw();return;}
 if('bond' in d){const r=root.querySelector(`[name=bond][value="${d.bond}"]`);if(r&&!r.disabled){r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));draw();}return;}
 if('element' in d&&b.closest('#kit-elements')){addAtom(d.element);return;}
 if('trackAtom' in d){const id=+d.trackAtom;track(trackedId===id?null:id);return;}
});
$('shelf-close').onclick=()=>setLibrary(false,{focus:true});
$('families').onchange=e=>chooseAny(REACTIONS.find(r=>r.type===e.target.value).id);$('example').onchange=e=>chooseAny(e.target.value);
$('load').onclick=()=>load();$('play').onclick=play;$('reset').onclick=reset;
$('manual-toggle').onclick=()=>{if(!isBuild())return;$('manual').open=!$('manual').open;if(!$('manual').open)selection=[];draw();};
$('hand-move-tile').onclick=()=>$($('hand-move').getAttribute('aria-pressed')==='true'?'hand-rotate':'hand-move').click();
$('progress').oninput=e=>{if(!plan)return;progress=+e.target.value/1000;phase=progress===1?'complete':'paused';draw();};
$('speed').oninput=e=>{speed=+e.target.value;$('speed-value').textContent=speed+'×';};
$('stepped').checked=reduced.matches;$('stepped').onchange=()=>{if(phase==='running')phase='paused';draw();};
reduced.addEventListener('change',e=>{if(e.matches){$('stepped').checked=true;if(phase==='running')phase='paused';draw();}});
$('reveal').onchange=draw;$('ids').onchange=e=>viewer?.setIds(e.target.checked);$('fit').onclick=()=>viewer?.fit(plan?.bounds||state.atoms);
const controls=()=>window.__freeControls?.find(c=>c.element===$('reaction-stage'));
$('turn-left').onclick=()=>controls()?.rotate(-.12,0);$('turn-right').onclick=()=>controls()?.rotate(.12,0);
$('zoom-out').onclick=()=>viewer?.zoom(.9);$('zoom-in').onclick=()=>viewer?.zoom(1.1);
$('track').onchange=e=>track(e.target.value?+e.target.value:null);$('details-open').onclick=()=>openDialog('reaction-details');
for(const b of root.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
$('add-atoms').onclick=openAtoms;
const supported=new Set(REACTIONS.flatMap(r=>batch(r.reactants).atoms.map(a=>a.el)));
$('element-choices').innerHTML=periodicTable.filter(e=>supported.has(e.symbol)).map(e=>`<button data-element="${e.symbol}" aria-label="Add ${e.name}"><small>${e.number}</small><strong>${e.symbol}</strong><small>${e.name}</small></button>`).join('');
$('element-choices').onclick=e=>{const b=e.target.closest('[data-element]');if(b)addAtom(b.dataset.element,text=>{$('atom-dialog-status').textContent=text;});};
$('build-atoms').onclick=e=>{const b=e.target.closest('[data-atom]');if(b)selectAtom(+b.dataset.atom);};
$('connect').onclick=()=>{if(!isBuild()||selection.length!==2)return;stash();handBuilt=true;const [a,b]=selection,order=+root.querySelector('[name=bond]:checked').value;state.bonds=state.bonds.filter(e=>!((e.a===a&&e.b===b)||(e.a===b&&e.b===a)));state.bonds.push({a,b,order});selection=[];edited();};
$('disconnect').onclick=()=>{if(!isBuild()||selection.length!==2)return;stash();handBuilt=true;state.bonds=state.bonds.filter(e=>!(selection.includes(e.a)&&selection.includes(e.b)));selection=[];edited();};
$('delete-atoms').onclick=()=>{if(!isBuild()||!selection.length)return;stash();handBuilt=true;state.atoms=state.atoms.filter(a=>!selection.includes(a.id));state.bonds=state.bonds.filter(b=>!selection.includes(b.a)&&!selection.includes(b.b));selection=[];edited();};
$('undo').onclick=()=>{if(!isBuild()||!history.length)return;state=history.pop();selection=[];edited();viewer?.fit();};
$('arrange').onclick=()=>{if(!isBuild())return;stash();chooseLayout();if(!arrangeEquationReactants(state,reaction,{vertical})){arrange(state,2);for(const a of state.atoms)a.p[0]+=diagram.reactants.center;}autoArranged=true;edited();viewer?.fit();};
$('clear').onclick=()=>{if(!isBuild())return;stash();state={...empty(),nextId:state.nextId};resetLabels();edited();};
$('manual').addEventListener('toggle',()=>{if(!$('manual').open)selection=[];draw();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='running'){phase='paused';draw();}});
function tick(now){requestAnimationFrame(tick);if(active&&phase==='running'){progress=Math.min(1,progress+Math.min(.08,(now-lastTime)/1000)*speed/18);if(progress>=1)phase='complete';draw();}lastTime=now;}requestAnimationFrame(tick);

// The top bar's Hand building opens this tab's own camera setup; More > Immerse uses this tab's Immerse.
main.addEventListener('click',e=>{
 if(!active)return;
 const b=e.target.closest?.('#hand-building,#immersive');if(!b)return;
 e.preventDefault();e.stopPropagation();
 const menu=main.querySelector('#ms-more-menu');if(menu&&!menu.hidden)main.querySelector('#ms-more-open')?.click();
 if(b.id==='hand-building')experience?.openHands();else if(!$('immerse').disabled)$('immerse').click();
},true);
// The studio shell sets main.ms-hand-layout while hands are on (wide screens); mirror it on the host.
function syncHandLayout(){
 const on=active&&main.classList.contains('ms-hand-layout');if(panel.hasAttribute('data-hand-layout')===on)return;
 panel.toggleAttribute('data-hand-layout',on);
 // The camera picture is a thumbnail in the hand bar here, and the backdrop of the model in Immerse.
 const picture=root.querySelector('.camera-surface');if(picture)(on?$('hand-bar'):$('scene')).prepend(picture);
 kitKey='';draw();
}
new MutationObserver(syncHandLayout).observe(main,{attributes:true,attributeFilter:['class']});
function hookStudio(){
 const studio=window.b06Studio;if(!studio)return;
 const help=studio.addDrawer('ms-rx-help-drawer','Help','reaction',$('help-open'));if(help&&!help.innerHTML)help.innerHTML=HELP;
 studio.registerTeacher('reaction',{key:()=>`<b>${escape(reaction.name)}</b><br>${escape(equation(reaction))}${reaction.netIonic?'<br>Net ionic: '+escape(reaction.netIonic):''}<br>${escape(reaction.lesson)}<br>${escape(reaction.condition)}`});
}
if(window.b06Studio)hookStudio();else document.addEventListener('b06-studio-ready',hookStudio,{once:true});

function openViewer(){
 if(viewer)return Promise.resolve(viewer);if(loading)return loading;
 $('fatal-error').hidden=true;
 loading=import('./reaction-viewer.js?v=20261118-cb1').then(m=>m.createReactionViewer($('reaction-stage'),{
  editable,select:selectAtom,track,beforeMove:()=>{stash();autoArranged=false;},move:(id,p)=>{if(!editable())return;moveAtom(id,p);}
 })).then(v=>{
  viewer=v;viewer.setActive(active);
  experience=installReactionExperience(root,{isActive:()=>active,immersive:on=>main.classList.toggle('rx-immersive',on),hands:on=>{main.classList.toggle('rx-hands',on);main.querySelector('#hand-building')?.setAttribute('aria-pressed',String(on));},snapshot:()=>({state,phase,libraryOpen:shelfOpen}),projected:()=>viewer.getProjectedAtoms(),atom:id=>state.atoms.find(a=>a.id===id),library:setLibrary,resize,pause:pauseForDialog,play,load,reset,select:selectAtom,editable,track:id=>track(trackedId===id?null:id),beforeMove:()=>{stash();autoArranged=false;},move:moveAtom,cancelMove:(id,p)=>{const a=state.atoms.find(a=>a.id===id);if(a){a.p=p;history.pop();draw();}}});
  $('hands-open').disabled=false;$('immerse').disabled=false;panel.dataset.ready='true';draw();resize();return viewer;
 }).catch(error=>{loading=null;$('fatal-error').hidden=false;$('viewer-error').textContent='The 3D model could not load. Check the connection and retry.';console.error(error);});
 return loading;
}
function moveAtom(id,p){if(!isBuild())return;const a=state.atoms.find(a=>a.id===id);if(!a)return;const r=atomRadius(a.el);p[0]=Math.max(-diagram.width/2+r,Math.min(-diagram.arrowGap/2-r,p[0]));p[1]=Math.max(-diagram.height/2+r,Math.min(diagram.height/2-r,p[1]));a.p=p;draw();}
$('retry-viewer').onclick=()=>{if(active)openViewer();};
function setActive(on){
 if(on&&!active&&studioCamera.has('hands'))studioCamera.release('hands');
 active=on;
 if(!on){pauseForDialog();experience?.deactivate();for(const d of root.querySelectorAll('dialog[open]'))d.close();}
 syncHandLayout();
 panel.hidden=!on;panel.inert=!on;viewer?.setActive(on);renderShelf();
 if(on&&mounted)openViewer();draw();if(on)resize();
}
function mount(){if(mounted)return;mounted=true;main.append(panel);new ResizeObserver(resize).observe($('reaction-stage'));new ResizeObserver(fitHandStatus).observe($('hand-bar'));if(active)openViewer();}
if(main.dataset.workspaceReady)mount();else document.addEventListener('lab-workspace-ready',mount,{once:true});
chooseLayout();catalog();syncAtomControls();draw();
panel.reactionSnapshot=()=>({reaction:reaction.id,phase,progress,speed,active,vertical,libraryOpen:shelfOpen,ids:$('ids').checked,trackedId,selection:[...selection],handBuilt,pendingChoice,notice:noticeText,diagram:clone(plan?.diagram||diagram),state:clone(state),frame:plan?frame(plan,progress):clone(state),meshIds:viewer?.getAtomIds()||[],meshIdentities:viewer?.getAtomIdentities()||[],projectedAtoms:viewer?.getProjectedAtoms()||[],experience:experience?.snapshot()});
panel.reactionHands={probe:(x,y)=>experience?.probe(x,y)||null,tapAt:(x,y)=>experience?.tapAt(x,y)??null,snapshot:()=>experience?.snapshot()||null,projected:()=>viewer?.getProjectedAtoms()||[]};
return {setActive};
}
