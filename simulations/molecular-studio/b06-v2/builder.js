import {ELEMENTS,TRAY_ELEMENTS,EXAMPLES,fresh,clone,atom,environment,formula,components,validate,addAtom,removeAtom,connect,example,materialize,placePair,removePair,spacingError,bondAngle,ANGLE_TOLERANCE,V,hybridization,formalCharge,signed,bondTally,expectedAngles,pairPlacementIssue,snapSites} from './molecule-model.js';
import {bySymbol,periodicTable} from './periodic-elements.js';
import {MAX_ATOMS,ionFor,ionLabel,ionicComposition,atomCharge,particleLabel,transferSummary,addTransfer,transferCapacity} from './ionic-model.js';
import {moveTransferGroup,removeTransferParticle,findTransferSnap} from './ionic-geometry.js';
import {handPlacement} from './hand-placement.js';
import {createMoleculeViewer} from './molecule-viewer.js';
import {createDragKit} from './drag-kit.js';
import {CHALLENGES, assessChallenge} from './challenges.js';
import {placeLoose, attach, addPairAtSite, arrangeDomains} from './bench-edits.js';
const $=id=>document.getElementById(id),KEY='virtualLab:b06-v2:construction:v2';
// Version 2 (b06-v2) keeps its own drafts; a first visit starts from version 1's.
try{
 const OLD='virtualLab:b06:construction:v2',keys=Object.keys(localStorage);
 if(!keys.some(k=>k.startsWith(KEY+':')))for(const k of keys)if(k.startsWith(OLD+':'))localStorage.setItem(KEY+k.slice(OLD.length),localStorage.getItem(k));
}catch{}
const firstBench=Object.keys(CHALLENGES)[0];
const isIonicBench=id=>id==='ionic'||id==='transfer';
const validBench=id=>id==='free'||isIonicBench(id)||Object.hasOwn(CHALLENGES,id);
const benchName=id=>id==='transfer'?'Electron transfer':id==='ionic'?'Ionic compounds':CHALLENGES[id]?.name||'Free construction';
let current=null;
export const getBuilderState=()=>current?clone(current.graph):null;
export async function startBuilder(){
 const main=document.querySelector('main');
 const handsOn=()=>main.dataset.mode==='builder'&&main.classList.contains('hands-on');
 let graph=fresh(),selected=null,element='C',order=1,style='ball',kit;
 let undo=[],redo=[],options={pairs:true,cage:false,labels:true,spin:false};
 let bench=firstBench,checked=false,storageIssue='',inputRevision=0;
 // Press, then press (B06 redesign, phase 2): a tray tile arms an atom or a lone pair, then a ring
 // or open bench space places it through drop(), the same rule a drag uses. focus narrows the
 // selection to a bond or a lone pair; joining waits for the second atom of Join to…;
 // transferFrom is the first atom pressed on the Electron transfer bench.
 let armed=null,focus=null,joining=false,transferFrom=null,rings=[];
 document.addEventListener('b06-mode',()=>{inputRevision++;});
 const drafts=new Map();
 try{
  const last=localStorage.getItem(KEY+':active');
  if(validBench(last))bench=last;
 }catch{}
 if(bench==='ionic'&&handsOn())bench='transfer';
 function readBench(){
  graph=fresh(bench);selected=null;checked=false;undo=[];redo=[];style='ball';
  armed=null;focus=null;joining=false;transferFrom=null;
  storageIssue='';
  try{
   let saved=drafts.get(bench);
   if(!saved){
    let raw=localStorage.getItem(KEY+':'+bench);
    if(raw===null&&bench==='free'){
     raw=localStorage.getItem('apchem:b06:molecule-builder:v1');
     if(raw!==null)storageIssue='Restored earlier free construction.';
    }
    if(raw===null)return;
    saved=JSON.parse(raw);
   }
   if(!saved)return;
   const restored=validate(saved.graph);
   if((restored.kind==='ionic')!==isIonicBench(bench)||Array.isArray(restored.transfers)!==(bench==='transfer'))throw Error('Wrong workbench');
   graph=materialize(restored);
   selected=atom(graph,saved.selected)?.id??graph.atoms[0]?.id??null;
   style=['ball','stick','space','wire'].includes(saved.style)?saved.style:'ball';
   checked=saved.checked===true;
  }catch{storageIssue='Saved draft unreadable. Bench cleared.';}
 }
 const status=(message,error=false)=>{
  $('builder-status').textContent=message;$('builder-status').classList.toggle('error',error);
  if(isIonicBench(bench)&&error)$('ionic-result').textContent=message;
 };
 const canPlace=symbol=>isIonicBench(bench)?!!ionFor(symbol):!handsOn()||bySymbol.get(symbol)?.available;
 function requirePart(symbol){
  if(!canPlace(symbol))throw Error(ELEMENTS[symbol].name+' is reference only in the hand-building pilot.');
 }
 const viewer=await createMoleculeViewer($('builder-stage'),{});
 $('builder-loading').hidden=true;
 // Second insight row, built here so the panel markup stays unchanged. It pairs
 // electron geometry with the molecular shape above it, and real-angle
 // expectations with the ideal angles above them.
 const strip=document.querySelector('.insight-strip');
 for(const [id,label,title] of [
  ['electron-geometry','ELECTRON GEOMETRY','Arrangement of all domains at the selection, lone pairs included. The VSEPR prediction above names the atom positions only.'],
  ['hybrid-label','HYBRIDIZATION','AP model: sp (2 domains), sp² (3), sp³ (4). No label for 5 or 6 domains: sp³d-type descriptions are not supported by current evidence.'],
  ['expected-angles','VSEPR ANGLE TREND','Direction VSEPR predicts real bond angles to move from ideal: lone pairs and multiple bonds take more angular space. Qualitative, not computed. Some molecules break it: Cl₂O measures about 111°, above 109.5°.'],
  ['bond-tally','σ / π AT SELECTION','Each bond is one σ bond; a double bond adds one π bond, a triple bond two.'],
 ]){
  if(!strip||$(id))continue;
  const cell=document.createElement('div'),name=document.createElement('span'),value=document.createElement('strong');
  name.textContent=label;value.id=id;value.textContent='None';cell.title=title;cell.append(name,value);strip.append(cell);
 }
 const setText=(id,text)=>{const el=$(id);if(el)el.textContent=text;};
 $('show-pairs').setAttribute('aria-pressed','true');
 for(const [key,c] of Object.entries(CHALLENGES)){
  $('bench-select').add(new Option(c.name+' · '+c.formula,key));
 }
 $('bench-select').add(new Option('Free construction','free'));
 $('bench-select').add(new Option('Ionic compounds','ionic'),0);
 $('bench-select').add(new Option('Electron transfer','transfer'),1);
 const balance=document.querySelector('.ionic-balance'),removeIon=$('remove-ion');
 removeIon.onclick=()=>$('unseat-atom').click();
 function showBenchOptions(open){
  const choices=$('workbench-options'),toggle=$('change-workbench');
  const returnFocus=!open&&choices.contains(document.activeElement);
  choices.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
  if(returnFocus)toggle.focus({preventScroll:true});
 }
 $('change-workbench').onclick=()=>showBenchOptions($('workbench-options').hidden);
 // Passed challenges (a tick on the bench button): the saved draft was checked and still passes.
 const passCache=new Map();
 function benchPassed(id){
  const c=CHALLENGES[id];if(!c)return false;
  if(id===bench)return checked&&assessChallenge(c,graph).every(row=>row.pass);
  if(!passCache.has(id)){
   let pass=false;
   try{
    const draft=drafts.get(id)||JSON.parse(localStorage.getItem(KEY+':'+id));
    if(draft?.checked===true)pass=assessChallenge(c,materialize(validate(draft.graph))).every(row=>row.pass);
   }catch{}
   passCache.set(id,pass);
  }
  return passCache.get(id);
 }
 function save(){
  const draft={graph,selected,style,checked};
  drafts.set(bench,draft);passCache.delete(bench);
  try{
   localStorage.setItem(KEY+':'+bench,JSON.stringify(draft));
   localStorage.setItem(KEY+':active',bench);
   $('builder-save-status').textContent='Saved on this device · '+benchName(bench);
  }catch{$('builder-save-status').textContent='Browser storage unavailable. Use Save to export a file.';}
 }
 function setupAssignment(){
  const c=CHALLENGES[bench],ionic=isIonicBench(bench),transfer=bench==='transfer';
  main.dataset.chemistry=ionic?'ionic':'molecular';
  main.dataset.transfer=String(transfer);
  if(ionic&&!ionFor(element))element='Na';
  if(!ionic&&!TRAY_ELEMENTS.includes(element))element='C';
  $('bench-select').value=bench;
  $('change-workbench').hidden=!ionic;
  showBenchOptions(!ionic);
  $('assignment-title').textContent=c?c.formula:benchName(bench);
  $('assignment-brief').textContent=transfer?'Start with neutral atoms. Bring a nonmetal into contact with a metal, or press one and then the other, to transfer electrons. For MgCl₂, bring two Cl atoms to the same Mg, one at a time.':ionic?'Choose one metal and one nonmetal. Add their ions until the total charge is zero.':c?c.brief:'Open bench: neutral main-group molecules, up to 80 atoms. Load a reference model to edit it, or build your own.';
  balance.hidden=!ionic;
  $('balance-title').textContent=transfer?'Electrons transferred':'Charge balance';
  removeIon.hidden=!ionic;
  removeIon.textContent=transfer?'Remove selected particle':'Remove selected ion';
  $('assignment-scaffold').hidden=!c;$('assignment-scaffold').open=false;
  $('assignment-hints').replaceChildren(...(c?.hints||[]).map(text=>{
    const item=document.createElement('li');item.textContent=text;return item;
  }));
  $('check-challenge').hidden=!c;
  document.querySelector('.examples').hidden=bench!=='free';
  const first=$('empty-builder');
  first.querySelector('strong').textContent=transfer?'Place a neutral atom.':ionic?'Place your first ion.':'Your first atom goes here.';
  first.lastElementChild.textContent=transfer?'Choose Mg or Cl from the tray or periodic table to start MgCl₂.':ionic?'Choose a charged particle from the tray or the hand periodic table.':'Press an atom in the kit, then press here. You can also carry it here.';
  $('atom-list').setAttribute('aria-label',transfer?'Select an atom or ion':ionic?'Select an ion':'Select an atom');
  $('unseat-atom').textContent=ionic?'Remove selected ion':'Remove atom';
  $('selection-hint').textContent=transfer?'Move any snapped particle to carry its assembly.':ionic?'Select an ion to move or remove it.':'Drag an atom to reposition it. Your other atoms stay where you placed them.';
  $('builder-stage').setAttribute('aria-label',transfer?'Electron transfer workbench. Bring a metal and nonmetal together to snap. Drag empty space to rotate.':ionic?'Ionic workbench. Drag ions to move them. Drag empty space to rotate.':'Molecule workbench. Drag atoms to move them. Drag empty space to rotate.');
  document.querySelector('.builder-scene-header .eyebrow').textContent=ionic?'FORMULA UNIT':'YOUR MOLECULE';
  $('molecule-formula').title=ionic?'Smallest whole-number ratio when the ions balance':'Formula from your placed atom counts';
  for(const id of ['show-pairs','show-geometry'])$(id).disabled=ionic;
 }
 function showFeedback(){
  const c=CHALLENGES[bench],list=$('challenge-feedback'),summary=$('challenge-status');
  list.replaceChildren();
  summary.textContent='';
  if(!c||!checked)return;
  const checks=assessChallenge(c,graph),pass=checks.every(row=>row.pass);
  summary.textContent=pass?'All checks pass. Model remains editable.':'Check failed. Revise the flagged item and run the check again.';
  // One row per check that assessChallenge returned: it stops at the first failure.
  for(const row of checks){
   const item=document.createElement('li'),line=document.createElement('span'),title=document.createElement('strong'),tag=document.createElement('span'),detail=document.createElement('small');
   title.textContent=row.label;
   tag.className='ms-tag '+(row.pass?'ok':'no');tag.textContent=row.pass?'✓ Matches':'✗ Revise';
   detail.textContent=row.detail;item.dataset.result=row.pass?'pass':'revise';
   line.className='ms-critrow';line.append(title,tag);item.append(line,detail);list.append(item);
  }
  if(pass&&c.real){
   const item=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('span');
   title.textContent='Reference structure. ';detail.textContent=c.real;item.dataset.result='info';
   item.append(title,detail);list.append(item);
  }
 }
 let anglePick={};
 function updateLocalGauge(env){
  const ids=env?.neighbors.map(n=>n.id)||[];
  if(anglePick.center!==selected)anglePick={center:selected};
  if(!ids.includes(anglePick.first))anglePick.first=ids[0];
  if(!ids.includes(anglePick.second)||anglePick.second===anglePick.first)anglePick.second=ids.find(id=>id!==anglePick.first);
  const visible=options.cage&&ids.length>=2;
  $('local-gauge').hidden=!visible;
  options.anglePair=null;
  if(!visible)return;
  for(const field of ['first','second']){
   const select=$('local-'+field);
   select.replaceChildren(...ids.map(id=>new Option(atom(graph,id).element+id,String(id))));
   select.value=String(anglePick[field]);
  }
  const {first,second}=anglePick,angle=bondAngle(graph,selected,first,second);
  if(angle==null){$('local-angle').value='Atoms overlap. Separate them to measure.';return;}
  options.anglePair=[first,second];
  $('local-angle').value=[first,selected,second].map(id=>atom(graph,id).element+id).join('–')+' · '+angle.toFixed(1)+'°';
 }
 function updateEditControls(){
  const partner=$('edit-partner'),previous=partner.value;
  const otherAtoms=graph.atoms.filter(a=>a.id!==selected);
  partner.replaceChildren(...otherAtoms.map(a=>new Option(a.element+a.id,String(a.id))));
  if(otherAtoms.some(a=>String(a.id)===previous))partner.value=previous;
  partner.disabled=!otherAtoms.length;
  for(const id of ['attach-atom','seat-pair','align-domains','unseat-atom'])$(id).disabled=selected==null;
  $('unseat-pair').disabled=!atom(graph,selected)?.pairs;
  $('join-atoms').disabled=$('detach-atoms').disabled=!otherAtoms.length;
 }
 readBench();setupAssignment();
 // Coach line (mock rule): the selected atom's need first, then the first atom on the bench that
 // still needs bonds, lone pairs or a lone-pair move. Every value comes from the model.
 function need(id){
  const a=atom(graph,id);if(!a||ELEMENTS[a.element].looseOnly)return '';
  const e=environment(graph,id);
  if(e.missing)return `${a.element}${a.id}: ${e.missing} open bond${e.missing===1?'':'s'}. Choose an atom, then one of its rings.`;
  if(!e.balanced)return `${a.element}${a.id}: ${ELEMENTS[a.element].electrons-e.used-2*e.pairs} unassigned valence electrons. Add lone pairs.`;
  return pairPlacementIssue(graph,id)||'';
 }
 function describe(){
  if(bench==='transfer')return transferSummary(graph).advice;
  if(bench==='ionic')return ionicComposition(graph).advice;
  if(!graph.atoms.length)return handsOn()?'Empty bench. Close and open your hand on an atom tile, then on the bench. Or carry the tile to the bench.':'Empty bench. Press an atom in the kit, then press the bench.';
  const part=atom(graph,selected);
  if(part&&ELEMENTS[part.element].looseOnly)return ELEMENTS[part.element].name+' is neutral here. Choose Ionic compounds in Workbench or in the hand periodic table to build a salt.';
  const n=components(graph);if(n>1)return `${n} disconnected fragments. Select one atom, choose Join to…, then press the other atom.`;
  const own=need(selected);if(own)return own;
  for(const a of graph.atoms){const text=need(a.id);if(text)return text;}
  return CHALLENGES[bench]?'Every atom is complete. Choose Check construction.':'Every atom is complete. Press an atom to read its local shape.';
 }
 const ORDER_NAME=['','single','double','triple'];
 // What the next press will do, while a tile is armed or a two-press action waits.
 function coachText(){
  if(joining){const a=atom(graph,selected);return a?`Press the atom to join to ${a.element}${a.id} with a ${ORDER_NAME[order]} bond. Press open space to cancel.`:describe();}
  if(bench==='transfer'&&transferFrom!=null){
   const a=atom(graph,transferFrom),metal=ionFor(a.element)?.charge>0;
   return `${a.element}${a.id} chosen. Press a ${metal?'nonmetal':'metal'} atom to move electrons, or press ${a.element}${a.id} again to cancel.`;
  }
  if(isIonicBench(bench)||!armed)return describe();
  if(armed.kind==='pair')return rings.length?'Press an amber ring to seat the lone pair.':'No atom has room for a lone pair yet.';
  const name=ELEMENTS[armed.element].name.toLowerCase();
  if(!graph.atoms.length)return `Press the bench to place the first ${name} atom.`;
  return rings.length?`Press a ring to bond ${name} there with a ${ORDER_NAME[order]} bond, or open bench space to place it loose.`:`No ring fits ${name} with a ${ORDER_NAME[order]} bond. Press open bench space to place it loose.`;
 }
 function renderMolecular(a){
  const isolated=a&&ELEMENTS[a.element].looseOnly;
  const env=a&&!isolated?environment(graph,selected):null,complete=env&&!env.missing&&env.balanced;
  const totals=bondTally(graph);
  $('molecule-formula').textContent=graph.atoms.length?formula(graph):'Empty bench';$('model-count').textContent=`${graph.atoms.length} atoms · ${graph.bonds.length} bonds`+(graph.bonds.length?` (${totals.sigma} σ, ${totals.pi} π)`:'');$('model-name').textContent=CHALLENGES[bench]?.name||graph.name;
  $('selected-title').textContent=a?`${ELEMENTS[a.element].name} · ${a.element}${a.id}`:'Select an atom';
  // Formal charge appears once every bond is placed. Missing lone pairs show up as a positive charge.
  const charge=env&&!env.missing?formalCharge(graph,selected):null;
  $('selected-capacity').textContent=env?env.missing?`${env.missing} open bond${env.missing===1?'':'s'}`:(env.balanced?'Electrons placed':'Lone pairs needed')+' · FC '+signed(charge):'';
  $('selected-capacity').title=env&&!env.missing?'FC: formal charge = valence electrons − nonbonding electrons − bonds':'';
  // Empty facts use a plain word: "Not yet" while the selected atom is unfinished, otherwise "None".
  const blank=env&&!complete?'Not yet':'None';
  $('pair-count').value=env?.pairs??0;$('local-shape').textContent=env?complete?env.shape:'Build in progress':'None';
  $('domain-count').textContent=env?env.neighbors.length+env.pairs:'0';$('ideal-angles').textContent=complete&&env.neighbors.length>1?env.angles:blank;
  const central=complete&&env.neighbors.length>1,hybrid=central?hybridization(env):null,local=a?bondTally(graph,selected):null;
  setText('electron-geometry',central?env.electron:complete?'Terminal atom':blank);
  setText('hybrid-label',hybrid||(complete&&env.neighbors.length===1?'Terminal atom':blank));
  setText('expected-angles',complete?expectedAngles(graph,selected)||'None':blank);
  setText('bond-tally',local?`${local.sigma} σ · ${local.pi} π`:'None');
  const spacing=env?spacingError(graph,selected):null,pairIssue=complete?pairPlacementIssue(graph,selected):null;
  const respace=spacing!=null&&(spacing>ANGLE_TOLERANCE||!!pairIssue);
  $('spacing-status').textContent=spacing==null?'Finish the model':pairIssue?'Lone pair misplaced':spacing<=ANGLE_TOLERANCE?'Matches ideal':'Adjust the spacing';$('spacing-status').classList.toggle('needs-spacing',respace);
  if(isolated){
   $('selected-capacity').textContent='Neutral atom';
   $('local-shape').textContent='Isolated atom';
   $('spacing-status').textContent='Not needed';
   $('domain-count').textContent='None';
   $('pair-count').value='Not shown';
  }
  $('representation-note').textContent={ball:'Ball and stick: nuclei and bonds.',stick:'Stick: bonds only; junctions mark nuclei.',space:'Space-filling: occupied volume. Radii are illustrative.',wire:'Wireframe: connectivity only.'}[style];
  updateLocalGauge(env);
 }
 function renderIonic(a){
  const mixture=ionicComposition(graph);
  const terms=[];
  for(const [symbol,count] of [[mixture.cation,mixture.cationCount],[mixture.anion,mixture.anionCount]]){
   if(symbol)terms.push(count+' × '+ionLabel(symbol));
  }
  $('ionic-inventory').textContent=terms.join('   +   ')||'No ions placed';
  $('ionic-total').textContent='Net charge  '+signed(mixture.netCharge);
  $('ionic-result').textContent=mixture.units
   ? mixture.name[0].toUpperCase()+mixture.name.slice(1)+' · '+mixture.units+' formula unit'+(mixture.units===1?'':'s')+' of '+mixture.formula
   : mixture.advice;
  balance.dataset.balanced=String(mixture.units>0);
  $('molecule-formula').textContent=mixture.units?mixture.formula:graph.atoms.length?'Unbalanced':'Empty bench';
  $('model-name').textContent=mixture.units?mixture.name:'';
  $('model-count').textContent=graph.atoms.length+(graph.atoms.length===1?' ion':' ions')+' · Net charge '+signed(mixture.netCharge);
  $('selected-title').textContent=a?ionLabel(a.element)+' · '+ionFor(a.element).name:'Select an ion';
  $('selected-capacity').textContent=a?(ionFor(a.element).charge>0?'Cation':'Anion'):'';
  $('selected-capacity').title='';
  $('representation-note').textContent='Ion positions are freely arranged. The formula gives the simplest neutral ratio.';
  updateLocalGauge(null);
 }
 function renderTransfer(a){
  const result=transferSummary(graph);
  const counts=new Map();
  for(const part of graph.atoms){
   const label=particleLabel(graph,part.id);
   counts.set(label,(counts.get(label)||0)+1);
  }
  $('ionic-inventory').textContent=[...counts].map(([label,n])=>n===1?label:n+' × '+label).join('  +  ')||'No atoms placed';
  const n=result.electronsTransferred;
  const tally=n+' electron'+(n===1?'':'s')+' transferred';
  $('ionic-total').textContent=tally+' · Net charge '+signed(result.netCharge);
  $('ionic-result').textContent=result.advice;
  balance.dataset.balanced=String(result.complete);
  $('molecule-formula').textContent=result.formula||(n?'Partly assembled':graph.atoms.length?'Neutral atoms':'Empty bench');
  $('model-name').textContent=result.name;
  $('model-count').textContent=tally;
  const charge=a?atomCharge(graph,a.id):0;
  $('selected-title').textContent=a?particleLabel(graph,a.id)+' · '+ELEMENTS[a.element].name:'Select an atom';
  $('selected-capacity').textContent=a?(charge>0?'Cation':charge<0?'Anion':'Neutral atom'):'';
  $('selected-capacity').title='';
  $('representation-note').textContent='The metal shrinks as it loses electrons. The nonmetal expands as it gains them.';
  updateLocalGauge(null);
 }
 function render(message){
  current={graph};if(!atom(graph,selected))selected=graph.atoms[0]?.id??null;
  const a=atom(graph,selected),ionic=isIonicBench(bench),transfer=bench==='transfer';
  // A bond or lone-pair focus lasts while that part still exists at the selected atom.
  if(focus?.kind==='bond'&&!graph.bonds.some(b=>b.a===focus.a&&b.b===focus.b||b.a===focus.b&&b.b===focus.a))focus=null;
  if(focus?.kind==='pair'&&(focus.owner!==selected||!(atom(graph,focus.owner)?.pairs>focus.index)))focus=null;
  if(focus?.kind==='bond'&&![focus.a,focus.b].includes(selected))focus=null;
  if(transferFrom!=null&&(!transfer||!atom(graph,transferFrom)))transferFrom=null;
  if(ionic||!a)joining=false;
  if(armed&&ionic)armed=null;
  rings=ringSites();
  if(transfer)renderTransfer(a);else if(ionic)renderIonic(a);else renderMolecular(a);
  $('element-name').textContent=ionic?'Click or drag':ELEMENTS[element].name;$('empty-builder').hidden=!!graph.atoms.length;
  removeIon.disabled=selected==null;
  $('builder-undo').disabled=!undo.length;$('builder-redo').disabled=!redo.length;
  const list=$('atom-list');
  const listLabel=part=>transfer?particleLabel(graph,part.id):ionic?ionLabel(part.element):part.element;
  const signature=bench+':'+graph.atoms.map(part=>part.id+'-'+listLabel(part)).join(',');
  if(list.dataset.signature!==signature){
   const focused=list.contains(document.activeElement);
   list.dataset.signature=signature;
   list.replaceChildren(...graph.atoms.map(a=>{const b=document.createElement('button');b.textContent=listLabel(a)+(ionic?' · ':'')+a.id;b.dataset.atom=a.id;b.title='Select '+b.textContent+'; Space picks it up';b.setAttribute('aria-label','Select '+(ionic?listLabel(a):ELEMENTS[a.element].name)+' '+a.id);return b;}));
   if(focused)(list.querySelector('[data-atom="'+selected+'"]')||$('place-free-atom')).focus({preventScroll:true});
  }
  for(const b of list.children)b.setAttribute('aria-pressed',String(Number(b.dataset.atom)===selected));
  updateTray();
  for(const b of document.querySelectorAll('[data-style]'))b.setAttribute('aria-pressed',String(b.dataset.style===style));
  updateEditControls();showFeedback();viewer.show(graph,selected,{...options,style,element,order});save();if(message!==false)status(message||coachText());
  emit('render');
 }
 const emit=reason=>document.dispatchEvent(new CustomEvent('b06-builder-render',{detail:{reason}}));
 // A pressed atom tile is the armed atom (press, then press a ring); element stays the edit-button element.
 function updateTray(){
  const ionic=isIonicBench(bench);
  for(const b of document.querySelectorAll('[data-element]')){
   if(ionic)b.removeAttribute('aria-pressed');else b.setAttribute('aria-pressed',String(armed?.kind==='atom'&&b.dataset.element===armed.element));
  }
  $('pair-piece').setAttribute('aria-pressed',String(armed?.kind==='pair'));
  for(const b of document.querySelectorAll('[data-order]'))b.setAttribute('aria-pressed',String(Number(b.dataset.order)===order));
 }
 // Shared by a drop and by the ring dry run, so a ring is shown only where a drop succeeds.
 function placeAtom(g,source,snap,position){
  let id=source.id;
  if(id==null){requirePart(source.element);id=addAtom(g,source.element);const a=atom(g,id);a.pairs=0;a.pairDirections=[];}
  const a=atom(g,id);
  const ionic=g.kind==='ionic';
  if(g.atoms.some(b=>b.id!==id&&Math.hypot(...V.sub(position,b.position))<(ELEMENTS[a.element].r+ELEMENTS[b.element].r)*(ionic?1:.65)))throw Error(ionic?'The ions would overlap. Drop this ion in clear space.':'Atoms would overlap. Use a ring or clear space.');
  a.position=[...position];if(snap)connect(g,id,snap.target,snap.order);
  if(!ionic)g.name='Your molecule';
  return id;
 }
 // Rings for the armed part: the snap sites of every atom (snapSites, as a drag shows them),
 // kept only where the same drop would be accepted.
 function ringSites(){
  if(!armed||isIonicBench(bench))return [];
  const source=armed.kind==='pair'?{kind:'pair'}:{kind:'atom',element:armed.element,order};
  const sites=[];
  for(const a of graph.atoms)for(const site of snapSites(graph,a.id,source)){
   try{
    const g=clone(graph);
    if(source.kind==='pair')placePair(g,site.target,site.direction);else placeAtom(g,source,site,site.position);
    validate(g);sites.push(site);
   }catch{}
  }
  return sites;
 }
 function commit(mutation,message,fit=false){
  kit?.cancel();const candidate=clone(graph);
  try{const result=mutation(candidate),validated=validate(candidate);undo.push({graph:clone(graph),selected});if(undo.length>40)undo.shift();redo=[];graph=validated;checked=false;if(Number.isInteger(result))selected=result;render(typeof message==='function'?message(result):message);if(fit)viewer.fit();return true;}
  catch(e){status(e.message,true);return false;}
 }
 // A press on the model (mouse, touch, hand or the atom list). source is what was pressed.
 function select(id,source=null){
  const kind=source?.kind||'atom';
  if(joining&&kind==='atom'){
   joining=false;
   if(id!==selected&&atom(graph,id)){$('edit-partner').value=String(id);$('join-atoms').click();return;}
  }
  if(bench==='transfer'&&kind==='atom'){
   if(transferFrom!=null&&transferFrom!==id){const from=transferFrom;transferFrom=null;pressTransfer(from,id);return;}
   transferFrom=transferFrom===id?null:id;
  }
  focus=kind==='bond'&&source.edge?{kind:'bond',a:source.edge.a,b:source.edge.b}:kind==='pair'?{kind:'pair',owner:source.owner,index:source.index}:null;
  selected=id;render();emit('select');
 }
 // Press one atom, then another, on the Electron transfer bench: the first atom comes into contact
 // with the second exactly as if it were dragged there, through findTransferSnap and drop().
 // A pair the rules refuse gets the model's own message and nothing changes.
 function pressTransfer(from,to){
  const a=atom(graph,from),b=atom(graph,to);
  if(!a||!b)return false;
  const source={kind:'atom',id:from,element:a.element};
  if(transferCapacity(graph,from,a.element,to)){
   const m=viewer.controls.camera.matrixWorld.elements;
   const snap=findTransferSnap(graph,source,b.position,[m[0],m[1],m[2]],[m[4],m[5],m[6]]);
   if(snap?.target===to)return drop(source,snap,snap.position);
   return drop(source,null,b.position);
  }
  return commit(g=>{addTransfer(g,from,to);});
 }
 function pressTile(source){
  if(isIonicBench(bench)){if(source.kind==='atom')choosePart(source.element);return;}
  joining=false;
  if(source.kind==='atom'){
   element=source.element;
   armed=armed?.kind==='atom'&&armed.element===source.element?null:{kind:'atom',element:source.element};
   render();
  }else if(source.kind==='pair'){
   armed=armed?.kind==='pair'?null:{kind:'pair'};
   render();
  }else if(source.kind==='bond'){
   order=source.order;
   render(armed?undefined:ORDER_NAME[order][0].toUpperCase()+ORDER_NAME[order].slice(1)+' bond chosen for the next atom.');
  }
 }
 function pressRing(index){
  const site=rings[index];if(!site||!armed)return false;
  return armed.kind==='pair'?drop({kind:'pair'},site,site.position):drop({kind:'atom',element:armed.element,order},site,site.position);
 }
 // A press on open bench space (no part under the pointer).
 function pressSpace(x,y){
  if(joining){joining=false;render();return;}
  if(transferFrom!=null){transferFrom=null;render();return;}
  if(armed?.kind==='atom'){const point=viewer.worldAt(x,y);if(point)drop({kind:'atom',element:armed.element,order},null,point);return;}
  if(armed?.kind==='pair'){armed=null;render(false);status('Lone pair needs an atom site. Returned.');return;}
  if(focus){focus=null;render();emit('select');}
 }
 function disarm(){if(!armed&&!joining&&transferFrom==null)return false;armed=null;joining=false;transferFrom=null;render();return true;}
 function removeEdge(g,edge){g.bonds=g.bonds.filter(b=>!(b.a===edge.a&&b.b===edge.b||b.a===edge.b&&b.b===edge.a));}
 function drop(source,snap,point){
  const position=snap?.position||point;
  if(!position?.every(v=>Number.isFinite(v)&&Math.abs(v)<=100)){status('Position out of range. Part returned.',true);return false;}
  if(bench==='transfer'&&source.kind==='atom'){
   let transfer;
   const success=commit(g=>{
    let id=source.id;
    if(id==null){requirePart(source.element);id=placeLoose(g,source.element,position);}
    moveTransferGroup(g,id,position,snap);
    if(snap?.type==='transfer')transfer=addTransfer(g,id,snap.target);
    return id;
   });
   if(success&&transfer){
    viewer.animateTransfer(transfer);
    const donor=atom(graph,transfer.donor),receiver=atom(graph,transfer.acceptor);
    const count=transfer.electrons;
    status(donor.element+' gave '+count+' electron'+(count===1?'':'s')+' to '+receiver.element+'. '+describe());
   }
   return success;
  }
  if(source.kind==='atom'){
   return commit(g=>placeAtom(g,source,snap,position),bench==='ionic'?undefined:snap?'Snapped to site. Other atoms unchanged.':source.id!=null?'Atom moved; bonds follow. Snap to a ring for ideal spacing.':'Atom placed. Snap atoms to its rings or bond it to a placed atom.');
  }else if(source.kind==='pair'){
   if(!snap){status('Lone pair needs an atom site. Returned.');return;}
   if(commit(g=>{if(source.owner!=null)removePair(g,source.owner,source.index);placePair(g,snap.target,snap.direction);g.name='Your molecule';return snap.target;},'Lone pair placed. Re-spread domains if needed.')){options.pairs=true;$('show-pairs').setAttribute('aria-pressed','true');render(false);}
  }else{
   if(!snap){status('Drop the bond on a second atom or on an existing bond.');return;}
   commit(g=>{if(source.edge)removeEdge(g,source.edge);const a=snap.type==='replace-bond'?snap.edge.a:source.anchor,b=snap.type==='replace-bond'?snap.edge.b:snap.target;connect(g,a,b,source.order);return a;},snap.type==='replace-bond'?'Bond order changed. Positions unchanged.':'Bond created. Positions unchanged.');
  }
 }
 function removeParticle(id){
  const remove=bench==='transfer'?removeTransferParticle:removeAtom;
  return commit(g=>remove(g,id),isIonicBench(bench)?undefined:'Atom and its bonds removed. Undo restores them.');
 }
 function returnPart(source){
  if(source.id!=null)removeParticle(source.id);
  else if(source.owner!=null)commit(g=>removePair(g,source.owner,source.index),'Lone pair removed.');
  else if(source.edge)commit(g=>{removeEdge(g,source.edge);g.name='Your molecule';},'Bond removed. Atoms unchanged.');
  else status('Part returned.');
 }
 const partsTray=$('builder-tray'), pages=document.createElement('div');
 pages.className='hand-part-pages';pages.setAttribute('role','group');pages.setAttribute('aria-label','Parts pages');
 partsTray.querySelector('.builder-parts').prepend(pages);
 function choosePart(symbol){
  if(isIonicBench(bench)){
   const point=handsOn()&&bench==='transfer'?handPlacement(viewer,graph,symbol,'ball'):null;
   commit(g=>placeLoose(g,symbol,point||undefined),undefined,!point);
  }else{
   element=symbol;render(ELEMENTS[symbol].name+' selected. Drag it into the scene or use the edit buttons.');
  }
 }
 const palette=$('element-palette');
 // Studio hand layout (B06 redesign): six atom tiles a page with ◂ and More ▸; bond and lone-pair
 // tiles stay in view. The older hand pages above stay for hand building in Immerse.
 const handLabel=document.createElement('p'),handPager=document.createElement('div');
 handLabel.className='ms-hlabel';handPager.className='ms-hpager';handPager.setAttribute('role','group');handPager.setAttribute('aria-label','Atom pages');
 handPager.innerHTML='<button type="button" class="ms-tile" data-hand-page="-1" aria-label="Previous atoms">◂</button><button type="button" class="ms-tile" data-hand-page="1" aria-label="More atoms">More ▸</button>';
 palette.before(handLabel);palette.after(handPager);
 let handPages=[],handPage=0;
 function showHandPage(page){
  if(!handPages.length)return;
  handPage=(page+handPages.length)%handPages.length;
  const [label,group]=handPages[handPage];
  handLabel.textContent=label+' · '+(handPage+1)+'/'+handPages.length;
  for(const b of palette.querySelectorAll('[data-element]'))b.classList.toggle('ms-away',!group.includes(b.dataset.element));
  for(const b of handPager.children)b.disabled=handPages.length<2;
 }
 handPager.children[0].onclick=()=>showHandPage(handPage-1);
 handPager.children[1].onclick=()=>showHandPage(handPage+1);
 function buildTray(){
  const ionic=isIonicBench(bench),fixedIons=bench==='ionic',pageSize=5;
  const symbols=ionic?periodicTable.filter(el=>ionFor(el.symbol)).map(el=>el.symbol):TRAY_ELEMENTS;
  if(ionic)symbols.sort((a,b)=>Math.sign(ionFor(b).charge)-Math.sign(ionFor(a).charge));
  const atomPages=Math.ceil(symbols.length/pageSize);
  pages.replaceChildren();palette.replaceChildren();
  partsTray.querySelector('.build-step h3').textContent=fixedIons?'Add ions':ionic?'Add atoms':'Atoms';
  function showPage(page){
   for(const [i,button] of [...pages.children].entries())button.setAttribute('aria-pressed',String(i===page));
   for(const [i,button] of [...palette.querySelectorAll('[data-element]')].entries())button.classList.toggle('hand-page-away',Math.floor(i/pageSize)!==page);
   palette.classList.toggle('hand-page-away',page===atomPages);
   partsTray.querySelector('.bond-choices').classList.toggle('hand-page-away',page!==atomPages);
   $('pair-piece').classList.toggle('hand-page-away',page!==atomPages);
  }
  for(let page=0;page<atomPages+(ionic?0:1);page++){
   const button=document.createElement('button'),group=symbols.slice(page*pageSize,(page+1)*pageSize);
   button.type='button';button.dataset.handPage=String(page);
   button.textContent=group.length?group[0]+'–'+group.at(-1):'Bonds';
   button.setAttribute('aria-label',group.length?'Show '+group.join(', '):'Show bonds and lone pairs');
   button.onclick=()=>showPage(page);pages.append(button);
  }
  let priorSign=0;
  for(const symbol of symbols){
   const e=ELEMENTS[symbol],label=fixedIons?ionLabel(symbol):symbol;
   if(ionic){
    const sign=Math.sign(ionFor(symbol).charge);
    if(sign!==priorSign){
     const heading=document.createElement('h4');
     heading.textContent=sign>0?(fixedIons?'Metal ions':'Metals'):(fixedIons?'Nonmetal ions':'Nonmetals');palette.append(heading);priorSign=sign;
    }
   }
   const b=document.createElement('button');
   b.type='button';b.className='element-button';b.dataset.element=symbol;
   b.setAttribute('aria-label',ionic?'Add '+label+' ('+(fixedIons?ionFor(symbol).name:'neutral '+e.name)+')':e.name+' atom');
   b.title=ionic?'Add '+label+' or drag it into the scene':'Press '+e.name+', then press a ring on the model or open bench space. You can also drag it; Space picks it up with the keyboard.';
   b.innerHTML=`<span class="element-orb" style="--atom:${e.color};--atom-label:${e.ink||'#fff'}">${label}</span><small>${fixedIons?ionFor(symbol).name:e.name}</small>`;
   b.onclick=()=>pressTile({kind:'atom',element:symbol});palette.append(b);
  }
  handPages=[];
  if(ionic){
   for(const [sign,name] of [[1,fixedIons?'Metal ions':'Metals'],[-1,fixedIons?'Nonmetal ions':'Nonmetals']]){
    const group=symbols.filter(symbol=>Math.sign(ionFor(symbol).charge)===sign);
    for(let i=0;i<group.length;i+=6)handPages.push([name,group.slice(i,i+6)]);
   }
  }else for(let i=0;i<symbols.length;i+=6)handPages.push(['Atoms',symbols.slice(i,i+6)]);
  showHandPage(0);
  showPage(0);syncHandParts();
 }
 function syncHandParts(){
  for(const button of palette.querySelectorAll('[data-element]'))button.disabled=!canPlace(button.dataset.element);
  if(armed?.kind==='atom'&&!canPlace(armed.element))armed=null;
  if(!canPlace(element)){element='C';render(false);}
 }
 buildTray();
 let hadHands=handsOn();
 new MutationObserver(()=>{
  const active=handsOn();
  if(active===hadHands)return;
  hadHands=active;
  if(active&&bench==='ionic')switchBench('transfer');
  else{
   if(!active&&bench==='transfer')viewer.cancelTransferAnimation();
   syncHandParts();
  }
 }).observe(main,{attributes:true,attributeFilter:['class','data-mode']});
 $('bench-select').onchange=()=>{
  inputRevision++;
  const requested=$('bench-select').value;
  kit?.cancel();viewer.cancelTransferAnimation();save();bench=requested;readBench();setupAssignment();buildTray();render(storageIssue||undefined);viewer.fit();
 };
 for(const field of ['first','second'])$('local-'+field).onchange=()=>{
  const other=field==='first'?'second':'first',old=anglePick[field];
  anglePick[field]=Number($('local-'+field).value);
  if(anglePick[field]===anglePick[other])anglePick[other]=old;
  render(false);
 };
 $('check-challenge').onclick=()=>{
  const c=CHALLENGES[bench];if(!c)return;
  checked=true;armed=null;joining=false;rings=[];showFeedback();save();
  const pass=assessChallenge(c,graph).every(row=>row.pass);
  status(pass?'All checks pass. Model remains editable.':'Check failed. Revise the flagged item and run the check again.',!pass);
  updateTray();emit('check');
 };
 for(const [id,f,name] of EXAMPLES){const b=document.createElement('button');b.textContent=f;b.title=name;b.setAttribute('aria-label','Load '+name);b.onclick=()=>{if(bench!=='free')return;const next=materialize(example(id));commit(g=>{Object.assign(g,next);return next.atoms[0].id;},name+' reference loaded. All parts editable.',true);};$('example-molecules').append(b);}
 for(const b of document.querySelectorAll('[data-order]'))b.onclick=()=>pressTile({kind:'bond',order:Number(b.dataset.order)});
 for(const b of document.querySelectorAll('[data-style]'))b.onclick=()=>{kit?.cancel();style=b.dataset.style;render(false);};
 $('pair-piece').onclick=()=>pressTile({kind:'pair'});
 $('atom-list').onclick=e=>{const b=e.target.closest('[data-atom]');if(b)select(Number(b.dataset.atom),{kind:'atom'});};
 $('place-free-atom').onclick=()=>commit(g=>{requirePart(element);return placeLoose(g,element);},'Loose atom placed. Select it, choose a second atom and Set bond.',true);
 $('attach-atom').onclick=()=>commit(g=>{requirePart(element);return attach(g,selected,element,order);},'Atom attached. Center stays selected.',true);
 $('join-atoms').onclick=()=>commit(g=>{connect(g,selected,Number($('edit-partner').value),order);return selected;},'Bond set. Positions unchanged.');
 $('detach-atoms').onclick=()=>commit(g=>{
  const id=Number($('edit-partner').value);
  const edge=g.bonds.find(b=>b.a===selected&&b.b===id||b.b===selected&&b.a===id);
  if(!edge)throw Error('These atoms have no bond to remove.');
  removeEdge(g,edge);g.name='Your molecule';return selected;
 },'Bond removed. Atoms unchanged.');
 $('seat-pair').onclick=()=>{
  if(commit(g=>addPairAtSite(g,selected),'Lone pair added to selection.')){
   options.pairs=true;$('show-pairs').setAttribute('aria-pressed','true');render(false);
  }
 };
 $('unseat-pair').onclick=()=>commit(g=>{removePair(g,selected,atom(g,selected).pairs-1);return selected;},'Lone pair removed from selection.');
 $('align-domains').onclick=()=>commit(g=>arrangeDomains(g,selected,Number($('edit-arrangement').value)),'Ideal directions applied at selection. Attached branches rotated with their bonds.',true);
 $('unseat-atom').onclick=()=>removeParticle(selected);
 $('new-molecule').onclick=()=>commit(g=>{Object.assign(g,fresh(bench));},'Bench cleared. Undo restores the model.',true);
 function restore(from,to){kit?.cancel();const state=from.pop();if(!state)return;viewer.cancelTransferAnimation();to.push({graph:clone(graph),selected});graph=state.graph;selected=state.selected;checked=false;render();viewer.fit();}
 $('builder-undo').onclick=()=>restore(undo,redo);$('builder-redo').onclick=()=>restore(redo,undo);
 for(const [id,key] of [['show-pairs','pairs'],['show-geometry','cage'],['show-labels','labels'],['spin','spin']])$(id).onclick=()=>{
  if(key==='spin'&&matchMedia('(prefers-reduced-motion: reduce)').matches){status('Spin off: reduced-motion setting. Drag or use arrow keys to rotate.');return;}
  kit?.cancel();options[key]=!options[key];$(id).setAttribute('aria-pressed',String(options[key]));render(key==='pairs'&&options.pairs?'Lone pairs shown. Drag one to move it.':key==='cage'&&options.cage?'Geometry on: cage = ideal directions, arc = measured angle.':false);
 };
 $('builder-fit').onclick=()=>viewer.fit();$('builder-zoom-in').onclick=()=>viewer.zoom(1.2);$('builder-zoom-out').onclick=()=>viewer.zoom(1/1.2);
 function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
 const exportBase=()=>bench==='transfer'?'electron-transfer':bench==='ionic'?'ionic-compound':'molecule';
 $('save-model').onclick=()=>{const filename=exportBase()+'.json';download(new Blob([JSON.stringify(graph,null,2)],{type:'application/json'}),filename);status('Saved '+filename+' with exact positions.');};
 $('load-model').onclick=()=>$('model-file').click();
 $('model-file').onchange=async e=>{
  const file=e.target.files[0],destination=bench;
  let revision=++inputRevision;
  const isCurrent=()=>revision===inputRevision&&main.dataset.mode==='builder';
  if(!file||!isCurrent())return;
  try{
   if(file.size>250000)throw Error('Choose a model file smaller than 250 KB.');
   const text=await file.text();
   if(!isCurrent()||bench!==destination)return;
   const imported=validate(JSON.parse(text));
   if(imported.kind==='ionic')switchBench(Array.isArray(imported.transfers)?'transfer':'ionic',{fromFile:true});
   else if(isIonicBench(bench))switchBench('free');
   revision=inputRevision;
   if(CHALLENGES[bench]&&imported.atoms.some(a=>!a.position||a.pairs==null||a.pairDirections?.length!==a.pairs)){
    throw Error('Challenge benches need files with positions and placed lone pairs. Open graph-only files in Free construction.');
   }
   const next=materialize(imported);
   commit(g=>{Object.assign(g,next);return next.atoms[0]?.id;},'File opened in this bench.',true);
  }catch(err){if(isCurrent())status('Could not open the file. '+err.message,true);}
  finally{e.target.value='';}
 };
 $('snapshot').onclick=()=>{try{const a=document.createElement('a');a.href=viewer.snapshot();a.download=exportBase()+'.png';a.click();status('Model image saved.');}catch{status('Image export failed. Retry after the model loads.',true);}};
 kit=createDragKit(viewer,{order:()=>order,selected:()=>selected,atom:id=>atom(graph,id),select,status,drop,returnPart,
  // A tap on a tray tile (mouse, touch or hand) is the first press of press, then press.
  selectTray:pressTile,
  // A hand closing and opening on open bench space while an atom tile is armed is the second press.
  armedAtom:()=>armed?.kind==='atom'&&!isIonicBench(bench),pressSpace,
  prepare(source){if(source.element)element=source.element;if(source.kind==='bond')order=source.order;if(source.kind==='pair'){options.pairs=true;$('show-pairs').setAttribute('aria-pressed','true');}options.spin=false;$('spin').setAttribute('aria-pressed','false');render(false);}});
 document.addEventListener('keydown',e=>{
  if($('builder-mode').hidden||e.target.closest('input,textarea,select,[contenteditable]'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?restore(redo,undo):restore(undo,redo);}
  if(e.key==='Delete'&&!kit.active()&&selected!=null&&(e.target===$('builder-stage')||e.target.closest('#atom-list'))){e.preventDefault();$('unseat-atom').click();}
  if(e.key==='Escape'&&!e.defaultPrevented&&!kit.active()&&!e.target.closest('.ms-drawer,dialog')&&disarm())e.preventDefault();
 });
 function switchBench(target,{fromFile=false}={}){
  if(bench===target)return;
  $('bench-select').value=target;
  $('bench-select').dispatchEvent(new CustomEvent('change',{bubbles:true,detail:{fromFile}}));
 }
 function placeTableAtoms(symbols,{free=false,ionic=false}={}){
  if(symbols.some(symbol=>!bySymbol.get(symbol)?.available))throw Error('This element is reference only in the pilot.');
  if(ionic)switchBench(handsOn()?'transfer':'ionic');else if(free)switchBench('free');
  if(graph.atoms.length+symbols.length>MAX_ATOMS){
   const room=MAX_ATOMS-graph.atoms.length;
   throw Error(room?'There is room for '+room+' more. Uncheck some elements and try again.':'The bench is full. Uncheck the selection, close the table and remove an atom.');
  }
  const controls=viewer.controls,camera=controls.camera,startPosition=camera.position.clone();
  const onIonic=isIonicBench(bench);
  const message=symbols.length===1?ELEMENTS[symbols[0]].name+' placed.':symbols.length+' atoms placed.';
  const previous=element;
  element=symbols.at(-1);
  let fit=false;
  const ok=commit(g=>{
   const originalCount=g.atoms.length,firstId=g.nextId;
   let id;
   // Back the camera away only when needed. Keeping the field of view steady
   // avoids stretching spheres at the edges of a crowded bench.
   for(;;){
    for(const symbol of symbols){
     const point=handPlacement(viewer,g,symbol,onIonic?'ball':style);
     if(!point)break;
     id=placeLoose(g,symbol,point);
    }
    if(g.atoms.length===originalCount+symbols.length)return id;
    g.atoms.length=originalCount;g.nextId=firstId;
    if(camera.position.distanceTo(controls.target)>=camera.far/3){
     for(const symbol of symbols)id=placeLoose(g,symbol);
     fit=true;return id;
    }
    camera.position.sub(controls.target).multiplyScalar(1.35).add(controls.target);controls.update();
   }
  },onIonic?undefined:message);
  if(!ok){
   element=previous;camera.position.copy(startPosition);controls.update();
   throw Error($('builder-status').textContent);
  }
  if(fit)viewer.fit();
  return message;
 }
 // Read-only state and press actions for builder-ui.js (the studio layout). Every action goes
 // through the handlers above, so the layout adds no chemistry of its own.
 window.b06Builder={
  get bench(){return bench;},get graph(){return graph;},get selected(){return selected;},get focus(){return focus;},
  get armed(){return armed;},get joining(){return joining;},get transferFrom(){return transferFrom;},
  get element(){return element;},get order(){return order;},get style(){return style;},get options(){return options;},
  get checked(){return checked;},get rings(){return rings;},
  viewer,benchName,isIonic:()=>isIonicBench(bench),challenge:()=>CHALLENGES[bench]||null,passed:benchPassed,
  assessment:()=>CHALLENGES[bench]&&checked?assessChallenge(CHALLENGES[bench],graph):null,
  setBench:switchBench,pressTile,pressRing,pressSpace,disarm,
  toggleJoin(){if(isIonicBench(bench)||selected==null)return;armed=null;joining=!joining;render();},
  clearFocus(){if(!focus)return;focus=null;render();emit('select');},
  setBondOrder(n){
   if(focus?.kind!=='bond')return false;const {a,b}=focus;
   // The same edit as dropping a bond piece of order n onto this bond.
   return commit(g=>{connect(g,a,b,n);return selected;},'Bond order changed. Positions unchanged.');
  },
  removeFocused(){
   if(focus?.kind==='bond')returnPart({edge:{a:focus.a,b:focus.b}});
   else if(focus?.kind==='pair')returnPart({owner:focus.owner,index:focus.index});
  },
  spread(n){if(selected==null)return;$('edit-arrangement').value=String(n);$('align-domains').click();},
 };
 render(storageIssue||undefined);viewer.fit();
 document.dispatchEvent(new Event('b06-builder-ready'));
 return {getState:()=>clone(graph),viewer,placeTableAtoms};
}
