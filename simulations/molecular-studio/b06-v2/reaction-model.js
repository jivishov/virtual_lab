import {refineGeometry,V,centroid,bestRotation,rotate,slerpIdentity,atomRadius} from './reaction-geometry.js';
import {placeEquation} from './reaction-layout.js';
export {atomRadius};
// Reaction Lab: curated equations and deterministic, atom-conserving transformations.
// Scene units and playback seconds are illustrative; no kinetics or mechanism prediction.
export const TYPES = [
 ['synthesis','Synthesis','Two or more substances form one compound.'],
 ['decomposition','Decomposition','One compound forms simpler substances.'],
 ['single','Single replacement','An element replaces another element in a compound.'],
 ['double','Double replacement','Ions exchange partners; precipitation or neutralization drives these examples.'],
 ['combustion','Combustion','A fuel reacts with oxygen. These examples show complete combustion.']
];
export const SPECIES = {};
const atom = (el,x,y=0,z=0)=>({el,p:[x,y,z]});
function species(id,name,atoms,bonds=[],kind='molecule') { SPECIES[id]={id,name,atoms,bonds,kind}; }
const di=(id,el,order)=>species(id,id,[atom(el,-.7),atom(el,.7)],[[0,1,order]]);
di('H2','H',1); di('O2','O',2); di('N2','N',3); di('Cl2','Cl',1); di('Br2','Br',1);
for(const el of ['Mg','Na','Zn','Fe','Cu'])species(el,el,[atom(el,0)],[],'element');
species('H2O','Water',[atom('O',0,.2),atom('H',-.92,-.5),atom('H',.92,-.5)],[[0,1,1],[0,2,1]]);
species('HCl','Hydrogen chloride',[atom('H',-.65),atom('Cl',.65)],[[0,1,1]]);
species('NH3','Ammonia',[atom('N',0,.2),atom('H',-1,-.4),atom('H',1,-.4),atom('H',0,-.45,1)],[[0,1,1],[0,2,1],[0,3,1]]);
species('H2O2','Hydrogen peroxide',[atom('O',-.6),atom('O',.6),atom('H',-1.2,.85),atom('H',1.2,-.5,.7)],[[0,1,1],[0,2,1],[1,3,1]]);
species('CO2','Carbon dioxide',[atom('C',0),atom('O',-1.3),atom('O',1.3)],[[0,1,2],[0,2,2]]);
const tetra=[[.85,.85,.85],[-.85,-.85,.85],[-.85,.85,-.85],[.85,-.85,-.85]];
species('CH4','Methane',[atom('C',0),...tetra.map(p=>atom('H',...p))],tetra.map((_,i)=>[0,i+1,1]));
function chain(id,name,n,alcohol=false){
 const atoms=[],bonds=[];
 for(let i=0;i<n;i++){atoms.push(atom('C',(i-(n-1)/2)*1.55,i%2*.35));if(i)bonds.push([i-1,i,1]);}
 if(alcohol){atoms.push(atom('O',(n-(n-1)/2)*1.55,.2));bonds.push([n-1,n,1]);}
 for(let i=0;i<n;i++){
  const neighbors=bonds.filter(b=>b[0]===i||b[1]===i).length,need=4-neighbors;
  const dirs=need===4?tetra:[[0,.9,.8],[0,-.9,.8],[i===0?-.85:.85,-.2,-.8]];
  for(let j=0;j<need;j++){const p=atoms[i].p,d=dirs[j];bonds.push([i,atoms.length,1]);atoms.push(atom('H',p[0]+d[0],p[1]+d[1],p[2]+d[2]));}
 }
 if(alcohol){const p=atoms[n].p;bonds.push([n,atoms.length,1]);atoms.push(atom('H',p[0]+.7,p[1]+.7));}
 species(id,name,atoms,bonds);
}
chain('C2H6','Ethane',2);chain('C3H8','Propane',3);chain('CH3OH','Methanol',1,true);chain('C2H5OH','Ethanol',2,true);
// Zero-order edges are formula-unit associations, never covalent bonds.
function salt(id,name,metal,anion,count=1){
 const atoms=[atom(metal,0)],bonds=[];
 for(let i=0;i<count;i++){const a=2*Math.PI*i/count;atoms.push(atom(anion,1.6*Math.cos(a),1.6*Math.sin(a)));bonds.push([0,i+1,0]);}
 species(id,name,atoms,bonds,'ionic');
}
for(const [id,m,a,n] of [
 ['MgO','Mg','O',1],['CaO','Ca','O',1],['NaCl','Na','Cl',1],['KCl','K','Cl',1],['KBr','K','Br',1],
 ['ZnCl2','Zn','Cl',2],['MgCl2','Mg','Cl',2],['BaCl2','Ba','Cl',2],['CaCl2','Ca','Cl',2],['AgCl','Ag','Cl',1]
])salt(id,id,m,a,n);
const ions={
 carbonate:{atoms:[atom('C',0),atom('O',0,1.2),atom('O',-1.05,-.6),atom('O',1.05,-.6)],bonds:[[0,1,2],[0,2,1],[0,3,1]]},
 sulfate:{atoms:[atom('S',0),...tetra.map(p=>atom('O',...p))],bonds:[[0,1,2],[0,2,2],[0,3,1],[0,4,1]]},
 nitrate:{atoms:[atom('N',0),atom('O',0,1.2),atom('O',-1.05,-.6),atom('O',1.05,-.6)],bonds:[[0,1,2],[0,2,1],[0,3,1]]},
 chlorate:{atoms:[atom('Cl',0,.2),atom('O',-1,-.4),atom('O',1,-.4),atom('O',0,-.45,1)],bonds:[[0,1,2],[0,2,2],[0,3,1]]},
 hydroxide:{atoms:[atom('O',0),atom('H',.85,.6)],bonds:[[0,1,1]]}
};
function polySalt(id,metal,metalCount,ionName,ionCount=1){
 const atoms=[],bonds=[],ion=ions[ionName];
 for(let j=0;j<ionCount;j++){
  const offset=atoms.length;
  atoms.push(...ion.atoms.map(a=>({el:a.el,p:[a.p[0]+j*3,a.p[1],a.p[2]]})));
  bonds.push(...ion.bonds.map(([a,b,o])=>[a+offset,b+offset,o]));
 }
 for(let i=0;i<metalCount;i++){const index=atoms.length;atoms.push(atom(metal,-1.8,i*1.5-.4));bonds.push([index,0,0]);if(ionCount>1)bonds.push([index,ion.atoms.length,0]);}
 species(id,id,atoms,bonds,'ionic');
}
polySalt('CaCO3','Ca',1,'carbonate');polySalt('Na2CO3','Na',2,'carbonate');
polySalt('KClO3','K',1,'chlorate');
for(const metal of ['Cu','Fe','Zn','Ba'])polySalt(metal+'SO4',metal,1,'sulfate');
polySalt('Na2SO4','Na',2,'sulfate');polySalt('AgNO3','Ag',1,'nitrate');polySalt('NaNO3','Na',1,'nitrate');
polySalt('NaOH','Na',1,'hydroxide');polySalt('Cu(OH)2','Cu',1,'hydroxide',2);
{
 const a=SPECIES.Na2CO3.atoms.slice(0,5).map(a=>({el:a.el,p:[...a.p]}));
 a.push(atom('H',1.9,-.5));species('NaHCO3','Sodium hydrogen carbonate',a,[[0,1,2],[0,2,1],[0,3,1],[4,0,0],[3,5,1]],'ionic');
}
const r=(id,type,name,reactants,products,condition,lesson)=>({id,type,name,reactants,products,condition,lesson});
export const REACTIONS=[
 r('water','synthesis','Water from hydrogen', [['H2',2],['O2',1]],[['H2O',2]],'Ignition starts the reaction.','A 2:1 ratio of hydrogen molecules to oxygen molecules supplies every atom in two water molecules.'),
 r('ammonia','synthesis','Ammonia synthesis',[['N2',1],['H2',3]],[['NH3',2]],'Iron catalyst, elevated temperature and pressure; reversible in reality.','One forward stoichiometric event is shown; equilibrium and incomplete conversion are not modeled.'),
 r('hydrogen-chloride','synthesis','Hydrogen chloride',[['H2',1],['Cl2',1]],[['HCl',2]],'Light can initiate this reaction.','The two diatomic elements make two hydrogen chloride molecules.'),
 r('magnesium-oxide','synthesis','Magnesium oxide',[['Mg',2],['O2',1]],[['MgO',2]],'Heating initiates oxidation.','MgO is an ionic solid. Dashed links indicate formula-unit associations. This reaction is also combustion.'),
 r('sodium-chloride','synthesis','Sodium chloride',[['Na',2],['Cl2',1]],[['NaCl',2]],'Sodium reacts with chlorine.','NaCl forms an extended ionic lattice; the display counts two formula units.'),
 r('electrolysis','decomposition','Water electrolysis',[['H2O',2]],[['H2',2],['O2',1]],'Electrical energy; a conducting electrolyte and electrodes are required.','Electrolyte and electrodes are omitted from this net equation. Both oxygen atoms remain in the scene.'),
 r('peroxide','decomposition','Hydrogen peroxide',[['H2O2',2]],[['H2O',2],['O2',1]],'A catalyst such as manganese dioxide accelerates decomposition.','The catalyst is not consumed and is not included in this atom inventory.'),
 r('limestone','decomposition','Calcium carbonate',[['CaCO3',1]],[['CaO',1],['CO2',1]],'Strong heating.','Carbon dioxide is a product gas, but it stays visible so every atom can be followed.'),
 r('baking-soda','decomposition','Sodium hydrogen carbonate',[['NaHCO3',2]],[['Na2CO3',1],['CO2',1],['H2O',1]],'Heating.','Two formula units supply the sodium, hydrogen, carbon and oxygen in all three products.'),
 r('chlorate','decomposition','Potassium chlorate',[['KClO3',2]],[['KCl',2],['O2',3]],'Heating; manganese dioxide may be used as catalyst.','Six oxygen atoms form three oxygen molecules.'),
 r('zinc-acid','single','Zinc and acid',[['Zn',1],['HCl',2]],[['ZnCl2',1],['H2',1]],'Dilute aqueous hydrochloric acid.','Zinc displaces hydrogen. In solution, chloride ions are spectators; HCl is shown using molecular-equation bookkeeping.'),
 r('magnesium-acid','single','Magnesium and acid',[['Mg',1],['HCl',2]],[['MgCl2',1],['H2',1]],'Dilute aqueous hydrochloric acid.','Magnesium displaces hydrogen; electron transfer is not animated.'),
 r('iron-copper','single','Iron and copper sulfate',[['Fe',1],['CuSO4',1]],[['FeSO4',1],['Cu',1]],'Aqueous copper(II) sulfate.','Iron forms iron(II) ions and copper metal forms. The sulfate group is conserved.'),
 r('zinc-copper','single','Zinc and copper sulfate',[['Zn',1],['CuSO4',1]],[['ZnSO4',1],['Cu',1]],'Aqueous copper(II) sulfate.','Zinc replaces copper; the sulfate group remains together.'),
 r('chlorine-bromide','single','Chlorine and potassium bromide',[['Cl2',1],['KBr',2]],[['KCl',2],['Br2',1]],'Aqueous potassium bromide.','Chlorine oxidizes bromide to bromine; potassium is a spectator ion.'),
 r('silver-chloride','double','Silver chloride precipitate',[['AgNO3',1],['NaCl',1]],[['AgCl',1],['NaNO3',1]],'Mix aqueous solutions; AgCl precipitates.','Ag+ and Cl− form a solid. Sodium and nitrate remain dissolved; the formula-unit display groups them for accounting.'),
 r('barium-sulfate','double','Barium sulfate precipitate',[['BaCl2',1],['Na2SO4',1]],[['BaSO4',1],['NaCl',2]],'Mix aqueous solutions; BaSO4 precipitates.','Barium and sulfate form a solid; sodium and chloride remain spectator ions.'),
 r('calcium-carbonate','double','Calcium carbonate precipitate',[['CaCl2',1],['Na2CO3',1]],[['CaCO3',1],['NaCl',2]],'Mix aqueous solutions; CaCO3 precipitates.','The carbonate group stays intact during the exchange.'),
 r('neutralization','double','Acid–base neutralization',[['HCl',1],['NaOH',1]],[['NaCl',1],['H2O',1]],'Aqueous hydrochloric acid and sodium hydroxide.','Net ionic change: H+ + OH− → H2O. Sodium and chloride remain dissolved; HCl is a formula bookkeeping representation.'),
 r('copper-hydroxide','double','Copper hydroxide precipitate',[['CuSO4',1],['NaOH',2]],[['Cu(OH)2',1],['Na2SO4',1]],'Mix aqueous solutions; Cu(OH)2 precipitates.','Two hydroxide groups associate with each copper(II) ion.'),
 r('methane','combustion','Methane',[['CH4',1],['O2',2]],[['CO2',1],['H2O',2]],'Ignition and sufficient oxygen; complete combustion.','Oxygen is a reactant. All four oxygen atoms must be on the bench before the reaction starts.'),
 r('ethane','combustion','Ethane',[['C2H6',2],['O2',7]],[['CO2',4],['H2O',6]],'Ignition and sufficient oxygen; complete combustion.','Whole-number coefficients require two ethane molecules and seven oxygen molecules.'),
 r('propane','combustion','Propane',[['C3H8',1],['O2',5]],[['CO2',3],['H2O',4]],'Ignition and sufficient oxygen; complete combustion.','Three carbon atoms become three carbon dioxide molecules.'),
 r('methanol','combustion','Methanol',[['CH3OH',2],['O2',3]],[['CO2',2],['H2O',4]],'Ignition and sufficient oxygen; complete combustion.','The fuel already contains oxygen atoms; they also contribute to the products.'),
 r('ethanol','combustion','Ethanol',[['C2H5OH',1],['O2',3]],[['CO2',2],['H2O',3]],'Ignition and sufficient oxygen; complete combustion.','Each ethanol molecule supplies two carbon atoms, six hydrogen atoms and one oxygen atom.')
];

