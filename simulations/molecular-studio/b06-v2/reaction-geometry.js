// Idealized classroom geometry and rigid transformations. Scene units are not angstroms.
export const V={
 add:(a,b)=>a.map((v,i)=>v+b[i]), sub:(a,b)=>a.map((v,i)=>v-b[i]), scale:(a,k)=>a.map(v=>v*k),
 dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 unit:a=>{const n=Math.hypot(...a);return n?a.map(v=>v/n):[1,0,0];}
};
export const atomRadius=el=>({H:.294,C:.506,N:.488,O:.46,Cl:.57,Br:.644,Na:.68,K:.745,Mg:.635,Ca:.699,Ba:.782,S:.58,Fe:.57,Cu:.57,Zn:.57,Ag:.57}[el]||.55);
const rad=d=>d*Math.PI/180;
const a=(el,p)=>({el,p});
export function refineGeometry(species){
 // One length per illustrative bond family; angle geometry remains meaningful.
 const half=rad(104.5/2);
 species.H2O.atoms=[a('O',[0,0,0]),a('H',[-1.1*Math.sin(half),-1.1*Math.cos(half),0]),a('H',[1.1*Math.sin(half),-1.1*Math.cos(half),0])];
 const theta=rad(107),z=-Math.sqrt((Math.cos(theta)+.5)/1.5),rho=Math.sqrt(1-z*z);
 species.NH3.atoms=[a('N',[0,0,0]),...[0,1,2].map(i=>a('H',[1.1*rho*Math.cos(i*2*Math.PI/3),1.1*z,1.1*rho*Math.sin(i*2*Math.PI/3)]))];
 // Bent O centers and a non-planar H-O-O-H conformation (qualitative, not measured).
 species.H2O2.atoms=[a('O',[-.7,0,0]),a('O',[.7,0,0]),a('H',[-.7+1.1*Math.cos(rad(100)),1.1*Math.sin(rad(100)),0]),a('H',[.7-1.1*Math.cos(rad(100)),1.1*Math.sin(rad(100))*Math.cos(rad(110)),1.1*Math.sin(rad(100))*Math.sin(rad(110))])];
 // Recursively seat saturated-carbon neighbors on a tetrahedron around the incoming bond.
 function saturated(id,n,alcohol){
  const atoms=[a('C',[0,0,0])],bonds=[],queue=[{index:0,left:n,back:null,alcohol}];
  while(queue.length){
   const task=queue.shift(),center=atoms[task.index].p;
   let dirs;
   if(task.back===null)dirs=[[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]].map(V.unit);
   else{
    const back=V.unit(V.sub(atoms[task.back].p,center)),u=V.unit(V.cross(back,Math.abs(back[2])<.8?[0,0,1]:[0,1,0])),v=V.cross(back,u);
    dirs=[0,1,2].map(i=>V.add(V.scale(back,-1/3),V.scale(V.add(V.scale(u,Math.cos(i*2*Math.PI/3)),V.scale(v,Math.sin(i*2*Math.PI/3))),Math.sqrt(8/9))));
   }
   for(let i=0;i<dirs.length;i++){
    const el=i===0&&task.left>1?'C':i===0&&task.alcohol?'O':'H',length=el==='H'?1.1:1.5,index=atoms.length;
    atoms.push(a(el,V.add(center,V.scale(dirs[i],length))));bonds.push([task.index,index,1]);
    if(el==='C')queue.push({index,left:task.left-1,back:task.index,alcohol:task.alcohol});
    if(el==='O'){
     const towardC=V.scale(dirs[i],-1),u=V.unit(V.cross(towardC,Math.abs(towardC[2])<.8?[0,0,1]:[0,1,0]));
     const oh=V.add(V.scale(towardC,Math.cos(rad(108))),V.scale(u,Math.sin(rad(108))));
     bonds.push([index,atoms.length,1]);atoms.push(a('H',V.add(atoms[index].p,V.scale(oh,1.1))));
    }
   }
  }
  species[id].atoms=atoms;species[id].bonds=bonds;
 }
 saturated('CH4',1,false);saturated('C2H6',2,false);saturated('C3H8',3,false);saturated('CH3OH',1,true);saturated('C2H5OH',2,true);
 // Use one illustrative O-H length across water, alcohols, hydroxide and bicarbonate.
 for(const spec of Object.values(species))for(const [i,j,order] of spec.bonds){
  if(order!==1)continue;const pair=[spec.atoms[i],spec.atoms[j]],o=pair.find(a=>a.el==='O'),h=pair.find(a=>a.el==='H');
  if(o&&h)h.p=V.add(o.p,V.scale(V.unit(V.sub(h.p,o.p)),1.1));
 }
 // Formula-unit samples keep ionic components visibly separate; they are not lattice geometry.
 for(const spec of Object.values(species).filter(s=>s.kind==='ionic')){
  const remaining=new Set(spec.atoms.map((_,i)=>i));let x=0;
  while(remaining.size){const todo=[remaining.values().next().value],group=[];remaining.delete(todo[0]);
   while(todo.length){const i=todo.pop();group.push(i);for(const [a,b,o] of spec.bonds){if(!o)continue;const j=a===i?b:b===i?a:null;if(j!==null&&remaining.delete(j))todo.push(j);}}
   const min=Math.min(...group.map(i=>spec.atoms[i].p[0]-atomRadius(spec.atoms[i].el))),max=Math.max(...group.map(i=>spec.atoms[i].p[0]+atomRadius(spec.atoms[i].el)));
   for(const i of group)spec.atoms[i].p[0]+=x-min;
   x+=max-min+.5;
  }
 }
}
export const centroid=atoms=>atoms.reduce((c,a)=>V.add(c,V.scale(a.p,1/atoms.length)),[0,0,0]);
export function rotate(p,q){
 const u=q.slice(1),s=q[0];return V.add(V.add(V.scale(u,2*V.dot(u,p)),V.scale(p,s*s-V.dot(u,u))),V.scale(V.cross(u,p),2*s));
}
export function slerpIdentity(q,t){
 if(q[0]<0)q=q.map(v=>-v);
 const angle=Math.acos(Math.max(-1,Math.min(1,q[0])));
 if(angle<1e-8)return [1,0,0,0];
 const s=Math.sin(angle);return q.map((v,i)=>v*Math.sin(t*angle)/s+(i===0?Math.sin((1-t)*angle)/s:0));
}
// Horn absolute orientation, largest eigenvector found by symmetric Jacobi rotations.
export function bestRotation(from,to){
 if(from.length<2)return [1,0,0,0];
 const s=Array.from({length:3},()=>[0,0,0]);
 from.forEach((p,k)=>p.forEach((x,i)=>to[k].forEach((y,j)=>s[i][j]+=x*y)));
 const [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]]=s;
 const n=[[xx+yy+zz,yz-zy,zx-xz,xy-yx],[yz-zy,xx-yy-zz,xy+yx,zx+xz],[zx-xz,xy+yx,-xx+yy-zz,yz+zy],[xy-yx,zx+xz,yz+zy,-xx-yy+zz]];
 const e=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>+(i===j)));
 for(let step=0;step<40;step++){
  let p=0,q=1;
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(Math.abs(n[i][j])>Math.abs(n[p][q])){p=i;q=j;}
  if(Math.abs(n[p][q])<1e-12)break;
  const theta=.5*Math.atan2(2*n[p][q],n[q][q]-n[p][p]),c=Math.cos(theta),s=Math.sin(theta);
  const pp=n[p][p],qq=n[q][q],pq=n[p][q];
  for(let k=0;k<4;k++)if(k!==p&&k!==q){const kp=n[k][p],kq=n[k][q];n[k][p]=n[p][k]=c*kp-s*kq;n[k][q]=n[q][k]=s*kp+c*kq;}
  n[p][p]=c*c*pp-2*c*s*pq+s*s*qq;n[q][q]=s*s*pp+2*c*s*pq+c*c*qq;n[p][q]=n[q][p]=0;
  for(let k=0;k<4;k++){const ep=e[k][p],eq=e[k][q];e[k][p]=c*ep-s*eq;e[k][q]=s*ep+c*eq;}
 }
 const index=[0,1,2,3].reduce((a,b)=>n[b][b]>n[a][a]?b:a,0),q=e.map(row=>row[index]);
 return q[0]<0?q.map(v=>-v):q;
}
