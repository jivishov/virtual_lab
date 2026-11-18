/* Deterministic hand-intent core. Adapted from the ELISA reference's geometric
 * features, One Euro filter and time-based gates; no camera or DOM dependency.
 * Landmarks express intent, not force, grasp contact or a metered liquid volume.
 */
export const GRASP_DEFAULTS=Object.freeze({openMs:160,gripMs:140,releaseMs:160,maxGapMs:350});
export const HAND_SHAPE=Object.freeze({foldedCurl:.34,extendedCurl:.16,extendedReach:.86,extendedForward:.4,pinchDistance:.27,minPalmCross:.12});
export const SMOOTHING_DEFAULTS=Object.freeze({minCutoff:1.2,beta:6,dCutoff:1.2,maxGapMs:350});

const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const length=a=>Math.hypot(...a);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=length(a);return a.map(v=>v/n)};
const angle=(a,b)=>Math.acos(clamp(dot(unit(a),unit(b)),-1,1));
const distance=(a,b)=>length(sub(a,b));
const FINGERS=[[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
const POSES=new Set(['open','grip','point','neutral']);
const invalidHand=()=>({pose:'neutral',palmX:null,palmY:null,roll:null,gripStrength:0,valid:false});

// B06 already owns the carrying grip. Read just the thumb and index control
// from that hand, independently of the other fingers' joint-angle estimates.
export function bulbPressure(image,world,aspect=1){
 function pressure(joints,scaleX){
  if(!joints||![0,4,5,8,9,17].every(i=>joints[i]&&[joints[i].x,joints[i].y,joints[i].z].every(Number.isFinite)))return null;
  const span=(a,b)=>Math.hypot((joints[a].x-joints[b].x)*scaleX,joints[a].y-joints[b].y,(joints[a].z-joints[b].z)*scaleX);
  const palm=(span(5,17)+span(0,9))/2;
  if(!Number.isFinite(palm)||palm<1e-7)return null;
  const pinch=(.62-span(4,8)/palm)/.45;
  const tucked=(.70-span(4,5)/palm)/.48;
  return clamp(Math.max(pinch,tucked));
 }
 return pressure(world,1)??pressure(image,aspect);
}

function points(landmarks){
  if(!Array.isArray(landmarks)||landmarks.length!==21)return null;
  if(!landmarks.every(p=>p&&[p.x,p.y,p.z].every(Number.isFinite)))return null;
  return landmarks.map(p=>[p.x,p.y,p.z]);
}

function fingerShape(p,indices,palmScale){
  const [base,pip,dip,tip]=indices.map(i=>p[i]);
  const bones=[sub(pip,base),sub(dip,pip),sub(tip,dip)],lengths=bones.map(length);
  // Relative, not metre-specific limits: reject collapsed or disconnected chains.
  if(lengths.some(n=>n/palmScale<.025||n/palmScale>1.1))return null;
  const total=lengths.reduce((a,b)=>a+b,0),endpoint=sub(tip,base);
  const reach=length(endpoint)/total;
  const forward=dot(endpoint,unit(sub(base,p[0])))/total;
  const bend=angle(bones[0],bones[1])+angle(bones[1],bones[2]);
  const jointCurl=clamp(bend/(Math.PI*1.05));
  const shortened=clamp((.9-reach)/.65);
  // MCP flexion also detects a finger folded at the knuckle with straighter IP joints.
  const knuckleCurl=clamp((.45-forward)/.8);
  const curl=clamp(Math.max(.7*jointCurl+.3*shortened,.8*knuckleCurl));
  return {curl,folded:curl>=HAND_SHAPE.foldedCurl&&(bend>=.7||forward<.2),extended:curl<=HAND_SHAPE.extendedCurl&&reach>=HAND_SHAPE.extendedReach&&forward>HAND_SHAPE.extendedForward};
}

/**
 * Classify MediaPipe-style 21-point hands. World points are preferred for 3D
 * curl geometry; normalized points supply the stable palm cursor and image roll.
 * With no world points, normalized x/y/z are a geometric fallback. If a supplied
 * world frame is corrupt, reject it rather than silently changing coordinate models.
 */
export function classifyHand(normalized21,world21){
  const image=points(normalized21),world=world21==null?null:points(world21);
  if(!image||(world21!=null&&!world))return invalidHand();
  const p=world||image,across=sub(p[17],p[5]),axis=sub(p[9],p[0]);
  const width=length(across),height=length(axis),palmScale=(width+height)/2;
  if(width<1e-7||height<1e-7||length(cross(across,axis))/(width*height)<HAND_SHAPE.minPalmCross)return invalidHand();
  const imageAxis=sub(image[9],image[0]);
  if(Math.hypot(imageAxis[0],imageAxis[1])<1e-7)return invalidHand();
  const fingers=FINGERS.map(indices=>fingerShape(p,indices,palmScale));
  if(fingers.some(f=>!f))return invalidHand();
  const folded=fingers.filter(f=>f.folded).length,extended=fingers.filter(f=>f.extended).length;
  const othersFolded=fingers.slice(1).filter(f=>f.folded).length,othersExtended=fingers.slice(1).filter(f=>f.extended).length;
  const gripStrength=fingers.reduce((sum,f)=>sum+f.curl,0)/4;
  const pinchOnly=distance(p[4],p[8])/palmScale<HAND_SHAPE.pinchDistance&&othersExtended>=2;
  let pose='neutral';
  // A pinch alone must neither grab nor masquerade as an open-hand release.
  if(pinchOnly)pose='neutral';
  else if(fingers[0].extended&&othersFolded>=2)pose='point';
  else if(folded>=3||(folded>=2&&extended===0&&gripStrength>=.28))pose='grip';
  else if(extended>=3)pose='open';
  const palmIndices=[0,5,9,13,17];
  return {pose,palmX:palmIndices.reduce((sum,i)=>sum+image[i][0],0)/5,palmY:palmIndices.reduce((sum,i)=>sum+image[i][1],0)/5,roll:Math.atan2(imageAxis[0],-imageAxis[1]),gripStrength,thumbPress:clamp((.70-distance(p[4],p[5])/palmScale)/.48),valid:true};
}

function positiveOption(value,name){
  if(!Number.isFinite(value)||value<=0)throw new RangeError(`${name} must be a positive finite duration in milliseconds.`);
  return value;
}

/**
 * Debounced intent edges. An open hand must arm the gate before a grip can grab.
 * Loss, identity changes, duplicate/out-of-order frames and long gaps invalidate
 * the gesture without emitting a release. The caller must separately preserve
 * or cancel its held object; this gate never invents a completed drop.
 */
export class GraspGate {
  constructor(options={}){
    for(const[name,value]of Object.entries(GRASP_DEFAULTS))this[name]=positiveOption(options[name]??value,name);
    this.reset();
  }
  reset(){this.lastTime=null;this.identity=null;this.clearGesture()}
  clearGesture(){this.armed=false;this.holding=false;this.candidate=null;this.since=null}
  interruptEvidence(){this.candidate=null;this.since=null}
  result(pose='neutral',edge=null,valid=false){return {pose,edge,armed:this.armed,valid}}
  update(frame,now){
    const pose=frame?.pose,identity=typeof frame?.handedness==='string'?frame.handedness.trim().toLowerCase():'unspecified';
    if(!Number.isFinite(now)||frame?.valid!==true||!POSES.has(pose)){
      this.clearGesture();
      if(Number.isFinite(now)&&(this.lastTime===null||now>this.lastTime))this.lastTime=now;
      return this.result();
    }
    // Keep the timestamp watermark when rejecting stale frames. A stream of old
    // packets cannot re-arm the gate by resetting its clock to an earlier time.
    if(this.lastTime!==null&&now<=this.lastTime){this.clearGesture();return this.result()}
    const discontinuity=this.lastTime!==null&&now-this.lastTime>this.maxGapMs||this.identity!==null&&identity!==this.identity;
    this.lastTime=now;this.identity=identity;
    if(discontinuity){this.clearGesture();return this.result()}
    if(pose!==this.candidate){this.candidate=pose;this.since=now}
    const elapsed=now-this.since;
    let edge=null;
    if(this.holding){
      if(pose==='open'&&elapsed>=this.releaseMs){this.holding=false;this.armed=true;edge='release'}
    }else{
      if(pose==='open'&&elapsed>=this.openMs)this.armed=true;
      if(pose==='grip'&&this.armed&&elapsed>=this.gripMs){this.holding=true;this.armed=false;edge='grab'}
    }
    return this.result(pose,edge,true);
  }
}

/** One Euro scalar filter; update(value, timestampMilliseconds), reset(). */
export class OneEuro {
  constructor(minCutoff=SMOOTHING_DEFAULTS.minCutoff,beta=SMOOTHING_DEFAULTS.beta,dCutoff=SMOOTHING_DEFAULTS.dCutoff,maxGapMs=SMOOTHING_DEFAULTS.maxGapMs){
    if(![minCutoff,dCutoff,maxGapMs].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(beta)||beta<0)throw new RangeError('One Euro filter parameters are outside their valid range.');
    Object.assign(this,{minCutoff,beta,dCutoff,maxGapMs});this.reset();
  }
  reset(){this.x=null;this.raw=null;this.dx=0;this.t=null}
  alpha(cutoff,dt){return 1/(1+1/(2*Math.PI*cutoff*dt))}
  update(value,now){
    if(!Number.isFinite(value)||!Number.isFinite(now))return this.x;
    if(this.t!==null&&now<=this.t)return this.x;
    if(this.x===null||now-this.t>this.maxGapMs){this.x=value;this.raw=value;this.dx=0;this.t=now;return value}
    const dt=clamp((now-this.t)/1000,.001,.35),speed=(value-this.raw)/dt;
    this.dx+=this.alpha(this.dCutoff,dt)*(speed-this.dx);
    this.x+=this.alpha(this.minCutoff+this.beta*Math.abs(this.dx),dt)*(value-this.x);
    this.raw=value;this.t=now;return this.x;
  }
}
