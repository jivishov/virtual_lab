import {HandGestures,steadyHandMotion,playerFrame} from './view-gestures.js';
import {createHandOutliner} from './palm-outline.js';
import {cameraRect,CAMERA_SIZE_KEY,DEFAULT_CAMERA_SIZE,savedCameraSize} from './camera-framing.js';

const $=id=>document.getElementById(id);
const clamp=(v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));

export class StudioExperience {
  constructor({source,hands,renderer,scene,canvas,suspend,stopFollowing,changed,openNotebook}){
    Object.assign(this,{source,hands,renderer,scene,canvas,suspend,stopFollowing,changed});
    this.mode='work';this.trace=createHandOutliner({cameraImage:false});this.navigation=new HandGestures();
    this.navigationAnchor=null;this.zoomSpan=null;this.frameCenter={x:.5,y:.5};this.frameWidth=.8;this.frameRevision=0;
    this.cameraSize=DEFAULT_CAMERA_SIZE;
    try{this.cameraSize=savedCameraSize(localStorage.getItem(CAMERA_SIZE_KEY))}catch{}
    this.framingPalm=null;this.framingHand=null;
    this.inputCanvas=document.createElement('canvas');
    this.cameraFrame=document.createElement('canvas');this.cameraFrame.readyState=0;this.cameraFrame.currentTime=-1;
    this.immersive=false;this.roomRequest=0;this.deviceCount=0;
    this.traceCanvas=$('palmTrace');this.workHelp=$('modeHelp').textContent;
    this.hands.studio=this;
    this.hands.camera.frameSource=video=>this.captureFrame(video);
    const preview=$('handPreview');
    preview.onpointerdown=e=>{const r=preview.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;this.positionFrame(this.source.mirrored?1-x:x,(e.clientY-r.top)/r.height)};
    preview.onkeydown=e=>{const delta={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]}[e.key];if(delta){e.preventDefault();this.positionFrame(this.frameCenter.x+delta[0]*(this.source.mirrored?-1:1),this.frameCenter.y+delta[1])}};
    hands.video.addEventListener('loadedmetadata',()=>this.drawPlayerFrame());
    new ResizeObserver(()=>this.positionFrame(this.frameCenter.x,this.frameCenter.y)).observe(canvas);
    for(const id of ['handCameraSize','roomCameraSize'])$(id).oninput=e=>this.setCameraSize(Number(e.target.value)/100);
    $('immerseButton').onclick=()=>this.immerse(true);
    $('exitImmersive').onclick=()=>this.immerse(false);
    $('immersiveProtocol').onclick=()=>this.protocol(!document.body.classList.contains('protocol-open'));
    $('immersiveNotebook').onclick=openNotebook;
    $('cameraButton').onclick=()=>this.cameraPanel($('cameraPanel').hidden);
    $('cameraClose').onclick=()=>{this.cameraPanel(false);$('cameraButton').focus()};
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
    document.querySelectorAll('[data-quick-mode]').forEach(b=>b.onclick=()=>this.setMode(b.dataset.quickMode));
    $('handStart').onclick=async()=>{
      if(hands.camera.running){hands.stop();return}
      if(await hands.camera.start()&&hands.camera.modelReady&&!hands.panel.hidden){
        $('handBegin').hidden=false;this.drawPlayerFrame();
        hands.hint.textContent='Center the reach area where your hand rests. Open and close your hand to check the outline.';
      }
    };
    $('handBegin').onclick=()=>{$('handClose').click();$('quickHandMode').focus({preventScroll:true})};
    $('handOff').onclick=()=>this.stop();
    source.addEventListener('change',()=>this.syncCamera());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop()});
    window.addEventListener('pagehide',()=>this.stop());
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape'||document.querySelector('dialog[open]')||e.defaultPrevented)return;
      if(!$('cameraPanel').hidden){this.cameraPanel(false);$('cameraButton').focus()}
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
    $('cameraPanel').hidden=!show;$('cameraButton').setAttribute('aria-expanded',String(show));
    if(show){this.suspendForPanel();this.hands.panel.hidden=true;$('handButton').setAttribute('aria-expanded','false');this.protocol(false)}
  }
  protocol(show){
    document.body.classList.toggle('protocol-open',show&&this.immersive);
    $('immersiveProtocol').setAttribute('aria-expanded',String(show&&this.immersive));
    if(show){this.suspendForPanel();this.cameraPanel(false);this.hands.panel.hidden=true;$('handButton').setAttribute('aria-expanded','false')}
  }
  immerse(on){
    if(this.immersive===on)return;
    this.suspend('View changed. Regrasp a carried tool to continue.');
    this.hands.lost();this.immersive=on;this.protocol(false);
    document.body.classList.toggle('studio-immersive',on);
    $('immerseButton').setAttribute('aria-pressed',String(on));
    $('exitImmersive').hidden=$('immersiveActions').hidden=!on;
    this.renderer.resize();this.scene.refitView();this.changed();
    $(on?'exitImmersive':'immerseButton').focus({preventScroll:true});
  }
  async activateRoom(){
    const request=++this.roomRequest;
    $('roomStatus').textContent='Opening camera…';$('liveRoom').disabled=true;
    try{await this.source.use('room');if(request===this.roomRequest)this.syncCamera()}
    catch(error){
      if(request===this.roomRequest){
        this.syncCamera();
        $('roomStatus').textContent=error.name==='NotAllowedError'?'Camera access was declined. You can retry or use the lab interior.':
          error.name==='NotFoundError'?'No camera was found. The lab interior is ready.':'Camera unavailable. Reconnect it and try again.';
      }
    }finally{if(request===this.roomRequest)$('liveRoom').disabled=this.source.owners.has('room')}
  }
  syncCamera(){
    const feed=this.source,video=feed.video,room=!!video&&feed.owners.has('room');
    const tracking=this.hands.camera.running;
    const backdrop=tracking&&this.cameraFrame.readyState>=2?this.cameraFrame:room?video:null;
    if(this.renderer.roomVideo!==backdrop){this.renderer.roomVideo=backdrop;this.renderer.videoTime=-1}
    this.renderer.mirrored=feed.mirrored;
    $('photoRoom').setAttribute('aria-pressed',String(!room));$('liveRoom').setAttribute('aria-pressed',String(room));
    $('liveRoom').disabled=room||(!video&&feed.owners.has('room'));
    $('cameraButton').classList.toggle('camera-on',room);
    $('deviceTools').hidden=!video;$('mirrorCamera').checked=feed.mirrored;
    this.hands.video.style.transform=feed.mirrored?'scaleX(-1)':'none';
    $('handOff').hidden=!(room||tracking||feed.owners.size);$('liveControls').hidden=$('handOff').hidden;
    $('liveHandModes').hidden=!tracking;
    $('roomStatus').textContent=tracking?'Hands and the live view share the same camera size.':room?'Live room background on.':video?'Lab interior active. The camera is available for hands.':'The lab interior is active.';
    if(this.lastVideo!==video){
      this.lastVideo=video;this.deviceCount=0;$('switchCamera').hidden=true;
      this.cameraFrame.readyState=0;this.renderer.roomVideo=room?video:null;this.renderer.videoTime=-1;
      this.frameCenter={x:.5,y:.5};this.framingPalm=this.framingHand=null;this.frameRevision++;this.hands.lastRaw=null;this.clearHands();
      if(video)feed.inputs().then(list=>{if(feed.video===video){this.deviceCount=list.length;$('switchCamera').hidden=list.length<2}});
    }
    this.drawPlayerFrame();
    this.changed();
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
    $('modeHelp').textContent=mode==='work'?this.workHelp:'Open to arm, then close one palm and drag to orbit. Close both palms and spread them apart to zoom in. Open to stop.';
    this.hands.hint.textContent=mode==='work'?'Open your hand over a grip to handle a tool.':'One closed palm orbits. Two closed palms zoom.';
    this.changed();
  }
  clearHands(){
    for(const canvas of [this.traceCanvas,this.hands.overlay]){
      const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
    }
    this.resetNavigation();
  }
  resetNavigation(){this.navigation.reset();this.command=null;this.navigationAnchor=this.zoomSpan=null}
  clearCameraFrames(){this.cameraFrame.width=this.cameraFrame.height=this.inputCanvas.width=this.inputCanvas.height=1;this.cameraFrame.readyState=0;this.cameraFrame.currentTime=-1}
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
    if(prev&&rect.left===prev.left&&rect.top===prev.top&&rect.width===prev.width&&rect.height===prev.height)return;
    this.renderer.roomVideoRect=rect;
    Object.assign(this.traceCanvas.style,{left:rect.left*100+'%',top:rect.top*100+'%',width:rect.width*100+'%',height:rect.height*100+'%'});
  }
  drawPlayerFrame(){
    const preview=$('handPreview'),box=$('handPlayerFrame');if(!preview||!box)return;
    const f=this.region();
    preview.style.aspectRatio=String(this.videoAspect);
    const left=this.source.mirrored?1-f.left-f.width:f.left;
    const style={left:left*100+'%',top:f.top*100+'%',width:f.width*100+'%',height:f.height*100+'%'};
    Object.assign(box.style,style);
    this.hands.overlay.style.transform=this.traceCanvas.style.transform=this.source.mirrored?'scaleX(-1)':'none';
    $('handGain').value=String(Math.round(this.frameWidth*100));$('handGainValue').textContent=Math.round(this.frameWidth*100)+'%';
    const percent=Math.round(this.cameraSize*100);
    for(const id of ['handCameraSize','roomCameraSize']){
      $(id).value=String(percent);$(id).setAttribute('aria-valuetext',percent+'%');$(id+'Value').textContent=percent+'%';
    }
    this.placeCamera();
  }
  captureFrame(video){
    const sw=video.videoWidth,sh=video.videoHeight;
    const scale=Math.min(1,960/Math.max(sw,sh)),width=Math.max(1,Math.round(sw*scale)),height=Math.max(1,Math.round(sh*scale));
    if(this.inputCanvas.width!==width||this.inputCanvas.height!==height){this.inputCanvas.width=width;this.inputCanvas.height=height}
    this.inputCanvas.getContext('2d',{alpha:false}).drawImage(video,0,0,width,height);
    return {image:this.inputCanvas,revision:this.frameRevision};
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
    this.trace(this.traceCanvas,frame,packet);
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
    if(this.hands.camera.running){this.renderer.roomVideo=picture;this.renderer.mirrored=this.source.mirrored;this.changed()}
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
