import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/renderer.js';
import {SceneInteraction,INTERACTION_GEOMETRY} from '../src/scene-interaction.js';
import {CUVETTE} from '../assets/cuvette-dimensions.js';

// Exercise the runtime's actual transforms, projection and rays without WebGL.
const {Node,Renderer,M,V}=globalThis.E3D;
const TUBES=['tube_10_0','tube_8_2','tube_6_4','tube_4_6','tube_2_8','tube_0_10'];
const near=(a,b,label='Coordinates agree')=>{
 assert.equal(a.length,b.length);
 a.forEach((value,i)=>assert.ok(Math.abs(value-b[i])<2e-5,`${label}, component ${i}: ${value} vs ${b[i]}`));
};
const apply=(node,pose)=>{node.set(...pose.position);node.rot=[...pose.rotation]};

function fixture(){
 const root=new Node(),r=Object.create(Renderer.prototype);
 Object.assign(r,{root,dirtyShadow:false,canvas:{width:1200,height:800,getBoundingClientRect:()=>({width:1200,height:800})},cam:{at:[0,.25,.25],yaw:.03,pitch:.62,distance:14.5,fov:42}});
 r.updateCamera();
 const scene={r,objects:{},liquids:{},inserted:false};
 const places={instrument:[2.45,.02,-.25],stockBottle:[-4.2,.02,-.7],waterBottle:[-3.05,.02,-.7],unknownBottle:[-1.9,.02,-.7],cuvette:[.92,CUVETTE.homeY,2.05],pipette:[-4.6,.25,1.55],wasteBeaker:[4.6,.02,1.5],clipboard:[-.2,.02,-2.5]};
 TUBES.forEach((id,i)=>{places[id]=[-2.5+i*.5,.183,1.25]});
 for(const[id,position]of Object.entries(places))scene.objects[id]=root.add(new Node()).set(...position);
 scene.lid=scene.objects.instrument.add(new Node()).set(.85,1.25,-.38);
 scene.lid.rot[0]=-1.4;scene.objects.instrument_lid=scene.lid;
 scene.pipetteStand=root.add(new Node()).set(-4.6,0,1.55);
 scene.cuvetteDock=root.add(new Node()).set(.92,0,2.05);
 for(const id of ['stockBottle','waterBottle','unknownBottle',...TUBES,'cuvette','wasteBeaker']){
  const base=id==='cuvette'?CUVETTE.base:TUBES.includes(id)?.08:id==='wasteBeaker'?.07:.06;
  const height=TUBES.includes(id)?.82:id==='cuvette'?CUVETTE.liquidHeight:id==='wasteBeaker'?.88:id==='unknownBottle'?.78:.99;
  const node=scene.objects[id].add(new Node());node.scale[1]=height;node.visible=true;
  scene.liquids[id]={node,base,height,square:id==='cuvette'};
 }
 root.update();
 return{scene,g:new SceneInteraction(scene)};
}

function downRay(center,height=2){return{origin:V.add(center,[0,height,0]),dir:[0,-1,0]}}

test('target rings and screen picking use the actual mouth after equipment moves and turns',()=>{
 const {scene,g}=fixture();scene.objects.instrument.set(2,.4,-1);scene.objects.instrument.rot[1]=Math.PI/2;
 const frame=g.targetFrame('spec20'),opening=g.opening('spec20'),screen=g.screenTarget('spec20');
 near(frame.center,opening.center);near(frame.center,[2.1,1.695,-1.85]);
 const projected=scene.r.project(opening.center);near([screen.x,screen.y],[projected.x,projected.y]);
 assert.equal(screen.visible,true);assert.ok(screen.radius>=16);
 scene.objects.cuvette.set(-.8,.2,2);scene.objects.cuvette.rot[1]=.8;
 near(g.targetFrame('cuvette').center,g.cuvetteMouth());
 assert.equal(g.screenTarget('cuvette').world[1],g.cuvetteMouth()[1]);
});

test('closed chamber and inaccessible optical faces cannot receive a visible target',()=>{
 const {scene,g}=fixture();g.setLid(false);scene.inserted=true;
 assert.equal(g.targetFrame('spec20'),null);assert.equal(g.screenTarget('cuvette'),null);
 assert.equal(g.screenTarget('cuvette-grip'),null);
 g.setLid(true);assert.ok(g.screenTarget('spec20').visible);
 scene.r.cam.yaw=Math.PI;scene.r.updateCamera();
 assert.equal(g.screenTarget('zero').visible,false,'Instrument key is not actionable through its back');
});

