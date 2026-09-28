/* Contact and plunger handling adapted from ELISA's classroom controller.
   v3: rejected actions are reported through api.reject for the debrief.
   No action depends on rendered color or on an animation reaching its last frame. */
(function(root){
  'use strict';
  const {Contact,HAND_GAP_MS}=root.ClassroomCore || require('./hand-core.js');
  const CONTACT_KINDS=['reagent','well','spot','tips'],TRANSFER_KINDS=['reagent','well','spot'],LIQUID_KINDS=['reagent','well'];
  // Depth at which the tip is in the liquid (the same depth a draw requires).
  const IMMERSED=.85;
  // Hanging the pipette: an open palm held this long over the stand.
  const HANG_MS=450;
  /* Hand aiming. A target locks only once the aim has settled on it, so sweeping across the card never
     captures the tip on a spot it merely passes over. Until the tip is inserted, sliding sideways onto a
     neighbour, lifting or travelling well past the insertion depth releases the lock at once, with nothing
     cancelled. Distances ending in Px are screen pixels; Raw values are normalized camera units. */
  const HAND_AIM={settleMS:160,settleMinPx:5,settleMaxPx:8,descentPauseMS:80,descentWindowMS:300,descentRaw:.006,descentSideRadii:.8,shallow:.35,relockMS:350,exitMS:300,slideRaw:.012};
  class Interaction {
    constructor(api){this.a=api;this.tool='view';this.target=null;this.contact=null;this.pending=null;this.pressed=false;this.candidate=null;this.cooldown=null;this.lastFrame=null;this.gripSince=null;this.openSince=null;this.stats={cancelled:0,rejected:0,transfers:0};}
    get p(){return this.a.protocol();}
    resetMotion(reason=''){
      if(this.pending)this.stats.cancelled++;
      this.pending=null;this.contact=null;this.candidate=null;this.pressed=false;this.gripSince=null;this.gripTarget=null;this.openSince=null;this.standSince=null;this.lastFrame=null;
      if(this.target)this.setTarget(this.target); // refresh the ring: no longer locked
      this.a.pose?.(this);if(reason)this.a.say?.(reason);this.a.update?.();
    }
    commit(action,source='mouse'){
      try{const message=this.p.dispatch(action,source);if(['aspirate','dispense'].includes(action.type))this.stats.transfers++;this.a.commit?.(action);this.a.say?.(message);this.a.update?.();return true;}
      catch(e){this.stats.rejected++;this.a.reject?.(action,e,source);this.a.say?.(e.message,true);return false;}
    }
    select(tool,source='mouse'){
      if(this.p.status!=='running')return;
      if(tool==='card'&&this.p.cardLocation!=='held'&&!this.commit({type:'pickCard'},source))return;
      if(this.tool==='card'&&this.p.cardLocation==='held'&&tool!=='card'){
        if(!this.commit({type:'placeCard',target:'bench'},source))return;
      }
      this.resetMotion();this.a.park?.(this.tool);this.tool=tool;this.setTarget(null);this.a.update?.();
    }
    eligible(t){
      if(this.tool==='view')return ['tool','card','station','plate'].includes(t.kind)&&(t.kind!=='plate'||(this.p.phase==='prepare'&&!this.p.samplesSettled));
      if(this.tool==='card')return t.kind==='station';
      return ['reagent','well','spot','tips','waste','stand'].includes(t.kind);
    }
    setTarget(t){this.target=t;this.a.target?.(t);}
    actionFor(t){
      if(!t)return null;
      if(t.kind==='tips')return {type:'attach'};
      if(t.kind==='waste')return {type:'eject'};
      if(t.kind==='card')return {type:'pickCard'};
      if(t.kind==='plate')return {type:'tapPlate',target:'plate'};
      if(t.kind==='station')return {type:'placeCard',target:t.id};
      if(t.kind==='tool')return null;
      return this.p.tip?.volume?{type:'dispense',target:t.sample||t.id,surface:t.kind==='well'?'well':'card'}:{type:'aspirate',target:t.sample||t.id,surface:t.kind==='well'?'well':t.kind==='reagent'?'reagent':'card'};
    }
    activate(t,source){
      if(!t)return;
      if(t.kind==='tool')this.select('pipette',source);
      else if(t.kind==='plate')this.commit({type:'tapPlate',target:'plate'},source);
      else if(t.kind==='card')this.select('card',source);
      else if(t.kind==='station'&&this.tool==='card'){
        if(this.commit({type:'placeCard',target:t.id},source)){this.tool='view';this.resetMotion();this.setTarget(null);this.a.update?.();}
      }
    }
    lock(t,f){this.contact=new Contact(t,f);this.candidate=null;this.cooldown=null;this.setTarget(t);}
    // A plunger stroke bound to the locked target, as opposed to a plunger pressed in the air.
    holding(){return this.pressed&&['draw','deliver'].includes(this.pending?.kind);}
    screenRadius(t){return this.a.screen?.(t)?.r??22;}
    cooling(t,f){return !!(t&&this.cooldown?.id===t.id&&f.now<this.cooldown.until);}
    /* Before insertion, moving onto a neighbouring target hands the lock over. It needs real hand travel (slideRaw,
       about 7 mm) as well as the aim being nearer the neighbour, and it checks the locked target's screen row, because
       lowering the palm also moves the aim down. Returns 'far' for a clearly deliberate move. */
    slidOff(c,f){
      const travel=Math.abs(f.rawX-c.x);if(!(travel>=HAND_AIM.slideRaw))return false;
      const y=this.a.screen?.(c.target)?.y??c.cy;if(!Number.isFinite(f.x)||!Number.isFinite(y))return false;
      const next=this.a.pick(f.x,y,t=>this.eligible(t)&&CONTACT_KINDS.includes(t.kind),f.source,{prefer:c.target.id});
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
          // Lowering the palm also moves the aim down the card, strongly so at high cursor gain. A straight drop
          // right after a pause is the insertion itself, so it keeps the paused target instead of the next row.
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
    lockAim(t,base,f){
      this.lock(t,base);this.contact.update(f,false);
      if(!this.contact.valid){this.contact=null;return;}
      if(this.pending?.kind==='armed')this.bind(f,true);
    }
    feed(f){
      if(this.p.status!=='running'||!Number.isFinite(f.now))return;
      const hand=f.source==='hand';
      if(hand&&(!f.ready||(this.lastFrame&&(f.now-this.lastFrame.now>HAND_GAP_MS||f.now<this.lastFrame.now)))){this.resetMotion();if(!f.ready)return;}
      if(hand&&(!f.grip||f.open)&&(this.contact||this.pending||this.candidate))this.resetMotion();
      this.lastFrame=f;
      let t=this.a.pick(f.x,f.y,t=>this.eligible(t),f.source,hand?{prefer:this.target?.id}:undefined);
      if(this.contact){
        const c=this.contact,before=c.depth;
        c.update(f,this.holding());
        if(c.valid&&hand){
          // An exit counts only once it has lasted exitMS, or at once when it is clearly deliberate, so ordinary
          // arm sway and tremor never knock the tip off its target.
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
            this.resetMotion(stroke&&hand?'Stroke cancelled: the tip left its target. Nothing was transferred.':'');this.setTarget(null);return;
          }
        }
      }
      if(!this.contact){
        if(hand&&f.grip&&!f.open&&this.tool==='pipette'&&CONTACT_KINDS.includes(t?.kind))this.aim(t,f);
        else this.candidate=null;
      }
      if(this.contact)t=this.contact.target;
      this.setTarget(t);
      if(hand&&f.ready){
        if(this.tool==='view'||this.tool==='card'){
          // Pinch mode supplies f.hold (pinched); thumb mode picks up with a closed grip.
          if((f.hold??f.grip)&&!f.open&&t){if(this.gripSince===null||this.gripTarget!==t.id){this.gripSince=f.now;this.gripTarget=t.id;}if(f.now-this.gripSince>350){this.activate(t,'hand');this.gripSince=null;this.gripTarget=null;}}
          else{this.gripSince=null;this.gripTarget=null;}
        }else if(f.open&&!this.contact&&!this.pending){
          // The micropipette is hung back on its stand: bring it there and show an open palm. Elsewhere an open hand only
          // pauses handling, as nobody lets go of a real pipette in mid-air.
          if(this.openSince===null){this.openSince=f.now;this.openHinted=false;this.loadedHinted=false;}
          if(t?.kind==='stand'&&this.p.tip?.volume){
            // Never hang up a pipette with liquid in the tip: it can run back into the shaft.
            this.standSince=null;
            if(!this.loadedHinted){this.loadedHinted=true;this.a.say?.('Deliver the liquid first. A micropipette hung up with liquid in its tip lets it run back into the shaft.',true);}
          }
          else if(t?.kind==='stand'){this.standSince??=f.now;if(f.now-this.standSince>=HANG_MS){this.select('view','hand');this.a.say?.('Micropipette hung on its stand.');return;}}
          else{this.standSince=null;if(f.now-this.openSince>700&&!this.openHinted){this.openHinted=true;this.a.say?.('To put the micropipette down, take it back to its stand and show your open palm there.');}}
        }else this.openSince=this.standSince=null;
      }
      if(this.contact){
        if(t.kind==='tips'&&!this.p.tip&&this.contact.depth>=.95&&this.contact.rearmed){this.contact.rearmed=false;this.commit({type:'attach'},f.source);}
        // After a bubble error, lifting the tip out of the liquid with the plunger still pressed makes the stroke valid again.
        if(this.pending?.kind==='bubbles'&&this.pressed&&this.contact.depth<IMMERSED-.25){this.pending={kind:'armed'};this.bind(f,true);}
        if(this.pending?.kind==='deliver'&&this.contact.depth>=.85&&this.pressed){const a=this.pending.action;this.pending={kind:'spent',dispensed:hand};this.commit(a,f.source);}
      }
      this.a.pose?.(this,f);this.a.update?.();
    }
    press(f){
      if(this.p.status!=='running'||this.pressed)return;
      const hand=f.source==='hand';
      if(hand&&(!f.ready||!f.grip||f.open))return;
      if(this.tool==='view'||this.tool==='card'){this.activate(this.target,f.source);return;}
      this.pressed=true;const t=this.contact?.target||this.target;
      if(t?.kind==='waste'&&!this.contact){this.pending={kind:'spent'};this.commit({type:'eject'},f.source);return;}
      // Pressing before the aim has locked, as in real technique, arms the plunger. The stroke binds when a target locks.
      if(hand&&!this.contact){this.pending={kind:'armed'};this.a.pose?.(this,f);this.a.update?.();return;}
      if(!t||!TRANSFER_KINDS.includes(t.kind))return;
      // Real technique: an empty tip needs the plunger pressed before it enters the liquid. Pressing inside blows air into it.
      if(hand&&this.contact?.depth>=IMMERSED&&LIQUID_KINDS.includes(t.kind)&&this.p.tip&&!this.p.tip.volume){this.bubbles(f,t);return;}
      if(!this.contact)this.lock(t,f);
      this.bind(f,false);
    }
    bubbles(f,t){
      this.pending={kind:'bubbles'};this.stats.rejected++;
      const e=Object.assign(new Error('Bubbles! The plunger was pressed with the tip already in the liquid, which blows air into it. Keep it pressed, lift the tip out of the liquid, lower back in, then release slowly to draw.'),{code:'plunger'});
      this.a.reject?.(this.actionFor(t),e,f.source);this.a.say?.(e.message,true);this.a.pose?.(this,f);this.a.update?.();
    }
    valid(action){try{const copy=Object.assign(Object.create(Object.getPrototypeOf(this.p)),structuredClone(this.p));copy.dispatch(action);return true;}catch{return false;}}
    /* Bind the pressed plunger to the locked target. A rejected automatic hand lock stays armed and is not logged
       as a correction, so the learner can simply move on to the right target. */
    bind(f,keepArmed){
      const t=this.contact?.target;
      if(!t||!TRANSFER_KINDS.includes(t.kind)){this.pending={kind:'armed'};return;}
      const action=this.actionFor(t);
      // Validate against a disposable state so a rejected stroke never partially transfers.
      try{const copy=Object.assign(Object.create(Object.getPrototypeOf(this.p)),structuredClone(this.p));copy.dispatch(action);}
      catch(e){this.pending={kind:keepArmed?'armed':'spent'};this.stats.rejected++;if(!keepArmed)this.a.reject?.(action,e,f.source);this.a.say?.(e.message,true);return;}
      this.pending={kind:action.type==='aspirate'?'draw':'deliver',action};
      if(this.pending.kind==='deliver'&&this.contact.depth>=.85){this.pending={kind:'spent',dispensed:f.source==='hand'};this.commit(action,f.source);}
      this.a.pose?.(this,f);this.a.update?.();
    }
    release(f){
      const pending=this.pending;this.pending=null;this.pressed=false;
      if(pending?.kind==='draw'){
        if(this.contact?.valid&&this.contact.depth>=.85)this.commit(pending.action,f.source);
        else{this.stats.cancelled++;this.a.say?.('Nothing drawn. Keep the plunger pressed, lower into the source, then release.',true);}
      }else if(pending?.kind==='deliver'){this.stats.cancelled++;this.a.say?.('Nothing delivered. Lower to the marked contact position before releasing.',true);}
      else if(pending?.dispensed&&this.contact?.valid&&this.contact.depth>=IMMERSED&&LIQUID_KINDS.includes(this.contact.target.kind)&&this.p.tip&&!this.p.tip.volume){
        // Releasing the plunger with the tip still in the liquid draws it back up, as on a real pipette: this is how mixing works.
        const action=this.actionFor(this.contact.target);if(this.valid(action))this.commit(action,f.source);
      }
      else if(pending?.kind==='armed'&&!this.contact&&this.p.tip)this.a.say?.(this.p.tip.volume?'Nothing delivered. Pause over the receiver until it locks, then lower and press.':'Nothing drawn. Pause over the source until it locks, lower, then release.',true);
      this.a.pose?.(this,f);this.a.update?.();
    }
    mouseDown(f){this.feed(f);if(this.tool==='view'||this.tool==='card'){this.activate(this.target,'mouse');return;}if(CONTACT_KINDS.includes(this.target?.kind)&&!this.contact)this.lock(this.target,f);if(this.target?.kind!=='tips')this.press(f);}
    mouseUp(f){if(this.pressed)this.release(f);this.contact=null;this.pending=null;if(this.target)this.setTarget(this.target);this.a.pose?.(this,f);this.a.update?.();}
  }
  root.MicroarrayInteraction=Interaction;if(typeof module!=='undefined')module.exports={Interaction,HAND_AIM};
})(globalThis);
