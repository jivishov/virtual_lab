// Use actual browser audio playback and the rendered mouse controls.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

async function main(){
 const {runDirectMouse}=await import('./browser-direct-mouse.js');
 const {spokenInstruction,voiceFile}=await import('../src/procedure-voice.js');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:['--enable-unsafe-swiftshader','--disable-renderer-backgrounding','--disable-background-timer-throttling']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.voiceStarts=[];
   document.addEventListener('playing',e=>{if(e.target.id==='procedureAudio')window.voiceStarts.push(e.target.currentSrc)},true);
  });
  const loaded=()=>page.waitForFunction(()=>!!window.lab);
  const plays=()=>page.evaluate(()=>window.voiceStarts.length);
  const expectNextPlay=async(action)=>{
   const previous=await plays();await action();
   await page.waitForFunction(n=>window.voiceStarts.length>n&&document.querySelector('#procedureAudio').currentTime>0,previous);
  };
  const expectClip=async step=>{
   const file=voiceFile(spokenInstruction(step));
   await page.waitForFunction(f=>document.getElementById('procedureAudio').currentSrc.endsWith('/'+f),file);
  };
  const toggle=page.locator('.procedure-audio [data-voice-toggle]'),replay=page.locator('.procedure-audio [data-voice-replay]');
  await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:8774/');await loaded();
  for(const name of ['Classic','SciFi'])await page.locator('#headerTheme').getByRole('radio',{name}).check();
  assert.equal(await page.locator('#procedureAudio').getAttribute('src'),null);
  await expectNextPlay(()=>page.locator('#followStep').check());
  await expectClip(await page.evaluate(()=>lab.step));
  const first=await plays();
  await page.locator('#labMenu summary').click();await page.locator('#qualityButton').click();await page.locator('#labMenu summary').click();
  assert.equal(await plays(),first,'An unchanged instruction is announced once');
  await page.locator('#pauseButton').click();
  assert.ok(await replay.isDisabled());assert.ok(await page.locator('#procedureAudio').evaluate(e=>e.paused));
  await expectNextPlay(()=>page.locator('#runButton').click());
  await page.locator('#stopButton').click();assert.ok(await replay.isDisabled());
  await expectNextPlay(()=>page.locator('#runButton').click());
  await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  await page.reload();await loaded();
  assert.equal(await toggle.getAttribute('aria-pressed'),'false','Mute persists across visits');
  await page.locator('#followStep').check();
  assert.equal(await plays(),0);
  await expectNextPlay(()=>replay.click());
  assert.equal(await toggle.getAttribute('aria-pressed'),'false','A single replay preserves mute');
  await page.locator('#immerseButton').click();
  const hud=page.locator('#hudProcedure');
  await expectNextPlay(()=>hud.locator('[data-voice-replay]').click());
  await expectNextPlay(()=>hud.locator('[data-voice-toggle]').click());
  await hud.locator('[data-voice-toggle]').click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  await page.locator('#exitImmersive').click();
  await page.locator('#followStep').check();
  const mutedStarts=await plays();
  await runDirectMouse(page,1);assert.equal(await plays(),mutedStarts,'The next step stays silent while muted');
  // The stock pipette is carried by the mouse. Use the keyboard voice control
  // so the pointer stays on the bench while switching narration back on.
  await toggle.focus();
  await expectNextPlay(()=>toggle.press('Enter'));await expectClip(await page.evaluate(()=>lab.step));
  const through=process.argv.includes('--all-steps')?Infinity:4;
  const result=await runDirectMouse(page,through,async step=>{
   await expectClip(step);
   if(step.index%20===0)console.log('Voice matched step',step.index+1);
  });
  await expectClip(await page.evaluate(()=>lab.step));
  assert.deepEqual(errors,[]);
  if(through===Infinity)assert.ok(result.finished);
  console.log(JSON.stringify({steps:result.through,finished:result.finished,actualAudioStarts:await plays(),errors}));
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
