import {SAMPLES} from './model.js';

const numbers=['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
const sampleName=s=>s.stock ? numbers[s.stock]+' to '+numbers[s.water] : 'water blank';
const liquids={stockBottle:'Blue Number One stock solution',waterBottle:'distilled water',unknownBottle:'the unknown drink'};
const vessels={tube_dilution:'the dilution vessel',cuvette:'the cuvette'};

export function spokenInstruction(step){
 const sample=SAMPLES.find(s=>s.id===step.target||s.id===step.sample);
 if(step.action==='aspirate'||step.action==='dispense'){
  const amount=numbers[step.volume]+' milliliter'+(step.volume===1?'':'s');
  if(step.action==='aspirate'&&liquids[step.target])return 'Draw '+amount+' of '+liquids[step.target]+'.';
  const vessel=sample?(sample.stock?'the tube labeled '+sampleName(sample):'the water blank tube'):vessels[step.target];
  return step.action==='aspirate'?'Draw '+amount+' from '+vessel+'.':'Dispense '+amount+' into '+vessel+'.';
 }
 if(step.action==='measure'&&sample){
  return 'Measure the '+sampleName(sample)+(sample.stock?' standard':'')+' at six hundred and thirty nanometers.';
 }
 if(step.action==='zero')return 'Set the wavelength to six hundred and thirty nanometers. Then zero the instrument with the water blank.';
 return step.instruction.replace(/0\/10 · Blank/g,'water blank')
  .replace(/(\d+)\/(\d+) cuvette/g,(_,stock,water)=>'cuvette containing the '+numbers[stock]+' to '+numbers[water]+' standard')
  .replace(/630 nm/g,'six hundred and thirty nanometers');
}

export function voiceFile(text){
 return 'assets/voice/'+text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'')+'.mp3';
}

const preference='spectrophotometry-v2-procedure-voice';

export class ProcedureVoice {
 constructor(audio){
  this.audio=audio;
  this.enabled=true;
  this.activated=false;
  this.serial=0;
  this.trace=document.getElementById('voiceTrace').getContext('2d');
  this.audio.addEventListener('timeupdate',()=>this.drawWave());
  try{this.enabled=localStorage.getItem(preference)!=='off'}catch{}
  this.toggles=[...document.querySelectorAll('[data-voice-toggle]')];
  this.replays=[...document.querySelectorAll('[data-voice-replay]')];
  for(const button of this.toggles)button.addEventListener('click',()=>{
   this.activated=true;this.enabled=!this.enabled;
   try{localStorage.setItem(preference,this.enabled?'on':'off')}catch{}
   this.cancel();
   if(this.enabled)this.play();
  });
  for(const button of this.replays)button.addEventListener('click',()=>{this.activated=true;this.play()});
  const activate=event=>{
   if(this.activated||!event.isTrusted||event.target.closest?.('.theme-switch,[data-voice-toggle],[data-voice-replay],#pauseButton,#stopButton,#resetButton'))return;
   this.activated=true;
   if(this.enabled)this.play();
  };
  document.addEventListener('click',activate,true);
  document.addEventListener('pointerup',e=>{if(e.target.id==='labCanvas')activate(e)},true);
  document.addEventListener('keydown',e=>{if(e.target.id==='labCanvas'&&!e.repeat)activate(e)},true);
  const leave=()=>{this.activated=false;this.cancel()};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)leave()});
  window.addEventListener('pagehide',leave);
  this.render('idle');
 }
 render(mode){
  document.body.dataset.voice=mode;
  for(const button of this.toggles){
   button.setAttribute('aria-pressed',String(this.enabled));
   button.title=this.enabled?'Mute procedure voice':'Turn on procedure voice';
   button.querySelector('span').textContent=this.enabled?'Voice on':'Voice off';
  }
  for(const button of this.replays)button.disabled=this.status!=='running';
  const message=document.getElementById('voiceNotice');
  message.textContent=mode==='error'?'Voice unavailable. Replay the step to try again.':'';
 }
 cancel(){
  this.serial++;this.audio.onplaying=this.audio.onended=this.audio.onerror=null;
  this.audio.pause();this.render('idle');
 }
 reset(){this.step=null;this.cancel()}
 drawWave(){
  if(!this.trace||!this.envelope||document.body.dataset.voice!=='speaking'||document.getElementById('hudProcedure').hidden)return;
  const progress=this.audio.duration?this.audio.currentTime/this.audio.duration:0;
  const colors=getComputedStyle(this.trace.canvas);
  const played=colors.getPropertyValue('--visor-amber'),upcoming=colors.getPropertyValue('--visor-cyan');
  this.trace.clearRect(0,0,128,24);
  for(let i=0;i<this.envelope.length;i++){
   const height=2+parseInt(this.envelope[i],16)*1.4;
   this.trace.fillStyle=i/this.envelope.length<=progress?played:upcoming;
   this.trace.fillRect(i*4,(24-height)/2,2,height);
  }
 }
 play(){
  if(!this.step||this.status!=='running'||document.hidden)return;
  this.cancel();
  const version=this.serial;
  const update=mode=>{if(version===this.serial)this.render(mode)};
  const file=voiceFile(spokenInstruction(this.step));
  this.envelope=null;
  this.trace?.clearRect(0,0,128,24);
  this.waveforms??=fetch('assets/voice/waveforms.json').then(r=>r.ok?r.json():{}).catch(()=>({}));
  this.waveforms.then(waves=>{
   if(version===this.serial){this.envelope=waves[file.split('/').pop()];this.drawWave()}
  });
  if(this.audio.getAttribute('src')!==file||this.audio.error)this.audio.src=file;
  else this.audio.currentTime=0;
  this.audio.onplaying=()=>{update('speaking');this.drawWave()};
  this.audio.onended=()=>update('idle');
  this.audio.onerror=()=>update('error');
  this.audio.play().catch(error=>{
   if(version!==this.serial||error.name==='AbortError')return;
   if(error.name==='NotAllowedError')this.activated=false;
   update(error.name==='NotAllowedError'?'idle':'error');
  });
 }
 sync(step,status){
  if(this.step?.index===step.index&&this.step.instruction===step.instruction&&this.status===status)return;
  this.step=step;this.status=status;
  if(this.activated&&this.enabled&&status==='running'&&!document.hidden)this.play();
  else this.cancel();
 }
}
