// Pixel distances are measured in the cropped camera image. Scaling pinch
// thresholds by palm width lets a seated or distant student use the same grip.
// Hold the last position through a brief occlusion. Only a seen, open grip can release.
const lossGraceMs = 180;
const clamp = v => Math.max(0, Math.min(1, v));
const distance = (a,b,aspect) => Math.hypot((a.x-b.x)*aspect, a.y-b.y);

export const handDefaults = Object.freeze({close:65, open:70, grabMs:180, releaseMs:220, zoomSensitivity:100, pinch:false});
export const handRanges = Object.freeze({close:[50,90], open:[55,95], grabMs:[60,500], releaseMs:[60,500], zoomSensitivity:[25,200]});

export function handSettings(values) {
  const settings = {...handDefaults};
  for (const [key,[min,max]] of Object.entries(handRanges)) {
    const value=values?.[key];
    if(Number.isFinite(value)) settings[key]=Math.max(min,Math.min(max,Math.round(value)));
  }
  settings.pinch=values?.pinch===true;
  return settings;
}

export function playerFrame(center, width, aspect, benchAspect=1.3) {
  width *= Math.min(1, .96 * benchAspect/aspect);
  const height = width * aspect / benchAspect;
  const left = Math.max(0, Math.min(1-width, center.x-width/2));
  const top = Math.max(0, Math.min(1-height, center.y-height/2));
  return {left, top, width, height};
}

// A moving dead zone holds the view still through small tracking fluctuations.
// Keep an anchor rather than dropping small frame deltas: a deliberate slow
// movement must accumulate and move the camera, regardless of frame rate.
export function steadyHandMotion(anchor, point, radius=4) {
  if(!anchor)return {...point,dx:0,dy:0};
  const dx=point.x-anchor.x,dy=point.y-anchor.y,distance=Math.hypot(dx,dy);
  if(distance<=radius)return {x:anchor.x,y:anchor.y,dx:0,dy:0};
  const fraction=(distance-radius)/distance,moveX=dx*fraction,moveY=dy*fraction;
  return {x:anchor.x+moveX,y:anchor.y+moveY,dx:moveX,dy:moveY};
}

const palmJoints = [0,5,9,13,17];
const fingerBases = [5,9,13,17];

function palmCenter(points) {
  const center = {x:0,y:0,z:0};
  for (const joint of palmJoints) {
    center.x += points[joint].x / palmJoints.length;
    center.y += points[joint].y / palmJoints.length;
    center.z += (points[joint].z ?? 0) / palmJoints.length;
  }
  return center;
}

const length3 = (a,b) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
const validLandmarks = points => points?.length === 21 && points.every(p =>
  p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z ?? 0));

function handSample(points, world, label, aspect) {
  if (!validLandmarks(points)) return null;
  const visibleSize = Math.max(distance(points[5],points[17],aspect), distance(points[0],points[9],aspect));
  if (visibleSize < .025) return null;
  // World landmarks keep a bent finger distinct from a straight finger pointing at the lens.
  const joints = validLandmarks(world) && world.every(p=>Number.isFinite(p.z)) ? world :
    points.map(p=>({x:p.x*aspect,y:p.y,z:(p.z ?? 0)*aspect}));
  const scale = Math.max(length3(joints[5],joints[17]), .7*length3(joints[0],joints[9]));
  if (scale < 1e-6) return null;
  const center = palmCenter(joints);
  // Compare each finger's chord with its full length and its approach to the palm.
  const curls = fingerBases.map(base => {
    const [knuckle,middle,distal,tip] = joints.slice(base,base+4);
    const length = length3(knuckle,middle)+length3(middle,distal)+length3(distal,tip);
    if(length < scale*.24) return 0;
    const bend = clamp((.98-length3(knuckle,tip)/length)/.45);
    const proximity = clamp((1.43-length3(tip,center)/scale)/.65);
    return Math.min(bend,proximity);
  });
  const sorted = [...curls].sort((a,b)=>b-a);
  // Three fingers must agree. An isolated fingertip cannot establish or break a grip.
  return {points,wrist:points[0],span:visibleSize,label,curled:curls.map(v=>v>=.5),
    closure:sorted[2], openness:1-sorted[1], pinch:length3(joints[4],joints[8])/scale};
}

function gripTransition(h,s,settings) {
  const open=s.openness*100>=settings.open;
  const precisionOpen=settings.pinch && !s.curled[0] && s.pinch>.55;
  if (!h.armed) return (open && (!settings.pinch || s.pinch>.55)) || precisionOpen ? 'arm' : null;
  if (h.grip==='palm') return open ? 'release' : null;
  if (h.grip==='pinch') return s.pinch>.55 ? 'release' : null;
  if (settings.pinch && !s.curled[0] && s.pinch<.31) return 'pinch';
  if (s.closure*100>=settings.close) return 'palm';
  return null;
}

