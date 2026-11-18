import test from 'node:test';
import assert from 'node:assert/strict';
import {StudioCamera} from '../src/studio-camera.js';
import {HandGestures} from '../src/view-gestures.js';
import {b06Packet} from './b06-landmark-fixtures.js';

function fixture(){
  const devices={calls:[],requests:[],enumerateDevices:async()=>['front','rear'].map(deviceId=>({deviceId,kind:'videoinput'}))};
  devices.getUserMedia=options=>{
    devices.calls.push(options);
    return new Promise((resolve,reject)=>devices.requests.push({resolve,reject}));
  };
  const source=new StudioCamera(devices,()=>({play:async()=>{}}));
  function connect(deviceId){
    const track=new EventTarget();
    Object.assign(track,{stops:0,stop(){this.stops++},getSettings:()=>({deviceId,facingMode:deviceId==='front'?'user':'environment'})});
    const stream={getVideoTracks:()=>[track],getTracks:()=>[track]};
    devices.requests.shift().resolve(stream);
    return {stream,track};
  }
  return {source,devices,connect};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('room and hands share a pending request, and the last owner releases the device',async()=>{
  const {source,devices,connect}=fixture();
  const room=source.use('room'),hands=source.use('hands');
  assert.equal(devices.calls.length,1);
  assert.equal(devices.calls[0].audio,false);
  assert.equal(devices.calls[0].video.facingMode.ideal,'environment');
  const {track}=connect('rear');assert.equal(await room,await hands);
  assert.equal(source.mirrored,false);
  source.release('hands');assert.equal(track.stops,0);
  source.release('room');assert.equal(track.stops,1);assert.equal(source.video,null);
});

test('camera off discards a late permission response and permits a fresh start',async()=>{
  const {source,devices,connect}=fixture();
  const old=source.use('room');
  source.stopAll();
  const fresh=source.use('hands'),abandoned=connect('rear'),current=connect('front');
  await assert.rejects(old,{name:'AbortError'});
  assert.equal((await fresh).srcObject,current.stream);assert.equal(abandoned.track.stops,1);
  assert.deepEqual([...source.owners],['hands']);assert.equal(devices.calls.length,2);
  source.stopAll();
});

test('switch preserves both owners and keeps the active camera when a replacement fails',async()=>{
  const {source,devices,connect}=fixture(),open=source.use('hands');
  const first=connect('front');await open;await source.use('room');
  const denied=source.switchDevice();await tick();
  devices.requests.shift().reject(new Error('busy'));await assert.rejects(denied,/busy/);
  assert.equal(first.track.stops,0);assert.equal(source.video.srcObject,first.stream);
  const change=source.switchDevice();await tick();
  assert.deepEqual(devices.calls.at(-1).video.deviceId,{exact:'rear'});
  const second=connect('rear');await change;
  assert.equal(first.track.stops,1);assert.equal(source.video.srcObject,second.stream);
  assert.deepEqual([...source.owners],['hands','room']);
  source.mirror(true);assert.equal(source.mirrored,true);
  second.track.dispatchEvent(new Event('ended'));
  assert.equal(source.video,null);assert.equal(source.owners.size,0);
});

test('a palm grasp used for tools also arms, grabs and releases the view across hand reorder',()=>{
  const recognizer=new HandGestures();
  const frame=(pose,t,reverse=false)=>{
    const packets=['Left','Right'].map((hand,i)=>b06Packet(pose,{x:240+i*300,y:240},{hand,stamp:t,width:800,height:500}));
    if(reverse)packets.reverse();
    const result=Object.fromEntries(['landmarks','worldLandmarks','handedness'].map(key=>[key,packets.flatMap(p=>p[key])]));
    return recognizer.update(result,t,4/3,true);
  };
  frame('open',0);const open=frame('open',180);
  assert.ok(open.every(h=>h.armed));
  frame('grip',220);const closed=frame('grip',400,true);
  assert.ok(closed.every(h=>h.phase==='press'&&h.grip==='palm'));
  assert.equal(closed[0].id,open[1].id);
  frame('open',440);assert.ok(frame('open',680).every(h=>h.phase==='release'));
});
