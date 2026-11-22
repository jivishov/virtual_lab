// A known-size magenta square in a camera exposure measures the actual WebGL
// backdrop independently of the tracking and overlay coordinate calculations.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

async function installCalibrationCamera(page){
 await page.addInitScript(()=>{
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
   if(window.denyNextCamera){window.denyNextCamera=false;throw new DOMException('Camera permission denied','NotAllowedError')}
   if(window.cameraGate)await window.cameraGate;
   const image=document.createElement('canvas');image.width=960;image.height=720;
   const ctx=image.getContext('2d');
   const paint=()=>{
    ctx.fillStyle='#50504a';ctx.fillRect(0,0,960,720);
    ctx.fillStyle='#fb0bf6';ctx.fillRect(290,85,60,60);
   };
   paint();const stream=image.captureStream(10);
   const track=window.calibrationTrack=stream.getVideoTracks()[0];
   const timer=setInterval(()=>track.readyState==='ended'?clearInterval(timer):paint(),100);
   return stream;
  }});
 });
}

async function measure(page,size,mirrored){
 const canvas=page.locator('#labCanvas'),s=await canvas.boundingBox();
 const scale=Math.min(s.width/960,s.height/720)*size;
 const expected={width:60*scale,height:60*scale,x:s.width/2+(mirrored?160:-160)*scale,y:s.height/2+(115-360)*scale};
 const screenshot=await canvas.screenshot();
 const actual=await page.evaluate(async data=>{
  const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
  const pixels=document.createElement('canvas');pixels.width=image.width;pixels.height=image.height;
  const ctx=pixels.getContext('2d');ctx.drawImage(image,0,0);
  const rgba=ctx.getImageData(0,0,pixels.width,pixels.height).data;
  let left=image.width,right=-1,top=image.height,bottom=-1;
  for(let i=0;i<rgba.length;i+=4){
   if(rgba[i]<210||rgba[i+1]>65||rgba[i+2]<200)continue;
   const x=(i/4)%image.width,y=Math.floor(i/4/image.width);
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  return {width:right-left+1,height:bottom-top+1,x:(left+right)/2,y:(top+bottom)/2};
 },screenshot.toString('base64'));
 for(const key of Object.keys(expected))assert.ok(Math.abs(actual[key]-expected[key])<3,`${key}: ${JSON.stringify({expected,actual})}`);
 return {size,mirrored,viewport:[s.width,s.height],measured:actual.width};
}

async function checkSetup(page,percent){
 const preview=await page.locator('#handPreview').boundingBox();
 const frame=await page.locator('#handImageFrame').boundingBox();
 const reach=await page.locator('#handPlayerFrame').boundingBox();
 for(const key of ['width','height'])assert.ok(Math.abs(frame[key]-preview[key]*percent/100)<1,'Webcam preview '+key);
 assert.ok(await page.locator('#handPlayerFrame').isVisible(),'The reach box also works with the camera off');
 assert.equal(await page.locator('#handCameraSizeValue').textContent(),percent+'%');
 return {width:reach.width/frame.width,height:reach.height/frame.height};
}

async function checkRoomMap(page){
 const map=await page.locator('#roomMap').boundingBox(),frame=await page.locator('#roomImageFrame').boundingBox();
 const bench=await page.locator('#labCanvas').boundingBox(),image=await page.locator('#benchCameraFrame').boundingBox();
 for(const [key,axis] of [['x','width'],['y','height']]){
  assert.ok(Math.abs((frame[key]-map[key])/map[axis]-(image[key]-bench[key])/bench[axis])<.002,'Room preview position');
  assert.ok(Math.abs(frame[axis]/map[axis]-image[axis]/bench[axis])<.002,'Room preview size');
 }
}

async function run(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1856,height:866}}),results=[];
  await installCalibrationCamera(page);await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8774/');
  await page.waitForFunction(()=>!!window.lab);await page.locator('#immerseButton').click();
  await page.locator('#handButton').click();
  const slider=page.locator('#handCameraSize');
  const initial=await checkSetup(page,80);
  for(const size of [50,100,80]){
   await slider.fill(String(size));
   const reach=await checkSetup(page,size);
   for(const key of ['width','height'])assert.ok(Math.abs(reach[key]-initial[key])<.001,'Changing webcam scale preserves hand reach');
  }
  await page.locator('#handGain').fill('40');
  await slider.fill('50');
  const image=await page.locator('#handImageFrame').boundingBox(),player=page.locator('#handPlayerFrame');
  const point={x:image.x+image.width*.35,y:image.y+image.height*.35};
  await page.mouse.click(point.x,point.y);
  const center=await player.boundingBox();
  assert.ok(Math.abs(center.x+center.width/2-point.x)<1.5&&Math.abs(center.y+center.height/2-point.y)<1.5,'Tap uses coordinates in the scaled image');
  const preview=await page.locator('#handPreview').boundingBox();
  await page.mouse.click(preview.x+4,preview.y+4);assert.deepEqual(await player.boundingBox(),center,'Tapping the margin preserves calibration');
  await slider.fill('80');await page.locator('#handClose').click();
  assert.deepEqual(await page.evaluate(()=>lab.studio.cameraUsers),[],'Preview calibration needs no camera permission');
  await page.locator('#cameraSettingsButton').click();await page.locator('#liveRoom').click();
  await page.waitForFunction(()=>lab.studio.liveRoom);await checkRoomMap(page);await page.locator('#cameraClose').click();
  results.push(await measure(page,.8,false));
  await page.locator('#handButton').click();await page.locator('#handCameraSize').fill('50');await page.locator('#handClose').click();
  await page.locator('#cameraSettingsButton').click();assert.equal(await page.locator('#roomCameraSize').inputValue(),'50');
  await checkRoomMap(page);
  await page.locator('#mirrorCamera').check();await page.locator('#cameraClose').click();results.push(await measure(page,.5,true));
  await page.locator('#cameraSettingsButton').click();await page.locator('#roomCameraSize').fill('100');await checkRoomMap(page);await page.locator('#cameraClose').click();
  results.push(await measure(page,1,true));
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>lab.renderInfo.css[0]===390);
  await page.locator('#cameraSettingsButton').click();await checkRoomMap(page);await page.locator('#cameraClose').click();
  results.push(await measure(page,1,true));
  const power=page.getByRole('button',{name:'Camera',exact:true});
  assert.equal(await power.getAttribute('aria-pressed'),'true');
  await power.click();
  assert.deepEqual(await page.evaluate(()=>[lab.studio.cameraUsers,calibrationTrack.readyState,lab.hand.state.active]),[[],'ended',false]);
  await page.evaluate(()=>{window.denyNextCamera=true});
  await power.click();
  await page.waitForFunction(()=>document.getElementById('roomStatus').textContent.includes('declined'));
  assert.ok(await page.locator('#cameraPanel').isVisible());
  assert.equal(await power.getAttribute('aria-pressed'),'false');
  await page.locator('#liveRoom').click();await page.waitForFunction(()=>lab.studio.liveRoom);
  await page.locator('#cameraClose').click();await power.click();
  await page.evaluate(()=>{window.cameraGate=new Promise(resolve=>window.grantCamera=resolve)});
  await power.press('Enter');
  assert.equal(await power.getAttribute('aria-pressed'),'true','A pending permission request can be cancelled');
  await power.press('Enter');
  await page.evaluate(()=>{window.previousTrack=window.calibrationTrack;window.grantCamera()});
  await page.waitForFunction(()=>calibrationTrack!==previousTrack && calibrationTrack.readyState==='ended');
  assert.equal(await power.getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>{window.cameraGate=null});
  await power.click();
  await page.waitForFunction(()=>lab.studio.liveRoom);
  await page.locator('#handButton').click();await page.locator('#handStart').click();
  await page.locator('#handBegin').click({timeout:50000});
  assert.deepEqual(await page.evaluate(()=>lab.studio.cameraUsers),['room','hands']);
  for(const mode of ['view','work']){
   const option=page.locator('[data-quick-mode="'+mode+'"]');
   await option.press('Enter');
   assert.equal(await option.getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>lab.studio.handMode),mode);
  }
  await page.locator('#labMenu summary').click();
  const wavelength=page.locator('#wavelength');
  await wavelength.fill('');
  await wavelength.pressSequentially('550',{delay:150});
  await wavelength.press('Tab');
  await page.locator('#labMenu summary').click();
  await page.waitForFunction(()=>lab.state.wavelength===550&&document.getElementById('scaleValue').textContent==='550 nm');
  await power.click();
  assert.deepEqual(await page.evaluate(()=>[lab.studio.cameraUsers,calibrationTrack.readyState,lab.hand.state.active]),[[],'ended',false]);
  await page.reload();await page.waitForFunction(()=>!!window.lab);await page.locator('#handButton').click();
  assert.equal(await page.locator('#handCameraSize').inputValue(),'100');
  assert.equal(await page.evaluate(()=>lab.studio.liveRoom),false);console.log(JSON.stringify(results));
 }finally{await browser.close()}
}
run().catch(e=>{console.error(e);process.exitCode=1});