export class HandGestures {
  constructor(settings) { this.settings=handSettings(settings); this.hands=[]; this.nextId=0; }
  reset() { this.hands = []; }
  update(result, time, aspect, mirrored) {
    const samples = result.landmarks.map((p,i) =>
      handSample(p, result.worldLandmarks?.[i], result.handedness?.[i]?.[0]?.categoryName, aspect)).filter(Boolean);
    // During an ambiguous overlap keep the old owner's grip suspended. Only an
    // attributable observation can start a grasp or release a carried object.
    if(samples.length===2){
      const [a,b]=samples;
      const separation=distance(a.wrist,b.wrist,aspect)/Math.min(a.span,b.span);
      const uncertain=!a.label||!b.label||a.label===b.label;
      const carrying=this.hands.some(h=>h.grip);
      if((uncertain&&separation<.65)||(carrying&&separation<.3))samples.length=0;
    }else if(samples.length===1 && this.hands.length>1){
      const [s]=samples;
      const nearby=this.hands.filter(h=>time-h.seen<=lossGraceMs &&
        (!s.label||!h.label||s.label===h.label) && distance(h.wrist,s.wrist,aspect)<s.span*.65);
      if(nearby.length>1)samples.length=0;
    }
    // Find the cheapest assignment for the two hands. Output order can change
    // every frame. Wrist continuity matters more than the left/right label.
    let bestCost = Infinity, best = [];
    const assign = (i, used, ids, cost) => {
      if (i === samples.length) {
        if (cost < bestCost) { bestCost = cost; best = ids; }
        return;
      }
      assign(i+1,used,[...ids,null],cost+.31);
      for (const h of this.hands) {
        // A slow video frame can still contain both hands. Give a confirmed
        // absence its own shorter deadline rather than canceling a continuous hold.
        const gap = time-h.seen;
        if (used.includes(h.id) || gap > (h.missing ? lossGraceMs : 600)) continue;
        const dt = Math.min(gap, 120);
        const predicted = {x:h.wrist.x+h.vx*dt, y:h.wrist.y+h.vy*dt};
        const differentLabels = h.label && samples[i].label && h.label !== samples[i].label;
        if (differentLabels && (h.grip || h.candidate==='palm' || h.candidate==='pinch')) continue;
        const delta = distance(predicted,samples[i].wrist,aspect) + (differentLabels ? .14 : 0);
        if (delta < .3) assign(i+1,[...used,h.id],[...ids,h],cost+delta);
      }
    };
    assign(0,[],[],0);
    const next = [], events = [];
    for (const [i,s] of samples.entries()) {
      const h = best[i] || {id:++this.nextId,seen:time,grip:null,armed:false};
      const alpha = 1-Math.exp(-Math.min(200,time-h.seen)/46);
      const points = s.points.map((p,j) => {
        const x = mirrored ? 1-p.x : p.x, y = p.y;
        const prev = h.points?.[j];
        return prev ? {x:prev.x+alpha*(x-prev.x), y:prev.y+alpha*(y-prev.y)} : {x,y};
      });
      h.points = points;
      const elapsed = time-h.seen;
      h.missing = false;
      h.vx = h.wrist && elapsed > 0 ? (s.wrist.x-h.wrist.x)/elapsed : 0;
      h.vy = h.wrist && elapsed > 0 ? (s.wrist.y-h.wrist.y)/elapsed : 0;
      h.wrist = s.wrist; h.label = s.label; h.seen = time;
      let phase = 'move', grip = h.grip;
      const candidate = gripTransition(h,s,this.settings);
      const intent = candidate==='palm' || candidate==='pinch' ? candidate : null;
      if (candidate !== h.candidate) { h.candidate=candidate; h.since=time; }
      if (candidate && time-h.since >= (candidate==='release' ? this.settings.releaseMs : candidate==='arm' ? 70 : this.settings.grabMs)) {
        if (candidate==='arm') h.armed=true;
        else if (candidate==='release') {
          phase='release'; h.grip=null;
          h.armed=gripTransition({armed:false},s,this.settings)==='arm';
        } else {
          phase='press'; grip=h.grip=candidate;
        }
        h.candidate=null;
      }
      const palm = palmCenter(points);
      const aim = (grip||intent)==='pinch' ? points[8] : palm;
      const pointing = !s.curled[0] && s.curled[1] && s.curled[2] && s.curled[3];
      next.push(h);
      events.push({id:h.id,x:clamp(aim.x),y:clamp(aim.y),phase,armed:h.armed,
        points,palm,pointing,indexTip:{x:mirrored?1-s.points[8].x:s.points[8].x,y:s.points[8].y},
        curled:s.curled,pinch:s.pinch,grip,intent,intentSince:h.since,label:s.label,closure:s.closure,openness:s.openness});
    }
    const lost = [];
    for (const h of this.hands) {
      if (next.includes(h)) continue;
      if (time-h.seen > lossGraceMs) {
        lost.push({id:h.id,phase:'lost'});
      } else {
        h.missing = true;
        h.candidate = null;
        h.vx = h.vy = 0;
        next.push(h);
        events.push({id:h.id,phase:'missing'});
      }
    }
    this.hands = next;
    return [...lost,...events];
  }
}
