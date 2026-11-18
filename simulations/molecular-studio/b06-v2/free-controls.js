import {THREE as T} from '../vendor/three-bundle.js';

// Camera-space rotations have no pole or ground-plane constraint. The up vector
// travels with the eye, so a vertical drag can pass smoothly through a full turn.
export class FreeControls extends T.EventDispatcher {
  constructor(camera, element) {
    super(); this.camera=camera; this.element=element; this.target=new T.Vector3();
    this.enabled=true; this.rotateSpeed=.75; this.minZoom=.35; this.maxZoom=5;
    this.pointers=new Map(); this.moved=false;
    element.addEventListener('contextmenu',e=>e.preventDefault());
    element.addEventListener('pointerdown',e=>{
      if(!this.enabled||e.button>2)return;
      // The scene owns this drag. Native text selection also follows the moving
      // labels unless the default pointer action is suppressed.
      e.preventDefault();element.focus({preventScroll:true});
      this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      this.panMode=e.button===1||e.shiftKey; this.moved=false;
      element.setPointerCapture(e.pointerId);
    });
    element.addEventListener('pointermove',e=>{
      const p=this.pointers.get(e.pointerId);if(!p||!this.enabled)return;
      e.preventDefault();
      const dx=e.clientX-p.x,dy=e.clientY-p.y;
      if(this.pointers.size===2){
        const q=[...this.pointers].find(([id])=>id!==e.pointerId)[1];
        const before=Math.hypot(p.x-q.x,p.y-q.y),after=Math.hypot(e.clientX-q.x,e.clientY-q.y);
        if(before>5)this.zoom(after/before);
      }else if(this.panMode)this.pan(dx,dy);else this.rotate(dx*.006,dy*.006);
      this.moved ||= Math.hypot(dx,dy)>2;p.x=e.clientX;p.y=e.clientY;
    });
    const end=e=>{if(this.pointers.delete(e.pointerId)){this.dispatchEvent({type:'end'});}};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,end);
    element.addEventListener('wheel',e=>{if(!this.enabled)return;e.preventDefault();this.zoom(Math.exp(-T.MathUtils.clamp(e.deltaY,-400,400)*.0015));this.dispatchEvent({type:'end'});},{passive:false});
    window.addEventListener('blur',()=>this.cancel());
    // Announce each kit camera so the page's shared camera bar can drive it.
    (window.__freeControls ||= []).push(this);
    document.dispatchEvent(new CustomEvent('free-controls',{detail:this}));
  }
  cancel(){
    const ids=[...this.pointers.keys()];this.pointers.clear();this.moved=false;
    for(const id of ids)if(this.element.hasPointerCapture(id))this.element.releasePointerCapture(id);
    if(ids.length)this.dispatchEvent({type:'end'});
  }
  rotate(dx,dy,roll=0){
    const c=this.camera,right=new T.Vector3().setFromMatrixColumn(c.matrixWorld,0),up=c.up.clone().normalize();
    const q=new T.Quaternion().setFromAxisAngle(up,-dx).multiply(new T.Quaternion().setFromAxisAngle(right,-dy));
    if(roll)q.premultiply(new T.Quaternion().setFromAxisAngle(c.position.clone().sub(this.target).normalize(),roll));
    c.position.sub(this.target).applyQuaternion(q).add(this.target);c.up.applyQuaternion(q).normalize();this.update();
  }
  pan(dx,dy){
    const c=this.camera,h=c.isOrthographicCamera?(c.top-c.bottom)/c.zoom:2*c.position.distanceTo(this.target)*Math.tan(c.fov*Math.PI/360)/c.zoom;
    const d=new T.Vector3().setFromMatrixColumn(c.matrixWorld,0).multiplyScalar(-dx*h/this.element.clientHeight)
      .addScaledVector(new T.Vector3().setFromMatrixColumn(c.matrixWorld,1),dy*h/this.element.clientHeight);
    c.position.add(d);this.target.add(d);this.update();
  }
  zoom(factor){this.camera.zoom=T.MathUtils.clamp(this.camera.zoom*factor,this.minZoom,this.maxZoom);this.camera.updateProjectionMatrix();this.update();}
  update(){this.camera.lookAt(this.target);this.camera.updateMatrixWorld();this.dispatchEvent({type:'change'});}
}
