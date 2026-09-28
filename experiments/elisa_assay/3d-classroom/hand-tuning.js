/* Hand-control settings (a per-viewer convenience kept in this browser).
   mode: 'thumb' (calibrated thumb press on the plunger, as with a real micropipette; the default) or 'pinch'
   (thumb-to-index pinch presses the plunger; no calibration).
   gain: how far the cursor travels for a given hand movement. smoothing: 0 = most responsive, 1 = steadiest.
   assist: larger hand hit areas and snapping to the next expected target. Physical insertion always
   uses the untouched palm coordinates; these settings only change the cursor. */
(function(root){'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const STORE='elisa3d-v3-hand';
const defaults={mode:'thumb',gain:2.2,smoothing:.5,assist:true};
let settings={...defaults},modeChosen=false;
// Earlier versions saved 'pinch' simply because it was the default; only a plunger gesture the viewer picked is kept.
try{const saved=JSON.parse(root.localStorage?.getItem(STORE)||'null');if(saved){modeChosen=saved.modeChosen===true;settings=sanitize({...defaults,...saved,mode:modeChosen?saved.mode:defaults.mode});}}catch{}
function sanitize(s){return {mode:s.mode==='pinch'?'pinch':'thumb',gain:clamp(Number(s.gain)||defaults.gain,1,4),smoothing:clamp(Number.isFinite(Number(s.smoothing))?Number(s.smoothing):defaults.smoothing,0,1),assist:s.assist!==false};}
function save(){try{root.dispatchEvent?.(new Event('classroom-hand-settings'));}catch{}try{root.localStorage?.setItem(STORE,JSON.stringify({...settings,modeChosen}));}catch{}}
// One Euro parameters for a smoothing value: steadier means a lower cutoff and gentler speed response.
function filterParams(smoothing=settings.smoothing){return {minCutoff:3.2-2.8*smoothing,beta:9-6*smoothing};}
function bind(){
  const doc=root.document;if(!doc)return;
  const mode=doc.getElementById('handMode'),speed=doc.getElementById('handSpeed'),smooth=doc.getElementById('handSmoothing'),assist=doc.getElementById('handAssist');
  const speedOut=doc.getElementById('handSpeedValue'),smoothOut=doc.getElementById('handSmoothingValue');
  if(!speed||!smooth)return;
  const paint=()=>{if(mode)mode.value=settings.mode;speed.value=Math.round(settings.gain*100);smooth.value=Math.round(settings.smoothing*100);if(assist)assist.checked=settings.assist;
    if(speedOut)speedOut.textContent=settings.gain.toFixed(1)+'×';if(smoothOut)smoothOut.textContent=settings.smoothing<.34?'Quick':settings.smoothing<.67?'Balanced':'Steady';};
  paint();
  mode?.addEventListener('change',()=>{settings.mode=mode.value==='pinch'?'pinch':'thumb';modeChosen=true;paint();save();});
  speed.addEventListener('input',()=>{settings.gain=clamp(+speed.value/100,1,4);paint();save();});
  smooth.addEventListener('input',()=>{settings.smoothing=clamp(+smooth.value/100,0,1);paint();save();});
  assist?.addEventListener('change',()=>{settings.assist=assist.checked;paint();save();});
}
root.ClassroomHandTuning={get:()=>({...settings}),set:patch=>{if(patch&&'mode' in patch)modeChosen=true;settings=sanitize({...settings,...patch});save();},filterParams,defaults};
bind();
})(globalThis);
