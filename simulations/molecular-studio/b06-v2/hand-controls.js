import {HandGestures,handSettings,steadyHandMotion} from './hand-gestures.js';

// Camera commands can sit outside the image, especially beside an open Inspector.
const edgeTools='.immerse-hud button,.lab-camera button,.lab-top button,.room-bar button,.hand-bar button';
// [data-hand-zone] marks studio panels whose buttons hands may press (B06 hand layout).
const benchTools=edgeTools+',.model-views button,#builder-ribbon button,[data-hand-page],#hand-periodic-orb,[data-hand-zone] button';
const setupTools='.hand-setup-actions button,.frame-options button,.hand-adjust summary,.hand-adjust-buttons button,.hand-setup input[data-setting=zoomSensitivity]';
const navigating=action=>action==='turn'||action==='pan';
const handMargin=.14;
const reach=value=>Math.max(0,Math.min(1,(value-handMargin)/(1-2*handMargin)));
// Match the palm in the middle of the camera view. Stretch only the outer
// bands so each toolbar grip can reach the frame edge with fingers still visible.
function toolbarReach(value){
  const band=2*handMargin;
  if(value<band)return Math.max(0,2*value-band);
  if(value>1-band)return Math.min(1,2*value-1+band);
  return value;
}
// Immerse kit tiles and floating toolbar buttons take only a sliver of the camera view (the outer
// bands double the hand's motion), so the aimed one is held through tracker jitter and the palm shift
// of a closing hand. A deliberate move off it, or well into a neighbour, lets it go.
// The hand bar (Undo, settings, voice, exit) sits under the kit's right end, so it shares the hold.
const lockTargets='#builder-tray [data-element],#builder-tray [data-order],#builder-tray #pair-piece,.hand-toolbar button,.hand-bar button';
const outside=(r,p)=>Math.hypot(Math.max(r.left-p.x,0,p.x-r.right),Math.max(r.top-p.y,0,p.y-r.bottom));
// A control close to a screen edge (within twice its size, or 6% of the screen) reaches out to that edge.
function edgeward(r){
  const size=Math.min(r.width,r.height),nearX=Math.max(2*size,.06*innerWidth),nearY=Math.max(2*size,.06*innerHeight);
  return {left:r.left<nearX?-Infinity:r.left,right:innerWidth-r.right<nearX?Infinity:r.right,
    top:r.top<nearY?-Infinity:r.top,bottom:innerHeight-r.bottom<nearY?Infinity:r.bottom};
}
// Small motion eases in (tracker jitter), larger motion follows at once; the point never stays behind.
function steadyPoint(anchor,point,radius){
  if(!anchor)return {x:point.x,y:point.y};
  const dx=point.x-anchor.x,dy=point.y-anchor.y,distance=Math.hypot(dx,dy);
  const follow=distance<=radius ? .15 : 1-.85*radius/distance;
  return {x:anchor.x+dx*follow,y:anchor.y+dy*follow};
}
const controlName=control=>control.getAttribute('aria-label') || control.textContent.trim();
function enabledControl(root,hit,selector){
  const control=hit?.closest(selector);
  return control && !control.disabled && !control.closest('[hidden],[inert]') && root.contains(control) ? control : null;
}

