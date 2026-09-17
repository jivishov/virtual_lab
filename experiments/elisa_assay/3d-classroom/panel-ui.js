(function(){'use strict';
const panel=document.getElementById('cameraPanel'),head=document.getElementById('cameraDragHandle'),resize=document.getElementById('cameraResize');
if(!panel||!head||!resize)return;
const KEY='elisa3d-camera-panel-v1',margin=8,minW=260,minH=300;
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function viewport(){return{w:window.innerWidth,h:window.innerHeight}}
function fit(){if(panel.hidden)return;const vp=viewport(),r=panel.getBoundingClientRect(),w=Math.min(r.width,vp.w-margin*2),h=Math.min(r.height,vp.h-margin*2),left=clamp(r.left,margin,Math.max(margin,vp.w-w-margin)),top=clamp(r.top,margin,Math.max(margin,vp.h-h-margin));panel.style.width=w+'px';panel.style.height=h+'px';panel.style.left=left+'px';panel.style.top=top+'px'}
function save(){if(panel.hidden)return;const r=panel.getBoundingClientRect();try{localStorage.setItem(KEY,JSON.stringify({left:r.left,top:r.top,width:r.width,height:r.height}))}catch{}}
function restore(){let g=null;try{g=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}const stage=document.querySelector('.stage')?.getBoundingClientRect();const vp=viewport();let width=clamp(g?.width||320,minW,Math.max(minW,vp.w-margin*2));let height=clamp(g?.height||Math.min(620,vp.h-120),minH,Math.max(minH,vp.h-margin*2));let left=g?.left??Math.max(margin,(stage?.left||0)+16);let top=g?.top??Math.max(60,(stage?.top||52)+14);left=clamp(left,margin,Math.max(margin,vp.w-width-margin));top=clamp(top,margin,Math.max(margin,vp.h-height-margin));panel.style.left=left+'px';panel.style.top=top+'px';panel.style.width=width+'px';panel.style.height=height+'px'}
restore();
let op=null;
function begin(kind,e){if(e.button!==0)return;if(kind==='move'&&e.target.closest('button'))return;const r=panel.getBoundingClientRect();op={kind,id:e.pointerId,x:e.clientX,y:e.clientY,left:r.left,top:r.top,width:r.width,height:r.height};(kind==='move'?head:resize).setPointerCapture(e.pointerId);panel.classList.add(kind==='move'?'dragging':'resizing');e.preventDefault()}
function move(e){if(!op||e.pointerId!==op.id)return;const dx=e.clientX-op.x,dy=e.clientY-op.y,vp=viewport();if(op.kind==='move'){const left=clamp(op.left+dx,margin,Math.max(margin,vp.w-panel.offsetWidth-margin)),top=clamp(op.top+dy,margin,Math.max(margin,vp.h-panel.offsetHeight-margin));panel.style.left=left+'px';panel.style.top=top+'px'}else{const width=clamp(op.width+dx,minW,Math.max(minW,vp.w-op.left-margin)),height=clamp(op.height+dy,minH,Math.max(minH,vp.h-op.top-margin));panel.style.width=width+'px';panel.style.height=height+'px'}e.preventDefault()}
function end(e){if(!op||e.pointerId!==op.id)return;panel.classList.remove('dragging','resizing');try{(op.kind==='move'?head:resize).releasePointerCapture(e.pointerId)}catch{}op=null;fit();save()}
head.addEventListener('pointerdown',e=>begin('move',e));head.addEventListener('pointermove',move);head.addEventListener('pointerup',end);head.addEventListener('pointercancel',end);
resize.addEventListener('pointerdown',e=>begin('resize',e));resize.addEventListener('pointermove',move);resize.addEventListener('pointerup',end);resize.addEventListener('pointercancel',end);
window.addEventListener('resize',()=>{fit();save()});
const mo=new MutationObserver(()=>{if(!panel.hidden){requestAnimationFrame(()=>{fit()})}});mo.observe(panel,{attributes:true,attributeFilter:['hidden']});
})();
