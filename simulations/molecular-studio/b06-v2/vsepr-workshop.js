import {bondSpec,bondName,bondSymbol,rotationRule,normalizedTorsion} from './vsepr-kit.js';
import {ELEMENTS} from './molecule-model.js';
import {LETTERS,MOLECULES,isBond,partLabel} from './chemistry.js';
const $=id=>document.getElementById(id);

export function installWorkshop(actions){
 const library=document.createElement('div');library.className='vsepr-library';
 library.innerHTML='<label for="vsepr-set">Molecules to try</label><select id="vsepr-set" data-choice="chips" aria-label="Practice set"></select><p id="vsepr-library-note" class="small"></p>';
 const molecule=document.querySelector('.molecule');
 const picker=document.createElement('details');picker.className='vsepr-library-picker';picker.id='vsepr-library-picker';
 const heading=document.createElement('summary');heading.innerHTML='Molecules to try <strong id="vsepr-current-molecule"></strong>';
 molecule.before(picker);picker.append(heading,library,molecule);
 $('species').dataset.choice='list';
 for(const category of [...new Set(Object.values(MOLECULES).map(m=>m.category))])$('vsepr-set').add(new Option(category,category));
 $('vsepr-set').add(new Option('All molecules','all'));
 let category=null,changingSet=false,hadBond=false;
 $('species').addEventListener('change',()=>{if(!changingSet)picker.open=false;});
 function filter(value){
  category=value;$('vsepr-set').value=value;
  for(const option of $('species').options)option.hidden=value!=='all'&&MOLECULES[option.value].category!==value;
  $('vsepr-library-note').textContent=value==='Bond comparison'?'Compare the same two carbons: single → double → triple.':value==='Five & six domains'?'Separate electron geometry from the shape of the atoms.':'Choose a model, sketch its Lewis structure, then fit the pieces.';
 }
 $('vsepr-set').onchange=()=>{
  filter($('vsepr-set').value);
  if($('species').selectedOptions[0]?.hidden){
   $('species').value=[...$('species').options].find(o=>!o.hidden).value;
   changingSet=true;$('species').dispatchEvent(new Event('change',{bubbles:true}));changingSet=false;
  }
 };
 const inventory=document.createElement('details');inventory.className='vsepr-kit-inventory';
 inventory.innerHTML='<summary>Kit contents <span>15 atom types</span></summary><div class="vsepr-elements"></div><p class="small">Single, double and triple connectors; central lone-pair inserts; paired electron dots on terminal atoms. Each model supplies its matching parts.</p>';
 for(const symbol of ['H','C','N','O','F','B','Be','Si','P','S','Cl','Se','Br','I','Xe']){
  const entry=document.createElement('span');entry.className='vsepr-element';
  const orb=document.createElement('i');orb.textContent=symbol;orb.style.setProperty('--atom-color',ELEMENTS[symbol].color);orb.style.color=ELEMENTS[symbol].ink||'#fff';
  const name=document.createElement('span');name.textContent=ELEMENTS[symbol].name;entry.append(orb,name);inventory.querySelector('.vsepr-elements').append(entry);
 }
 picker.after(inventory);
 const workshop=document.createElement('details');workshop.id='vsepr-workshop';workshop.className='vsepr-workshop';
 workshop.innerHTML=`<summary>Bond workshop <span id="vsepr-bond-summary">Fit a bond to inspect it</span></summary>
  <label for="vsepr-bond-site">Fitted bond</label><select id="vsepr-bond-site" data-choice="chips" aria-label="Fitted bond"></select>
  <div class="vsepr-bond-readout"><div><span>Nucleus-to-nucleus</span><strong id="vsepr-bond-length">None yet</strong></div><div><span>Bond components</span><strong id="vsepr-bond-components">None yet</strong></div></div>
  <p id="vsepr-bond-basis" class="small"></p><p id="vsepr-bond-pairs" class="small"></p>
  <div class="vsepr-rotation-heading"><strong id="vsepr-rotation-rule">Choose a fitted bond</strong><output id="vsepr-torsion-value" for="vsepr-torsion">Not available</output></div>
  <label class="vsepr-slider-label" for="vsepr-torsion">Turn attached group</label><input id="vsepr-torsion" type="range" min="0" max="360" step="5" value="60" disabled>
  <div class="vsepr-turn-buttons"><button id="vsepr-turn-back" type="button" disabled>↶ 30°</button><button id="vsepr-turn-forward" type="button" disabled>↷ 30°</button><button id="vsepr-end-on" type="button" disabled>Along this bond</button></div>
  <p id="vsepr-rotation-note" class="small">Fit a piece to see its length, lone pairs and rotation behavior.</p>
  <p id="vsepr-carbon-connections" class="small" hidden></p><p id="vsepr-overlap-note" class="small" hidden></p>`;
 $('gauge').before(workshop);
 $('vsepr-bond-site').onchange=()=>actions.selectBond($('vsepr-bond-site').value);
 $('vsepr-torsion').oninput=()=>actions.turnBond(Number($('vsepr-torsion').value),false);
 $('vsepr-torsion').onchange=()=>actions.turnBond(Number($('vsepr-torsion').value),true);
 $('vsepr-turn-back').onclick=()=>actions.turnBond((Number($('vsepr-torsion').value)+330)%360,true);
 $('vsepr-turn-forward').onclick=()=>actions.turnBond((Number($('vsepr-torsion').value)+30)%360,true);
 $('vsepr-end-on').onclick=()=>actions.alongBond(LETTERS.indexOf($('vsepr-bond-site').value));
 return {update(m,b,reference){
  $('vsepr-current-molecule').textContent=m.formula+' · '+m.name;
  if(category==null||(category!=='all'&&category!==m.category))filter(m.category);
  const sites=reference?m.reference:b.sites;
  const occupied=sites.flatMap((kind,i)=>isBond(kind)?[i]:[]);
  if(!occupied.includes(LETTERS.indexOf(b.bondSite))){
   b.bondSite=LETTERS[occupied.find(i=>m.pieces[sites[i]].group)??occupied[0]]||'';
  }
  const select=$('vsepr-bond-site');
  const signature=occupied.map(i=>i+sites[i]).join('|');
  if(select.dataset.signature!==signature){
   select.replaceChildren(...occupied.map(i=>new Option(LETTERS[i]+' · '+partLabel(m,sites[i]),LETTERS[i])));select.dataset.signature=signature;
  }else for(const option of select.options)option.textContent=option.value+' · '+partLabel(m,sites[LETTERS.indexOf(option.value)]);
  select.value=b.bondSite;select.disabled=!occupied.length;
  const part=m.pieces[sites[LETTERS.indexOf(b.bondSite)]];
  if(!!part!==hadBond){workshop.open=!!part;hadBond=!!part;}
  const rule=part?rotationRule(part):null, enabled=!!rule?.enabled&&!reference;
  for(const id of ['vsepr-torsion','vsepr-turn-back','vsepr-turn-forward'])$(id).disabled=!enabled;
  $('vsepr-end-on').disabled=!part;
  $('vsepr-bond-summary').textContent=part?bondName(part.order)+' · '+rule.label:'Fit a bond to inspect it';
  $('vsepr-rotation-rule').textContent=rule?.label||'Choose a fitted bond';
  $('vsepr-rotation-note').textContent=part?(reference?'Reference view. Return to your model to turn a group. ': '')+rule.detail:'Fit a piece to see its length, lone pairs and rotation behavior.';
  $('vsepr-torsion-value').value=enabled?normalizedTorsion(part,b.torsions[b.bondSite])+'°':'Not available';
  $('vsepr-torsion').value=part?normalizedTorsion(part,b.torsions[b.bondSite]):0;
  $('vsepr-bond-components').textContent=part?(m.delocalized?'σ + delocalized π':'1 σ'+(part.order>1?' + '+(part.order-1)+' π':'')):'None yet';
  $('vsepr-bond-pairs').textContent=part?part.lonePairs+' lone pair'+(part.lonePairs===1?'':'s')+' on this '+part.element+' end'+(part.group?' · '+part.group.hydrogens+' H atoms on its preassembled group':'')+'. One domain at the hub.':'';
  const group=m.ligands.find(p=>p.group),connections=$('vsepr-carbon-connections');
  connections.hidden=!group;
  if(group)connections.textContent='Completed molecule: each carbon bonds to '+group.group.hydrogens+' H '+(group.group.hydrogens===1?'atom':'atoms')+' and the other carbon. Each C has total bond order 4 (8 shared electrons). C₁ is the hub; C₂ is the attached carbon.';
  const basis=$('vsepr-bond-basis');basis.replaceChildren();
  if(part){
   const spec=bondSpec(m.center,part),link=document.createElement('a');link.href=spec.source;link.target='_blank';link.rel='noreferrer';link.textContent=spec.basis;
   $('vsepr-bond-length').textContent='≈ '+spec.pm+' pm';basis.append(link,'. Fixed connector; 100 pm = 1 Å.');
  }else $('vsepr-bond-length').textContent='None yet';
 }};
}
