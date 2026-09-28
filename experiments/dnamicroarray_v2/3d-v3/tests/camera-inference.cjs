/* Real bundled MediaPipe; synthetic browser video, not synthetic detector results. */
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.MICROARRAY_BASE_URL||'http://127.0.0.1:8766/';
const output=path.resolve(process.env.MICROARRAY_EVIDENCE_DIR||'outputs/verification');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,args:['--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const results=[];
  try{
    for(const fallback of [false,true]){
      const ctx=await browser.newContext({permissions:['camera']}),page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      if(fallback)await page.addInitScript(()=>{window.Worker=undefined;});
      await page.goto(base+'microarray-3d.html');await page.waitForFunction(()=>window.MicroarrayLab);
      // Passive witness only. The actual bundled model processes the actual video frames.
      await page.evaluate(()=>{const cam=MicroarrayLab.webcam,original=cam.result.bind(cam);window.inferenceWitness=[];cam.result=data=>{window.inferenceWitness.push({inferenceMS:data.inferenceMS,hands:data.landmarks?.length,stamp:data.stamp});return original(data);};});
      await page.locator('#handBtn').click();await page.locator('#cameraStart').click();
      await page.waitForFunction(()=>inferenceWitness.length>=3,{},{timeout:60000});
      const result=await page.evaluate(()=>({backend:MicroarrayLab.webcam.backend,actualInferenceResults:inferenceWitness.slice(0,3),protocolActions:MicroarrayLab.protocol.log.length}));
      assert.equal(result.protocolActions,0);assert.ok(result.actualInferenceResults.every(x=>Number.isFinite(x.inferenceMS)));
      assert.match(result.backend,fallback?/main-thread fallback/:/worker/);
      await page.locator('#restBtn').click();
      assert.equal(await page.evaluate(()=>!MicroarrayLab.webcam.captureState&&!MicroarrayLab.webcam.profiles.rest),true);
      assert.match(await page.locator('#cameraStatus').innerText(),/whole working hand/);
      result.noHandCalibrationBlocked=true;
      await page.locator('#closeCamera').click();
      result.stopped=await page.evaluate(()=>!MicroarrayLab.webcam.running&&!MicroarrayLab.webcam.worker&&!MicroarrayLab.webcam.detector&&!document.querySelector('video').srcObject);
      assert.equal(result.stopped,true);assert.deepEqual(errors,[]);results.push(result);await ctx.close();
    }
    await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'inference-proof.json'),JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify(results));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
