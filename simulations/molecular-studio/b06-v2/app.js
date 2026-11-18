import './studio.js';
import {LETTERS, MOLECULES, newBuild, angle, counts, evaluate, differentCameras, isBond, partLabel, netOptions, caseFacts} from './chemistry.js';
import {syncChoices} from './choices.js';
import {bondSpec,normalizedTorsion,rotationRule} from './vsepr-kit.js';
import {installWorkshop} from './vsepr-workshop.js';
import {assemblyProblem,electronLedger,migrateLegacyAssembly} from './vsepr-assembly.js';
import {createShapesUI,angleName} from './shapes-ui.js';

const $=id=>document.getElementById(id);
// Version 2 (b06-v2) keeps its own progress; a first visit starts from version 1's.
const storageKey='virtualLab:b06-v2:guided-sites:v3';
const STAGES=['Build','Predict','Observe','Compare'];
let stored={};
try { stored=JSON.parse(localStorage.getItem(storageKey)??localStorage.getItem('virtualLab:b06:guided-sites:v3')) || {}; } catch {}
let legacy={};
if(!stored.books)try{legacy=JSON.parse(localStorage.getItem('virtualLab:b06:guided-sites:v2'))||{};}catch{}
if(!stored.species)stored.species=legacy.species;
let species=Object.hasOwn(MOLECULES,stored.species)?stored.species:'ch4';
const books={};
for(const [id,m] of Object.entries(MOLECULES)){
  const option=new Option(m.formula+' · '+m.name,id);
  option.title=m.name;
  option.setAttribute('aria-label',m.formula+' · '+m.name);
  $('species').add(option);
  const b=newBuild(m), saved=stored.books?.[id]||migrateLegacyAssembly(m,legacy.books?.[id]);
  const validSites=sites=>!assemblyProblem(m,sites);
  if(validSites(saved?.sites)){
    b.sites=saved.sites;
    for(const key of ['shape','dipole','reason','domainAnswer','first','second']){
      if(typeof saved[key]==='string')b[key]=saved[key];
    }
    b.atoms=saved.atoms===true;
    b.camera=saved.camera;
    b.revision=Number.isSafeInteger(saved.revision)?saved.revision:0;
    const cleanTorsions=value=>Object.fromEntries(LETTERS.flatMap((letter,i)=>{
      const part=m.pieces[b.sites[i]];return part&&rotationRule(part).enabled?[[letter,normalizedTorsion(part,value?.[letter])]]:[];
    }));
    b.torsions=cleanTorsions(saved.torsions);
    b.bondSite=LETTERS.includes(saved.bondSite)?saved.bondSite:'';
    b.undo=Array.isArray(saved.undo)?saved.undo.filter(u=>validSites(u?.sites||u)).slice(-40).map(u=>({sites:u.sites||u,torsions:u.torsions||{}})):[];
    b.angles=Array.isArray(saved.angles)?saved.angles.filter(a=>a && validSites(a.sites)&&
      Number.isFinite(a.value)&&Number.isFinite(a.entered)&&(a.projected===null||Number.isFinite(a.projected))&&Array.isArray(a.pose?.position)):[];
    b.attempts=Array.isArray(saved.attempts)?saved.attempts.filter(a=>a && validSites(a.sites)&&typeof a.result?.pass==='boolean'):[];
    b.events=Array.isArray(saved.events)?saved.events.filter(e=>e && typeof e.title==='string'&&typeof e.detail==='string'):[];
    if(Number.isInteger(saved.step)&&saved.step>=0&&saved.step<=3&&(saved.step!==3||b.attempts.length))b.step=saved.step;
  }
  books[id]=b;
}
const book=()=>books[species], molecule=()=>MOLECULES[species];
const note=text=>{$('notice').textContent=text;};
const guide=text=>{$('live-guide').textContent=text;};
let viewer,tool='bond',reference=false,refCamera=null,firstPick=true,configuredCase=null;
let twistUndo=null;
const snapshotBuild=()=>({sites:[...book().sites],torsions:{...book().torsions}});
const workshop=installWorkshop({
 selectBond(letter){book().bondSite=letter;workshop.update(molecule(),book(),reference);save();},
 turnBond(value,finished){
  const b=book(),part=molecule().pieces[b.sites[LETTERS.indexOf(b.bondSite)]];
  if(reference||!part||!rotationRule(part).enabled)return;
  if(!twistUndo){twistUndo=snapshotBuild();b.undo.push(twistUndo);if(b.undo.length>40)b.undo.shift();}
  b.torsions[b.bondSite]=normalizedTorsion(part,value);
  viewer.show({m:molecule(),sites:b.sites,torsions:b.torsions,atoms:b.atoms,step:b.step,reference:false,arrows:$('arrows').checked});
  workshop.update(molecule(),b,false);refreshGauge();$('undo').disabled=false;
  if(finished){event('Bond rotation',b.bondSite+' · '+partLabel(molecule(),b.sites[LETTERS.indexOf(b.bondSite)])+' turned to '+b.torsions[b.bondSite]+'°. Connector length and local bond angles unchanged.');twistUndo=null;renderNotes();save();}
 },
 alongBond(index){viewer.alongBond(index);},
});
const sameSites=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
const kindName=kind=>partLabel(molecule(),kind);
const quantity=(n,noun)=>n+' '+noun+(n===1?'':'s');
const arrangement=sites=>sites.flatMap((k,i)=>k==='empty'?[]:[LETTERS[i]+' '+kindName(k)]).join(' · ');
const order=()=>book().angles.length+book().attempts.length+book().events.length+1;
const netText=(value)=>netOptions(molecule()).find(([key])=>key===value)?.[1]||'Choose a result';
// Runtime-built notes sit next to existing elements so the page markup stays unchanged.
function noteAfter(id,anchor,className='small'){
  let el=$(id);
  if(!el&&anchor){el=document.createElement('p');el.id=id;if(className)el.className=className;anchor.after(el);}
  return el;
}
const shapeHint=noteAfter('shape-hint',$('shape')?.closest('label'));
if(shapeHint)shapeHint.textContent='Every piece on the hub, bond or lone pair, is one electron domain. Electron geometry is the arrangement of all of them. Molecular shape names only where the atoms are.';
// Shapes controls (buttons for the set, molecule, Predict answers, gauge sites and views).
// Created before the Next listener below so it can step through Predict questions first.
const shapes=createShapesUI({book,books,molecule,species:()=>species,reference:()=>reference,
  observations:(...a)=>observations(...a),currentAngle:(...a)=>currentAngle(...a),angleText:(...a)=>angleText(...a),
  inspect:i=>inspect(i),go:s=>go(s),note,refresh:()=>{if(viewer)render();}});

