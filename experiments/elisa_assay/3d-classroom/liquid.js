/* Volume-driven presentation. Vessel dimensions and menisci are illustrative.
   Quantities come exclusively from Protocol; this module never performs a transfer. */
(function(root){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const frustum=(r0,r1,h)=>Math.PI*h*(r0*r0+r0*r1+r1*r1)/3;
  function volumeBelow(profile,height){
    let volume=0;
    for(let i=1;i<profile.length;i++){
      const [a,y0]=profile[i-1],[b,y1]=profile[i];
      const h=clamp(height-y0,0,y1-y0),radius=a+(b-a)*h/(y1-y0);
      volume+=frustum(a,radius,h);
    }
    return volume;
  }
  function fillProfile(profile,fraction){
    const bottom=profile[0][1],top=profile.at(-1)[1],f=clamp(fraction,0,1);
    let lo=bottom,hi=top;
    const wanted=volumeBelow(profile,top)*f;
    for(let i=0;i<30;i++){const mid=(lo+hi)/2;if(volumeBelow(profile,mid)<wanted)lo=mid;else hi=mid;}
    const height=(lo+hi)/2,side=profile.filter(p=>p[1]<height);
    const i=Math.max(1,profile.findIndex(p=>p[1]>=height));
    const [a,y0]=profile[i-1],[b,y1]=profile[i];
    const radius=a+(b-a)*(height-y0)/(y1-y0);
    // Tiny edge rise makes the meniscus visible; it does not change the model's quantity.
    const rise=Math.min(.004,(height-bottom)*.08);
    return {height,radius,profile:[[0,bottom],...side,[radius,height],[radius*.90,height-rise],[radius*.55,height-rise*1.1],[0,height-rise]]};
  }
  class QuantityTween {
    constructor(value=0){this.value=value;this.target=value;this.from=value;this.time=0;}
    set(value,immediate=false){
      if(!Number.isFinite(value)||value<0)throw Error('Invalid liquid quantity');
      if(immediate){this.value=this.target=this.from=value;this.time=0;return;}
      if(value===this.target)return;
      this.from=this.value;this.target=value;this.time=0;
    }
    advance(dt){
      if(this.value===this.target||dt<=0)return false;
      this.time=Math.min(.34,this.time+dt);
      const x=this.time/.34,e=x*x*(3-2*x);
      this.value=this.time===.34?this.target:this.from+(this.target-this.from)*e;
      return true;
    }
  }
  class Vessel {
    constructor(renderer,parent,profile,capacity,color){
      this.r=renderer;this.profile=profile;this.capacity=capacity;this.quantity=new QuantityTween();this.height=profile[0][1];
      this.mesh=renderer.mesh(root.E3D.G.lathe(fillProfile(profile,.001).profile,24),renderer.material(color,{rough:.18,opacity:.88}),parent);
      this.mesh.visible=false;this.mesh.noShadow=true;
    }
    set(volume,color,immediate=false){
      this.quantity.set(volume,immediate);
      if(color)this.mesh.mat.color=root.E3D.rgb(color);
      if(immediate)this.draw();
    }
    draw(){
      const q=this.quantity.value;this.mesh.visible=q>.0001&&!this.poured; // poured: the vessel is held upside down
      const fill=fillProfile(this.profile,q/this.capacity);this.height=fill.height;
      if(this.mesh.visible)this.r.updateGeometry(this.mesh,root.E3D.G.lathe(fill.profile,24));
    }
    advance(dt){if(!this.quantity.advance(dt))return false;this.draw();return true;}
  }
  const api={frustum,volumeBelow,fillProfile,QuantityTween,Vessel};
  root.ClassroomLiquid=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
