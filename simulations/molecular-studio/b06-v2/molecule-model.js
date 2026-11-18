import {bySymbol} from './periodic-elements.js';
import {MAX_ATOMS, atomCharge, checkIonAddition, ionicComposition, ionFor, transferCapacity, transferSummary} from './ionic-model.js';
export {MAX_ATOMS};

// Neutral main-group teaching rules. Lengths/radii are illustrative scene units,
// not an experimental geometry database or molecular-mechanics calculation.
export const ELEMENTS={
 H:{name:'Hydrogen',color:'#f3f5f3',ink:'#2c3a33',valences:[1],electrons:1,r:.32},
 C:{name:'Carbon',color:'#3c4249',valences:[4],electrons:4,r:.55},
 N:{name:'Nitrogen',color:'#2f5fcf',valences:[3],electrons:5,r:.53},
 O:{name:'Oxygen',color:'#d8362b',valences:[2],electrons:6,r:.5},
 F:{name:'Fluorine',color:'#a9de72',ink:'#1d3d12',valences:[1],electrons:7,r:.46},
 B:{name:'Boron',color:'#f0a58c',ink:'#4a2a1d',valences:[3],electrons:3,r:.57},
 Si:{name:'Silicon',color:'#d6b78b',ink:'#45371d',valences:[4],electrons:4,r:.65},
 P:{name:'Phosphorus',color:'#f5841d',ink:'#40220a',valences:[3,5],electrons:5,r:.65},
 S:{name:'Sulfur',color:'#f0cf2c',ink:'#423a0b',valences:[2,4,6],electrons:6,r:.63},
 Cl:{name:'Chlorine',color:'#2ead48',ink:'#0d3017',valences:[1,3,5],single:true,electrons:7,r:.62},
 Be:{name:'Beryllium',color:'#5f7a33',valences:[2],electrons:2,r:.61},
 Se:{name:'Selenium',color:'#b8661c',valences:[2,4,6],electrons:6,r:.69},
 Br:{name:'Bromine',color:'#8e2417',valences:[1,3,5],single:true,electrons:7,r:.7},
 I:{name:'Iodine',color:'#6a2b92',valences:[1,3,5],single:true,electrons:7,r:.77},
 Xe:{name:'Xenon',color:'#3db2c5',ink:'#0c3940',valences:[0,2,4,6],electrons:8,r:.79},
};
// The ordinary tray keeps its original parts. The hand table also supplies
// neutral metal atom models without assigning ionic-lattice
// contacts as covalent bonds. Be and Xe retain their existing molecule rules.
export const TRAY_ELEMENTS=Object.keys(ELEMENTS);
const looseElements={
 Li:['#c58bdc',.68,1], Na:['#9d78d3',.74,1], K:['#9665c4',.81,1],
 Rb:['#8753a6',.85,1], Cs:['#754994',.89,1], Fr:['#664379',.92,1],
 Mg:['#89b774',.69,2], Ca:['#73ab64',.76,2], Sr:['#60a675',.81,2],
 Ba:['#438f6b',.85,2], Ra:['#468365',.88,2],
};
for(const [symbol,[color,r,electrons]] of Object.entries(looseElements)){
 ELEMENTS[symbol]={name:bySymbol.get(symbol).name,color,r,electrons,valences:[0],looseOnly:true};
}
// Retain the first pilot model for opening drafts that already contain At.
ELEMENTS.At={name:bySymbol.get('At').name,color:'#60467f',r:.83,valences:[1],electrons:7};
// Cl, Br and I reach three or five bonds (ClF3, BrF5, IF5) through single bonds only;
// their oxo species carry formal charges or seven bonds, which this neutral kit leaves out.
const singleOnly=(element,order)=>order>1&&ELEMENTS[element]?.single;
const SINGLE_ONLY='Chlorine, bromine and iodine make single bonds only in this kit.';
export const ANGLE_TOLERANCE=8; // Degrees of departure allowed on this instructional kit.
export const IDEAL_ANGLE={2:180,3:120,4:Math.acos(-1/3)*180/Math.PI};
export function fresh(kind){
 const graph={version:1,atoms:[],bonds:[],nextId:1,name:'Your molecule'};
 if(kind==='ionic'||kind==='transfer'){graph.kind='ionic';graph.name='Ionic compound';}
 if(kind==='transfer')graph.transfers=[];
 return graph;
}
const defaultName=g=>g.kind==='ionic'?'Ionic compound':'Your molecule';
const IONIC_BONDS='Ions on this bench form formula units. Place the ions separately and balance their charges.';
export const clone=g=>JSON.parse(JSON.stringify(g));
export const neighbors=(g,id)=>g.bonds.filter(b=>b.a===id||b.b===id).map(b=>({id:b.a===id?b.b:b.a,order:b.order,bond:b}));
export const sumBonds=(g,id)=>neighbors(g,id).reduce((n,b)=>n+b.order,0);
export const atom=(g,id)=>g.atoms.find(a=>a.id===id);
export function capacity(g,id){const a=atom(g,id);if(!a||g.kind==='ionic')return 0;const e=ELEMENTS[a.element];return Math.min(Math.max(...e.valences),a.pairs==null?99:e.electrons-2*a.pairs)-sumBonds(g,id);}
export function environment(g,id){
 const a=atom(g,id);if(!a)return null;
 const e=ELEMENTS[a.element],used=sumBonds(g,id),nb=neighbors(g,id);
 if(e.looseOnly||g.kind==='ionic')return {used,target:0,pairs:0,missing:0,domains:0,shape:g.kind==='ionic'&&atomCharge(g,id)?'Monatomic ion':'Isolated atom',electron:'—',angles:'—',balanced:false,neighbors:nb};
 const target=e.valences.find(v=>v>=used)??e.valences.at(-1);
 const pairs=a.pairs??Math.max(0,Math.floor((e.electrons-target)/2));
 const missing=Math.max(0,target-used),domains=nb.length+missing+pairs;
 const shapes={2:{0:'Linear'},3:{0:'Trigonal planar',1:'Bent'},4:{0:'Tetrahedral',1:'Trigonal pyramidal',2:'Bent'},5:{0:'Trigonal bipyramidal',1:'Seesaw',2:'T-shaped',3:'Linear'},6:{0:'Octahedral',1:'Square pyramidal',2:'Square planar',3:'T-shaped',4:'Linear'}};
 const electron=['','Single domain','Linear','Trigonal planar','Tetrahedral','Trigonal bipyramidal','Octahedral'][domains]||'Outside VSEPR range';
 const shape=nb.length===1&&!missing?'Terminal atom':shapes[domains]?.[pairs]||electron;
 const angles={1:'—',2:'180°',3:'120°',4:'109.5°',5:'90° / 120° / 180°',6:'90° / 180°'}[domains]||'—';
 const balanced=used+2*pairs===e.electrons;
 return {used,target,pairs,missing,domains,shape,electron,angles,balanced,neighbors:nb};
}
// AP Chemistry assigns sp, sp² and sp³ to centers with two, three and four
// electron domains. Five and six domains get no hybrid label here: the older
// sp³d and sp³d² descriptions are not supported by modern bonding evidence.
export const HYBRID={2:'sp',3:'sp²',4:'sp³'};
export function hybridization(env){
 if(!env||env.missing||env.neighbors.length<2)return null;
 return HYBRID[env.domains]||'Not assigned';
}
// Formal charge = valence electrons − nonbonding electrons − bonds (shared pairs).
export function formalCharge(g,id){
 const a=atom(g,id),env=environment(g,id);if(!a||!env)return null;
 if(g.kind==='ionic'||ELEMENTS[a.element].looseOnly)return null;
 return ELEMENTS[a.element].electrons-2*env.pairs-env.used;
}
export const signed=n=>n>0?'+'+n:n<0?'−'+Math.abs(n):'0';
// Every bond has one σ bond; each extra shared pair in a double or triple bond is a π bond.
export function bondTally(g,id=null){
 const list=id==null?g.bonds:neighbors(g,id).map(n=>n.bond);
 return {sigma:list.length,pi:list.reduce((n,b)=>n+b.order-1,0)};
}
// VSEPR expectation for real bond angles: lone pairs and unlike bonds move the
// angles away from the ideal value; identical bonds with no lone pair keep it.
export function expectedAngles(g,id){
 const env=environment(g,id);if(!env||env.missing||env.neighbors.length<2)return null;
 const same=env.neighbors.every(n=>n.order===env.neighbors[0].order&&atom(g,n.id).element===atom(g,env.neighbors[0].id).element);
 if(env.domains===2)return '180°';
 if(env.domains===3||env.domains===4){
  const ideal=env.domains===3?'120°':'109.5°';
  // Large end groups can open a two-coordinate angle past the ideal (Cl₂O 110.9°, dimethyl ether 111.7°).
  const bulky=env.neighbors.length===2&&env.neighbors.some(n=>!['H','F'].includes(atom(g,n.id).element));
  if(env.pairs)return (bulky?'Near ':same||env.neighbors.length<3?'<':'Mostly <')+ideal;
  return same?ideal:'≈'+ideal;
 }
 if(env.shape==='Linear')return '180°';
 if(env.shape==='Square planar'&&same)return '90°';
 return env.pairs?'< ideal':same?env.angles:'≈ ideal';
}
// Lone pairs in a five-domain center belong in equatorial sites; two lone pairs
// in a six-domain center belong opposite each other. Returns advice or null.
export function pairPlacementIssue(g,id){
 const a=atom(g,id),env=environment(g,id);
 if(!a?.position||!env||env.missing||!env.balanced||!env.pairs||env.domains<5)return null;
 const pairs=(a.pairDirections||[]).map(V.unit);if(pairs.length!==env.pairs)return null;
 const bonds=env.neighbors.map(n=>atom(g,n.id)?.position).filter(Boolean).map(p=>V.unit(V.sub(p,a.position)));
 if(env.domains===5){
  const all=[...pairs,...bonds];
  if(pairs.some(p=>all.some(d=>d!==p&&V.dot(p,d)<-.9)))return 'Lone pair in an axial site. In a trigonal bipyramid, lone pairs go equatorial (fewer domains at 90°).';
 }
 if(env.domains===6&&pairs.length===2&&V.dot(pairs[0],pairs[1])>-.9)return 'Lone pairs are cis. Set them trans (180°), as far apart as possible.';
 return null;
}
export function addAtom(g,element,parent=null,order=1){
 if(!Object.hasOwn(ELEMENTS,element))throw Error('Choose a supported element.');
 if(g.atoms.length>=MAX_ATOMS)throw Error(g.kind==='ionic'?'The bench is full. Remove an ion before adding another.':'This classroom model holds up to 80 atoms. Remove an atom before adding another.');
 if(![1,2,3].includes(order))throw Error('Choose a single, double, or triple bond.');
 if(g.kind==='ionic'){
  if(parent!=null)throw Error(IONIC_BONDS);
  checkIonAddition(g,element);
 }
 if(parent!=null){
  if(!atom(g,parent))throw Error('Select the atom you want to grow from.');
  checkBondModel(element,atom(g,parent).element);
  if(capacity(g,parent)<order)throw Error(`${atom(g,parent).element}${parent} has no room for that bond. Choose another atom or a lower bond order.`);
  if(singleOnly(element,order)||singleOnly(atom(g,parent).element,order))throw Error(SINGLE_ONLY);
  if(Math.max(...ELEMENTS[element].valences)<order)throw Error(`${ELEMENTS[element].name} cannot make that bond in this neutral model.`);
 }
 while(atom(g,g.nextId))g.nextId++;
 const id=g.nextId++;g.atoms.push({id,element,pairs:g.kind==='ionic'?0:null});
 if(parent!=null)g.bonds.push({a:parent,b:id,order});g.name=defaultName(g);return id;
}
function checkBondModel(...symbols){
 const symbol=symbols.find(s=>ELEMENTS[s].looseOnly);
 if(symbol)throw Error('To build a salt with '+ELEMENTS[symbol].name.toLowerCase()+', choose Ionic compounds in Workbench or in the hand periodic table.');
}
export function connect(g,a,b,order){
 if(g.kind==='ionic')throw Error(IONIC_BONDS);
 if(a===b)throw Error('Choose a different atom to connect.');
 if(!atom(g,a)||!atom(g,b))throw Error('Both atoms must be in the model.');
 checkBondModel(atom(g,a).element,atom(g,b).element);
 if(![1,2,3].includes(order))throw Error('Choose a single, double, or triple bond.');
 const old=g.bonds.find(x=>x.a===a&&x.b===b||x.a===b&&x.b===a),extra=order-(old?.order||0);
 if(singleOnly(atom(g,a).element,order)||singleOnly(atom(g,b).element,order))throw Error(SINGLE_ONLY);
 if(capacity(g,a)<extra||capacity(g,b)<extra)throw Error('That bond would exceed a supported neutral valence. Choose a lower bond order or remove a bond first.');
 if(old)old.order=order;else g.bonds.push({a,b,order});g.name='Your molecule';
}
export function removeAtom(g,id){
 if(g.transfers)g.transfers=g.transfers.filter(t=>t.donor!==id&&t.acceptor!==id);
 g.atoms=g.atoms.filter(a=>a.id!==id);g.bonds=g.bonds.filter(b=>b.a!==id&&b.b!==id);g.name=defaultName(g);
}
export function replaceAtom(g,id,element){
 const a=atom(g,id);if(!a||!ELEMENTS[element])throw Error('Choose an atom and an element.');
 if(g.transfers&&a.element!==element&&atomCharge(g,id))throw Error('Remove the joined atom before replacing its element.');
 if(g.kind==='ionic')checkIonAddition(g,element,id);
 if(neighbors(g,id).length)checkBondModel(element);
 if(ELEMENTS[element].single&&neighbors(g,id).some(n=>n.order>1))throw Error(SINGLE_ONLY);
 if(sumBonds(g,id)>Math.max(...ELEMENTS[element].valences))throw Error(`${ELEMENTS[element].name} cannot hold the existing bonds. Remove a bond first.`);
 a.element=element;a.pairs=g.kind==='ionic'?0:null;g.name=defaultName(g);
}
export function changePairs(g,id,delta){
 if(g.kind==='ionic')throw Error('This bench uses fixed monatomic ion charges.');
 const a=atom(g,id),env=environment(g,id);if(!a)throw Error('Select an atom first.');
 if(ELEMENTS[a.element].looseOnly)throw Error('Lone-pair editing is available for molecular building pieces.');
 const pairs=env.pairs+delta;
 if(pairs<0||pairs>4||env.used+2*pairs>ELEMENTS[a.element].electrons||env.neighbors.length+pairs>6)throw Error('That lone-pair count exceeds the available valence electrons or six-domain limit.');
 a.pairs=pairs;
}
export function fillHydrogens(g){
 // Whole operation is applied to a candidate graph by the caller, so capacity
 // failures never leave a partly completed action in authoritative state.
 const ids=g.atoms.map(a=>a.id);let added=0;
 for(const id of ids){const env=environment(g,id);for(let n=0;n<env.missing;n++){addAtom(g,'H',id,1);added++;}}
 return added;
}
const subscript=s=>String(s).replace(/\d/g,d=>'₀₁₂₃₄₅₆₇₈₉'[d]);
// Use the classroom spelling for these compositions wherever they are built.
// For all other inventories the Hill formula gives a stable element order.
const classroomFormulas = new Map([
 ['CF₂O','COF₂'], ['Cl₂S','SCl₂'], ['Cl₃P','PCl₃'], ['F₄Si','SiF₄'],
 ['FHO','HOF'], ['H₄N₂','N₂H₄'],
]);
const FORMULA_EN={Be:1.57,Si:1.90,B:2.04,At:2.2,P:2.19,Se:2.55,S:2.58,Xe:2.60,I:2.66,Br:2.96,N:3.04,Cl:3.16,O:3.44,F:3.98};
export function formula(g){
 if(g.transfers){
  const assembly=transferSummary(g);
  return assembly.formula|| (g.atoms.length?'Assembly in progress':'Start an ionic compound');
 }
 if(g.kind==='ionic'){
  const mixture=ionicComposition(g);
  return mixture.units?mixture.formula:g.atoms.length?'Unbalanced ions':'Start an ionic compound';
 }
 // Isolated inventory pieces are displayed alongside the molecular formula.
 // A metal next to chlorine on this bench does not constitute a salt.
 const loose=g.atoms.filter(a=>ELEMENTS[a.element].looseOnly);
 if(loose.length){
  const other=g.atoms.filter(a=>!ELEMENTS[a.element].looseOnly);
  const counts=new Map();
  for(const part of loose)counts.set(part.element,(counts.get(part.element)||0)+1);
  const pieces=[...counts].map(([symbol,count])=>count===1?symbol:count+' '+symbol);
  return [...(other.length?[formula({...g,atoms:other})]:[]),...pieces].join(' + ');
 }
 const counts={};for(const a of g.atoms)counts[a.element]=(counts[a.element]||0)+1;
 let keys=Object.keys(counts).sort();
 if(counts.C)keys=['C',...(counts.H?['H']:[]),...keys.filter(k=>!['C','H'].includes(k))];
 const write=order=>order.map(k=>k+(counts[k]>1?subscript(counts[k]):'')).join('');
 const hill=write(keys);
 if(classroomFormulas.has(hill)||counts.C)return classroomFormulas.get(hill)||hill;
 // Carbon-free formulas read the classroom way: least electronegative element first,
 // with H leading only for the hydrides of groups 16 and 17 (H₂O, HCl) and after the
 // central atom otherwise (NH₃, SiH₄).
 const heavy=keys.filter(k=>k!=='H').sort((a,b)=>FORMULA_EN[a]-FORMULA_EN[b]);
 const hydride=heavy.some(k=>['B','Be','Si','N','P','Xe'].includes(k));
 const order=!counts.H?heavy:hydride?[heavy[0],'H',...heavy.slice(1)]:['H',...heavy];
 return write(order)||'Start a molecule';
}
export function components(g){const seen=new Set();let n=0;for(const a of g.atoms)if(!seen.has(a.id)){n++;const q=[a.id];while(q.length){const id=q.pop();if(seen.has(id))continue;seen.add(id);q.push(...neighbors(g,id).map(b=>b.id));}}return n;}
export function validate(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.atoms)||!Array.isArray(raw.bonds)||raw.atoms.length>MAX_ATOMS||raw.bonds.length>240)throw Error('Use a molecule file saved by this builder (up to 80 atoms).');
 if(raw.kind!=null&&raw.kind!=='ionic')throw Error('The builder does not recognize this model type.');
 const hasTransfers=Object.hasOwn(raw,'transfers');
 if(hasTransfers&&(raw.kind!=='ionic'||!Array.isArray(raw.transfers)||raw.transfers.length>=MAX_ATOMS))throw Error('The file contains an invalid electron-transfer record.');
 const g=fresh(hasTransfers?'transfer':raw.kind),ids=new Set();
 if(g.kind==='ionic'&&raw.bonds.length)throw Error(IONIC_BONDS);
 // Imported graphs may use text IDs, sparse numbers or a different starting
 // number. Keep references intact while assigning numeric handles for the UI.
 const handles=new Map(),numeric=new Set(raw.atoms.map(a=>a?.id).filter(id=>Number.isSafeInteger(id)&&id>0&&id<=100000));
 let nextHandle=1;
 for(const a of raw.atoms){
  const id=a?.id;
  const valid=Number.isSafeInteger(id)||(typeof id==='string'&&id.trim().length>0);
  if(!valid||handles.has(id))throw Error('Each atom needs a unique identifier.');
  if(numeric.has(id))handles.set(id,id);
  else{
   while(numeric.has(nextHandle))nextHandle++;
   handles.set(id,nextHandle);numeric.add(nextHandle++);
  }
 }
 for(const a of raw.atoms){if(!Object.hasOwn(ELEMENTS,a.element))throw Error('The file contains an invalid or repeated atom.');if(a.pairs!=null&&(!Number.isInteger(a.pairs)||a.pairs<0||a.pairs>4))throw Error('The file contains an invalid lone-pair count.');
  const out={id:handles.get(a.id),element:a.element,pairs:a.pairs??null};
  if(g.kind==='ionic'){
   checkIonAddition(g,a.element);
   if(a.pairs>0)throw Error('An ionic model cannot contain editable lone pairs.');
   out.pairs=0;
  }
  if(ELEMENTS[a.element].looseOnly&&a.pairs>0)throw Error('Isolated kit atoms cannot have editable lone pairs.');
  if(a.position!=null){if(!Array.isArray(a.position)||a.position.length!==3||!a.position.every(v=>Number.isFinite(v)&&Math.abs(v)<=100))throw Error('The file contains an invalid atom position.');out.position=[...a.position];}
  if(a.pairDirections!=null){if(!Array.isArray(a.pairDirections)||a.pairDirections.length!==(a.pairs??0)||!a.pairDirections.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)&&Math.hypot(...p)>.01))throw Error('The file contains invalid lone-pair directions.');out.pairDirections=a.pairDirections.map(p=>V.unit(p));}
  ids.add(out.id);g.atoms.push(out);
 }
 if(g.atoms.some(a=>a.position)&&!g.atoms.every(a=>a.position))throw Error('Every atom in a positioned model needs a position.');
 if(hasTransfers){
  for(const entry of raw.transfers){
   const donor=handles.get(entry?.donor),acceptor=handles.get(entry?.acceptor),electrons=entry?.electrons;
   const source=atom(g,donor);
   if(!source||ionFor(source.element).charge<=0||!Number.isInteger(electrons)||electrons<=0||electrons>transferCapacity(g,donor,source.element,acceptor)){
    throw Error('The file contains an invalid electron transfer or exceeds an atom’s charge capacity.');
   }
   g.transfers.push({donor,acceptor,electrons});
  }
 }
 const edges=new Set();
 for(const bond of raw.bonds){
  const a=handles.get(bond?.a),b=handles.get(bond?.b),order=bond?.order;
  const key=[a,b].sort((x,y)=>x-y).join(':');
  if(!ids.has(a)||!ids.has(b)||a===b||edges.has(key)||![1,2,3].includes(order))throw Error('The file contains an invalid or repeated bond.');
  if(order>1&&[a,b].some(id=>ELEMENTS[g.atoms.find(x=>x.id===id).element].single))throw Error('The file exceeds the neutral valence or electron-domain limits.');
  edges.add(key);g.bonds.push({a,b,order});
 }
 for(const a of g.atoms){const env=environment(g,a.id);if(capacity(g,a.id)<0||env.domains>6)throw Error('The file exceeds the neutral valence or electron-domain limits.');}
 g.nextId=Math.max(0,...ids)+1;
 if(g.nextId>100000){g.nextId=1;while(ids.has(g.nextId))g.nextId++;}
 g.name=typeof raw.name==='string'?raw.name.slice(0,70):g.kind==='ionic'?'Ionic compound':'Opened molecule';
 return g;
}

