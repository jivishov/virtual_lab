import {THREE as T} from '../vendor/three-bundle.js';

// Conservative screen-space envelopes around the machined hub, pins, balls,
// amber insert and support. These bound labels; they never select a socket.
export function silhouette(slots,dirs,project,scale) {
  const parts=[];
  function capsule(owner,a,b,r) {parts.push({owner,a:project(a),b:project(b),r:r*scale});}
  const center=new T.Vector3();
  capsule(-1,center,center,.608);
  for(const slot of slots){
    if(!slot.part||!slot.part.visible)continue;
    const at=t=>dirs[slot.index].clone().multiplyScalar(t);
    capsule(slot.index,at(.57),at(slot.kind==='pair'?.94:slot.pos.length()-.15),.145);
    if(slot.kind==='pair'){
      capsule(slot.index,at(.98),at(1.49),.326);
      capsule(slot.index,at(1.67),at(1.73),.142);
    }else {
      capsule(slot.index,slot.pos,slot.pos,slot.radius);
      for(const extra of slot.extras||[]){capsule(slot.index,slot.pos,extra.position,.08);capsule(slot.index,extra.position,extra.position,extra.radius);}
    }
  }
  return parts;
}
function inside(p,c,pad=0) {
  const vx=c.b.x-c.a.x,vy=c.b.y-c.a.y,dx=p.x-c.a.x,dy=p.y-c.a.y;
  const len=vx*vx+vy*vy,t=len?Math.min(1,Math.max(0,(dx*vx+dy*vy)/len)):0;
  return (dx-vx*t)**2+(dy-vy*t)**2<=(c.r+pad)**2;
}
function hitsBox(c,b,pad) {
  // Intersect the capsule axis with a rectangle expanded by its radius.
  let lo=0,hi=1;
  for(const [start,end,lower,upper] of [[c.a.x,c.b.x,b.left,b.right],[c.a.y,c.b.y,b.top,b.bottom]]){
    const delta=end-start,min=lower-c.r-pad,max=upper+c.r+pad;
    if(Math.abs(delta)<.0001){if(start<min||start>max)return false;}
    else{
      const u=(min-start)/delta,v=(max-start)/delta;
      lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));
      if(lo>hi)return false;
    }
  }
  return true;
}
const bounds=(x,y,w,h)=>({left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2});
const collides=(a,b,pad=2)=>a.left<b.right+pad&&a.right>b.left-pad&&a.top<b.bottom+pad&&a.bottom>b.top-pad;
function position(l,x,y) {
  l.el.hidden=false;
  // The CSS anchor remains on the part. The tag is translated off its silhouette.
  l.el.style.left=l.x+'px';l.el.style.top=l.y+'px';
  l.el.style.translate=(x-l.x)+'px '+(y-l.y)+'px';
}
export function arrangeSiteTags(labels,objects,w,h,carrying) {
  const placed=[];
  const sorted=labels.slice().sort((a,b)=>a.depth-b.depth);
  for(const l of sorted){l.el.hidden=true;if(l.leader)l.leader.style.display='none';}
  for(const l of sorted.filter(l=>l.visible&&!l.leader)){
    const box=bounds(l.x,l.y,l.w,l.h);
    if(placed.some(b=>collides(box,b)))continue;
    // Vacant guides may pass behind a part in projection. Suppress their letter
    // if it would overprint a surface, even if the guide itself is in front.
    if(l.index>=0&&!l.el.classList.contains('center')&&objects.some(o=>hitsBox(o,box,1)))continue;
    position(l,l.x,l.y);placed.push(box);
  }
  if(carrying)return; // Leave the actual grips and transfer corridor clear.
  const center=labels.find(l=>l.index===-1);
  for(const l of sorted.filter(l=>l.visible&&l.leader)){
    const outward=Math.atan2(l.y-center.y,l.x-center.x);
    const own=objects.filter(o=>o.owner===l.index);
    let accepted=false;
    for(const gap of [5,10,15]){
      for(const turn of [-32,32,0,-63,63,-93,93,135,-135]){
        const a=outward+turn*Math.PI/180,dx=Math.cos(a),dy=Math.sin(a);
        const along=n=>({x:l.x+dx*n,y:l.y+dy*n});
        let edge=0;
        while(edge<80&&own.some(o=>inside(along(edge),o,1)))edge+=1.5;
        if(edge>=80)continue;
        const reach=Math.min(l.w/(2*Math.max(.001,Math.abs(dx))),l.h/(2*Math.max(.001,Math.abs(dy))));
        const tag=along(edge+gap+reach),box=bounds(tag.x,tag.y,l.w,l.h);
        if(box.left<3||box.top<3||box.right>w-3||box.bottom>h-3)continue;
        if(placed.some(b=>collides(box,b,3))||objects.some(o=>hitsBox(o,box,3)))continue;
        let clear=true;
        for(let n=edge;n<edge+gap;n+=2){
          const p=along(n);
          if(objects.some(o=>o.owner!==l.index&&inside(p,o,1))||placed.some(b=>collides(bounds(p.x,p.y,2,2),b))){clear=false;break;}
        }
        if(!clear)continue;
        const start=along(edge),end=along(edge+gap);
        l.leader.setAttribute('x1',start.x);l.leader.setAttribute('y1',start.y);
        l.leader.setAttribute('x2',end.x);l.leader.setAttribute('y2',end.y);
        l.leader.style.display='';position(l,tag.x,tag.y);placed.push(box);
        accepted=true;break;
      }
      if(accepted)break;
    }
  }
}
