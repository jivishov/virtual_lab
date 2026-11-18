// A known-size magenta square in a camera exposure measures the actual WebGL
// backdrop independently of the tracking and overlay coordinate calculations.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');

async function installCalibrationCamera(page){
 await page.addInitScript(()=>{
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
   const image=document.createElement('canvas');image.width=960;image.height=720;
   const ctx=image.getContext('2d');
   const paint=()=>{
    ctx.fillStyle='#50504a';ctx.fillRect(0,0,960,720);
    ctx.fillStyle='#fb0bf6';ctx.fillRect(290,85,60,60);
   };
   paint();setInterval(paint,100);return image.captureStream(10);
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

async function run(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1856,height:866}}),results=[];
  await installCalibrationCamera(page);await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8774/');
  await page.waitForFunction(()=>!!window.lab);await page.locator('#immerseButton').click();
  await page.locator('#cameraButton').click();await page.locator('#liveRoom').click();
  await page.waitForFunction(()=>lab.studio.liveRoom);await page.locator('#cameraClose').click();
  results.push(await measure(page,.8,false));
  await page.locator('#handButton').click();await page.locator('#handCameraSize').fill('50');await page.locator('#handClose').click();
  await page.locator('#cameraButton').click();assert.equal(await page.locator('#roomCameraSize').inputValue(),'50');
  await page.locator('#mirrorCamera').check();await page.locator('#cameraClose').click();results.push(await measure(page,.5,true));
  await page.locator('#cameraButton').click();await page.locator('#roomCameraSize').fill('100');await page.locator('#cameraClose').click();
  results.push(await measure(page,1,true));
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>lab.renderInfo.css[0]===390);
  results.push(await measure(page,1,true));
  await page.reload();await page.waitForFunction(()=>!!window.lab);await page.locator('#handButton').click();
  assert.equal(await page.locator('#handCameraSize').inputValue(),'100');
  assert.equal(await page.evaluate(()=>lab.studio.liveRoom),false);console.log(JSON.stringify(results));
 }finally{await browser.close()}
}
run().catch(e=>{console.error(e);process.exitCode=1});
