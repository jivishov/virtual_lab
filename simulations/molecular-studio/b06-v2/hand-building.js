import {openHandDetector} from './hand-detector.js';
import {createHandOutliner} from './hand-trace.js';
import {handSettings,handRanges,playerFrame} from './hand-gestures.js';
import {createHandControls} from './hand-controls.js';
import {createHandPeriodicTable} from './hand-periodic.js';

// The four gesture cards of the setup sheet (B06 mock). A closed glyph shows curled fingers.
function handGlyph(closed){
  const h=closed?8:22,y=closed?20:6;
  return '<rect x="16" y="24" width="28" height="24" rx="7"/>'+[16,23.5,31,38.5].map((x,i)=>`<rect x="${x}" y="${y+(i%3?0:3)}" width="5.5" height="${h}" rx="2.7"/>`).join('')+
    `<rect x="${closed?12:6}" y="${closed?26:28}" width="${closed?8:12}" height="6" rx="3"/>`;
}
const gestureCards=[['Aim',false,'Open palm moves the pointer'],['Grab or press',true,'Curl three fingers'],['Let go or select',false,'Open your hand'],['Zoom',true,'Two closed hands, spread apart']]
  .map(([title,closed,text])=>`<div><svg width="60" height="54" viewBox="0 0 60 54" fill="currentColor" aria-hidden="true">${handGlyph(closed)}</svg><b>${title}</b>${text}</div>`).join('');

