export const panelGap=8;

export function panelBounds(scene,panel){
 const {width,height}=panel.getBoundingClientRect();
 const left=scene.left+panelGap,top=scene.top+panelGap;
 return {left,top,right:Math.max(left,scene.right-width-panelGap),
  bottom:Math.max(top,scene.bottom-height-panelGap),width,height};
}

// Pointer, palm and keyboard move the same live panel. Its relative position survives resizing.
export function addMoveGrip(panel,{className,label,homeName,bounds,home}){
 const grip=document.createElement('button');
 grip.type='button';grip.className=className;
 grip.setAttribute('aria-label',label);
 grip.title=label+'. Grasp or drag the grip, or use arrow keys. Double-click or press Home to return to '+homeName+'.';
 grip.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown Home');
 panel.prepend(grip);

 return floatControl(panel,grip,{bounds,home});
}

export function floatControl(panel,grip,{bounds,home}){
 const clickable=panel===grip;
 let anchor=null,drag=null,suppressClick=false;
 function place(b){
  const parent=panel.offsetParent;
  if(!parent)return;
  const point=anchor ? {x:b.left+anchor.x*(b.right-b.left),y:b.top+anchor.y*(b.bottom-b.top)} : home(b);
  const frame=parent.getBoundingClientRect();
  const x=Math.min(b.right,Math.max(b.left,point.x)),y=Math.min(b.bottom,Math.max(b.top,point.y));
  panel.style.left=(x-frame.left-parent.clientLeft)+'px';
  panel.style.top=(y-frame.top-parent.clientTop)+'px';
 }
 function layout(){const b=bounds();if(b)place(b);}
 function moveTo(x,y){
  const b=bounds();if(!b)return;
  const fraction=(value,low,high)=>Math.max(0,Math.min(1,(value-low)/Math.max(1,high-low)));
  anchor={x:fraction(x,b.left,b.right),y:fraction(y,b.top,b.bottom)};
  place(b);
 }
 function reset(){anchor=null;layout();}
 function clear(){
  if(drag && grip.hasPointerCapture(drag.id))grip.releasePointerCapture(drag.id);
  anchor=null;drag=null;suppressClick=false;panel.style.removeProperty('left');panel.style.removeProperty('top');
 }
 grip.onpointerdown=e=>{
  if(e.button!==0||!e.isPrimary)return;
  const r=panel.getBoundingClientRect();
  suppressClick=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,dx:e.clientX-r.left,dy:e.clientY-r.top};
  grip.focus({preventScroll:true});grip.setPointerCapture(e.pointerId);e.preventDefault();
 };
 grip.onpointermove=e=>{
  if(drag?.id!==e.pointerId)return;
  if(clickable && !suppressClick && Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<6)return;
  suppressClick=clickable;
  moveTo(e.clientX-drag.dx,e.clientY-drag.dy);
 };
 if(clickable)grip.addEventListener('click',e=>{
  if(suppressClick && e.detail>0){e.preventDefault();e.stopImmediatePropagation();}
  suppressClick=false;
 },true);
 grip.onlostpointercapture=()=>{drag=null;};
 grip.movePaletteBy=(dx,dy)=>{const r=panel.getBoundingClientRect();moveTo(r.left+dx,r.top+dy);};
 if(!clickable)grip.ondblclick=reset;
 grip.onkeydown=e=>{
  const step=12,delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];
  if(!delta&&e.key!=='Home')return;
  e.preventDefault();e.stopPropagation();
  if(e.key==='Home'){reset();return;}
  grip.movePaletteBy(...delta);
 };
 return {layout,clear};
}
