/* Target selection and feedback adapted from the supplied ELISA classroom.
 * All points come from the live apparatus frames. Picking/hovering never moves liquid.
 */
export const AIM = Object.freeze({settleMs:280, maxGapMs:450, mouseRadius:16, handRadius:24, assistRadius:64});

export function pickScreenTarget(points,x,y,{hand=false,prefer=null,expected=null,assist=true}={}){
 if(!Number.isFinite(x)||!Number.isFinite(y))return null;
 const visible=points.filter(p=>p&&p.visible!==false&&p.z>=-1&&p.z<=1);
 let best=null,score=Infinity;
 for(const p of visible){
  const distance=Math.hypot(x-p.x,y-p.y),ratio=distance/p.radius;
  const weighted=ratio*(hand&&p.id===prefer ? .72 : 1);
  if(ratio<=1&&weighted<score){best={...p,assisted:false};score=weighted}
 }
 if(best)return best; // A real neighboring target always wins over assistance.
 if(hand&&assist){const p=visible.find(p=>p.id===expected);if(p&&Math.hypot(x-p.x,y-p.y)<=AIM.assistRadius)return {...p,assisted:true}}
 return null;
}

export class SettledAim{
 constructor(){this.reset()}
 reset(){this.sample=null;this.progress=0}
 update(target,x,y,now,radius=AIM.handRadius){
  if(!target||![x,y,now].every(Number.isFinite)){this.reset();return false}
  const tolerance=Math.max(5,Math.min(12,radius*.4)),s=this.sample;
  if(!s||s.target!==target||now<=s.last||now-s.last>AIM.maxGapMs||Math.hypot(x-s.x,y-s.y)>tolerance){
   this.sample={target,x,y,since:now,last:now,frames:1};this.progress=0;return false;
  }
  s.last=now;s.frames++;
  this.progress=Math.min(1,(now-s.since)/AIM.settleMs,(s.frames-1)/2);
  return this.progress===1;
 }
}

export const CONTROL_LABELS={
 'pipette-grip':'Pipette grip','pipette-bulb':'Pipette bulb','cuvette-grip':'Cuvette rim',
 'pipette-stand':'Pipette stand','cuvette-dock':'Cuvette pad',spec20:'Sample chamber',chamber:'Sample chamber',
 lid:'Sample-chamber lid',zero:'ZERO key',read:'READ key',clipboard:'Lab notebook'
};

/** Thin, depth-tested rings sit on the equipment, as in ELISA. */
export class TargetGuides{
 constructor(scene,geometry){
  this.scene=scene;this.geometry=geometry;
  const {G}=globalThis.E3D,r=scene.r;
  const make=(beacon)=>{
   const group=r.group();group.visible=false;
   const rings=(beacon?[[1,.033],[1.26,.018]]:[[1,.055]]).map(([radius,thickness])=>{
    const mesh=r.mesh(G.torus(radius,thickness,48),scene.mat(beacon?'#a4ecdc':'#5fd0bd',{pattern:5,emission:beacon?.55:.8,rough:1}),group);mesh.noShadow=true;return mesh;
   });
   return {group,rings,id:null};
  };
  this.beacon=make(true);this.focus=make(false);
 }
 mount(guide,id,{locked=false,invalid=false}={}){
  const frame=id&&this.geometry.targetFrame(id),q=frame&&this.geometry.screenTarget(id,{frame});
  guide.group.visible=!!frame&&!!q?.visible;
  if(!guide.group.visible){guide.id=null;return}
  const parent=this.geometry.node(frame.equipment);
  if(guide.group.parent!==parent){const old=guide.group.parent;if(old)old.children=old.children.filter(n=>n!==guide.group);parent.add(guide.group)}
  guide.id=id;guide.group.pos=[...frame.local];guide.group.rot=[...frame.rotation];
  const scale=locked?1.12:1;guide.group.scale=[frame.size[0]*scale,Math.min(...frame.size),frame.size[1]*scale];
  if(guide===this.focus){const color=globalThis.E3D.rgb(invalid?'#df9672':locked?'#f2b134':'#5fd0bd');for(const ring of guide.rings)ring.mat.color=color}
 }
 update(next,current,options={}){this.mount(this.beacon,next===current?null:next);this.mount(this.focus,current,options)}
 hide(){this.beacon.group.visible=this.focus.group.visible=false;this.beacon.id=this.focus.id=null}
}