export function installHandBuilding(main,camera,icon,placeElements) {
  const button=document.createElement('button');
  button.id='hand-building'; button.type='button'; button.innerHTML=icon('hand')+'<span>Hand building</span>';
  button.title='Build with one or two hands using a camera'; button.setAttribute('aria-haspopup','dialog');
  button.setAttribute('aria-pressed','false');
  document.getElementById('camera-backdrop').before(button);

  const dialog=document.createElement('dialog');
  dialog.className='hand-setup'; dialog.setAttribute('aria-labelledby','hand-setup-title');
  dialog.innerHTML=`
    <h2 id="hand-setup-title">Set up hand building</h2>
    <p class="hand-setup-lead">Place the frame around one student’s hands. Camera images stay on this device.</p>
    <div class="hand-setup-grid">
      <div class="hand-setup-camera">
        <div class="hand-camera"><button type="button" class="player-preview" aria-label="Position the player frame. Click the student's work area or use the arrow keys.">
          <video autoplay muted playsinline></video><span class="player-frame"></span>
        </button></div>
        <div class="frame-options" role="group" aria-label="Player framing"><button data-size=".8">At a desk</button><button data-size=".36">Classroom</button></div>
      </div>
      <div class="hand-setup-help">
        <div class="hand-gestures">${gestureCards}</div>
        <details class="hand-adjust">
          <summary>Adjust grip sensitivity</summary>
          <div class="hand-adjust-body">
            <div class="hand-adjust-buttons"><button data-mirror>Mirror</button><button data-switch hidden>Switch camera</button></div>
            <div class="grip-sliders hand-view-sliders"><label for="hand-frame-width">Frame width <output for="hand-frame-width">80%</output><input id="hand-frame-width" type="range" min="20" max="95" value="80" data-frame-width aria-label="Player frame width"></label></div>
            <div class="grip-sliders hand-grip-sliders"></div>
            <p id="hand-zoom-help">Higher grip values need more finger movement. Longer delays ignore quick flickers. To set zoom sensitivity by hand, close and reopen your hand over its slider.</p>
            <label class="hand-pinch"><input type="checkbox" data-pinch> Also allow thumb and index pinches</label>
            <div class="hand-levels" aria-label="Current hand movement"></div>
            <p class="hand-instruction">Grab empty space with one hand to turn the model. Open either hand to stop.</p>
            <p data-voice-help></p>
          </div>
        </details>
      </div>
    </div>
    <p class="hand-setup-status" role="status"></p>
    <div class="hand-setup-actions"><button data-retry hidden>Retry camera</button><button data-close>Cancel</button><button class="primary" data-start disabled>Start building</button></div>`;
  main.append(dialog);
  const bar=document.createElement('div'); bar.className='hand-bar'; bar.hidden=true;
  bar.innerHTML=`<span role="status"></span>
    <button type="button" data-hand-undo aria-label="Undo" title="Undo">${icon('undo')}</button>
    <button type="button" data-frame aria-label="Hand settings" title="Hand settings">${icon('settings')}</button>
    <button type="button" data-voice aria-label="Voice ready" title="Voice commands">${icon('microphone')}</button>
    <button type="button" data-stop aria-label="Stop hands" title="Stop hands">${icon('stop')}</button>`;
  main.append(bar);
  // Version 2 (b06-v2) keeps its own settings; a first visit starts from version 1's.
  const storageKey='virtualLab:b06-v2:handSettings:v1';
  let saved;
  try{saved=JSON.parse(localStorage.getItem(storageKey)??localStorage.getItem('virtualLab:b06:handSettings:v1'));}catch{}
  const preferences=handSettings(saved);
  const controls=createHandControls(main,bar,preferences), preview=dialog.querySelector('video');
  const table=createHandPeriodicTable(main,placeElements,()=>{
    controls.reset();
    main.querySelector('#builder-stage')?.handKit?.cancel();
  });
  const panel=dialog.querySelector('.hand-grip-sliders'),levels=dialog.querySelector('.hand-levels');
  const zoomPanel=dialog.querySelector('.hand-view-sliders');
  function remember(){
    controls.configure(preferences);
    try{localStorage.setItem(storageKey,JSON.stringify(preferences));}catch{}
  }
  for(const [key,label,unit] of [['close','Close to grasp','%'],['open','Open to release','%'],
    ['grabMs','Grasp delay',' ms'],['releaseMs','Release delay',' ms'],['zoomSensitivity','Zoom sensitivity','%']]){
    const row=document.createElement('label'),value=document.createElement('output'),input=document.createElement('input');
    input.type='range';input.dataset.setting=key;input.setAttribute('aria-label',label);
    input.id='hand-setting-'+key;row.htmlFor=input.id;value.setAttribute('for',input.id);
    if(key==='zoomSensitivity')input.setAttribute('aria-describedby','hand-zoom-help');
    [input.min,input.max]=handRanges[key];input.step=unit==='%'?'1':'10';input.value=preferences[key];
    const display=()=>{value.value=input.value+unit;input.setAttribute('aria-valuetext',value.value);};
    input.oninput=()=>{preferences[key]=Number(input.value);display();remember();};
    row.append(label,value,input);
    (key==='zoomSensitivity' ? zoomPanel : panel).append(row);
    display();
  }
  const pinch=dialog.querySelector('[data-pinch]');pinch.checked=preferences.pinch;
  pinch.onchange=()=>{preferences.pinch=pinch.checked;remember();};
  const area=dialog.querySelector('.player-preview'), box=dialog.querySelector('.player-frame');
  const range=dialog.querySelector('[data-frame-width]'), start=dialog.querySelector('[data-start]');
  const retry=dialog.querySelector('[data-retry]'), switcher=dialog.querySelector('[data-switch]');
  const mirror=dialog.querySelector('[data-mirror]'), message=dialog.querySelector('[role=status]');
  const widthValue=dialog.querySelector('.hand-view-sliders output');
  function syncInstructions() {
    const builder=main.dataset.mode==='builder';
    dialog.querySelector('[data-voice-help]').textContent='Voice: say “Move”, “Rotate”, “Pan”, “Fit”, “Zoom in” or “Zoom out”. '+
      (builder?'“Open periodic table” shows the elements and “Close periodic table” closes it without adding them. ':'')+
      'Voice uses your browser’s speech service.';
  }
  syncInstructions();
  let session=null, center={x:.5,y:.5};
  const sourceAspect=()=>camera.video?.videoWidth/camera.video?.videoHeight || 16/9;
  const region=()=>{
    const r=main.querySelector('.lab-surface')?.getBoundingClientRect();
    const ratio=r?.width&&r.height?r.width/r.height:1.3;
    return playerFrame(center,Number(range.value)/100,sourceAspect(),ratio);
  };

  function drawFrame() {
    const f=region();
    area.style.aspectRatio=String(sourceAspect());
    // The preview keeps the camera's shape inside the 4:3 box, so the frame stays true to the image.
    area.style.width=sourceAspect()>=4/3?'100%':sourceAspect()/(4/3)*100+'%';
    widthValue.value=range.value+'%';
    const left=camera.mirrored ? 1-f.left-f.width : f.left;
    Object.assign(box.style,{left:left*100+'%',top:f.top*100+'%',width:f.width*100+'%',height:f.height*100+'%'});
    preview.style.transform=camera.mirrored?'scaleX(-1)':'none';
    mirror.setAttribute('aria-pressed',String(camera.mirrored));
    for(const b of dialog.querySelectorAll('[data-size]'))b.setAttribute('aria-pressed',String(Math.round(Number(b.dataset.size)*100)===Number(range.value)));
  }
  function position(x,y) {
    const f=region();
    center={x:Math.max(f.width/2,Math.min(1-f.width/2,x)),y:Math.max(f.height/2,Math.min(1-f.height/2,y))};
    if(session){session.epoch++;picture.hidden=true;}
    drawFrame();
  }
  area.onpointerdown=e=>{
    const r=area.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;
    position(camera.mirrored ? 1-x : x,(e.clientY-r.top)/r.height);
  };
  area.onkeydown=e=>{
    const delta={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]}[e.key];
    if(delta){e.preventDefault();position(center.x+delta[0]*(camera.mirrored?-1:1),center.y+delta[1]);}
  };
  for(const b of dialog.querySelectorAll('[data-size]'))b.onclick=()=>{range.value=Math.round(Number(b.dataset.size)*100);position(center.x,center.y);};
  range.oninput=()=>position(center.x,center.y);
  preview.onloadedmetadata=drawFrame;
  mirror.onclick=()=>camera.flip();
  switcher.onclick=async()=>{
    switcher.disabled=true;
    try{await camera.switchDevice();}catch{message.textContent='That camera could not open. Choose another camera or use the current one.';}
    finally{switcher.disabled=false;}
  };

  const input=document.createElement('canvas'),ctx=input.getContext('2d',{alpha:false});
  const picture=document.createElement('canvas'),paint=createHandOutliner();
  picture.className='hand-camera-image';picture.setAttribute('aria-label','Camera with tracked hand outlines');
  const surface=()=>main.querySelector('.lab-surface');
  function placePicture(parent){
    picture.hidden=true;parent.append(picture);
    picture.style.transform=camera.mirrored?'scaleX(-1)':'none';
  }
  function suspend(s) {
    table.hide();
    s.epoch++; s.running=false; cancelAnimationFrame(s.raf);
    levels.textContent='';controls.reset();bar.hidden=true;main.classList.remove('hands-on');picture.remove();
  }
  function stop() {
    const s=session;session=null;
    if(s){suspend(s);s.abort.abort();s.detector?.close();}
    input.width=picture.width=1;preview.srcObject=null;if(dialog.open)dialog.close();
    button.setAttribute('aria-pressed','false');camera.release('hands');
  }
  function setPreview() {
    const video=camera.video;
    if(video && dialog.open && preview.srcObject!==video.srcObject){preview.srcObject=video.srcObject;preview.play().catch(()=>{});}
    drawFrame();
  }
  function settings() {
    const s=session;if(!s)return;
    suspend(s);
    syncInstructions();
    if(dialog.parentElement!==main)main.append(dialog);
    if(!dialog.open)dialog.showModal();
    placePicture(box);setPreview();
    start.disabled=!camera.video||s.loading;
    message.textContent=camera.video?'Move the frame to your hands.':'Opening camera…';
    if(s.detector && camera.video)schedule(s);
  }
  function schedule(s) {
    cancelAnimationFrame(s.raf);
    s.lastFrame=0;s.lastVideoTime=-1;s.lastResult=performance.now();s.stalled=false;s.waitingSince=null;
    s.raf=requestAnimationFrame(time=>tick(s,time));
  }
  async function tick(s,time) {
    if(session!==s||!s.detector||(!s.running&&!dialog.open))return;
    s.raf=requestAnimationFrame(next=>tick(s,next));
    if(s.running&&!controls.ready()){
      if(s.waitingSince===null){
        s.waitingSince=time;controls.reset();
        bar.querySelector('[role=status]').textContent='Waiting for the model to open…';
      }else if(time-s.waitingSince>5000){
        settings();message.textContent='The model hasn’t opened. Retry Start building once the model is ready.';
      }
      return;
    }
    if(s.waitingSince!==null){s.waitingSince=null;controls.reset();s.lastResult=time;}
    if(time-s.lastResult>700&&!s.stalled){s.stalled=true;s.epoch++;controls.reset();picture.hidden=true;}
    const video=camera.video;
    if(s.busy||!video||video.readyState<2||video.currentTime===s.lastVideoTime||time-s.lastFrame<50)return;
    s.busy=true;s.lastFrame=time;s.lastVideoTime=video.currentTime;
    const token=s.epoch;
    try{
      const f=region(),w=video.videoWidth,h=video.videoHeight,sw=w*f.width,sh=h*f.height;
      const scale=Math.min(1,640/Math.max(sw,sh)),cw=Math.max(1,Math.round(sw*scale)),ch=Math.max(1,Math.round(sh*scale));
      if(input.width!==cw||input.height!==ch){input.width=cw;input.height=ch;}
      ctx.drawImage(video,f.left*w,f.top*h,sw,sh,0,0,cw,ch);
      const result=await s.detector.detect(input,time);
      if(session!==s||token!==s.epoch)return;
      if(performance.now()-time>650){controls.reset();picture.hidden=true;return;}
      s.lastResult=performance.now();s.stalled=false;
      // Paint the exact exposure used for inference. Building and calibration share it.
      paint(picture,input,result);picture.hidden=false;
      if(s.running)controls.frame(result,time,cw/ch,camera.mirrored);
      else{
        const seen=controls.frame(result,time,cw/ch,camera.mirrored,dialog).filter(e=>e.points);
        if(session!==s || !dialog.open)return;
        const readings=seen.sort((a,b)=>a.id-b.id).map(e=>{
          const name=e.label?e.label+' hand':'Hand';
          const state=e.phase==='release'?'Released':e.grip?'Grasped':e.armed?'Ready':'Open to start';
          return name+' · '+Math.round(100*e.closure)+'% closed · '+Math.round(100*e.openness)+'% open · '+state;
        });
        const text=readings.join('\n') || 'Show an open palm in the frame.';
        if(levels.textContent!==text)levels.textContent=text;
      }
    }catch{
      if(session===s&&token===s.epoch){
        s.detector.close();s.detector=null;settings();
        message.textContent='Hand tracking paused. Select Start building to retry.';
      }
    }finally{s.busy=false;}
  }
  async function detector(s) {
    if(s.detector)return true;
    if(s.loading)return false;
    s.loading=true;start.disabled=true;message.textContent='Loading hand tracking on this device…';
    try{
      const model=await openHandDetector(s.abort.signal);
      if(session!==s){model.close();return false;}
      s.detector=model;return true;
    }catch{
      if(session===s)message.textContent='The hand tracker could not load. Select Start building to retry.';
      return false;
    }finally{
      s.loading=false;if(session===s)start.disabled=!camera.video;
    }
  }
  camera.events.addEventListener('change',()=>{
    const s=session;if(!s)return;
    if(!camera.has('hands')||!camera.video){stop();return;}
    if(s.video && s.video!==camera.video)settings();
    s.video=camera.video;s.epoch++;controls.reset();picture.hidden=true;
    picture.style.transform=camera.mirrored?'scaleX(-1)':'none';setPreview();
  });
  async function setup(){
    if(session){settings();return;}
    const s=session={abort:new AbortController(),epoch:0,loading:false,running:false,busy:false,raf:0};
    retry.hidden=true;switcher.hidden=true;mirror.disabled=true;settings();
    try{
      const video=await camera.use('hands');
      if(session!==s)return;
      s.video=video;mirror.disabled=false;setPreview();
      const devices=await camera.inputs();
      if(session!==s)return;
      switcher.hidden=devices.length<2;
      if(await detector(s) && session===s && dialog.open){
        message.textContent='Move the frame to your hands. Open and close them to check the outlines.';
        schedule(s);
      }
    }catch(e){
      if(session!==s)return;
      start.disabled=true;retry.hidden=false;
      message.textContent=e.name==='NotAllowedError'?'Allow camera access for this page, then retry.':e.name==='NotFoundError'?'Connect or select a camera, then retry.':'Camera unavailable. Open the local preview or use HTTPS, then retry.';
    }
  }
  start.onclick=async()=>{
    const s=session;if(!s||s.loading||!camera.video)return;
    if(!await detector(s)||session!==s||!dialog.open)return;
    const bench=surface();if(!bench){message.textContent='Waiting for the workbench to open.';return;}
    s.epoch++;s.running=true;preview.srcObject=null;dialog.close();
    main.classList.add('hands-on');bar.hidden=false;button.setAttribute('aria-pressed','true');
    placePicture(bench);bench.prepend(picture);bench.append(bar);controls.reset();schedule(s);
    table.mount(bench);
  };
  button.onclick=setup; bar.querySelector('[data-frame]').onclick=settings;
  bar.querySelector('[data-stop]').onclick=stop; dialog.querySelector('[data-close]').onclick=stop;
  retry.onclick=()=>{stop();setup();};
  dialog.addEventListener('cancel',e=>{e.preventDefault();stop();});
  const resetInput=()=>{if(session){session.epoch++;controls.reset();}};
  document.addEventListener('b06-mode',()=>{resetInput();syncInstructions();});
  document.addEventListener('fullscreenchange',resetInput);
  window.addEventListener('resize',()=>{resetInput();if(session){picture.hidden=true;drawFrame();}});
  window.addEventListener('blur',resetInput);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')resetInput();},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',stop);
}
