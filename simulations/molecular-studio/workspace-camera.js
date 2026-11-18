import {THREE} from './vendor/three-bundle.js';
const clamp=THREE.MathUtils.clamp;
const MIN_ZOOM=.35, MAX_ZOOM=5;
function publish(api){document.querySelector('main').labCamera=api;document.dispatchEvent(new Event('lab-camera-ready'));}
const announce=()=>document.dispatchEvent(new Event('lab-camera-ready'));
function heightAt(camera,target){return camera.isOrthographicCamera?(camera.top-camera.bottom)/camera.zoom:2*camera.position.distanceTo(target)*Math.tan(camera.fov*Math.PI/360)/camera.zoom;}
function cursorPoint(element,camera,target,e){
 const r=element.getBoundingClientRect();if(!r.width||!r.height)return null;
 const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
 return ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),target),new THREE.Vector3());
}
// Resolve a physical one-axis drag in its actual projected direction, also after orbiting.
export function axisGesture(camera,element,origin,axis,dx,dy){
 const a=origin.clone().project(camera),b=origin.clone().add(axis).project(camera);
 const x=(b.x-a.x)*element.clientWidth/2,y=-(b.y-a.y)*element.clientHeight/2,l=x*x+y*y;
 if(l<16)return {travel:-dy*heightAt(camera,origin)/Math.max(1,element.clientHeight)/Math.max(.001,axis.length()),cross:0,span:Math.sqrt(l),along:-dy};
 return {travel:(dx*x+dy*y)/l,cross:Math.abs(dx*y-dy*x)/Math.sqrt(l),span:Math.sqrt(l),along:(dx*x+dy*y)/Math.sqrt(l)};
}
export function axisDrag(...args){return axisGesture(...args).travel;}
// Invert the two projected axes together so oblique views do not couple x and y.
export function planeDrag(camera,element,origin,xAxis,yAxis,dx,dy){
 const a=origin.clone().project(camera),b=origin.clone().add(xAxis).project(camera),c=origin.clone().add(yAxis).project(camera);
 const ux=(b.x-a.x)*element.clientWidth/2,uy=-(b.y-a.y)*element.clientHeight/2;
 const vx=(c.x-a.x)*element.clientWidth/2,vy=-(c.y-a.y)*element.clientHeight/2,det=ux*vy-uy*vx;
 if(Math.abs(det)<16)return ux*ux+uy*uy>vx*vx+vy*vy?{x:axisDrag(camera,element,origin,xAxis,dx,dy),y:0}:{x:0,y:axisDrag(camera,element,origin,yAxis,dx,dy)};
 return {x:(dx*vy-dy*vx)/det,y:(dy*ux-dx*uy)/det};
}
function inputControls({element,camera,target,rotate,pan,zoom,home,busy=()=>false,after=()=>{}}){
 let mode='move',gesture=null,partPointer=null;
 if(!element.hasAttribute('tabindex'))element.tabIndex=0;
 const contains=e=>e.target===element||element.contains(e.target);
 const swallow=e=>{e.preventDefault();e.stopImmediatePropagation();};
 const activity=active=>{document.querySelector('main')?.classList?.toggle('lab-navigating',active);after(active);};
 const locked=()=>partPointer!==null||busy();
 function setMode(next){if(!['move','orbit','pan'].includes(next)||gesture||locked())return;mode=next;element.dataset.cameraMode=next;announce();}
 function finish(e){
  if(e.pointerId===partPointer)partPointer=null;
  if(gesture?.id!==e.pointerId)return;
  gesture=null;if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);swallow(e);activity(false);
 }
 document.addEventListener('pointerdown',e=>{
  if(!contains(e)||![0,1,2].includes(e.button))return;
  const navigation=e.button!==0||mode!=='move'||e.altKey;
  if(!navigation){if(partPointer===null)partPointer=e.pointerId;return;}
  if(locked()||gesture){swallow(e);return;}
  gesture={id:e.pointerId,x:e.clientX,y:e.clientY,pan:e.button===1||e.shiftKey||(e.button===0&&mode==='pan')};
  element.setPointerCapture(e.pointerId);element.focus({preventScroll:true});swallow(e);activity(true);
 },true);
 document.addEventListener('pointermove',e=>{
  if(gesture?.id!==e.pointerId)return;
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;gesture.x=e.clientX;gesture.y=e.clientY;
  if(gesture.pan){
   const c=camera(),s=heightAt(c,target())/Math.max(1,element.clientHeight);
   pan(new THREE.Vector3().setFromMatrixColumn(c.matrixWorld,0).multiplyScalar(-dx*s).addScaledVector(new THREE.Vector3().setFromMatrixColumn(c.matrixWorld,1),dy*s));
  }else rotate(-dx*.006,dy*.005);
  swallow(e);
 },true);
 for(const name of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(name,finish,true);
 function cancel(){partPointer=null;const g=gesture;gesture=null;if(g&&element.hasPointerCapture(g.id))element.releasePointerCapture(g.id);activity(false);}
 window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
 element.addEventListener('wheel',e=>{
  // A held water's wheel gesture belongs to the molecular tool, not the camera.
  if(locked()||gesture)return;
  e.preventDefault();e.stopImmediatePropagation();zoom(Math.exp(-clamp(e.deltaY,-500,500)*.0012),e);activity(false);
 },{capture:true,passive:false});
 element.addEventListener('contextmenu',e=>e.preventDefault());
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&gesture){cancel();swallow(e);return;}
  if(mode==='move'||locked()||!contains({target:document.activeElement})||e.ctrlKey||e.metaKey)return;
  const dx=Number(e.key==='ArrowRight')-Number(e.key==='ArrowLeft'),dy=Number(e.key==='ArrowDown')-Number(e.key==='ArrowUp');
  if(dx||dy){if(mode==='orbit')rotate(-dx*.12,dy*.10);else{const c=camera(),s=heightAt(c,target())*.06;pan(new THREE.Vector3().setFromMatrixColumn(c.matrixWorld,0).multiplyScalar(-dx*s).addScaledVector(new THREE.Vector3().setFromMatrixColumn(c.matrixWorld,1),dy*s));}swallow(e);activity(false);}
 },true);
 const api={get mode(){return mode;},setMode,cancel,command(action){if(['move','orbit','pan'].includes(action)){setMode(action);return;}if(locked()||gesture)return;if(action==='home')home();else if(action==='in'||action==='out')zoom(action==='in'?1.2:1/1.2);activity(false);},
  help:'Move: drag individual parts. Rotate or Pan: drag anywhere in the scene. Right drag also rotates; Shift + right drag or middle drag pans. Scroll to zoom at the pointer. Fit restores the view without changing your work. Arrow keys move the camera in Rotate or Pan mode.'};
 publish(api);element.dataset.cameraMode=mode;return api;
}
export function freeCamera({canvas,camera,refresh,busy}){
 const getCamera=typeof camera==='function'?camera:()=>camera;
 let yaw=0,pitch=0,zoom=1,basePhi=.6;
 const offset=new THREE.Vector3(),target=new THREE.Vector3();
 function apply(focus){
  const c=getCamera(),pivot=focus.clone();c.updateMatrixWorld();
  // Center off-axis authored frames before rotating. This preserves the original image at Fit.
  if(c.isOrthographicCamera){
   const x=(c.left+c.right)/2,y=(c.top+c.bottom)/2;
   const shift=new THREE.Vector3().setFromMatrixColumn(c.matrixWorld,0).multiplyScalar(x).addScaledVector(new THREE.Vector3().setFromMatrixColumn(c.matrixWorld,1),y);
   c.position.add(shift);pivot.add(shift);c.left-=x;c.right-=x;c.top-=y;c.bottom-=y;
  }
  const spherical=new THREE.Spherical().setFromVector3(c.position.clone().sub(pivot));basePhi=spherical.phi;
  spherical.theta+=yaw;spherical.phi=basePhi+pitch;
  target.copy(pivot).add(offset);c.position.copy(target).add(new THREE.Vector3().setFromSpherical(spherical));c.lookAt(target);c.zoom=zoom;c.updateProjectionMatrix();c.updateMatrixWorld();
 }
 function shift(delta){offset.add(delta);refresh();}
 function zoomBy(factor,e){
  const c=getCamera(),before=e?cursorPoint(canvas,c,target,e):null;
  zoom=clamp(zoom*factor,MIN_ZOOM,MAX_ZOOM);refresh();
  if(before){const after=cursorPoint(canvas,getCamera(),target,e);if(after)shift(before.sub(after));}
 }
 function reset(redraw=true){yaw=0;pitch=0;zoom=1;offset.set(0,0,0);if(redraw)refresh();}
 const api=inputControls({element:canvas,camera:getCamera,target:()=>target,busy,
  rotate(dx,dy){yaw+=dx;pitch=clamp(pitch+dy,.02-basePhi,Math.PI-.02-basePhi);refresh();},pan:shift,zoom:zoomBy,home:reset});
 return {apply,reset,get mode(){return api.mode;}};
}
export function kitCamera({canvas,camera,controls,home,draw}){
 controls.enablePan=true;controls.enableZoom=true;controls.minZoom=MIN_ZOOM;controls.maxZoom=MAX_ZOOM;
 controls.minPolarAngle=.02;controls.maxPolarAngle=Math.PI-.02;
 controls.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;controls.mouseButtons.MIDDLE=THREE.MOUSE.PAN;
 const update=()=>{controls.update();draw();};
 function pan(delta){controls.target.add(delta);camera.position.add(delta);update();}
 function zoomBy(factor,e){const before=e?cursorPoint(canvas,camera,controls.target,e):null;camera.zoom=clamp(camera.zoom*factor,MIN_ZOOM,MAX_ZOOM);camera.updateProjectionMatrix();update();if(before){const after=cursorPoint(canvas,camera,controls.target,e);if(after)pan(before.sub(after));}}
 const api=inputControls({element:canvas,camera:()=>camera,target:()=>controls.target,busy:()=>!controls.enabled,after:active=>{if(!active)controls.dispatchEvent?.({type:'end'});},
  rotate(dx,dy){const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));s.theta+=dx;s.phi=clamp(s.phi+dy,controls.minPolarAngle,controls.maxPolarAngle);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));update();},pan,zoom:zoomBy,home:()=>{camera.zoom=1;home();}});
 return api;
}
// Camera-space free rotation (no pole), used by the b06 molecule kit. `controls` owns camera, target, rotate, zoom.
export function freeControlsCamera({element,controls,home,after=()=>{}}){
 const end=()=>controls.dispatchEvent?.({type:'end'});
 return inputControls({element,camera:()=>controls.camera,target:()=>controls.target,busy:()=>!controls.enabled,
  after:active=>{if(!active)end();after(active);},
  rotate(dx,dy){controls.rotate(-dx,dy*1.2);},
  pan(delta){controls.camera.position.add(delta);controls.target.add(delta);controls.update();},
  zoom(factor,e){const c=controls.camera,before=e?cursorPoint(element,c,controls.target,e):null;controls.zoom(factor);if(before){const after=cursorPoint(element,c,controls.target,e);if(after){const d=before.sub(after);c.position.add(d);controls.target.add(d);controls.update();}}},
  home});
}
export function escapeCancels(host){
 let active=null;host.addEventListener('pointerdown',e=>{if(e.button===0)active={id:e.pointerId,target:e.target,x:e.clientX,y:e.clientY};},true);
 for(const name of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(name,e=>{if(active?.id===e.pointerId)active=null;},true);
 window.addEventListener('keydown',e=>{if(e.key!=='Escape'||!active)return;const a=active;active=null;a.target.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:a.id,clientX:a.x,clientY:a.y,button:0}));});
}
