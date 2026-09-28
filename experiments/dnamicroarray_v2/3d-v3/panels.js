/* Floating panels: drag by the header, resize from any corner, collapse, and remember the layout
   in this browser (a per-viewer convenience; experiment data is saved separately by session.js).
   Panels stay inside the stage when the window changes size. */
(function(root){
  'use strict';
  const PREFIX='microarray3d-v3-panel-';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const registry=new Map();
  const load=key=>{try{return JSON.parse(localStorage.getItem(PREFIX+key)||'null');}catch{return null;}};
  const store=(key,value)=>{try{localStorage.setItem(PREFIX+key,JSON.stringify(value));}catch{}};
  const changed=reason=>document.dispatchEvent(new CustomEvent('panels:changed',{detail:{reason}}));
  const interactive=el=>el.closest('button,select,input,textarea,a,label,summary');

  class FloatingPanel {
    constructor(el,options={}){
      this.el=el;this.o={key:el.dataset.panel||el.id,minW:220,minH:140,autoHeight:false,margin:8,...options};
      this.stage=el.parentElement;this.placed=false;
      const head=el.querySelector('[data-drag]');if(head)this.bindDrag(head);
      for(const corner of ['nw','ne','sw','se']){
        const h=document.createElement('div');h.className='rz rz-'+corner;h.title='Drag to resize';h.setAttribute('aria-hidden','true');
        el.append(h);this.bindResize(h,corner);
      }
      registry.set(this.o.key,this);
      new MutationObserver(()=>{if(!el.hidden)requestAnimationFrame(()=>this.place());changed('visibility');}).observe(el,{attributes:true,attributeFilter:['hidden']});
      if(!el.hidden)requestAnimationFrame(()=>this.place());
    }
    bounds(){return {w:this.stage.clientWidth,h:this.stage.clientHeight};}
    rel(){const s=this.stage.getBoundingClientRect(),r=this.el.getBoundingClientRect();return {left:r.left-s.left,top:r.top-s.top,width:r.width,height:r.height};}
    set(g){
      const b=this.bounds(),m=this.o.margin,el=this.el;
      const width=clamp(g.width,this.o.minW,Math.max(this.o.minW,b.w-2*m));
      el.style.width=width+'px';el.style.right='auto';el.style.bottom='auto';
      if(!this.o.autoHeight&&g.height!=null)el.style.height=clamp(g.height,this.o.minH,Math.max(this.o.minH,b.h-2*m))+'px';
      const height=el.getBoundingClientRect().height;
      el.style.left=clamp(g.left,m,Math.max(m,b.w-width-m))+'px';el.style.top=clamp(g.top,m,Math.max(m,b.h-Math.min(height,b.h-2*m)-m))+'px';
    }
    // Until the student moves or resizes a panel it keeps its responsive CSS position; only then
    // does it switch to explicit geometry, which is remembered and kept inside the stage.
    place(){
      if(this.el.hidden||this.placed)return;
      this.placed=true;const saved=load(this.o.key);if(!saved)return;
      this.el.classList.toggle('collapsed',!!saved.collapsed);this.syncCollapse();
      if(Number.isFinite(saved.left)&&Number.isFinite(saved.width)){this.custom=true;this.set(saved);}
    }
    clamp(){if(!this.el.hidden&&this.custom)this.set(this.rel());}
    save(){const collapsed=this.el.classList.contains('collapsed');store(this.o.key,this.custom?{...this.rel(),height:this.o.autoHeight?null:this.rel().height,collapsed}:{collapsed});}
    bindDrag(head){
      head.addEventListener('pointerdown',e=>{
        if(e.button!==0||interactive(e.target))return;
        e.preventDefault();head.setPointerCapture(e.pointerId);const start=this.rel(),x=e.clientX,y=e.clientY;this.custom=true;this.el.classList.add('moving');
        const move=ev=>this.set({...start,left:start.left+ev.clientX-x,top:start.top+ev.clientY-y,height:this.o.autoHeight?null:start.height});
        const up=()=>{head.removeEventListener('pointermove',move);head.removeEventListener('pointerup',up);head.removeEventListener('pointercancel',up);this.el.classList.remove('moving');this.save();changed('move');};
        head.addEventListener('pointermove',move);head.addEventListener('pointerup',up);head.addEventListener('pointercancel',up);
      });
    }
    bindResize(h,corner){
      h.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;e.preventDefault();e.stopPropagation();h.setPointerCapture(e.pointerId);
        const start=this.rel(),x=e.clientX,y=e.clientY,{minW,minH}=this.o;this.custom=true;this.el.classList.add('moving');
        const move=ev=>{
          const dx=ev.clientX-x,dy=ev.clientY-y,g={...start};
          if(corner.includes('e'))g.width=Math.max(minW,start.width+dx);
          if(corner.includes('w')){g.width=Math.max(minW,start.width-dx);g.left=start.left+start.width-g.width;}
          if(!this.o.autoHeight){
            if(corner.includes('s'))g.height=Math.max(minH,start.height+dy);
            if(corner.includes('n')){g.height=Math.max(minH,start.height-dy);g.top=start.top+start.height-g.height;}
          }else g.height=null;
          this.set(g);
        };
        const up=()=>{h.removeEventListener('pointermove',move);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);this.el.classList.remove('moving');this.save();changed('resize');};
        h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
      });
    }
    setCollapsed(on){this.el.classList.toggle('collapsed',on);this.syncCollapse();requestAnimationFrame(()=>{this.clamp();this.save();changed('collapse');});}
    syncCollapse(){const b=this.el.querySelector('[aria-expanded][data-collapse]');if(b){const c=this.el.classList.contains('collapsed');b.setAttribute('aria-expanded',String(!c));b.textContent=c?'+':'–';}}
    reset(){try{localStorage.removeItem(PREFIX+this.o.key);}catch{}for(const k of ['left','top','width','height','right','bottom'])this.el.style[k]='';this.el.classList.remove('collapsed');this.syncCollapse();this.custom=false;this.placed=false;this.place();}
  }

  // Width-only resize for a panel docked to the right edge (the notebook).
  function edgeResize(el,handle,key,{min=340,maxFraction=.7}={}){
    const saved=load(key);if(saved?.width)el.style.width=saved.width+'px';
    handle.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;e.preventDefault();handle.setPointerCapture(e.pointerId);const start=el.getBoundingClientRect().width,x=e.clientX;
      const move=ev=>{const max=el.parentElement.clientWidth*maxFraction;el.style.width=clamp(start-(ev.clientX-x),min,max)+'px';};
      const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);store(key,{width:el.getBoundingClientRect().width});changed('dock');};
      handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up);
    });
    return {reset(){try{localStorage.removeItem(PREFIX+key);}catch{}el.style.width='';changed('dock');}};
  }
  function watchStage(stage){new ResizeObserver(()=>{for(const p of registry.values())p.clamp();}).observe(stage);}
  function resetAll(){for(const p of registry.values())p.reset();changed('reset');}
  root.MicroarrayPanels={FloatingPanel,edgeResize,watchStage,resetAll,registry};
})(globalThis);
