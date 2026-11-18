import {PIPETTES,pipetteIds,isPipette} from './pipettes.js';
/* Interaction geometry for the existing Blender apparatus.
 * Coordinates come from blender/build_equipment.py, not replacement meshes.
 * These helpers never transfer liquid, advance the protocol, or start an animation.
 */
import {CUVETTE} from '../assets/cuvette-dimensions.js';
import {AIM} from './targeting.js';
const EPS=1e-8,OPEN_ANGLE=-1.4;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const length=v=>Math.hypot(...v);
const unit=v=>{const n=length(v);return n>EPS?v.map(x=>x/n):[0,0,0]};
const finite3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);

export const INTERACTION_GEOMETRY=Object.freeze({
 pipetteTip:[0,0,0],pipetteGrip:[0,1.54,0],pipetteBulb:[0,1.885,0],cuvetteGrip:CUVETTE.grip,cuvetteMouth:CUVETTE.mouth,
 chamberRim:[.85,1.295,.1],cuvetteSeat:CUVETTE.seat,lidGrip:[0,.11,.78],zero:[.35,.68,1.203],read:[.76,.68,1.203]
});
const PARTS=[
 {id:'pipette-grip',equipment:'pipette',kind:'grip',center:INTERACTION_GEOMETRY.pipetteGrip,shape:'box',min:[-.055,1.28,-.055],max:[.055,1.68,.055]},
 {id:'pipette-bulb',equipment:'pipette',kind:'bulb',center:INTERACTION_GEOMETRY.pipetteBulb,shape:'ellipsoid',radii:[.16,.22,.13]},
 {id:'cuvette-grip',equipment:'cuvette',kind:'grip',center:INTERACTION_GEOMETRY.cuvetteGrip,shape:'box',min:CUVETTE.gripMin,max:CUVETTE.gripMax},
 {id:'lid',equipment:'instrument_lid',kind:'lid',center:INTERACTION_GEOMETRY.lidGrip,shape:'box',min:[-.435,-.04,-.055],max:[.435,.15,.93]},
 {id:'zero',equipment:'instrument',kind:'button',center:INTERACTION_GEOMETRY.zero,shape:'front',half:[.14,.07]},
 {id:'read',equipment:'instrument',kind:'button',center:INTERACTION_GEOMETRY.read,shape:'front',half:[.14,.07]},
 {id:'clipboard',equipment:'clipboard',kind:'review',center:[0,.055,0],shape:'top',half:[.59,.79]},
 {id:'pipette-stand',equipment:'pipette-stand',kind:'dock',center:[0,.08,0],shape:'top',half:[.40,.325]},
 {id:'cuvette-dock',equipment:'cuvette-dock',kind:'dock',center:[0,CUVETTE.homeY,0],shape:'top',half:[CUVETTE.dockHalfSize,CUVETTE.dockHalfSize]}
];
for(const id of pipetteIds.slice(1)){
 for(const part of PARTS.filter(p=>p.equipment==='pipette'||p.id==='pipette-stand')){
  PARTS.push({...part,id:part.id.replace('pipette',id),equipment:part.kind==='dock'?id+'-stand':id});
 }
}
const BOTTLES={stockBottle:1.6,waterBottle:1.6,unknownBottle:1.4};
// Mouse pickup accepts the shaft and the two frosted sides as well as the grips.
// The smaller grip regions above are still used for hand tracking.
const POINTER_PARTS=[
 ...PARTS.filter(p=>!p.id.endsWith('-stand')&&!p.id.endsWith('-dock')),
 ...pipetteIds.map(id=>({id:id+'-body',equipment:id,center:[0,.65,0],shape:'box',min:[-.032,0,-.032],max:[.032,1.3,.032]})),
 {id:'cuvette-body',equipment:'cuvette',center:[0,CUVETTE.height/2,0],shape:'box',
  min:[-CUVETTE.width/2,0,-CUVETTE.width/2],max:[CUVETTE.width/2,CUVETTE.height,CUVETTE.width/2]}
];

