import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/renderer.js';
import {CUVETTE} from '../assets/cuvette-dimensions.js';

// Use the runtime's real scene graph and coordinate transforms; no WebGL context is needed.
const {LabScene}=await import('../src/scene.js');
const {Node,M}=globalThis.E3D;
const TUBES=['tube_10_0','tube_8_2','tube_6_4','tube_4_6','tube_2_8','tube_0_10'];
const close=(actual,expected,message='Coordinates agree')=>{
  assert.equal(actual.length,expected.length);
  actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-6,`${message}, component ${i}: ${v} vs ${expected[i]}`));
};

function fixture(){
  const s=Object.create(LabScene.prototype),root=new Node();
  Object.assign(s,{r:{root,dirtyShadow:false},objects:{},home:{},homeYaw:{},equipmentBounds:{},layoutItems:[],rackSlots:{},inserted:false,animation:null,marker:null});
  const placements={clipboard:[-.2,.02,-2.5],instrument:[2.45,.02,-.25],rack:[-1.25,.02,1.25],stockBottle:[-4.2,.02,-.7],waterBottle:[-3.05,.02,-.7],unknownBottle:[-1.9,.02,-.7],cuvette:[.92,CUVETTE.homeY,2.05],pipette:[-4.6,.25,1.55],wasteBeaker:[4.6,.02,1.5],tissueBox:[2.75,.02,2.15]};
  TUBES.forEach((id,i)=>{placements[id]=[-2.5+i*.5,.183,1.25];s.rackSlots[id]=i});
  for(const[id,p]of Object.entries(placements)){
    const n=root.add(new Node()).set(...p);n.rot[1]=id==='clipboard'?-.08:0;
    s.objects[id]=n;s.home[id]=[...p];s.homeYaw[id]=n.rot[1];s.layoutItems.push({id,label:id});
    s.equipmentBounds[id]={min:[-.36,0,-.36],max:[.36,1.6,.36]};
  }
  s.equipmentBounds.instrument={min:[-1.61,0,-1.15],max:[1.61,1.3,1.23]};
  s.equipmentBounds.rack={min:[-1.7,0,-.51],max:[1.7,.65,.51]};
  s.equipmentBounds.cuvette={min:[-CUVETTE.width/2,0,-CUVETTE.width/2],max:[CUVETTE.width/2,CUVETTE.height,CUVETTE.width/2]};
  for(const id of TUBES)s.equipmentBounds[id]={min:[-.16,0,-.16],max:[.16,1.24,.16]};
  s.pipetteStand=root.add(new Node()).set(-4.6,0,1.55);
  s.cuvetteDock=root.add(new Node()).set(.92,0,2.05);
  s.lid=s.objects.instrument.add(new Node()).set(.85,1.25,-.38);s.lid.rot[0]=-1.4;
  root.update();s.defaultLayout=s.layoutData();
  return s;
}

function snapshot(s){
  s.r.root.update();
  return JSON.stringify({layout:s.layoutData(),positions:Object.fromEntries(Object.entries(s.objects).map(([id,n])=>[id,{pos:n.pos,rot:n.rot,world:Array.from(n.world)}])),stand:s.pipetteStand.pos,dock:s.cuvetteDock.pos});
}

test('a regular keyboard/touch nudge can detach a seated tube',()=>{
  const s=fixture(),id=TUBES[0],start=[...s.home[id]];
  assert.equal(s.moveEquipment(id,start[0]+.12,start[2]).ok,true);
  assert.equal(Object.hasOwn(s.rackSlots,id),false);
  close(s.objects[id].pos,[start[0]+.12,.019,start[2]]);
  assert.ok(s.objects[id].pos[1]<start[1],'Detached tube rests on the bench, not at rack height');
  assert.equal(s.rackSlots[TUBES[1]],1,'Neighbour remains seated');
});

test('a slow tube drag keeps one height and docks only when released over a vacant hole',()=>{
  const s=fixture(),id=TUBES[0],start=[...s.objects[id].pos];
  s.beginEquipmentDrag(id);
  for(const dx of [.02,.04,.06,.08,.10]){
    assert.equal(s.moveEquipment(id,start[0]+dx,start[2]).ok,true);
    assert.equal(Object.hasOwn(s.rackSlots,id),false);
    close(s.objects[id].pos,[start[0]+dx,start[1],start[2]],'No snapping or bobbing while dragging');
  }
  s.endEquipmentDrag(id,true);
  assert.equal(s.rackSlots[id],0,'Releasing close to the vacant original hole docks the tube');
  close(s.objects[id].pos,start);
});

