import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraRect,DEFAULT_CAMERA_SIZE,savedCameraSize} from '../src/camera-framing.js';
import {playerFrame} from '../src/view-gestures.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} versus ${b}`);

test('a 4:3 webcam fits a wide immersive bench at its native aspect and shows a substantially smaller palm',()=>{
 const bench=1856/866,source=4/3,area=playerFrame({x:.5,y:.5},.8,source,bench);
 const r=cameraRect(source,bench,DEFAULT_CAMERA_SIZE,area,{x:.5,y:.5});
 close(r.width*bench/r.height,source);
 assert.ok(r.width*area.width<.45,'The old camera filled the whole bench with this crop');
 close(r.left+r.width/2,.5);close(r.top+r.height/2,.5);
 for(const size of [.5,.8,1])close(cameraRect(source,bench,size).height,size);
});

test('camera size stays constant through a reach, the center holds still, and every bench edge is reachable',()=>{
 for(const bench of [1856/866,1100/820,390/680]){
  for(const source of [4/3,16/9,3/4]){
   const area=playerFrame({x:.42,y:.56},.8,source,bench);
   const cx=area.left+area.width/2,cy=area.top+area.height/2;
   for(const size of [.5,.8,1]){
    const central=cameraRect(source,bench,size,area,{x:cx,y:cy});
    assert.deepEqual(cameraRect(source,bench,size,area,{x:cx+.1*area.width,y:cy-.1*area.height}),central);
    let prevX=-1,prevY=-1;
    for(let i=0;i<=50;i++){
     const t=i/50,x=area.left+area.width*t,y=area.top+area.height*t;
     const r=cameraRect(source,bench,size,area,{x,y}),sx=r.left+x*r.width,sy=r.top+y*r.height;
     close(r.width,central.width);close(r.height,central.height);
     assert.ok(sx>prevX&&sy>prevY);
     if(i){assert.ok(sx-prevX<1.43/50);assert.ok(sy-prevY<1.43/50)}
     prevX=sx;prevY=sy;
     if(i===0||i===50){close(sx,t);close(sy,t)}
    }
   }
  }
 }
});

test('saved size accepts the supported range and uses the studio default on a first visit or invalid preference',()=>{
 for(const value of [null,'',0,'no',Infinity,.49,1.01])assert.equal(savedCameraSize(value),DEFAULT_CAMERA_SIZE);
 for(const value of ['.5','.65','1'])assert.equal(savedCameraSize(value),Number(value));
});