function rayBox(origin,direction,min,max,padding){
 let near=0,far=Infinity;
 for(let k=0;k<3;k++){
  if(Math.abs(direction[k])<EPS){if(origin[k]<min[k]-padding||origin[k]>max[k]+padding)return null}
  else{const a=(min[k]-padding-origin[k])/direction[k],b=(max[k]+padding-origin[k])/direction[k];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(far<near)return null}
 }
 return far>=0?near:null;
}
function rayEllipsoid(origin,direction,center,radii,padding){
 const o=sub(origin,center).map((v,i)=>v/(radii[i]+padding)),d=direction.map((v,i)=>v/(radii[i]+padding));
 const a=dot(d,d),b=2*dot(o,d),c=dot(o,o)-1,discriminant=b*b-4*a*c;
 if(a<EPS||discriminant<0)return null;
 const near=(-b-Math.sqrt(discriminant))/(2*a),far=(-b+Math.sqrt(discriminant))/(2*a);return far<0?null:Math.max(0,near);
}
function rayPlane(origin,direction,part,padding){
 const axis=part.shape==='front'?2:1;
 // Only the accessible side of a button, vessel mouth or horizontal dock is pickable.
 if(direction[axis]>=-EPS)return null;
 const t=(part.center[axis]-origin[axis])/direction[axis];if(t<0)return null;
 const hit=add(origin,direction.map(v=>v*t)),u=hit[0]-part.center[0],v=hit[axis===2?1:2]-part.center[axis===2?1:2];
 if(part.shape==='circle')return u*u+v*v<=(part.radius+padding)**2?t:null;
 return Math.abs(u)<=part.half[0]+padding&&Math.abs(v)<=part.half[1]+padding?t:null;
}

