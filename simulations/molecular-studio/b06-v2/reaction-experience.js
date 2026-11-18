import {studioCamera as camera} from './studio-camera.js';
import {openHandDetector} from './hand-detector.js';
import {HandGestures,handSettings,playerFrame,steadyHandMotion} from './hand-gestures.js';
import {THREE as T} from './../vendor/three-bundle.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const reach=x=>clamp((x-.12)/.76,0,1);

// Mode-owned camera and gestures; the chemistry model and Builder are shared read-only.
export function installReactionExperience(root,api){
 const $=id=>root.getElementById(id);
 const app=$('app'),stage=$('reaction-stage'),scene=stage.parentElement,dialog=$('hand-setup');
 const input=document.createElement('canvas'),ctx=input.getContext('2d',{alpha:false});
 const picture=document.createElement('canvas'),paint=picture.getContext('2d');
 picture.className='camera-surface';picture.setAttribute('aria-label','Local camera view for hand control');picture.hidden=true;scene.prepend(picture);
 let immersive=false,session=null,center={x:.5,y:.5},mode='rotate',lastStatus='';
 const preferences=handSettings(),gestures=new HandGestures(preferences),active=new Map();
 let zoom=null,physicalPointers=new Set();
 const controls=()=>window.__freeControls?.find(c=>c.element===stage);
 const narrow=matchMedia('(max-width:900px)');
 // The setup dialog buttons a hand may press while it is open from a hand session (see watchDialog).
 const dialogTools='#hand-close,.frame-presets button,#hand-start,.hand-tuning summary,#hand-mirror,#hand-switch';
 const handLayout=()=>root.host.hasAttribute('data-hand-layout');
 const note=text=>{if(text!==lastStatus){lastStatus=text;$('hand-status').textContent=text;$('hand-bar-hint').textContent=text;}};
 const setupNote=text=>{$('hand-setup-status').textContent=text;};
 const bounds=()=>scene.getBoundingClientRect();
 const sourceAspect=()=>camera.video?.videoWidth/camera.video?.videoHeight||16/9;
 const region=()=>playerFrame(center,+$('hand-frame-width').value/100,sourceAspect(),bounds().width/bounds().height);
 function syncFrame(){
  const f=region(),left=camera.mirrored?1-f.left-f.width:f.left;
  Object.assign($('player-frame').style,{left:left*100+'%',top:f.top*100+'%',width:f.width*100+'%',height:f.height*100+'%'});
  // The preview keeps the camera's shape inside the dialog's 4:3 camera box, so the frame stays true to the image.
  $('hand-preview').style.aspectRatio=sourceAspect();$('hand-preview').style.width=sourceAspect()>=4/3?'100%':sourceAspect()/(4/3)*100+'%';
  $('hand-preview-video').style.transform=camera.mirrored?'scaleX(-1)':'none';
  picture.style.transform=camera.mirrored?'scaleX(-1)':'none';
  $('hand-mirror').setAttribute('aria-pressed',String(camera.mirrored));
  $('hand-frame-value').textContent=$('hand-frame-width').value+'%';
  for(const el of root.querySelectorAll('[data-frame-width]'))el.setAttribute('aria-pressed',String(el.dataset.frameWidth===$('hand-frame-width').value));
 }
 function releaseHand(h,cancel=true){
  if(cancel&&h.drag?.moved)api.cancelMove(h.drag.id,h.drag.origin);
  h.cursor.remove();h.command?.classList.remove('hand-aim');
 }
 function resetInput(){for(const h of active.values())releaseHand(h);active.clear();gestures.reset();zoom=null;}
 function setPanel(on){
  root.host.classList.toggle('immersive-panel',on&&immersive);$('imm-controls').setAttribute('aria-expanded',String(on&&immersive));
  if(on)$('close-imm-controls').focus({preventScroll:true});
 }
 // Immerse with hands on: the host gets data-imm-hands, so the task panel shows its hand tiles at hand size.
 // It stays while the camera dialog reads hands, so the model keeps its size behind the dialog.
 const syncImmHands=()=>root.host.toggleAttribute('data-imm-hands',immersive&&(app.classList.contains('hands-on')||dialog.hasAttribute('data-by-hand')));
 function setImmersive(on){
  if(on===immersive)return;
  api.pause();resetInput();
  api.library(false);
  // On a wide screen a running hand session carries on in the hand layout after Immerse.
  if(!on&&(narrow.matches||!session?.running))stopHands({focus:false});
  immersive=on;root.host.toggleAttribute('data-immersive',on);api.immersive(on);setPanel(false);
  $('immerse').setAttribute('aria-pressed',String(on));$('immerse').querySelector('span').textContent=on?'Exit':'Immerse';
  $('immerse').setAttribute('aria-label',on?'Exit immersive view':'Enter immersive view');
  for(const id of ['imm-controls','immersive-playback','close-imm-controls'])$(id).hidden=!on;
  root.querySelector('.immersive-limit').hidden=!on;
  syncImmHands();api.resize();sync();if(api.isActive())$('immerse').focus({preventScroll:true});
 }
 function sync(){
  const s=api.snapshot(),loaded=s.state.atoms.length>0;
  $('imm-play').textContent=loaded?$('play').textContent:'Load reactants';
  $('imm-play').disabled=loaded?$('play').disabled:false;
  $('imm-reset').disabled=$('reset').disabled;
  $('imm-progress').disabled=$('progress').disabled;$('imm-progress').value=$('progress').value;
  $('imm-progress').setAttribute('aria-valuetext',$('progress').getAttribute('aria-valuetext'));
  $('imm-progress-value').textContent=$('progress-value').textContent;
  if($('imm-status').textContent!==$('status').textContent)$('imm-status').textContent=$('status').textContent;
  $('hand-move').disabled=s.phase!=='build';$('hand-move-tile').disabled=$('hand-move').disabled;
  if(s.phase!=='build'&&mode==='move')setMode('rotate');
 }
 function setMode(next){mode=next;resetInput();if(next==='move')$('manual').open=true;$('hand-rotate').setAttribute('aria-pressed',String(next==='rotate'));$('hand-move').setAttribute('aria-pressed',String(next==='move'));$('hand-move-tile').setAttribute('aria-pressed',String(next==='move'));note(next==='rotate'?'Grasp the scene to tilt. Use two hands to zoom.':'Grasp an atom to move it. Open without moving to select.');}
 function stopHands({focus=true}={}){
  const s=session;session=null;resetInput();
  if(s){cancelAnimationFrame(s.raf);s.abort.abort();s.detector?.close();}
  app.classList.remove('hands-on');$('hands-session').hidden=true;picture.hidden=true;api.hands(false);
  $('hands-open').setAttribute('aria-pressed','false');$('hands-open').querySelector('span').textContent='Hands';
  $('hand-preview-video').srcObject=null;$('hand-preview-empty').hidden=false;
  $('hand-enable').disabled=false;$('hand-enable').textContent='Turn on camera';$('hand-start').disabled=true;
  if(dialog.open)dialog.close();if(s)camera.release('hands');picture.width=picture.height=input.width=input.height=1;
  syncImmHands();if(focus&&api.isActive())$('hands-open').focus({preventScroll:true});
 }
 function settings(){
  if(!api.isActive())return;
  api.pause();resetInput();
  if(session){session.running=false;cancelAnimationFrame(session.raf);}
  app.classList.remove('hands-on');$('hands-session').hidden=true;picture.hidden=true;
  $('hands-open').setAttribute('aria-pressed','false');$('hands-open').querySelector('span').textContent='Hands';
  if(!dialog.open)dialog.showModal();
  const video=camera.video;
  if(video){$('hand-preview-video').srcObject=video.srcObject;$('hand-preview-video').play().catch(()=>{});$('hand-preview-empty').hidden=true;setupNote('Move the frame around your hands, then choose Start building.');}
  else setupNote('Camera access begins only when you turn it on.');
  syncFrame();watchDialog();syncImmHands();
 }
 // Opened from a hand session (the Camera tile, Settings in Immerse), the dialog keeps reading hands, as the
 // hand settings tile does in Shapes and Build a molecule: Cancel, the framing buttons, the fold, Mirror and Start building can be
 // pressed by hand (data-by-hand makes them hand-sized), so a hand-only student is never stuck here.
 function watchDialog(){
  const s=session;if(!s?.detector||s.failed||!camera.video||!dialog.open)return;
  dialog.setAttribute('data-by-hand','');
  setupNote('Hands still work here: aim at a button and close your hand to press it. Start building takes you back.');
  cancelAnimationFrame(s.raf);s.lastTime=-1;s.lastResult=performance.now();s.raf=requestAnimationFrame(t=>tick(s,t));
 }
 async function enable(){
  if(!api.isActive())return;
  if(session)return;
  const s=session={abort:new AbortController(),running:false,busy:false,raf:0,lastTime:-1,lastFrame:0,lastResult:performance.now(),detector:null};
  $('hand-enable').disabled=true;setupNote('Opening the camera…');
  try{
   const video=await camera.use('hands');if(session!==s)return;
   $('hand-preview-video').srcObject=video.srcObject;await $('hand-preview-video').play();if(session!==s)return;
   $('hand-preview-empty').hidden=true;syncFrame();setupNote('Loading local hand tracking…');
   const model=await openHandDetector(s.abort.signal);if(session!==s){model.close();return;}s.detector=model;
   $('hand-enable').textContent='Camera on';$('hand-start').disabled=false;
   $('hand-switch').hidden=(await camera.inputs()).length<2;if(session!==s)return;
   setupNote('Camera ready. Frame your hands, then choose Start building.');
  }catch(error){
   if(session!==s)return;stopHands({focus:false});dialog.showModal();
   setupNote(error.name==='NotAllowedError'?'Camera access was not allowed. Allow it in the browser, then retry.':error.name==='NotFoundError'?'No camera found. Connect a camera, then retry.':'The camera or hand tracker could not start. Try again.');
   $('hand-enable').textContent='Retry camera';
  }
 }
 function start(){
  if(!api.isActive())return;
  const s=session;if(!s?.detector||!camera.video)return;
  // Narrow screens keep the old full-screen hand view; wide screens switch to the hand layout instead.
  if(narrow.matches)setImmersive(true);else if(!immersive)api.hands(true);
  resetInput();mode='rotate';setMode('rotate');
  cancelAnimationFrame(s.raf);s.running=true;s.lastTime=-1;s.lastResult=performance.now();
  $('hand-preview-video').srcObject=null;dialog.close();app.classList.add('hands-on');
  $('hands-session').hidden=false;picture.hidden=false;$('hands-open').setAttribute('aria-pressed','true');$('hands-open').querySelector('span').textContent='Hands on';
  syncImmHands();syncFrame();s.raf=requestAnimationFrame(t=>tick(s,t));$(handLayout()||!immersive&&!narrow.matches?'hand-bar-exit':'hand-stop').focus({preventScroll:true});
 }
 function closestAtom(x,y){
  const r=stage.getBoundingClientRect();
  return api.projected().filter(a=>Math.hypot(a.x+r.left-x,a.y+r.top-y)<=a.r+10).sort((a,b)=>Math.hypot(a.x+r.left-x,a.y+r.top-y)-Math.hypot(b.x+r.left-x,b.y+r.top-y))[0];
 }
 // The hand layout and Immerse with its task panel open aim across the whole tab (so Controls still closes
 // the panel); the shelf, when open, takes the hands until it closes.
 function gestureScope(){return root.querySelector('dialog[open]')||(!$('shelf').hidden?$('shelf'):handLayout()||root.host.classList.contains('immersive-panel')?app:scene);}
 function tapOn(id){if(api.editable())api.select(id);else api.track(id);}
 function onModel(x,y,scope){
  if(scope!==scene&&scope!==app)return false;
  const r=stage.getBoundingClientRect();if(x<r.left||x>r.right||y<r.top||y>r.bottom)return false;
  const e=root.elementFromPoint(x,y);return !!e&&scene.contains(e)&&!e.closest('.experience-tools,.rx-view-tools,.hands-session,.immersive-playback,.rx-shelf');
 }
 function commandAt(x,y,scope){
  // In the setup dialog a hand may also open the Adjust grip sensitivity fold (its summary).
  let e=root.elementFromPoint(x,y),target=e?.closest(scope===dialog?'button,summary,input[type=checkbox],input[type=range]':'button,input[type=checkbox],input[type=range]');
  if(!target&&e?.closest('label'))target=e.closest('label').querySelector('input[type=checkbox]');
  if(target&&scope===dialog&&!target.matches(dialogTools))return null;
  return target&&scope.contains(target)&&!target.disabled&&!target.closest('[inert],[hidden]')?target:null;
 }
 function beginDrag(h,id,x,y){
  const a=api.atom(id),c=controls();if(!a||!c)return;
  h.drag={id,origin:[...a.p],x,y,moved:false,plane:new T.Plane().setFromNormalAndCoplanarPoint(c.camera.getWorldDirection(new T.Vector3()),new T.Vector3(...a.p))};
 }
 function moveDrag(h,x,y){
  const d=h.drag,c=controls();if(!d||!c||api.snapshot().phase!=='build')return;
  if(!d.moved&&Math.hypot(x-d.x,y-d.y)>6){api.beforeMove();d.moved=true;}
  if(!d.moved)return;
  const r=stage.getBoundingClientRect(),ray=new T.Raycaster(),p=new T.Vector3();
  ray.setFromCamera(new T.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1),c.camera);
  if(ray.ray.intersectPlane(d.plane,p))api.move(d.id,p.toArray());
 }
 function feed(result,time,aspect){
  if(!api.isActive()||physicalPointers.size)return;
  const scope=gestureScope(),r=scope.getBoundingClientRect();
  if([...active.values()].some(h=>h.scope!==scope))resetInput();
  const events=gestures.update(result,time,aspect,camera.mirrored);
  for(const e of events){
   let h=active.get(e.id);
   if(e.phase==='lost'||e.phase==='missing'){
    if(h){releaseHand(h);active.delete(e.id);zoom=null;}continue;
   }
   if(!h){const cursor=document.createElement('span');cursor.className='hand-cursor';cursor.dataset.color=String(active.size%2);cursor.setAttribute('aria-hidden','true');scope.append(cursor);h={cursor,scope,action:null};active.set(e.id,h);}
   const x=r.left+reach(e.x)*(r.width-1),y=r.top+reach(e.y)*(r.height-1),command=commandAt(x,y,scope);
   Object.assign(h.cursor.style,{left:x+'px',top:y+'px'});h.cursor.dataset.grip=String(!!e.grip);
   if(!h.action){h.command?.classList.remove('hand-aim');h.command=command;command?.classList.add('hand-aim');}
   const model=!command&&onModel(x,y,scope),atom=model?closestAtom(x,y):null;
   const target=command||(model?(mode==='move'&&atom?'atom:'+atom.id:'rotate'):null);
   if(e.intent&&h.intentSince!==e.intentSince){h.intentSince=e.intentSince;h.pending={target,x,y};}
   if(e.phase==='press'&&!h.action&&h.pending&&h.pending.target===target&&Math.hypot(x-h.pending.x,y-h.pending.y)<40){
    const others=[...active.values()].filter(a=>a!==h);
    if(command&&others.every(a=>!a.action)){h.action='command';h.command=command;}
    else if(typeof target==='string'&&target.startsWith('atom:')&&api.snapshot().phase==='build'&&others.every(a=>!a.action)){
     h.action='atom';beginDrag(h,+target.slice(5),x,y);note('Carry the atom. Open to release.');
    }else if(target==='rotate'&&others.every(a=>!a.action||a.action==='rotate')){h.action='rotate';h.point={x,y};h.start={x,y,atom:atom?.id??null};note('Turning the view. Open to stop.');}
   }
   h.x=x;h.y=y;h.seen=time;h.event=e;
  }
  const turning=[...active.values()].filter(h=>h.action==='rotate'&&h.event?.grip&&h.seen===time);
  if(turning.length===2){
   const distance=Math.hypot(turning[0].x-turning[1].x,turning[0].y-turning[1].y);
   if(zoom&&distance>20&&Math.abs(distance-zoom)>3)controls()?.zoom((distance/zoom)**(preferences.zoomSensitivity/100));
   zoom=distance;note('Spread hands to zoom in. Bring them together to zoom out.');
   for(const h of turning)h.point={x:h.x,y:h.y};
  }else{
   if(zoom){for(const h of active.values()){h.action=null;h.point=null;}gestures.reset();zoom=null;note('Zoom set. Open both hands to begin again.');}
   for(const h of active.values())if(h.seen===time){
    const e=h.event;
    if(e.phase==='move'&&h.action==='rotate'){
     h.point=steadyHandMotion(h.point,{x:h.x,y:h.y},4);controls()?.rotate(h.point.dx*.004,h.point.dy*.004);
    }
    if(e.phase==='move'&&h.action==='atom')moveDrag(h,h.x,h.y);
   }
  }
  let activation=null,tapAtom=null;
  for(const h of active.values())if(h.seen===time&&h.event.phase==='release'){
   if(h.action==='command'&&h.command===commandAt(h.x,h.y,scope))activation={el:h.command,x:h.x};
   if(h.action==='atom'&&h.drag&&!h.drag.moved)api.select(h.drag.id);
   // A close and open on an atom without moving follows it (or selects it while building by hand).
   if(h.action==='rotate'&&h.start?.atom!=null&&!zoom&&Math.hypot(h.x-h.start.x,h.y-h.start.y)<14)tapAtom=h.start.atom;
   h.drag=null;h.action=null;h.start=null;h.command?.classList.remove('hand-aim');h.command=null;h.pending=null;
  }
  if(tapAtom!==null)tapOn(tapAtom);
  if(activation){
   const {el,x}=activation;resetInput();
   if(el.type==='range'){const b=el.getBoundingClientRect();el.value=Number(el.min)+clamp((x-b.left)/b.width,0,1)*(Number(el.max)-Number(el.min));el.dispatchEvent(new Event('input',{bubbles:true}));}
   else el.click();
  }
  if(!result.landmarks.length)note('Show an open hand inside your frame.');
 }
 async function tick(s,time){
  const live=()=>s.running||dialog.open&&dialog.hasAttribute('data-by-hand');
  if(!api.isActive()||session!==s||!live()||!camera.video)return;
  s.raf=requestAnimationFrame(t=>tick(s,t));
  if(s.busy||time-s.lastFrame<50||camera.video.currentTime===s.lastTime){if(time-s.lastResult>900)resetInput();return;}
  s.busy=true;s.lastFrame=time;s.lastTime=camera.video.currentTime;
  try{
   const video=camera.video,f=region();input.width=640;input.height=Math.round(640/(f.width*sourceAspect()/f.height));
   ctx.drawImage(video,f.left*video.videoWidth,f.top*video.videoHeight,f.width*video.videoWidth,f.height*video.videoHeight,0,0,input.width,input.height);
   const result=await s.detector.detect(input,time);if(session!==s||!live())return;
   s.frames=(s.frames||0)+1;
   s.lastResult=performance.now();picture.width=input.width;picture.height=input.height;paint.drawImage(input,0,0);
   paint.lineWidth=2;paint.strokeStyle='#b8f3cc';
   for(const points of result.landmarks){for(const chain of [[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[17,0]]){paint.beginPath();chain.forEach((n,i)=>{const p=points[n];if(i)paint.lineTo(p.x*input.width,p.y*input.height);else paint.moveTo(p.x*input.width,p.y*input.height);});paint.stroke();}}
   feed(result,time,input.width/input.height);
  }catch(error){if(session===s){s.failed=true;settings();setupNote('Hand tracking paused. Close and reopen Hands to retry.');$('hand-start').disabled=true;}}
  finally{s.busy=false;}
 }
 $('immerse').onclick=()=>setImmersive(!immersive);
 $('imm-controls').onclick=()=>setPanel(!root.host.classList.contains('immersive-panel'));
 $('close-imm-controls').onclick=()=>{setPanel(false);$('imm-controls').focus();};
 $('imm-play').onclick=()=>{resetInput();api.snapshot().state.atoms.length?api.play():api.load();};
 $('imm-reset').onclick=()=>{resetInput();api.reset();};
 $('imm-progress').oninput=e=>{resetInput();$('progress').value=e.target.value;$('progress').dispatchEvent(new Event('input',{bubbles:true}));};
 $('hands-open').onclick=settings;$('hand-enable').onclick=enable;$('hand-start').onclick=start;
 $('hand-close').onclick=()=>stopHands();$('hand-stop').onclick=()=>stopHands();$('hand-settings').onclick=settings;
 $('hand-bar-exit').onclick=()=>stopHands();$('hand-bar-settings').onclick=settings;
 dialog.addEventListener('cancel',e=>{e.preventDefault();stopHands();});
 dialog.addEventListener('close',()=>{dialog.removeAttribute('data-by-hand');resetInput();syncImmHands();});
 $('hand-mirror').onclick=()=>{resetInput();camera.flip();syncFrame();};
 $('hand-switch').onclick=async()=>{resetInput();$('hand-switch').disabled=true;try{await camera.switchDevice();$('hand-preview-video').srcObject=camera.video.srcObject;await $('hand-preview-video').play();syncFrame();}catch{setupNote('That camera could not open. Keep the current camera or retry.');}finally{$('hand-switch').disabled=false;}};
 function position(x,y){center={x:clamp(x,0,1),y:clamp(y,0,1)};resetInput();syncFrame();}
 $('hand-preview').onpointerdown=e=>{const r=e.currentTarget.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;position(camera.mirrored?1-x:x,(e.clientY-r.top)/r.height);};
 $('hand-preview').onkeydown=e=>{const d={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]}[e.key];if(d){e.preventDefault();position(center.x+d[0]*(camera.mirrored?-1:1),center.y+d[1]);}};
 $('hand-frame-width').oninput=()=>{resetInput();syncFrame();};
 for(const el of root.querySelectorAll('[data-frame-width]'))el.onclick=()=>{$('hand-frame-width').value=el.dataset.frameWidth;syncFrame();};
 for(const [id,key] of [['hand-grasp','close'],['hand-release','open'],['hand-zoom','zoomSensitivity']])$(id).oninput=()=>{preferences[key]=+$(id).value;$(id+'-value').textContent=$(id).value+'%';resetInput();gestures.settings=handSettings(preferences);};
 $('hand-pinch').onchange=e=>{preferences.pinch=e.target.checked;gestures.settings=handSettings(preferences);resetInput();};
 $('hand-rotate').onclick=()=>setMode('rotate');$('hand-move').onclick=()=>setMode('move');
 $('hand-zoom-out').onclick=()=>controls()?.zoom(.9);$('hand-zoom-in').onclick=()=>controls()?.zoom(1.1);
 camera.events.addEventListener('change',()=>{if(session&&!camera.has('hands'))stopHands({focus:false});});
 window.addEventListener('pointerdown',e=>{if(session?.running||dialog.hasAttribute('data-by-hand')){physicalPointers.add(e.pointerId);resetInput();}},true);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(type,e=>physicalPointers.delete(e.pointerId),true);
 window.addEventListener('blur',()=>{physicalPointers.clear();resetInput();});
 window.addEventListener('resize',()=>{resetInput();syncFrame();});
 window.addEventListener('pagehide',()=>stopHands({focus:false}));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stopHands({focus:false});});
 root.addEventListener('keydown',e=>{if(!api.isActive()||e.key!=='Escape'||root.querySelector('dialog[open]'))return;if(!$('shelf').hidden){e.preventDefault();api.library(false,{focus:true});return;}if(root.host.classList.contains('immersive-panel')){e.preventDefault();setPanel(false);$('imm-controls').focus();}else if(immersive){e.preventDefault();setImmersive(false);}});
 return {sync,resetInput,deactivate(){if(immersive)setImmersive(false);stopHands({focus:false});physicalPointers.clear();},isImmersive:()=>immersive,focusPlay:()=>$(immersive?'imm-play':'play').focus({preventScroll:true}),openHands:()=>{if(!api.isActive())return;if(session?.running)stopHands();else settings();},probe:(x,y)=>{const scope=gestureScope();return {scope,command:commandAt(x,y,scope),model:onModel(x,y,scope)};},
  // Test hook: the effect of a close and open without moving at (x,y) on the model.
  tapAt:(x,y)=>{const scope=gestureScope();if(!session?.running||!onModel(x,y,scope))return null;const atom=closestAtom(x,y);if(atom)tapOn(atom.id);return atom?.id??null;},snapshot:()=>({immersive,handsOn:!!session?.running,cameraOn:!!session&&!!camera.video,handMode:mode,grips:active.size,frames:session?.frames||0,dialogHands:dialog.hasAttribute('data-by-hand')})};
}
