import {HandGestures,steadyHandMotion,playerFrame} from './view-gestures.js';
import {createHandOutliner} from './palm-outline.js';
import {cameraRect,CAMERA_SIZE_KEY,DEFAULT_CAMERA_SIZE,savedCameraSize,heldHandCrop} from './camera-framing.js';
import {PIPETTES} from './pipettes.js';

const $=id=>document.getElementById(id);
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));

export class StudioExperience {
  constructor({source,hands,renderer,scene,canvas,suspend,stopFollowing,changed,trackingChanged,openNotebook}){
    Object.assign(this,{source,hands,renderer,scene,canvas,suspend,stopFollowing,changed,trackingChanged});
    this.mode='work';this.trace=createHandOutliner({cameraImage:false});this.navigation=new HandGestures();
    this.navigationAnchor=null;this.zoomSpan=null;this.frameCenter={x:.5,y:.5};this.frameWidth=.8;this.frameRevision=0;
    this.cameraSize=DEFAULT_CAMERA_SIZE;
    try{this.cameraSize=savedCameraSize(localStorage.getItem(CAMERA_SIZE_KEY))}catch{}
    this.framingPalm=null;this.framingHand=null;
    this.inputCanvas=document.createElement('canvas');
    this.detailCanvas=document.createElement('canvas');
    this.cameraFrame=document.createElement('canvas');this.cameraFrame.readyState=0;this.cameraFrame.currentTime=-1;
    this.immersive=false;this.roomRequest=0;this.deviceCount=0;
    this.traceCanvas=$('palmTrace');this.workHelp=$('modeHelp').textContent;
    this.cameraPlane=$('benchCameraFrame');this.roomMapFrame=$('roomImageFrame');
    this.hud=$('handHud');
    this.lock=$('hudLock');
    this.hands.studio=this;
    this.hands.camera.frameSource=video=>this.captureFrame(video);
    const preview=$('handPreview');
    preview.onpointerdown=e=>{
      const frame=$('handImageFrame').getBoundingClientRect();
      const x=(e.clientX-frame.left)/frame.width,y=(e.clientY-frame.top)/frame.height;
      if(x>=0&&x<=1&&y>=0&&y<=1)this.positionFrame(this.source.mirrored?1-x:x,y);
    };
    preview.onkeydown=e=>{const delta={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]}[e.key];if(delta){e.preventDefault();this.positionFrame(this.frameCenter.x+delta[0]*(this.source.mirrored?-1:1),this.frameCenter.y+delta[1])}};
    hands.video.addEventListener('loadedmetadata',()=>this.drawPlayerFrame());
    new ResizeObserver(([entry])=>{
      canvas.parentElement.style.setProperty('--bench-height',entry.contentRect.height+'px');
      this.positionFrame(this.frameCenter.x,this.frameCenter.y);
    }).observe(canvas);
    new ResizeObserver(([entry])=>{
      document.body.style.setProperty('--station-controls-height',entry.contentRect.height+'px');
    }).observe(document.querySelector('.station-actions'));
    for(const id of ['handCameraSize','roomCameraSize'])$(id).oninput=e=>this.setCameraSize(Number(e.target.value)/100);
    $('immerseButton').onclick=()=>this.immerse(true);
    $('exitImmersive').onclick=()=>this.immerse(false);
    $('immersiveProtocol').onclick=()=>this.protocol(!document.body.classList.contains('protocol-open'));
    $('immersiveNotebook').onclick=openNotebook;
    $('cameraButton').onclick=()=>{
      if(hands.camera.running||source.owners.size)this.stop();
      else this.activateRoom();
    };
    $('cameraSettingsButton').onclick=()=>this.cameraPanel($('cameraPanel').hidden);
    $('cameraClose').onclick=()=>{this.cameraPanel(false);$('cameraSettingsButton').focus()};
    $('handButton').addEventListener('click',()=>{
      if(!hands.panel.hidden)this.suspendForPanel();
      hands.resetInput();
      this.cameraPanel(false);this.protocol(false);
    });
    $('photoRoom').onclick=()=>{this.roomRequest++;source.release('room');this.syncCamera()};
    $('liveRoom').onclick=()=>this.activateRoom();
    $('mirrorCamera').onchange=e=>{
      hands.lost();this.frameRevision++;hands.lastRaw=null;this.framingPalm=null;
      source.mirror(e.target.checked);this.drawPlayerFrame();
    };
    $('switchCamera').onclick=async()=>{
      $('switchCamera').disabled=true;
      try{await source.switchDevice()}catch{$('roomStatus').textContent='Could not open that camera. The current view is still available.'}
      finally{$('switchCamera').disabled=false}
    };
    document.querySelectorAll('[data-hand-mode]').forEach(b=>b.onclick=()=>this.setMode(b.dataset.handMode));
    document.querySelectorAll('[data-quick-mode]').forEach(b=>b.onclick=()=>{
      this.setMode(b.dataset.quickMode);
      if(!hands.camera.running&&hands.panel.hidden)$('handButton').click();
    });
    $('handStart').onclick=async()=>{
      if(hands.camera.running){hands.stop();return}
      if(await hands.camera.start()&&hands.camera.modelReady&&!hands.panel.hidden){
        $('handBegin').hidden=false;this.drawPlayerFrame();
        hands.hint='Show an open palm.';
      }
    };
    $('handBegin').onclick=()=>{
      $('handClose').click();
      document.querySelector('[data-quick-mode][aria-pressed=true]').focus({preventScroll:true});
    };
    source.addEventListener('change',()=>this.syncCamera());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop()});
    window.addEventListener('pagehide',()=>this.stop());
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape'||document.querySelector('dialog[open]')||e.defaultPrevented)return;
      if(!$('cameraPanel').hidden)$('cameraClose').click();
      else if(!hands.panel.hidden){$('handClose').click();$('handButton').focus()}
      else if(document.body.classList.contains('protocol-open')){this.protocol(false);$('immersiveProtocol').focus()}
      else if(this.immersive)this.immerse(false);
    });
    document.querySelectorAll('.dock-entry').forEach(el=>el.addEventListener('toggle',()=>{if(el.open)this.cameraPanel(false)}));
    this.syncCamera();
  }
  suspendForPanel(){
    if(this.hands.busy||this.hands.interaction.tool){
      this.suspend('Controls open. Regrasp the tool to resume.');this.hands.lost();
    }
  }
  cameraPanel(show){
    $('cameraPanel').hidden=!show;$('cameraSettingsButton').setAttribute('aria-expanded',String(show));
    if(show){
      this.suspendForPanel();this.hands.panel.hidden=true;$('handButton').setAttribute('aria-expanded','false');this.protocol(false);
      $('cameraClose').focus({preventScroll:true});
    }
    this.changed();
  }
  protocol(show){
    document.body.classList.toggle('protocol-open',show&&this.immersive);
    $('immersiveProtocol').setAttribute('aria-expanded',String(show&&this.immersive));
    if(show){this.suspendForPanel();this.cameraPanel(false);this.hands.panel.hidden=true;$('handButton').setAttribute('aria-expanded','false')}
    this.changed();
  }
  immerse(on){
    if(this.immersive===on)return;
    this.suspend('View changed. Regrasp a carried tool to continue.');
    this.hands.lost();this.immersive=on;this.protocol(false);
    document.body.classList.toggle('studio-immersive',on);
    $('immerseButton').setAttribute('aria-pressed',String(on));
    $('exitImmersive').hidden=$('immersiveActions').hidden=!on;
    this.renderer.resize();this.scene.refitView();this.syncCamera();
    $(on?'exitImmersive':'immerseButton').focus({preventScroll:true});
  }
  async activateRoom(){
    const request=++this.roomRequest;
    $('roomStatus').textContent='Opening camera…';$('liveRoom').disabled=true;
    try{await this.source.use('room');if(request===this.roomRequest)this.syncCamera()}
    catch(error){
      if(request===this.roomRequest){
        this.cameraPanel(true);
        this.syncCamera();
        $('roomStatus').textContent=error.name==='NotAllowedError'?'Camera access was declined. You can retry or use the lab interior.':
          error.name==='NotFoundError'?'No camera was found. The lab interior is ready.':'Camera unavailable. Reconnect it and try again.';
      }
    }finally{if(request===this.roomRequest)$('liveRoom').disabled=this.source.owners.has('room')}
  }
  syncCamera(){
    const feed=this.source,video=feed.video,room=!!video&&feed.owners.has('room');
    const tracking=this.hands.camera.running;
    document.body.classList.toggle('hand-console',this.immersive&&tracking);
    this.renderer.mirrored=feed.mirrored;
    $('photoRoom').setAttribute('aria-pressed',String(!room));$('liveRoom').setAttribute('aria-pressed',String(room));
    $('liveRoom').disabled=room||(!video&&feed.owners.has('room'));
    const powered=tracking||feed.owners.size>0;
    $('cameraButton').classList.toggle('camera-on',powered);
    $('cameraButton').setAttribute('aria-pressed',String(powered));
    $('cameraButton').title=powered?'Turn off camera and hand tracking':'Turn on room camera';
    $('deviceTools').hidden=!video;$('mirrorCamera').checked=feed.mirrored;
    this.hands.video.style.transform=feed.mirrored?'scaleX(-1)':'none';
    $('liveHandModes').hidden=!this.immersive&&!tracking;
    $('roomStatus').textContent=!video&&feed.owners.has('room')?'Opening camera…':room?'Live room background on.':tracking&&this.immersive?'Lab interior with palm outline.':tracking?'Hands camera active.':'The lab interior is active.';
    if(this.lastVideo!==video){
      this.lastVideo=video;this.deviceCount=0;$('switchCamera').hidden=true;
      this.cameraFrame.readyState=0;this.renderer.videoTime=-1;
      this.frameCenter={x:.5,y:.5};this.framingPalm=this.framingHand=null;this.frameRevision++;this.hands.lastRaw=null;this.clearHands();
      if(video)feed.inputs().then(list=>{if(feed.video===video){this.deviceCount=list.length;$('switchCamera').hidden=list.length<2}});
    }
    this.updateBackdrop();this.drawPlayerFrame();
    this.changed();
  }
  updateBackdrop(){
    const room=this.source.owners.has('room');
    const showFrame=this.hands.camera.running&&(!this.immersive||room)&&this.cameraFrame.readyState>=2;
    const backdrop=showFrame?this.cameraFrame:room?this.source.video:null;
    if(this.renderer.roomVideo!==backdrop){this.renderer.roomVideo=backdrop;this.renderer.videoTime=-1}
  }
  stop(){
    this.roomRequest++;this.hands.stop();this.source.stopAll();this.clearHands();this.syncCamera();
  }
  setMode(mode){
    if(mode===this.mode)return;
    this.suspend('Hand mode changed. Regrasp a carried tool to resume.');
    this.hands.lost();this.mode=mode;
    document.querySelectorAll('[data-hand-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.handMode===mode)));
    document.querySelectorAll('[data-quick-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.quickMode===mode)));
    $('bulbSetting').hidden=$('bulbHelp').hidden=mode==='view';
    $('modeHelp').textContent=mode==='work'?this.workHelp:'Close one hand to orbit. Spread two closed hands to zoom.';
    this.hands.hint=mode==='work'?'Open your palm over a grip.':'Open your palm to begin.';
    this.changed();
  }
  clearHands(){
    this.detectorCrop=null;
    for(const canvas of [this.traceCanvas,this.hands.overlay]){
      const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    }
    this.resetNavigation();
  }
  resetNavigation(){this.navigation.reset();this.command=null;this.navigationAnchor=this.zoomSpan=null}
  clearCameraFrames(){
    for(const canvas of [this.cameraFrame,this.inputCanvas,this.detailCanvas])canvas.width=canvas.height=1;
    this.detectorCrop=null;this.cameraFrame.readyState=0;this.cameraFrame.currentTime=-1;
  }
  get videoAspect(){
    const video=this.source.video||this.hands.video;
    return (video.videoWidth||640)/(video.videoHeight||480);
  }
  get benchAspect(){return (this.canvas.clientWidth||1)/(this.canvas.clientHeight||1)}
  region(){
    return playerFrame(this.frameCenter,this.frameWidth,this.videoAspect,this.benchAspect);
  }
  positionFrame(x,y){
    const f=this.region();
    this.frameCenter={x:clamp(x,f.width/2,1-f.width/2),y:clamp(y,f.height/2,1-f.height/2)};
    this.frameRevision++;this.framingPalm=null;this.hands.lost();this.drawPlayerFrame();
  }
  centerOnHand(){
    const p=this.hands.lastRaw;if(!p)return;
    this.positionFrame(this.source.mirrored?1-p.x:p.x,p.y);
  }
  setFrameWidth(width){this.frameWidth=clamp(width,.2,.95);this.positionFrame(this.frameCenter.x,this.frameCenter.y)}
  setCameraSize(size){
    this.cameraSize=savedCameraSize(size);
    try{localStorage.setItem(CAMERA_SIZE_KEY,String(this.cameraSize))}catch{}
    this.frameRevision++;this.hands.lost();this.drawPlayerFrame();this.changed();
  }
  placeCamera(){
    const area=this.region();
    if(this.source.mirrored)area.left=1-area.left-area.width;
    const tracking=this.hands.camera.running;
    const rect=cameraRect(this.videoAspect,this.benchAspect,this.cameraSize,tracking?area:undefined,tracking?this.framingPalm:null);
    const prev=this.renderer.roomVideoRect;
    if(this.cameraPlane.style.width&&prev&&rect.left===prev.left&&rect.top===prev.top&&rect.width===prev.width&&rect.height===prev.height)return;
    this.renderer.roomVideoRect=rect;
    const bounds={left:rect.left*100+'%',top:rect.top*100+'%',width:rect.width*100+'%',height:rect.height*100+'%'};
    Object.assign(this.cameraPlane.style,bounds);
    Object.assign(this.roomMapFrame.style,bounds);
  }
  drawPlayerFrame(){
    const preview=$('handPreview'),box=$('handPlayerFrame');if(!preview||!box)return;
    const f=this.region();
    preview.style.aspectRatio=String(this.videoAspect);
    preview.style.setProperty('--preview-aspect',String(this.videoAspect));
    const left=this.source.mirrored?1-f.left-f.width:f.left;
    const style={left:left*100+'%',top:f.top*100+'%',width:f.width*100+'%',height:f.height*100+'%'};
    Object.assign(box.style,style);
    this.hands.overlay.style.transform=this.traceCanvas.style.transform=this.source.mirrored?'scaleX(-1)':'none';
    $('handGain').value=String(Math.round(this.frameWidth*100));$('handGainValue').textContent=Math.round(this.frameWidth*100)+'%';
    const percent=Math.round(this.cameraSize*100);
    preview.style.setProperty('--webcam-scale',percent+'%');
    $('roomMap').style.setProperty('--bench-aspect',String(this.benchAspect));
    for(const id of ['handCameraSize','roomCameraSize']){
      $(id).value=String(percent);$(id).setAttribute('aria-valuetext',percent+'% of fitted webcam size');$(id+'Value').textContent=percent+'%';
    }
    this.placeCamera();
  }
  captureFrame(video){
    const sw=video.videoWidth,sh=video.videoHeight;
    const scale=Math.min(1,640/Math.max(sw,sh)),width=Math.max(1,Math.round(sw*scale)),height=Math.max(1,Math.round(sh*scale));
    if(this.inputCanvas.width!==width||this.inputCanvas.height!==height){this.inputCanvas.width=width;this.inputCanvas.height=height}
    const ctx=this.inputCanvas.getContext('2d',{alpha:false});ctx.drawImage(video,0,0,width,height);
    const exposure={image:this.inputCanvas,revision:this.frameRevision};
    const h=this.hands,owner=h.gestures.hands.find(hand=>hand.id===h.primary);
    if(!h.panel.hidden||this.mode!=='work'||h.interaction.owner!=='hand'||!h.interaction.holdsPipette||!owner?.grip||owner.missing||h.missedCarry){
      this.detectorCrop=null;return exposure;
    }
    const crop=heldHandCrop(owner.points,sw,sh,this.source.mirrored,this.detectorCrop);
    this.detectorCrop=crop;
    const detail=this.detailCanvas,size=Math.min(480,crop.size);
    if(detail.width!==size||detail.height!==size)detail.width=detail.height=size;
    detail.getContext('2d',{alpha:false}).drawImage(video,crop.left,crop.top,crop.size,crop.size,0,0,size,size);
    exposure.detectorImage=detail;
    exposure.crop={left:crop.left/sw,top:crop.top/sh,width:crop.size/sw,height:crop.size/sh};
    return exposure;
  }
  mapHand(event,packet){
    const rect=packet.frame?this.renderer.roomVideoRect:null;
    const x=rect?rect.left+event.x*rect.width:event.x,y=rect?rect.top+event.y*rect.height:event.y;
    return {x:x*this.canvas.clientWidth,y:y*this.canvas.clientHeight};
  }
  paint(packet,anchor){
    const frame=packet.frame;if(!frame)return;
    if(packet.frameRevision!==undefined&&packet.frameRevision!==this.frameRevision)return;
    if(anchor?.palm){this.framingPalm=anchor.palm;this.framingHand=anchor.id}
    this.placeCamera();
    // The outline, displayed webcam exposure and grip share this one placement.
    const benchScale=this.immersive?this.renderer.roomVideoRect.width*this.canvas.clientWidth/frame.width:null;
    this.trace(this.traceCanvas,frame,packet,benchScale);
    // Keep the accepted exposure for WebGL while the detector reads the next one.
    if(frame===this.inputCanvas){
      this.inputCanvas=this.cameraFrame;this.cameraFrame=frame;
    }else{
      const copy=this.cameraFrame;
      if(copy.width!==frame.width||copy.height!==frame.height){copy.width=frame.width;copy.height=frame.height}
      copy.getContext('2d',{alpha:false}).drawImage(frame,0,0);
    }
    const picture=this.cameraFrame;
    picture.readyState=2;picture.videoWidth=picture.width;picture.videoHeight=picture.height;picture.currentTime=packet.stamp/1000;
    if(!this.hands.panel.hidden){
      const preview=this.hands.overlay,width=Math.min(480,picture.width),height=Math.round(width*picture.height/picture.width);
      if(preview.width!==width||preview.height!==height){preview.width=width;preview.height=height}
      const small=preview.getContext('2d');small.drawImage(picture,0,0,width,height);small.drawImage(this.traceCanvas,0,0,width,height);
    }
    if(this.hands.camera.running){this.updateBackdrop();this.trackingChanged()}
  }
  updateHud(step,focus){
    const h=this.hands,c=h.interaction,tracking=h.camera.running,view=tracking&&this.mode==='view';
    const bench=this.immersive&&h.panel.hidden&&$('cameraPanel').hidden&&!h.layout.active&&!document.querySelector('dialog[open]');
    const procedure=$('hudProcedure');
    procedure.hidden=!bench||document.body.classList.contains('protocol-open');
    const scale=$('wavelengthScale');
    scale.hidden=!this.immersive;
    const set=(id,text)=>{const el=$(id);if(el.textContent!==text)el.textContent=text};
    if(!scale.hidden){
      const wavelength=c.getState().wavelength;
      set('scaleValue',wavelength+' nm');
      scale.style.setProperty('--wavelength',(clamp((wavelength-400)/300)*100)+'%');
    }
    if(!procedure.hidden){
      const completed=step.index===step.total;
      set('visorStep',completed?'Complete':String(step.index+1).padStart(2,'0')+' / '+step.total);
      set('visorInstruction',step.instruction);
      procedure.style.setProperty('--progress',(completed?100:step.index/step.total*100)+'%');
    }
    this.hud.hidden=!bench||!c.usable();
    if(this.hud.hidden){this.lock.hidden=true;return}
    const held=!!c.owner,usingHands=tracking&&(!held||c.owner==='hand'),visible=!usingHands||!h.cursor.hidden;
    const target=held?(c.contact?.target||c.hoverTarget):visible?c.hoverRegion:null;
    const next=!usingHands&&!held&&!target?c.nextTarget():null;
    const acting=this.navigation.hands.filter(hand=>!hand.missing);
    const closed=acting.filter(hand=>hand.grip).length;
    this.hud.dataset.view=String(view);
    set('hudTargetLabel',view?'View gesture':held?'Tip target':usingHands?'Palm target':next?'Next target':'Pointer target');
    const id=target||next,markName=id?.endsWith('-grip')&&PIPETTES[id.slice(0,-5)]?.mark;
    const targetName=markName?markName[0]+markName.slice(1).toLowerCase()+' pipette':id?c.targetName(id):'No target';
    set('hudTarget',view?(closed>=2?'Zoom':closed?'Orbit':'Open palm'):targetName);
    set('hudGripLabel',view?'Tracking':held&&visible?'Holding':'Grip');
    let grip='Searching';
    if(usingHands&&!h.camera.modelReady)grip='Starting camera';
    else if(view)grip=acting.length===2?'Two hands':acting.length===1?'One hand':'Searching';
    else if(held){
      const mark=PIPETTES[c.tool]?.mark;
      grip=visible?(mark?mark[0]+mark.slice(1).toLowerCase()+' pipette':c.targetName(c.tool)):'Hold paused';
    }
    else if(c.frozen)grip='Regrasp tool';
    else if(!usingHands)grip='No tool held';
    else if(visible)grip=h.cursor.dataset.pose==='open'?'Open palm':h.gate.holding?'Closed · empty':'Aiming';
    set('hudGrip',grip);
    const volume=c.holdsPipette?c.getState()[c.tool].volume:null;
    this.hud.dataset.flow=c.flow?'active':'idle';
    const targetDose=volume===null&&step.pipetteId?step.volume:null;
    const display=volume??targetDose;
    set('hudFlow',c.flow?(c.flowAction==='aspirate'?'Drawing':'Dispensing'):
      volume!==null&&(c.frozen||h.pausedStroke)?'Paused':targetDose!==null?'Dose target':'Pipette');
    set('hudVolume',display===null?'—':display.toFixed(1)+' mL');
    this.hud.style.setProperty('--dial-level',String(clamp((display||0)/10)*75));
    this.hud.style.setProperty('--index-angle',(clamp((display||0)/10)*270-135)+'deg');
    const mark=!view&&visible&&!c.frozen&&target===focus.id?focus.screen:null;
    this.lock.hidden=!mark?.visible;
    if(mark?.visible){
      const radius=Math.round(clamp(mark.radius+6,15,52));
      this.lock.style.width=this.lock.style.height=2*radius+'px';
      this.lock.style.transform='translate('+Math.round(mark.x-radius)+'px,'+Math.round(mark.y-radius)+'px)';
      this.lock.dataset.state=c.flow?'flow':c.contact?'seated':'aim';
    }
    if(usingHands&&held&&c.flow)return 'Hold steady.';
    if(!usingHands&&!held&&!c.frozen&&next?.endsWith('-grip')){
      return next==='cuvette-grip'?'Drag the rim to pick it up.':'Drag the handle to pick it up.';
    }
  }
  targetAt(point){
    const rect=this.canvas.getBoundingClientRect();
    return document.elementFromPoint(rect.left+point.x,rect.top+point.y);
  }
  blockWorkAt(point,event,holding){
    const target=this.targetAt(point);
    if(holding||target===this.canvas){this.command=null;return false}
    const button=target?.closest('button,summary');
    if(event.phase==='press')this.command={button,id:event.id};
    if(event.phase==='release'){
      if(button&&!button.disabled&&button===this.command?.button&&event.id===this.command.id)queueMicrotask(()=>button.click());
      this.command=null;
    }
    return true;
  }
  handleViewPacket(packet){
    if(this.mode!=='view')return false;
    this.hands.cursor.hidden=true;
    if(document.querySelector('dialog[open]')||this.hands.getState().status!=='running'){
      this.clearHands();return true;
    }
    const aspect=packet.frame?packet.frame.width/packet.frame.height:this.canvas.clientWidth/this.canvas.clientHeight;
    const events=this.navigation.update(packet,packet.stamp,aspect,this.source.mirrored);
    const visible=events.filter(e=>e.points),contacts=[];
    this.paint(packet,visible.find(e=>e.id===this.framingHand)||visible[0]);
    visible.forEach(e=>{
      const center=this.mapHand(e,packet);
      if(e.grip&&e.phase!=='release'&&this.targetAt(center)===this.canvas)contacts.push({id:e.id,...center});
      const button=this.targetAt(center)?.closest('button,summary');
      if(e.phase==='press'&&button&&!button.disabled)this.command={id:e.id,button};
      if(e.phase==='release'&&this.command?.id===e.id){
        const activate=this.command.button===button;this.command=null;
        if(activate)queueMicrotask(()=>button.click());
      }
    });
    if(visible.length){
      this.hands.lastSeen=performance.now();this.hands.lastRaw={...visible[0].palm};
      this.hands.refresh();
    }
    const cam=this.renderer.cam;
    let moved=false;
    if(contacts.length===2){
      const span=Math.hypot(contacts[1].x-contacts[0].x,contacts[1].y-contacts[0].y);
      if(this.zoomSpan&&span>20&&Math.abs(this.zoomSpan-span)>2){
        cam.distance=clamp(cam.distance*this.zoomSpan/span,.6,23);this.zoomSpan=span;moved=true;
      }else if(!this.zoomSpan&&span>20)this.zoomSpan=span;
      this.navigationAnchor=null;
    }else if(contacts.length===1){
      this.zoomSpan=null;const one=contacts[0];
      const delta=steadyHandMotion(this.navigationAnchor?.id===one.id?this.navigationAnchor:null,one,3);
      this.navigationAnchor={id:one.id,...delta};
      if(delta.dx||delta.dy){cam.yaw-=delta.dx*.005;cam.pitch=clamp(cam.pitch+delta.dy*.004,.18,1.42);moved=true}
    }else{this.zoomSpan=this.navigationAnchor=null}
    if(events.some(e=>e.phase==='missing'||e.phase==='lost'))this.command=null;
    if(moved){this.stopFollowing();this.scene.viewSelection=null;this.renderer.updateCamera();this.changed()}
    return true;
  }
}