export class SceneInteraction{
 constructor(scene){
  if(!scene?.r||!globalThis.E3D?.M)throw Error('SceneInteraction needs the loaded lab scene and its renderer.');
  this.scene=scene;this.r=scene.r;this.M=globalThis.E3D.M;
 }
 update(){this.r.root.update()}
 node(id){
  if(id.endsWith('-stand'))return this.scene.objects[PIPETTES[id.slice(0,-6)]?.stand]||(id==='pipette-stand'?this.scene.pipetteStand:null);
  if(id==='cuvette-dock')return this.scene.cuvetteDock;
  return this.scene.objects[({spec20:'instrument',chamber:'instrument',notebook:'clipboard',lid:'instrument_lid'})[id]||id];
 }
 requireNode(id){const node=this.node(id);if(!node)throw new RangeError(`Unknown equipment: ${id}`);return node}
 world(id,local=[0,0,0]){if(!finite3(local))throw new TypeError('A finite three-dimensional local point is required.');this.update();return this.M.point(this.requireNode(id).world,local)}
 local(id,world){if(!finite3(world))throw new TypeError('A finite three-dimensional world point is required.');this.update();return this.M.point(this.M.inverse(this.requireNode(id).world),world)}
 axis(id){this.update();const n=this.requireNode(id);return unit(sub(this.M.point(n.world,[0,1,0]),this.M.point(n.world,[0,0,0])))}
 yaw(id){this.update();const n=typeof id==='string'?this.requireNode(id):id,d=sub(this.M.point(n.world,[0,0,1]),this.M.point(n.world,[0,0,0]));return Math.atan2(d[0],d[2])}
 openingSpec(id){
  if(id==='spec20'||id==='instrument'||id==='chamber')return{id:'chamber',equipment:'instrument',center:[.85,1.295,.1],floor:CUVETTE.chamberFloor,shape:'top',half:[.2725,.3125],radius:.2725};
  if(Object.hasOwn(BOTTLES,id))return{id,equipment:id,center:[0,BOTTLES[id],0],floor:.055,shape:'circle',radius:.12};
  if(id==='tube_dilution')return{id,equipment:id,center:[0,1.232,0],floor:.118,shape:'circle',radius:.136};
  if(id.startsWith('tube_')&&this.node(id))return{id,equipment:id,center:[0,1.232,0],floor:.055,shape:'circle',radius:.136};
  if(id==='cuvette')return{id,equipment:id,center:CUVETTE.mouth,floor:CUVETTE.base,shape:'top',half:[CUVETTE.insideHalfWidth,CUVETTE.insideHalfWidth],radius:CUVETTE.insideHalfWidth};
  if(id==='wasteBeaker')return{id,equipment:id,center:[0,1.07,0],floor:.06,shape:'circle',radius:.475};
  return null;
 }
 opening(id,{clearance=.18}={}){
  const spec=this.openingSpec(id);if(!spec||!this.node(spec.equipment))return null;
  this.update();const node=this.node(spec.equipment),center=this.M.point(node.world,spec.center),axis=unit(sub(this.M.point(node.world,add(spec.center,[0,1,0])),center));
  const scaleX=length(sub(this.M.point(node.world,add(spec.center,[1,0,0])),center)),scaleZ=length(sub(this.M.point(node.world,add(spec.center,[0,0,1])),center));
  return{id:spec.id,equipment:spec.equipment,center,above:this.M.point(node.world,add(spec.center,[0,Math.max(0,clearance),0])),axis,
   shape:spec.shape==='circle'?'circle':'rectangle',radius:spec.radius*Math.min(scaleX,scaleZ),radiusLocal:spec.radius,halfSize:spec.half?[...spec.half]:null,
   localCenter:[...spec.center],floorLocal:spec.floor,blocked:spec.id==='chamber'&&!this.isLidOpen()};
 }
 liquidSurface(id){
  const liquid=this.scene.liquids[id];if(!liquid||!liquid.node.visible)return null;
  const height=liquid.node.scale[1];if(!Number.isFinite(height)||height<=.003)return null;
  return{localY:liquid.base+height,world:this.world(id,[0,liquid.base+height,0]),baseLocal:liquid.base};
 }
 region(id){return PARTS.find(part=>part.id===id)||this.openingSpec(id)}
 point(id){
  if(id==='pipette-tip')return this.pipetteTip();if(id==='cuvette-mouth')return this.cuvetteMouth();
  const part=this.region(id==='notebook'?'clipboard':id);return part?this.world(part.equipment,part.center):null;
 }
 project(id){const world=this.point(id);if(!world)return null;const p=this.r.project(world);return{...p,world,visible:p.z>=-1&&p.z<=1}}
 /** Shared surface frame for both the visible ring and its selectable opening. */
 targetFrame(id,{current=false}={}){
  const part=this.region(id);if(!part||!this.node(part.equipment))return null;
  if((id==='spec20'||id==='chamber')&&!this.isLidOpen())return null;
  if((id==='cuvette'||id==='cuvette-grip')&&this.scene.inserted&&!this.isLidOpen())return null;
  const front=part.shape==='front',local=[...part.center];local[front?2:1]+=.018;
  let size;if(part.half)size=part.half.map(v=>v+.035);
  else if(part.radius)size=[part.radius+.035,part.radius+.035];
  else if(part.radii)size=[part.radii[0]+.035,part.radii[2]+.035];
  else if(id==='lid')size=[.24,.17];
  else size=[Math.max(.085,(part.max[0]-part.min[0])/2+.03),Math.max(.085,(part.max[2]-part.min[2])/2+.03)];
  if(!current)this.update();
  return {id,equipment:part.equipment,local,center:this.M.point(this.node(part.equipment).world,part.center),rotation:front?[Math.PI/2,0,0]:[0,0,0],size,surface:front||!!part.floor||part.shape==='top'};
 }
 screenTargets(ids,{hand=false}={}){
  this.update();
  return ids.map(id=>this.screenTarget(id,{hand,current:true}));
 }
 screenTarget(id,{hand=false,current=false,frame=this.targetFrame(id,{current})}={}){
  if(!frame)return null;
  const part=this.region(id),p=this.r.project(frame.center),front=part.shape==='front';
  const world=this.node(frame.equipment).world;
  const edge=this.M.point(world,add(part.center,[frame.size[0],0,0])),side=this.M.point(world,add(part.center,front?[0,frame.size[1],0]:[0,0,frame.size[1]]));
  const a=this.r.project(edge),b=this.r.project(side),radius=Math.max(hand?AIM.handRadius:AIM.mouseRadius,Math.hypot(a.x-p.x,a.y-p.y)*(hand?1.4:1),Math.hypot(b.x-p.x,b.y-p.y)*(hand?1.4:1));
  const rect=this.r.canvas.getBoundingClientRect(),normal=unit(sub(this.M.point(world,add(part.center,front?[0,0,1]:[0,1,0])),frame.center));
  const visible=p.z>=-1&&p.z<=1&&p.x>=0&&p.x<=rect.width&&p.y>=0&&p.y<=rect.height&&(!frame.surface||dot(this.r.ray(p.x,p.y).dir,normal)<-EPS);
  return {id,...p,radius,visible,world:frame.center};
 }
 pipetteTip(tool='pipette'){return this.world(tool,INTERACTION_GEOMETRY.pipetteTip)}
 cuvetteMouth(){return this.world('cuvette',INTERACTION_GEOMETRY.cuvetteMouth)}
 regions(){
  const parts=PARTS.filter(part=>this.node(part.equipment)&&!(part.id==='cuvette-grip'&&this.scene.inserted&&!this.isLidOpen()));
  const openings=Object.keys(this.scene.objects).map(id=>this.openingSpec(id)).filter(part=>part&&part.id!=='chamber');
  if(this.node('instrument')&&this.isLidOpen())openings.push(this.openingSpec('chamber'));
  return [...parts,...openings.map(part=>({...part,kind:'opening'}))];
 }
 localPadding(part,pixels){
  if(!pixels)return 0;const node=this.node(part.equipment),center=this.M.point(node.world,part.center),projected=this.r.project(center);
  const spans=[[1,0,0],[0,1,0],[0,0,1]].map(axis=>{const p=this.r.project(this.M.point(node.world,add(part.center,axis)));return Math.hypot(p.x-projected.x,p.y-projected.y)});
  return Math.min(.15,Math.max(0,pixels)/Math.max(1,...spans));
 }
 /** Pixel coordinates are relative to the canvas. Padding is optional screen pixels. */
 pick(x,y,{only=null,padding=0}={}){if(![x,y,padding].every(Number.isFinite))return null;return this.pickRay(this.r.ray(x,y),{only,paddingPixels:Math.max(0,padding)})}
 pointerControl(x,y){
  const parts=POINTER_PARTS.filter(p=>this.node(p.equipment)&&(p.equipment!=='cuvette'||!this.scene.inserted||this.isLidOpen()));
  const ray=this.r.ray(x,y);
  // A direct hit on a small key takes priority over the padded area around it.
  const hit=this.pickRay(ray,{parts})||this.pickRay(ray,{parts,paddingPixels:8});
  if(!hit)return null;
  if(isPipette(hit.equipment)||hit.equipment==='cuvette')return hit.equipment+'-grip';
  return hit.id;
 }
 grabPoint(tool,x,y){
  const parts=POINTER_PARTS.filter(part=>part.equipment===tool);
  const ray=this.r.ray(x,y);
  const hit=this.pickRay(ray,{parts})||this.pickRay(ray,{parts,paddingPixels:8});
  return hit?.world||this.point(tool+'-grip');
 }
 /** Ray helper is also useful for deterministic checks; direction need not be normalized. */
 pickRay(ray,{only=null,paddingPixels=0,parts=this.regions()}={}){
  if(!finite3(ray?.origin)||!finite3(ray?.dir)||length(ray.dir)<EPS)return null;
  this.update();const allowed=only==null?null:new Set(typeof only==='string'?[only]:only),direction=unit(ray.dir);let best=null;
  for(const part of parts){
   if(allowed&&!allowed.has(part.id))continue;
   const node=this.node(part.equipment),inverse=this.M.inverse(node.world),origin=this.M.point(inverse,ray.origin),d=sub(this.M.point(inverse,add(ray.origin,direction)),origin),padding=this.localPadding(part,paddingPixels);
   let t;if(part.shape==='box')t=rayBox(origin,d,part.min,part.max,padding);else if(part.shape==='ellipsoid')t=rayEllipsoid(origin,d,part.center,part.radii,padding);else t=rayPlane(origin,d,part,padding);
   if(t===null||best&&t>=best.distance)continue;
   const local=add(origin,d.map(v=>v*t));best={id:part.id,equipment:part.equipment,kind:part.kind||'opening',world:this.M.point(node.world,local),local,distance:t};
  }
  return best;
 }
 /** Return a pose assignable to node.set(...position); node.rot = rotation. */
 poseAtAnchor(id,localAnchor,worldAnchor,rotation=this.requireNode(id).rot){
  if(!finite3(localAnchor)||!finite3(worldAnchor)||!finite3(rotation))throw new TypeError('Anchor points and rotation must be finite triples.');
  this.update();const node=this.requireNode(id),parent=node.parent?.world||this.M.id(),parentAnchor=this.M.point(this.M.inverse(parent),worldAnchor),offset=this.M.point(this.M.trs([0,0,0],rotation,node.scale||[1,1,1]),localAnchor);
  const position=sub(parentAnchor,offset);return{position,rotation:[...rotation],worldPosition:this.M.point(parent,position)};
 }
 relativeRotation(id,worldMatrix){
  const parent=this.requireNode(id).parent?.world||this.M.id(),m=this.M.mul(this.M.inverse(parent),worldMatrix);
  const sx=Math.hypot(m[0],m[1],m[2]),sy=Math.hypot(m[4],m[5],m[6]),sz=Math.hypot(m[8],m[9],m[10]),y=Math.asin(clamp(m[8]/sz,-1,1));
  if(Math.abs(Math.cos(y))<1e-5)return[Math.atan2(m[6]/sy,m[5]/sy),y,0];
  return[Math.atan2(-m[9]/sz,m[10]/sz),y,Math.atan2(-m[4]/sy,m[0]/sx)];
 }
 // Resolve a tip that already appears inside a tube onto the tube's vertical
 // axis. Use the actual bore, so the glass and the gaps in the rack stay distinct.
 tubeDepthAt(id,point){
  if(!id?.startsWith('tube_')||!point)return null;
  const spec=this.openingSpec(id),node=this.node(id);if(!spec||!node)return null;
  this.update();
  const ray=this.r.ray(point.x,point.y),inverse=this.M.inverse(node.world);
  const o=this.M.point(inverse,ray.origin),d=sub(this.M.point(inverse,add(ray.origin,ray.dir)),o);
  const horizontal=d[0]*d[0]+d[2]*d[2];if(horizontal<EPS)return null;
  const t=((spec.center[0]-o[0])*d[0]+(spec.center[2]-o[2])*d[2])/horizontal;
  if(t<0||Math.hypot(o[0]+t*d[0]-spec.center[0],o[2]+t*d[2]-spec.center[2])>spec.radius)return null;
  const y=o[1]+t*d[1];
  return y<=spec.center[1]&&y>=spec.floor+.04?spec.center[1]-y:null;
 }
 pipetteContact(id,{mode='aspirate',clearance=.18,drawFraction=1,tool='pipette',entryDepth=null}={}){
  const opening=this.opening(id,{clearance}),spec=this.openingSpec(id);
  if(!opening||spec.id==='chamber'||!['aspirate','dispense'].includes(mode))return{ok:false,reason:'Choose a liquid vessel.'};
  if(dot(opening.axis,[0,1,0])<.98)return{ok:false,reason:'Keep the receiving vessel upright.'};
  const rim=spec.center[1];
  let y=rim-(id==='cuvette'?.06:.08),surface=null;
  if(mode==='aspirate'){
   surface=this.liquidSurface(id);if(!surface)return{ok:false,reason:'There is no liquid to draw from this vessel.'};
   // Stay immersed through the dose, with the bulb clear of the bottle neck.
   const finalSurface=surface.baseLocal+(surface.localY-surface.baseLocal)*(1-clamp(drawFraction,0,1));
   y=Math.max(Math.max(spec.floor,surface.baseLocal)+.02,finalSurface-.025);
   if(y>=surface.localY-.005)return{ok:false,reason:'There is not enough liquid to immerse the tip.'};
  }else if(id.startsWith('tube_')){
   // Seat visibly inside the bore, above any solution already in the receiver.
   y=clamp(Math.max(rim-(rim-spec.floor)*.38,(this.liquidSurface(id)?.localY??spec.floor)+.035),spec.floor+.02,rim-.04);
  }
  // A continuous descent starts at the lip, or at the visible tip if the
  // learner regrips inside a receiving tube. Keep the normal withdrawal pose.
  let above=opening.above;
  if(entryDepth!==null){
   const startY=clamp(rim-entryDepth,spec.floor+.04,rim);
   above=this.world(spec.equipment,[spec.center[0],startY,spec.center[2]]);
   if(mode==='dispense')y=Math.max(spec.floor+.02,Math.min(y,startY-.035));
  }
  const tip=this.world(spec.equipment,[spec.center[0],y,spec.center[2]]),rotation=this.relativeRotation(tool,this.node(spec.equipment).world);
  return{ok:true,target:spec.id,mode,tip,above,clear:opening.above,depth:rim-y,immersion:surface?surface.localY-y:0,pose:this.poseAtAnchor(tool,INTERACTION_GEOMETRY.pipetteTip,tip,rotation)};
 }
 containsTip(id,{mode='aspirate',tool='pipette'}={}){
  const spec=this.openingSpec(id),opening=this.opening(id);if(!spec||spec.id==='chamber'||!opening||!['aspirate','dispense'].includes(mode))return{ok:false,reason:'Choose a liquid vessel.'};
  const point=this.pipetteTip(tool),local=this.local(spec.equipment,point),dx=local[0]-spec.center[0],dz=local[2]-spec.center[2],margin=.032;
  const aligned=spec.shape==='circle'?Math.hypot(dx,dz)<=spec.radius-margin:Math.abs(dx)<=spec.half[0]-margin&&Math.abs(dz)<=spec.half[1]-margin;
  const depth=spec.center[1]-local[1],surface=this.liquidSurface(id),immersed=!!surface&&local[1]<surface.localY-.005&&local[1]>Math.max(spec.floor,surface.baseLocal)+.003;
  const upright=dot(this.axis(tool),opening.axis)>.98&&dot(opening.axis,[0,1,0])>.98;
  const inside=aligned&&depth>=.015&&local[1]>=spec.floor+.005;
  const ok=upright&&inside&&(mode==='dispense'||immersed);
  return{ok,point,local,depth,immersed,aligned,reason:ok?'Tip is in position.':!upright?'Keep the pipette and vessel upright.':!aligned?'Center the tip over the opening.':!inside?'Lower the tip inside the opening.':'Lower the tip into the liquid.'};
 }
 cuvetteSeatPose(){
  const opening=this.opening('chamber'),position=this.world('instrument',INTERACTION_GEOMETRY.cuvetteSeat),rotation=this.relativeRotation('cuvette',this.node('instrument').world);
  return{...this.poseAtAnchor('cuvette',[0,0,0],position,rotation),above:opening.above,mouth:this.world('instrument',add(CUVETTE.seat,[0,CUVETTE.height,0])),clear:this.isLidOpen()};
 }
 cuvettePourPose(angle=-Math.PI*.7,yaw=this.yaw('cuvette')){
  if(![angle,yaw].every(Number.isFinite))throw new TypeError('Pour angles must be finite.');
  const opening=this.opening('wasteBeaker');
  // Keep the entire upright cuvette above the rim as tipping begins. Once tipped,
  // the mouth remains 0.18 scene units above the waste opening, never off its side.
  const lift=.18+Math.max(0,Math.cos(angle))*CUVETTE.height,mouth=add(opening.center,opening.axis.map(v=>v*lift));
  const worldRotation=this.M.trs([0,0,0],[0,yaw,angle],[1,1,1]),rotation=this.relativeRotation('cuvette',worldRotation);
  return{...this.poseAtAnchor('cuvette',INTERACTION_GEOMETRY.cuvetteMouth,mouth,rotation),mouth,opening:opening.center,angle};
 }
 isLidOpen(){return !!this.scene.lid&&this.scene.lid.rot[0]<=-1.25}
 setLid(open){
  if(typeof open!=='boolean')throw new TypeError('Lid state must be true or false.');
  const lid=this.scene.lid||this.node('instrument_lid');if(!lid)return false;
  lid.rot[0]=open?OPEN_ANGLE:0;this.r.dirtyShadow=true;this.update();return this.isLidOpen();
 }
}