test('adjacent sample mouths have individually selectable projected centers at all supported widths',()=>{
 const {scene,g}=fixture();
 for(const width of [768,1024,1366,1536,1920,2560]){
  scene.r.canvas.width=width;scene.r.canvas.getBoundingClientRect=()=>({width,height:900});scene.r.updateCamera();
  for(const id of TUBES){const t=g.screenTarget(id);assert.equal(t.visible,true);assert.equal(g.pick(t.x,t.y,{only:TUBES})?.id,id)}
 }
});

test('openings follow moved and rotated equipment rather than its saved bench position',()=>{
 const{scene,g}=fixture();
 scene.objects.instrument.set(3,.4,1);scene.objects.instrument.rot[1]=Math.PI/2;
 const opening=g.opening('spec20');
 near(opening.center,[3.1,1.695,.15],'Chamber rim in an independent 90-degree frame');
 near(opening.above,[3.1,1.875,.15]);near(opening.axis,[0,1,0]);
 assert.equal(opening.id,'chamber');assert.equal(opening.blocked,false);
 scene.objects.stockBottle.set(1.25,.3,-2);scene.objects.stockBottle.rot[1]=.9;
 near(g.opening('stockBottle').center,[1.25,1.9,-2]);
 near(g.local('stockBottle',g.opening('stockBottle').center),[0,1.6,0]);
 assert.equal(g.opening('not-an-opening'),null);
});

test('visible grip and bulb points can be picked through actual camera projection',()=>{
 const{scene,g}=fixture();
 for(const id of ['pipette-grip','pipette-bulb','cuvette-grip','lid','zero','read','clipboard']){
  const point=g.project(id);assert.equal(point.visible,true,id);
  assert.equal(g.pick(point.x,point.y,{only:id})?.id,id,`${id} projects back to its physical region`);
 }
 scene.objects.pipette.set(-1.8,.6,2.4);scene.objects.pipette.rot=[0,.7,-.25];
 const point=g.project('pipette-grip');
 assert.equal(g.pick(point.x,point.y,{only:'pipette-grip'})?.id,'pipette-grip','Picking follows the carried tool');
 near(g.point('pipette-tip'),g.pipetteTip());near(g.point('cuvette-mouth'),g.cuvetteMouth());
 assert.equal(g.point('missing'),null);
});

test('vessel mouth picks respect actual aperture radius and accessible side',()=>{
 const{g}=fixture(),center=g.opening('stockBottle').center;
 assert.equal(g.pickRay(downRay(V.add(center,[.08,0,0])),{only:'stockBottle'})?.id,'stockBottle');
 assert.equal(g.pickRay(downRay(V.add(center,[.2,0,0])),{only:'stockBottle'}),null,'Bottle shoulder is not its opening');
 assert.equal(g.pickRay({origin:V.add(center,[0,-1,0]),dir:[0,1,0]},{only:'stockBottle'}),null,'Cannot enter the opening from below');
 assert.equal(g.pickRay({origin:center,dir:[0,0,0]}),null);
 assert.equal(g.pick(NaN,20),null);
});

test('nearest physical hit wins and explicit region filters exclude unrelated actions',()=>{
 const{scene,g}=fixture();scene.objects.pipette.set(0,0,0);scene.objects.cuvette.set(0,0,-2);
 const ray={origin:[0,.511,3],dir:[0,0,-8]};
 assert.equal(g.pickRay(ray,{only:['pipette-grip','cuvette-grip']})?.id,'cuvette-grip','Pipette shaft outside its grasp zone is not a handle hit');
 scene.objects.pipette.set(0,-.809,0);
 const hit=g.pickRay(ray,{only:['pipette-grip','cuvette-grip']});
 assert.equal(hit.id,'pipette-grip');assert.ok(hit.distance<3,'Distance is in world units even for an unnormalized input ray');
 assert.equal(g.pickRay(ray,{only:'cuvette-grip'})?.id,'cuvette-grip');
});

