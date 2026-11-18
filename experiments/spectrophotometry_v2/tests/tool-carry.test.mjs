import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/renderer.js';
import {beginCarry,carryPosition,pointerForEnd} from '../src/tool-carry.js';

test('long carries preserve the grabbed surface and predict tip alignment in perspective',()=>{
 const {Renderer,M,cameraMatrices}=globalThis.E3D;
 for(const [yaw,pitch] of [[-.105,.34],[.6,.77],[-1.1,1.3]]){
  const r=Object.create(Renderer.prototype);
  const viewport={width:1116,height:824};
  r.canvas={getBoundingClientRect:()=>viewport};
  r.vp=cameraMatrices({yaw,pitch,distance:10,fov:42,at:[0,1,0]},viewport.width,viewport.height).vp;
  r.invVP=M.inverse(r.vp);
  const start=[-2,1.4,-1],surface=[-1.94,3.2,-.95],picked=r.project(surface);
  const grip=beginCarry(r,start,surface,picked.x-3,picked.y+2);
  const bounds={min:[-7,0,-4],max:[7,Infinity,4.7]};
  const x=picked.x+230,y=picked.y-43,tip=carryPosition(r,grip,x,y,bounds);
  const projected=r.project(tip.map((v,i)=>v+grip.gripOffset[i]));
  assert.ok(Math.hypot(projected.x-x-3,projected.y-y+2)<.05);
  const aim=pointerForEnd(r,grip,r.project(tip));
  assert.ok(Math.hypot(aim.x-x,aim.y-y)<.06,'Tip and grip use different perspective depths');
 }
});
