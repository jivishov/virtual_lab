/* Synthetic anatomical landmarks for end-to-end input mapping checks. No camera imagery. */
export function landmarkPacket(pose,target,{width,height,gain=1.8,stamp=performance.now(),hand='Right',thumbPress=0,roll=0}={}){
 const v=(x,y,z=0)=>({x,y,z});
 const points=[v(0,0),v(-.22,-.10),v(-.40,-.25),v(-.58,-.38),v(-.75,-.48),v(-.30,-.65),v(-.33,-1.02),v(-.35,-1.25),v(-.37,-1.44),v(0,-.72),v(0,-1.13),v(0,-1.40),v(0,-1.60),v(.27,-.67),v(.29,-1.04),v(.31,-1.27),v(.33,-1.46),v(.49,-.57),v(.55,-.84),v(.58,-1.03),v(.61,-1.19)];
 const fingers=[[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
 for(let i=0;i<4;i++)if(pose==='grip'||pose==='point'&&i>0){const [base,...ids]=fingers[i],b=points[base],size=i===3?.8:1;[[0,-.30,.12],[0,-.40,.30],[0,-.32,.42]].forEach((d,j)=>points[ids[j]]=v(b.x+d[0]*size,b.y+d[1]*size,b.z+d[2]*size))}
 const press=Math.max(0,Math.min(1,thumbPress));
 [[2,[-.40,-.34,.07]],[3,[-.36,-.50,.10]],[4,[-.30,-.60,.08]]].forEach(([id,target])=>{const p=points[id];points[id]=v(p.x+(target[0]-p.x)*press,p.y+(target[1]-p.y)*press,p.z+(target[2]-p.z)*press)});
 if(roll){const c=Math.cos(roll),s=Math.sin(roll);points.forEach(p=>{const x=p.x;p.x=x*c-p.y*s;p.y=x*s+p.y*c})}
 const palm=[0,5,9,13,17],px=palm.reduce((s,i)=>s+points[i].x,0)/5,py=palm.reduce((s,i)=>s+points[i].y,0)/5;
 const centerX=.5-(target.x/width-.5)/gain,centerY=.5+(target.y/height-.5)/(gain*1.25);
 const image=points.map(p=>v(centerX+(p.x-px)*.12,centerY+(p.y-py)*.12,p.z*.12));
 return {landmarks:[image],worldLandmarks:[points.map(p=>v(p.x*.045,p.y*.045,p.z*.045))],handedness:[[{categoryName:hand,score:.99}]],stamp};
}