test('the smaller cuvette has a reachable rim grip and no stale large-body hit region',()=>{
 const{scene,g}=fixture();scene.objects.cuvette.set(1.25,.4,-2.6);
 near(g.cuvetteMouth(),[1.25,1.002,-2.6]);near(g.point('cuvette-grip'),[1.25,.911,-2.6]);
 const front=(x,y)=>({origin:[x,y,.4],dir:[0,0,-1]});
 assert.equal(g.pickRay(front(1.25,.911),{only:'cuvette-grip'})?.id,'cuvette-grip');
 assert.equal(g.pickRay(front(1.37,.911),{only:'cuvette-grip'}),null,'The old wider grip must not remain selectable');
 assert.equal(g.pickRay(front(1.25,1.13),{only:'cuvette-grip'}),null,'The old taller grip must not remain selectable');
 const dock=g.point('cuvette-dock');
 assert.equal(g.pickRay(downRay(V.add(dock,[.22,0,0])),{only:'cuvette-dock'})?.id,'cuvette-dock');
 assert.equal(g.pickRay(downRay(V.add(dock,[.26,0,0])),{only:'cuvette-dock'}),null,'The dock hit area follows the smaller physical pad');
});

test('closed lid hides chamber and inserted cuvette grip but the lid remains operable',()=>{
 const{scene,g}=fixture();scene.inserted=true;
 apply(scene.objects.cuvette,g.cuvetteSeatPose());
 assert.equal(g.setLid(false),false);assert.equal(g.isLidOpen(),false);assert.equal(g.opening('chamber').blocked,true);
 assert.ok(!g.regions().some(part=>part.id==='chamber'||part.id==='cuvette-grip'));
 assert.equal(g.pickRay(downRay(g.opening('chamber').center),{only:'chamber'}),null);
 assert.ok(g.regions().some(part=>part.id==='lid'));
 assert.equal(g.setLid(true),true);assert.equal(g.opening('chamber').blocked,false);
 assert.ok(g.regions().some(part=>part.id==='cuvette-grip'));
 assert.equal(g.pickRay(downRay(g.opening('chamber').center),{only:'chamber'})?.id,'chamber');
 assert.equal(scene.r.dirtyShadow,true);assert.throws(()=>g.setLid('open'),TypeError);
});

test('aspiration contact stays above the floor and below a falling standard surface',()=>{
 const{scene,g}=fixture(),id='tube_10_0';
 scene.objects[id].set(1.6,.4,-1.8);scene.objects[id].rot[1]=Math.PI/2;
 const contact=g.pipetteContact(id);assert.equal(contact.ok,true);
 apply(scene.objects.pipette,contact.pose);
 near(g.local(id,g.pipetteTip()),[0,.10,0],'Tip clears the glass and rendered liquid base');
 assert.equal(g.containsTip(id).ok,true);
 // Removing 3 mL from a 10 mL standard lowers its visible level by 30%.
 scene.liquids[id].node.scale[1]=scene.liquids[id].height*.7;
 assert.equal(g.containsTip(id).ok,true,'Fixed tip remains immersed through the cuvette dose');
 assert.equal(g.containsTip('tube_8_2').ok,false,'Contact cannot be borrowed from a neighbouring vessel');
});

test('each rack tube keeps the tip immersed throughout its 3 mL sample',()=>{
 const {scene,g}=fixture();
 for(const id of TUBES){
  const liquid=scene.liquids[id];
  for(const start of id==='tube_0_10'?[10,7]:[10]){
   liquid.node.scale[1]=liquid.height*start/10;
   const before=g.liquidSurface(id),contact=g.pipetteContact(id,{drawFraction:3/start});
   assert.ok(contact.ok,id);apply(scene.objects.pipette,contact.pose);
   liquid.node.scale[1]=liquid.height*(start-3)/10;
   const final=g.liquidSurface(id),tipY=g.local(id,g.pipetteTip())[1];
   assert.ok(before.localY>final.localY);assert.ok(Math.abs(final.localY-tipY-.025)<1e-6,id);
   assert.ok(g.containsTip(id).ok,id);
  }
 }
});

