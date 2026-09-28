/* Phase-aware camera framing, adapted from the DNA microarray 3D lab. The camera only moves between strokes, never while a
   contact or plunger stroke is pending, so hand and mouse targeting stay stable.
   A manual orbit, zoom or preset suspends auto-framing until the next step change. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

  // Named scene regions to keep in view for each ELISA step. Names resolve through scene.bounds().
  function workSet(p){
    const ph=p.phase;
    if(ph==='label')return {names:['strips','marker'],pitch:.95};
    if(['serial','discard'].includes(ph))return {names:['strips','tips','waste'],pitch:.92};
    if(['buffer','antigen','samples','primary','secondary','substrate','stop'].includes(ph))return {names:['strips','rack','tips','waste'],pitch:.88};
    if(['incubate1','incubate2','incubate3','develop'].includes(ph))return {names:['strips','timer'],pitch:.9};
    if(ph.startsWith('wash'))return {names:p.needDrain?['strips','towels']:['strips','beaker','washTool'],pitch:.88};
    if(ph==='mixstop')return {names:['strips','towels'],pitch:.9};
    return {names:['strips'],pitch:1.1};
  }
  const stateKey=p=>[p.phase,p.timer?'t':'',p.needDrain?'d':''].join('|');

  /* Fit world points into a pixel safe-rectangle by adjusting look-at and distance.
     cameraMatrices(cam,w,h) must match the renderer's projection. */
  function fit(points,base,size,safe,cameraMatrices,limits={min:3.2,max:20}){
    const cam={...base,at:[...base.at]};
    const n=points.length||1;cam.at=[points.reduce((s,p)=>s+p[0],0)/n,0,points.reduce((s,p)=>s+p[2],0)/n];
    const sw=Math.max(40,safe.right-safe.left),sh=Math.max(40,safe.bottom-safe.top),cx=(safe.left+safe.right)/2,cy=(safe.top+safe.bottom)/2;
    for(let i=0;i<14;i++){
      const {vp}=cameraMatrices(cam,size.w,size.h);
      let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
      for(const p of points){
        const m=vp,w=m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];
        const x=((m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w+1)*.5*size.w,y=(1-(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w)*.5*size.h;
        x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      }
      const scale=Math.max((x1-x0)/sw,(y1-y0)/sh);
      const eff=cam.distance*Math.max(1,1.10/(size.w/size.h)),upp=2*eff*Math.tan(cam.fov*Math.PI/360)/size.h;
      const dx=(x0+x1)/2-cx,dy=(y0+y1)/2-cy,right=[Math.cos(cam.yaw),0,-Math.sin(cam.yaw)],away=[-Math.sin(cam.yaw),0,-Math.cos(cam.yaw)];
      const k=1/Math.max(.35,Math.sin(cam.pitch));
      for(let a=0;a<3;a++)cam.at[a]+=right[a]*dx*upp-away[a]*dy*upp*k;
      cam.distance=clamp(cam.distance*clamp(scale,.6,1.6),limits.min,limits.max);
      if(Math.abs(scale-1)<.01&&Math.abs(dx)<1&&Math.abs(dy)<1)break;
    }
    return cam;
  }

  class AutoFrame {
    constructor(o){this.o=o;this.key=null;this.manual=false;this.tween=null;this.enabled=true;}
    // Returns true when a new view was scheduled.
    update(p,{force=false,extra=[]}={}){
      const key=stateKey(p);
      if(key!==this.key){this.key=key;this.manual=false;force=true;}
      if(!this.enabled||this.manual||!force)return false;
      if(this.o.busy())return this.deferred=true,false;
      this.deferred=false;
      const set=workSet(p),points=[...set.names.flatMap(name=>this.o.bounds(name)),...extra],size=this.o.size();
      // A collapsed canvas (during layout or a hidden pane) cannot be framed; try again on resize.
      if(!points.length||!(size.w>=80&&size.h>=80))return this.deferred=true,false;
      const base={...this.o.camera(),yaw:0,pitch:set.pitch};
      // safe() may offer several free rectangles around overlays; keep the one that frames largest.
      const ok=c=>[...c.at,c.distance,c.pitch].every(Number.isFinite);
      const goal=[].concat(this.o.safe()).map(rect=>fit(points,base,size,rect,this.o.cameraMatrices)).filter(ok).sort((a,b)=>a.distance-b.distance)[0];
      if(!goal)return false;
      this.go(goal);return true;
    }
    go(goal){
      const from={...this.o.camera(),at:[...this.o.camera().at]};
      if(this.o.reduced()){this.o.apply(goal);this.tween=null;return;}
      this.tween={from,goal,start:null,duration:650};
    }
    step(now){
      if(!this.tween)return false;
      const t=this.tween;t.start??=now;const x=ease(clamp((now-t.start)/t.duration,0,1));
      const lerp=(a,b)=>a+(b-a)*x;
      this.o.apply({at:t.from.at.map((v,i)=>lerp(v,t.goal.at[i])),yaw:lerp(t.from.yaw,t.goal.yaw),pitch:lerp(t.from.pitch,t.goal.pitch),distance:lerp(t.from.distance,t.goal.distance)});
      if(x>=1)this.tween=null;
      return true;
    }
    userMoved(){this.manual=true;this.tween=null;}
    recenter(p){this.manual=false;return this.update(p,{force:true});}
    retry(p){if(this.deferred&&!this.o.busy()&&!this.manual)return this.update(p,{force:true});return false;}
  }
  const api={workSet,stateKey,fit,AutoFrame};root.ClassroomFraming=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
