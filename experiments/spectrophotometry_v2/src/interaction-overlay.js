import {TargetGuides} from './targeting.js';
import {pipetteLevel} from './pipettes.js';

const byId = id => document.getElementById(id);
const textIfChanged = (el,text) => { if(el.textContent!==text) el.textContent=text; };

export class InteractionOverlay {
 constructor({scene, geometry, interaction, layout, mouse, onLocate, stopHand}){
  Object.assign(this,{scene,geometry,interaction,layout,mouse,onLocate,stopHand});
  this.guides=new TargetGuides(scene,geometry);
  this.menu=byId('targetsMenu');
  this.select=byId('targetSelect');
  byId('locateTarget').onclick=()=>onLocate(interaction.nextTarget());
  byId('targetLocate').onclick=()=>onLocate(this.select.value);
  this.select.onchange=()=>{ interaction.previewTarget=this.select.value; interaction.changed(); };
  this.menu.addEventListener('toggle',()=>{
   if(this.menu.open) this.updatePanel(true);
   interaction.previewTarget=this.menu.open?this.select.value:null;
   interaction.changed();
  });
  byId('targetUse').onclick=()=>{
   this.stopHand();
   if(this.mouse.stroke || interaction.pointerDose || !interaction.usable() || layout.active) return;
   if(interaction.owner==='mouse'||interaction.owner==='touch') interaction.owner='keyboard';
   this.panelAction().use();
   this.updatePanel();
  };
  byId('targetLift').onclick=()=>{
   if(!interaction.usable() || layout.active || this.mouse.stroke || interaction.pointerDose || !interaction.owner) return;
   this.stopHand();
   interaction.setDepth(0); interaction.finishDepth(); this.updatePanel();
  };
 }
 panelAction(){
  const c=this.interaction, contact=c.contact, target=this.select.value;
  if(!c.owner || !contact){
   const name=c.targetName(target);
   let label='Use '+name;
   if(target?.endsWith('-grip')) label='Pick up '+(target==='cuvette-grip'?'cuvette':name.toLowerCase());
   else if(target==='lid') label=this.geometry.isLidOpen()?'Close lid':'Open lid';
   else if(target==='zero'||target==='read') label='Press '+target.toUpperCase();
   else if(target==='clipboard') label='Open notebook';
   else if(target?.endsWith('-stand')||target==='cuvette-dock') label='Put tool down';
   else if(c.owner) label='Align with opening';
   return {label,use:()=>c.selectTarget(target,'keyboard')};
  }
  const lift=()=>{c.setDepth(0);c.finishDepth();};
  if(contact.kind==='seat'){
   if(!c.getState().cuvette.inserted) return {label:'Seat cuvette',use:()=>c.setDepth(1)};
   if(c.step.action==='remove') return {label:'Lift cuvette out',use:lift};
   return {label:'Release cuvette',use:()=>c.release()};
  }
  if(contact.kind==='pour'){
   if(c.tilt>.08 || c.step.action!=='empty') return {label:'Turn upright',use:()=>{
    c.setTilt(0); c.leavePour(); const p=this.geometry.project('cuvette-grip'); c.prepareCarry(p.x,p.y); c.changed();
   }};
   return {label:'Tip into waste',use:()=>c.setTilt(2.1)};
  }
  if(contact.target!==c.step.target || contact.mode!==c.step.action) return {label:'Lift tip clear',use:lift};
  if(c.flow) return {label:'Stop flow',use:()=>c.squeeze(c.step.action==='aspirate')};
  if(c.step.action==='aspirate' && !c.charged){
   if(contact.depth>0) return {label:'Lift tip clear',use:lift};
   return {label:'Squeeze bulb',use:()=>c.squeeze(true)};
  }
  if(contact.depth<.99) return {label:'Lower tip',use:()=>c.setDepth(1)};
  if(c.step.action==='aspirate') return {label:'Release bulb to draw',use:()=>c.squeeze(false)};
  return {label:'Squeeze to deliver',use:()=>c.squeeze(true)};
 }
 updatePanel(opened=false){
  const c=this.interaction;
  const ids=c.tool&&!c.owner?[c.tool+'-grip']:c.candidates(),signature=ids.join('|');
  if(this.signature!==signature){
   this.signature=signature; this.select.replaceChildren(...ids.map(id=>new Option(c.targetName(id),id)));
   this.select.value=ids.includes(c.nextTarget())?c.nextTarget():ids[0];
  }else if(c.contact && c.owner && ids.includes(c.contact.target)) this.select.value=c.contact.target;
  else if((opened||this.previousContact) && ids.includes(c.nextTarget())) this.select.value=c.nextTarget();
  this.previousContact=!!c.contact;
  const command=this.panelAction(), allow=c.usable()&&!this.layout.active&&!this.mouse.stroke&&!c.pointerDose;
  textIfChanged(byId('targetUse'),command.label);
  byId('targetUse').disabled=!allow;
  this.select.disabled=!allow||!!c.contact&&!!c.owner;
  byId('targetLift').hidden=!c.owner||c.contact?.kind!=='pipette'||command.label==='Lift tip clear';
  byId('targetLift').disabled=!allow;
 }
 updateMeniscus(){
  const c=this.interaction, guide=byId('meniscusGuide');
  const volume=c.holdsPipette?c.getState()[c.tool].volume:0;
  if(volume<=0||this.layout.active||document.querySelector('dialog[open]')){guide.hidden=true;return}
  const point=this.scene.r.project(this.geometry.world(c.tool,[0,pipetteLevel(volume),0]));
  const canvas=this.scene.r.canvas;
  if(point.z< -1||point.z>1||point.x<5||point.x>canvas.clientWidth-5||
     point.y<12||point.y>canvas.clientHeight-12){guide.hidden=true;return}
  guide.style.transform='translate('+point.x+'px,'+point.y+'px)';
  guide.classList.toggle('face-left',point.x>canvas.clientWidth-96);
  textIfChanged(guide.firstElementChild,volume.toFixed(1)+' mL');
  guide.hidden=false;
 }
 updateBulbCue(cue){
  const label=byId('pipetteCue'),c=this.interaction;
  if(!cue){label.hidden=true;return}
  const p=this.geometry.screenTarget(c.tool+'-bulb',{current:true}),canvas=this.scene.r.canvas;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(!p?.visible||p.x<0||p.x>w||p.y<0||p.y>h){label.hidden=true;return}
  textIfChanged(label.firstElementChild,'Bulb '+cue.bulb+' · '+cue.volume);
  textIfChanged(label.lastElementChild,cue.instruction);
  label.dataset.state=cue.flow?'flow':cue.bulb;
  label.hidden=false;
  const width=label.offsetWidth,height=label.offsetHeight,gap=p.radius+5;
  let x=p.x+gap,y=p.y-height/2;
  if(x+width>w-5){
   x=p.x-gap-width;
   if(x<5){x=p.x-width/2;y=p.y>gap+height+5?p.y-gap-height:p.y+gap}
  }
  label.style.left=Math.max(5,Math.min(w-width-5,x))+'px';
  label.style.top=Math.max(5,Math.min(h-height-5,y))+'px';
 }
 update(handCue=null,showBulb=true){
  const c=this.interaction;
  this.scene.marker.visible=false;
  this.updateMeniscus();
  this.updateBulbCue(showBulb?handCue:null);
  const item=c.tool||c.step.pipetteId||'pipette';const v=c.getState()[item].volume;
  textIfChanged(byId('toolReadout'),v.toFixed(1)+' mL · '+(item==='cuvette'?'cuvette':c.targetName(item).toLowerCase()));
  byId('locateTarget').disabled=!c.nextTarget()||this.layout.active;
  if(this.menu.open) this.updatePanel();
  if(this.layout.active||!c.usable()){ this.guides.hide(); return; }
  const locked=!!c.contact&&!!c.owner&&!c.frozen;
  const current=locked?c.contact.target:this.menu.open?this.select.value:c.hoverTarget||c.hoverRegion;
  const wrong=!!(current && c.owner && c.tool && !locked && current!==c.desiredTarget() && current!=='cuvette-dock'&&!current.endsWith('-stand'));
  this.guides.update(c.nextTarget(),current,{locked,invalid:wrong});
 }
}