test('contact requires centering, safe depth, matching orientation and liquid for aspiration',()=>{
 const{scene,g}=fixture(),id='stockBottle',contact=g.pipetteContact(id);
 apply(scene.objects.pipette,contact.pose);assert.equal(g.containsTip(id).ok,true);
 scene.objects.pipette.pos[0]+=.13;assert.equal(g.containsTip(id).aligned,false);
 apply(scene.objects.pipette,contact.pose);scene.objects.pipette.pos[1]=g.opening(id).center[1]+.03;
 assert.equal(g.containsTip(id).ok,false,'Above the mouth is not contact');
 apply(scene.objects.pipette,contact.pose);scene.objects.pipette.rot[2]=.3;
 assert.equal(g.containsTip(id).ok,false,'An oblique pipette is rejected');
 apply(scene.objects.pipette,contact.pose);scene.objects[id].rot[2]=.3;
 assert.equal(g.pipetteContact(id).ok,false,'A tilted bottle is not an aspiration station');
 scene.objects[id].rot[2]=0;scene.liquids[id].node.visible=false;
 assert.equal(g.pipetteContact(id).ok,false);assert.equal(g.containsTip(id).ok,false);
 scene.liquids[id].node.visible=true;scene.liquids[id].node.scale[1]=.008;
 assert.equal(g.pipetteContact(id).ok,false,'Residual liquid below safe tip depth cannot be aspirated');
 assert.equal(g.pipetteContact('chamber').ok,false);
 assert.equal(g.pipetteContact(id,{mode:'invalid'}).ok,false);
});

test('dispensing uses the inside of an empty receiver without requiring immersion',()=>{
 const{scene,g}=fixture();
 for(const id of ['tube_0_10','cuvette','wasteBeaker']){
  scene.liquids[id].node.visible=false;
  const contact=g.pipetteContact(id,{mode:'dispense'});assert.equal(contact.ok,true,id);
  apply(scene.objects.pipette,contact.pose);
  assert.equal(g.containsTip(id,{mode:'dispense'}).ok,true,id);
  assert.equal(g.containsTip(id,{mode:'aspirate'}).ok,false,id);
  if(id.startsWith('tube_')){
   const opening=g.opening(id),bore=opening.localCenter[1]-opening.floorLocal;
   assert.ok(contact.depth>bore*.25&&contact.depth<bore*.5,'The seated tip is visible inside the calibration tube');
  }else assert.ok(contact.depth>=.06-1e-8&&contact.depth<=.08+1e-8,'Tip clears the receiver rim');
 }
});

test('all six tube bores preserve visible insertion depth and reject neighboring tubes',()=>{
 const {scene,g}=fixture();
 for(const id of TUBES){
  const inside=g.world(id,[0,.71,0]),screen=scene.r.project(inside),depth=g.tubeDepthAt(id,screen);
  assert.ok(Math.abs(depth-(1.232-.71))<.001,id);
  for(const other of TUBES)if(other!==id)assert.equal(g.tubeDepthAt(other,screen),null,id+' selected '+other);
  const contact=g.pipetteContact(id,{mode:'dispense',entryDepth:depth});
  assert.ok(Math.abs(contact.above[1]-inside[1])<.001&&contact.tip[1]<contact.above[1],id);
  apply(scene.objects.pipette,contact.pose);assert.ok(g.containsTip(id,{mode:'dispense'}).ok,id);
 }
});

test('smaller-cuvette contact accepts a centered pipette and rejects the former wide aperture',()=>{
 const{scene,g}=fixture();scene.objects.cuvette.set(1.25,.4,-2.6);scene.objects.cuvette.rot[1]=Math.PI/2;
 const contact=g.pipetteContact('cuvette',{mode:'dispense'});assert.equal(contact.ok,true);apply(scene.objects.pipette,contact.pose);
 near(g.local('cuvette',g.pipetteTip()),[0,.542,0],'Tip enters below the new .602 mouth');
 assert.equal(g.containsTip('cuvette',{mode:'dispense'}).ok,true);
 // At +90 degrees, a local +X offset becomes world -Z. A 0.05 offset
 // clears this aperture, whereas the old cuvette's 0.085 offset does not.
 scene.objects.pipette.pos[2]-=.05;assert.equal(g.containsTip('cuvette',{mode:'dispense'}).ok,true);
 scene.objects.pipette.pos[2]-=.035;assert.equal(g.containsTip('cuvette',{mode:'dispense'}).aligned,false);
 const aspiration=g.pipetteContact('cuvette');apply(scene.objects.pipette,aspiration.pose);
 near(g.local('cuvette',g.pipetteTip()),[0,.076,0],'Immersed contact clears the new thick base');
 assert.equal(g.containsTip('cuvette').ok,true);
 scene.objects.pipette.pos[1]=.4+.05;assert.equal(g.containsTip('cuvette').ok,false,'The pipette cannot enter the glass base');
});

