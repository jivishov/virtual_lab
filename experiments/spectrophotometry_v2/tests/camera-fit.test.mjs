import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/renderer.js';
import {fitCamera} from '../src/camera-fit.js';

const {M,cameraMatrices}=globalThis.E3D;
const insets={top:180,right:24,bottom:110,left:24};
const corners=(min,max)=>[0,1,2,3,4,5,6,7].map(mask=>[0,1,2].map(axis=>mask&(1<<axis)?max[axis]:min[axis]));
const transformed=(points,position,rotation)=>{const matrix=M.trs(position,rotation,[1,1,1]);return points.map(point=>M.point(matrix,point))};

function verify(points,options,{tight=true}={}){
  const camera=fitCamera(points,options),{vp}=cameraMatrices(camera,options.width,options.height),padding={...insets,...options.insets};
  const projected=points.map(point=>{const p=M.point(vp,point);assert.ok(p.every(Number.isFinite));assert.ok(p[2]>=-1&&p[2]<=1,'Every corner must remain between near and far clips');return {x:(p[0]+1)*options.width/2,y:(1-p[1])*options.height/2}});
  const bounds={left:Math.min(...projected.map(p=>p.x)),right:Math.max(...projected.map(p=>p.x)),top:Math.min(...projected.map(p=>p.y)),bottom:Math.max(...projected.map(p=>p.y))};
  assert.ok(bounds.left>=padding.left-1e-4&&bounds.right<=options.width-padding.right+1e-4,JSON.stringify(bounds));
  assert.ok(bounds.top>=padding.top-1e-4&&bounds.bottom<=options.height-padding.bottom+1e-4,JSON.stringify(bounds));
  const centerX=(padding.left+options.width-padding.right)/2,centerY=(padding.top+options.height-padding.bottom)/2;
  assert.ok(Math.abs((bounds.left+bounds.right)/2-centerX)<.05,'Horizontal projected bounds must be centered in the usable rectangle');
  assert.ok(Math.abs((bounds.top+bounds.bottom)/2-centerY)<.05,'Vertical projected bounds must be centered below the asymmetric HUD');
  if(tight){const gaps=[bounds.left-padding.left,options.width-padding.right-bounds.right,bounds.top-padding.top,options.height-padding.bottom-bounds.bottom];assert.ok(Math.min(...gaps)<.6,'The fit must use the available viewport, including portrait distance scaling')}
  assert.equal(camera.yaw,options.yaw??0);assert.equal(camera.pitch,options.pitch??.6);assert.equal(camera.roll,0);assert.equal(camera.fov,options.fov??42);
  assert.ok([...camera.at,camera.distance].every(Number.isFinite));return camera;
}

test('desktop bounds fit tightly and center below an asymmetric HUD',()=>{
  const points=corners([-5,0,-1.4],[5.1,3.9,2.8]);
  const camera=verify(points,{width:1440,height:950,yaw:.03,pitch:.62,insets});
  assert.ok(camera.distance>0);assert.notDeepEqual(camera.at,[.05,1.95,.7]);
});

test('a narrow raised pipette uses phone height without double-counting portrait scaling',()=>{
  const points=transformed(corners([-.16,0,-.13],[.16,1.98,.13]),[-4.2,1.88,-.7],[0,.25,0]);
  verify(points,{width:390,height:844,yaw:.15,pitch:.6,insets});
});

test('a wide rack fits a phone and remains centered with horizontal HUD asymmetry',()=>{
  const points=transformed(corners([-1.7,0,-.55],[1.7,1.42,.55]),[2.6,.02,-1.4],[0,.55,0]);
  verify(points,{width:390,height:844,yaw:.55,pitch:.72,insets:{top:168,bottom:132,left:18,right:44}});
});

test('translated and rotated bounds preserve the requested front-facing yaw',()=>{
  const source=corners([-1.65,0,-1.2],[1.65,1.4,1.22]);
  for(const [position,rotation,yaw,pitch] of [
    [[7.3,.02,-3.4],[0,Math.PI/2,0],Math.PI/2-.16,.63],
    [[-8.5,1.4,6.7],[.25,-.72,.18],-.72,.78],
    [[125,-35,82],[.1,1.8,-.2],1.64,.4],
  ])verify(transformed(source,position,rotation),{width:1440,height:950,yaw,pitch,insets:{top:128,bottom:88,left:94,right:20}});
});

test('distance limits are honored and impossible caps are rejected',()=>{
  const points=corners([-.5,0,-.4],[.5,1,.4]),options={width:1440,height:950,insets};
  const minimum=verify(points,{...options,minDistance:8,maxDistance:12},{tight:false});assert.equal(minimum.distance,8);
  const natural=fitCamera(points,options),capped=verify(points,{...options,maxDistance:natural.distance*1.05});assert.ok(capped.distance<=natural.distance*1.05);
  assert.throws(()=>fitCamera(points,{...options,maxDistance:natural.distance*.8}),/cannot fit/);
  assert.throws(()=>fitCamera(points,{...options,minDistance:100}),/cannot fit/);
});

test('degenerate point bounds remain finite, centered and independent of input objects',()=>{
  const points=Object.freeze([Object.freeze([3,2,-1]),Object.freeze([3,2,-1])]);
  const options=Object.freeze({width:390,height:844,minDistance:2,insets:Object.freeze({...insets})});
  const camera=verify(points,options,{tight:false});assert.equal(camera.distance,2);assert.notEqual(camera.at,points[0]);
});

test('invalid geometry, viewport, projection and distance inputs reject explicitly',()=>{
  const points=corners([0,0,0],[1,1,1]),options={width:1440,height:950};
  for(const invalid of [[],[[0,1]],[[0,1,Infinity]],[[0,NaN,1]],null])assert.throws(()=>fitCamera(invalid,options),/finite three-dimensional/);
  for(const change of [{width:0},{height:Infinity},{yaw:NaN},{pitch:Math.PI/2},{fov:0},{fov:180},{minDistance:-1},{maxDistance:Infinity},{minDistance:8,maxDistance:4},{insets:{top:900,bottom:100}},{insets:{left:-1}},{insets:null}])assert.throws(()=>fitCamera(points,{...options,...change}),RangeError);
});
