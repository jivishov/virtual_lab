(async function(){
  'use strict';
  const $=id=>document.getElementById(id),{Protocol,PHASES,META}=MicroarrayProtocol,A=MicroarrayAnalysis,{clamp}=ClassroomCore;
  const GRAPHICS_KEY='microarray3d-v3-graphics',HINTS_KEY='microarray3d-v3-hints';
  const session=new MicroarraySession.Session();
  let p=new Protocol(),r,s,control,camera,framer,pointer=null,dirty=true,toastTimer=null,lastClock=performance.now(),modal=false,lastPhase=null,lastStages='';
  let mistakes=[],notebook=A.emptyNotebook(),questionList=A.questions(p.rows),activeMS={},saveTimer=null,lastSaveTick=0,setupPage=1,handSeen=0,guideTick=0;
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
  try{r=new E3D.Renderer(canvas,quality);r.resize();s=new MicroarrayScene(r,p);}
  catch(e){$('loadingText').textContent='The 3D workbench could not start: '+e.message;$('fallbackLink').hidden=false;return;}

  // Screen position and pick radius of a target. Hand input gets larger hit areas.
  function targetScreen(t,hand=true){
    const point=s.position(t),q=r.project(point),edge=r.project(E3D.V.add(point,[t.radius,0,0]));
    return {x:q.x,y:q.y,z:q.z,r:Math.max(hand?22:t.kind==='well'||t.kind==='spot'?11:14,Math.hypot(q.x-edge.x,q.y-edge.y)*(hand?1.5:1))};
  }
  // The target under the cursor always wins. opts.prefer keeps the current hand target until the aim is clearly
  // nearer another one, so the choice does not flicker on a boundary. Aim assist only fills empty space: when
  // no target is under the cursor it snaps to the next expected target nearby. It never performs an action.
  function targetAt(x,y,filter,source,opts={}){
    r.root.update();r.updateCamera();const hits=[],hand=source==='hand';
    for(const t of s.targets){
      if(!filter(t))continue;
      if((t.kind==='spot'||t.kind==='card')&&p.cardLocation==='held')continue;
      const q=targetScreen(t,hand);if(q.z<0||q.z>1)continue;
      const distance=Math.hypot(x-q.x,y-q.y)/q.r;if(distance<1)hits.push({t,distance:hand&&t.id===opts.prefer?distance*.72:distance});
    }
    hits.sort((a,b)=>a.distance-b.distance);if(hits[0])return hits[0].t;
    if(hand&&handSettings().assist!==false){
      let id=nextTargetId();if(id&&control.tool==='view'&&!['card','plate','bench','incubator','uv'].includes(id))id='pipette';
      const nt=id&&s.targets.find(t=>t.id===id);
      if(nt&&filter(nt)&&!((nt.kind==='spot'||nt.kind==='card')&&p.cardLocation==='held')){const q=r.project(s.position(nt));if(q.z>=0&&q.z<=1&&Math.hypot(x-q.x,y-q.y)<76)return nt;}
    }
    return null;
  }

  // Corrections: logged for the debrief and shown in the step card until the next successful action.
  function reject(action,e,source){
    const code=A.categoryOf(e.code);
    mistakes.push({code,message:e.message,phase:p.phase,action:action?.type||null,target:action?.target??null,sample:p.phase==='samples'?p.currentSample:null,source,at:Date.now()});
    if(mistakes.length>500)mistakes.splice(0,mistakes.length-500);
    const cat=A.CATEGORIES[code];
    if(['technique','procedure'].includes(cat.group)){$('lastMistake').hidden=false;$('lastMistakeText').textContent=e.message;$('lastMistakeHint').textContent=cat.label+' · '+cat.hint;}
    if(code==='analysis'){const box=action?.type==='finish'?'genesFeedback':'controlsFeedback';$(box).textContent=e.message;$(box).className='error';}
    scheduleSave();
  }
  $('dismissMistake').onclick=()=>{$('lastMistake').hidden=true;refit();};

  // Save/resume.
  function snapshot(){return {protocol:p.serialize(),mistakes,notebook,activeMS,stats:control.stats,clockRate:$('clockSpeed').value,dryMode:$('dryMode').value};}
  function saveNow(){
    clearTimeout(saveTimer);saveTimer=null;if(!p.log.length&&!mistakes.length)return;
    const ok=session.save(snapshot()),el=$('saveStatus');el.classList.toggle('warn',!ok);
    el.textContent=ok?'✓ Saved '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'Not saved in this browser';
    el.title=ok?'Your run is saved in this browser. Nothing is uploaded.':'Saving is unavailable in this browser. Keep this tab open to finish the run.';
  }
  function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,250);}
  session.onOtherTab=()=>say('This lab is open in another tab. Use one tab so saved progress is not overwritten.','error');

  function sync(){
    s.sync(p);markDirty(true);
    if(!$('lastMistake').hidden&&Date.now()-(mistakes.at(-1)?.at||0)>600)$('lastMistake').hidden=true; // a successful action clears the correction
    renderUI();if(!$('notebook').hidden)notes.render();framer?.update(p);scheduleSave();
  }
  control=new MicroarrayInteraction({protocol:()=>p,pick:targetAt,screen:t=>targetScreen(t,true),target:t=>{s.focusTarget(t,!!t&&control?.contact?.target===t);markDirty();},pose:(c,f)=>{s.pose(c,f,p);markDirty(true);},park:tool=>s.park(tool),say,update:renderContact,commit:sync,reject});
  function commit(action,input='button'){return control.commit(action,input);}
  function cancel(reason=''){control.resetMotion(reason);pointer=null;camera?.gate.reset();markDirty(true);}
  function useMouse(){if(camera?.running)camera.stop();}
  function frame(e){const b=canvas.getBoundingClientRect();return{x:e.clientX-b.left,y:e.clientY-b.top,now:performance.now(),source:'mouse',ready:true};}

  // Camera framing avoids every visible panel: split the free stage area around each one and let
  // the framer keep whichever piece shows the working set largest.
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
  framer=new MicroarrayFraming.AutoFrame({camera:()=>r.cam,apply:c=>{if(![...c.at,c.distance,c.pitch,c.yaw].every(Number.isFinite))return;Object.assign(r.cam,c);r.updateCamera();markDirty();renderContact();},size:()=>({w:canvas.clientWidth,h:canvas.clientHeight}),safe:safeRects,bounds:name=>s.bounds(name),cameraMatrices:E3D.cameraMatrices,busy:()=>!!(control.contact||control.pending||control.candidate||pointer),reduced});
  let refitTimer=null;function refit(){clearTimeout(refitTimer);refitTimer=setTimeout(()=>{if(!framer.manual)framer.update(p,{force:true});},120);}
  document.addEventListener('panels:changed',refit);
  function setViewButtons(view){document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('cameraMode').textContent=view==='auto'?'Auto view':view?$$view(view):'Free view';}
  const $$view=v=>({bench:'Bench',plate:'QuickStrip',card:'Card',reagents:'Tubes & tips',top:'Overhead'}[v]||'Free view');
  function manualCamera(){framer.userMoved();setViewButtons(null);}
  function preset(view){
    cancel();closeMenus();
    if(view==='auto'){setViewButtons('auto');framer.recenter(p);return;}
    const cardAt=p.cardLocation==='uv'?s.uvCard:p.cardLocation==='incubator'?s.ovenCard:s.cardHome;
    const views={bench:{at:[0,.24,-.6],yaw:0,pitch:.89,distance:15.5},plate:{at:[-2.35,.3,1.25],yaw:0,pitch:1.2,distance:6.4},card:{at:[...cardAt],yaw:0,pitch:1.3,distance:6.5},reagents:{at:[0,.4,-.85],yaw:0,pitch:1.0,distance:6.2},top:{at:[0,.15,-.6],yaw:0,pitch:1.535,distance:14.8}};
    framer.userMoved();Object.assign(r.cam,views[view]||views.bench);r.updateCamera();setViewButtons(view);markDirty();renderContact();
  }
  canvas.addEventListener('pointerdown',e=>{
    closeMenus();
    if(modal||p.status!=='running'||![0,1,2].includes(e.button))return;useMouse();const f=frame(e);canvas.setPointerCapture(e.pointerId);
    // Left: tools. Right-drag: sideways pan + tilt about the horizontal axis. Shift/Alt + right-drag or middle-drag: full orbit.
    const mode=e.button===0?'tool':e.button===1||e.shiftKey||e.altKey?'orbit':'pan';
    pointer={id:e.pointerId,button:e.button,mode,x:f.x,y:f.y,startX:f.x,startY:f.y,drag:false};
    if(e.button===0)control.mouseDown(f);else{control.resetMotion();camera?.gate.reset();}
    e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{
    if(modal||p.status!=='running'||camera?.running)return;const f=frame(e);
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
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();camera?.stop();cancel();saveNow();if(p.status==='running')p.dispatch({type:'pause'},'system');$('loading').hidden=false;$('loadingText').textContent='Graphics context was lost. Your run is saved; reload to resume, or use the 2D activity.';$('fallbackLink').hidden=false;});

  function renderContact(){
    if(!control)return;const t=control.contact?.target||control.target,tip=p.tip;
    document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===control.tool));
    $('toolName').textContent={view:'NO TOOL HELD',pipette:'MICROPIPETTE / 5 µL',card:'PAPER MICROARRAY CARD'}[control.tool];
    $('contactName').textContent=t?.label|| (control.tool==='view'?'Explore the workbench':'Aim at a target');
    $('loadVolume').textContent=(tip?.volume||0)+' / 5 µL';$('contactFill').style.width=(control.contact?.depth||0)*100+'%';
    const quantity=t?.kind==='reagent'?p.reagents[t.id]:t?.kind==='well'?p.wells[t.sample].volume:t?.kind==='spot'?p.spots[t.sample].volume:null;
    $('targetLiquid').hidden=quantity===null;
    if(quantity!==null){$('targetLiquidName').textContent=t.kind==='well'?'Added liquid':t.kind==='spot'?'Wet spot':t.id+' remaining';$('targetVolume').textContent=(Number.isInteger(quantity)?quantity:quantity.toFixed(1))+' µL';$('targetLiquidFill').style.width=(quantity/(t.kind==='reagent'?200:5)*100)+'%';}
    $('contactState').textContent=control.contact?(control.contact.depth>=.85?'Contact reached · schematic':'Opening locked · lower to insert'):'Contact depth · schematic';
    $('tipInfo').textContent=tip?(tip.retired?'Sample deposited · eject this tip':tip.sample?'Tip dedicated to '+tip.sample:tip.reagent?'Tip contains / has used '+tip.reagent:'Fresh tip fitted'):'No tip fitted';
    $('mixMeter').hidden=p.phase!=='samples';const w=p.wells[tip?.sample||p.currentSample];
    $('mixDots').replaceChildren(...Array.from({length:3},(_,i)=>{const el=document.createElement('span');el.className='mix-dot'+(w?.mixes>i?' done':'');el.textContent=w?.mixes>i?'✓':String(i+1);return el;}));
    const label=$('targetLabel');label.hidden=!t;
    if(t){r.root.update();const loc=r.project(s.position(t));label.hidden=loc.z<0||loc.z>1||!!control.contact;label.textContent=t.label;label.style.left=clamp(loc.x,70,canvas.clientWidth-70)+'px';label.style.top=clamp(loc.y+20,40,canvas.clientHeight-120)+'px'; /* below the target, clear of the descending tip */}
    $('interactionHint').textContent=camera?.running?'Hand control is on. Follow the instruction in the Hand control panel.':p.phase==='prepare'?'Complete the set-up checklist. You can look around the bench while you do.':p.status!=='running'?'Experiment '+p.status+'. Choose Run at the top to continue.':control.pending?.kind==='draw'?(control.contact?.depth>=.85?'Tip immersed. Release to draw 5 µL.':'Keep holding and move down to insert.'):
      control.tool==='pipette'?(!tip?'Lower onto the marked unused tip to attach it.':tip.volume?'Aim at the receiver, hold and move down to deliver 5 µL.':'Hold, lower into the source, then release to draw 5 µL.'):
      control.tool==='card'?'Choose a station to place the held card.':['analyze','complete'].includes(p.phase)&&p.uv?'Read each spot under UV. Record what you see in the notebook.':'Pick up a tool from the dock. Right-drag: sideways pans, up/down tilts. The wheel zooms.';
    renderCamGuide();
  }
  function extraText(){
    if(['eb','hb'].includes(p.phase))return p.ids.filter(id=>p.spots[id][p.phase]).length+' / 32 spots treated';
    if(p.phase==='samples'){const id=p.currentSample,w=p.wells[id];return p.ids.filter(id=>p.wells[id].spotted).length+' / 32 spotted'+(id?' · '+id+' · mix '+w.mixes+'/3':'');}
    if(p.phase.startsWith('dry'))return 'Drying '+({dry1:1,dry2:2,dry3:3}[p.phase])+' of 3'+(p.timer?' · '+clock(p.timer.remaining)+' left':'');
    if(p.phase==='analyze')return p.controlsVerified?'Controls valid · '+Object.keys(p.interpretations).length+' / 16 genes':Object.keys(p.colors).filter(id=>MicroarrayProtocol.isControl(id)).length+' / 16 control colours';
    if(p.phase==='complete')return 'Controls valid · genes checked';
    return '4 patients · 32 spots';
  }
  const clock=sec=>{sec=Math.ceil(sec);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0');};
  // The target the student should use next, for "Show me", the beacon and the Targets panel.
  function nextTargetId(){
    const a=p.next();
    if(p.phase.startsWith('dry')&&!p.timer&&!a.type)return $('dryMode').value==='incubator'&&p.cardLocation!=='incubator'?'incubator':null;
    if(a.type==='attach')return 'tips';if(a.type==='eject')return 'waste';if(a.type==='pickCard')return 'card';if(a.type==='placeCard')return a.target;if(a.type==='tapPlate')return 'plate';
    if(a.kind==='uv')return p.cardLocation==='uv'?null:'uv';
    if(a.surface==='card')return 'spot:'+a.target;if(a.surface==='well'||(a.type==='aspirate'&&p.ids.includes(a.target)))return 'well:'+a.target;
    return a.target||null;
  }
  function renderBeacon(){const id=hintsOn&&p.status==='running'&&p.phase!=='prepare'?nextTargetId():null;s.setBeacon(id?s.targets.find(t=>t.id===id):null);markDirty();}

  function renderUI(){
    const [num,title,detail,source]=p.meta,next=p.next(),extra=extraText(),preparing=p.phase==='prepare';
    if(p.phase!==lastPhase){
      if(lastPhase&&lastPhase!=='prepare'&&PHASES.indexOf(p.phase)>PHASES.indexOf(lastPhase)){const done=META[lastPhase][1];setTimeout(()=>say('✓ '+done+' done. Next: '+title+'.','success'),0); /* after the action's own message */$('nextAction').classList.remove('flash');void $('nextAction').offsetWidth;$('nextAction').classList.add('flash');}
      lastPhase=p.phase;$('stepBody').scrollTop=0;
    }
    // Set-up dialog owns step 1; the step card guides everything after it.
    $('setupDialog').hidden=!preparing;$('stepCard').hidden=preparing;document.querySelector('.contact').hidden=preparing;
    if(preparing)renderSetup();
    $('stepNumber').textContent=num;$('stepEyebrow').textContent=num==='✓'?'Complete':(num.includes('–')?'Steps ':'Step ')+num.replace(/^0/,'').replace('–0','–')+' of 13';
    $('stepTitle').textContent=title;$('nextAction').textContent=next.text;$('stageExtra').textContent=extra;$('stepDetail').textContent=detail;$('stepSource').textContent='Manual '+source;
    $('locateBtn').hidden=!nextTargetId();
    const stagesKey=p.phase;if(stagesKey!==lastStages){lastStages=stagesKey;$('stages').replaceChildren(...PHASES.slice(0,-1).map((phase,i)=>{const li=document.createElement('li');li.title=META[phase][0]+' · '+META[phase][1];li.className=i<PHASES.indexOf(p.phase)?'done':phase===p.phase?'current':'';return li;}));}
    // Step-specific controls appear only when they are needed.
    const drying=p.phase.startsWith('dry'),mode=$('dryMode').value;
    $('timerBox').hidden=!drying;$('timerDigits').textContent=clock(p.timer?.remaining??(mode==='incubator'?300:600));
    $('dryMode').disabled=!!p.timer;$('timerStart').disabled=!!p.timer||p.status!=='running';$('timerStart').textContent=p.timer?'Drying…':'Start drying';
    const placed=p.cardLocation===(mode==='incubator'?'incubator':'bench');
    $('placeDryBtn').textContent=mode==='incubator'?(placed?'✓ Card in incubator':'Move card to incubator'):(placed?'✓ Card on the bench':'Place card on bench');$('placeDryBtn').disabled=!!p.timer||p.status!=='running'||placed;
    $('timerStart').classList.toggle('primary',placed);$('placeDryBtn').classList.toggle('primary',!placed&&!p.timer);
    $('returnCardBtn').hidden=!(['samples','hb'].includes(p.phase)&&p.cardLocation!=='bench');
    $('uvBox').hidden=!['uv'].includes(p.phase)&&!(p.phase==='analyze'&&!p.uv);$('uvGoggles').checked=p.uvGoggles;
    $('placeUVBtn').disabled=p.cardLocation==='uv'||p.status!=='running';$('placeUVBtn').textContent=p.cardLocation==='uv'?'✓ Card in UV area':'Move card to UV area';
    $('uvBtn').disabled=p.status!=='running';$('uvBtn').textContent=p.uv?'Switch off UV lamp':'Switch on UV lamp';
    $('placeUVBtn').classList.toggle('primary',p.cardLocation!=='uv');$('uvBtn').classList.toggle('primary',p.cardLocation==='uv'&&p.uvGoggles); // highlight the next step only
    $('analyzeBox').hidden=!(p.phase==='analyze'&&p.uv&&$('notebook').hidden);$('completeBox').hidden=p.phase!=='complete';
    $('notebookBtn').classList.toggle('attention',['analyze','complete'].includes(p.phase)&&p.uv&&$('notebook').hidden);
    $('runInline').hidden=p.status==='running';
    $('runBtn').disabled=p.status==='running';$('pauseBtn').disabled=p.status==='paused';$('stopBtn').disabled=p.status==='stopped';
    $('runStatus').textContent=p.status==='running'?(p.timer?'Drying clock running · '+$('clockSpeed').value+'×':'Ready · '+p.tipCount+' tips used'):p.status==='paused'?'Paused · choose Run to continue':'Stopped · choose Run to continue';
    stage.classList.toggle('uv-mode',s.uvTarget===1);
    renderTargetAction();renderContact();renderBeacon();
  }

  // Set-up dialog: two short pages, then it is gone.
  function renderSetup(){
    $('setupPageNum').textContent=String(setupPage);
    document.querySelectorAll('.setup-page').forEach(el=>el.hidden=Number(el.dataset.page)!==setupPage);
    const rows=[['ppeTick',$('ppe').checked],['cardTick',p.orientation.card],['plateTick',p.orientation.plate],['tapTick',p.samplesSettled]];
    for(const [id,ok] of rows)$(id).closest('.check-row').classList.toggle('ok',!!ok);
    $('ppeConfirm').textContent=$('ppe').checked?'✓ Wearing them':'I’m wearing them';
    for(const name of ['card','plate'])$(name+'Orientation').textContent=p.orientation[name]?'Correct: row '+p.rows[0]+' (Patient 1) is at the top left.':'Rotated: Patient 1 is at the lower right. Rotate it back.';
    $('settleStatus').textContent=p.samplesSettled?'Samples are at the bottom of the wells.':'Gently tap the QuickStrip on the bench (p.11).';
    $('tapPlate').disabled=p.samplesSettled||p.status!=='running';$('tapPlate').textContent=p.samplesSettled?'Done':'Tap';
    const ready=rows.every(([,ok])=>ok)&&$('groupLabel').value.trim().length>0;
    $('prepareBtn').disabled=!ready||p.status!=='running';$('prepareBtn').title=ready?'':'Complete every item first';
  }
  $('setupNext').onclick=()=>{if(!$('groupLabel').value.trim()){$('labelError').hidden=false;$('groupLabel').focus();return;}$('labelError').hidden=true;setupPage=2;renderSetup();$('ppe').focus();refit();};
  $('setupBack').onclick=()=>{setupPage=1;renderSetup();$('groupLabel').focus();refit();};
  $('groupLabel').oninput=()=>{$('labelError').hidden=true;renderSetup();};
  $('groupLabel').onkeydown=e=>{if(e.key==='Enter')$('setupNext').click();};
  $('ppe').onchange=renderSetup;
  $('rotateCard').onclick=()=>commit({type:'orient',target:'card'});$('rotatePlate').onclick=()=>commit({type:'orient',target:'plate'});
  $('tapPlate').onclick=()=>commit({type:'tapPlate',target:'plate'});
  $('prepareBtn').onclick=()=>{if(commit({type:'prepare',label:$('groupLabel').value,ppe:$('ppe').checked}))setTimeout(()=>say('Bench ready. Follow the step card at the top left.','success'),0);};

  // Targets panel: every action through individual, checked controls.
  function buildTargets(){
    const select=$('targetSelect');select.replaceChildren();
    for(const [name,kinds] of [['Tools & stations',['tool','tips','waste','card','station','plate']],['Reagents',['reagent']],['QuickStrip wells',['well']],['Paper-card spots',['spot']]]){
      const group=document.createElement('optgroup');group.label=name;
      for(const t of s.targets.filter(t=>kinds.includes(t.kind))){const option=document.createElement('option');option.value=t.id;option.textContent=t.label;group.append(option);}
      select.append(group);
    }
  }
  function renderTargetAction(){
    const t=s.targets.find(t=>t.id===$('targetSelect').value);if(!t)return;
    $('targetAction').textContent=t.kind==='tool'?'Pick up micropipette':t.kind==='tips'?'Fit one fresh tip':t.kind==='waste'?'Eject tip into waste':t.kind==='card'?'Pick up paper card':t.kind==='station'?'Place card here':p.tip?.volume?(t.kind==='well'&&!p.wells[t.sample].punctured?'Pierce foil & deliver 5 µL':'Deliver 5 µL'):'Draw 5 µL';
    $('targetAction').disabled=p.status!=='running';
    if(t.kind==='plate')$('targetAction').textContent='Gently tap QuickStrip';
    $('targetNext').disabled=!nextTargetId();
  }
  $('targetSelect').onchange=()=>{cancel();control.setTarget(s.targets.find(t=>t.id===$('targetSelect').value));renderTargetAction();renderContact();};
  $('targetAction').onclick=()=>{
    useMouse();cancel();const t=s.targets.find(t=>t.id===$('targetSelect').value);if(!t)return;
    if(t.kind==='tool'){control.select('pipette','accessible');return;}
    if(t.kind==='card'){control.select('card','accessible');return;}
    if(t.kind==='plate'){commit({type:'tapPlate',target:'plate'},'accessible');return;}
    if(t.kind==='station'){if(commit({type:'placeCard',target:t.id},'accessible')){control.tool='view';control.setTarget(null);renderContact();}return;}
    control.select('pipette','accessible');control.setTarget(t);
    if(commit(control.actionFor(t),'accessible'))s.pose({tool:'pipette',target:t,contact:{target:t,depth:1}},null,p);
    markDirty(true);
  };
  $('targetNext').onclick=()=>{const id=nextTargetId();if(!id)return;$('targetSelect').value=id;$('targetSelect').dispatchEvent(new Event('change'));$('targetAction').focus();};
  function toggleTargets(open=$('targetsPanel').hidden){$('targetsPanel').hidden=!open;$('targetsBtn').classList.toggle('on',open);$('targetsBtn').setAttribute('aria-expanded',String(open));if(open){const id=nextTargetId();if(id)$('targetSelect').value=id;renderTargetAction();$('targetSelect').focus();}}
  $('targetsBtn').onclick=()=>toggleTargets();$('closeTargets').onclick=()=>toggleTargets(false);

  function locate(){
    const id=nextTargetId(),t=s.targets.find(t=>t.id===id);
    if(t){control.setTarget(t);$('targetSelect').value=id;renderContact();renderTargetAction();setViewButtons('auto');framer.manual=false;framer.update(p,{force:true,extra:[s.position(t)]});say('Here: '+t.label+'.');}
    else say(p.next().text);
  }
  $('locateBtn').onclick=locate;
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{useMouse();control.select(b.dataset.tool);markDirty(true);});
  $('returnTool').onclick=()=>{useMouse();control.select('view');sync();};
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>preset(b.dataset.view));
  function moveCard(location){
    useMouse();cancel();if(p.cardLocation===location)return;
    if(p.cardLocation!=='held'&&!commit({type:'pickCard'}))return;
    if(commit({type:'placeCard',target:location})){control.tool='view';control.setTarget(null);s.park('pipette');renderContact();}
  }
  $('placeDryBtn').onclick=()=>moveCard($('dryMode').value==='incubator'?'incubator':'bench');
  $('returnCardBtn').onclick=()=>moveCard('bench');$('placeUVBtn').onclick=()=>moveCard('uv');
  $('timerStart').onclick=()=>{cancel();if(commit({type:'dry',mode:$('dryMode').value}))lastClock=performance.now();};
  $('dryMode').onchange=()=>{renderUI();scheduleSave();};
  function advanceClock(){
    const now=performance.now(),delta=(now-lastClock)/1000;lastClock=now;
    if(document.hidden||p.status!=='running'||modal)return;
    activeMS[p.phase]=(activeMS[p.phase]||0)+Math.min(delta,1)*1000;
    if(!p.timer)return;
    const finished=p.tick(delta*clockRate);s.sync(p);renderUI();markDirty();
    if(finished){framer.update(p);saveNow();}
    else if(now-lastSaveTick>5000){lastSaveTick=now;saveNow();}
  }
  let clockRate=Number($('clockSpeed').value);
  $('clockSpeed').onchange=()=>{advanceClock();clockRate=Number($('clockSpeed').value);lastClock=performance.now();renderUI();scheduleSave();};
  $('uvGoggles').onchange=e=>commit({type:'uvGoggles',value:e.target.checked});
  $('uvBtn').onclick=()=>{if(commit({type:'uv'})&&p.uv&&p.phase==='analyze'){say('UV on. Open the notebook and record the control colours first.','success');}};
  $('runInline').onclick=()=>$('runBtn').click();
  for(const type of ['run','pause','stop'])$(type+'Btn').onclick=()=>{advanceClock();cancel();if(type!=='run')camera.stop();commit({type});lastClock=performance.now();saveNow();};
  $('graphicsQuality').onchange=e=>{try{r.setQuality(e.target.value);setPref(GRAPHICS_KEY,e.target.value);}catch(err){say('This graphics setting is not available: '+err.message,'error');}markDirty(true);};
  $('hintsToggle').onchange=e=>{hintsOn=e.target.checked;setPref(HINTS_KEY,hintsOn?'1':'0');renderBeacon();};

  // Menus: one open at a time; outside clicks and Escape close them.
  const menus=[['menuBtn','labMenu'],['cameraMenuBtn','cameraMenu']];
  function closeMenus(except){for(const [b,m] of menus)if(m!==except){$(m).hidden=true;$(b).setAttribute('aria-expanded','false');}}
  for(const [b,m] of menus)$(b).onclick=e=>{e.stopPropagation();const open=$(m).hidden;closeMenus(m);$(m).hidden=!open;$(b).setAttribute('aria-expanded',String(open));if(open)$(m).querySelector('button,select,input')?.focus();};
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.menu,#menuBtn,#cameraMenuBtn'))closeMenus();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});

  function rebuildScene(){r.disposeMeshes();s=new MicroarrayScene(r,p);control.tool=p.cardLocation==='held'?'card':'view';control.target=null;buildTargets();}
  function resetInputs(){
    $('groupLabel').value=p.label;$('ppe').checked=p.ppe;$('uvGoggles').checked=p.uvGoggles;$('controlsFeedback').textContent='';$('genesFeedback').textContent='';
    $('notes').value=notebook.notes||'';$('openQuestions').replaceChildren();$('lastMistake').hidden=true;$('rowSet').value=p.rowSet;setupPage=1;lastPhase=null;lastStages='';
  }
  function reset(ask=true){
    if(ask&&(p.log.length||mistakes.length)&&!confirm('Start a fresh experiment? The saved run, notebook entries and answers will be deleted from this browser.'))return;
    closeMenus();camera.stop();cancel();const label=$('groupLabel').value;p=new Protocol($('rowSet').value);mistakes=[];notebook=A.emptyNotebook();activeMS={};questionList=A.questions(p.rows);control.stats={cancelled:0,rejected:0,transfers:0};
    session.clear();rebuildScene();resetInputs();if(!ask)$('groupLabel').value=label;$('dryMode').value='incubator';lastClock=performance.now();$('saveStatus').textContent='';
    if(!$('notebook').hidden)toggleNotebook(false);framer.key=null;setViewButtons('auto');sync();if(ask)say('Fresh workcell. Start with the set-up checklist.');
  }
  $('resetBtn').onclick=()=>reset(true);
  $('rowSet').onchange=()=>{if(p.phase!=='prepare')return;reset(false);};
  $('resetLayoutBtn').onclick=()=>{closeMenus();MicroarrayPanels.resetAll();notebookDock.reset();say('Panels are back in their original places.');};
  function resume(saved){
    const restored=Protocol.restore(saved.protocol);
    p=restored;if(p.status==='running')p.dispatch({type:'pause'},'resume');
    mistakes=Array.isArray(saved.mistakes)?saved.mistakes.filter(m=>m&&typeof m.code==='string'&&typeof m.message==='string').slice(-500):[];
    notebook={...A.emptyNotebook(),...(saved.notebook&&typeof saved.notebook==='object'?saved.notebook:{})};
    activeMS=saved.activeMS&&typeof saved.activeMS==='object'?saved.activeMS:{};
    control.stats={cancelled:0,rejected:0,transfers:0,...(saved.stats||{})};questionList=A.questions(p.rows);
    if(['1','30','60'].includes(String(saved.clockRate))){$('clockSpeed').value=String(saved.clockRate);clockRate=Number(saved.clockRate);}
    if(['incubator','room'].includes(saved.dryMode))$('dryMode').value=saved.dryMode;
    rebuildScene();resetInputs();framer.key=null;setViewButtons('auto');lastClock=performance.now();sync();
    say('Run resumed, paused. Choose Run at the top to continue.');
  }

  // Webcam hand control with a live "do this now" guide below the video.
  let camError=false,pinchSeen=false;
  const handSettings=()=>globalThis.ClassroomHandTuning?.get?.()||{mode:'pinch',assist:true};
  camera=new ClassroomWebcam({video:$('cameraVideo'),overlay:$('cameraOverlay'),mode:handSettings().mode,bounds:()=>({width:canvas.clientWidth,height:canvas.clientHeight}),
    active:on=>{$('handBtn').classList.toggle('on',on);$('cameraStart').textContent=on?'Stop camera':'Start camera';$('restBtn').disabled=!on;$('pressBtn').disabled=!on||!camera?.profiles.rest;$('centreBtn').disabled=!on;if(!on){$('handCursor').style.display='none';pinchSeen=false;}renderCamGuide();},
    status:(message,error)=>{$('cameraStatus').textContent=message;$('cameraStatus').style.color=error?'#994f3c':'';camError=!!error;renderCamGuide();},
    lost:()=>{control.resetMotion();$('handCursor').style.display='none';handSeen=0;markDirty(true);renderCamGuide();},
    home:()=>renderCamGuide(),
    calibration:profiles=>{$('restBtn').textContent=profiles.rest?'✓ Rest saved':'Capture Rest';$('pressBtn').textContent=profiles.press?'✓ Press saved':'Capture Press';$('pressBtn').disabled=!profiles.rest;renderCamGuide();},
    frame:f=>{
      handSeen=performance.now();if(modal||p.status!=='running')return;control.feed(f);
      /* While a target is locked the cursor sits on it and fills with the insertion depth. */
      const c=$('handCursor'),locked=control.contact?.target;c.style.display='block';c.classList.toggle('pressed',!!f.thumbDown);c.classList.toggle('locked',!!locked);c.classList.toggle('aiming',!locked&&!!control.target);
      if(locked){r.root.update();const q=r.project(s.position(locked));c.style.left=q.x+'px';c.style.top=q.y+'px';c.style.setProperty('--depth',String(Math.min(1,(control.contact.depth||0)/.85)));}
      else{c.style.left=f.x+'px';c.style.top=f.y+'px';}
      if(handSeen-guideTick>150){guideTick=handSeen;renderCamGuide();}
    },
    edge:(edge,f)=>{if(edge==='press'&&f.pinch&&!pinchSeen){pinchSeen=true;renderCamGuide();}if(modal||p.status!=='running')return;edge==='press'?control.press(f):control.release(f);},
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
    const pinch=camera.mode==='pinch',running=camera.running,prof=camera.profiles||{},tip=p.tip,t=control.contact?.target||control.target,seen=performance.now()-handSeen<600;
    const stepState=pinch?{start:running,hand:running,centre:!!camera.home,pinch:pinchSeen}:{start:running,hand:running,rest:!!prof.rest,press:!!prof.press};
    const order=pinch?['start','centre','pinch']:['start','rest','press'],now=order.find(k=>!stepState[k]);
    document.querySelectorAll('.cam-steps li').forEach(li=>{li.classList.toggle('done',!!stepState[li.dataset.cs]);li.classList.toggle('now',li.dataset.cs===now);});
    $('pinchTry').textContent=pinchSeen?'✓ Pinch detected':'Try a pinch';
    const nextLabel=()=>{const id=nextTargetId();return s.targets.find(x=>x.id===id)?.label||'the next target';};
    const press=pinch?'pinch':'press your thumb',grab=pinch?'🤏':'✊';
    let icon='📷',text='Start the camera. Keep your whole hand in view, about an arm’s length from the screen.',g=null,badge=['Off',''],warn=false;
    if(camError&&!running){icon='⚠️';text=$('cameraStatus').textContent||'The camera could not start. Mouse controls still work.';badge=['Error','warn'];warn=true;}
    else if(running&&!seen){icon='🖐';text='Show your working hand to the camera, palm facing the screen.';badge=['No hand','warn'];warn=true;}
    else if(running&&!pinch&&!prof.rest){icon='✋';text='Hold a relaxed pipette grip, thumb resting, then press Capture Rest.';badge=['Calibrate','warn'];}
    else if(running&&!pinch&&!prof.press){icon='👍';text='Keep the grip, press your thumb fully down, then press Capture Press.';badge=['Calibrate','warn'];}
    else if(running&&pinch&&!camera.home){icon='✋';text='Hold your hand where it feels comfortable. That spot becomes the centre of the bench.';badge=['Centring',''];}
    else if(running){
      badge=['On','on'];
      if(p.status!=='running'){icon='⏸';text='Choose Run at the top to use your hand.';}
      else if(control.tool==='view'){icon=grab;text=pinch?'Move to the micropipette and pinch to pick it up.':'Close your grip over the micropipette and hold to pick it up.';g='grab';}
      else if(control.tool==='card'){icon=grab;text='Move over a station and '+(pinch?'pinch':'close your grip')+' to place the card.';g='grab';}
      else if(control.pending?.kind==='bubbles'){icon='⚠️';warn=true;text='Bubbles! '+(pinch?'Keep pinching':'Keep the plunger pressed')+', lift the tip out of the liquid, lower back in, then '+(pinch?'let go':'release slowly')+' to draw.';g='draw';}
      else if(control.pending?.kind==='armed'&&!control.contact){icon=pinch?'🤏':'👍';text=(pinch?'Keep pinching':'Keep the thumb pressed')+'. Pause over '+(tip?.volume?'the receiver':'the source')+' until it locks, then lower your hand.';g='lock';}
      else if(control.pending?.kind==='draw'){icon=pinch?'🤏':'👍';text=control.contact?.depth>=.85?(pinch?'Let go of the pinch slowly to draw 5 µL.':'Release the plunger slowly to draw 5 µL.'):(pinch?'Keep pinching and lower your hand into the liquid.':'Keep the thumb pressed and lower your hand into the liquid.');g='draw';}
      else if(control.contact){
        // Real plunger technique: press before an empty tip enters the liquid; release inside to draw (this is also how mixing works).
        const deep=control.contact.depth>=.85,liquid=['reagent','well'].includes(t?.kind),down=control.pressed;
        icon=tip?.volume?'💧':'⤓';g=deep?(tip?.volume?'deliver':'draw'):'insert';
        if(!deep)text='Locked on '+(t?.label||'the target')+'. '+(tip&&!tip.volume&&liquid&&!down?(pinch?'Pinch now, before the tip enters the liquid, then lower.':'Press the plunger now, before the tip enters the liquid, then lower.'):'Lower your hand to insert, or slide sideways to leave.');
        else if(!tip)text='The tip fits when you are fully down.';
        else if(tip.volume)text=pinch?'Pinch to deliver 5 µL.':'Press the plunger to deliver 5 µL.';
        else if(down&&liquid)text=pinch?'To mix, let go slowly to draw the liquid back up, or lift out first.':'To mix, release the plunger slowly to draw the liquid back up, or lift out first.';
        else if(down)text='Lift the tip away, then '+(pinch?'let go.':'release the plunger.');
        else text=liquid?(pinch?'Pinch before the tip enters the liquid: lift out, pinch, lower back in, then let go.':'The plunger must be pressed before the tip enters the liquid: lift out, press, lower back in, then release.'):'Lift the tip away.';
      }
      else if(tip?.retired||nextTargetId()==='waste'){icon='🎯';text='Move to the tip waste and '+press+' to eject.';g='lock';}
      else if(t?.kind==='stand'){icon='🖐';text=tip?.volume?'Deliver the liquid first, then hang the micropipette up here.':pinch?'Spread your fingers wide to hang the micropipette on its stand.':'Show your open palm to hang the micropipette on its stand.';g='return';}
      else if(['card','bench','incubator','uv','plate'].includes(nextTargetId())){icon='🖐';text='Hang the micropipette up first: move it to its stand and show your open palm.';g='return';}
      else if(!tip){icon='🎯';text='Pause over the glowing fresh tip until it locks, then lower your hand.';g='lock';}
      else{icon='🎯';text='Pause over '+nextLabel()+' until its ring turns gold. Spots you pass over do not lock.';g='lock';}
    }
    $('camGuideIcon').textContent=icon;$('camGuideText').textContent=text;$('camGuide').classList.toggle('warn',warn);
    const b=$('cameraBadge');b.textContent=badge[0];b.className='state-badge'+(badge[1]?' '+badge[1]:'');
    document.querySelectorAll('.gestures li').forEach(li=>li.classList.toggle('now',li.dataset.g===g));
  }
  $('handBtn').onclick=()=>{const open=$('cameraPanel').hidden;$('cameraPanel').hidden=!open;if(!open)camera.stop();$('handBtn').classList.toggle('on',open&&camera.running);applyHandMode();renderCamGuide();};
  $('cameraStart').onclick=()=>{if(camera.running)camera.stop();else if(p.status==='running'){cancel();camError=false;camera.start();}else say('Choose Run before starting hand control.','error');renderCamGuide();};
  $('closeCamera').onclick=()=>{camera.stop();$('cameraPanel').hidden=true;};
  $('centreBtn').onclick=()=>{cancel();if(camera.setHome())say('Centre set. Small hand movements now cover the bench.','success');renderCamGuide();};
  $('restBtn').onclick=()=>{cancel();camera.capture('rest');};$('pressBtn').onclick=()=>{cancel();camera.capture('press');};$('workingHand').onchange=e=>camera.setPreference(e.target.value);
  window.addEventListener('microarray-hand-settings',()=>{cancel();const mode=handSettings().mode;if(mode!==camera.mode){camera.setMode(mode);pinchSeen=false;applyHandMode();}else camera.lost();renderCamGuide();});
  applyHandMode();

  // Notebook: docked beside the scene so the card stays visible while it is read.
  const notes=new MicroarrayNotebookUI({protocol:()=>p,commit:(a,input)=>commit(a,input),notebook:()=>notebook,save:scheduleSave,questions:()=>questionList,mistakes:()=>mistakes,stats:()=>control.stats,activeMS:()=>activeMS});
  const notebookDock=MicroarrayPanels.edgeResize($('notebook'),$('notebookResize'),'notebook-width',{min:340,maxFraction:.7});
  function toggleNotebook(open=$('notebook').hidden){
    $('notebook').hidden=!open;$('notebookBtn').setAttribute('aria-expanded',String(open));stage.classList.toggle('with-notebook',open);
    if(open){camera.stop();cancel();notes.render();$('notebook').querySelector('select:not(:disabled),button:not(:disabled)')?.focus({preventScroll:true});}
    renderUI();r.resize();framer.update(p,{force:true});markDirty(true);
  }
  $('notebookBtn').onclick=()=>toggleNotebook();$('closeNotebook').onclick=()=>toggleNotebook(false);$('openNotebookBtn').onclick=()=>toggleNotebook(true);
  $('completeQuestions').onclick=()=>{toggleNotebook(true);$('questionsHeading').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});};
  $('checkControls').onclick=()=>{if(commit({type:'verifyControls'},'notebook')){$('controlsFeedback').textContent='All 16 controls show the expected pattern. The run is valid.';$('controlsFeedback').className='ok';}};
  $('finishBtn').onclick=()=>{if(commit({type:'finish'},'notebook')){$('genesFeedback').textContent='All 16 gene colours and interpretations agree with the card. The reasoning questions are unlocked.';$('genesFeedback').className='ok';notes.render();$('questionsHeading').scrollIntoView({behavior:reduced()?'auto':'smooth',block:'start'});}};
  $('notes').oninput=()=>{notebook.notes=$('notes').value;scheduleSave();};
  function openDialog(id){camera.stop();cancel();closeMenus();modal=true;$(id).showModal();}
  $('helpBtn').onclick=()=>openDialog('helpDialog');
  const openDebrief=()=>{notes.debrief();openDialog('debriefDialog');};$('debriefBtn').onclick=openDebrief;$('completeDebrief').onclick=openDebrief;
  $('printDebrief').onclick=()=>{document.body.classList.add('printing-debrief');window.print();document.body.classList.remove('printing-debrief');};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>{modal=false;cancel();}));
  $('exportBtn').onclick=()=>{
    const debrief=A.debrief({protocol:p,mistakes,notebook,list:questionList,stats:control.stats,activeMS});
    const data={...p.summary(),notebook:{answers:notebook.answers,writtenResponses:notebook.open,notes:notebook.notes},corrections:mistakes,debrief,limitations:{illustrativeManualExample:true,calibratedFluorescence:false,originalSampleVolumeKnown:false,physicalDepthMeasured:false,humanWebcamValidated:false,tubeSizeAssumed:'1.5 mL'},inputDiagnostics:{...control.stats,camera:{...camera.stats}}};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='microarray-3d-v3-notebook'+(p.label?'-'+p.label.replace(/[^\w-]+/g,'_'):'')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  // Floating panels: drag by the header, resize from any corner, collapse; layout is remembered.
  const {FloatingPanel}=MicroarrayPanels;
  const stepPanel=new FloatingPanel($('stepCard'),{key:'step',minW:280,autoHeight:true});
  new FloatingPanel(document.querySelector('.contact'),{key:'contact',minW:190,autoHeight:true});
  new FloatingPanel($('targetsPanel'),{key:'targets',minW:240,autoHeight:true});
  new FloatingPanel($('setupDialog'),{key:'setup',minW:320,autoHeight:true});
  new FloatingPanel($('cameraPanel'),{key:'camera',minW:280,minH:300});
  MicroarrayPanels.watchStage(stage);
  $('stepCollapse').onclick=()=>stepPanel.setCollapsed(!$('stepCard').classList.contains('collapsed'));

  window.addEventListener('blur',()=>{cancel();camera.lost();});
  document.addEventListener('visibilitychange',()=>{lastClock=performance.now();cancel();if(document.hidden){camera.stop();saveNow();}});window.addEventListener('pagehide',()=>{camera.stop();saveNow();});
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
  buildTargets();
  const saved=session.load();
  renderUI();s.sync(p,true);framer.update(p);$('loading').hidden=true;requestAnimationFrame(loop);setInterval(advanceClock,100);
  if(saved&&saved.protocol?.log?.length){
    const sp=saved.protocol,meta=META[sp.phase]||META.prepare;
    $('resumeText').textContent=(sp.label?'Group '+sp.label:'An unlabelled run')+' · rows '+(sp.rows?.[0]||'A')+'–'+(sp.rows?.[3]||'D')+' · Step '+meta[0]+', '+meta[1]+' · saved '+MicroarraySession.age(saved.savedAt)+'.';
    modal=true;$('resumeDialog').showModal();
    $('resumeYes').onclick=()=>{$('resumeDialog').close();try{resume(saved);}catch(e){say(e.message,'error');session.clear();}};
    $('resumeFresh').onclick=()=>{$('resumeDialog').close();session.clear();say('Saved run deleted. Start with the set-up checklist.');};
  }else if(p.phase==='prepare')setTimeout(()=>$('groupLabel').focus({preventScroll:true}),50);
  // Readable diagnostics for verification. There is no learner-facing skip or bulk-transfer path.
  window.MicroarrayLab={get protocol(){return p;},get interaction(){return control;},get scene(){return s;},get framer(){return framer;},get mistakes(){return mistakes;},get notebook(){return notebook;},renderer:r,webcam:camera,preset,session,nextTargetId,targetPoint(id){r.root.update();r.updateCamera();const t=s.targets.find(t=>t.id===id);return t?r.project(s.position(t)):null;}};
})();
