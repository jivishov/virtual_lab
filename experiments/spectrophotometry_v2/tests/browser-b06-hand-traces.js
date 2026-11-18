// The complete camera packet path, including B06 identity, smoothing and timers.
// Anatomical fixtures remain synthetic; browser-b06-camera.cjs verifies inference.
import {DirectHandTrace} from './browser-direct-hand-traces.js';

export class B06HandTrace extends DirectHandTrace {
 emit(pose,point=this.pointer,options={}){return super.emit(pose,point,{...options,packet:true})}
 async hold(pose,duration=240,options={}){
  // New postures arrive on a later camera exposure, never 0.01 ms after the
  // previous posture. B06's wrist velocity must receive real frame intervals.
  await this.sleep(this.interval);
  return super.hold(pose,pose==='open'?Math.max(280,duration):duration,options);
 }
 async grasp(tool){
  const point=this.point(tool+'-grip');await this.hold('open',280,{point,thumbPress:0,roll:0});await this.hold('grip',240,{point,thumbPress:0,roll:0});
  this.assert(this.lab.hand.state.holding===tool&&this.lab.manipulation.owner==='hand',`B06 palm packets must hold ${tool}`);
  this.assert(!this.lab.manipulation.flow,'A fresh B06 grasp must not start liquid flow');
 }
 async moveTo(point,options={}){await super.moveTo(point,options);await this.hold('grip',180)}
 async lower(){
  await this.moveTo({x:this.pointer.x,y:this.pointer.y+84},{duration:240});
  this.assert(this.lab.manipulation.contact?.depth===1,'A deliberate downward palm stroke must reach full insertion');
 }
 async withdraw(){
  const contact=this.lab.manipulation.contact;if(!contact)return;
  this.assert(contact.kind!=='pour','Upright the cuvette before carrying it');
  await this.moveTo({x:this.pointer.x,y:this.pointer.y-84*Math.max(.3,contact.depth)},{duration:240});
  this.assert(!this.lab.manipulation.contact||this.lab.manipulation.contact.depth===0,'Upward palm motion must withdraw the tool');
  const direction=this.pointer.x+90<this.canvas.clientWidth?1:-1;
  await this.moveTo({x:this.pointer.x+90*direction,y:this.pointer.y},{duration:240});
  this.assert(this.lab.manipulation.contact===null,'After lifting clear, lateral palm motion leaves the opening');
 }
 async pointAt(region){
  this.assert(!this.lab.manipulation.owner,'Place the tool before operating a control');const point=this.point(region);
  await this.hold('open',280,{point,thumbPress:0,roll:0});await this.hold('grip',240,{point,thumbPress:0,roll:0});await this.hold('open',280,{point,thumbPress:0,roll:0});
 }
}
export const createB06HandTrace=options=>new B06HandTrace(options);
