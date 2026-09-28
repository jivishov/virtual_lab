/* ELISA 3D interface, restyled after the DNA microarray 3D lab (v3): floating panels, a step card with the next action,
   Run / Pause / Stop, auto-framing, pan/tilt/orbit mouse camera, an accessible Targets panel and v3 hand control. */
(async function(){
  'use strict';
  const $=id=>document.getElementById(id);
  try{await window.classroomDependencies;}catch(e){$('loadingText').textContent=e.message;$('fallbackLink').hidden=false;return;}
  const {Protocol,PHASES,META,standard,PATIENTS,REAGENTS,DOSE}=ELISAProtocol,{clamp}=ClassroomCore,{Interaction,STAND_OF}=ClassroomInteraction,{TimerClock}=ClassroomTimerClock;
  const GRAPHICS_KEY='elisa3d-v3-graphics',HINTS_KEY='elisa3d-v3-hints';
  let p=new Protocol(),r,s,control,camera,framer,pointer=null,dirty=true,toastTimer=null,modal=false,status='running',started=false,lastPhase=null,lastStages='',handSeen=0,guideTick=0;
  let mistakes=[],observations={};
  const canvas=$('labCanvas'),stage=document.querySelector('.stage'),reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pref=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}},setPref=(key,v)=>{try{localStorage.setItem(key,v);}catch{}};
  function say(message,kind=''){
    if(!message)return;const k=kind===true?'error':kind;$('toast').textContent=message;$('toast').className='toast show'+(k?' '+k:'');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),k==='error'?5000:2600);
  }
  function markDirty(shadow=false){dirty=true;if(shadow&&r)r.dirtyShadow=true;}
  let quality=pref(GRAPHICS_KEY,'balanced');if(!E3D.QUALITY[quality])quality='balanced';$('graphicsQuality').value=quality;
  let hintsOn=pref(HINTS_KEY,'1')!=='0';$('hintsToggle').checked=hintsOn;
  // Canvas-drawn labels use the bundled fonts; wait briefly for them so the first textures are crisp.
  try{await Promise.race([Promise.all(['600 32px Plex','500 32px Plex'].map(f=>document.fonts.load(f))),new Promise(res=>setTimeout(res,1500))]);}catch{}
  try{r=new E3D.Renderer(canvas,quality);r.resize();s=new ClassroomScene(r,p);}
  catch(e){$('loadingText').textContent='The 3D workbench could not start: '+e.message;$('fallbackLink').hidden=false;return;}

  // Screen position and pick radius of a target. Hand input gets larger hit areas.
  function targetScreen(t,hand=true){
    const point=s.position(t),q=r.project(point),edge=r.project(E3D.V.add(point,[t.radius,0,0]));
    return {x:q.x,y:q.y,z:q.z,r:Math.max(hand?22:t.kind==='well'||t.kind==='label'?12:15,Math.hypot(q.x-edge.x,q.y-edge.y)*(hand?1.5:1))};
  }
  // The target under the cursor always wins. opts.prefer keeps the current hand target until the aim is clearly nearer
  // another one. Aim assist only fills empty space: with nothing under the cursor it snaps to the next expected target nearby.
  function targetAt(x,y,filter,source,opts={}){
    r.root.update();r.updateCamera();const hits=[],hand=source==='hand';
    for(const t of s.targets){
      if(!filter(t))continue;const q=targetScreen(t,hand);if(q.z<0||q.z>1)continue;
      const distance=Math.hypot(x-q.x,y-q.y)/q.r;if(distance<1)hits.push({t,distance:hand&&t.id===opts.prefer?distance*.72:distance});
    }
    hits.sort((a,b)=>a.distance-b.distance);if(hits[0])return hits[0].t;
    if(hand&&handSettings().assist!==false){
      const nt=findTarget(nextTargetId());
      if(nt&&filter(nt)){const q=r.project(s.position(nt));if(q.z>=0&&q.z<=1&&Math.hypot(x-q.x,y-q.y)<76)return nt;}
    }
    return null;
  }
  const findTarget=id=>id==null?null:s.targets.find(t=>t.id===id)||null;

  // Corrections: shown in the step card until the next successful action, and kept in the notebook record.
  function reject(action,e,source){
    mistakes.push({message:e.message,phase:p.phase,action:action?.type||null,target:action?.target??null,source,at:Date.now()});if(mistakes.length>300)mistakes.shift();
    $('lastMistake').hidden=false;$('lastMistakeText').textContent=e.message;
  }
  $('dismissMistake').onclick=()=>{$('lastMistake').hidden=true;refit();};

  function sync(){
    s.sync(p);markDirty(true);
    if(!$('lastMistake').hidden&&Date.now()-(mistakes.at(-1)?.at||0)>600)$('lastMistake').hidden=true; // a successful action clears the correction
    renderUI();if(!$('notebook').hidden)renderNotebook();framer?.update(p);
  }
  const running=()=>status==='running'&&started;
  control=new Interaction({protocol:()=>p,running,pick:targetAt,screen:t=>targetScreen(t,true),
    target:t=>{s.focusTarget(t,!!t&&control?.contact?.target===t);markDirty();},pose:(c,f)=>{s.pose(c,f,p);markDirty(true);},
    park:tool=>{if(tool!=='navigate')s.park(tool);markDirty(true);},say,update:renderContact,reject,mark:(id,path)=>{s.mark(id,path);markDirty();},
    commit:(action,result)=>{if(action.type==='incubate'&&p.timer)timerClock.start();sync();say(result?.message||'Done.');if(p.phase==='read')setTimeout(()=>say('Run complete. Open the notebook to interpret the strips.','success'),0);}});
  function cancel(reason=''){control.resetMotion(reason);pointer=null;camera?.gate.reset();markDirty(true);}
  function useMouse(){if(camera?.running)camera.stop();}
  function frame(e){const b=canvas.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top,now:performance.now(),source:'mouse',ready:true};}

  // Incubation clock: independent of render frames; Pause and Stop freeze it.
  function readClockSpeed(){const n=Number($('clockSpeed').value);return n===30||n===60?n:1;}
  const timerClock=new TimerClock({now:()=>performance.now(),readSpeed:readClockSpeed,advance:seconds=>{
    if(!p.timer){timerClock.reset();return;}p.tick(Math.min(seconds,p.timer.remaining));const finished=!p.timer;if(finished)timerClock.reset();
    s.sync(p);renderUI();markDirty(true);if(finished){framer.update(p);say('Incubation complete. Next: '+p.meta[1]+'.','success');}
  }});
  function tickClock(){if(p.timer&&running()){if(!timerClock.running())timerClock.start();else timerClock.sync();}else if(timerClock.running()){if(p.timer)timerClock.sync();timerClock.reset();}}

  // Camera framing avoids every visible panel: split the free stage area around each one and keep whichever piece shows the working set largest.
  const OBSTACLES=['#stepCard','.contact','#cameraPanel','#targetsPanel','#setupDialog','#notebook','#cameraMenu'];
  function safeRects(){
    const c=canvas.getBoundingClientRect(),rel=q=>{const n=document.querySelector(q);if(!n||n.hidden||n.offsetParent===null||getComputedStyle(n).display==='none')return null;const b=n.getBoundingClientRect();return {left:b.left-c.left,top:b.top-c.top,right:b.right-c.left,bottom:b.bottom-c.top};};
    const hint=rel('.hint'),dock=rel('.dock');
    const base={left:12,top:12,right:c.width-12,bottom:Math.min(hint?hint.top:c.height,dock?dock.top:c.height)-10};
    const obstacles=OBSTACLES.map(rel).filter(Boolean);
    const split=(rect,obs)=>{
      const hit=obs.find(o=>o.left<rect.right&&o.right>rect.left&&o.top<rect.bottom&&o.bottom>rect.top);if(!hit)return [rect];
      const rest=obs.filter(o=>o!==hit),pad=10;
      return [{...rect,right:Math.min(rect.right,hit.left-pad)},{...rect,left:Math.max(rect.left,hit.right+pad)},{...rect,bottom:Math.min(rect.bottom,hit.top-pad)},{...rect,top:Math.max(rect.top,hit.bottom+pad)}]
        .filter(q=>q.right-q.left>160&&q.bottom-q.top>110).flatMap(q=>split(q,rest));
    };
    const rects=split(base,obstacles).sort((a,b)=>(b.right-b.left)*(b.bottom-b.top)-(a.right-a.left)*(a.bottom-a.top)).slice(0,24);
    return rects.length?rects:[base];
  }
  framer=new ClassroomFraming.AutoFrame({camera:()=>r.cam,apply:c=>{if(![...c.at,c.distance,c.pitch,c.yaw].every(Number.isFinite))return;Object.assign(r.cam,c);r.updateCamera();markDirty();renderContact();},size:()=>({w:canvas.clientWidth,h:canvas.clientHeight}),safe:safeRects,bounds:name=>s.bounds(name),cameraMatrices:E3D.cameraMatrices,busy:()=>!!(control.contact||control.pending||control.candidate||pointer),reduced});
  let refitTimer=null;function refit(){clearTimeout(refitTimer);refitTimer=setTimeout(()=>{if(!framer.manual)framer.update(p,{force:true});},120);}
  document.addEventListener('panels:changed',refit);
  const VIEW_NAMES={bench:'Bench',strips:'Strips',reagents:'Tubes & tips',wash:'Wash station',top:'Overhead'};
  function setViewButtons(view){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('cameraMode').textContent=view==='auto'?'Auto view':VIEW_NAMES[view]||'Free view';}
  function manualCamera(){framer.userMoved();setViewButtons(null);}
  function preset(view){
    cancel();closeMenus();
    if(view==='auto'){setViewButtons('auto');framer.recenter(p);return;}
    const views={bench:{at:[0,.24,.1],yaw:0,pitch:.86,distance:15.2},strips:{at:[0,.3,1.1],yaw:0,pitch:1.12,distance:6.4},reagents:{at:[-1.7,.4,-.8],yaw:0,pitch:.98,distance:7},wash:{at:[4.1,.4,.5],yaw:0,pitch:.9,distance:7.6},top:{at:[0,.15,.1],yaw:0,pitch:1.535,distance:14.6}};
    framer.userMoved();Object.assign(r.cam,views[view]||views.bench);r.updateCamera();setViewButtons(view);markDirty();renderContact();
  }
  canvas.addEventListener('pointerdown',e=>{
    closeMenus();
    if(modal||status!=='running'||![0,1,2].includes(e.button)||e.button===0&&!started)return;useMouse();const f=frame(e);canvas.setPointerCapture(e.pointerId);
    // Left: tools. Right-drag: sideways pan + tilt about the horizontal axis. Shift/Alt + right-drag or middle-drag: full orbit.
    const mode=e.button===0?'tool':e.button===1||e.shiftKey||e.altKey?'orbit':'pan';
    pointer={id:e.pointerId,button:e.button,mode,x:f.x,y:f.y,startX:f.x,startY:f.y,drag:false};
    if(e.button===0)control.mouseDown(f);else if(control.contact||control.pending){control.resetMotion();camera?.gate.reset();}
    e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{
    if(modal||status!=='running'||camera?.running)return;const f=frame(e);
    if(pointer&&pointer.mode!=='tool'){
      pointer.drag ||= Math.hypot(f.x-pointer.startX,f.y-pointer.startY)>3;
      if(pointer.drag){
        if(pointer.mode==='orbit'){r.cam.yaw-=(f.x-pointer.x)*.006;r.cam.pitch=clamp(r.cam.pitch+(f.y-pointer.y)*.005,.35,1.55);r.updateCamera();}
        else{panBy(pointer.x,pointer.y,f.x,pointer.y);r.cam.pitch=clamp(r.cam.pitch+(f.y-pointer.y)*.005,.35,1.55);r.updateCamera();}
        manualCamera();markDirty();renderContact();
      }
      pointer.x=f.x;pointer.y=f.y;return;
    }
    control.feed(f);
  });
  // Keep the bench point under the cursor fixed while panning or zooming.
  function panBy(x0,y0,x1,y1){
    const a=r.onPlane(x0,y0,0),b=r.onPlane(x1,y1,0);if(!a||!b)return;
    r.cam.at=[clamp(r.cam.at[0]+a[0]-b[0],-7,7),r.cam.at[1],clamp(r.cam.at[2]+a[2]-b[2],-4.5,4.5)];r.updateCamera();
  }
  canvas.addEventListener('pointerup',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;const was=pointer;pointer=null;
    if(was.button===0){const f=frame(e);control.feed(f);control.mouseUp(f);}
    else if(was.button===2&&!was.drag)control.secondary(); // a right-click without dragging inverts a held strip or ejects at the waste
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);markDirty(true);framer.retry(p);
  });
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('lostpointercapture',()=>{if(pointer)cancel('Stroke cancelled. No pending transfer was completed.');});
  canvas.addEventListener('pointercancel',()=>cancel('Stroke cancelled. No pending transfer was completed.'));
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();useMouse();cancel();const b=canvas.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,before=r.onPlane(x,y,0);
    r.cam.distance=clamp(r.cam.distance*Math.exp(e.deltaY*.0012),3.2,20);r.updateCamera();
    const after=r.onPlane(x,y,0);if(before&&after){r.cam.at=[clamp(r.cam.at[0]+before[0]-after[0],-7,7),r.cam.at[1],clamp(r.cam.at[2]+before[2]-after[2],-4.5,4.5)];r.updateCamera();}
    manualCamera();markDirty();renderContact();
  },{passive:false});
  canvas.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();camera?.stop();cancel();status='paused';$('loading').hidden=false;$('loadingText').textContent='Graphics context was lost. Reload this page to resume, or use the 2D experiment.';$('fallbackLink').hidden=false;});

  // What to do next, from the protocol's recommendation and the tool in hand.
  const TOOL_TARGET={marker:'markertool',micro:'microtool',wash:'washtool'};
  const NEED={label:'marker',attach:'micro',eject:'micro',aspirate:'micro',dispense:'micro',mix:'micro',discard:'micro',loadWash:'wash',wash:'wash',drain:'strip',mixStop:'strip',incubate:'navigate'};
  const TOOL_LABEL={navigate:'no tool',marker:'the marker',micro:'the micropipette',wash:'the transfer pipette',strip1:'strip 1',strip2:'strip 2'};
  const PLACE={marker:'its tray',micro:'its stand',wash:'its holder',strip1:'its place on the sheet',strip2:'its place on the sheet'};
  function nextStrip(){const done=p.phase==='mixstop'?p.stopMixedStrips:p.drainedStrips;return done.includes(1)?2:1;}
  function needTool(a){const n=NEED[a?.type];return n==='strip'?'strip'+nextStrip():n||null;}
  function nextTargetId(){
    const a=p.recommend();if(!a||a.type==='wait')return control.tool==='navigate'?null:STAND_OF[control.tool];
    const need=needTool(a),tool=control.tool;
    if(tool.startsWith('strip')&&control.tapDone)return STAND_OF[tool]; // this strip is finished: put it back
    if(need&&tool!==need)return tool==='navigate'?(need.startsWith('strip')?need:TOOL_TARGET[need]):STAND_OF[tool];
    switch(a.type){
      case 'label':return 'label'+a.target;case 'attach':return 'tips';case 'eject':case 'discard':return 'waste';
      case 'aspirate':case 'dispense':case 'mix':case 'wash':return a.target;case 'loadWash':return 'WASH';
      case 'drain':case 'mixStop':return 'towels';case 'incubate':return 'timer';default:return a.target??null;
    }
  }
  const clock=sec=>{sec=Math.ceil(sec);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');};
  // Reagent names as they read inside a sentence.
  const PHRASE={DIL:'dilution buffer',AG:'the 100 µg/mL antigen stock',POS:'positive control',NEG:'negative control',AB1:'primary antibody',AB2:'secondary antibody',TMB:'TMB substrate',STOP:'stop solution'};
  const reagentPhrase=id=>PHRASE[id]||(id==='P1'||id==='P2'?'patient '+id.slice(1)+' sample ('+p.patients[+id.slice(1)-1]+')':id);
  function nextText(){
    const a=p.recommend();if(!a)return 'Run complete. Open the notebook and interpret the strips.';
    if(a.type==='wait')return 'Incubating… '+clock(p.timer.remaining)+' of simulated time left.';
    const need=needTool(a),tool=control.tool,mixing=p.phase==='serial'&&p.serialMixWell===a.target,cycle=mixing?' (mix '+(p.well(a.target).mixes+1)+' of 5)':'';
    // Each task is an imperative clause, so it reads naturally on its own or after "pick up …, then".
    const task={label:'label well '+a.target+' by sweeping the marker across its label pad',attach:'fit a fresh tip from the tip rack',eject:'eject the used tip into the waste',
      aspirate:typeof a.target==='number'?'draw 50 µL from well '+a.target:'draw 50 µL of '+reagentPhrase(a.target),
      dispense:mixing?'return the 50 µL to well '+a.target+cycle:'deliver 50 µL into well '+a.target,
      mix:'mix well '+a.target+': draw 50 µL back up'+cycle,discard:'discard the 50 µL from well 12 into the liquid waste',
      loadWash:'fill the transfer pipette from the wash-buffer beaker',wash:'fill well '+a.target+' with wash buffer',
      drain:'invert strip '+nextStrip()+' and tap it on the paper towels four times',mixStop:'tap upright strip '+nextStrip()+' on the paper towels four times to mix',incubate:'start the 5-minute incubation timer'}[a.type]||'continue';
    const cap=s=>s[0].toUpperCase()+s.slice(1)+'.';
    if(tool.startsWith('strip')&&control.tapDone)return 'Put strip '+tool.slice(-1)+' back in its place on the sheet.';
    if(need&&tool!==need){
      if(tool!=='navigate')return 'Put away '+TOOL_LABEL[tool]+' at '+PLACE[tool]+(need==='navigate'?', then '+task+'.':', then pick up '+TOOL_LABEL[need]+'.');
      return 'Pick up '+TOOL_LABEL[need]+', then '+task+'.';
    }
    return cap(task);
  }
  function extraText(){
    if(p.phase==='label')return p.labels.length+' / 24 wells labeled';
    if(p.phase==='serial')return p.serialMixWell?'Well '+p.serialMixWell+' · '+p.well(p.serialMixWell).mixes+' / 5 mixing cycles':'Next transfer: '+p.serialFrom+' → '+(p.serialFrom+1);
    if(p.phase.startsWith('wash'))return (p.needDrain?'Drain both strips':p.washFilled.length+' / 24 wells washed')+' · '+p.washCount+' / 2 washes';
    if(p.timer)return 'Incubating · '+clock(p.timer.remaining)+' left';
    const left=p.remainingWells().length;return left?left+' receiving wells remaining':p.phase==='read'?'Run complete':'';
  }
  function renderBeacon(){const id=hintsOn&&running()?nextTargetId():null;s.setBeacon(findTarget(id));markDirty();}

  function renderContact(){
    if(!control)return;const t=control.contact?.target||control.target,tool=control.tool,tip=p.tip;
    document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
    $('toolName').textContent={navigate:'NO TOOL HELD',micro:'MICROPIPETTE / 50 µL',wash:'TRANSFER PIPETTE',marker:'FINE-TIP MARKER',strip1:'STRIP 1',strip2:'STRIP 2'}[tool];
    $('contactName').textContent=t?.label||(tool==='navigate'?'Explore the workbench':'Aim at a target');
    $('loadTitle').textContent=tool==='marker'?'Labels':tool.startsWith('strip')?(control.inverted?'Inverted':'Upright'):tool==='wash'?'In the pipette':'In the tip';
    $('loadVolume').textContent=tool==='marker'?p.labels.length+' / 24':tool.startsWith('strip')?(control.tapDone?'Done':control.taps+' / 4 taps'):tool==='wash'?Math.round(p.washVolume)+' / 1320 µL':(tip?.volume||0)+' / 50 µL';
    $('contactFill').style.width=(control.contact?.depth||0)*100+'%';
    const quantity=t?.kind==='reagent'?p.reagents[t.id].volume:t?.kind==='well'?p.well(t.id).volume:t?.id==='WASH'?p.reagents.WASH.volume:null;
    $('targetLiquid').hidden=quantity===null;
    if(quantity!==null){const max=t.kind==='reagent'?REAGENTS[t.id].volume:t.kind==='well'?300:REAGENTS.WASH.volume;$('targetLiquidName').textContent=t.kind==='well'?'In the well':t.id==='WASH'?'Wash buffer left':REAGENTS[t.id].short+' left';$('targetVolume').textContent=(t.id==='WASH'?(quantity/1000).toFixed(1)+' mL':Math.round(quantity)+' µL');$('targetLiquidFill').style.width=clamp(quantity/max,0,1)*100+'%';}
    $('contactState').textContent=!control.contact?'Contact depth · schematic':tool==='marker'?(control.contact.depth>=.5?'Nib on the pad · stroke sideways':'Pad locked · lower to touch'):tool.startsWith('strip')?'Towels locked · lower to tap':control.contact.depth>=.85?'Tip immersed · schematic':'Opening locked · lower to insert';
    $('tipInfo').textContent=tool==='micro'?(tip?(tip.reagent?'Tip used · '+(p.reagents[tip.reagent]?.short||'serial dilution'):'Fresh tip fitted'):'No tip fitted'):tool==='wash'?'Dedicated wash-buffer pipette':tool==='marker'?'Sweep across each label pad':tool.startsWith('strip')?(p.phase==='mixstop'?'Keep upright to mix':'Invert to drain'):'Pick up a tool to begin.';
    $('tapMeter').hidden=!tool.startsWith('strip');
    $('tapDots').replaceChildren(...Array.from({length:4},(_,i)=>{const el=document.createElement('span');el.className='mix-dot'+(control.taps>i||control.tapDone?' done':'');el.textContent=control.taps>i||control.tapDone?'✓':String(i+1);return el;}));
    const label=$('targetLabel');label.hidden=!t;
    if(t){r.root.update();const loc=r.project(s.position(t));label.hidden=loc.z<0||loc.z>1||!!control.contact;label.textContent=t.label+(t.kind==='well'?' · '+p.well(t.id).volume+' µL':'');label.style.left=clamp(loc.x,70,canvas.clientWidth-70)+'px';label.style.top=clamp(loc.y+20,40,canvas.clientHeight-120)+'px'; /* below the target, clear of the descending tip */}
    $('interactionHint').textContent=camera?.running?'Hand control is on. Follow the instruction in the Hand control panel.':!started?'Choose your patients and start the lab. You can look around the bench while you do.':status!=='running'?'Experiment '+status+'. Choose Run at the top to continue.':
      control.pending?.kind==='draw'?(control.contact?.depth>=.85?'Tip immersed. Release to draw.':'Keep holding and move down to insert.'):
      tool==='micro'?(!tip?'Aim at the marked unused tip, hold and move down to fit it.':tip.volume?'Aim at the receiving well, hold and move down to deliver 50 µL.':'Hold, lower into the source, then release to draw 50 µL.'):
      tool==='wash'?(p.washVolume?'Hold over a well and move down to deliver wash buffer.':'Hold, lower into the beaker, then release to fill.'):
      tool==='marker'?'Hold the left button and sweep across a label pad.':tool.startsWith('strip')?(p.phase==='mixstop'?'Keep the strip upright. Hold over the towels and move down and up four times.':'Right-click to invert the strip, then hold over the towels and move down and up four times.'):
      'Pick up a tool from the bench or the dock. Right-drag: sideways pans, up/down tilts. The wheel zooms.';
    renderCamGuide();
  }

  function renderUI(){
    const [num,title,detail,source]=p.meta,idx=PHASES.indexOf(p.phase);
    if(p.phase!==lastPhase){
      if(lastPhase&&idx>PHASES.indexOf(lastPhase)){const done=META[lastPhase][1];setTimeout(()=>say('✓ '+done+' done. Next: '+title+'.','success'),0);$('nextAction').classList.remove('flash');void $('nextAction').offsetWidth;$('nextAction').classList.add('flash');}
      lastPhase=p.phase;$('stepBody').scrollTop=0;
    }
    $('setupDialog').hidden=started;$('stepCard').hidden=!started;document.querySelector('.contact').hidden=!started;
    $('stepNumber').textContent=num;$('stepEyebrow').textContent='Step '+Number(num)+' of '+PHASES.length;$('stepTitle').textContent=title;
    $('nextAction').textContent=nextText();$('stageExtra').textContent=extraText();$('stepDetail').textContent=detail;$('stepSource').textContent='Manual '+source;
    $('locateBtn').hidden=!nextTargetId();
    if(p.phase!==lastStages){lastStages=p.phase;$('stages').replaceChildren(...PHASES.map((phase,i)=>{const li=document.createElement('li');li.title=META[phase][0]+' · '+META[phase][1];li.className=i<idx?'done':i===idx?'current':'';return li;}));}
    const incubation=['incubate1','incubate2','incubate3','develop'].includes(p.phase);
    $('timerBox').hidden=!incubation;$('timerDigits').textContent=clock(p.timer?.remaining??300);
    $('timerStart').disabled=!!p.timer||!running();$('timerStart').textContent=p.timer?'Incubating…':'Start the 5-minute incubation';
    $('readBox').hidden=!(p.phase==='read'&&$('notebook').hidden);
    $('notebookBtn').classList.toggle('attention',p.phase==='read'&&$('notebook').hidden);
    $('runInline').hidden=status==='running';
    $('runBtn').disabled=status==='running';$('pauseBtn').disabled=status==='paused';$('stopBtn').disabled=status==='stopped';
    $('runStatus').textContent=status==='running'?(p.timer?'Incubation clock running · '+readClockSpeed()+'×':'Ready · '+p.tipCount+' tips used'):status==='paused'?'Paused · choose Run to continue':'Stopped · choose Run to continue';
    renderSetup();renderTargetAction();renderContact();renderBeacon();
  }

  // Set-up panel: choose patients and confirm PPE, then it is gone for the run.
  function renderSetup(){
    $('ppe').closest('.check-row').classList.toggle('ok',$('ppe').checked);$('ppeConfirm').textContent=$('ppe').checked?'✓ Wearing them':'I’m wearing them';
    $('prepareBtn').disabled=!$('ppe').checked;$('prepareBtn').title=$('ppe').checked?'':'Confirm your protective equipment first';
    for(const id of ['patient1','patient2'])$(id).disabled=p.log.length>0;
  }
  $('ppe').onchange=renderSetup;
  for(const id of ['patient1','patient2'])$(id).onchange=()=>{if(!p.log.length)newRun(false);};
  $('prepareBtn').onclick=()=>{started=true;status='running';renderUI();refit();setTimeout(()=>say('Bench ready. Follow the step card at the top left.','success'),0);};

  // Targets panel: every action through individual, checked controls.
  function buildTargets(){
    const select=$('targetSelect');select.replaceChildren();
    for(const [name,test] of [['Tools & stations',t=>['tool','strip','timer','tips','waste','wash','towels','stand','home'].includes(t.kind)],['Reagents',t=>t.kind==='reagent'],['Wells',t=>t.kind==='well'],['Label pads',t=>t.kind==='label']]){
      const group=document.createElement('optgroup');group.label=name;
      for(const t of s.targets.filter(test)){const option=document.createElement('option');option.value=String(t.id);option.textContent=t.label;group.append(option);}
      select.append(group);
    }
  }
  const selectedTarget=()=>{const v=$('targetSelect').value;return findTarget(/^\d+$/.test(v)?Number(v):v);};
  function targetPlan(t){
    if(!t)return null;const a=p.recommend();
    if(t.kind==='tool')return {label:'Pick up '+t.label.toLowerCase(),tool:null};
    if(t.kind==='strip')return {label:'Pick up '+t.label.replace(' grip tab','').toLowerCase(),tool:null};
    if(t.kind==='stand'||t.kind==='home')return {label:'Put the held tool away here',tool:null};
    if(t.id==='timer')return {label:'Start the incubation timer',tool:'navigate',action:{type:'incubate'}};
    if(t.kind==='label')return {label:'Write label '+t.id.slice(5),tool:'marker',action:{type:'label',target:+t.id.slice(5)}};
    if(t.id==='towels'){const n=nextStrip(),mix=p.phase==='mixstop';return {label:(mix?'Tap upright strip ':'Invert and drain strip ')+n,tool:'strip'+n,action:{type:mix?'mixStopStrip':'drainStrip',target:n}};}
    if(t.id==='WASH')return {label:'Fill the transfer pipette',tool:'wash',action:{type:'loadWash',target:'WASH'}};
    if(t.kind==='well'&&p.phase.startsWith('wash'))return {label:'Fill well '+t.id+' with wash buffer',tool:'wash',action:{type:'wash',target:t.id}};
    if(t.kind==='tips')return {label:'Fit one fresh tip',tool:'micro',action:{type:'attach',target:'tips'}};
    if(t.kind==='waste')return {label:p.tip?.volume?'Discard the aliquot into waste':'Eject the tip into waste',tool:'micro',action:{type:p.tip?.volume?'discard':'eject',target:'waste'}};
    if(t.kind==='well'&&a?.type==='mix'&&a.target===t.id)return {label:'Mix well '+t.id+' (one cycle)',tool:'micro',action:{type:'mix',target:t.id}};
    return p.tip?.volume?{label:'Deliver 50 µL',tool:'micro',action:{type:'dispense',target:t.id}}:{label:'Draw 50 µL',tool:'micro',action:{type:'aspirate',target:t.id}};
  }
  function renderTargetAction(){const plan=targetPlan(selectedTarget());$('targetAction').textContent=plan?.label||'Use target';$('targetAction').disabled=!running()||!plan;$('targetNext').disabled=!nextTargetId();}
  $('targetSelect').onchange=()=>{cancel();control.setTarget(selectedTarget());renderTargetAction();renderContact();};
  $('targetAction').onclick=()=>{
    useMouse();cancel();const t=selectedTarget(),plan=targetPlan(t);if(!plan)return;
    if(t.kind==='tool'||t.kind==='strip'){control.select('navigate');control.activate(t,'accessible');sync();return;}
    if(t.kind==='stand'||t.kind==='home'){control.select('navigate');sync();return;}
    if(plan.tool&&control.tool!==plan.tool)control.select(plan.tool);
    if(plan.action.type==='drainStrip'||plan.action.type==='mixStopStrip'){control.inverted=plan.action.type==='drainStrip';}
    if(control.tryCommit(plan.action,'accessible')&&plan.action.type==='label')s.mark(plan.action.target,[[0,0],[40,-2]]);
    control.setTarget(t);markDirty(true);
  };
  $('targetNext').onclick=()=>{const id=nextTargetId();if(id==null)return;$('targetSelect').value=String(id);$('targetSelect').dispatchEvent(new Event('change'));$('targetAction').focus();};
  function toggleTargets(open=$('targetsPanel').hidden){$('targetsPanel').hidden=!open;$('targetsBtn').classList.toggle('on',open);$('targetsBtn').setAttribute('aria-expanded',String(open));if(open){const id=nextTargetId();if(id!=null)$('targetSelect').value=String(id);renderTargetAction();$('targetSelect').focus();}}
  $('targetsBtn').onclick=()=>toggleTargets();$('closeTargets').onclick=()=>toggleTargets(false);

  function locate(){
    const t=findTarget(nextTargetId());
    if(t){control.setTarget(t);$('targetSelect').value=String(t.id);renderContact();renderTargetAction();setViewButtons('auto');framer.manual=false;framer.update(p,{force:true,extra:[s.position(t)]});say('Here: '+t.label+'.');}
    else say(nextText());
  }
  $('locateBtn').onclick=locate;
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{useMouse();if(!running()){say('Choose Run to continue.','error');return;}control.select(b.dataset.tool);markDirty(true);});
  $('returnTool').onclick=()=>{useMouse();control.select('navigate');sync();};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>preset(b.dataset.view));
  $('timerStart').onclick=()=>{cancel();if(!p.timer)control.tryCommit({type:'incubate'},'mouse');};
  $('clockSpeed').onchange=()=>{if(timerClock.running())timerClock.changeSpeed();renderUI();};
  $('runInline').onclick=()=>$('runBtn').click();
  for(const type of ['run','pause','stop'])$(type+'Btn').onclick=()=>{tickClock();cancel();if(type!=='run')camera.stop();status=type==='run'?'running':type==='pause'?'paused':'stopped';tickClock();renderUI();};
  $('graphicsQuality').onchange=e=>{try{r.setQuality(e.target.value);setPref(GRAPHICS_KEY,e.target.value);}catch(err){say('This graphics setting is not available: '+err.message,'error');}markDirty(true);};
  $('hintsToggle').onchange=e=>{hintsOn=e.target.checked;setPref(HINTS_KEY,hintsOn?'1':'0');renderBeacon();};

  // Menus: one open at a time; outside clicks and Escape close them.
  const menus=[['menuBtn','labMenu'],['cameraMenuBtn','cameraMenu']];
  function closeMenus(except){for(const [b,m] of menus)if(m!==except){$(m).hidden=true;$(b).setAttribute('aria-expanded','false');}}
  for(const [b,m] of menus)$(b).onclick=e=>{e.stopPropagation();const open=$(m).hidden;closeMenus(m);$(m).hidden=!open;$(b).setAttribute('aria-expanded',String(open));if(open)$(m).querySelector('button,select,input')?.focus();};
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.menu,#menuBtn,#cameraMenuBtn'))closeMenus();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});

  function newRun(ask=true){
    if(ask&&p.log.length&&!confirm('Start a fresh experiment? Current actions and observations will be cleared.'))return;
    closeMenus();camera.stop();cancel();timerClock.reset();
    p=new Protocol($('patient1').value,$('patient2').value);mistakes=[];observations={};$('observations').value='';control.stats={cancelled:0,rejected:0,transfers:0};
    r.disposeMeshes();s=new ClassroomScene(r,p);control.tool='navigate';control.target=null;control.inverted=false;control.taps=0;control.tapDone=false;buildTargets();
    $('lastMistake').hidden=true;lastPhase=null;lastStages='';status='running';if(ask){started=false;$('ppe').checked=false;}
    if(!$('notebook').hidden)toggleNotebook(false);framer.key=null;setViewButtons('auto');sync();if(ask)say('Fresh workcell. Choose your patients to begin.');
  }
  $('resetBtn').onclick=()=>newRun(true);
  $('resetLayoutBtn').onclick=()=>{closeMenus();ClassroomPanels.resetAll();notebookDock.reset();say('Panels are back in their original places.');};

  // Webcam hand control with a live "do this now" guide below the video.
  let camError=false,pinchSeen=false;
  const handSettings=()=>globalThis.ClassroomHandTuning?.get?.()||{mode:'thumb',assist:true};
  camera=new ClassroomWebcam({video:$('cameraVideo'),overlay:$('cameraOverlay'),mode:handSettings().mode,bounds:()=>({width:canvas.clientWidth,height:canvas.clientHeight}),
    active:on=>{$('handBtn').classList.toggle('on',on);$('cameraStart').textContent=on?'Stop camera':'Start camera';$('restBtn').disabled=!on;$('pressBtn').disabled=!on||!camera?.profiles.rest;$('centreBtn').disabled=!on;if(!on){$('handCursor').style.display='none';pinchSeen=false;}renderCamGuide();},
    status:(message,error)=>{$('cameraStatus').textContent=message;$('cameraStatus').style.color=error?'#994f3c':'';camError=!!error;renderCamGuide();},
    lost:()=>{control.resetMotion();$('handCursor').style.display='none';handSeen=0;markDirty(true);renderCamGuide();},
    home:()=>renderCamGuide(),
    calibration:profiles=>{$('restBtn').textContent=profiles.rest?'✓ Rest saved':'Capture Rest';$('pressBtn').textContent=profiles.press?'✓ Press saved':'Capture Press';$('pressBtn').disabled=!profiles.rest;renderCamGuide();},
    frame:f=>{
      handSeen=performance.now();if(modal||!running())return;control.feed(f);
      /* While a target is locked the cursor sits on it and fills with the insertion depth. */
      const c=$('handCursor'),locked=control.contact?.target;c.style.display='block';c.classList.toggle('pressed',!!f.thumbDown);c.classList.toggle('locked',!!locked);c.classList.toggle('aiming',!locked&&!!control.target);
      if(locked){r.root.update();const q=r.project(s.position(locked));c.style.left=q.x+'px';c.style.top=q.y+'px';c.style.setProperty('--depth',String(Math.min(1,(control.contact.depth||0)/.85)));}
      else{c.style.left=f.x+'px';c.style.top=f.y+'px';}
      if(handSeen-guideTick>150){guideTick=handSeen;renderCamGuide();}
    },
    edge:(edge,f)=>{if(edge==='press'&&f.pinch&&!pinchSeen){pinchSeen=true;renderCamGuide();}if(modal||!running())return;edge==='press'?control.press(f):control.release(f);},
    meter:(f,stats,name)=>{$('thumbFill').style.width=f.thumbDepth*100+'%';$('cameraStats').textContent=name+' · '+Math.round(stats.inferenceMS)+' ms inference · '+Math.round(stats.ageMS)+' ms frame age';}
  });
  function applyHandMode(){
    const mode=camera.mode;
    document.querySelectorAll('.cam-steps [data-mode]').forEach(li=>li.hidden=li.dataset.mode!==mode);
    document.querySelectorAll('.gestures [data-pinch]').forEach(el=>el.textContent=el.dataset[mode]);
    $('plungerLabel').textContent=mode==='pinch'?'Pinch':'Thumb';
  }
  function renderCamGuide(){
    if(!camera||$('cameraPanel').hidden)return;
    const pinch=camera.mode==='pinch',on=camera.running,prof=camera.profiles||{},tip=p.tip,tool=control.tool,t=control.contact?.target||control.target,seen=performance.now()-handSeen<600;
    const stepState=pinch?{start:on,hand:on,centre:!!camera.home,pinch:pinchSeen}:{start:on,hand:on,rest:!!prof.rest,press:!!prof.press};
    const order=pinch?['start','centre','pinch']:['start','rest','press'],now=order.find(k=>!stepState[k]);
    document.querySelectorAll('.cam-steps li').forEach(li=>{li.classList.toggle('done',!!stepState[li.dataset.cs]);li.classList.toggle('now',li.dataset.cs===now);});
    $('pinchTry').textContent=pinchSeen?'✓ Pinch detected':'Try a pinch';
    const nextLabel=()=>findTarget(nextTargetId())?.label||'the next target';
    const press=pinch?'pinch':'press your thumb',grab=pinch?'🤏':'✊',squeeze=tool==='wash'?(pinch?'pinch the bulb':'squeeze the bulb with your thumb'):(pinch?'pinch':'press the plunger');
    let icon='📷',text='Start the camera. Keep your whole hand in view, about an arm’s length from the screen.',g=null,badge=['Off',''],warn=false;
    const stand=STAND_OF[tool],needAway=stand&&nextTargetId()===stand;
    if(camError&&!on){icon='⚠️';text=$('cameraStatus').textContent||'The camera could not start. Mouse controls still work.';badge=['Error','warn'];warn=true;}
    else if(on&&!seen){icon='🖐';text='Show your working hand to the camera, palm facing the screen.';badge=['No hand','warn'];warn=true;}
    else if(on&&!pinch&&!prof.rest){icon='✋';text='Hold a relaxed pipette grip, thumb resting, then press Capture Rest.';badge=['Calibrate','warn'];}
    else if(on&&!pinch&&!prof.press){icon='👍';text='Keep the grip, press your thumb fully down, then press Capture Press.';badge=['Calibrate','warn'];}
    else if(on&&pinch&&!camera.home){icon='✋';text='Hold your hand where it feels comfortable. That spot becomes the centre of the bench.';badge=['Centring',''];}
    else if(on){
      badge=['On','on'];
      if(!running()){icon='⏸';text=started?'Choose Run at the top to use your hand.':'Start the lab first (set-up panel).';}
      else if(tool==='navigate'){icon=grab;text=(pinch?'Pinch over ':'Close your grip over ')+nextLabel()+' and hold to pick it up.';g='grab';}
      else if(needAway){icon='🖐';text='Put the '+{micro:'micropipette',wash:'transfer pipette',marker:'marker',strip1:'strip',strip2:'strip'}[tool]+' away: move it to '+(findTarget(stand)?.label.toLowerCase()||'its stand')+' and show your open palm there.';g='return';}
      else if(tool==='marker'){icon='✍';g=control.contact?'write':'lock';text=!control.contact?'Pause over '+nextLabel().toLowerCase()+' until its ring turns gold.':control.contact.depth<.5?'Lower your hand until the nib touches the pad.':'Now make a short sideways stroke across the pad.';}
      else if(tool.startsWith('strip')){
        const mix=p.phase==='mixstop';icon=mix?'🎯':'🔄';g=control.contact?'insert':mix?'lock':'invert';
        text=!mix&&!control.inverted?'Turn your palm over to invert the strip, then pause over the paper towels.':control.contact?'Lower your hand to tap the strip on the towels, then lift. Tap '+Math.min(4,control.taps+1)+' of 4.':'Pause over the paper towels until their ring turns gold.';
      }
      else if(control.pending?.kind==='bubbles'){icon='⚠️';warn=true;text='Bubbles! Keep it pressed, lift the tip out of the liquid, lower back in, then '+(pinch?'let go':'release slowly')+' to draw.';g='draw';}
      else if(control.pending?.kind==='armed'&&!control.contact){icon=pinch?'🤏':'👍';text='Keep it pressed. Pause over '+nextLabel()+' until it locks, then lower your hand.';g='lock';}
      else if(control.pending?.kind==='draw'){icon=pinch?'🤏':'👍';text=control.contact?.depth>=.85?(pinch?'Let go of the pinch slowly to draw.':'Release slowly to draw.'):'Keep it pressed and lower your hand into the liquid.';g='draw';}
      else if(control.contact){
        // Real technique: press before an empty tip enters the liquid; release inside to draw (this is also how mixing works).
        const deep=control.contact.depth>=.85,liquid=['reagent','well','wash'].includes(t?.kind),down=control.pressed,loaded=tool==='wash'?p.washVolume>0&&t?.kind==='well':!!tip?.volume;
        icon=loaded?'💧':'⤓';g=deep?(loaded?'deliver':'draw'):'insert';
        if(t?.kind==='tips')text=deep?'The tip fits when you are fully down.':'Lower your hand to seat the tip.';
        else if(!deep)text='Locked on '+(t?.label||'the target')+'. '+(!loaded&&liquid&&!down?'Now '+squeeze+', before the tip enters the liquid, then lower.':'Lower your hand to insert, or slide sideways to leave.');
        else if(loaded)text=(pinch?'Pinch':'Press')+' to deliver.';
        else if(down&&liquid)text=p.phase==='serial'?'To mix, release slowly to draw the liquid back up, or lift out first.':'Lift the tip away, then release.';
        else text=liquid?'Press before the tip enters the liquid: lift out, '+squeeze+', lower back in, then release.':'Lift the tip away.';
      }
      else if(tool==='micro'&&!tip){icon='🎯';text='Pause over the glowing fresh tip until it locks, then lower your hand.';g='lock';}
      else{icon='🎯';text='Pause over '+nextLabel()+' until its ring turns gold. Wells you pass over do not lock.';g='lock';}
    }
    $('camGuideIcon').textContent=icon;$('camGuideText').textContent=text;$('camGuide').classList.toggle('warn',warn);
    const b=$('cameraBadge');b.textContent=badge[0];b.className='state-badge'+(badge[1]?' '+badge[1]:'');
    document.querySelectorAll('.gestures li').forEach(li=>li.classList.toggle('now',li.dataset.g===g));
  }
  $('handBtn').onclick=()=>{const open=$('cameraPanel').hidden;$('cameraPanel').hidden=!open;if(!open)camera.stop();$('handBtn').classList.toggle('on',open&&camera.running);applyHandMode();renderCamGuide();};
  $('cameraStart').onclick=()=>{if(camera.running)camera.stop();else if(running()){cancel();camError=false;camera.start();}else say(started?'Choose Run before starting hand control.':'Start the lab first.','error');renderCamGuide();};
  $('closeCamera').onclick=()=>{camera.stop();$('cameraPanel').hidden=true;};
  $('centreBtn').onclick=()=>{cancel();if(camera.setHome())say('Centre set. Small hand movements now cover the bench.','success');renderCamGuide();};
  $('restBtn').onclick=()=>{cancel();camera.capture('rest');};$('pressBtn').onclick=()=>{cancel();camera.capture('press');};$('workingHand').onchange=e=>camera.setPreference(e.target.value);
  window.addEventListener('classroom-hand-settings',()=>{cancel();const mode=handSettings().mode;if(mode!==camera.mode){camera.setMode(mode);pinchSeen=false;applyHandMode();}else camera.lost();renderCamGuide();});
  applyHandMode();

  // Notebook: docked beside the scene so the strips stay visible while they are read.
  function renderNotebook(){
    const done=p.phase==='read';
    $('notebookNotice').textContent=done?'Run complete. Describe the controls and estimate the patient concentrations.':'Assay in progress. These are live wells; the standard concentrations below are theoretical.';
    $('wellPreview').innerHTML=[0,1].map(k=>'<div class="wells-preview">'+p.wells.slice(k*12,k*12+12).map(w=>{const a=p.wellSignal(w.id);return `<span title="Well ${w.id} · ${w.volume} µL" style="background:rgb(${232-a*224},${239-a*83},${232-a*54})">${w.id}</span>`;}).join('')+'</div>').join('');
    $('standardTable').innerHTML=Array.from({length:12},(_,i)=>`<tr><td>${i+1}</td><td>${i?'1:'+2**i:'Stock'}</td><td>${Number(standard(i+1).toPrecision(5))}</td></tr>`).join('');
    const keep=document.activeElement?.dataset?.estimate;
    if(keep===undefined)$('estimateFields').innerHTML=p.patients.map((name,i)=>`<label class="field">${name}: estimated µg/mL<input type="number" min="0" step="any" data-estimate="${i}" value="${Number.isFinite(observations[i])?observations[i]:''}"></label>`).join('');
    document.querySelectorAll('[data-estimate]').forEach(input=>input.oninput=()=>{const v=Number(input.value);observations[input.dataset.estimate]=input.value!==''&&Number.isFinite(v)&&v>=0?v:null;});
    $('teacherKey').textContent=p.patients.map(n=>n+': '+PATIENTS[n]+' µg/mL (kit table)').join('; ');
    $('runInfo').textContent=`${p.log.length} checked events · ${p.tipCount} tips used · volume balance error ${p.massBalance().toFixed(6)} µL · cancelled strokes ${control.stats.cancelled} · corrections ${mistakes.length}.`;
    $('actionLog').innerHTML=p.log.slice(-16).map(a=>`<tr><td>${a.n}</td><td>${a.action}</td><td>${a.target??'—'}</td><td>${a.input||'timer'}</td></tr>`).join('');
    $('correctionLog').innerHTML=mistakes.slice(-8).reverse().map(m=>`<li>${m.message.replace(/</g,'&lt;')}</li>`).join('');
  }
  const notebookDock=ClassroomPanels.edgeResize($('notebook'),$('notebookResize'),'notebook-width',{min:340,maxFraction:.7});
  // Keep the dock, hint and messages in the free area beside the docked notebook.
  new ResizeObserver(()=>stage.style.setProperty('--notebook-width',$('notebook').getBoundingClientRect().width+'px')).observe($('notebook'));
  function toggleNotebook(open=$('notebook').hidden){
    $('notebook').hidden=!open;$('notebookBtn').setAttribute('aria-expanded',String(open));stage.classList.toggle('with-notebook',open);
    if(open){camera.stop();cancel();renderNotebook();}
    renderUI();r.resize();framer.update(p,{force:true});markDirty(true);
  }
  $('notebookBtn').onclick=()=>toggleNotebook();$('closeNotebook').onclick=()=>toggleNotebook(false);$('openNotebookBtn').onclick=()=>toggleNotebook(true);
  function openDialog(id){camera.stop();cancel();closeMenus();modal=true;$(id).showModal();}
  $('helpBtn').onclick=()=>openDialog('helpDialog');
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>{modal=false;cancel();}));
  function exportRun(){
    const out={...p.summary(),page:'elisa-3d-classroom',interactionVersion:'classroom-v3',limitations:{fixedDoseUL:DOSE,physicalDepthMeasured:false,forceMeasured:false,blowoutSimulated:false,webcamHumanValidated:false},corrections:mistakes,inputDiagnostics:{...control.stats,camera:{...camera.stats}},observations:$('observations').value,patientEstimates:observations};
    const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='elisa-3d-run.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  $('exportBtn').onclick=()=>{closeMenus();exportRun();};$('exportNotebook').onclick=exportRun;

  // Floating panels: drag by the header, resize from any corner, collapse; layout is remembered.
  const {FloatingPanel}=ClassroomPanels;
  const stepPanel=new FloatingPanel($('stepCard'),{key:'step',minW:280,autoHeight:true});
  new FloatingPanel(document.querySelector('.contact'),{key:'contact',minW:190,autoHeight:true});
  new FloatingPanel($('targetsPanel'),{key:'targets',minW:240,autoHeight:true});
  new FloatingPanel($('setupDialog'),{key:'setup',minW:320,autoHeight:true});
  new FloatingPanel($('cameraPanel'),{key:'camera',minW:280,minH:300});
  ClassroomPanels.watchStage(stage);
  $('stepCollapse').onclick=()=>stepPanel.setCollapsed(!$('stepCard').classList.contains('collapsed'));

  window.addEventListener('blur',()=>{cancel();camera.lost();});
  document.addEventListener('visibilitychange',()=>{cancel();if(document.hidden)camera.stop();else tickClock();});window.addEventListener('pagehide',()=>camera.stop());
  new ResizeObserver(()=>{cancel();r.resize();if(!framer.manual)framer.update(p,{force:true});markDirty(true);}).observe(canvas);
  setInterval(()=>framer.retry(p),500); // deferred framing (busy stroke, collapsed canvas) resumes when possible
  let lastAnimation=performance.now(),lastDraw=0;
  function loop(now){
    requestAnimationFrame(loop);
    if(document.hidden){lastAnimation=now;return;}
    if(now-lastDraw>32){
      const dt=Math.min(.10,Math.max(0,(now-lastAnimation)/1000));lastAnimation=now;
      if(s.animate(reduced()?1:dt,p)){dirty=true;if(control.contact)s.pose(control,control.lastFrame,p);}
      if(framer.step(now))dirty=true;
      if(dirty){r.render();dirty=false;}lastDraw=now;
    }
  }
  buildTargets();renderUI();s.sync(p,true);framer.update(p);$('loading').hidden=true;requestAnimationFrame(loop);setInterval(tickClock,100);
  // Readable diagnostics for verification. There is no learner-facing skip or bulk-transfer path.
  window.ELISAClassroom={get protocol(){return p;},get interaction(){return control;},get scene(){return s;},get framer(){return framer;},get status(){return status;},get started(){return started;},start(){$('ppe').checked=true;renderSetup();$('prepareBtn').click();},renderer:r,camera,timerClock,preset,targetAt,targetScreen,nextTargetId,renderUI,refresh(){s.sync(p);renderUI();markDirty(true);}};
})();
