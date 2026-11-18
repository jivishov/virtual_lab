// Rules and dimensions for the VSEPR Lab only. The separate Molecule Builder
// keeps its own model. Bond distances are nucleus-to-nucleus, in picometers.
export const PM_SCALE = .012;
export const BOND_SOURCE = 'https://openstax.org/books/chemistry-2e/pages/8-1-valence-bond-theory';
export const VSEPR_SOURCE = 'https://openstax.org/books/chemistry-2e/pages/7-6-molecular-structure-and-polarity';
export const ROTATION_SOURCE = 'https://openstax.org/books/organic-chemistry/pages/3-6-conformations-of-ethane';
export const MULTIPLE_SOURCE = 'https://openstax.org/books/chemistry-2e/pages/8-3-multiple-bonds';
// Rounded representative values from OpenStax table 8.1; not a claim that
// every molecule with that bond has the same experimental distance.
const lengths = {
 'C-H:1':107, 'H-N:1':102, 'H-O:1':98, 'C-C:1':151,
 'C-C:2':134, 'C-C:3':121, 'C-N:1':142, 'C-N:2':130,
 'C-N:3':116, 'C-O:1':140, 'C-O:2':120, 'C-O:3':114,
 'Cl-H:1':128, 'Br-H:1':141, 'H-I:1':161, 'O-O:1':148,
 'O-O:2':121, 'F-F:1':141, 'Cl-Cl:1':199,
};
// Configured covalent-radius estimates for less common links. These give a
// transparent size trend, not molecule-specific experimental measurements.
// Radii (pm): Cordero et al., Dalton Trans. 2008, 2832 (doi below).
const radii = {H:31,Be:96,B:84,C:76,N:71,O:66,F:57,Si:111,P:107,S:105,Cl:102,Se:120,Br:120,I:139,Xe:140};
export const RADIUS_SOURCE = 'https://doi.org/10.1039/B801115J';
// NIST CCCBDB experimental internal-coordinate tables, read 2026-11-14.
// Values below are converted from Å to pm. Coordinate conventions (re, r0,
// rs, etc.) vary by source; the kit preserves ideal VSEPR angles.
const measured={
 bf3:['7637072',{'F:1':130.7}],bbr3:['10294334',{'Br:1':189.3}],
 sif4:['7783611',{'F:1':155.4}],pcl3:['7719122',{'Cl:1':204.3}],
 scl2:['10545990',{'Cl:1':201.3}],h2s:['7783064',{'H:1':133.6}],
 cs2:['75150',{'S:2':155.4}],ocs:['463581',{'O:2':116,'S:2':156}],
 ch3cl:['74873',{'Cl:1':178.5,'H:1':109}],becl2:['7787475',{'Cl:1':175}],
 sf6:['2551624',{'F:1':156.1}],
 xef2:['13709369',{'F:1':197.4}],xef4:['13709610',{'F:1':193.5}],
 so2:['7446095',{'O:2':143.2}],
 pcl5:['10026138',{'Cl:1:equatorial':202,'Cl:1:axial':212.4}],
 sf4:['7783600',{'F:1:equatorial':154.5,'F:1:axial':164.6}],
 sef4:['13465662',{'F:1:equatorial':168.2,'F:1:axial':177.1}],
 brf5:['7789302',{'F:1:equatorial':177.4,'F:1:axial':168.9}],
};
export function referenceLengths(id,spec){
 const entry=measured[id];if(!entry)return spec;
 return {...spec,ligands:spec.ligands.map(part=>{
  const pm=entry[1][part.element+':'+part.order+(part.role?':'+part.role:'')];
  return pm?{...part,pm,source:'https://cccbdb.nist.gov/exp2x.asp?casno='+entry[0]+'&charge=0'}:part;
 })};
}
export function bondSpec(center, part) {
 const key=[center,part.element].sort().join('-')+':'+part.order;
 const reference=lengths[key];
 const pm=part.pm??reference??Math.round((radii[center]+radii[part.element])*[0,1,.88,.78][part.order]);
 return {pm, length:pm*PM_SCALE, source:part.source||(reference?BOND_SOURCE:RADIUS_SOURCE),
  estimated:!part.pm&&!reference,
  basis:part.pm?'Experimental distance':reference?'Representative distance':'Radius-based estimate'};
}
export const bondSymbol = order => ['','–','=','≡'][order];
export const bondName = order => ['','Single','Double','Triple'][order];
export function rotationRule(part) {
 if(part.order===2)return {enabled:false,label:'Locked · π bond',detail:'A double bond holds the attached groups in a fixed orientation. Twisting would disrupt π overlap; turn the whole model to change your view.'};
 if(part.order===3)return {enabled:false,label:'Linear · two π bonds',detail:'A triple bond has two perpendicular π bonds and linear ends. Turning about this axis gives no distinct conformation in this model.'};
 return {enabled:!!part.group,label:'Rotatable · σ bond',detail:part.group?
  'Turn the attached group around this single bond. Bond length and local angles stay fixed. Real molecules have torsional energy barriers; this kit does not calculate them.':
  'A single σ bond permits rotation. This end is one atom, so there is no attached group to compare. Try ethane to turn a CH₃ group.'};
}
export function normalizedTorsion(part, value=60) {
 if(!rotationRule(part).enabled)return 0;
 return Number.isFinite(value)?Math.max(0,Math.min(360,value)):60;
}
export const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
export const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
// Local +y points away from the central hub along the bond. Three hydrogens
// give tetrahedral CH3, two give planar CH2, one gives linear CH.
export function groupDirections(part, torsion=60) {
 if(!part.group)return [];
 const count=part.group.hydrogens, phase=normalizedTorsion(part,torsion)*Math.PI/180;
 const axial=part.order===1?1/3:part.order===2?.5:1;
 const radial=Math.sqrt(1-axial*axial);
 return Array.from({length:count},(_,i)=>{
  const angle=phase+2*Math.PI*i/count;
  return [radial*Math.cos(angle),axial,-radial*Math.sin(angle)];
 });
}
// Compare all inter-domain angles, then the placement of lone pairs.
// Accept equivalent rotations/permutations without accepting axial TBP LPs
// or adjacent octahedral LPs in square-planar models.
export function geometryMatches(m, sites, directions) {
 if(sites.length!==m.domains||directions.length!==m.domains)return false;
 const occupied=sites.flatMap((kind,i)=>kind==='empty'?[]:[i]);
 if(occupied.length!==m.domains)return false;
 const vectors=directions.map(v=>Array.isArray(v)?unit(v):[v.x,v.y,v.z]);
 const pairDots=ids=>ids.flatMap((i,k)=>ids.slice(k+1).map(j=>dot(vectors[i],vectors[j]))).sort((a,b)=>a-b);
 const wanted=pairDots(m.hub.example),actual=pairDots(occupied);
 if(wanted.length!==actual.length||actual.some((v,i)=>Math.abs(v-wanted[i])>.001))return false;
 const pairs=occupied.filter(i=>sites[i]==='pair');
 if(m.domains===5&&pairs.some(i=>occupied.filter(j=>i!==j&&Math.abs(dot(vectors[i],vectors[j]))<.001).length!==2))return false;
 if(m.domains===6&&pairs.length===2&&dot(vectors[pairs[0]],vectors[pairs[1]])>-.999)return false;
 if(m.domains===5&&occupied.some(i=>{
  const role=m.pieces[sites[i]]?.role;if(!role)return false;
  const rightAngles=occupied.filter(j=>i!==j&&Math.abs(dot(vectors[i],vectors[j]))<.001).length;
  return rightAngles!==(role==='axial'?3:2);
 }))return false;
 if(m.domains===6&&pairs.length===1&&occupied.some(i=>{
  const role=m.pieces[sites[i]]?.role;if(!role)return false;
  return role!==((dot(vectors[i],vectors[pairs[0]])<-.999)?'axial':'equatorial');
 }))return false;
 return true;
}
