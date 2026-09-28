/* ELISA tool, contact and plunger handling, rebuilt on the DNA microarray 3D (v3) controller.
   Hand aiming, exits, the armed plunger, bubble rejection, in-well mixing and hanging a tool on its stand
   follow v3. ELISA keeps its marker (palm-down placing), wash pipette, strip inversion and towel taps.
   No action depends on rendered color or on an animation reaching its last frame. */
(function(root){
  'use strict';
  const {Contact,HAND_GAP_MS,angle}=root.ClassroomCore||require('./hand-core.js');
  const PIPETTES=['micro','wash'];
  // The marker locks onto a label pad like a pipette onto an opening, so a pad it merely passes over is never written on.
  const CONTACT_KINDS={micro:['reagent','well','tips'],wash:['wash','well'],marker:['label']};
  // Depth at which the marker nib touches a locked label pad.
  const NIB_DOWN=.5;
  const LIQUID_KINDS=['reagent','well','wash'];
  const TOOL_OF={microtool:'micro',washtool:'wash',markertool:'marker'};
  // Where each held tool is put away: bring it there and show an open palm (hand), or click it (mouse).
  const STAND_OF={micro:'stand:micro',wash:'stand:wash',marker:'stand:marker',strip1:'home1',strip2:'home2'};
  const NAMES={micro:'micropipette',wash:'transfer pipette',marker:'marker',strip1:'strip 1',strip2:'strip 2'};
  const PLACES={micro:'its stand',wash:'its holder beside the beaker',marker:'its tray',strip1:'its outline on the sheet',strip2:'its outline on the sheet'};
  // Depth at which the tip is in the liquid (the depth a draw or a delivery requires).
  const IMMERSED=.85;
  // Putting a tool away: an open palm held this long over its stand.
  const HANG_MS=450;
  /* Hand aiming. A target locks only once the aim has settled on it, so sweeping along a strip never captures the
     tip on a well it merely passes over. Until the tip is inserted, sliding sideways onto a neighbour, lifting or
     travelling well past the insertion depth releases the lock, with nothing cancelled. Exits count only once they
     last exitMS or are clearly deliberate, so arm sway never knocks the tip off. Px are screen pixels; Raw values
     are normalized camera units. */
  const HAND_AIM={settleMS:160,settleMinPx:5,settleMaxPx:8,descentPauseMS:80,descentWindowMS:300,descentRaw:.006,descentSideRadii:.8,shallow:.35,relockMS:350,exitMS:300,slideRaw:.012};
  class Interaction {
    constructor(api){
      this.a=api;this.tool='navigate';this.target=null;this.contact=null;this.pending=null;this.pressed=false;this.candidate=null;this.cooldown=null;this.lastFrame=null;
      this.pointerHeld=false;this.pen=null;this.gripSince=null;this.gripTarget=null;this.openSince=null;this.standSince=null;
      this.stripNormal=null;this.inverted=false;this.taps=0;this.tapDone=false;this.markerPalmBase=null;this.markerPalmDownSince=null;
      this.stats={cancelled:0,rejected:0,transfers:0};
    }
    get p(){return this.a.protocol();}
    running(){return this.a.running?.()!==false;}
    resetMotion(reason=''){
      if(['draw','deliver'].includes(this.pending?.kind))this.stats.cancelled++;
      this.pending=null;this.contact=null;this.candidate=null;this.pressed=false;this.pointerHeld=false;this.pen=null;
      this.gripSince=null;this.gripTarget=null;this.openSince=null;this.standSince=null;this.markerPalmDownSince=null;this.lastFrame=null;
      if(this.target)this.setTarget(this.target); // refresh the ring: no longer locked
      this.a.pose?.(this);if(reason)this.a.say?.(reason);this.a.update?.();
    }
    select(tool){
      this.resetMotion();this.a.park?.(this.tool);this.tool=tool;this.setTarget(null);
      this.inverted=false;this.taps=0;this.tapDone=false;this.stripNormal=null;this.markerPalmBase=null;this.cooldown=null;this.a.update?.();
    }
    stand(tool=this.tool){return STAND_OF[tool]||null;}
    eligible(t){
      if(!t)return false;const tool=this.tool;
      if(tool==='navigate')return ['tool','strip','timer'].includes(t.kind);
      if(t.id===STAND_OF[tool])return true;
      if(tool==='marker')return t.kind==='label';
      if(tool.startsWith('strip'))return t.id==='towels';
      if(tool==='micro')return ['reagent','well','waste','tips'].includes(t.kind);
      if(tool==='wash')return ['wash','well'].includes(t.kind);
      return false;
    }
    canContact(t){return !!t&&(CONTACT_KINDS[this.tool]?.includes(t.kind)||this.tool.startsWith('strip')&&t.id==='towels');}
    // A plunger (or bulb) stroke is possible at this opening.
    transferable(t){return !!t&&PIPETTES.includes(this.tool)&&this.canContact(t)&&t.kind!=='tips';}
    // The stroke at t would draw liquid up (as opposed to delivering it).
    draws(t){return this.tool==='wash'?t?.id==='WASH':!!this.p.tip&&!this.p.tip.volume&&['reagent','well'].includes(t?.kind);}
    setTarget(t){this.target=t;this.a.target?.(t);}
    actionFor(t){
      if(!t)return null;const p=this.p;
      if(t.kind==='tips')return {type:'attach',target:'tips'};
      if(t.kind==='waste')return {type:p.tip?.volume?'discard':'eject',target:'waste'};
      if(this.tool==='wash')return t.id==='WASH'?{type:'loadWash',target:'WASH'}:t.kind==='well'?{type:'wash',target:t.id}:null;
      if(p.tip?.volume)return t.kind==='well'?{type:'dispense',target:t.id}:null;
      return ['reagent','well'].includes(t.kind)?{type:'aspirate',target:t.id}:null;
    }
    valid(action){if(!action)return false;try{const copy=Object.assign(Object.create(Object.getPrototypeOf(this.p)),structuredClone(this.p));copy.dispatch(action);return true;}catch{return false;}}
    tryCommit(action,source='mouse'){
      try{
        if(!action)throw Error('Choose a receiving well.');
        const copy=Object.assign(Object.create(Object.getPrototypeOf(this.p)),structuredClone(this.p));copy.dispatch(action); // a rejected stroke never partially transfers
        const result=this.p.dispatch(action);this.p.log[this.p.log.length-1].input=source;
        if(['aspirate','dispense','loadWash','wash'].includes(action.type))this.stats.transfers++;
        this.a.commit?.(action,result);this.a.update?.();return true;
      }catch(e){this.stats.rejected++;this.a.reject?.(action,e,source);this.a.say?.(e.message,true);return false;}
    }
    activate(t,source){
      if(!t)return;
      if(t.kind==='tool')this.select(TOOL_OF[t.id]);
      else if(t.kind==='strip')this.select(t.id);
      else if(t.id===STAND_OF[this.tool]){const tool=this.tool;this.select('navigate');this.a.say?.(this.putAway(tool));}
      else if(t.id==='timer'){
        const next=this.p.recommend();
        if(next?.type==='wait'){this.a.say?.('The incubation timer is already running.');return;}
        if(next?.type!=='incubate'){this.a.say?.('No incubation is required right now.');return;}
        this.tryCommit({type:'incubate'},source);
      }
    }
    putAway(tool){return tool==='micro'?'Micropipette hung on its stand.':tool==='wash'?'Transfer pipette back in its holder.':tool==='marker'?'Marker placed in its tray.':'Strip '+tool.slice(-1)+' returned to its place.';}
    lock(t,f){this.contact=new Contact(t,f);this.candidate=null;this.cooldown=null;this.setTarget(t);}
    // A plunger stroke bound to the locked opening, as opposed to a plunger pressed in the air.
    holding(){return this.pressed&&['draw','deliver'].includes(this.pending?.kind);}
    screenRadius(t){return this.a.screen?.(t)?.r??22;}
    cooling(t,f){return !!(t&&this.cooldown?.id===t.id&&f.now<this.cooldown.until);}
    /* Before insertion, moving onto a neighbouring opening hands the lock over. It needs real hand travel (slideRaw,
       about 7 mm) as well as the aim being nearer the neighbour, and it checks the locked target's screen row, because
       lowering the palm also moves the aim down. Returns 'far' for a clearly deliberate move. */
    slidOff(c,f){
      const travel=Math.abs(f.rawX-c.x);if(!(travel>=HAND_AIM.slideRaw))return false;
      const y=this.a.screen?.(c.target)?.y??c.cy;if(!Number.isFinite(f.x)||!Number.isFinite(y))return false;
      const next=this.a.pick(f.x,y,t=>this.eligible(t)&&this.canContact(t),f.source,{prefer:c.target.id});
      return next&&next.id!==c.target.id?(travel>=2*HAND_AIM.slideRaw?'far':'near'):false;
    }
    // Leave a lock before insertion. Nothing was transferred, so nothing is cancelled; a bound plunger returns to armed.
    unlock(f){const c=this.contact;this.contact=null;this.candidate=null;this.cooldown={id:c.target.id,until:f.now+HAND_AIM.relockMS};if(this.holding()||this.pending?.kind==='bubbles')this.pending={kind:'armed'};}
    aim(t,f){
      const c=this.candidate;
      if(c){
        const r=this.screenRadius(c.target),settle=Math.min(HAND_AIM.settleMaxPx,Math.max(HAND_AIM.settleMinPx,r*.45));
        if(Math.hypot(f.x-c.x,f.y-c.y)<=settle){
          c.lastStill=f.now;
          if(c.target.id===t.id){if(!this.cooling(t,f)&&f.now-c.since>=HAND_AIM.settleMS)this.lockAim(c.target,c.frame,f);return;}
        }else if(c.lastStill-c.since>=HAND_AIM.descentPauseMS&&f.y>c.y&&Math.abs(f.x-c.x)<=Math.max(settle,r*HAND_AIM.descentSideRadii)&&this.centred(c,r)&&!this.cooling(c.target,f)){
          // Lowering the palm also moves the aim down the screen. A straight drop right after a pause is the
          // insertion itself, so it keeps the paused opening instead of the one below.
          const drop=f.palmY-c.frame.palmY;
          if(drop>=HAND_AIM.descentRaw){this.lockAim(c.target,c.frame,f);return;}
          // Wait only while the palm really is dropping; a smoothed cursor still creeping to a stop is not a descent.
          if(drop>=HAND_AIM.descentRaw*.3&&f.now-c.lastStill<=HAND_AIM.descentWindowMS)return;
        }
      }
      this.candidate={target:t,frame:{...f},since:f.now,lastStill:f.now,x:f.x,y:f.y};
    }
    // A deliberate aim puts the dot near the target's centre; a pause elsewhere followed by a downward move is travel.
    centred(c,r){const s=this.a.screen?.(c.target);return !s||Math.hypot(c.x-s.x,c.y-s.y)<=r*.5;}
    /* The base keeps the settled palm position but takes the current time: every frame since was seen (a gap clears the
       candidate), and a relock cooldown can outlast the gap limit. */
    lockAim(t,base,f){
      this.lock(t,{...base,now:f.now});this.contact.update(f,false);
      if(!this.contact.valid){this.contact=null;return;}
      if(this.pending?.kind==='armed')this.bind(f,true);
    }
    feed(f){
      if(!this.running()||!Number.isFinite(f.now))return;
      const hand=f.source==='hand';
      if(hand&&(!f.ready||(this.lastFrame?.source==='hand'&&(f.now-this.lastFrame.now>HAND_GAP_MS||f.now<this.lastFrame.now)))){this.resetMotion();if(!f.ready)return;}
      if(hand&&(!f.grip||f.open)&&(this.contact||this.pending||this.candidate))this.resetMotion();
      this.lastFrame=f;
      let t=this.a.pick(f.x,f.y,x=>this.eligible(x),f.source,hand?{prefer:this.target?.id}:undefined);
      if(this.contact){
        const c=this.contact,before=c.depth;
        c.update(f,this.holding());
        if(c.valid&&hand){
          let exit=c.exit,far=c.far;
          if(!exit&&before<HAND_AIM.shallow){const s=this.slidOff(c,f);if(s){exit='slide';far=s==='far';}}
          if(exit){if(c.exitSince==null){c.exitSince=f.now;c.exitDepth=before;}if(far||f.now-c.exitSince>=HAND_AIM.exitMS){c.valid=false;c.reason=exit;}}
          else c.exitSince=c.exitDepth=null;
        }
        if(!c.valid){
          const depth=c.exitDepth??before;
          if(hand&&c.reason!=='tracking'&&!(this.holding()&&depth>=HAND_AIM.shallow))this.unlock(f);
          else{
            const stroke=['draw','deliver'].includes(this.pending?.kind);
            this.resetMotion(stroke?'Transfer cancelled: the tip left its opening. Nothing was transferred.':'');this.setTarget(null);return;
          }
        }
      }
      if(!this.contact){
        if(hand&&f.grip&&!f.open&&this.canContact(t))this.aim(t,f);
        else this.candidate=null;
      }
      if(this.contact)t=this.contact.target;
      this.setTarget(t);
      if(hand&&f.ready){
        if(this.tool==='navigate'){
          // Pinch mode supplies f.hold (pinched); thumb mode picks up with a closed grip.
          if((f.hold??f.grip)&&!f.open&&t){if(this.gripSince===null||this.gripTarget!==t.id){this.gripSince=f.now;this.gripTarget=t.id;}if(f.now-this.gripSince>350){this.gripSince=null;this.gripTarget=null;this.activate(t,'hand');return;}}
          else{this.gripSince=null;this.gripTarget=null;}
        }else{
          if(this.tool.startsWith('strip')&&f.normal){
            // Turning the palm over inverts the held strip for draining.
            if(!this.stripNormal)this.stripNormal=[...f.normal];const turn=angle(f.normal,this.stripNormal);
            if(turn>1.92)this.inverted=true;else if(turn<1.05)this.inverted=false;
          }
          if(this.tool==='marker'&&f.normal&&!this.markerPalmBase)this.markerPalmBase=[...f.normal];
          if(f.open&&!this.contact&&!this.pending){
            // A tool is put away at its own stand: bring it there and show an open palm. Elsewhere an open hand only
            // pauses handling, as nobody lets go of a real pipette in mid-air. The marker may also be laid down by
            // turning the open palm downward, as before.
            if(this.openSince===null){this.openSince=f.now;this.openHinted=false;}
            if(t?.id===this.stand()){this.standSince??=f.now;if(f.now-this.standSince>=HANG_MS){const tool=this.tool;this.select('navigate');this.a.say?.(this.putAway(tool));return;}}
            else{
              this.standSince=null;
              if(this.tool==='marker'&&this.palmDown(f)){this.markerPalmDownSince??=f.now;if(f.now-this.markerPalmDownSince>420){this.select('navigate');this.a.say?.('Marker placed on the bench.');return;}}
              else this.markerPalmDownSince=null;
              if(f.now-this.openSince>700&&!this.openHinted){this.openHinted=true;this.a.say?.('To put the '+NAMES[this.tool]+' down, take it to '+PLACES[this.tool]+' and show your open palm there.'+(this.tool==='marker'?' Or turn the open palm downward.':''));}
            }
          }else this.openSince=this.standSince=this.markerPalmDownSince=null;
          if(this.tool==='marker'){if(this.contact?.target.kind==='label'&&this.contact.depth>=NIB_DOWN)this.write(this.contact.target,f);else this.pen=null;}
        }
      }
      if(this.contact){
        const c=this.contact;
        if(this.tool==='micro'&&t.kind==='tips'&&!this.p.tip&&c.depth>=.95&&c.rearmed){c.rearmed=false;this.tryCommit({type:'attach',target:'tips'},f.source);}
        if(this.tool.startsWith('strip')&&t.id==='towels'&&c.depth>=.95&&c.rearmed){c.rearmed=false;this.tap(f.source);}
        // After a bubble error, lifting the tip out of the liquid with the plunger still pressed makes the stroke valid again.
        if(this.pending?.kind==='bubbles'&&this.pressed&&c.depth<IMMERSED-.25){this.pending={kind:'armed'};this.bind(f,true);}
        if(this.pending?.kind==='deliver'&&c.depth>=IMMERSED&&this.pressed){const a=this.pending.action;this.pending={kind:'spent',dispensed:hand};this.tryCommit(a,f.source);}
      }
      if(!hand&&this.pointerHeld&&this.tool==='marker')this.write(t,f);
      this.a.pose?.(this,f);this.a.update?.();
    }
    /* Deliberate palm-down turn of the open hand. MediaPipe's cross-product normal reverses between left and right
       hands; the absolute-Y fallback keeps the gesture usable if handedness briefly flips while the hand is edge-on. */
    palmDown(f){const n=f.normal,base=this.markerPalmBase;if(!n||!base)return false;const sign=f.handName==='Left'?-1:1;return angle(n,base)>.72&&(n[1]*sign>.28||Math.abs(n[1])>.58);}
    press(f){
      if(!this.running()||this.pressed)return;
      const hand=f.source==='hand';
      if(hand&&(!f.ready||!f.grip||f.open))return;
      if(this.tool==='navigate'){this.activate(this.target,f.source);return;}
      if(!PIPETTES.includes(this.tool))return;
      this.pressed=true;const t=this.contact?.target||this.target;
      if(this.tool==='micro'&&t?.kind==='waste'&&!this.contact){this.pending={kind:'spent'};this.tryCommit(this.actionFor(t),f.source);return;}
      if(this.tool==='micro'&&!this.p.tip){this.pending={kind:'spent'};return;}
      // Pressing before the aim has locked, as in real technique, arms the plunger. The stroke binds when an opening locks.
      if(hand&&!this.contact){this.pending={kind:'armed'};this.a.pose?.(this,f);this.a.update?.();return;}
      if(!this.transferable(t))return;
      // Real technique: an empty tip (or bulb) is pressed before it enters the liquid. Pressing inside blows air into it.
      if(hand&&this.contact?.depth>=IMMERSED&&this.draws(t)){this.bubbles(f,t);return;}
      if(!this.contact)this.lock(t,f);
      this.bind(f,false);
    }
    bubbles(f,t){
      this.pending={kind:'bubbles'};this.stats.rejected++;
      const what=this.tool==='wash'?'bulb was squeezed':'plunger was pressed';
      const e=Object.assign(new Error('Bubbles! The '+what+' with the tip already in the liquid, which blows air into it. Keep it pressed, lift the tip out, lower back in, then release slowly to draw.'),{code:'plunger'});
      this.a.reject?.(this.actionFor(t),e,f.source);this.a.say?.(e.message,true);this.a.pose?.(this,f);this.a.update?.();
    }
    /* Bind the pressed plunger to the locked opening. A rejected automatic hand lock stays armed and is not logged as a
       correction, so the learner can simply move on to the right opening. */
    bind(f,keepArmed){
      const t=this.contact?.target,idle=keepArmed?'armed':'spent';
      if(!this.transferable(t)||this.tool==='micro'&&!this.p.tip){this.pending={kind:idle};return;}
      const action=this.actionFor(t);
      if(!action){this.pending={kind:idle};this.a.say?.('Choose a receiving well.',true);return;}
      try{const copy=Object.assign(Object.create(Object.getPrototypeOf(this.p)),structuredClone(this.p));copy.dispatch(action);}
      catch(e){this.pending={kind:idle};this.stats.rejected++;if(!keepArmed)this.a.reject?.(action,e,f.source);this.a.say?.(e.message,true);return;}
      const draw=['aspirate','loadWash'].includes(action.type);this.pending={kind:draw?'draw':'deliver',action};
      if(!draw&&this.contact.depth>=IMMERSED){this.pending={kind:'spent',dispensed:f.source==='hand'};this.tryCommit(action,f.source);}
      this.a.pose?.(this,f);this.a.update?.();
    }
    release(f){
      const pending=this.pending;this.pending=null;this.pressed=false;
      if(pending?.kind==='draw'){
        if(this.contact?.valid&&this.contact.depth>=IMMERSED)this.tryCommit(pending.action,f.source);
        else{this.stats.cancelled++;this.a.say?.('Nothing drawn. Keep the plunger pressed, lower the tip into the liquid, then release.',true);}
      }else if(pending?.kind==='deliver'){this.stats.cancelled++;this.a.say?.('Nothing delivered. Lower the tip into the receiving well before releasing.',true);}
      else if(pending?.dispensed&&this.contact?.valid&&this.contact.depth>=IMMERSED&&this.contact.target.kind==='well'){
        // Releasing the plunger (or bulb) with the tip still in the liquid draws it back up, as on a real pipette: this is
        // how a serial-dilution well is mixed. Where the step allows no draw, it is a technique correction and nothing moves.
        const action=this.tool==='micro'&&this.p.tip&&!this.p.tip.volume?this.actionFor(this.contact.target):null;
        if(this.valid(action))this.tryCommit(action,f.source);
        else{
          const part=this.tool==='wash'?'bulb squeezed':'plunger pressed';this.stats.rejected++;
          const e=Object.assign(new Error('Keep the '+part+' until the tip is out of the well. Releasing it in the liquid draws the liquid you delivered back up.'),{code:'plunger'});
          this.a.reject?.(null,e,f.source);this.a.say?.(e.message,true);
        }
      }
      else if(pending?.kind==='armed'&&!this.contact&&(this.tool==='wash'||this.p.tip))this.a.say?.((this.tool==='wash'?this.p.washVolume:this.p.tip.volume)?'Nothing delivered. Pause over a well until its ring turns gold, then lower and press.':'Nothing drawn. Pause over the source until its ring turns gold, lower, then release.',true);
      this.a.pose?.(this,f);this.a.update?.();
    }
    mouseDown(f){
      this.feed(f);this.pointerHeld=true;
      if(this.tool==='marker'&&this.target?.id!==this.stand()){this.write(this.target,f);return;}
      if(this.tool==='navigate'||this.target&&this.target.id===this.stand()){this.activate(this.target,'mouse');this.pointerHeld=false;return;}
      if(this.canContact(this.target)&&!this.contact)this.lock(this.target,f);
      if(PIPETTES.includes(this.tool)&&this.target?.kind!=='tips')this.press(f);
      this.a.pose?.(this,f);
    }
    mouseUp(f){if(this.pressed)this.release(f);this.pointerHeld=false;this.contact=null;this.pending=null;this.pen=null;if(this.target)this.setTarget(this.target);this.a.pose?.(this,f);this.a.update?.();}
    // Right-click: invert a held strip, or eject an empty tip over the waste.
    secondary(){
      if(!this.running())return;
      if(this.tool.startsWith('strip')){this.inverted=!this.inverted;this.a.pose?.(this,this.lastFrame);this.a.update?.();}
      else if(this.tool==='micro'&&this.target?.kind==='waste')this.tryCommit({type:'eject',target:'waste'},'mouse');
    }
    tap(source){
      if(this.tapDone)return;const mix=this.p.phase==='mixstop';
      if(!mix&&!this.p.phase.startsWith('wash')){this.a.say?.('Strip tapping is not required at this step.',true);return;}
      if(mix&&this.inverted||!mix&&!this.inverted){this.a.say?.(mix?'Keep the strip upright for final mixing.':'Invert the strip before draining.',true);return;}
      this.taps++;
      if(this.taps>=4){if(this.tryCommit({type:mix?'mixStopStrip':'drainStrip',target:+this.tool.slice(-1)},source))this.tapDone=true;else this.taps=0;}
      else this.a.say?.('Strip '+this.tool.slice(-1)+' · tap '+this.taps+' of 4.');
    }
    write(t,f){
      if(t?.kind!=='label'){this.pen=null;return;}const id=+t.id.slice(5);if(this.p.labels.includes(id))return;
      if(!this.pen||this.pen.id!==id)this.pen={id,x:f.x,y:f.y,d:0,path:[[f.x,f.y]]};
      const p=this.pen;p.d+=f.source==='hand'?Math.abs(f.x-p.x):Math.hypot(f.x-p.x,f.y-p.y);p.x=f.x;p.y=f.y;p.path.push([f.x,f.y]);
      if(p.d>=7){if(this.tryCommit({type:'label',target:id},f.source))this.a.mark?.(id,p.path);this.pen=null;}
    }
  }
  const api={Interaction,HAND_AIM,IMMERSED,NIB_DOWN,STAND_OF,TOOL_OF};
  root.ClassroomInteraction=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