export const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit:a=>{const l=Math.hypot(...a);return l<1e-9?[1,0,0]:a.map(v=>v/l);}};
export function rotateTo(p,from,to){
 const u=V.unit(from),v=V.unit(to),d=V.dot(u,v);
 if(d>.999999)return [...p];
 if(d<-.999999){const axis=V.unit(V.cross(u,Math.abs(u[0])<.8?[1,0,0]:[0,1,0]));return V.sub(V.mul(axis,2*V.dot(p,axis)),p);}
 const cross=V.cross(u,v);return V.add(V.add(p,V.cross(cross,p)),V.mul(V.cross(cross,V.cross(cross,p)),1/(1+d)));
}
export function domainDirections(domains,pairs=0){
 if(domains===0)return {pairs:[],bonds:[]};
 const h=Math.sqrt(3)/2;
 const layouts={1:[[1,0,0]],2:[[-1,0,0],[1,0,0]],3:[[0,1,0],[-h,-.5,0],[h,-.5,0]],4:[[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]].map(V.unit),5:[[1,0,0],[-.5,0,h],[-.5,0,-h],[0,1,0],[0,-1,0]],6:[[0,1,0],[0,-1,0],[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]]};
 const all=(layouts[domains]||layouts[4]).map(p=>[...p]);
 return {pairs:all.slice(0,pairs),bonds:all.slice(pairs)};
}
export function bondLength(g,a,b,order=1){return (ELEMENTS[atom(g,a).element].r+ELEMENTS[atom(g,b).element].r)*1.58+.48-(order-1)*.12;}
export function layout(g){
 if(g.kind==='ionic'){
  // Reconstruct graph-only files as an inventory grid. Authored positions
  // take priority. Geometry is illustrative and independent of formula balance.
  const positions=new Map(),frames=new Map(),width=Math.max(1,Math.ceil(Math.sqrt(g.atoms.length)));
  g.atoms.forEach((a,index)=>{
   const p=a.position??[(index%width-(width-1)/2)*2.5,(Math.floor(index/width)-(Math.ceil(g.atoms.length/width)-1)/2)*-2.5,0];
   positions.set(a.id,[...p]);frames.set(a.id,{bonds:[],pairs:[],all:[]});
  });
  return {positions,frames,cyclic:false};
 }
 if(g.atoms.length&&g.atoms.every(a=>a.position))return placedLayout(g);
 const positions=new Map(),frames=new Map(),seen=new Set();let component=0;
 for(const root of g.atoms){
  if(seen.has(root.id))continue;
  positions.set(root.id,[component++*5,0,0]);seen.add(root.id);const queue=[{id:root.id,parent:null}];
  while(queue.length){
   const {id,parent}=queue.shift(),env=environment(g,id),local=domainDirections(env.domains,env.pairs);
   let dirs=local.bonds;
   if(parent!=null){const toward=V.unit(V.sub(positions.get(parent),positions.get(id)));dirs=dirs.map(p=>rotateTo(p,local.bonds[0],toward));}
   frames.set(id,{bonds:dirs,pairs:parent==null?local.pairs:local.pairs.map(p=>rotateTo(p,local.bonds[0],V.sub(positions.get(parent),positions.get(id))))});
   let slot=parent==null?0:1;
   for(const nb of neighbors(g,id))if(nb.id!==parent){const d=dirs[slot++%dirs.length]||[1,0,0];if(!seen.has(nb.id)){positions.set(nb.id,V.add(positions.get(id),V.mul(d,bondLength(g,id,nb.id,nb.order))));seen.add(nb.id);queue.push({id:nb.id,parent:id});}}
  }
 }
 // Closing a ring is a geometric distance/angle relaxation, not an energy
 // minimization. Tree structures retain their analytic VSEPR positions.
 const cyclic=g.bonds.length>g.atoms.length-components(g);
 if(cyclic){
  const constrain=(a,b,target,weight)=>{let d=V.sub(positions.get(b),positions.get(a)),l=Math.hypot(...d);if(l<.0001){d=[.04,.03,.02];l=Math.hypot(...d);}const move=V.mul(d,(l-target)/l*weight*.5);positions.set(a,V.add(positions.get(a),move));positions.set(b,V.sub(positions.get(b),move));};
  for(let n=0;n<150;n++){
   for(const b of g.bonds)constrain(b.a,b.b,bondLength(g,b.a,b.b,b.order),.55);
   for(const a of g.atoms){const env=environment(g,a.id),nb=env.neighbors;if(env.domains>4)continue;const theta={2:Math.PI,3:Math.PI*2/3,4:Math.acos(-1/3)}[env.domains];if(!theta)continue;for(let i=0;i<nb.length;i++)for(let j=i+1;j<nb.length;j++){const l1=bondLength(g,a.id,nb[i].id,nb[i].order),l2=bondLength(g,a.id,nb[j].id,nb[j].order);constrain(nb[i].id,nb[j].id,Math.sqrt(l1*l1+l2*l2-2*l1*l2*Math.cos(theta)),.06);}}
  }
 }
 if(positions.size){const center=[0,0,0];for(const p of positions.values())p.forEach((v,i)=>center[i]+=v/positions.size);for(const [id,p] of positions)positions.set(id,V.sub(p,center));}
 for(const a of g.atoms)if(!frames.has(a.id)){
  const env=environment(g,a.id),d=domainDirections(env.domains,env.pairs),nb=env.neighbors[0];
  const transform=p=>nb?rotateTo(p,d.bonds[0],V.sub(positions.get(nb.id),positions.get(a.id))):p;
  frames.set(a.id,{bonds:d.bonds.map(transform),pairs:d.pairs.map(transform)});
 }
 return {positions,frames,cyclic};
}

