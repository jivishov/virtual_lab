import {atomRadius} from './reaction-geometry.js';

// Equation coordinates are shared by the model, the camera and the notation.
// A coefficient groups repeated units; a plus separates different formula terms.
const sum=values=>values.reduce((a,b)=>a+b,0);
function bounds(atoms){
 const min=[0,1,2].map(k=>Math.min(...atoms.map(a=>a.p[k]-atomRadius(a.el))));
 const max=[0,1,2].map(k=>Math.max(...atoms.map(a=>a.p[k]+atomRadius(a.el))));
 return {min,max,center:min.map((v,k)=>(v+max[k])/2),width:max[0]-min[0],height:max[1]-min[1]};
}
export function placeEquation(start,end,{vertical=false}={}){
 const gap=vertical?1.6:1,arrowGap=3.6;
 function measure(state){
  return state.terms.map(term=>{
   const atoms=state.atoms.filter(a=>term.ids.includes(a.id)),box=bounds(atoms);
   return {...term,box,width:Math.max(2.4,box.width+.4),height:Math.max(3.6,box.height+2.4)};
  });
 }
 const left=measure(start),right=measure(end);
 const extent=terms=>({width:vertical?Math.max(...terms.map(t=>t.width)):sum(terms.map(t=>t.width))+gap*(terms.length-1),height:vertical?sum(terms.map(t=>t.height))+gap*(terms.length-1):Math.max(...terms.map(t=>t.height))});
 const le=extent(left),re=extent(right),sideWidth=Math.max(le.width,re.width),sideHeight=Math.max(le.height,re.height);
 const baseline=-Math.max(...left.concat(right).map(t=>t.box.height))/2-.2;
 function position(state,terms,side,extent){
  const center=side*(arrowGap/2+sideWidth/2),plus=[];
  let cursor=vertical?extent.height/2:-extent.width/2;
  const placed=terms.map((term,i)=>{
   const x=vertical?center:center+cursor+term.width/2;
   const y=vertical?cursor-term.height/2:0;
   // Space below each group belongs to its formula and physical-state label.
   const target=[x,y+.65,0],delta=target.map((v,k)=>v-term.box.center[k]);
   for(const atom of state.atoms)if(term.ids.includes(atom.id))atom.p=atom.p.map((v,k)=>v+delta[k]);
   const result={formula:term.formula,coefficient:term.coefficient,phase:term.phase,ids:term.ids,x,y,width:term.width,height:term.height,atomTopY:y+.65+term.box.height/2,captionY:vertical?y-term.box.height/2-.2:baseline};
   cursor+=vertical?-(term.height+gap):term.width+gap;
   if(i<terms.length-1)plus.push(vertical?{x:center,y:cursor+gap/2}:{x:center+cursor-gap/2,y:.65});
   return result;
  });
  state.terms=placed;return {terms:placed,plus,center};
 }
 const reactants=position(start,left,-1,le),products=position(end,right,1,re);
 return {vertical,width:sideWidth*2+arrowGap+2.4,height:sideHeight+3.6,sideWidth,arrowGap,reactants,products};
}
