/* Webcam-only input. Frames stay in this tab and its inference worker.
   v3: 'pinch' mode (thumb-to-index pinch is the plunger; no calibration) alongside the calibrated
   'thumb' mode; the cursor is mapped around a comfortable home position with adjustable gain and a
   single One Euro filter. Insertion still uses the untouched palm coordinates. */
(function(root){
  'use strict';
  const C=root.ClassroomCore;
  /* Debounce the pose classifiers: one misread frame must not drop the held tool or cancel a stroke. */
  const GRIP_RELEASE_MS=220,OPEN_CONFIRM_MS=150,THUMB_HOLD_MS=200;
  /* Thumb press: a quick real press rarely reaches the depth held during calibration, so it counts from 55% of the calibrated travel. */
  const THUMB_BANDS={rest:.30,press:.55},PINCH_BANDS={rest:.28,press:.65};
  async function makeDetector(sources,offscreen){
    const errors=[];
    for(const s of sources)for(const delegate of ['GPU','CPU']){
      try{
        const mp=await import(s.bundle),files=await mp.FilesetResolver.forVisionTasks(s.wasm);
        const options={baseOptions:{modelAssetPath:s.model,delegate},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5};
        if(offscreen)options.canvas=new OffscreenCanvas(640,480);
        return {detector:await mp.HandLandmarker.createFromOptions(files,options),backend:s.name+' / '+delegate};
      }catch(e){errors.push(e.message);}
    }
    throw Error(errors.join(' | '));
  }
  function workerEntry(){
    let detector;
    self.onmessage=async e=>{
      const m=e.data;
      if(m.type==='init'){
        try{const out=await makeDetector(m.sources,true);detector=out.detector;self.postMessage({type:'ready',backend:out.backend});}
        catch(e){self.postMessage({type:'error',message:e.message});}
      }else if(m.type==='frame'){
        const start=performance.now();
        try{const result=detector.detectForVideo(m.bitmap,m.stamp);self.postMessage({type:'result',stamp:m.stamp,landmarks:result.landmarks,worldLandmarks:result.worldLandmarks,handedness:result.handedness,inferenceMS:performance.now()-start});}
        catch(e){self.postMessage({type:'frame-error',message:e.message});}
        finally{m.bitmap.close();}
      }
    };
  }
  class Webcam {
    constructor(opts){
      this.o=opts;this.video=opts.video;this.overlay=opts.overlay;
      this.running=false;this.modelReady=false;this.generation=0;this.worker=null;this.detector=null;
      this.profiles={};this.calibrationHand=null;this.preference='Auto';this.mode=opts.mode==='pinch'?'pinch':'thumb';this.home=null;this.homeSamples=[];
      this.gate=new C.PressGate(this.mode==='pinch'?PINCH_BANDS:THUMB_BANDS);this.fx=new C.OneEuro();this.fy=new C.OneEuro();
      this.lastSeen=0;this.lastSubmit=0;this.lastTime=-1;this.lastPacket=-Infinity;
      this.primary=null;this.lastPoint=null;this.errors=0;this.busy=false;
      this.vfc=null;this.raf=null;this.lostState=false;this.missStreak=0;this.captureTimer=null;
      this.stats={frames:0,inferenceMS:0,ageMS:0,lost:0,rejectedFrames:0};
    }
    get calibrated(){return this.mode==='pinch'||!!(this.profiles.rest&&this.profiles.press);}
    setMode(mode){
      this.mode=mode==='pinch'?'pinch':'thumb';this.gate=new C.PressGate(this.mode==='pinch'?PINCH_BANDS:THUMB_BANDS);this.cancelCapture();this.gate.reset();this.o.lost();this.lost();this.o.calibration?.(this.profiles);
      this.status(this.mode==='pinch'?'Pinch mode: touch thumb to index finger to press the plunger.':this.calibrated?'Thumb mode: calibration kept.':'Thumb mode: capture Rest, then Press.');
    }
    // The comfortable hand position becomes the centre of the bench view.
    setHome(){
      if(!this.lastRaw||performance.now()-this.lastSeen>this.gapLimit()){this.status('Show your hand, then set the centre.',true);return false;}
      this.home={...this.lastRaw};this.homeSamples=[];this.fx.reset();this.fy.reset();this.o.home?.(this.home);this.status('Centre set where your hand is now.');return true;
    }
    /* A page opened as file:// cannot import modules or fetch the bundled model, so it loads byte-identical MediaPipe 0.10.17
       assets over HTTPS instead: the Virtual Lab site first, then the pinned public CDN. Served over http(s), only the bundled
       local copy is used. Video frames never leave the device either way. */
    sources(){
      if(root.location?.protocol==='file:'){
        const site='https://virtuallab.az/experiments/elisa_assay/vendor/mediapipe/',cdn='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/';
        return [{name:'Virtual Lab MediaPipe (file:// page)',bundle:site+'vision_bundle.mjs',wasm:site+'wasm',model:site+'models/hand_landmarker.task'},
          {name:'Pinned CDN MediaPipe (file:// page)',bundle:cdn+'vision_bundle.mjs',wasm:cdn+'wasm',model:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'}];
      }
      const base=new URL('.',document.baseURI).href;return [{name:'Bundled MediaPipe',bundle:new URL('vendor/mediapipe/vision_bundle.mjs',base).href,wasm:new URL('vendor/mediapipe/wasm',base).href,model:new URL('vendor/mediapipe/models/hand_landmarker.task',base).href}];}
    status(s,error=false){if(this.lastStatus===s&&this.lastError===error)return;this.lastStatus=s;this.lastError=error;this.o.status(s,error);}
    gapLimit(){return C.HAND_GAP_MS;}
    staleLimit(){return C.HAND_GAP_MS;}
    async start(){
      if(this.running)return;
      this.running=true;const gen=++this.generation;this.status('Opening camera…');this.o.active(true);
      try{
        if(!isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Error('Camera requires HTTPS or localhost.');
        const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},frameRate:{ideal:30,max:30},facingMode:'user'},audio:false});
        if(gen!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}
        this.stream=stream;this.video.srcObject=stream;await this.video.play();
        if(gen!==this.generation)return;
        for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(gen===this.generation){this.stop();this.status('Camera disconnected. Mouse controls are available.',true);}});
        this.status('Loading on-device hand tracking…');
        if(window.Worker&&window.OffscreenCanvas&&window.createImageBitmap){
          try{await this.startWorker(gen);}
          catch(e){if(gen!==this.generation)return;/* startWorker cleans only its own resources. */}
        }
        if(!this.worker){
          const out=await makeDetector(this.sources(),false);
          if(gen!==this.generation){out.detector.close();return;}
          this.detector=out.detector;this.backend=out.backend+' / main-thread fallback';
        }
        if(gen!==this.generation)return;
        this.modelReady=true;this.primary=null;this.lastPoint=null;this.lastSeen=performance.now();
        this.lastTime=-1;this.lastSubmit=0;this.lastPacket=-Infinity;this.errors=0;this.missStreak=0;this.lostState=false;
        this.gate.reset();this.fx.reset();this.fy.reset();this.home=null;this.homeSamples=[];
        this.status(this.mode==='pinch'?'Camera ready. Hold your hand where it is comfortable; the centre is set automatically.':this.calibrated?'Camera ready. Relax the thumb to arm.':'Camera ready. Capture Rest, then Press.');
        this.o.calibration?.(this.profiles);
        this.monitor=setInterval(()=>{if(this.running&&performance.now()-this.lastSeen>this.gapLimit())this.lost();},80);
        this.schedule(gen);
      }catch(e){
        if(gen!==this.generation)return;
        this.stop();
        const messages={NotAllowedError:'Camera permission was denied. Allow camera access for this page, or continue with the mouse.',NotFoundError:'No camera was found. Mouse controls are available.',NotReadableError:'The camera is busy. Close other camera apps and try again.'};
        const offline=root.location?.protocol==='file:'?'Hand tracking could not load. A page opened from a file needs an internet connection for the hand tracker; to work offline, serve the elisa_assay folder (for example python -m http.server) and open elisa-3d.html from it. Detail: ':'';
        this.status(messages[e.name]||offline+String(e.message).slice(0,offline?160:600),true);
      }
    }
    async startWorker(gen){
      const url=URL.createObjectURL(new Blob([makeDetector.toString()+';('+workerEntry.toString()+')();'],{type:'text/javascript'}));
      let w,cancel;
      try{
        w=new Worker(url);this.worker=w;this.workerURL=url;
        await new Promise((resolve,reject)=>{
          let settled=false;
          const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timeout);if(this.cancelInit===cancel)this.cancelInit=null;error?reject(error):resolve();};
          const timeout=setTimeout(()=>finish(Error('Worker initialization timeout')),18000);
          cancel=()=>finish(Error('Cancelled'));this.cancelInit=cancel;
          w.onerror=e=>finish(Error(e.message));
          w.onmessage=e=>{
            if(gen!==this.generation)return;
            if(e.data.type==='ready'){this.backend=e.data.backend+' / worker';finish();}
            else if(e.data.type==='error')finish(Error(e.data.message));
          };
          try{w.postMessage({type:'init',sources:this.sources()});}catch(e){finish(e);}
        });
        if(gen!==this.generation){w.terminate();return;}
        w.onmessage=e=>{
          if(gen!==this.generation||this.worker!==w)return;
          this.busy=false;
          if(e.data.type==='result'){this.errors=0;this.result(e.data);}
          else this.processingError(Error(e.data.message),gen);
        };
        w.onerror=e=>{if(gen===this.generation&&this.worker===w){this.stop();this.status('Hand worker stopped: '+e.message,true);}};
      }catch(e){
        w?.terminate();URL.revokeObjectURL(url);
        if(this.worker===w)this.worker=null;
        if(this.workerURL===url)this.workerURL=null;
        if(this.cancelInit===cancel)this.cancelInit=null;
        throw e;
      }
    }
    schedule(gen){
      if(!this.running||gen!==this.generation)return;
      const cb=()=>{this.schedule(gen);this.frame(gen);};
      if(this.video.requestVideoFrameCallback)this.vfc=this.video.requestVideoFrameCallback(cb);
      else this.raf=requestAnimationFrame(cb);
    }
    processingError(error,gen){
      if(gen!==this.generation||!this.running)return;
      this.busy=false;this.lost();
      if(++this.errors>3){this.stop();this.status('Camera processing failed: '+error.message,true);}
    }
    async frame(gen){
      const now=performance.now();
      if(!this.running||gen!==this.generation||this.busy||this.video.readyState<2||this.video.currentTime===this.lastTime||now-this.lastSubmit<31)return;
      this.lastTime=this.video.currentTime;this.lastSubmit=now;this.busy=true;
      const worker=this.worker;
      try{
        if(worker){
          const bitmap=await createImageBitmap(this.video);
          if(gen!==this.generation||worker!==this.worker){bitmap.close();return;}
          try{worker.postMessage({type:'frame',bitmap,stamp:now},[bitmap]);}catch(e){bitmap.close();throw e;}
        }else{
          const start=performance.now(),out=this.detector.detectForVideo(this.video,now);
          this.busy=false;this.errors=0;this.result({...out,stamp:now,inferenceMS:performance.now()-start});
        }
      }catch(e){this.processingError(e,gen);}
    }
    stop(){
      this.running=false;this.modelReady=false;this.generation++;
      this.cancelInit?.();this.cancelInit=null;clearInterval(this.monitor);
      if(this.vfc!==null)this.video.cancelVideoFrameCallback?.(this.vfc);
      if(this.raf!==null)cancelAnimationFrame(this.raf);
      this.vfc=this.raf=null;this.worker?.terminate();this.worker=null;this.detector?.close();this.detector=null;
      if(this.workerURL)URL.revokeObjectURL(this.workerURL);this.workerURL=null;
      this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;
      this.video.pause?.();this.video.srcObject=null;this.clearOverlay();this.busy=false;
      this.cancelCapture();this.gate.reset();this.fx.reset();this.fy.reset();this.handState=null;this.thumbHold=null;this.primary=null;this.lastPoint=null;this.lastPacket=-Infinity;
      this.lostState=true;this.o.lost();this.o.active(false);this.status('Camera off · mouse control');
    }
    clearOverlay(){this.overlay.getContext('2d').clearRect(0,0,this.overlay.width,this.overlay.height);}
    miss(){this.missStreak++;if(performance.now()-this.lastSeen>this.gapLimit())this.lost();}
    lost(){
      if(!this.lostState){this.stats.lost++;this.o.lost();this.lostState=true;this.clearOverlay();}
      this.gate.reset();this.fx.reset();this.fy.reset();this.handState=null;this.thumbHold=null;
      if(this.running)this.status(this.captureState?'Tracking interrupted. Keep the same hand centered for calibration.':this.mode==='pinch'?'Tracking paused. Show your hand again; open the pinch to re-arm.':this.calibrated?'Tracking paused. Relax the thumb to re-arm; no pending transfer will complete.':'Show your whole working hand, then capture Rest and Press.');
    }
    cancelCapture(){clearTimeout(this.captureTimer);this.captureTimer=null;this.captureState=null;}
    setPreference(value){
      this.preference=['Auto','Right','Left'].includes(value)?value:'Auto';this.primary=null;this.lastPoint=null;
      this.profiles={};this.calibrationHand=null;this.cancelCapture();this.o.lost();this.lost();
      this.o.calibration?.(this.profiles);this.status('Working hand changed. Capture Rest and Press again.');
    }
    capture(kind){
      if(!['rest','press'].includes(kind))return;
      if(this.mode==='pinch'){this.status('Pinch mode needs no calibration. Switch to Thumb press in Hand settings to calibrate.');return;}
      if(!this.running){this.status('Start the camera first.',true);return;}
      if(!this.modelReady){this.status('Wait for the hand model to finish loading, then calibrate.',true);return;}
      if(kind==='press'&&!this.profiles.rest){this.status('Capture Rest first.',true);return;}
      if(!this.primary||performance.now()-this.lastSeen>this.gapLimit()){
        this.status('Show your whole working hand until tracking is stable, then capture '+(kind==='rest'?'Rest':'Press')+'.',true);return;
      }
      this.cancelCapture();this.gate.reset();this.o.lost();
      if(kind==='rest'){this.profiles={};this.calibrationHand=null;this.o.calibration?.(this.profiles);}
      const now=performance.now();this.captureState={kind,start:now+650,end:now+3850,samples:[],hand:kind==='press'?this.calibrationHand:null};
      this.status('Hold a comfortable pipette grip with the thumb '+(kind==='rest'?'relaxed':'pressed down')+'. Keep the same whole hand centered.');
      this.captureTimer=setTimeout(()=>this.finishCapture(),4050);
    }
    finishCapture(){
      const c=this.captureState;if(!c)return;this.cancelCapture();
      const samples=c.samples;
      if(samples.length<5){this.status('Not enough stable hand frames. Keep the same hand centered and retry '+(c.kind==='rest'?'Rest':'Press')+'.',true);return;}
      const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
      const profile=Array.from({length:7},(_,i)=>median(samples.map(s=>s[i])));
      const noise=median(samples.map(v=>C.norm(C.sub(v,profile))/Math.sqrt(7)));
      if(noise>.14){this.status('Pose varied too much. Hold one thumb position and retry.',true);return;}
      if(c.kind==='press'&&(!this.profiles.rest||c.hand!==this.calibrationHand||C.norm(C.sub(profile,this.profiles.rest))/Math.sqrt(7)<.025)){
        this.status('Press must be distinct from Rest and use the same hand. Retry calibration.',true);return;
      }
      if(c.kind==='rest')this.calibrationHand=c.hand;
      this.profiles[c.kind]=profile;this.gate.reset();this.o.calibration?.(this.profiles);
      this.status(this.calibrated?'Calibrated. Relax the thumb; then grip over a tool.':'Rest saved. Now capture Press.');
    }
    result(data){
      if(!this.running)return;
      const now=performance.now(),age=Number.isFinite(data.stamp)?now-data.stamp:Infinity;
      // A rejected packet is a missed detection: the gesture survives unless no usable frame arrives within the gap limit.
      if(!Number.isFinite(data.stamp)||age<0||age>this.staleLimit()||data.stamp<=this.lastPacket){this.stats.rejectedFrames++;this.miss();return;}
      this.lastPacket=data.stamp;
      const lockedHand=this.captureState?.hand||this.calibrationHand;
      const finiteLandmarks=lm=>Array.isArray(lm)&&lm.length===21&&lm.every(v=>v&&[v.x,v.y,v.z].every(Number.isFinite));
      let hands=(data.landmarks||[]).map((lm,i)=>({lm,world:data.worldLandmarks?.[i],name:data.handedness?.[i]?.[0]?.categoryName,score:data.handedness?.[i]?.[0]?.score??0}));
      hands=hands.filter(h=>h.score>=.5&&['Left','Right'].includes(h.name)&&finiteLandmarks(h.lm)&&finiteLandmarks(h.world)&&(this.preference==='Auto'||h.name===this.preference)&&(!lockedHand||h.name===lockedHand));
      if(this.lastPoint)hands.sort((a,b)=>Math.hypot(a.lm[0].x-this.lastPoint.x,a.lm[0].y-this.lastPoint.y)-Math.hypot(b.lm[0].x-this.lastPoint.x,b.lm[0].y-this.lastPoint.y));
      const h=hands[0];if(!h){this.miss();return;}
      if(this.lastPoint&&now-this.lastSeen<900&&Math.hypot(h.lm[0].x-this.lastPoint.x,h.lm[0].y-this.lastPoint.y)>.42){this.miss();return;}
      // Calibration uses metric world geometry only; never mix image-space fallback poses.
      const m=C.measureHand(h.world,h.lm);if(!m){this.miss();return;}
      if(now-this.lastSeen>this.gapLimit())this.lost();
      this.primary=h.name;this.lastPoint={x:h.lm[0].x,y:h.lm[0].y};this.lastSeen=now;this.lostState=false;this.missStreak=0;
      this.stats.frames++;this.stats.inferenceMS=data.inferenceMS??0;this.stats.ageMS=age;this.draw(h.lm);
      if(this.captureState){
        const c=this.captureState;if(!c.hand)c.hand=h.name;
        // Any hand that is not spread open counts: the thumb features do not depend on how tightly the fingers curl.
        if(!m.open&&now>=c.start&&now<=c.end){c.samples.push(m.features);if(c.samples.length===1||c.samples.length%6===0)this.status('Capturing '+(c.kind==='rest'?'Rest':'Press')+'… '+c.samples.length+' stable frames');}
        if(now>c.end)this.finishCapture();return;
      }
      // Home position: the median palm point over the first steady second of tracking.
      const rawX=1-m.palmX,rawY=m.palmY;this.lastRaw={x:rawX,y:rawY};
      if(!this.home){this.homeSamples.push({x:rawX,y:rawY});if(this.homeSamples.length>=20){const med=k=>[...this.homeSamples.map(v=>v[k])].sort((a,b)=>a-b)[10];this.home={x:med('x'),y:med('y')};this.homeSamples=[];this.o.home?.(this.home);}}
      const tuning=root.ClassroomHandTuning?.get?.()||{gain:2.2,smoothing:.5},params=root.ClassroomHandTuning?.filterParams?.()||{minCutoff:1.8,beta:6};
      for(const f of [this.fx,this.fy]){f.minCutoff=params.minCutoff;f.beta=params.beta;}
      const home=this.home||{x:.5,y:.45},sx=this.fx.update(rawX,now),sy=this.fy.update(rawY,now),bounds=this.o.bounds();
      const nx=C.clamp(.5+(sx-home.x)*tuning.gain),ny=C.clamp(.5+(sy-home.y)*tuning.gain*1.3);
      const base={x:nx*bounds.width,y:ny*bounds.height,rawX,palmY:rawY,now,source:'hand',handName:h.name,normal:m.normal,rotation:m.rotation,homed:!!this.home};
      let frame,edge,ready;
      if(this.mode==='pinch'){
        // Pinch = plunger. Thumb-to-index distance over palm width: about 1 when open, under .4 when pinched.
        const depth=C.clamp((.75-m.pinchRatio)/.5),spread=m.extended>=4&&m.pinchRatio>.9,hand=this.stabilize({grip:!spread,open:spread},now);
        edge=this.gate.update(depth,now,true);ready=true;
        frame={...base,ready:true,thumbDepth:depth,thumbDown:this.gate.active,grip:hand.grip,open:hand.open,hold:this.gate.active,pinch:true};
        this.o.frame(frame);this.o.meter(frame,this.stats,this.primary);if(edge)this.o.edge(edge,frame);
        this.status((hand.open?'Hand spread':this.gate.active?'Pinched · plunger pressed':this.gate.armed?'Ready · pinch to press':'Open the pinch to arm')+' · '+this.primary+' hand');
        return;
      }
      const hand=this.stabilize(m,now),measured=C.thumbDepth(m.features,this.profiles.rest,this.profiles.press),valid=this.calibrated&&measured.valid;
      // A briefly uncertain thumb keeps its last reading; no press or release edge can occur until it is measured again.
      if(valid)this.thumbHold={depth:measured.depth,at:now};
      const held=!valid&&this.calibrated&&!!this.thumbHold&&now-this.thumbHold.at<=THUMB_HOLD_MS,depth=valid?measured.depth:held?this.thumbHold.depth:0;ready=valid||held;
      // Holding the pipette only needs a hand that is not spread open; a loose, relaxed curl is fine. Picking up a tool
      // (hold) still needs a closed grip, so a relaxed hand drifting over the bench does not grab things.
      edge=held?null:this.gate.update(depth,now,valid&&!hand.open);
      frame={...base,ready:this.calibrated&&(ready||hand.open),thumbDepth:C.clamp(depth),thumbDown:ready&&this.gate.active,grip:!hand.open,open:hand.open,hold:hand.grip};
      this.o.frame(frame);this.o.meter(frame,this.stats,this.primary);if(edge)this.o.edge(edge,frame);
      if(ready)this.status((hand.open?'Curl your fingers around the pipette':this.gate.active?'Thumb pressed':this.gate.armed?'Thumb resting · ready':'Relax thumb to arm')+' · '+this.primary+' hand');
      else this.status(this.calibrated?'Thumb pose uncertain. Relax the thumb and keep the hand visible.':'Tracking is working. Capture Rest and Press to enable actions.');
    }
    /* Grip latches at once and is dropped only after it has been absent for GRIP_RELEASE_MS; an open (or spread) hand must persist for OPEN_CONFIRM_MS. */
    stabilize(m,now){
      const s=this.handState,grip=m.grip&&!m.open;
      if(!s||now-s.last>C.HAND_GAP_MS||now<s.last)return this.handState={grip,open:m.open,notGripSince:null,openSince:m.open?now:null,last:now};
      s.last=now;
      if(m.open){s.openSince??=now;if(now-s.openSince>=OPEN_CONFIRM_MS){s.open=true;s.grip=false;}}
      else{s.openSince=null;s.open=false;}
      if(grip){s.grip=true;s.notGripSince=null;}
      else if(!s.open){s.notGripSince??=now;if(now-s.notGripSince>=GRIP_RELEASE_MS)s.grip=false;}
      return s;
    }
    draw(lm){
      const c=this.overlay,ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle='#73e0d0';ctx.fillStyle='#f6fffd';ctx.lineWidth=2;
      for(const path of [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]]){
        ctx.beginPath();path.forEach((i,j)=>{const x=(1-lm[i].x)*c.width,y=lm[i].y*c.height;j?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
      }
      for(const i of [0,4,8]){ctx.beginPath();ctx.arc((1-lm[i].x)*c.width,lm[i].y*c.height,4,0,Math.PI*2);ctx.fill();}
    }
  }
  root.ClassroomWebcam=Webcam;
})(globalThis);