export function createHandControls(main,bar,settings) {
  const gestures = new HandGestures(settings), active = new Map();
  const status = bar.querySelector('[role=status]'), undo = bar.querySelector('[data-hand-undo]');
  const builder = () => main.dataset.mode === 'builder';
  const stage = () => document.getElementById(builder() ? 'builder-stage' : 'visual');
  const undoButton = () => document.getElementById(builder() ? 'builder-undo' : 'undo');
  const feedback = () => document.getElementById(builder() ? 'builder-status' : 'live-guide')?.textContent;
  const note = text => { if (status.textContent !== text) status.textContent = text; };
  let zoom=null, previousRoot=null, previousScene=null, previousKit=null, revision=0;
  undo.onclick = () => undoButton()?.click();
  function setHover(hand, target) {
    if (hand.hover === target) return;
    const previous = hand.hover;
    hand.hover = target;
    if (previous && ![...active.values()].some(h => h.hover === previous)) previous.classList.remove('hand-aim');
    target?.classList.add('hand-aim');
  }
  function clear(id) {
    const h = active.get(id);
    if (!h) return;
    if (h.action === 'part') h.kit.cancel();
    if (navigating(h.action)) h.kit.endTurn();
    h.cursor.remove(); setHover(h,null); active.delete(id);
  }
  const lockable=el=>!el.disabled && !el.closest('[hidden],[inert]') && main.contains(el) && getComputedStyle(el).visibility!=='hidden';
  // Returns the held control for this hand's toolbar-mapped point, or null to aim as before.
  function barLock(h,resumed,point,e){
    // Tracker noise grows with the screen (the camera frame is stretched over it), so do the distances.
    const screen=Math.min(innerWidth,innerHeight);
    const q=h.steady=steadyPoint(resumed?null:h.steady,point,Math.max(6,.012*screen));
    // Fingers starting to fold (before the grip is recognised) already shift the palm.
    h.openPeak=resumed ? e.openness : Math.max(e.openness,(h.openPeak??e.openness)-.01);
    const selecting=Boolean(e.intent) || h.action==='command' || e.openness<h.openPeak-.1;
    const open=e.openness*100>=gestures.settings.open;
    // Over empty space, the strip between a control and its near screen edge counts as part of it:
    // overshooting there, where nothing else can be aimed, keeps the hold.
    const under=document.elementFromPoint(q.x,q.y);
    const free=!(under?.closest(lockTargets) || enabledControl(main,under,benchTools));
    const gapTo=r=>outside(free ? edgeward(r) : r,q);
    let keep=null,keepGap=Infinity;
    if(h.lock?.isConnected && lockable(h.lock)){
      const r=h.lock.getBoundingClientRect(),hold=Math.max(16,.45*Math.min(r.width,r.height),.03*screen);
      keepGap=gapTo(r);
      if(r.width && r.height && keepGap<=hold*(selecting?3:open?1:2))keep=h.lock;
    }
    // A closing or selecting hand never changes its target.
    if(keep && selecting)return keep;
    let best=null,bestGap=Infinity;
    for(const el of main.querySelectorAll(lockTargets)){
      if(el===keep)continue;
      const r=el.getBoundingClientRect(),size=Math.min(r.width,r.height);
      if(!size)continue;
      const gap=gapTo(r);
      // Move on to a neighbour only once the point is clearly nearer to it.
      const reach=keep ? keepGap-Math.max(8,.25*size,.012*screen) : Math.max(4,Math.min(.2*size,.013*screen));
      if((keep ? gap<reach : gap<=reach) && gap<bestGap){best=el;bestGap=gap;}
    }
    if(best){
      // Take a new target only where it is on top (not under a panel).
      const r=best.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      if(!lockable(best) || !best.contains(top))best=null;
    }
    return h.lock=best||keep;
  }
  function finishZoom(){
    if(!zoom)return;
    const {hands,kit}=zoom;
    zoom=null;
    for(const hand of hands){
      hand.action=null;hand.pending=null;hand.cursor.dataset.action='aim';
      setHover(hand,null);
    }
    kit.endTurn();
  }
  function updateZoom(events,area){
    // Use both palms from the same exposure, independent of detection order and mirroring.
    const [a,b]=zoom.hands.map(hand=>events.find(event=>event.id===hand.id));
    const unseen=!a?.palm || !b?.palm;
    if(unseen || a.phase==='release' || b.phase==='release'){
      const level=zoom.level;
      finishZoom();
      if(unseen)note('Zoom stopped. Show both open hands to start again.');
      else note(level ? 'Zoom set to '+Math.round(100*level)+'%.' : 'Zoom set.');
      return;
    }
    const dx=(a.palm.x-b.palm.x)*area.width,dy=(a.palm.y-b.palm.y)*area.height;
    const distance=Math.max(1,.05*Math.min(area.width,area.height),Math.hypot(dx,dy));
    if(zoom.distance===null){zoom.distance=distance;return;}
    // Ignore small tracker jitter while accumulating slow, deliberate movement.
    if(Math.abs(distance-zoom.distance)<Math.max(2,.012*zoom.distance))return;
    // Exponentiating the ratio gives reciprocal zoom factors for a spread and its reverse.
    const gain=gestures.settings.zoomSensitivity/100;
    const level=zoom.kit.zoom((distance/zoom.distance)**gain);
    if(level){zoom.distance=distance;zoom.level=level;}
    else{finishZoom();note('Release the held part before zooming.');}
  }
  function resetTracking() {
    revision++;
    finishZoom();
    for (const id of active.keys()) clear(id);
    gestures.reset();
  }
  function reset() {
    resetTracking();
    delete bar.dataset.count;
    undo.disabled = true;
    note('Show an open hand inside the player frame.');
  }
  // Physical pointers take priority over camera input. Listen at window capture
  // because the camera's Rotate/Pan handlers consume pointer events on document.
  const manualPointers=new Set();
  window.addEventListener('pointerdown',event=>{
    if(!main.contains(event.target)||event.button>2||
      (!main.classList.contains('hands-on')&&!main.querySelector('.hand-setup[open]')))return;
    manualPointers.add(event.pointerId);reset();
    note('Using mouse or touch. Release, then open your hand to resume.');
  },true);
  const releasePointer=event=>{
    if(manualPointers.delete(event.pointerId)&&!manualPointers.size)reset();
  };
  for(const type of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(type,releasePointer,true);
  const clearPointers=()=>{manualPointers.clear();reset();};
  window.addEventListener('blur',clearPointers);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearPointers();});
  function cursor(root) {
    const el = document.createElement('span');
    el.className = 'hand-cursor'; el.dataset.color = [...active.values()].some(h=>h.cursor.dataset.color==='1') ? '0' : '1'; el.setAttribute('aria-hidden','true');
    root.append(el); return el;
  }
  function frame(result,time,aspect,mirror,dialog=null) {
    if(manualPointers.size)return [];
    const scene=stage(), kit=scene?.handKit;
    const table=!dialog && builder() && main.querySelector('#hand-periodic-panel[open]');
    const surface=dialog || main.querySelector('.lab-surface') || scene, root=dialog || table || main;
    if (!surface || (!dialog && !table && !kit)) return [];
    // Frames can still arrive inside a closing dialog. Move tracking back to
    // the bench with fresh cursors and require a new grasp on the new surface.
    if (previousRoot && (root!==previousRoot || scene!==previousScene || kit!==previousKit)) resetTracking();
    previousRoot=root;previousScene=scene;previousKit=kit;
    const token=revision, mode=main.dataset.mode;
    const current=()=>revision===token && main.dataset.mode===mode && stage()===scene && scene?.handKit===kit;
    // On a narrow screen the bench is one scrolling column taller than the screen: aim over the part
    // of it that is on screen (a wide layout fits on screen, so this changes nothing there).
    const whole=surface.getBoundingClientRect(), screen=root.getBoundingClientRect();
    const clipped=dialog||table?whole:(()=>{const left=Math.max(whole.left,screen.left,0),top=Math.max(whole.top,screen.top,0);
      const right=Math.min(whole.right,screen.right,innerWidth),bottom=Math.min(whole.bottom,screen.bottom,innerHeight);
      return right-left>40&&bottom-top>40?{left,top,width:right-left,height:bottom-top}:whole;})();
    const r=clipped;
    const view=builder()?scene:scene?.querySelector('#viewport');
    const selector=dialog?setupTools:table?'button:not([hidden])':benchTools;
    const floatingBars=!dialog && main.classList.contains('hands-on');
    const events = gestures.update(result,time,aspect,mirror);
    // Apply view motion first so a simultaneous drop tests the current view.
    events.sort((a,b) => Number(navigating(active.get(b.id)?.action))-Number(navigating(active.get(a.id)?.action)));
    let reported=false,activate=null;
    for (const e of events) {
      if (e.phase === 'lost') {
        if(active.get(e.id)?.action==='part'){note('Hand lost. Part returned. Open your hand to pick it up again.');reported=true;}
        clear(e.id); continue;
      }
      let h = active.get(e.id);
      if (e.phase==='missing') {
        if (h) {
          h.cursor.hidden=true;h.pending=null;h.orbSince=null;h.lock=h.steady=h.openPeak=null;setHover(h,null);
          if(h.action==='command'||h.action==='palette'){h.action=null;h.command=null;}
        }
        continue;
      }
      if (!h) {
        const pointer=cursor(root);
        h={id:e.id,cursor:pointer,action:null,kit};
        active.set(e.id,h);
      }
      const resumed=h.cursor.hidden;
      h.cursor.hidden=false;
      const rawX=r.left+e.x*r.width, rawY=r.top+e.y*r.height;
      const barX=r.left+Math.min(r.width-1,toolbarReach(e.x)*r.width);
      const barY=r.top+Math.min(r.height-1,toolbarReach(e.y)*r.height);
      let x=rawX,y=rawY,hit=document.elementFromPoint(x,y),command=enabledControl(root,hit,selector);
      // The periodic sphere under the direct (unstretched) point keeps its priority over a held control,
      // except while that control is being selected.
      const locking=floatingBars && !table && !main.classList.contains('ms-hand-layout') && (!h.action || h.action==='command')
        && (command?.id!=='hand-periodic-orb' || Boolean(h.lock && (e.intent || h.action==='command')));
      const locked=locking ? barLock(h,resumed,{x:barX,y:barY},e) : (h.lock=h.steady=null);
      if(locked){
        // The cursor leans toward the held control's centre, so the hold is visible.
        const box=locked.getBoundingClientRect(),cx=box.left+box.width/2,cy=box.top+box.height/2;
        x=Math.max(box.left+3,Math.min(box.right-3,cx+.35*(h.steady.x-cx)));
        y=Math.max(box.top+3,Math.min(box.bottom-3,cy+.35*(h.steady.y-cy)));
        hit=locked;command=enabledControl(root,hit,selector);
      }else if(table){
        // Only the table receives gestures while the picker is open. Stretch the
        // camera frame slightly so the palm can reach both outermost columns.
        const panel=table.getBoundingClientRect();
        x=panel.left+reach(e.x)*Math.max(0,panel.width-1);
        y=panel.top+reach(e.y)*Math.max(0,panel.height-1);
        hit=document.elementFromPoint(x,y);command=enabledControl(table,hit,selector);
      }else if(h.action==='zoom'){
        x=r.left+e.palm.x*r.width;y=r.top+e.palm.y*r.height;hit=null;command=null;
      }else if(h.action==='part' && h.trayReach){
        x=barX;y=barY;hit=document.elementFromPoint(x,y);command=null;
      }else if((!h.action || h.action==='command') && command?.id!=='hand-periodic-orb'){
        const part=hit?.closest('[data-element],[data-order],#pair-piece,#tray .part');
        const edgeHit=floatingBars ? document.elementFromPoint(barX,barY) : null;
        const tool=enabledControl(root,edgeHit,'.hand-toolbar button,#hand-periodic-orb');
        if(tool && (!part || tool.classList.contains('hand-toolbar-grip'))){
          x=barX;y=barY;hit=tool;command=tool;
        }else if(edgeHit?.closest('#builder-tray') || hit?.closest('#builder-tray')){
          x=barX;y=barY;hit=edgeHit;command=enabledControl(root,hit,selector);
        }else if(!part && !(floatingBars && command?.closest('.hand-toolbar')) && !main.classList.contains('ms-hand-layout')){
          // The studio hand layout keeps every control inside the tracked surface, so aiming stays direct.
          // Fixed controls can sit outside the camera, beside the Inspector or in a dialog.
          const tx=screen.left+reach(e.x)*Math.max(0,screen.width-1);
          const ty=screen.top+reach(e.y)*Math.max(0,screen.height-1);
          const fixed=enabledControl(root,document.elementFromPoint(tx,ty),selector);
          if(fixed && !(floatingBars && fixed.closest('.hand-toolbar')) &&
              (!command || fixed.closest('.immerse-hud,.lab-camera,.lab-top') || dialog)){
            x=tx;y=ty;hit=fixed;command=fixed;
          }
        }
      }
      if(h.action==='palette'){
        const mx=h.toolbarGrip?barX:rawX,my=h.toolbarGrip?barY:rawY;
        // A steady grasp opens the sphere. A deliberate drag latches until release,
        // even when the learner brings the sphere back to its starting point.
        if(resumed || h.dragged || Math.hypot(mx-h.motionX,my-h.motionY)>=14){
          if(!resumed && (e.phase==='move'||e.phase==='release')){
            h.command.movePaletteBy(mx-h.motionX,my-h.motionY);h.dragged=true;
          }
          h.motionX=mx;h.motionY=my;
        }
        x=mx+h.offsetX;y=my+h.offsetY;hit=h.command;command=h.command;
      }
      // Keep the initially aimed tray button through small palm shifts while
      // closing. Crossing the tray with an open hand still changes the target.
      const reserved=h.pending?.key;
      if(e.intent && h.pending?.since===e.intentSince && reserved instanceof Element
          && reserved.closest('#builder-tray') && Math.hypot(x-h.pending.x,y-h.pending.y)<=32){
        x=h.pending.x;y=h.pending.y;hit=reserved;command=enabledControl(root,hit,selector);
      }
      h.cursor.style.left=x+'px';h.cursor.style.top=y+'px';
      const target=command || (!table && surface.contains(hit)?hit:null);
      const hover=command || target?.closest('#tray .part, #builder-tray button');
      const name=command?controlName(command):'';
      if(command && !dialog && !h.action && h.hover!==command){
        note(command.id==='hand-periodic-orb'?'Hold your open palm here to open the periodic table. Grasp and drag to move the sphere.'
          :name+(command.movePaletteBy?' · Close your hand to grasp.':' · Close and open to select.'));
        reported=true;
      }
      if(h.action==='command' && command!==h.command){
        h.action=null;h.command=null;
        if(!dialog){note('Selection canceled. Open your hand and aim again.');reported=true;}
      }
      const cameraMode=main.labCamera?.mode;
      const navigation=!dialog && view?.contains(target) && (cameraMode==='pan'||cameraMode==='orbit')
        ? (cameraMode==='pan'?'pan':'turn') : null;
      setHover(h,hover);
      const touchingOrb=command?.id==='hand-periodic-orb' && !h.action && !e.grip && !e.intent
        && e.armed && e.openness*100>=gestures.settings.open
        && ![...active.values()].some(other=>other.action);
      if(touchingOrb){
        h.orbSince ??= time;
        if(time-h.orbSince>=700)activate={control:command,x};
      }else h.orbSince=null;
      // Reserve the object under this palm at the start of closing. Crossing
      // a different object during the confirmation delay cannot acquire it.
      if (e.intent) {
        const key=command || navigation || (!dialog && target ? kit.targetAt(target,x,y) : null);
        if(h.pending?.since!==e.intentSince){
          // Rotate and Pan own the whole model surface, even when it fills the camera view.
          const viewGrip=!dialog && !command && view?.contains(target) && (navigation!==null || key==='turn');
          const trayReach=Boolean(target?.closest('#builder-tray') && (locked===target || (x===barX && y===barY)));
          h.pending={since:e.intentSince,key,x,y,valid:key!=null,viewGrip,trayReach};
        }
        // A held control already pins the target, so only the target matters.
        if(h.pending.key!==key || (!locked && Math.hypot(x-h.pending.x,y-h.pending.y)>32))h.pending.valid=false;
      } else h.pending=null;
      if (e.phase==='press' && !zoom && target && h.pending?.valid) {
        const others=[...active.values()].filter(other=>other!==h);
        const canUseCommand=command && others.every(other=>!other.action ||
          (command.movePaletteBy && other.action==='palette' && other.command!==command));
        if(canUseCommand){
          h.command=command;
          h.action=command.movePaletteBy?'palette':'command';
          if((table && command.matches('.pt-cell,.pt-close')) || command.matches('[data-hand-page]')){
            command.click();
            if(!current())return events;
            h.action='await-open';
          }
          if(h.action==='palette'){
            h.dragged=command.id!=='hand-periodic-orb';
            h.toolbarGrip=command.classList.contains('hand-toolbar-grip') ||
              (command.id==='hand-periodic-orb' && x===barX && y===barY);
            if(h.toolbarGrip)command.focus({preventScroll:true});
            h.motionX=h.toolbarGrip?barX:rawX;h.motionY=h.toolbarGrip?barY:rawY;
            h.offsetX=x-h.motionX;h.offsetY=y-h.motionY;
          }
          if(!dialog && h.action!=='await-open')note(name+(h.action==='palette'?' · Move your hand, then open to leave it here.':' · Open to select.'));
        }else if(!command && !dialog && !others.some(other=>other.action==='command'||other.action==='palette')){
          if(navigation)h.action=navigation;
          else if(others.some(other=>other.action==='part'))h.action=kit.canTurn(target,x,y)?'turn':null;
          else{
            h.action=kit.begin(target,x,y);
            h.trayReach=h.pending.trayReach;
          }
          if(navigating(h.action)){
            h.viewPoint={x:rawX,y:rawY};
            h.viewGrip=h.pending.viewGrip;
            const partner=others.find(other=>navigating(other.action));
            if(partner){
              if(h.viewGrip && partner.viewGrip && !partner.cursor.hidden && partner.kit===kit){
                h.action=partner.action='zoom';
                partner.cursor.dataset.action='zoom';setHover(partner,null);
                zoom={hands:[partner,h],kit,distance:null};
                note('Spread hands to zoom in. Bring them together to zoom out.');
              }else h.action=null;
            }
          }
        }
        if(h.action==='pan')note('Panning the view. Open your fingers to stop.');
        if(h.action==='turn')note('Turning the model. Open your fingers to stop.');
        if(h.action==='part')note(builder() && main.dataset.transfer==='true'
          ? 'Bring the metal and nonmetal close together to snap.'
          : 'Carry the part. Open your fingers to release.');
        reported=!!h.action||reported;
      } else if(e.phase==='move' && h.action) {
        if(navigating(h.action)){
          const radius=Math.max(3,Math.min(6,Math.min(r.width,r.height)*.006));
          h.viewPoint=steadyHandMotion(resumed?null:h.viewPoint,{x:rawX,y:rawY},radius);
          const {dx,dy}=h.viewPoint;
          if(dx||dy){if(h.action==='turn')kit.turn(dx,dy);else kit.pan(dx,dy);}
        }
        if(h.action==='part'){
          const result=kit.move(x,y);
          if(result==='snapped'||result==='returned'){
            h.action='await-open';
            note([feedback(),'Open your hand to pick up another atom.'].filter(Boolean).join(' '));
            reported=true;
          }
        }
      } else if(e.phase==='release') {
        // true: this hand opened on purpose, so an armed atom may be placed (drag-kit.js).
        if(navigating(h.action)){kit.endTurn(true);note('View set.');}
        if(h.action==='part') {
          if(target?.closest('#tray, #return-tray, #viewport, #builder-stage, #builder-tray [data-element], #builder-tray [data-order], #pair-piece')||target===scene) kit.release(x,y);
          else kit.cancel();
          note(feedback() || 'Released.'); reported=true;
        }
        if(h.action==='palette'){
          if(!h.dragged)activate={control:h.command,x};
          else note('Position set.');
          reported=true;
        }
        if(h.action==='command' && command===h.command && !command.disabled)activate={control:command,x};
        h.command=null;
        h.action=null;
      }
      h.cursor.dataset.action=h.action||'aim';h.rawX=rawX;h.rawY=rawY;
    }
    if(zoom){updateZoom(events,r);reported=true;}
    if(!dialog){
      undo.disabled=!undoButton() || undoButton().disabled || [...active.values()].some(h=>h.action==='part');
      const count=gestures.hands.filter(hand=>hand.seen===time).length;
      if(!reported && count!==Number(bar.dataset.count)){
        if(count===2)note(main.labCamera?.mode==='move' ? 'Grasp empty space with both hands to zoom.' : 'Grasp the view with both hands to zoom.');
        else note(count ? 'Aim at a part or a control. Close your hand, then open to release.' : 'Show an open hand inside the player frame.');
      }
      bar.dataset.count=String(count);
    }
    // Opening settings or changing mode can reset every hand synchronously.
    if(activate && current() && ![...active.values()].some(hand=>hand.action)){
      const {control,x}=activate;
      if(!enabledControl(root,control,selector))return events;
      if(!dialog)note(controlName(control)+' selected.');
      if(control.type==='range'){
        const track=control.getBoundingClientRect();
        // Leave half a thumb at each end so both limits are easy to select.
        const fraction=Math.max(0,Math.min(1,(x-track.left-8)/Math.max(1,track.width-16)));
        const min=Number(control.min),max=Number(control.max);
        control.value=String(min+fraction*(max-min));
        control.dispatchEvent(new Event('input',{bubbles:true}));
      }else control.click();
    }
    return events;
  }
  return {frame,reset,configure(values){gestures.settings=handSettings(values);reset();},ready:()=>Boolean(stage()?.handKit)};
}
