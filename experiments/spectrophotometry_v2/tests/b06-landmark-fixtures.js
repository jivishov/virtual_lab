// Anatomical, deterministic test data. These are not camera observations.
// Finger articulation follows the B06 hand-gestures regression fixtures.
export function b06Packet(pose,target,{width=1200,height=800,stamp=performance.now(),hand='Right',mirrored=true,thumbPress=0,roll=0}={}){
 const p=Array.from({length:21},()=>({x:0,y:0,z:0}));p[0]={x:0,y:.09,z:0};
 const bases=[5,9,13,17],folded=pose==='grip'?bases:pose==='point'?bases.slice(1):pose==='partial'?bases.slice(0,2):[];
 for(const [i,base]of bases.entries()){
  const x=(i-1.5)*.031,y=Math.abs(i-1.5)*.008;
  const offsets=folded.includes(base)?[[0,0],[-.034,-.018],[-.015,-.042],[.029,-.018]]:[[0,0],[-.043,-.002],[-.074,-.004],[-.10,-.006]];
  offsets.forEach(([dy,z],j)=>p[base+j]={x,y:y+dy,z});
 }
 for(let i=1;i<=4;i++)p[i]={x:-.035-i*.018,y:.075-i*.014,z:-.008};
 if(thumbPress)for(const [i,t]of [[2,{x:-.072,y:.044,z:-.008}],[3,{x:-.060,y:.023,z:-.009}],[4,{x:-.048,y:.015,z:-.006}]]){
  p[i]={x:p[i].x+(t.x-p[i].x)*thumbPress,y:p[i].y+(t.y-p[i].y)*thumbPress,z:p[i].z+(t.z-p[i].z)*thumbPress};
 }
 if(hand==='Left')for(const q of p)q.x=-q.x;
 if(roll)for(const q of p){const x=q.x,c=Math.cos(roll),s=Math.sin(roll);q.x=x*c-q.y*s;q.y=x*s+q.y*c}
 const center=[0,5,9,13,17].reduce((a,i)=>({x:a.x+p[i].x/5,y:a.y+p[i].y/5}),{x:0,y:0});
 const aspect=width/height,scale=1.7,cx=mirrored?1-target.x/width:target.x/width,cy=target.y/height;
 const image=p.map(q=>({x:cx+(q.x-center.x)*scale/aspect,y:cy+(q.y-center.y)*scale,z:q.z*scale/aspect}));
 return {landmarks:[image],worldLandmarks:[p],handedness:[[{categoryName:hand,score:.99}]],stamp};
}

export function combinePackets(...packets){
 return {...Object.fromEntries(['landmarks','worldLandmarks','handedness'].map(key=>[key,packets.flatMap(p=>p[key])])),stamp:packets[0]?.stamp};
}
