import {syncChoices} from './choices.js';
import {installReactionLab} from './reaction-lab.js?v=20261118-u1';
import {ANGLE_TOLERANCE} from './molecule-model.js';
import {studioCamera} from './studio-camera.js';
import {installHandBuilding} from './hand-building.js';

export const icon=(name)=>{
 const paths={settings:'M4 6h4m4 0h8M4 12h10m4 0h2M4 18h2m4 0h10M8 3v6M14 9v6M6 15v6',stop:'M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',microphone:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0zM6 10v2a6 6 0 0 0 12 0v-2M12 18v4M8 22h8',label:'M3 5h10l8 8-8 8-10-10z M8 8a1 1 0 1 0 0 2 1 1 0 1 0 0-2z',lonePair:'M20 4c4 5-4 15-11 16-6 1-8-4-5-9C7 6 15 1 20 4z M9 13.5a1.4 1.4 0 1 0 .01 0z M15 8.5a1.4 1.4 0 1 0 .01 0z',hand:'M8 13V5.5a1.5 1.5 0 0 1 3 0v6.3M11 11.8V3.5a1.5 1.5 0 0 1 3 0v8.3M14 11.8V5a1.5 1.5 0 0 1 3 0v7.3M17 12.3V8a1.5 1.5 0 0 1 3 0v6.4c0 4.6-2.5 7.1-6.4 7.1-2.7 0-4.5-1.2-6-3.1l-4-5.2a1.6 1.6 0 0 1 2.4-2.1L8 13',fit:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',rotate:'M20 8a8 8 0 1 0 0 8m0-13v5h-5',expand:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',undo:'M8 4 3 9l5 5M3 9h10a7 7 0 0 1 7 7',redo:'m16 4 5 5-5 5m5-5H11a7 7 0 0 0-7 7',plus:'M12 5v14M5 12h14',minus:'M5 12h14',trash:'M4 6h16M9 6V3h6v3M7 6l1 15h8l1-15M10 10v7m4-7v7',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',camera:'M4 7h4l2-3h4l2 3h4v13H4zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',layers:'m12 3 10 5-10 5L2 8zm-10 9 10 5 10-5M2 16l10 5 10-5',bond:'m5 18 14-12M4 13l11-10M9 21 20 9',arrow:'M5 12h14m-6-6 6 6-6 6',spark:'m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z',info:'M12 11v7m0-12v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'};
 return `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.plus}"/></svg>`;
};
const $=id=>document.getElementById(id);
const main=document.querySelector('main');
const header=document.querySelector('.mast');
const molecule=document.querySelector('.molecule');
header.replaceChildren();header.innerHTML=`<a class="back-link" href="../../../index.html" aria-label="Back to Virtual Lab home">← <span>Home</span></a><div class="title-lockup"><p class="eyebrow">THE MOLECULAR STUDIO <span>/ TOPIC 2.7</span></p><h1>Molecular studio</h1></div><div class="experience-controls"><button id="camera-backdrop" aria-pressed="false" title="Place the model over your camera view. Video stays on this device.">${icon('camera')}<span>In your room</span></button><button id="immersive" aria-pressed="false">${icon('spark')}<span>Immerse</span></button><button id="fullscreen" title="Full screen" aria-label="Full screen">${icon('expand')}</button></div>`;
document.querySelector('.intro').remove();
const tabs=document.createElement('nav');tabs.className='mode-tabs';tabs.setAttribute('aria-label','Modeling mode');
tabs.innerHTML='<div class="mode-switch" role="tablist" aria-label="Activity"><button id="tab-guided" role="tab" aria-selected="true" aria-controls="guided-mode"><span>Shapes</span><small>VSEPR model kit</small></button><button id="tab-builder" role="tab" aria-selected="false" aria-controls="builder-mode"><span>Build a molecule</span><small>Advanced · atom by atom</small></button><button id="tab-reaction" role="tab" aria-selected="false" aria-controls="reaction-mode"><span>Reactions</span><small>Follow every atom</small></button></div><p id="mode-caption"></p>';
header.after(tabs);
const reactionLab=installReactionLab(main);
const guided=document.createElement('div');guided.id='guided-mode';guided.setAttribute('role','tabpanel');guided.setAttribute('aria-labelledby','tab-guided');
tabs.after(guided);
guided.append($('loading'),$('station'),document.querySelector('.notes'),$('save-status'));
document.querySelector('nav[aria-label="Activity navigation"]')?.remove();
// The molecule list stays live but out of sight: practice-set pills and formula buttons drive it.
document.querySelector('.ms-carriers').append(molecule);
const advanced=document.createElement('section');advanced.id='builder-mode';advanced.hidden=true;advanced.inert=true;advanced.setAttribute('role','tabpanel');advanced.setAttribute('aria-labelledby','tab-builder');
advanced.innerHTML=`
<div class="builder-layout">
 <aside class="builder-panel" aria-label="Molecule construction">
  <section class="assignment" aria-labelledby="assignment-title">
   <button id="change-workbench" type="button" aria-expanded="false" aria-controls="workbench-options" hidden>Change workbench</button>
   <div id="workbench-options"><label for="bench-select">Workbench</label><select id="bench-select" data-choice="cards" data-native></select></div>
   <h2 id="assignment-title">Retrieval challenge</h2><p id="assignment-brief"></p>
   <section class="ionic-balance" aria-labelledby="balance-title" hidden>
    <h3 id="balance-title">Charge balance</h3><p id="ionic-inventory"></p><p id="ionic-total"></p><p id="ionic-result" role="status"></p>
   </section>
   <details id="assignment-scaffold"><summary>Construction hints</summary><ol id="assignment-hints"></ol></details>
   <button id="check-challenge" class="primary">Check construction</button>
   <p id="challenge-status" role="status" aria-live="polite"></p><ul id="challenge-feedback" aria-label="Construction feedback"></ul>
  </section>
  <div class="selection-heading"><h3 id="selected-title">Selected atom</h3><span id="selected-capacity"></span></div>
  <div id="atom-list" class="atom-list" role="group" aria-label="Select an atom"></div>
  <p id="selection-hint" class="compact-copy">Drag an atom to reposition it. Your other atoms stay where you placed them.</p>
  <div class="lone-pair-control"><span>Lone pairs on selection</span><output id="pair-count">0</output></div>
  <div id="local-gauge" class="local-gauge" role="group" aria-label="Local bond angle" hidden>
   <div><label for="local-first">First neighbor</label><select id="local-first" data-choice="chips" data-native></select></div>
   <div><label for="local-second">Second neighbor</label><select id="local-second" data-choice="chips" data-native></select></div>
   <output id="local-angle" aria-live="polite" for="local-first local-second"></output>
  </div>
  <details class="site-editor"><summary>Place and edit with buttons</summary>
   <p>The highlighted atom is the center for these edits. Choose an element and bond order in the tray above.</p>
   <div class="edit-row"><button id="place-free-atom">Place loose atom</button><button id="attach-atom">Attach atom</button></div>
   <label for="edit-partner">Second atom</label><select id="edit-partner" data-choice="chips" data-native></select>
   <div class="edit-row"><button id="join-atoms">Set bond</button><button id="detach-atoms">Remove bond</button></div>
   <div class="edit-row"><button id="seat-pair">Add lone pair</button><button id="unseat-pair">Remove lone pair</button></div>
   <label for="edit-arrangement">Arrange domains at the selected atom</label>
   <select id="edit-arrangement" data-choice="chips" data-native><option value="">Choose ideal directions</option><option value="2">Linear</option><option value="3">Trigonal planar</option><option value="4">Tetrahedral</option><option value="5">Trigonal bipyramidal</option><option value="6">Octahedral</option></select>
   <div class="edit-row"><button id="align-domains">Apply directions</button><button id="unseat-atom">Remove atom</button></div>
  </details>
  <div class="secondary-actions"><button id="remove-ion" hidden>Remove selected ion</button><button id="new-molecule">Clear this bench</button><details class="keyboard-kit"><summary>Keyboard</summary><p>Focus a tray part or atom button. Space picks it up; arrow keys move it; Enter drops it. Shift + arrows makes fine moves. Escape returns it. Delete removes a selected atom.</p></details></div>
  <details class="examples" hidden><summary>Editable reference models</summary><div id="example-molecules" class="example-molecules"></div></details>
  <div class="file-tools"><button id="save-model">${icon('download')} Save</button><button id="load-model">Open</button><input id="model-file" type="file" accept=".json,application/json" hidden><button id="snapshot">${icon('camera')} Image</button></div>
 </aside>
 <div class="builder-scene-column">
  <div id="builder-tray" class="builder-tray" role="region" aria-label="Parts">
   <div class="builder-parts">
    <div class="build-step"><span class="step-number">1</span><h3>Atoms</h3><span id="element-name">Carbon</span></div>
    <div id="element-palette" class="element-palette" role="group" aria-label="Element palette"></div>
    <p class="mobile-carry-hint">Hold a carried part at the top edge to scroll back to the scene.</p>
    <div class="build-step covalent-step"><span class="step-number">2</span><h3>Bonds</h3></div>
    <div class="bond-choices" role="group" aria-label="Bond pieces"><button data-order="1" aria-pressed="true" title="Single bond. Drag from a selected atom onto another"><span class="bond-piece single"><i></i></span>Single</button><button data-order="2" aria-pressed="false" title="Double bond. Drag onto an existing bond to change its order"><span class="bond-piece double"><i></i><i></i></span>Double</button><button data-order="3" aria-pressed="false" title="Triple bond. Drag onto an existing bond to change its order"><span class="bond-piece triple"><i></i><i></i><i></i></span>Triple</button></div>
    <div class="build-step covalent-step"><span class="step-number">3</span><h3>Lone pair</h3></div>
    <button id="pair-piece" class="pair-piece" title="Drag a lone pair onto an atom’s open site"><span class="pair-sculpt"><i></i><i></i></span><span>Lone pair<small>Drag onto a ring</small></span></button>
   </div>
   <div id="return-tray" class="kit-return" role="region" aria-label="Return tray"><span>${icon('trash')}</span><div><strong>Delete</strong><small>Drop a part here to remove it</small></div></div>
  </div>
  <div id="builder-ribbon" class="builder-ribbon" role="group" aria-label="Display and history">
   <div class="history-tools"><button id="builder-undo" title="Undo (Ctrl+Z)" aria-label="Undo construction">${icon('undo')}</button><button id="builder-redo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo construction">${icon('redo')}</button></div>
  </div>
  <div class="builder-scene-header"><div><span class="eyebrow">YOUR MOLECULE</span><h2 id="molecule-formula" title="Formula from your placed atom counts">Empty bench</h2></div><div class="model-stat"><span id="model-count">0 atoms · 0 bonds</span><span id="model-name"></span></div></div>
  <div class="model-views" role="group" aria-label="Molecular representation">
   <button data-style="ball" aria-pressed="true"><span class="representation ball"><i></i><i></i><i></i></span><span>Ball & stick</span></button>
   <button data-style="stick" aria-pressed="false"><span class="representation stick"><i></i><i></i><i></i></span><span>Stick</span></button>
   <button data-style="space" aria-pressed="false"><span class="representation space"><i></i><i></i><i></i></span><span>Space-filling</span></button>
   <button data-style="wire" aria-pressed="false"><span class="representation wire"><i></i><i></i><i></i></span><span>Wireframe</span></button>
  </div>
  <div id="builder-stage" class="builder-stage" tabindex="0" role="img" aria-label="Molecule workbench. Drag atoms to move them; drag empty space to rotate. Scroll to zoom. Keyboard parts can be picked up with Space and dropped with Enter."><div id="builder-labels" aria-hidden="true"></div><div id="empty-builder" class="empty-builder" hidden><span class="empty-atom"></span><strong>Your first atom goes here.</strong><span>Pick up an atom from the parts tray and release it here.</span></div><div class="stage-caption"><span id="representation-note">See the bonds and the shape between them.</span><span class="scene-tip">Drag a part to move it · drag space to rotate</span></div><p id="builder-loading" role="status">Opening the molecular studio…</p></div>
  <div class="builder-toolbar"><div class="view-toggles"><button id="show-pairs" aria-pressed="false">${icon('lonePair')} Lone pairs</button><button id="show-geometry" aria-pressed="false">${icon('bond')} Geometry</button><button id="show-labels" aria-pressed="true">${icon('label')} <span>Labels</span></button><button id="spin" aria-pressed="false">${icon('rotate')} Spin</button></div><div class="camera-tools"><button id="builder-fit" aria-label="Fit molecule" title="Fit molecule">${icon('fit')}</button><button id="builder-zoom-out" aria-label="Zoom molecule out">${icon('minus')}</button><button id="builder-zoom-in" aria-label="Zoom molecule in">${icon('plus')}</button></div></div>
  <div class="insight-strip"><div><span>VSEPR PREDICTION</span><strong id="local-shape">None</strong></div><div><span>PLACED DOMAINS</span><strong id="domain-count">0</strong></div><div><span>IDEAL ANGLES</span><strong id="ideal-angles">None</strong></div><div><span>YOUR ARRANGEMENT</span><strong id="spacing-status">Finish the model</strong></div></div>
  <p id="builder-status" class="builder-status" role="status" aria-live="polite">Select any atom to explore its local geometry.</p>
 </div>
</div>
<div class="builder-foot"><p id="builder-save-status">Your construction stays in this browser.</p><details><summary>About this model</summary>
<p><strong>Electron transfer.</strong> In hand mode, carry a neutral atom close to a compatible partner to snap them together. Each electron lost raises the metal’s charge by one and each electron gained lowers the nonmetal’s charge by one. Follow the e⁻ marker from donor to receiver. The changing spheres show the direction of the size change. The intermediate charges and electron paths illustrate bookkeeping, and you choose the arrangement of the formula unit. <a href="https://openstax.org/books/chemistry-2e/pages/6-5-periodic-variations-in-element-properties">Ionic radii</a></p>
<p><strong>Ionic compounds.</strong> On the charge-balance workbench, each piece starts as an ion with a fixed charge. The formula unit gives the smallest neutral whole-number ratio. Both workbenches model single-carbon carbide with Be or Mg. <a href="https://doi.org/10.1039/C9RA01573F">Carbide structures</a></p>
<p class="build-tip"><strong>Molecules.</strong> An atom snaps to an open ring. To join two placed atoms, select the first and drag a bond onto the second. Drag a bond onto an existing bond to change its order.</p>
<p>The covalent construction kit supports neutral, main-group molecules with up to 80 atoms. You place each atom, bond and lone pair. Snap rings suggest ideal local VSEPR directions. Freely dropped positions remain yours. The VSEPR prediction describes completed bonding and electron counts, and may differ from your current arrangement. Multiple bonds count as one domain. The formula counts the atoms on the bench. It uses familiar classroom formulas for the study molecules and Hill order for other compositions.</p>
<p>The kit uses illustrative lengths, sphere sizes and lone-pair lobes. Retrieval checks compare local domain angles with ideal geometry within ${ANGLE_TOLERANCE}°. Physical bond angles, energies, charges and preferred conformations require additional evidence. Hybridization is shown only for two to four domains (sp, sp², sp³), and the angle trend is a qualitative VSEPR prediction.</p><p>Workbench adapted from AP Chemistry Study Studio. <a href="../../../sources.html#source-b06">Collection credits and licenses</a> · <a href="https://doi.org/10.1002/anie.199604951">Gillespie on electron domains</a></p></details></div>`;
guided.after(advanced);
const examples=advanced.querySelector('.examples');advanced.querySelector('.builder-scene-header').after(examples);
advanced.querySelector('.builder-foot').prepend(advanced.querySelector('.file-tools'));
{const ribbon=advanced.querySelector('#builder-ribbon');ribbon.append(advanced.querySelector('.model-views'),advanced.querySelector('.view-toggles'));}
let builder,roomVideo=null,modeRevision=0;
// In your room: live camera behind the transparent model canvas. Frames never leave the page.
const roomScrim=document.createElement('div');roomScrim.className='room-scrim';roomScrim.setAttribute('aria-hidden','true');
const roomBar=document.createElement('div');roomBar.className='room-bar';roomBar.setAttribute('role','group');roomBar.setAttribute('aria-label','Room view');
roomBar.innerHTML=`<span class="room-note" title="The camera image is not uploaded or stored">${icon('camera')}<span>Camera stays on this device</span></span><label class="room-fade"><span>Fade room</span><input id="room-fade" type="range" min="0" max="80" step="5" value="25"></label><button id="room-mirror" type="button" aria-pressed="true" title="Flip the camera image left to right">Mirror</button><button id="room-switch" type="button" hidden title="Use the next camera">Switch camera</button><button id="room-capture" type="button" title="Save a picture of the model in your room">${icon('download')}<span>Capture</span></button><button id="room-stop" type="button" title="Turn the camera off">Stop</button>`;
const roomPart=id=>roomBar.querySelector('#'+id);
const roomHost=()=>main.dataset.mode==='builder'?$('builder-stage'):$('visual');
const fade=()=>{roomScrim.style.opacity=String(Number(roomPart('room-fade').value)/100);};
roomPart('room-fade').addEventListener('input',fade);fade();
function applyMirror(){roomVideo?.classList.toggle('mirrored',studioCamera.mirrored);roomPart('room-mirror').setAttribute('aria-pressed',String(studioCamera.mirrored));}
function mountRoom(){
 if(!roomVideo)return;const host=roomHost();if(!host)return;
 for(const el of document.querySelectorAll('.camera-live'))if(el!==host)el.classList.remove('camera-live');
 // The control strip sits beside the stage, not in it: the stage captures pointers for rotation.
 host.prepend(roomVideo);roomVideo.after(roomScrim);(host.closest('.lab-surface')||host).append(roomBar);host.classList.add('camera-live');
 if(roomVideo.paused&&roomVideo.srcObject)roomVideo.play().catch(()=>{});
}
function stopRoom(){
 if(roomVideo){roomVideo.srcObject=null;roomVideo.remove();}roomVideo=null;roomScrim.remove();roomBar.remove();
 for(const el of document.querySelectorAll('.camera-live'))el.classList.remove('camera-live');
 $('camera-backdrop').setAttribute('aria-pressed','false');
}
function syncRoom(){
 if(!studioCamera.has('room')||!studioCamera.video){stopRoom();return;}
 if(!roomVideo){roomVideo=document.createElement('video');roomVideo.className='room-video';roomVideo.autoplay=true;roomVideo.muted=true;roomVideo.playsInline=true;}
 const stream=studioCamera.video.srcObject;
 if(roomVideo.srcObject!==stream)roomVideo.srcObject=stream;
 applyMirror();mountRoom();$('camera-backdrop').setAttribute('aria-pressed','true');
 studioCamera.inputs().then(list=>{roomPart('room-switch').hidden=list.length<2;});
}
studioCamera.events.addEventListener('change',syncRoom);
$('camera-backdrop').onclick=async()=>{
 if(studioCamera.has('room')){studioCamera.release('room');stopRoom();return;}
 const button=$('camera-backdrop');button.disabled=true;
 try{
  await studioCamera.use('room');syncRoom();
 }catch(e){stopRoom();if(e.name!=='AbortError')$('mode-caption').textContent=e.name==='NotAllowedError'?'Camera permission was declined. Allow the camera for this page to place the model in your room.':'Camera unavailable. You can still rotate and explore in Immerse.';}
 finally{button.disabled=false;}
};
roomPart('room-mirror').onclick=()=>studioCamera.flip();
roomPart('room-stop').onclick=()=>{studioCamera.stopAll();$('camera-backdrop').focus({preventScroll:true});};
roomPart('room-switch').onclick=async()=>{
 try{await studioCamera.switchDevice();}catch{$('mode-caption').textContent='That camera could not start.';}
};
// Capture: room frame, fade, model canvas and visible labels in one PNG, saved only to this device.
roomPart('room-capture').onclick=()=>{
 const host=roomHost(),model=host?.querySelector('canvas');if(!roomVideo||!model)return;
 const r=host.getBoundingClientRect(),s=Math.min(2,devicePixelRatio||1),out=document.createElement('canvas');
 out.width=Math.round(r.width*s);out.height=Math.round(r.height*s);const x=out.getContext('2d');
 const vw=roomVideo.videoWidth,vh=roomVideo.videoHeight;
 // The hand camera image is the backdrop only while it fills the bench; the studio hand layout
 // shows it as a small thumbnail instead, so the room frame is drawn then.
 const handImage=main.querySelector('.lab-surface > .hand-camera-image:not([hidden])');
 const handFrame=handImage&&handImage.getBoundingClientRect().width>=r.width/2?handImage:null;
 if(handFrame){
  const frame=handFrame.getBoundingClientRect();
  x.save();x.translate((frame.left-r.left)*s,(frame.top-r.top)*s);
  if(studioCamera.mirrored){x.translate(frame.width*s,0);x.scale(-1,1);}
  x.drawImage(handFrame,0,0,frame.width*s,frame.height*s);x.restore();
 }else if(vw&&vh){const k=Math.max(out.width/vw,out.height/vh),w=vw*k,h=vh*k;x.save();if(studioCamera.mirrored){x.translate(out.width,0);x.scale(-1,1);}x.drawImage(roomVideo,(out.width-w)/2,(out.height-h)/2,w,h);x.restore();}
 const scrim=getComputedStyle(roomScrim);x.globalAlpha=Number(scrim.opacity)||0;x.fillStyle=scrim.backgroundColor;x.fillRect(0,0,out.width,out.height);x.globalAlpha=1;
 const m=model.getBoundingClientRect(),tray=main.dataset.mode==='builder'?null:$('tray')?.getBoundingClientRect();x.save();if(tray?.width){x.beginPath();x.rect(0,0,out.width,out.height);x.rect((tray.left-r.left)*s,(tray.top-r.top)*s,tray.width*s,tray.height*s);x.clip('evenodd');}x.drawImage(model,(m.left-r.left)*s,(m.top-r.top)*s,m.width*s,m.height*s);x.restore();
 x.font=`600 ${12*s}px system-ui,sans-serif`;x.textAlign='center';x.textBaseline='middle';
 for(const el of host.querySelectorAll('#labels>*,#builder-labels>*')){
  const b=el.getBoundingClientRect(),t=el.textContent.trim(),cs=getComputedStyle(el);
  if(!t||!b.width||cs.visibility==='hidden'||cs.display==='none'||Number(cs.opacity)===0)continue;
  const cx=(b.left+b.width/2-r.left)*s,cy=(b.top+b.height/2-r.top)*s,w=x.measureText(t).width+10*s,h=18*s;
  x.fillStyle='#ffffffd9';x.beginPath();x.roundRect(cx-w/2,cy-h/2,w,h,h/2);x.fill();x.fillStyle='#183740';x.fillText(t,cx,cy);
 }
 try{const a=document.createElement('a');a.href=out.toDataURL('image/png');a.download='molecule-in-my-room.png';a.click();$('mode-caption').textContent='Picture saved to this device. It includes your camera image.';}
 catch{$('mode-caption').textContent='The picture could not be saved.';}
};
installHandBuilding(main,studioCamera,icon,async(symbols,isCurrent,chemistry)=>{
 // The table belongs to the advanced bench. A delayed selection must never
 // switch labs or place atoms after the learner has left that bench.
 if(main.dataset.mode!=='builder'||!isCurrent())return;
 const revision=modeRevision;
 const leaveIonic=main.dataset.chemistry==='ionic' && chemistry==='molecular';
 const bench=await builder;
 if(revision!==modeRevision||!isCurrent()||main.dataset.mode!=='builder')return;
 if(!bench)throw Error('The molecule builder could not open. Reload B06 to try again.');
 const ionic=chemistry==='ionic';
 return bench.placeTableAtoms(symbols,{ionic,free:!ionic && leaveIonic});
});
const ionicHash=bench=>bench==='transfer'?'#transfer':bench==='ionic'?'#ionic':'#builder';
async function mode(name,targetBench=null){
 const revision=++modeRevision;
 const isBuilder=name==='builder';
 header.querySelector('.back-link').href='../../../index.html';
 guided.hidden=name!=='guided';guided.inert=name!=='guided';
 advanced.hidden=!isBuilder;advanced.inert=!isBuilder;main.dataset.mode=name;
 reactionLab.setActive(name==='reaction');
 if(name==='reaction'){stopRoom();main.classList.remove('immersive');$('immersive').setAttribute('aria-pressed','false');}
 mountRoom();
 for(const id of ['guided','builder','reaction']){$('tab-'+id).setAttribute('aria-selected',String(id===name));$('tab-'+id).tabIndex=id===name?0:-1;}
 $('mode-caption').textContent='';
 if(isBuilder&&!builder){builder=import('./builder.js').then(m=>m.startBuilder()).catch(e=>{$('builder-loading').textContent='The molecular viewer could not open. Reload to try again.';console.error(e);});}
 document.dispatchEvent(new Event('b06-mode'));
 const hash=name==='reaction'?'#reaction':isBuilder?ionicHash(targetBench||$('bench-select').value):'';
 history.replaceState(null,'',location.pathname+location.search+hash);
 if(targetBench){
  const bench=await builder;
  if(bench && revision===modeRevision && main.dataset.mode==='builder' && location.hash===hash && $('bench-select').value!==targetBench){
   $('bench-select').value=targetBench;
   $('bench-select').dispatchEvent(new Event('change',{bubbles:true}));
  }
 }
}
$('bench-select').addEventListener('change',event=>{
 // An ionic selection in the camera interface starts with neutral atoms.
 // Opening a saved fixed-charge inventory retains the model recorded in the file.
 const select=event.currentTarget;
 if(select.value==='ionic' && main.classList.contains('hands-on') && !event.detail?.fromFile)select.value='transfer';
 if(main.dataset.mode==='builder'){
  const hash=ionicHash(select.value);
  history.replaceState(null,'',location.pathname+location.search+hash);
 }
});
$('tab-guided').onclick=()=>mode('guided');$('tab-builder').onclick=()=>mode('builder');$('tab-reaction').onclick=()=>mode('reaction');
// Bound to the tab strip itself: the lab shell moves the strip into its top bar.
tabs.querySelector('.mode-switch').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const names=['guided','builder','reaction'],current=names.indexOf(main.dataset.mode||'guided');const name=e.key==='Home'?names[0]:e.key==='End'?names[2]:names[(current+(e.key==='ArrowLeft'?2:1))%3];$('tab-'+name).focus();mode(name);});
$('immersive').onclick=()=>{const on=main.classList.toggle('immersive');$('immersive').setAttribute('aria-pressed',String(on));document.dispatchEvent(new Event('b06-mode'));};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await main.requestFullscreen();}catch{$('mode-caption').textContent='Full screen is unavailable. Immerse expands the scene within this window.';}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&main.classList.contains('immersive')){$('immersive').click();}});
syncChoices();
function openLinkedBench(){
 const bench=location.hash==='#transfer'?'transfer':location.hash==='#ionic'?'ionic':null;
 mode(location.hash==='#reaction'?'reaction':bench || location.hash==='#builder'?'builder':'guided',bench);
}
window.addEventListener('hashchange',openLinkedBench);
if(['#builder','#ionic','#transfer','#reaction'].includes(location.hash))openLinkedBench();