function configureCase(){
  if(configuredCase===species)return;
  configuredCase=species;
  const m=molecule(), other=m.pieces.other;
  $('bond-label').textContent=partLabel(m,'bond');
  for(const kind of ['bond','other']){
    const part=m.pieces[kind];if(!part)continue;
    const length=bondSpec(m.center,part);
    $('bin-'+kind).title=partLabel(m,kind)+' · approximately '+length.pm+' pm · '+rotationRule(part).label;
  }
  $('bin-other').hidden=!other;
  const otherOption=$('tool').querySelector('[value="other"]');
  otherOption.hidden=!other;
  if(other){
    $('other-label').textContent=partLabel(m,'other');
    otherOption.textContent=$('other-label').textContent;
  }
  $('tool').querySelector('[value="bond"]').textContent=$('bond-label').textContent;
  $('task').textContent=m.name+' · '+m.task;
  $('bin-pair').hidden=m.pairs===0;
  $('tool').querySelector('[value="pair"]').hidden=m.pairs===0;
  $('socket-map').textContent=m.domains+' domain sockets. '+(m.domains===5?'A–C are equatorial; D and E are axial.':m.domains===6?'A/B, C/D and E/F are opposite pairs.':m.domains===4?'A–D point toward the corners of a tetrahedron.':m.domains===3?'A–C lie in one plane, 120° apart.':'A and B point in opposite directions.');
  $('dipole').replaceChildren(new Option('Choose a result',''),...netOptions(m).map(([key,label])=>new Option(label,key)));
  $('angle-entry').value='';
}

