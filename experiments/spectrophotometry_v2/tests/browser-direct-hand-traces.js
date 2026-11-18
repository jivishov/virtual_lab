import {isPipette} from '../src/pipettes.js';
/* Browser entry point for the granular hand controller. No camera is requested.
 * Import in an already loaded candidate page, then run in bounded batches:
 *   const {createDirectHandTrace}=await import('/tests/browser-direct-hand-traces.js');
 *   window.directTrace=createDirectHandTrace();
 *   await directTrace.runFirstDose();
 *   await directTrace.advance(4); // Repeat, or use runThroughBlankPour().
 * Anatomical landmarks drive the real classifier. Position-controlled frames
 * avoid filter-dependent drift; packetSmoke() separately checks packet mapping.
 * Only public input/control APIs change the experiment. Debug state is read-only.
 */
import {classifyHand,GRASP_DEFAULTS} from '../src/grasp-core.js';
import {landmarkPacket} from './hand-landmark-fixtures.js';
import {b06Packet} from './b06-landmark-fixtures.js';

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export class DirectHandTrace {
  constructor({lab=globalThis.lab,canvas=document.getElementById('labCanvas'),now=()=>performance.now(),sleep=wait,interval=40}={}){
    if(!lab?.hand?.frame||!lab?.hand?.packet||!canvas)throw Error('Load the candidate laboratory before creating a direct hand trace.');
    Object.assign(this,{lab,canvas,now,sleep,interval});this.pointer=null;this.thumbPress=0;this.roll=0;this.lastStamp=-Infinity;this.checks=[];this.actions=[];
  }
  assert(condition,message){
    if(!condition)throw Error(`${message} | ${JSON.stringify({step:this.lab.step,manipulation:this.lab.manipulation})}`);
  }
  check(name){this.checks.push({name,step:this.lab.step.index,history:this.lab.state.history.length})}
  freshBatch(){
    if(Number.isFinite(this.lastStamp)&&this.now()-this.lastStamp>GRASP_DEFAULTS.maxGapMs){
      const before=this.lab.state;this.lab.hand.lost();
      this.assert(same(this.lab.state,before),'A gap between trace batches must preserve the model');
      this.check('batch gap resets hand evidence before regrasp');
    }
  }
  point(region){const p=this.lab.affordances.regions[region];this.assert(p&&Number.isFinite(p.x)&&Number.isFinite(p.y),`Missing ${region} projection`);return{x:p.x,y:p.y}}
  aim(){const p=this.lab.affordances.aim;this.assert(p&&Number.isFinite(p.x)&&Number.isFinite(p.y),'Missing current destination projection');return{x:p.x,y:p.y}}
  emit(pose,point=this.pointer,{thumbPress=this.thumbPress,roll=this.roll,packet=false}={}){
    this.assert(point&&Number.isFinite(point.x)&&Number.isFinite(point.y),'A finite hand position is required');
    const stamp=Math.max(this.now(),this.lastStamp+.01);this.lastStamp=stamp;this.pointer={...point};this.thumbPress=thumbPress;this.roll=roll;
    const data=(packet?b06Packet:landmarkPacket)(pose,point,{width:this.canvas.clientWidth,height:this.canvas.clientHeight,stamp,thumbPress,roll,mirrored:this.lab.studio?.mirrored??true});
    if(packet)this.lab.hand.packet(data);
    else{const shape=classifyHand(data.landmarks[0],data.worldLandmarks[0]);this.assert(shape.valid&&shape.pose===pose,`Fixture must classify as ${pose}`);this.lab.hand.frame({...shape,x:point.x,y:point.y,now:stamp,handedness:'Right'})}
  }
  async hold(pose,duration=200,options={}){
    const point=options.point||this.pointer;this.emit(pose,point,options);
    for(let elapsed=0;elapsed<duration;elapsed+=this.interval){await this.sleep(Math.min(this.interval,duration-elapsed));this.emit(pose,point,options)}
  }
  async moveTo(point,{duration=240,thumbPress=this.thumbPress,roll=this.roll}={}){
    const from=this.pointer||point,count=Math.max(1,Math.ceil(duration/this.interval));
    for(let i=1;i<=count;i++){await this.sleep(duration/count);this.emit('grip',{x:from.x+(point.x-from.x)*i/count,y:from.y+(point.y-from.y)*i/count},{thumbPress,roll})}
  }
  async grasp(tool){
    const point=this.point(tool+'-grip');await this.hold('open',200,{point,thumbPress:0,roll:0});await this.hold('grip',180,{point,thumbPress:0,roll:0});
    this.assert(this.lab.hand.state.holding===tool&&this.lab.manipulation.owner==='hand',`Whole-hand grasp must hold ${tool}`);
    this.assert(!this.lab.manipulation.flow,'Grasp/regrasp must not start liquid flow');
  }
  async thumb(value){await this.hold('grip',160,{thumbPress:value})}
  async align(){
    const point=this.aim();await this.moveTo(point);await this.hold('grip',360,{point});
    this.assert(this.lab.manipulation.contact,'Carrying and dwelling must align with the opening');
    this.assert(this.lab.manipulation.contact.depth===0,'Alignment must not lower or transfer automatically');
  }
  async lower(){
    const point={x:this.pointer.x,y:this.pointer.y+68};await this.moveTo(point,{duration:200});await this.hold('grip',40);
    this.assert(this.lab.manipulation.contact?.depth===1,'Downward hand motion must reach full depth');
  }
  async withdraw(){
    const contact=this.lab.manipulation.contact;if(!contact)return;
    this.assert(contact.kind!=='pour','Upright the cuvette before carrying it');
    await this.moveTo({x:this.pointer.x,y:this.pointer.y-68*contact.depth},{duration:200});
    this.assert(!this.lab.manipulation.contact||this.lab.manipulation.contact.depth===0,'Upward hand motion must withdraw completely');
    const direction=this.pointer.x+84<this.canvas.clientWidth?1:-1;
    await this.moveTo({x:this.pointer.x+84*direction,y:this.pointer.y},{duration:200});
    this.assert(this.lab.manipulation.contact===null,'Lateral movement after withdrawal must leave the opening');
  }
  async park(){
    if(!this.lab.manipulation.tool)return;
    if(this.lab.manipulation.owner!=='hand')await this.grasp(this.lab.manipulation.tool);
    if(this.lab.manipulation.contact)await this.withdraw();
    await this.moveTo(this.aim());await this.hold('grip',200);await this.hold('open',200,{thumbPress:0});
    this.assert(this.lab.manipulation.tool===null,'Opening the hand over the dock must park the tool');
  }
  async resumeAspiration(){await this.thumb(1);await this.thumb(0);this.assert(this.lab.manipulation.flow,'Press and relax must resume the unfinished aspiration')}
  async finishFlow(expectedHistory,timeout=7000){
    const started=this.now();
    while(this.lab.state.history.length===expectedHistory){
      this.assert(this.lab.manipulation.flow,'An unfinished dose unexpectedly stopped');this.assert(this.now()-started<timeout,'A pipette dose did not finish within its expected time');
      await this.hold('grip',this.interval);
    }
    this.assert(this.lab.state.history.length===expectedHistory+1,'One complete dose must record exactly one instruction');
    this.assert(!this.lab.manipulation.flow&&this.lab.state.transfer===null,'Completing a dose must stop flow and clear partial-transfer metadata');
  }
  async releaseProbe(){
    const before=this.lab.state;this.emit('open',this.pointer,{thumbPress:0});
    this.assert(!this.lab.manipulation.flow,'Non-grip evidence must stop flow immediately');
    await this.hold('open',200,{thumbPress:0});this.assert(same(this.lab.state,before),'Opening the whole hand must not aspirate or deliver');
    this.assert(this.lab.manipulation.owner===null,'Stable open-hand evidence must release ownership');
    this.check('open-hand release preserves material');
  }
  async lossProbe(){
    const before=this.lab.state;this.lab.hand.lost();await this.sleep(240);
    this.assert(same(this.lab.state,before),'Tracking loss must preserve the partial dose');
    this.assert(this.lab.manipulation.frozen&&!this.lab.manipulation.flow&&this.lab.manipulation.owner===null,'Tracking loss must freeze ownership and flow');
    await this.grasp('pipette');this.assert(same(this.lab.state,before),'Regrasp after loss must not transfer');this.check('loss and regrasp preserve partial material');
  }
  async pauseProbe(){
    this.lab.control('paused');const before=this.lab.state;await this.hold('grip',240);
    this.assert(same(this.lab.state,before),'Paused gestures must not alter the model');this.lab.control('running');
    await this.hold('grip',200);this.assert(this.lab.manipulation.owner===null&&!this.lab.manipulation.flow,'Run must require fresh open-hand arming and grasp');
    const running=this.lab.state;await this.grasp('pipette');this.assert(same(this.lab.state,running),'Regrasp after pause must not transfer');this.check('pause/run require an explicit regrasp');
  }
  async pointAt(region){
    this.assert(!this.lab.manipulation.owner,'Release the tool before pointing');const point=this.point(region);
    await this.hold('open',200,{point,thumbPress:0,roll:0});await this.hold('point',920,{point,thumbPress:0,roll:0});
  }
  async transfer(){
    const before=this.lab.state.history.length,step=this.lab.step;
    if(this.lab.manipulation.tool&&this.lab.manipulation.tool!==step.pipetteId)await this.park();
    if(this.lab.manipulation.owner!=='hand')await this.grasp(step.pipetteId);
    if(this.lab.manipulation.contact)await this.withdraw();
    await this.align();await this.thumb(0);if(step.action==='aspirate')await this.thumb(1);await this.lower();
    this.assert(this.lab.state.history.length===before,'Carry/alignment/lowering cannot complete a transfer');
    await this.thumb(step.action==='aspirate'?0:1);this.assert(this.lab.manipulation.flow,'The bulb gesture must begin flow');await this.finishFlow(before);
  }
  async instruction(){
    const step=this.lab.step,before=this.lab.state.history.length;
    if(['aspirate','dispense'].includes(step.action))await this.transfer();
    else if(step.action==='insert'){
      if(isPipette(this.lab.manipulation.tool))await this.park();
      if(!this.lab.state.lidOpen)await this.pointAt('lid');
      await this.grasp('cuvette');await this.align();await this.lower();await this.hold('open',200,{thumbPress:0});
      this.assert(this.lab.state.cuvette.inserted&&this.lab.manipulation.tool===null,'Seat and release must leave the cuvette in the open chamber');
    }else if(step.action==='zero'||step.action==='measure'){
      if(this.lab.state.lidOpen)await this.pointAt('lid');
      await this.pointAt(step.action==='zero'?'zero':'read');
    }else if(step.action==='remove'){
      if(!this.lab.state.lidOpen)await this.pointAt('lid');
      await this.grasp('cuvette');await this.withdraw();this.assert(!this.lab.state.cuvette.inserted,'Withdrawing must remove the cuvette from the instrument model');
    }else if(step.action==='empty'){
      if(isPipette(this.lab.manipulation.tool))await this.park();
      if(this.lab.manipulation.tool!=='cuvette'||this.lab.manipulation.owner!=='hand')await this.grasp('cuvette');await this.align();
      await this.hold('grip',600,{roll:.85,thumbPress:0});this.assert(this.lab.state.cuvette.volume===0,'A sustained wrist turn over waste must pour');
      await this.hold('grip',160,{roll:0,thumbPress:0});this.assert(this.lab.manipulation.contact===null,'Turning upright after the pour must free the cuvette for carrying');await this.park();
    }else throw Error(`This bounded trace does not advance ${step.action||'a completed experiment'}.`);
    this.assert(this.lab.state.history.length===before+1,`${step.action} must record one instruction`);
    this.actions.push({step:step.index,action:step.action,target:step.target});return this.report();
  }
  async runFirstDose({recovery=true}={}){
    this.assert(this.lab.state.step===0&&this.lab.state.history.length===0&&!this.lab.manipulation.tool,'Start this trace from a fresh, running experiment');
    await this.grasp('pipette');await this.thumb(1);await this.align();await this.lower();
    this.assert(this.lab.state.pipette.volume===0&&this.lab.manipulation.compressed,'The empty pipette must be lowered with its bulb compressed');
    if(recovery){
      await this.releaseProbe();this.check('opening while compressed and immersed does not aspirate');await this.grasp('pipette');await this.resumeAspiration();
      this.assert(this.lab.state.pipette.volume>0&&this.lab.state.pipette.volume<10,'Recovery probes require a real partial dose');
      await this.releaseProbe();await this.grasp('pipette');await this.resumeAspiration();await this.lossProbe();await this.resumeAspiration();await this.pauseProbe();await this.resumeAspiration();
    }else await this.thumb(0);
    await this.finishFlow(0);this.actions.push({step:0,action:'aspirate',target:'stockBottle'});await this.instruction();
    this.assert(this.lab.state.step===2&&this.lab.state.pipette.volume===0&&Math.abs(this.lab.state.tubes.tube_10_0.volume-10)<1e-8,'A whole pipette dose must reach the first standard');
    this.check('whole aspiration and delivery complete');return this.report();
  }
  async advance(count=4){this.freshBatch();for(let i=0;i<count&&!this.lab.state.finished;i++)await this.instruction();return this.report()}
  async runThroughBlankPour(){this.freshBatch();let budget=32;while(this.lab.state.waste<3-1e-8&&budget--)await this.instruction();this.assert(budget>0,'The first blank pour must be reachable');this.check('cuvette seat, lid, blank, withdrawal and pour complete');return this.report()}
  async packetSmoke(){
    this.assert(!this.lab.manipulation.tool,'Packet smoke requires no owned tool');const before=this.lab.state,point=this.point('pipette-grip');this.lab.hand.lost();
    await this.hold('open',240,{point,thumbPress:0,roll:0,packet:true});await this.hold('grip',220,{point,thumbPress:0,roll:0,packet:true});
    this.assert(this.lab.hand.state.holding==='pipette','Anatomical packet coordinates must grasp the marked pipette');
    await this.hold('open',280,{point,thumbPress:0,roll:0,packet:true});this.assert(same(this.lab.state,before),'Packet grasp/release must not transfer liquid');
    this.check('raw landmark packet mapping and grasp/release');return this.report();
  }
  report(){const s=this.lab.state;return {checks:[...this.checks],actions:[...this.actions],step:s.step,action:this.lab.step.action,history:s.history.length,pipette:s.pipette.volume,cuvette:s.cuvette.volume,cuvetteInserted:s.cuvette.inserted,waste:s.waste,readings:Object.keys(s.results).length,manipulation:this.lab.manipulation}}
}

export const createDirectHandTrace=options=>new DirectHandTrace(options);
