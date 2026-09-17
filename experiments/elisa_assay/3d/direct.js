/* Direct manipulation for the additive 3D experiment. No keyboard is required.
 * Pointer and hand paths feed the same checked protocol actions. Camera palm
 * travel is an interaction mapping, not measured force or physical depth. */
(function(root){'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
class VerticalStroke{
 constructor(){this.reset()}
 reset(){this.zone=null;this.armed=false;this.fired=false;this.base=null;this.since=0;this.last=0}
 update(zone,x,y,now){
  if(!zone||![x,y,now].every(Number.isFinite)){this.reset();return{depth:0,down:false}}
  if(this.zone!==zone||now-this.last>350){this.reset();this.zone=zone;this.base={x,y};this.since=now}
  this.last=now;
  if(Math.abs(x-this.base.x)>.07||y<this.base.y-.06){this.reset();return{depth:0,down:false}}
  if(!this.armed){if(Math.abs(y-this.base.y)>.018){this.base={x,y};this.since=now}if(now-this.since>=140)this.armed=true;return{depth:0,down:false}}
  const depth=clamp((y-this.base.y)/.038);
  let down=false;if(depth===1&&!this.fired){down=true;this.fired=true}
  if(this.fired&&y<this.base.y+.010){this.fired=false;this.base={x,y};this.since=now;this.armed=false}
  return{depth,down};
 }
}
class Controller{
 constructor(api){this.a=api;this.canvas=api.canvas;this.pointer=null;this.pressed=false;this.pending=null;this.stroke=null;this.pen=null;this.vertical=new VerticalStroke();this.handDock=null;this.handLast=null;this.grab=null;this.openSince=null;this.inverted=false;this.taps=0;this.lastTap=0;this.capture=null;this.install();this.hint()}
 get tool(){return this.a.tool()}
 get p(){return this.a.protocol()}
 get s(){return this.a.scene()}
 get r(){return this.a.renderer()}
 get target(){return this.a.target()}
 now(){return performance.now()}
 say(t,error=false){this.a.notify(t,error)}
 hint(text){let t=this.tool,p=this.p,target=this.target;
  if(!text){if(t==='marker'&&p.labels.length===24)text='All wells labeled. Move to TOOL RETURN and click to put down the marker, then pick up the micropipette.';
   else if(t==='marker')text='Hold the left mouse button and sweep the marker nib across each well’s label pad.';
   else if(t==='micro')text=!p.tip?'Aim at the tip rack. Hold left button and move the mouse DOWN to seat a tip.':target?.id==='waste'?(p.tip.volume?'Left-click to discard the final dilution.':'Right-click over waste to eject the tip.'):p.tip.volume?'Move to the receiving well. Press the left button to deliver 50 µL.':'Move to a source. Press and release the left button to aspirate 50 µL.';
   else if(t==='wash')text=p.washVolume?'Move to a well and squeeze with the left button.':'Aim at the wash beaker. Squeeze and release the left button to fill the transfer pipette.';
   else if(t.startsWith('strip'))text=p.phase==='mixstop'?'Gently tap this upright strip four times, then return it to its position.':'Right-click to invert the strip. Move over towels; hold left button and move DOWN to tap. Lift and repeat four times.';
   else text=p.phase==='label'?'Click the fine-tip marker on the bench or in the tool dock. Label each well with a short writing stroke.':'Click an actual tool to pick it up. It follows the pointer. Right-drag rotates the view; scroll zooms.';}
  this.a.hint(text);
 }
 cancel(){this.pressed=false;this.pending=null;this.stroke=null;this.pen=null;this.vertical.reset();this.handDock=null;this.grab=null;this.openSince=null;if(this.s){this.s.plunger.pos[1]=2.79;this.a.dirty()} }
 select(tool){this.cancel();this.inverted=false;this.taps=0;this.a.setTool(tool);this.a.setTarget(null);this.hint();}
 park(){this.select('inspect');this.say('Tool returned to its place.');}
 pick(x,y){this.r.root.update();let tool=this.tool;
  return this.s.nearest(x,y,t=>{
   if(tool==='arrange')return false;
   if(tool==='inspect')return ['tool','strip','timer'].includes(t.kind);
   if(tool==='marker')return t.kind==='label'||t.id==='park';
   if(tool.startsWith('strip'))return t.id==='towels'||t.id==='home'+tool.slice(-1);
   if(t.kind==='tool'||t.kind==='strip'||t.kind==='label'||t.kind==='home')return false;
   return true;
  });
 }
 isSource(t){return !!t&&(t.kind==='reagent'||t.kind==='well'||t.id==='WASH')}
 setAim(t){this.a.setTarget(t);this.hint()}
 pose(t,depth=0,xy=null){if(!this.s||!this.r)return;let kind=this.tool;
  if(['inspect','arrange'].includes(kind))return;
  this.r.root.update();let point=t?this.s.position(t):xy?this.r.onPlane(xy.x,xy.y,.65):null;if(!point)return;
  if(kind.startsWith('strip')){let strip=this.s.strips[+kind.slice(-1)-1],dest=[point[0],t?.id==='towels'?.62-depth*.23:.55,point[2]];strip.pos=root.E3D.M.point(root.E3D.M.inverse(this.s.assay.world),dest);strip.rot=[this.inverted?Math.PI:0,0,0];this.a.dirty();return}
  let tip=[...point],hover=kind==='marker'?.045:.18;
  if(kind==='marker'){tip[1]+=depth>0?0:hover;}
  else if(t&&this.pressed&&this.isSource(t)){
   if(t.kind==='well'){let v=this.s.wells[t.id-1],w=this.p.well(t.id);let low=root.E3D.M.point(v.group.world,[0,.058+.276*w.volume/300-.010,0]);tip=root.E3D.V.lerp(root.E3D.V.add(point,[0,hover,0]),low,depth);}
   else if(t.id==='WASH'){let low=root.E3D.M.point(this.s.beaker.world,[0,.105+.65*this.p.reagents.WASH.volume/55000-.04,0]);tip=root.E3D.V.lerp(root.E3D.V.add(point,[0,hover,0]),low,depth);}
   else if(this.s.tubes[t.id]){let group=this.s.tubes[t.id].group,frac=this.p.reagents[t.id].volume/root.ELISAProtocol.REAGENTS[t.id].volume;let low=root.E3D.M.point(group.world,[0,.13+.12*frac-.02,0]);tip=root.E3D.V.lerp(root.E3D.V.add(point,[0,hover,0]),low,depth);}
  }else tip[1]+=hover-depth*.17;
  if(kind==='micro'&&!this.p.tip)tip[1]-=.64;
  this.s.toolTo(kind,tip,this.pressed?1:0);this.a.dirty();
 }
 commit(a){return this.a.perform(a,{instant:true}).then(ok=>{this.hint();return ok})}
 move(x,y,{writing=false}={}){if(this.a.busy()||this.a.demo())return;let t=this.pick(x,y);this.setAim(t);this.pose(t,this.pressed?1:0,{x,y});if(writing&&this.tool==='marker')this.write(t,x,y)}
 write(t,x,y){if(t?.kind!=='label'){this.pen=null;return}let id=Number(t.id.slice(5));if(this.p.labels.includes(id))return;
  if(this.pen?.id!==id)this.pen={id,x,y,distance:0};
  this.pen.distance+=Math.hypot(x-this.pen.x,y-this.pen.y);this.pen.x=x;this.pen.y=y;
  if(this.pen.distance>=3){this.pen=null;this.commit({type:'label',target:id});}
 }
 beginPlunger(source='mouse'){
  if(this.a.busy()||this.a.demo()||this.p.preview)return;
  let t=this.target,tool=this.tool;
  this.pressed=true;
  if(!['micro','wash'].includes(tool))return;
  if(tool==='micro'&&!this.p.tip){this.say('Fit a tip with a downward motion over the rack; the plunger does not attach tips.',true);this.pending={kind:'spent'};return}
  let loaded=tool==='micro'?this.p.tip?.volume:this.p.washVolume;
  if(loaded&&t?.id!=='WASH'){
   this.pending={kind:'spent'};
   if(typeof t?.id==='number')this.commit({type:tool==='micro'?'dispense':'wash',target:t.id});
   else if(tool==='micro'&&t?.id==='waste')this.commit({type:'discard',target:'waste'});
   else this.say('Position the loaded pipette over the receiving well before pressing.',true);
  }else this.pending={kind:'draw',tool,epoch:this.a.epoch(),bound:this.isSource(t)?t.id:null,immersed:source==='mouse',source};
  this.pose(t,source==='mouse'?1:0);this.hint(source==='hand'?'Keep the thumb pressed. Lower the palm into the opening, then RELEASE the thumb to aspirate.':undefined);
 }
 endPlunger(){const pending=this.pending;this.pending=null;this.pressed=false;this.handDock=null;this.vertical.reset();let t=this.target;
  if(pending?.kind==='draw'&&pending.epoch===this.a.epoch()&&pending.tool===this.tool){
   if(pending.bound===null||pending.bound!==t?.id){this.say('Aspiration cancelled: keep the tip in the same opening until release.',true);}
   else if(!pending.immersed)this.say('No liquid drawn: lower the palm to immerse the tip before releasing the thumb.',true);
   else this.commit({type:this.tool==='wash'?'loadWash':'aspirate',target:t.id});
  }
  this.pose(t,0);this.hint();
 }
 handleMotion(x,y){
  if(this.stroke){let st=this.stroke,dy=y-st.y,depth=clamp(dy/18);this.setAim(st.target);this.pose(st.target,depth);if(dy>=18&&!st.done){st.done=true;if(st.kind==='tip')this.commit({type:'attach',target:'tips'});else this.tap();}if(st.kind==='tap'&&dy<5)st.done=false;return}
  const t=this.pick(x,y);
  if(this.pending?.kind==='draw'){
   if(this.pending.bound===null&&this.isSource(t))this.pending.bound=t.id;
   else if(this.pending.bound!==null&&t?.id!==this.pending.bound){this.pending={kind:'cancelled'};this.say('Stroke cancelled: the tip left its source before release.',true)}
  }
  this.move(x,y,{writing:this.pressed});
 }
 tap(){if(!this.tool.startsWith('strip'))return;let id=+this.tool.slice(-1),p=this.p,now=this.now();if(now-this.lastTap<150)return;
  if(p.phase!=='mixstop'&&(!p.phase.startsWith('wash')||!p.needDrain||!this.inverted)){this.say('Invert the strip and wait until the protocol calls for draining.',true);return}
  if(p.phase==='mixstop'&&this.inverted){this.say('Keep the final strip upright for gentle mixing.',true);return}
  if((p.phase==='mixstop'?p.stopMixedStrips:p.drainedStrips).includes(id))return;
  this.lastTap=now;this.taps++;this.hint('Strip '+id+': '+this.taps+' / 4 taps. Lift and lower again.');
  if(this.taps===4){this.commit({type:p.phase==='mixstop'?'mixStopStrip':'drainStrip',target:id});this.taps=0;this.hint('Strip complete. Move it to its marked position and click to return it.');}
 }
 secondary(){if(this.tool.startsWith('strip')){this.inverted=!this.inverted;this.taps=0;this.pose(this.target);this.hint(this.inverted?'Strip inverted. Move over towels and make four downward taps.':'Strip upright.');}
  else if(this.tool==='micro'&&this.target?.id==='waste'){this.commit({type:'eject',target:'waste'});}
 }
 handEdge(edge){if(edge==='eject'){if(this.tool==='micro'&&this.target?.id==='waste')this.commit({type:'eject',target:'waste'});else this.say('Move over waste before operating the ejector.',true);return}
  if(this.tool==='marker'){this.pressed=edge==='press';return}
  if(edge==='press'){if(this.target?.id==='timer'){this.commit({type:'incubate',target:'timer'});return}if(this.tool==='micro'&&this.target?.id==='waste'&&!this.p.tip?.volume){this.commit({type:'eject',target:'waste'});return}this.beginPlunger('hand')}
  else if(edge==='release')this.endPlunger();
 }
 handFrame(f){if(this.a.busy()||this.a.demo()||!this.r||this.p.preview)return;const {x,y,palmY,grip,open,roll}=f,now=f.now??this.now(),sx=x*this.canvas.clientWidth,sy=y*this.canvas.clientHeight;
  let t=this.pick(sx,sy);this.handLast=f;
  if(open&&this.tool!=='inspect'){this.openSince??=now;if(now-this.openSince>550){this.park();return}}else this.openSince=null;
  if(this.tool==='inspect'){
   this.setAim(t);if(t&&['tool','strip'].includes(t.kind)&&grip){if(this.grab?.id!==t.id)this.grab={id:t.id,since:now};else if(now-this.grab.since>350){let kind=t.kind==='strip'?t.id:t.id==='markertool'?'marker':t.id==='microtool'?'micro':'wash';this.select(kind);this.pickRoll=roll;this.grab=null;}}
   else this.grab=null;
   if(t?.id==='timer'&&grip){if(this.timerSince==null)this.timerSince=now;if(now-this.timerSince>600&&!this.p.timer){this.commit({type:'incubate',target:'timer'});this.timerSince=Infinity}}else this.timerSince=null;
   return;
  }
  // Pin a mechanical contact while the palm moves vertically. Thumb depth is
  // intentionally NOT used to fit a tip or tap a strip.
  if(this.handDock){let d=this.handDock;if(Math.abs(x-d.x)>.07||palmY<d.y-.055||palmY>d.y+.15){this.handDock=null;this.vertical.reset();}else t=d.target;}
  const mechanical=t&&(t.id==='park'||(this.tool==='micro'&&!this.p.tip&&t.id==='tips')||(this.tool.startsWith('strip')&&(t.id==='towels'||t.kind==='home')));
  const drawing=this.pending?.kind==='draw';
  if(drawing&&this.pending.bound===null&&this.isSource(t))this.pending.bound=t.id;
  if(drawing&&this.pending.bound!==null&&t?.id!==this.pending.bound){this.pending={kind:'cancelled'};this.handDock=null;this.vertical.reset();}
  if((mechanical||(drawing&&this.isSource(t)))&&!this.handDock)this.handDock={target:t,x,y:palmY};
  this.setAim(t);
  if(this.handDock){let m=this.vertical.update(String(t.id),x,palmY,now);this.pose(t,m.depth);if(m.down){if(t.id==='park'||t.kind==='home'){this.park();return}if(this.tool==='micro'&&!this.p.tip&&t.id==='tips'){this.commit({type:'attach',target:'tips'});this.handDock=null;this.vertical.reset();}
    else if(drawing){this.pending.immersed=true;this.hint('Tip immersed. Release the thumb to aspirate.');}
    else if(this.tool.startsWith('strip'))this.tap();}}
  else{this.vertical.reset();this.pose(t,0,{x:sx,y:sy});}
  if(this.tool.startsWith('strip')&&Number.isFinite(roll)&&Number.isFinite(this.pickRoll)){let diff=Math.atan2(Math.sin(roll-this.pickRoll),Math.cos(roll-this.pickRoll));if(Math.abs(diff)>1.05&&!this.inverted){this.inverted=true;this.taps=0;this.hint('Strip inverted. Lower and raise over towels four times.')}else if(Math.abs(diff)<.45&&this.inverted){this.inverted=false;this.taps=0}}
  if(this.tool==='marker'&&(grip||this.pressed)){this.pose(t,1);this.write(t,sx,sy)}
 }
 install(){let c=this.canvas;const point=e=>{let b=c.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top}};
  c.addEventListener('contextmenu',e=>e.preventDefault());
  c.addEventListener('pointerdown',e=>{if(!this.r||this.a.handRunning()||this.a.busy())return;c.focus({preventScroll:true});c.setPointerCapture(e.pointerId);let q=point(e),t=this.pick(q.x,q.y);this.pointer={id:e.pointerId,x:q.x,y:q.y,lastX:q.x,lastY:q.y,button:e.button,moved:false};
   if(e.button!==0)return;
   if(this.tool==='arrange'){let w=this.r.onPlane(q.x,q.y,0);if(w){let m=[...this.s.movables].reverse().find(m=>Math.abs(w[0]-m.group.pos[0])<m.bounds[0]&&Math.abs(w[2]-m.group.pos[2])<m.bounds[1]);if(m)this.pointer.movable={m,offset:root.E3D.V.sub(m.group.pos,w)}}return}
   this.setAim(t);
   if(t?.id==='park'||t?.kind==='home'){this.park();this.pointer.picked=true;return}
   if(this.tool==='inspect'&&t&&['tool','strip'].includes(t.kind)){this.select(t.kind==='strip'?t.id:t.id==='microtool'?'micro':t.id==='markertool'?'marker':'wash');this.pointer.picked=true;this.pose(null,0,q);return}
   if(t?.id==='timer'){this.commit({type:'incubate',target:'timer'});this.pointer.picked=true;return}
   if(this.tool==='marker'){this.pressed=true;this.pose(t,1);this.write(t,q.x,q.y);return}
   if(this.tool==='micro'&&t?.id==='tips'){this.stroke={kind:'tip',target:t,y:q.y,done:false};this.pose(t,0);return}
   if(this.tool.startsWith('strip')&&t?.id==='towels'){this.stroke={kind:'tap',target:t,y:q.y,done:false};return}
   if(['micro','wash'].includes(this.tool))this.beginPlunger('mouse');
  });
  c.addEventListener('pointermove',e=>{if(!this.r||this.a.handRunning())return;let q=point(e),d=this.pointer;
   if(d&&d.id===e.pointerId){let dx=q.x-d.lastX,dy=q.y-d.lastY;if(Math.hypot(q.x-d.x,q.y-d.y)>4)d.moved=true;
    if(d.button===2||(this.tool==='inspect'&&d.moved)){this.cancel();this.r.cam.yaw-=dx*.006;this.r.cam.pitch=clamp(this.r.cam.pitch+dy*.005,.22,1.55);this.a.dirty();}
    else if(d.movable){let w=this.r.onPlane(q.x,q.y,0);if(w){let {m,offset}=d.movable,pos=root.E3D.V.add(w,offset);pos[0]=clamp(pos[0],-6+m.bounds[0],6-m.bounds[0]);pos[2]=clamp(pos[2],-2.7+m.bounds[1],3.1-m.bounds[1]);let collision=this.s.movables.some(o=>o!==m&&Math.abs(o.group.pos[0]-pos[0])<(o.bounds[0]+m.bounds[0])*.93&&Math.abs(o.group.pos[2]-pos[2])<(o.bounds[1]+m.bounds[1])*.87);if(!collision){m.group.pos=[pos[0],m.group.pos[1],pos[2]];this.a.dirty();}}}
    else if(!d.picked)this.handleMotion(q.x,q.y);
    d.lastX=q.x;d.lastY=q.y;
   }else this.move(q.x,q.y);
  });
  c.addEventListener('pointerup',e=>{let d=this.pointer;if(!d||d.id!==e.pointerId)return;if(d.button===2&&!d.moved)this.secondary();if(d.button===0&&!d.picked)this.endPlunger();this.pointer=null;this.stroke=null;this.pen=null;this.pressed=false;this.pose(this.target);if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId)});
  c.addEventListener('pointercancel',()=>{this.pointer=null;this.cancel()});
  c.addEventListener('lostpointercapture',()=>{if(this.pointer){this.pointer=null;this.cancel()}});
  c.addEventListener('pointerleave',()=>{if(!this.pointer)this.cancel()});
  c.addEventListener('wheel',e=>{if(!this.r)return;e.preventDefault();this.cancel();this.r.cam.distance=clamp(this.r.cam.distance*Math.exp(e.deltaY*.001),3.7,17);this.a.dirty()},{passive:false});
  window.addEventListener('blur',()=>{this.pointer=null;this.cancel()});
 }
}
root.ELISADirect={Controller,VerticalStroke};if(typeof module!=='undefined'&&module.exports)module.exports=root.ELISADirect;
})(globalThis);
