// Browser integration with an actual MediaPipe camera detector and a recorded
// MediaPipe photograph, repeated as video. This is not physical-device validation.
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(os.tmpdir(),'spectro-studio-review','b06-hands');
const source=process.env.HAND_VIDEO||process.argv[2];
(async()=>{
 if(!source)throw Error('Pass a recorded Y4M video as the first argument or set HAND_VIDEO.');
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),headless:true,args:['--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-video-capture='+path.resolve(source)]});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},permissions:['camera']});
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8774/');await page.waitForFunction(()=>!!window.lab);
  await page.evaluate(async()=>{const {HandControls}=await import('./src/hand-controls.js'),packet=HandControls.prototype.packet;HandControls.prototype.packet=function(value){window.lastCameraPacket=value;return packet.call(this,value)}});
  await page.locator('#handButton').click();await page.locator('#handStart').click();
  await page.locator('#handBegin').waitFor({state:'visible',timeout:30000});
  await page.waitForFunction(()=>window.lastCameraPacket?.landmarks?.length>0,null,{timeout:30000}).catch(async error=>{console.error(await page.evaluate(()=>({hand:lab.hand.state,status:document.getElementById('handStatus').textContent,video:[document.getElementById('handVideo').videoWidth,document.getElementById('handVideo').videoHeight],frame:window.lastCameraPacket?.frame?[lastCameraPacket.frame.width,lastCameraPacket.frame.height]:null,landmarks:window.lastCameraPacket?.landmarks.length})));throw error});
  await page.screenshot({path:path.join(out,'player-frame.png')});
  await page.locator('#handBegin').click();
  await page.waitForFunction(()=>lab.hand.state.armed&&!document.querySelector('#handCursor').hidden,null,{timeout:20000});
  const metrics=await page.evaluate(()=>{
   const c=document.getElementById('palmTrace'),r=document.getElementById('labCanvas').getBoundingClientRect(),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let ink=0,lowerInk=0;for(let i=3;i<data.length;i+=4)if(data[i]>64){ink++;if(Math.floor(i/4/c.width)>c.height*.45)lowerInk++}
   const cursor=document.getElementById('handCursor'),center={x:parseFloat(cursor.style.left),y:parseFloat(cursor.style.top)};
   const box=c.getBoundingClientRect();
   const expected=lastCameraPacket.landmarks.map(points=>[0,5,9,13,17].reduce((sum,id)=>({x:sum.x+(lab.studio.mirrored?1-points[id].x:points[id].x)*box.width/5,y:sum.y+points[id].y*box.height/5}),{x:box.left-r.left,y:box.top-r.top}));
   return {ink,lowerInk,canvas:[c.width,c.height],surface:[r.width,r.height],backend:lab.hand.state.backend,armed:lab.hand.state.armed,history:lab.state.history.length,center,registrationError:Math.min(...expected.map(p=>Math.hypot(p.x-center.x,p.y-center.y))),room:lab.studio.liveRoom};
  });
  assert.ok(metrics.ink>220);assert.ok(metrics.lowerInk>100,'A true contour remains visible over the lower benchtop');assert.ok(metrics.registrationError<8,'Palm coordinates must share the contour crop and mirror');assert.equal(metrics.history,0);assert.equal(metrics.room,true);
  const motion=await page.evaluate(async()=>{
   const samples=[],canvas=document.getElementById('labCanvas'),cursor=document.getElementById('handCursor');let previous=-1;
   const until=performance.now()+2000;
   while(performance.now()<until){
    await new Promise(requestAnimationFrame);const p=window.lastCameraPacket;
    if(!p||p.stamp===previous||cursor.hidden)continue;previous=p.stamp;
    const x=parseFloat(cursor.style.left),y=parseFloat(cursor.style.top);
    const box=document.getElementById('palmTrace').getBoundingClientRect(),bench=canvas.getBoundingClientRect();
    const palms=p.landmarks.map(points=>[0,5,9,13,17].reduce((sum,id)=>({x:sum.x+(lab.studio.mirrored?1-points[id].x:points[id].x)*box.width/5,y:sum.y+points[id].y*box.height/5}),{x:box.left-bench.left,y:box.top-bench.top}));
    samples.push({x,y,stamp:p.stamp,error:Math.min(...palms.map(v=>Math.hypot(v.x-x,v.y-y)))});
   }
   const steps=samples.slice(1).map((p,i)=>Math.hypot(p.x-samples[i].x,p.y-samples[i].y));
   return {samples:samples.length,rangeX:Math.max(...samples.map(p=>p.x))-Math.min(...samples.map(p=>p.x)),rangeY:Math.max(...samples.map(p=>p.y))-Math.min(...samples.map(p=>p.y)),maxStep:Math.max(...steps),maxRegistrationError:Math.max(...samples.map(p=>p.error)),rmsRegistrationError:Math.sqrt(samples.reduce((sum,p)=>sum+p.error*p.error,0)/samples.length)};
  });
  assert.ok(motion.samples>=10);assert.ok(motion.maxRegistrationError<18,'No independent crop/outline jump during tracked motion');
  if(process.env.EXPECT_HAND_MOTION==='1'){assert.ok(motion.rangeX>30||motion.rangeY>30);assert.ok(motion.maxStep<35,'Smooth recorded motion must not teleport the palm cursor')}
  await page.screenshot({path:path.join(out,'registered-bench.png')});
  if(process.env.UPDATE_HAND_PREVIEW==='1')await page.screenshot({path:path.join(root,'preview','palm-outline.jpg'),type:'jpeg',quality:90});
  // Changing mirroring or crop is an input discontinuity: require a new open palm.
  await page.locator('#cameraSettingsButton').click();await page.locator('#mirrorCamera').click();await page.locator('#cameraClose').click();
  await page.waitForFunction(()=>lab.hand.state.armed&&!document.querySelector('#handCursor').hidden);
  await page.screenshot({path:path.join(out,'opposite-mirror.png')});
  await page.locator('#handButton').click();await page.locator('#handGain').fill('65');await page.locator('#handBegin').click();
  await page.waitForFunction(()=>lab.hand.state.armed&&!document.querySelector('#handCursor').hidden);
  await page.screenshot({path:path.join(out,'narrower-player-frame.png')});
  await page.locator('#handButton').click();await page.locator('#handStart').click();
  assert.deepEqual(await page.evaluate(()=>lab.studio.cameraUsers),[]);assert.equal(await page.evaluate(()=>lab.studio.liveRoom),false);
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'camera-check.json'),JSON.stringify({source:path.basename(source),metrics,motion,errors,physicalCamera:false},null,2));
  console.log(JSON.stringify({metrics,motion}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