refineGeometry(SPECIES);
// Physical states belong to the selected reaction, not to a formula globally.
const states={
 water:['g g','g'],ammonia:['g g','g'],'hydrogen-chloride':['g g','g'],'magnesium-oxide':['s g','s'],'sodium-chloride':['s g','s'],
 electrolysis:['l','g g'],peroxide:['aq','l g'],limestone:['s','s g'],'baking-soda':['s','s g g'],chlorate:['s','s g'],
 'zinc-acid':['s aq','aq g'],'magnesium-acid':['s aq','aq g'],'iron-copper':['s aq','aq s'],'zinc-copper':['s aq','aq s'],'chlorine-bromide':['aq aq','aq aq'],
 'silver-chloride':['aq aq','s aq'],'barium-sulfate':['aq aq','s aq'],'calcium-carbonate':['aq aq','s aq'],neutralization:['aq aq','aq l'],'copper-hydroxide':['aq aq','s aq'],
 methane:['g g','g g'],ethane:['g g','g g'],propane:['g g','g g'],methanol:['l g','g g'],ethanol:['l g','g g']
};
const net={
 'zinc-acid':'Zn(s) + 2 H⁺(aq) → Zn²⁺(aq) + H₂(g)',
 'magnesium-acid':'Mg(s) + 2 H⁺(aq) → Mg²⁺(aq) + H₂(g)',
 'iron-copper':'Fe(s) + Cu²⁺(aq) → Fe²⁺(aq) + Cu(s)',
 'zinc-copper':'Zn(s) + Cu²⁺(aq) → Zn²⁺(aq) + Cu(s)',
 'chlorine-bromide':'Cl₂(aq) + 2 Br⁻(aq) → 2 Cl⁻(aq) + Br₂(aq)',
 'silver-chloride':'Ag⁺(aq) + Cl⁻(aq) → AgCl(s)',
 'barium-sulfate':'Ba²⁺(aq) + SO₄²⁻(aq) → BaSO₄(s)',
 'calcium-carbonate':'Ca²⁺(aq) + CO₃²⁻(aq) → CaCO₃(s)',
 neutralization:'H⁺(aq) + OH⁻(aq) → H₂O(l)',
 'copper-hydroxide':'Cu²⁺(aq) + 2 OH⁻(aq) → Cu(OH)₂(s)'
};
for(const r of REACTIONS){
 r.reactants=r.reactants.map((e,i)=>[...e,states[r.id][0].split(' ')[i]]);
 r.products=r.products.map((e,i)=>[...e,states[r.id][1].split(' ')[i]]);
 r.netIonic=net[r.id]||null;r.reversible=r.id==='ammonia';
}
REACTIONS.find(r=>r.id==='water').condition='Ignition; the hot products are represented before water vapor condenses.';
REACTIONS.find(r=>r.id==='neutralization').lesson='H⁺ is shorthand for hydrated acid protons; solvent water is omitted. H⁺ and OH⁻ form water. Sodium and chloride remain separate spectator ions.';
REACTIONS.find(r=>r.id==='silver-chloride').lesson='Silver and chloride ions form a solid. Sodium and nitrate stay separate and remain in solution.';
REACTIONS.find(r=>r.id==='zinc-acid').lesson='Zinc is oxidized to Zn²⁺ and acid protons form H₂. Chloride stays dissolved as a spectator.';
REACTIONS.find(r=>r.id==='chlorine-bromide').condition='Dissolved chlorine and aqueous potassium bromide.';
for(const r of REACTIONS.filter(r=>r.type==='combustion'))r.condition+=' Water is shown as vapor in the hot products.';