function save(){
  try{localStorage.setItem(storageKey,JSON.stringify({species,books}));}
  catch{$('save-status').textContent='Browser storage is unavailable. Field notes are available for this visit.';}
}
function event(title,detail,data={}){
  book().events.push({order:order(),title,detail,...data});
}
function reject(message,atBench=false){
  event('Action held',message,{step:book().step,sites:[...book().sites]});
  if(atBench){note('');guide(message);}else note(message);
  renderNotes();save();
}
function choose(next){
  tool=next;$('tool').value=tool;
  $('apply').textContent={bond:'Seat piece',other:'Seat piece',pair:'Seat piece',empty:'Remove piece',move:'Move piece'}[tool];
  $('move-source').hidden=tool!=='move';$('site-label').textContent=tool==='move'?'To site':'Site';
  document.querySelectorAll('[data-tool]').forEach(bin=>bin.setAttribute('aria-pressed',String(bin.dataset.tool===tool)));
  syncChoices();
}
function changeBuild(next,description,stash=true,torsions=null){
  const b=book();
  const problem=assemblyProblem(molecule(),next);if(problem)return reject(problem);
  if(stash){b.undo.push(snapshotBuild());if(b.undo.length>40)b.undo.shift();}
  const newGroup=next.findIndex((kind,i)=>kind!==b.sites[i]&&molecule().pieces[kind]?.group);
  if(newGroup>=0)b.bondSite=LETTERS[newGroup];
  b.torsions=torsions||Object.fromEntries(LETTERS.flatMap((letter,i)=>next[i]===b.sites[i]&&b.torsions[letter]!=null?[[letter,b.torsions[letter]]]:[]));twistUndo=null;
  b.sites=next;b.revision++;b.step=0;reference=false;b.atoms=false;
  event('Assembly edit',description,{sites:[...next]});
  render();note('');guide(description);save();
}
function place(i,kind=tool){
  if(book().step!==0)return reject('Return to Build before fitting another piece.');
  if(!Number.isInteger(i)||i<0||i>=molecule().domains)return reject('This hub has '+molecule().domains+' domain sockets. Choose one of its labelled sites.');
  if(isBond(kind)&&!molecule().pieces[kind])return reject('Choose a bond piece from this case.');
  if(kind==='empty'){remove(i);return;}
  if(kind==='move'){move(LETTERS.indexOf($('source-site').value),i);return;}
  if(book().sites[i]!=='empty')return reject('Site '+LETTERS[i]+' already holds a piece. Unplug it before seating another.');
  const next=[...book().sites];next[i]=kind;
  changeBuild(next,'Seated '+kindName(kind)+' at '+LETTERS[i]+'.');
}
function remove(i){
  if(!Number.isInteger(i)||i<0||i>=molecule().domains)return reject('Choose a fitted socket first.');
  if(book().sites[i]==='empty')return reject('Site '+LETTERS[i]+' has no piece to remove.');
  const next=[...book().sites];next[i]='empty';
  changeBuild(next,'Returned the piece from '+LETTERS[i]+' to the tray.');
}
function move(from,to){
  if(!Number.isInteger(from)||from<0||from>=molecule().domains||book().sites[from]==='empty')return reject('Choose a fitted piece to move.');
  if(!Number.isInteger(to)||to<0||to>=molecule().domains)return reject('Choose one of this hub’s labelled sites.');
  if(book().sites[to]!=='empty')return reject('Site '+LETTERS[to]+' is occupied. Choose an empty socket.');
  const next=[...book().sites];next[to]=next[from];next[from]='empty';
  const torsions={...book().torsions};if(torsions[LETTERS[from]]!=null)torsions[LETTERS[to]]=torsions[LETTERS[from]];delete torsions[LETTERS[from]];
  changeBuild(next,'Moved '+kindName(next[to])+' from '+LETTERS[from]+' to '+LETTERS[to]+'.',true,torsions);
}
function editOptions(){
  const b=book(),m=molecule();
  const letters=LETTERS.slice(0,m.domains);
  const site=$('site'), selected=site.value||'A';
  site.replaceChildren(...letters.map((letter,i)=>new Option(letter+' · '+kindName(b.sites[i]),letter)));
  site.value=letters.includes(selected)?selected:letters[0];
  [...site.options].forEach((opt,i)=>opt.setAttribute('aria-label',LETTERS[i]+', '+m.hub.names[i]+', '+kindName(b.sites[i])));
  const from=$('source-site'),oldFrom=from.value;
  from.replaceChildren(...letters.flatMap((l,i)=>b.sites[i]==='empty'?[]:[new Option(l+' · '+kindName(b.sites[i]),l)]));
  if([...from.options].some(o=>o.value===oldFrom))from.value=oldFrom;
  const n=counts(b.sites);
  $('counts').textContent=(m.ligands.some(p=>p.group)?'C₁: ':'')+quantity(n.bonds,'bonded atom')+' · '+quantity(n.pairs,'central lone pair');
  const ledger=electronLedger(m,b.sites),target=electronLedger(m,m.reference);
  const budget=noteAfter('valence-ledger',$('counts').closest('.inventory'),'small');
  budget.textContent=m.center+(m.charge?'⁺':'')+': '+ledger.bondOrder+'/'+target.bondOrder+' shared pairs fitted · '+ledger.lonePairs+'/'+m.pairs+' lone pairs. '+m.domains+' sockets = electron domains, not individual electrons.';
  for(const kind of ['bond','other','pair']){
    const count=kind==='pair'?m.pairs:m.pieces[kind]?.count||0;
    const left=count-b.sites.filter(k=>k===kind).length;
    const bin=$('bin-'+kind);bin.disabled=left<=0;
    bin.querySelector('.part-name').textContent=kind==='pair'?'Lone pair':m.pieces[kind]?partLabel(m,kind):'Bond piece';
    $('count-'+kind).textContent=left+' left';
    bin.setAttribute('aria-label',bin.querySelector('.part-name').textContent+' · '+left+' left');
  }
  $('undo').disabled=!b.undo.length;
  choose(tool);
}
function currentAngle(){
  const b=book(),i=LETTERS.indexOf(b.first),j=LETTERS.indexOf(b.second);
  if(!viewer||i<0||j<0||i===j||b.sites[i]==='empty'||b.sites[j]==='empty')return null;
  return {i,j,first:b.first,second:b.second,firstKind:b.sites[i],secondKind:b.sites[j],
    value:angle(viewer.dirs,i,j),projected:viewer.projection(i,j)};
}
function angleText(value){return value==null?'End-on':value.toFixed(1)+'°';}
function samePair(a,c){return a.first===c.first&&a.second===c.second||a.first===c.second&&a.second===c.first;}
function observations(){
  const a=currentAngle(),b=book();
  if(!a)return {readings:[],pair:null};
  const readings=b.angles.filter(entry=>entry.pose&&entry.revision===b.revision&&samePair(entry,a)&&sameSites(entry.sites,b.sites));
  for(let k=readings.length-1;k>=0;k--){
    const second=readings[k];
    const first=readings.slice(0,k).find(entry=>differentCameras(entry.pose,second.pose));
    if(first)return {readings,pair:[first,second]};
  }
  return {readings,pair:null};
}
function updateObservation(){
  if(book().step===2){
    const o=observations();
    $('observation-status').textContent=o.pair?
      'Two views recorded · '+o.pair.map(r=>angleText(r.projected)).join(' and ')+' on screen. Compare them with the 3D reading.':
      o.readings.length?'One camera direction recorded. Turn at least 12° or choose another view, then record this pair again.':
      'Record the first reading with the angle gauge.';
  }
  shapes.sync();
}
function instrument(){
  const a=currentAngle();
  $('angle-value').value=a?angleText(a.value):'None yet';
  $('screen-value').value=a?angleText(a.projected):'None yet';
  $('reference-gauge').hidden=!reference;$('gauge-body').hidden=reference;
  $('gauge-summary').textContent=reference?'Assembly readings':a&&($('gauge').open||book().step>=2)?angleName(molecule(),book().sites,a.first,a.second)+' · '+angleText(a.value):'';
  const recording=book().step===2&&!reference;
  $('record').disabled=!a||!recording;
  $('angle-entry').disabled=!a||!recording;
  $('record').closest('.gauge-entry').hidden=!recording;
  shapes.instrument();
}
function gaugeOptions(){
  const b=book();
  const occupied=LETTERS.slice(0,molecule().domains).filter((_,i)=>b.step===2?isBond(b.sites[i]):b.sites[i]!=='empty');
  const preferred=occupied.filter(l=>isBond(b.sites[LETTERS.indexOf(l)])).concat(occupied.filter(l=>b.sites[LETTERS.indexOf(l)]==='pair'));
  if(!occupied.includes(b.first))b.first=preferred[0]||'';
  if(!occupied.includes(b.second)||b.second===b.first)b.second=preferred.find(letter=>letter!==b.first)||'';
  for(const field of ['first','second']){
    const select=$(field);select.replaceChildren();
    if(!b[field])select.add(new Option('Choose site',''));
    for(const l of occupied)select.add(new Option(l+' · '+kindName(b.sites[LETTERS.indexOf(l)]),l));
    select.value=b[field];select.disabled=reference||!occupied.length;
  }
}
function refreshGauge(){
  const a=currentAngle();
  viewer.setGauge($('gauge').open&&a&&!reference?[a.i,a.j]:null);
  instrument();updateObservation();
}
function record(){
  const a=currentAngle(),b=book();
  if(!a||reference||b.step!==2||!isBond(a.firstKind)||!isBond(a.secondKind))return;
  const entered=$('angle-entry').valueAsNumber;
  if(!Number.isFinite(entered)||Math.abs(entered-a.value)>.51||entered<0||entered>180){
    guide('Enter the 3D model angle from the gauge, to the nearest degree or tenth of a degree.');
    $('angle-entry').focus();
    return;
  }
  const {i,j,...values}=a;
  $('angle-entry').value='';
  b.angles.push({...values,entered,sites:[...b.sites],pose:viewer.pose(),revision:b.revision,order:order()});
  const message='Recorded '+angleName(molecule(),b.sites,a.first,a.second)+' · '+angleText(a.value)+' in 3D, '+angleText(a.projected)+' on screen.';
  guide(message);note('');updateObservation();renderNotes();save();
}
function inspect(i){
  if(book().step!==2||!isBond(book().sites[i]))return;
  if(!$('gauge').open)$('gauge').open=true;
  book()[firstPick?'first':'second']=LETTERS[i];
  firstPick=!firstPick;gaugeOptions();refreshGauge();save();
  guide('Gauge site '+LETTERS[i]+' selected. '+(firstPick?'The next click chooses the first site.':'Choose the second site.'));
}
function row(title,lines){
  const el=document.createElement('div');el.className='entry';
  const h=document.createElement('strong');h.textContent=title;el.append(h);
  lines.filter(Boolean).forEach(text=>{const p=document.createElement('p');p.textContent=text;el.append(p);});
  return el;
}
function renderNotes(){
  const b=book();
  $('notebook-label').textContent='Field notes · '+molecule().formula+' ('+quantity(b.angles.length,'reading')+', '+quantity(b.attempts.length,'attempt')+')';
  if(!$('notebook').open)return;
  const records=b.events.map(e=>({n:e.order,el:row(e.title,[e.detail])}));
  b.angles.forEach((a,k)=>records.push({n:a.order,el:row('Reading '+(k+1)+' · '+angleName(molecule(),a.sites,a.first,a.second)+' = '+angleText(a.value),
    ['Entered '+a.entered+'° · '+a.pose.preset+' view · '+angleText(a.projected)+' on screen.',arrangement(a.sites)])}));
  b.attempts.forEach((attempt,k)=>records.push({n:attempt.order,el:row('Attempt '+(k+1)+' · '+(attempt.result.pass?'Matches reference':'Revise'),
    [arrangement(attempt.sites),'Prediction · '+attempt.domainAnswer+' domains · '+attempt.shape+' · '+netText(attempt.dipole),
     attempt.reason,attempt.result.message])}));
  $('entries').replaceChildren(...records.sort((a,b)=>b.n-a.n).map(r=>r.el));
  if(!records.length)$('entries').textContent='Your assembly edits, predictions, readings and checked attempts appear here.';
}
function feedback(){
  const attempt=book().attempts.at(-1);
  if(book().step!==3||!attempt)return;
  const r=attempt.result;
  $('result-title').textContent=r.pass?'Model and predictions match':'Diagnose the attempt';
  // One piece of advice under the checks. On a match the evidence part of the message is
  // already the first reference note, so only the real-molecule fact and the next step show here.
  const m0=molecule();
  $('result-body').textContent=r.pass&&(m0.real||m0.next)?[m0.real,m0.next].filter(Boolean).join(' '):r.message;
  // The hand layout's narrower check list shows the short labels.
  $('criteria').replaceChildren(...[['inventory','Atoms, bonds and lone pairs','Pieces on the hub'],['domains','Central domain count','Domain count'],['geometry','3D arrangement','3D arrangement'],['shape','Predicted shape','Predicted shape'],['dipole','Bond-arrow result','Bond-arrow result']].map(([key,title,short])=>{
    const group=document.createElement('div'),name=document.createElement('dt'),value=document.createElement('dd');
    const long=document.createElement('span'),brief=document.createElement('span');
    long.className='ms-long';long.textContent=title;brief.className='ms-short';brief.textContent=short;
    name.append(long,brief);value.dataset.key=key;
    const tag=document.createElement('span'),word=document.createElement('span');tag.className='ms-tag '+(r[key]?'ok':'no');
    // The hand layout shows only the mark; the word stays for screen readers.
    word.className='ms-tagword';word.textContent=r[key]?'Matches':'Revisit';tag.append(r[key]?'✓ ':'✗ ',word);
    value.className=r[key]?'ok':'fix';value.append(tag);group.append(name,value);return group;
  }));
  $('compare').textContent=reference?'Show my model':'Inspect reference';
  $('reference-notes').hidden=!reference;
  $('observed').textContent=molecule().evidence;
  const m=molecule(),f=caseFacts(m);
  $('ideal').textContent='Electron geometry: '+f.electron.toLowerCase()+', '+f.domains+' pieces on the hub at the ideal '+f.ideal+'. Molecular shape: '+f.shape.toLowerCase()+
    (m.pairs?', named from the atom positions only, because lone-pair pieces are not part of the shape name.':', the same name, because the hub carries no lone-pair piece.')+' The hub sockets give ideal angles.';
  const bonding=noteAfter('case-bonding',$('ideal'),'');
  bonding.textContent=(f.hybrid?m.center+' is '+f.hybrid+' hybridized in the AP model ('+f.domains+' domains). ':'No sp³d or sp³d² assignment is made: these are geometry labels, not a d-orbital bonding explanation. ')+
    (m.delocalized?'At the hub: '+f.sigma+' σ bonds with delocalized π bonding across S–O. The double rails depict one Lewis representation.':
    'At the hub: '+f.sigma+' σ and '+f.pi+' π.'+
    (f.pi?' A double bond adds one π bond; a triple bond adds two. Each connection still fills one socket.':' Every single-bond piece is one σ bond.'));
  const physical=$('physical-reference');
  physical.hidden=!m.physical;
  physical.replaceChildren();
  if(m.physical){
    const source=document.createElement('a');
    source.href=m.physical.url;source.textContent=m.physical.author;source.target='_blank';source.rel='noreferrer';
    physical.append(m.physical.text+' ',source);
  }
  const why=noteAfter('angle-why',physical,'');
  why.hidden=!m.why;why.textContent=m.why||'';
  $('reference-inventory').textContent=Object.entries(m.pieces).map(([kind,p])=>
    p.count+' × '+partLabel(m,kind)+' ('+quantity(p.lonePairs,'lone pair')+' on each '+p.element+')').join(' · ')+
    ' · '+quantity(m.pairs,'lone pair')+' on '+m.center+'.';
  const negligible=m.ligands.some(p=>p.arrow===0);
  const weak=m.ligands.some(p=>p.arrow!==0&&Math.abs(p.arrow)<1);
  const polar=m.ligands.some(p=>p.arrow!==0);
  $('arrow-legend').textContent=[polar?'Teal arrows point toward the electron-rich (δ−, more electronegative) end of each polar bond.':'',
    weak?'Short teal arrows represent weaker bond-dipole contributions.':'',
    negligible?'Negligible or deliberately omitted bond contributions have no arrow; see the molecule notes.':'',
    m.net==='none'?'The bond arrows sum to zero.':'The gold arrow shows the direction of the bond-arrow sum.',
    'Arrow lengths are illustrative.'].filter(Boolean).join(' ');
}
function render(){
  const b=book(),m=molecule();
  configureCase();
  $('species').value=species;
  for(const el of document.querySelectorAll('[data-step]'))el.hidden=Number(el.dataset.step)!==b.step;
  [...$('steps').children].forEach((el,i)=>{
    if(i===b.step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
    el.classList.toggle('done',i<b.step);
  });
  $('domainAnswer').value=b.domainAnswer;$('shape').value=b.shape;$('dipole').value=b.dipole;$('reason').value=b.reason;$('atoms').checked=b.atoms;
  $('back').hidden=b.step===0;
  $('stage-title').textContent=m.formula+' · '+m.name;
  $('tray-note').textContent=shapes.trayNote(b,reference);
  editOptions();gaugeOptions();feedback();
  viewer.show({m,sites:b.sites,torsions:b.torsions,atoms:b.atoms,step:b.step,reference,arrows:$('arrows').checked});
  workshop.update(m,b,reference);
  refreshGauge();renderNotes();
  syncChoices();
  guide(shapes.coach(b,reference));
  shapes.render();
}
function go(step){
  const b=book();
  if(reference){reference=false;viewer.restore(b.camera);}
  b.step=step;firstPick=true;
  $('gauge').open=step===2;
  if(step===0)b.atoms=false;
  note('');render();save();
  const heading=document.querySelector('[data-step="'+step+'"] h2');
  heading.tabIndex=-1;heading.focus({preventScroll:true});
}
function advance(){
  const b=book();
  if(b.step===0){
    if(b.sites.filter(isBond).length<2)return reject('Seat at least two bond pieces so the angle gauge can measure a bond angle.');
    go(1);return;
  }
  if(b.step===1){
    if(!b.shape||!b.dipole||!Number.isInteger(Number(b.domainAnswer))||Number(b.domainAnswer)<1||Number(b.domainAnswer)>6)return reject('Enter a domain count from 1 to 6 and choose both the shape and the bond-arrow result.');
    event('Prediction saved',b.domainAnswer+' domains · '+b.shape+' · '+netText(b.dipole),{shape:b.shape,dipole:b.dipole,sites:[...b.sites]});
    go(2);return;
  }
  if(b.step===2){
    const o=observations();
    if(!o.pair)return reject('Record the same site pair from two camera directions before comparing.');
    if(!b.reason.trim()){reject('Write what you observed in the two views.');$('reason').focus();return;}
    const result=evaluate(molecule(),b,viewer.dirs);
    b.attempts.push({domainAnswer:b.domainAnswer,shape:b.shape,dipole:b.dipole,reason:b.reason,sites:[...b.sites],readings:o.pair.map(a=>a.order),result,order:order()});
    go(3);return;
  }
  // Compare: a checked match moves on to the next molecule not yet passed (this set first, then
  // the following sets; the set follows the molecule); when all have passed, the next in the set.
  if(b.attempts.at(-1)?.result.pass){
    const ids=[...$('species').options].filter(o=>!o.hidden).map(o=>o.value);
    const next=shapes.nextMolecule()||ids[(ids.indexOf(species)+1)%ids.length];
    if(next&&next!==species){$('species').value=next;$('species').dispatchEvent(new Event('change'));
      const heading=document.querySelector('[data-step="'+book().step+'"] h2');heading.tabIndex=-1;heading.focus({preventScroll:true});return;}
  }
  go(0);
}
function compare(){
  reference=!reference;
  viewer.restore(reference?refCamera:book().camera);
  render();
}
function reset(){
  const b=book();
  if(b.sites.some(x=>x!=='empty')){b.undo.push(snapshotBuild());if(b.undo.length>40)b.undo.shift();}
  b.torsions={};b.bondSite='';twistUndo=null;
  b.sites=molecule().hub.vectors.map(()=>'empty');b.step=0;b.revision++;b.atoms=false;b.camera=null;b.first='';b.second='';
  reference=false;refCamera=null;$('angle-entry').value='';choose('bond');$('gauge').open=false;
  event('Build reset','Cleared the hub. Saved drafts, readings and attempts are retained.');
  viewer.restore(null,molecule());render();guide('Hub cleared. Undo restores the previous placements.');save();
}
try{
  const {createViewer}=await import('./viewer.js');
  viewer=await createViewer($('visual'),{place,move,remove,choose,inspect,reject:msg=>reject(msg,true),guide,instrument,
    reveal:()=>{book().atoms=false;render();save();},
    camera:pose=>{if(reference)refCamera=pose;else{book().camera=pose;save();}instrument();}
  });
  $('station').inert=false;$('species').disabled=false;$('loading').hidden=true;
}catch(error){
  $('loading').textContent='The local modeling kit could not open. Reload the page with WebGL and the shared renderer available.';
  console.error(error);
}
if(viewer){
  $('species').addEventListener('change',()=>{
    species=$('species').value;reference=false;refCamera=null;firstPick=true;choose('bond');note('');
    $('gauge').open=book().step===2;viewer.restore(book().camera,molecule());render();save();
  });
  $('tool').addEventListener('change',()=>choose($('tool').value));
  $('apply').addEventListener('click',()=>place(LETTERS.indexOf($('site').value)));
  $('undo').addEventListener('click',()=>{const last=book().undo.pop();if(last)changeBuild(last.sites,'Restored the previous placements and bond rotation.',false,last.torsions);});
  $('reset').addEventListener('click',reset);
  $('next').addEventListener('click',advance);
  $('back').addEventListener('click',()=>go(Math.max(0,book().step-1)));
  for(const field of ['domainAnswer','shape','dipole','reason'])$(field).addEventListener('input',()=>{book()[field]=$(field).value;note('');save();});
  $('record').addEventListener('click',record);
  $('angle-entry').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();record();}});
  $('gauge').addEventListener('toggle',refreshGauge);
  $('notebook').addEventListener('toggle',renderNotes);
  for(const field of ['first','second'])$(field).addEventListener('change',()=>{
    const b=book(),old=b[field],other=field==='first'?'second':'first';
    b[field]=$(field).value;if(b[field]===b[other])b[other]=old;
    $('angle-entry').value='';gaugeOptions();refreshGauge();syncChoices();save();
  });
  $('view').addEventListener('change',()=>viewer.view($('view').value));
  $('fit').addEventListener('click',()=>viewer.view('Oblique'));
  $('zoom-in').addEventListener('click',()=>viewer.zoom(1.2));$('zoom-out').addEventListener('click',()=>viewer.zoom(1/1.2));
  $('roll').addEventListener('click',()=>viewer.roll(Math.PI/8));
  document.addEventListener('b06-mode',()=>viewer.redraw());
  // The studio shell can resize the model area without resizing the scene host.
  new ResizeObserver(()=>viewer.redraw()).observe($('viewport'));
  $('left').addEventListener('click',()=>viewer.turn(-Math.PI/8));$('right').addEventListener('click',()=>viewer.turn(Math.PI/8));
  $('atoms').addEventListener('change',()=>{book().atoms=$('atoms').checked;render();save();});
  $('return-model').addEventListener('click',compare);
  $('arrows').addEventListener('change',render);$('compare').addEventListener('click',compare);
  $('gauge').open=book().step===2;viewer.restore(book().camera,molecule());render();
}