function rotateAxis(p,axis,angle){const c=Math.cos(angle),s=Math.sin(angle);return V.add(V.add(V.mul(p,c),V.mul(V.cross(axis,p),s)),V.mul(axis,V.dot(axis,p)*(1-c)));}
// Fit an ideal set of directions to the parts already placed, without moving
// any atoms. Candidate ports are guides; positions remain learner-authored.
export function fittedDirections(g,id,domains,excludeAtom=null,excludePair=null){
 const a=atom(g,id),base=domainDirections(domains,0).bonds;
 const actual=neighbors(g,id).filter(n=>n.id!==excludeAtom).map(n=>V.unit(V.sub(atom(g,n.id).position,a.position)));
 actual.push(...(a.pairDirections||[]).filter((_,i)=>i!==excludePair));
 if(!actual.length)return base;
 let best=base,bestScore=Infinity;
 for(let i=0;i<base.length;i++)for(let j=0;j<(actual.length>1?base.length:1);j++){
  if(actual.length>1&&j===i)continue;
  let candidate=base.map(p=>rotateTo(p,base[i],actual[0]));
  if(actual.length>1){const axis=actual[0],a2=V.sub(candidate[j],V.mul(axis,V.dot(candidate[j],axis))),b2=V.sub(actual[1],V.mul(axis,V.dot(actual[1],axis)));if(Math.hypot(...a2)>.001&&Math.hypot(...b2)>.001){const u=V.unit(a2),v=V.unit(b2),t=Math.atan2(V.dot(axis,V.cross(u,v)),V.dot(u,v));candidate=candidate.map(p=>rotateAxis(p,axis,t));}}
  const unused=new Set(candidate.map((_,k)=>k));let score=0;
  for(const p of actual){let nearest=-1,distance=Infinity;for(const k of unused){const d=1-V.dot(p,candidate[k]);if(d<distance){nearest=k;distance=d;}}if(nearest>=0){unused.delete(nearest);score+=distance*distance;}else score+=2;}
  score+=candidate.reduce((s,p,k)=>s+1-V.dot(p,base[k]),0)*1e-8;
  if(score<bestScore){bestScore=score;best=candidate;}
 }
 return best;
}
function placedLayout(g){
 const positions=new Map(g.atoms.map(a=>[a.id,[...a.position]])),frames=new Map();
 for(const a of g.atoms){
  if(ELEMENTS[a.element].looseOnly){frames.set(a.id,{bonds:[],pairs:[],all:[]});continue;}
  const env=environment(g,a.id),expectedPairs=Math.max(0,Math.floor((ELEMENTS[a.element].electrons-env.target)/2)),guideDomains=env.neighbors.length+env.missing+Math.max(env.pairs,expectedPairs),all=fittedDirections(g,a.id,Math.min(6,guideDomains)),pairs=a.pairDirections||[];
  frames.set(a.id,{bonds:all.filter(d=>!pairs.some(p=>V.dot(d,p)>.95)),pairs,all});
 }
 return {positions,frames,cyclic:g.bonds.length>g.atoms.length-components(g)};
}
export function materialize(g){
 if(!g.atoms.length)return g;
 const geometry=layout(g);
 for(const a of g.atoms)a.position=[...geometry.positions.get(a.id)];
 for(const a of g.atoms){
  const env=environment(g,a.id);
  a.pairs=env.pairs;
  if(a.pairDirections?.length===a.pairs)continue;
  let directions=geometry.frames.get(a.id).pairs;
  if(directions.length!==a.pairs){
   const occupied=env.neighbors.map(n=>V.unit(V.sub(atom(g,n.id).position,a.position)));
   const available=fittedDirections(g,a.id,env.domains);
   for(const d of occupied){
    let index=0;
    available.forEach((p,i)=>{if(V.dot(d,p)>V.dot(d,available[index]))index=i;});
    available.splice(index,1);
   }
   directions=available.slice(0,a.pairs);
  }
  a.pairDirections=directions.map(p=>[...p]);
 }
 return g;
}
function angleBetween(first,second){
 if(Math.min(Math.hypot(...first),Math.hypot(...second))<.001)return null;
 const dot=V.dot(V.unit(first),V.unit(second));
 return Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
}
export function bondAngle(g,id,first,second){
 if(first===second)return null;
 const origin=atom(g,id)?.position,a=atom(g,first)?.position,b=atom(g,second)?.position;
 if(!origin||!a||!b)return null;
 return angleBetween(V.sub(a,origin),V.sub(b,origin));
}
export function spacingError(g,id){
 const a=atom(g,id),env=environment(g,id);if(!a?.position||env.missing||!env.balanced)return null;
 const vectors=env.neighbors.map(n=>{
  const position=atom(g,n.id)?.position;
  return position?V.sub(position,a.position):[];
 }).concat(a.pairDirections||[]);
 if(vectors.length!==env.domains||vectors.some(v=>v.length!==3||Math.hypot(...v)<.001))return null;
 const actual=vectors.map(V.unit);
 if(actual.length<2)return 0;
 if(IDEAL_ANGLE[env.domains]){
  let worst=0;
  for(let i=0;i<actual.length;i++)for(let j=i+1;j<actual.length;j++){
   const observed=angleBetween(actual[i],actual[j]);
   worst=Math.max(worst,Math.abs(observed-IDEAL_ANGLE[env.domains]));
  }
  return worst;
 }
 const ideal=fittedDirections(g,id,env.domains),unused=new Set(ideal.map((_,i)=>i));let worst=0;
 for(const d of actual){let idx=-1,dot=-2;for(const i of unused){const v=V.dot(d,ideal[i]);if(v>dot){dot=v;idx=i;}}if(idx>=0){unused.delete(idx);worst=Math.max(worst,Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI);}}
 return worst;
}
export function removePair(g,id,index){const a=atom(g,id);if(!a||index<0||index>=a.pairs)throw Error('That lone pair is no longer on the model.');a.pairDirections.splice(index,1);a.pairs--;}
export function placePair(g,id,direction){const a=atom(g,id);if(!a)throw Error('Drop the lone pair onto a visible atom site.');changePairs(g,id,1);a.pairDirections??=[];a.pairDirections.push(V.unit(direction));}
export function snapSites(g,target,source){
 if(g.kind==='ionic')return [];
 const a=atom(g,target);if(!a?.position||source.id===target)return [];
 const candidate=clone(g),element=source.element||atom(g,source.id)?.element;
 let order=source.order||1,excluded=null;
 try{
  if(source.kind==='pair'){
   if(source.owner!=null)removePair(candidate,source.owner,source.index);
   changePairs(candidate,target,1);
  }else{
   if(source.id!=null){const edge=g.bonds.find(b=>b.a===target&&b.b===source.id||b.b===target&&b.a===source.id);if(edge){order=edge.order;excluded=source.id;}else connect(candidate,target,source.id,order);}
   else {const id=addAtom(candidate,element,target,order);atom(candidate,id).position=[...a.position];atom(candidate,id).pairs=0;excluded=id;}
  }
  const env=environment(candidate,target),expectedPairs=Math.max(0,Math.floor((ELEMENTS[a.element].electrons-env.target)/2)),guideDomains=env.neighbors.length+env.missing+Math.max(env.pairs,expectedPairs);if(guideDomains>6)return [];
  const sourcePair=source.kind==='pair'&&source.owner===target?source.index:null;
  const dirs=fittedDirections(g,target,guideDomains,source.id??excluded,sourcePair);
  const occupied=neighbors(g,target).filter(n=>n.id!==source.id).map(n=>V.unit(V.sub(atom(g,n.id).position,a.position)));
  occupied.push(...(a.pairDirections||[]).filter((_,i)=>i!==sourcePair));
  const length=source.kind==='pair'?1.35:(ELEMENTS[a.element].r+ELEMENTS[element].r)*1.58+.48-(order-1)*.12;
  return dirs.filter(d=>occupied.every(o=>V.dot(o,d)<.9)).map((d,index)=>({target,direction:d,position:V.add(a.position,V.mul(d,length)),order,index}));
 }catch{return [];}
}
// Editable references belong exclusively to the free-construction library.
const references = {
 chlorofluoromethane: {
  name:'Chlorofluoromethane', formula:'CH₂ClF', elements:['C','H','H','Cl','F'],
  bonds:[[0,1],[0,2],[0,3],[0,4]],
 },
 dichlorineMonoxide: {
  name:'Dichlorine monoxide', formula:'Cl₂O', elements:['O','Cl','Cl'], bonds:[[0,1],[0,2]],
 },
 fluoroethyne: {
  name:'Fluoroethyne', formula:'HC≡CF', elements:['C','C','H','F'], bonds:[[0,1,3],[0,2],[1,3]],
 },
};
export const EXAMPLES = Object.entries(references).map(([key,r])=>[key,r.formula,r.name]);
export function example(key){
 const source=references[key];
 if(!Object.hasOwn(references,key))throw Error('Choose one of the free-workbench references.');
 const g=fresh(),ids=source.elements.map(el=>addAtom(g,el));
 for(const [a,b,order=1] of source.bonds)connect(g,ids[a],ids[b],order);
 g.name=source.name;return g;
}