export const sub = s=>s.replace(/\d/g,n=>'₀₁₂₃₄₅₆₇₈₉'[+n]);
export const chargeText=q=>!q?'':(Math.abs(q)===1?'':String(Math.abs(q)).replace(/\d/g,n=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[+n]))+(q>0?'⁺':'⁻');
export const sideText=(side,withStates=false)=>side.map(([id,n,phase])=>(n===1?'':n+' ')+sub(id)+(withStates&&phase?'('+phase+')':'')).join(' + ');
export const equation=r=>sideText(r.reactants,true)+(r.reversible?' ⇌ ':' → ')+sideText(r.products,true);
export const clone=s=>JSON.parse(JSON.stringify(s));
export const empty=()=>({atoms:[],bonds:[],particles:[],nextId:1});
export function counts(atoms){const c={};for(const a of atoms)c[a.el]=(c[a.el]||0)+1;return c;}
const sameCounts=(a,b)=>new Set([...Object.keys(a),...Object.keys(b)]).size===Object.keys(a).length&&Object.keys(a).every(k=>a[k]===b[k]);
const edgeKey=b=>[Math.min(b.a,b.b),Math.max(b.a,b.b),b.order].join(':');
const metalCharge={Na:1,K:1,Ag:1,Mg:2,Ca:2,Ba:2,Zn:2,Cu:2,Fe:2};
function ionDescriptor(atoms){
 const c=counts(atoms);
 if(atoms.length===1){const el=atoms[0].el;return {formula:el,charge:metalCharge[el]||(el==='H'?1:el==='O'?-2:-1)};}
 if(c.S===1&&c.O===4)return {formula:'SO4',charge:-2};
 if(c.C===1&&c.O===3)return {formula:c.H?'HCO3':'CO3',charge:c.H?-1:-2};
 if(c.N===1&&c.O===3)return {formula:'NO3',charge:-1};
 if(c.Cl===1&&c.O===3)return {formula:'ClO3',charge:-1};
 if(c.O===1&&c.H===1)return {formula:'OH',charge:-1};
 throw Error('Unspecified ion in the reaction catalog.');
}
export function components(state,covalent=false){
 const remaining=new Set(state.atoms.map(a=>a.id)),out=[];
 while(remaining.size){const todo=[remaining.values().next().value],ids=[];remaining.delete(todo[0]);
  while(todo.length){const id=todo.pop();ids.push(id);for(const b of state.bonds){if(covalent&&b.order===0)continue;const n=b.a===id?b.b:b.b===id?b.a:null;if(n!==null&&remaining.delete(n))todo.push(n);}}
  out.push({atoms:state.atoms.filter(a=>ids.includes(a.id)),bonds:state.bonds.filter(b=>ids.includes(b.a)&&ids.includes(b.b)&&(!covalent||b.order>0))});
 }return out;
}
export function addSpecies(state,id,phase=null){
 const spec=SPECIES[id],ids=spec.atoms.map(()=>state.nextId++),dissociated=phase==='aq'&&(spec.kind==='ionic'||id==='HCl');
 const atoms=spec.atoms.map((a,i)=>({...clone(a),id:ids[i]}));
 const bonds=spec.bonds.filter(b=>!dissociated||(b[2]>0&&id!=='HCl')).map(([a,b,order])=>({a:ids[a],b:ids[b],order}));
 state.atoms.push(...atoms);state.bonds.push(...bonds);
 state.particles ||= [];
 if(spec.kind==='ionic'||dissociated){
  for(const g of components({atoms,bonds},true))state.particles.push({ids:g.atoms.map(a=>a.id),...ionDescriptor(g.atoms),phase,solidUnit:phase==='s'?id:null});
 }else state.particles.push({ids,formula:id,charge:0,phase,solidUnit:spec.kind==='element'&&phase==='s'?id:null});
 return ids;
}
export function arrange(state,columns=null,padding=2.8){
 const groups=components(state),cols=Math.max(1,columns||Math.ceil(Math.sqrt(groups.length*1.3))),rows=Math.ceil(groups.length/cols);
 const sizes=groups.map(g=>[0,1].map(k=>Math.max(...g.atoms.map(a=>a.p[k]))-Math.min(...g.atoms.map(a=>a.p[k]))+Math.max(padding,2*Math.max(...g.atoms.map(a=>atomRadius(a.el)))+.4)));
 const widths=Array.from({length:cols},(_,c)=>Math.max(padding,...sizes.filter((_,i)=>i%cols===c).map(s=>s[0])));
 const heights=Array.from({length:rows},(_,r)=>Math.max(padding,...sizes.slice(r*cols,(r+1)*cols).map(s=>s[1])));
 const sum=a=>a.reduce((s,v)=>s+v,0);
 groups.forEach((g,i)=>{const c=i%cols,r=Math.floor(i/cols),center=centroid(g.atoms),target=[sum(widths.slice(0,c))+widths[c]/2-sum(widths)/2,sum(heights)/2-sum(heights.slice(0,r))-heights[r]/2,0];
  g.atoms.forEach(a=>a.p=V.add(V.sub(a.p,center),target));
 });return state;
}
export function batch(side,columns=null){const s=empty();for(const [id,n,phase] of side)for(let i=0;i<n;i++)addSpecies(s,id,phase);return arrange(s,columns);}
export function equationTemplate(reaction,{vertical=false}={}){
 function build(side){
  const state=empty();state.terms=[];
  for(const [formula,coefficient,phase] of side){
   const ids=[];for(let i=0;i<coefficient;i++)ids.push(...addSpecies(state,formula,phase));
   const part={atoms:state.atoms.filter(a=>ids.includes(a.id)),bonds:state.bonds.filter(b=>ids.includes(b.a)&&ids.includes(b.b))};
   const count=components(part).length;arrange(part,count>3?2:1,1.35);
   state.terms.push({formula,coefficient,phase,ids});
  }return state;
 }
 const start=build(reaction.reactants),end=build(reaction.products),diagram=placeEquation(start,end,{vertical});
 return {start,end,diagram};
}
export function arrangeEquationReactants(state,reaction,options={}){
 const valid=validate(state,reaction,{checkGeometry:false});if(!valid.ok)return false;
 const template=equationTemplate(reaction,options).start;
 // Map through the validator's canonical inventory, which has the same ID order.
 const positions=new Map(template.atoms.map(a=>[valid.mapping.get(a.id),a.p]));
 state.atoms.forEach(a=>a.p=[...positions.get(a.id)]);
 return true;
}
function edge(s,a,b){return s.bonds.find(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a))?.order??-1;}
export function matchGraph(a,b){
 if(a.atoms.length!==b.atoms.length||a.bonds.length!==b.bonds.length)return null;
 const degree=(s,id)=>s.bonds.filter(b=>b.a===id||b.b===id).length;
 const order=[...a.atoms].sort((x,y)=>degree(a,y.id)-degree(a,x.id)),map=new Map(),used=new Set();
 function visit(i){if(i===order.length)return true;const x=order[i];
  for(const y of b.atoms){if(used.has(y.id)||x.el!==y.el||degree(a,x.id)!==degree(b,y.id))continue;
   if([...map].some(([u,v])=>edge(a,x.id,u)!==edge(b,y.id,v)))continue;
   map.set(x.id,y.id);used.add(y.id);if(visit(i+1))return true;map.delete(x.id);used.delete(y.id);
  }return false;
 }return visit(0)?map:null;
}
export function identify(group){for(const id of Object.keys(SPECIES)){const s=empty();addSpecies(s,id);if(matchGraph(group,s))return id;}return null;}
export function validate(state,reaction,{checkGeometry=true}={}){
 if(!state||!Array.isArray(state.atoms)||!Array.isArray(state.bonds)||state.atoms.length>64)return {ok:false,message:'The bench holds at most 64 atoms.'};
 const ids=new Set(),edges=new Set();
 for(const a of state.atoms){if(!Number.isSafeInteger(a.id)||ids.has(a.id)||!Array.isArray(a.p)||a.p.length!==3||!a.p.every(Number.isFinite))return {ok:false,message:'The construction has an invalid atom. Reset or undo the edit.'};ids.add(a.id);}
 for(const b of state.bonds){const k=[Math.min(b.a,b.b),Math.max(b.a,b.b)].join(':');if(!ids.has(b.a)||!ids.has(b.b)||b.a===b.b||edges.has(k)||![0,1,2,3].includes(b.order))return {ok:false,message:'The construction has an invalid or repeated connection.'};edges.add(k);}
 const expected=batch(reaction.reactants),have=counts(state.atoms),want=counts(expected.atoms),diff=[];
 for(const el of new Set([...Object.keys(want),...Object.keys(have)])){const d=(want[el]||0)-(have[el]||0);if(d)diff.push((d>0?'Add ':'Remove ')+Math.abs(d)+' '+el);}
 if(diff.length)return {ok:false,message:diff.join('; ')+'. Match the reactant inventory first.'};
 const left=components(expected),mapping=new Map();
 for(const g of components(state)){
  let matched=null,index=-1;
  for(let i=0;i<left.length;i++){const m=matchGraph(left[i],g);if(m){matched=m;index=i;break;}}
  if(index<0)return {ok:false,message:'Atom counts match. Check connections and bond orders'+(reaction.netIonic?'; aqueous ions must be separate. Use the particle guide.':': the bench must contain '+sideText(reaction.reactants)+'.')};
  for(const [a,b] of matched)mapping.set(a,b);left.splice(index,1);
 }
 if(left.length)return {ok:false,message:'Finish connecting the reactants.'};
 if(checkGeometry)for(let i=0;i<state.atoms.length;i++)for(let j=i+1;j<state.atoms.length;j++){const a=state.atoms[i],b=state.atoms[j];if(Math.hypot(...V.sub(a.p,b.p))<atomRadius(a.el)+atomRadius(b.el))return {ok:false,message:'Atoms overlap. Choose Arrange reactants before reacting.'};}
 return {ok:true,message:'Ready. Every product atom will come from this bench.',particles:expected.particles.map(p=>({...p,ids:p.ids.map(id=>mapping.get(id))})),mapping,expected};
}
export function annotate(state,reaction){
 const valid=validate(state,reaction);return {...state,particles:valid.ok?valid.particles:[]};
}
export function tidyReactants(state,reaction,columns=null){
 const valid=validate(state,reaction,{checkGeometry:false});if(!valid.ok)return arrange(state,columns);
 const target=batch(reaction.reactants,columns),positions=new Map(target.atoms.map(a=>[valid.mapping.get(a.id),a.p]));
 state.atoms.forEach(a=>a.p=[...positions.get(a.id)]);return state;
}
export function particleText(p){return sub(p.formula)+chargeText(p.charge)+(p.phase?'('+p.phase+')':'');}
export function particleSummary(particles){
 const terms=new Map();for(const p of particles){const text=particleText(p);terms.set(text,(terms.get(text)||0)+1);}
 return [...terms].map(([s,n])=>(n===1?'':n+' ')+s).join(' + ');
}
export function totalCharge(state){return (state.particles||[]).reduce((q,p)=>q+p.charge,0);}
function particleKey(p){return [p.formula,p.charge,p.phase].join(':');}
function fitBodies(start,end,kept,fixed,preserveRotation=new Set()){
 const target=new Map(end.atoms.map(a=>[a.id,a]));
 return components({atoms:start.atoms,bonds:kept.filter(b=>b.order>0)}).map(g=>{
  const from=centroid(g.atoms),to=centroid(g.atoms.map(a=>target.get(a.id))),local=g.atoms.map(a=>V.sub(a.p,from));
  const locked=g.atoms.every(a=>fixed.has(a.id));
  const q=locked||g.atoms.every(a=>preserveRotation.has(a.id))?[1,0,0,0]:bestRotation(local,g.atoms.map(a=>V.sub(target.get(a.id).p,to)));
  const goal=locked?from:to;
  g.atoms.forEach((a,i)=>target.get(a.id).p=V.add(goal,rotate(local[i],q)));
  return {ids:g.atoms.map(a=>a.id),from,to:goal,local,q,fixed:locked};
 });
}
function avoidOverlap(positions,bodies,atoms,iterations=32){
 const owner=new Map();bodies.forEach((b,i)=>b.ids.forEach(id=>owner.set(id,i)));
 for(let it=0;it<iterations;it++){
  let worst=0;
  for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){
   const a=atoms[i],b=atoms[j],ga=owner.get(a.id),gb=owner.get(b.id);if(ga===gb)continue;
   const delta=V.sub(positions.get(a.id),positions.get(b.id)),distance=Math.hypot(...delta),min=atomRadius(a.el)+atomRadius(b.el)+.12;
   if(distance>=min-1e-5)continue;const overlap=min-distance;worst=Math.max(worst,overlap);
   const direction=it>10?V.unit(V.add(delta,[0,0,(a.id%2?1:-1)*.5])):distance>1e-8?V.scale(delta,1/distance):V.unit([((a.id+b.id)%2?1:-1),.5,.7]);
   const wa=bodies[ga].fixed?0:1,wb=bodies[gb].fixed?0:1;if(!wa&&!wb)continue;
   if(wa)for(const id of bodies[ga].ids)positions.set(id,V.add(positions.get(id),V.scale(direction,overlap*wa/(wa+wb))));
   if(wb)for(const id of bodies[gb].ids)positions.set(id,V.sub(positions.get(id),V.scale(direction,overlap*wb/(wa+wb))));
  }
  if(worst<1e-4)break;
 }
 return positions;
}
function packProducts(state,bodies){
 const positions=new Map(state.atoms.map(a=>[a.id,[...a.p]])),byId=new Map(state.atoms.map(a=>[a.id,a]));
 const occupied=bodies.filter(b=>b.fixed).flatMap(b=>b.ids);
 for(const body of bodies.filter(b=>!b.fixed)){
  let offset=null;
  for(let ring=0;ring<70&&!offset;ring++){
   const n=ring===0?1:Math.max(12,ring*8);
   for(let k=0;k<n;k++){
    const trial=[ring*.5*Math.cos(k*2*Math.PI/n),ring*.5*Math.sin(k*2*Math.PI/n),0];
    if(body.ids.every(id=>occupied.every(other=>Math.hypot(...V.sub(V.add(positions.get(id),trial),positions.get(other)))>=atomRadius(byId.get(id).el)+atomRadius(byId.get(other).el)+.25))){offset=trial;break;}
   }
  }
  if(!offset)throw Error('Unable to separate product groups.');
  for(const id of body.ids)positions.set(id,V.add(positions.get(id),offset));
  occupied.push(...body.ids);
 }
 return positions;
}
export function planReaction(state,reaction,{columns=null,equationLayout=false,vertical=false}={}){
 const valid=validate(state,reaction);if(!valid.ok)throw Error(valid.message);
 const template=equationLayout?equationTemplate(reaction,{vertical}):null;
 const start=clone({...state,particles:valid.particles}),target=template?.end||batch(reaction.products,columns),mapping=new Map(),used=new Set();
 if(!sameCounts(counts(start.atoms),counts(target.atoms))||totalCharge(start)!==totalCharge(target))throw Error('The catalog does not conserve atoms and charge.');
 const sourceFragments=components(start,true),destFragments=components(target,true).sort((a,b)=>b.atoms.length-a.atoms.length);
 // Prefer complete conserved ions/molecules, including monatomic spectators with unchanged charge.
 const targetParticle=new Map(target.particles.flatMap(p=>p.ids.map(id=>[id,p]))),sourceParticle=new Map(start.particles.flatMap(p=>p.ids.map(id=>[id,p])));
 for(const dst of destFragments){
  const candidates=sourceFragments.filter(src=>!src.atoms.some(a=>used.has(a.id)));
  candidates.sort((a,b)=>+(particleKey(sourceParticle.get(b.atoms[0].id))===particleKey(targetParticle.get(dst.atoms[0].id)))-+(particleKey(sourceParticle.get(a.atoms[0].id))===particleKey(targetParticle.get(dst.atoms[0].id))));
  for(const src of candidates){const m=matchGraph(dst,src);if(m){for(const [d,s] of m){mapping.set(d,s);used.add(s);}break;}}
 }
 for(const a of target.atoms){if(mapping.has(a.id))continue;const src=start.atoms.find(s=>s.el===a.el&&!used.has(s.id));if(!src)throw Error('Atom conservation failed.');mapping.set(a.id,src.id);used.add(src.id);}
 if(used.size!==start.atoms.length)throw Error('A reactant atom was left unmapped.');
 const end={atoms:target.atoms.map(a=>({...a,id:mapping.get(a.id)})),bonds:target.bonds.map(b=>({...b,a:mapping.get(b.a),b:mapping.get(b.b)})),particles:target.particles.map(p=>({...p,ids:p.ids.map(id=>mapping.get(id))})),nextId:start.nextId};
 const spectatorIds=new Set();
 for(const p of start.particles){
  const found=end.particles.find(e=>particleKey(e)===particleKey(p)&&e.ids.length===p.ids.length&&e.ids.every(id=>p.ids.includes(id)));
  if(found&&p.phase==='aq'&&p.charge){p.spectator=found.spectator=true;p.ids.forEach(id=>spectatorIds.add(id));}
 }
 const old=new Set(start.bonds.map(edgeKey)),next=new Set(end.bonds.map(edgeKey)),kept=start.bonds.filter(b=>next.has(edgeKey(b)));
 const fixedIds=equationLayout?new Set():spectatorIds;
 const bodies=fitBodies(start,end,kept,fixedIds,spectatorIds);
 // Resolve destination crowding as rigid product groups around stationary spectator ions.
 const productBodies=components(end).map(g=>({ids:g.atoms.map(a=>a.id),fixed:g.atoms.every(a=>fixedIds.has(a.id))}));
 const endPositions=packProducts(end,productBodies);
 end.atoms.forEach(a=>a.p=endPositions.get(a.id));
 // Product packing translates complete groups, so update each body's goal accordingly.
 bodies.forEach(b=>b.to=centroid(b.ids.map(id=>end.atoms.find(a=>a.id===id))));
 const samples=[],steps=160;
 for(let i=0;i<=steps;i++){
  const u=i/steps,positions=new Map();
  bodies.forEach((b,j)=>{const q=slerpIdentity(b.q,u),center=V.add(V.add(b.from,V.scale(V.sub(b.to,b.from),u)),[0,0,b.fixed?0:Math.sin(Math.PI*u)*((j%3)-1)*.9]);
   b.ids.forEach((id,k)=>positions.set(id,V.add(center,rotate(b.local[k],q))));
  });
  if(i!==0&&i!==steps)avoidOverlap(positions,bodies,start.atoms,48);
  samples.push(start.atoms.map(a=>positions.get(a.id)));
 }
 const centers=samples.map(sample=>bodies.map(body=>centroid(body.ids.map(id=>({p:sample[start.atoms.findIndex(a=>a.id===id)]})))));
 const p={start,end,kept,bodies,samples,centers,spectatorIds:[...spectatorIds],broken:start.bonds.filter(b=>!next.has(edgeKey(b))),formed:end.bonds.filter(b=>!old.has(edgeKey(b)))};
 if(template){p.diagram=clone(template.diagram);for(const term of p.diagram.reactants.terms)term.ids=term.ids.map(id=>valid.mapping.get(id));for(const term of p.diagram.products.terms)term.ids=term.ids.map(id=>mapping.get(id));}
 // Camera must contain the route as well as its endpoints.
 p.bounds=start.atoms.map(a=>clone(a));for(const sample of samples)sample.forEach((position,i)=>p.bounds.push({id:start.atoms[i].id,el:start.atoms[i].el,p:position}));
 return p;
}
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function frame(plan,progress){
 const t=Math.max(0,Math.min(1,progress)),move=ease((t-.24)/.5),breakFade=1-ease((t-.06)/.18),form=ease((t-.76)/.2);
 const k=move*(plan.samples.length-1),i=Math.min(plan.samples.length-2,Math.floor(k)),f=k-i;
 const positions=new Map();
 plan.bodies.forEach((b,j)=>{const center=plan.centers[i][j].map((v,k)=>v+(plan.centers[i+1][j][k]-v)*f),q=slerpIdentity(b.q,move);b.ids.forEach((id,k)=>positions.set(id,V.add(center,rotate(b.local[k],q))));});
 if(move>0&&move<1)avoidOverlap(positions,plan.bodies,plan.start.atoms,18);
 return {atoms:plan.start.atoms.map(a=>({...a,p:move===0?[...a.p]:move===1?[...plan.end.atoms.find(e=>e.id===a.id).p]:positions.get(a.id)})),
 bonds:[...plan.kept.map(b=>({...b,opacity:1})),...plan.broken.map(b=>({...b,opacity:breakFade})),...plan.formed.map(b=>({...b,opacity:form}))],
 particles:t<.06?plan.start.particles:t>=.96?plan.end.particles:plan.start.particles.filter(p=>p.spectator),diagram:plan.diagram,
 phase:t<.06?'Observe reactants':t<.24?'Mark changing connections':t<.76?'Track atoms · schematic paths':t<.96?'Show product connections':'Products formed',
 note:t>=.06&&t<.96?'Separated atoms are an accounting step, not a proposed free-atom intermediate.':'Same atoms; chemical identities and connections change.'};
}


