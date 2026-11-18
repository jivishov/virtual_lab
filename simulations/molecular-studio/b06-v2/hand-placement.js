import {ELEMENTS} from './molecule-model.js';
import {atomCharge,chargeRadiusScale} from './ionic-model.js';

// Find room in the current camera view, including floating controls that
// students may have moved. The picker itself is about to close.
export function handPlacement(viewer, graph, symbol, style) {
  const stage=viewer.element, rect=stage.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  const center=viewer.worldAt(cx,cy), adjacent=viewer.worldAt(cx+1,cy);
  if (!center || !adjacent) return null;
  const unitsPerPixel=Math.hypot(...center.map((n,i)=>n-adjacent[i]));
  if (!(unitsPerPixel>0)) return null;
  const radius=(symbol,id)=>{
    const scale=Array.isArray(graph.transfers)
      ? chargeRadiusScale(symbol,id==null?0:atomCharge(graph,id))
      : style==='space'?2.2:1;
    return Math.max(10,scale*ELEMENTS[symbol].r/unitsPerPixel);
  };
  const margin=radius(symbol)+6;
  const widgets=stage.closest('main').querySelectorAll(
    '.hand-toolbar, .model-views, .lab-panel:not([hidden]), #builder-tray, .hand-bar, .room-bar, .lab-ticket, #hand-periodic-orb');
  const occupied=[...widgets].map(w=>w.getBoundingClientRect()).filter(r=>r.width&&r.height);
  const atoms=graph.atoms.map(a=>({...viewer.projectPoint(a.position),radius:radius(a.element,a.id)}))
    .filter(p=>p.z>0 && p.z<1);
  const targetX=rect.left+.44*rect.width, targetY=rect.top+.28*rect.height;
  let best=null, distance=Infinity;
  const step=Math.max(16,Math.min(44,margin));
  for (let y=rect.top+margin; y<rect.bottom-margin; y+=step) {
    for (let x=rect.left+margin; x<rect.right-margin; x+=step) {
      const d=Math.hypot(x-targetX,y-targetY);
      if (d>=distance || occupied.some(r=>x>r.left-margin && x<r.right+margin && y>r.top-margin && y<r.bottom+margin)) continue;
      if (atoms.some(a=>Math.hypot(a.x-x,a.y-y)<margin+a.radius+4)) continue;
      const point=viewer.worldAt(x,y);
      if (point?.every(n=>Number.isFinite(n)&&Math.abs(n)<=100)) {best=point;distance=d;}
    }
  }
  return best;
}