test('anchor poses honor parent transforms, tool scale and rotation without moving the tool',()=>{
 const{scene,g}=fixture(),node=scene.objects.cuvette;
 const parent=scene.r.root.add(new Node()).set(2,.5,-1);parent.rot=[.1,.7,-.2];
 scene.r.root.children=scene.r.root.children.filter(child=>child!==node);parent.add(node);
 node.scale=[1.1,.9,1.2];const before=[...node.pos],rotation=[.3,-.4,-1.8],mouth=[-1.2,2.3,.4];
 const pose=g.poseAtAnchor('cuvette',INTERACTION_GEOMETRY.cuvetteMouth,mouth,rotation);
 near(node.pos,before,'Planning a pose does not enact it');
 apply(node,pose);near(g.cuvetteMouth(),mouth);
 assert.throws(()=>g.poseAtAnchor('cuvette',[NaN,0,0],mouth),TypeError);
 assert.throws(()=>g.world('missing'),RangeError);
});

test('cuvette seating fits the chamber and follows a translated, quarter-turned instrument',()=>{
 const{scene,g}=fixture();scene.objects.instrument.set(3,.4,1);scene.objects.instrument.rot[1]=Math.PI/2;
 const pose=g.cuvetteSeatPose();assert.equal(pose.clear,true);near(pose.position,[3.1,1.013,.15]);
 apply(scene.objects.cuvette,pose);near(g.cuvetteMouth(),[3.1,1.615,.15]);near(g.cuvetteMouth(),pose.mouth);
 near(g.local('instrument',g.world('cuvette',[0,0,0])),[.85,.613,.1]);
 assert.ok(Math.abs(g.opening('chamber').floorLocal-.608)<1e-8,'The raised chamber floor supports the shortened body');
 near(g.local('instrument',g.cuvetteMouth()),[.85,1.215,.1]);
 near(g.axis('cuvette'),[0,1,0]);assert.ok(pose.mouth[1]<g.opening('chamber').center[1],'Seated cuvette clears the lid');
 g.setLid(false);assert.equal(g.cuvetteSeatPose().clear,false);
});

test('pour poses keep the mouth centered over moved waste across the full wrist turn',()=>{
 const{scene,g}=fixture();scene.objects.wasteBeaker.set(-3,.25,2.8);scene.objects.wasteBeaker.rot[1]=1.1;
 for(const yaw of [0,.7,Math.PI/2,-Math.PI/2])for(const angle of [0,-.6,-1.4,-1.7,-2.1]){
  const pose=g.cuvettePourPose(angle,yaw);apply(scene.objects.cuvette,pose);
  near(g.cuvetteMouth(),pose.mouth,`Mouth remains on its pour anchor at yaw ${yaw}, angle ${angle}`);
  const local=g.local('wasteBeaker',g.cuvetteMouth());near([local[0],local[2]],[0,0]);
  assert.ok(Math.abs(local[1]-(1.25+Math.max(0,Math.cos(angle))*.602))<2e-5,'Pour lift uses the shorter body rather than the previous .86 height');
  assert.ok(local[1]>=1.25-1e-5,'Mouth stays above the waste rim');
  const expectedAxis=[-Math.cos(yaw)*Math.sin(angle),Math.cos(angle),Math.sin(yaw)*Math.sin(angle)];
  near(g.axis('cuvette'),expectedAxis,'Cuvette follows the requested rotation, including gimbal-lock yaw');
  const base=g.world('cuvette',[0,0,0]);assert.ok(base[1]>g.opening('wasteBeaker').center[1],'Upright start keeps the base above the rim');
  for(const x of [-.098,.098])for(const y of [0,.602])for(const z of [-.098,.098])assert.ok(g.world('cuvette',[x,y,z])[1]>g.opening('wasteBeaker').center[1]+.075,'The whole smaller cuvette clears the waste rim through the wrist turn');
 }
 apply(scene.objects.cuvette,g.cuvettePourPose(-Math.PI/2,0));
 near(g.world('cuvette',[0,0,0]),[-3.602,1.5,2.8],'A sideways pour swings the shortened body around its mouth');
});