test('moving and rotating the rack carries seated tubes and leaves detached tubes in place',()=>{
  const s=fixture(),detached=TUBES[0],attached=TUBES[1];
  s.moveEquipment(detached,-3.4,2.1);const detachedPosition=[...s.objects[detached].pos];
  assert.equal(s.moveEquipment('rack',2,-1).ok,true);
  // Slot 1 lies 0.75 scene units to the left of the rack centre.
  close(s.objects[attached].pos,[1.25,.183,-1]);
  assert.equal(s.rotateEquipment('rack',Math.PI/2).ok,true);
  // A +90° yaw maps local left to world +Z.
  close(s.objects[attached].pos,[2,.183,-.25]);
  close(s.objects[detached].pos,detachedPosition);
  assert.ok(Math.abs(s.objects[attached].rot[1]-Math.PI/2)<1e-9);
  assert.equal(Object.hasOwn(s.rackSlots,detached),false);
});

test('translated and rotated instrument keeps cuvette and lid in its own frame',()=>{
  const s=fixture();s.inserted=true;
  assert.equal(s.moveEquipment('instrument',3,1).ok,true);
  assert.equal(s.rotateEquipment('instrument',Math.PI/2).ok,true);
  // The shortened cuvette rests on the raised seat at local (+.85, +.613, +.10).
  const chamberExpected=[3.1,.633,.15];
  close(s.chamber,chamberExpected,'Independent 90-degree chamber transform');
  close(s.objects.cuvette.pos,chamberExpected,'Inserted cuvette follows the chamber');
  assert.ok(Math.abs(s.objects.cuvette.rot[1]-Math.PI/2)<1e-9);
  // Hinge local position is (+0.85, +1.25, -0.38).
  close(M.point(s.lid.world,[0,0,0]),[2.62,1.27,.15],'Lid hinge follows the instrument');
  const before=snapshot(s);
  assert.equal(s.moveEquipment('cuvette',0,0).ok,false);
  assert.equal(snapshot(s),before,'Moving an inserted cuvette directly is rejected without mutation');
});

test('saved layout round trip preserves detached tubes, rack attachments and inserted cuvette',()=>{
  const s=fixture();s.inserted=true;
  s.moveEquipment(TUBES[0],-3.4,2.1);s.moveEquipment('rack',2,-1);s.rotateEquipment('rack',Math.PI/2);
  s.moveEquipment('instrument',3,1);s.rotateEquipment('instrument',Math.PI/2);
  const saved=JSON.parse(JSON.stringify(s.layoutData())),positions=Object.fromEntries(Object.entries(s.objects).map(([id,n])=>[id,[...n.pos]]));
  s.restoreLayout();assert.equal(s.applyLayout(saved).ok,true);
  for(const[id,expected]of Object.entries(positions))close(s.objects[id].pos,expected,`${id} round trip`);
  assert.equal(Object.hasOwn(s.rackSlots,TUBES[0]),false);
  assert.equal(s.rackSlots[TUBES[1]],1);
  close(s.objects.cuvette.pos,[3.1,.633,.15]);
});

test('corrupt saved layouts reject atomically before any placement is changed',()=>{
  const s=fixture();s.moveEquipment('rack',1,0);s.rotateEquipment('instrument',Math.PI/2);const before=snapshot(s);
  const corruptions=[
    data=>{data.items.instrument.x=Infinity},
    data=>{data.items.stockBottle.z=NaN},
    data=>{data.items.cuvette.yaw=100001},
    data=>{delete data.items.tissueBox},
    data=>{data.slots[TUBES[1]]=data.slots[TUBES[0]]},
    data=>{data.slots[TUBES[0]]=6},
    data=>{data.slots.unrecognized=0},
    data=>{data.version=2}
  ];
  for(const corrupt of corruptions){
    const data=structuredClone(s.layoutData());corrupt(data);
    assert.equal(s.applyLayout(data).ok,false);
    assert.equal(snapshot(s),before,'A rejected layout must not move any equipment or alter attachments');
  }
});

test('restore returns the starting arrangement, including seated tubes and tool docks',()=>{
  const s=fixture(),original=structuredClone(s.defaultLayout);
  s.moveEquipment(TUBES[0],-3.4,2.1);s.moveEquipment('rack',2,-1);s.rotateEquipment('rack',Math.PI/2);
  s.moveEquipment('pipette',5,2);s.rotateEquipment('pipette',Math.PI/2);
  s.moveEquipment('cuvette',3,3);s.rotateEquipment('cuvette',Math.PI/2);
  s.moveEquipment('instrument',3,1);s.rotateEquipment('instrument',Math.PI/2);
  assert.equal(s.restoreLayout().ok,true);
  assert.deepEqual(s.layoutData(),original);
  TUBES.forEach((id,i)=>close(s.objects[id].pos,[-2.5+i*.5,.183,1.25]));
  close(s.pipetteStand.pos,[-4.6,0,1.55]);close(s.cuvetteDock.pos,[.92,0,2.05]);
  close(s.objects.cuvette.pos,[.92,.028,2.05]);
});
