import {beginCarry,carryPosition} from './tool-carry.js';
import {PIPETTES,pipetteIds,isPipette,pipetteLevel} from './pipettes.js';
import {instrumentDisplay,STOCK_CONCENTRATION} from './model.js';
import {BenchFinish,drawFrontDisplay,drawTransmissionDisplay} from './bench-finish.js';
/* Classroom and rendering helpers adapted from the supplied ELISA scene.
   All spectrophotometry apparatus meshes are evaluated exports from Blender. */
import {fitCamera} from './camera-fit.js';
import {CUVETTE} from '../assets/cuvette-dimensions.js';
const {G,M,V}=globalThis.E3D;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const LABELS={tube_dilution:'10 mL dilution cylinder',stockBottle:'Blue #1 stock',waterBottle:'Distilled water',unknownBottle:'Unknown drink',tube_10_0:'Standard · 10 / 0',tube_8_2:'Standard · 8 / 2',tube_6_4:'Standard · 6 / 4',tube_4_6:'Standard · 4 / 6',tube_2_8:'Standard · 2 / 8',tube_0_10:'Water blank · 0 / 10',cuvette:'Optical cuvette',spec20:'Spectrophotometer',wasteBeaker:'Liquid waste',pipette:'10 mL pipette',notebook:'Lab notebook'};
const TUBE_IDS=['tube_10_0','tube_8_2','tube_6_4','tube_4_6','tube_2_8','tube_0_10'];
export class LabScene{
 constructor(renderer){this.r=renderer;this.appearance=new BenchFinish(this);this.objects={};this.targets={};this.liquids={};this.labels=[];this.home={};this.homeYaw={};this.equipmentBounds={};this.rackSlots=Object.fromEntries(TUBE_IDS.map((id,i)=>[id,i]));this.animation=null;this.labelsVisible=true;this.buildRoom();}
 mat(color,opts={}){return this.r.material(color,opts)}
 box(w,h,d,m,p=[0,0,0],parent,rad){return this.r.mesh(G.bevelBox(w,h,d,rad),m,parent).set(...p)}
 cyl(rad,h,m,p=[0,0,0],parent,top=rad){return this.r.mesh(G.cylinder(rad,h,64,top),m,parent).set(...p)}
 canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
 decal(w,h,c,p,parent,opts={},surface=G.plane(w,h)){const n=this.r.mesh(surface,this.mat('#ffffff',{map:this.r.texture(c),opacity:.999,rough:.8,pattern:6,...opts}),parent||this.r.root).set(...p);n.canvas=c;n.noShadow=true;n.decal=true;return n}
 text(str,w,h,p,parent,opts={},surface){const c=this.canvas(512,Math.max(96,Math.round(512*h/w)));const n=this.decal(w,h,c,p,parent,opts,surface);n.options=opts;this.retext(n,str);return n}
 retext(n,str){if(n.text===str)return;n.text=str;const c=n.canvas,ctx=c.getContext('2d'),o=n.options||{};ctx.clearRect(0,0,c.width,c.height);if(o.bg){ctx.fillStyle=o.bg;ctx.fillRect(0,0,c.width,c.height)}ctx.fillStyle=o.ink||'#263f39';ctx.textAlign='center';ctx.textBaseline='middle';const lines=str.split('\n');let sz=Math.min(c.height/(lines.length*1.3),c.width/(Math.max(...lines.map(s=>s.length),1)*.57));ctx.font=`600 ${sz}px "Segoe UI",Arial,sans-serif`;const widest=Math.max(...lines.map(s=>ctx.measureText(s).width),1);if(widest>c.width*.92){sz*=c.width*.92/widest;ctx.font=`600 ${sz}px "Segoe UI",Arial,sans-serif`}lines.forEach((s,i)=>ctx.fillText(s,c.width/2,c.height*(i+.5)/lines.length));this.r.texture(c,n.mat.map)}
 flat(str,w,h,p,parent,opts={}){const n=this.text(str,w,h,p,parent,opts);n.rot[0]=-Math.PI/2;return n}
 buildRoom(){
  const resin=this.appearance.surface('Worktop',this.mat('#5c6462',{rough:.69,pattern:1}));
  const edge=this.appearance.surface('Bench edge',this.mat('#303634',{rough:.48,pattern:10}));
  const cabinet=this.appearance.surface('Cabinet doors',this.mat('#85918b',{rough:.49,pattern:10}));
  const steel=this.mat('#b3b9b4',{rough:.27,metal:.86});
  this.box(15,.20,10,resin,[0,-.103,0],undefined,.065);
  this.box(14.96,.045,9.96,edge,[0,-.210,0],undefined,.018);
  this.box(14.48,2.90,9.44,this.mat('#39423e',{rough:.64}),[0,-1.69,0]);
  for(const side of [-1,1]){
    for(let i=0;i<8;i++){
      const x=(i-3.5)*1.797;
      this.box(1.769,2.61,.065,cabinet,[x,-1.555,side*4.737],undefined,.016);
      this.box(.41,.042,.07,steel,[x,-.57,side*4.854],undefined,.012);
      for(const dx of [-.166,.166])this.box(.038,.044,.105,steel,[x+dx,-.57,side*4.803]);
    }
  }
 }
 async loadApparatus(selectGroups=null,includeMesh=null){
  const read=async path=>{
    const response=await fetch(new URL('../assets/'+path,import.meta.url));
    if(!response.ok)throw new Error('The apparatus could not be loaded. Open the studio from its local server.');
    return response;
  };
  const [data,buffer]=await Promise.all([read('equipment.json').then(r=>r.json()),read('equipment.bin').then(r=>r.arrayBuffer()),this.r.loadRoom()]);
  this.assetMeta=data.meta;
  this.bulbMeshes=Object.fromEntries(pipetteIds.map(id=>[id,[]]));
  this.pipetteGlass={};
  const groups={...data.groups};
  const enamel={'Front enclosure':'#dddcd0','Teal front fascia':'#234148','Sample chamber lid':'#344849','Rack base':'#a57852','Rack base inset':'#4a382a'};
  for(const id of pipetteIds.slice(1)){groups[id]=data.groups.pipette;groups[PIPETTES[id].stand]=data.groups.pipetteStand;}
  const selected=selectGroups?selectGroups(groups):groups;
  for(const [name,spec] of Object.entries(selected)){
   const group=this.r.group(),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
   for(const mesh of spec.meshes){
    if(includeMesh&&!includeMesh(name,mesh.name))continue;
    const {color,...properties}=mesh.material;
    const bulb=isPipette(name)&&mesh.name.startsWith('Bulb ');
    const vertices=new Float32Array(buffer,mesh.offset,mesh.vertexCount*8);
    const indices=new Uint32Array(buffer,mesh.offset+vertices.byteLength,mesh.indexCount);
    if(mesh.name==='Rack base')Object.assign(properties,{rough:.38,pattern:8});
    else if(bulb||mesh.name==='Front enclosure')Object.assign(properties,{rough:bulb?.58:.35,pattern:10});
    else if(mesh.name.startsWith('Full frosted side'))Object.assign(properties,{rough:.74,pattern:3});
    const material=this.mat(bulb?PIPETTES[name].color:(enamel[mesh.name]||color),properties);
    const node=name==='instrument'&&mesh.name==='Dial index'
      ?this.appearance.instrumentPrint(vertices,indices,material,group)
      :this.r.mesh(vertices,material,group,indices);
    this.appearance.surface(mesh.name,node.mat);
    // Keep the grip above the last graduation so the entire measuring bore is visible.
    if(bulb)node.pos[1]=.125;
    else if(isPipette(name)&&/sleeve|grasp band/i.test(mesh.name)){
      node.scale[1]=.43;
      node.pos[1]=1.46-1.13*node.scale[1];
    }
    if(isPipette(name)&&node.mat.glass){
      node.pipetteId=name;
      if(mesh.name==='Graduated pipette glass'){
        node.mat.glass=2;
        this.pipetteGlass[name]=node.mat;
      }
    }
    if(bulb)this.bulbMeshes[name].push(node);
    // The trailing power cord is outside the working enclosure.
    if(mesh.name==='Cord jacket and light seal')continue;
    for(let i=0;i<vertices.length;i+=8){
     for(let k=0;k<3;k++){const value=vertices[i+k]*node.scale[k]+node.pos[k];min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value);}
    }
   }
   this.objects[name]=group; this.equipmentBounds[name]={min,max};
  }
 }
 async load(){
  await this.loadApparatus();
  this.buildDilutionCylinder();
  // Front is +Z. Park tall tools behind the gaps between reagent bottles.
  const placements={
    waterPipette:[-5.85,.25,-1.22], pipette:[-4.56,.25,-1.22], unknownPipette:[-3.27,.25,-1.22],
    waterBottle:[-5.18,.02,.76], stockBottle:[-3.91,.02,.76], unknownBottle:[-2.66,.02,.76],
    rack:[-.46,.02,1.62], tube_dilution:[1.72,.02,1.78],
    instrument:[3.84,.02,-.66], cuvette:[3.40,CUVETTE.homeY,2.00], wasteBeaker:[5.53,.02,1.65],
    tissueBox:[1.27,.02,-1.50], clipboard:[-.61,.02,-1.38]
  };
  for(const[name,pos]of Object.entries(placements)){if(!this.objects[name])throw Error(`Missing Blender group: ${name}`);this.objects[name].set(...pos);this.home[name]=[...pos]}
  const stockStrength=STOCK_CONCENTRATION+' µM';
  for(const [id,title,detail,stripe,role,description] of [
    ['waterBottle','Distilled water','Blank & rinse','#34766e','WATER','Distilled water'],
    ['stockBottle','Blue #1',stockStrength+' stock','#34648c','STOCK','Blue #1 · '+stockStrength],
    ['unknownBottle','Unknown drink','Original sample','#906b39','UNKNOWN','Original drink']
  ]){
    const label=this.canvas(512,288),ctx=label.getContext('2d');
    ctx.fillStyle='#f2efe4';ctx.fillRect(0,0,512,288);
    ctx.fillStyle=stripe;ctx.fillRect(0,0,512,28);
    ctx.fillStyle='#273a39';ctx.textAlign='center';ctx.font='600 50px Segoe UI';ctx.fillText(title,256,128,395);
    ctx.fillStyle='#475852';ctx.font='39px Segoe UI';ctx.fillText(detail,256,191,385);
    ctx.fillStyle='#c6cabe';ctx.fillRect(54,222,404,2);
    const wrapped=this.wrapLabel(this.objects[id],label,.81,.447,.370,id==='unknownBottle'?.63:.72);
    this.appearance.reagent(wrapped,role,description,stripe);
  }
  for(const [i,id] of TUBE_IDS.entries()){
    const label=this.canvas(256,144),ctx=label.getContext('2d');
    ctx.fillStyle='#f1eee1';ctx.fillRect(0,0,256,144);
    ctx.fillStyle=i===5?'#34766e':'#34648c';ctx.fillRect(0,0,256,13);
    ctx.fillStyle='#293d3d';ctx.textAlign='center';ctx.font='600 63px Segoe UI';
    ctx.fillText((10-2*i)+'/'+(2*i),128,99);
    this.wrapLabel(this.objects[id],label,.272,.162,.1575,1.079);
  }
  const wastePaper=this.canvas(512,204),ink=wastePaper.getContext('2d');
  ink.fillStyle='#ede9dc';ink.fillRect(0,0,512,204);
  ink.fillStyle='#a87940';ink.fillRect(0,0,512,17);
  ink.fillStyle='#273338';ink.textAlign='center';ink.font='700 68px "Segoe UI",sans-serif';
  ink.fillText('WASTE',256,104);ink.font='500 41px "Segoe UI",sans-serif';ink.fillText('250 mL',256,165);
  const wasteLabel=this.wrapLabel(this.objects.wasteBeaker,wastePaper,.85,.34,.506,.485);
  wasteLabel.visible=false;this.appearance.cinematicDetails.push(wasteLabel);
  this.text('CALIBRATION STANDARDS',2.25,.233,[0,.328,.511],this.objects.rack,{bg:'#eeebe0',ink:'#263b3c'});
  this.objects.clipboard.rot[1]=-.08;
  TUBE_IDS.forEach((id,i)=>{const node=this.objects[id];if(!node)throw Error(`Missing sample tube: ${id}`);node.set(placements.rack[0]+(i-2.5)*.5,placements.rack[1]+.163,placements.rack[2]);this.home[id]=[...node.pos];this.targets[id]={id,group:node,offset:[0,.72,0],radius:.2};this.addLiquid(id,.134,.82,node,.08);});
  for(const id of ['stockBottle','waterBottle','unknownBottle']){this.targets[id]={id,group:this.objects[id],offset:[0,.85,0],radius:.4};this.addLiquid(id,.331,id==='unknownBottle'?.78:.99,this.objects[id],.06)}
  this.cuvetteDock=this.objects.cuvetteDock.set(placements.cuvette[0],0,placements.cuvette[2]);
  this.addLiquid('cuvette',CUVETTE.liquidHalfWidth,CUVETTE.liquidHeight,this.objects.cuvette,CUVETTE.base,true);this.addLiquid('wasteBeaker',.44,.88,this.objects.wasteBeaker,.07);
  this.targets.cuvette={id:'cuvette',group:this.objects.cuvette,offset:[0,CUVETTE.height*.52,0],radius:CUVETTE.width*.65};this.targets.spec20={id:'spec20',group:this.objects.instrument,offset:[0,.75,.6],radius:1.05};this.targets.wasteBeaker={id:'wasteBeaker',group:this.objects.wasteBeaker,offset:[0,.6,0],radius:.5};this.targets.pipette={id:'pipette',group:this.objects.pipette,offset:[0,1,0],radius:.3};
  this.buildInstrument();
  this.pipetteStand=this.objects.pipetteStand;
  for(const id of pipetteIds){
   const cfg=PIPETTES[id],h=this.home[id],stand=this.objects[cfg.stand];stand.set(h[0],0,h[2]);
   this.flat(cfg.mark,.76,.19,[0,.095,.19],stand,{bg:'#f5f2e9',ink:'#253334'});
  }
  const shadows={instrument:[4.20,3.04],rack:[3.98,1.40],wasteBeaker:[1.19,1.19],cuvetteDock:[.62,.60],
    waterBottle:[.98,.98],stockBottle:[.98,.98],unknownBottle:[.98,.98],tube_dilution:[.88,.84],tissueBox:[1.23,.84]};
  for(const id of pipetteIds)shadows[PIPETTES[id].stand]=[1.10,.84];
  const shadowMat=this.mat('#151b1a',{pattern:4,opacity:.50});
  for(const [id,[w,d]] of Object.entries(shadows)){
    const host=this.objects[id],shade=this.r.mesh(G.plane(w,d),shadowMat,host);
    shade.set(0,.003-host.pos[1],0);shade.rot[0]=-Math.PI/2;shade.noShadow=true;
  }
  const ring=this.r.mesh(G.torus(.34,.018,40),this.mat('#e7b76c',{emission:.15,rough:.5}));ring.noShadow=true;this.marker=ring;
  this.layoutItems=Object.keys(this.home).map(id=>({id,label:PIPETTES[id]?.name||({instrument:'Spectrophotometer',rack:'Rack & its tubes',pipette:'Pipette & stand',tissueBox:'Tissue box',clipboard:'Protocol clipboard'})[id]||LABELS[id]||id}));
  for(const {id} of this.layoutItems)this.homeYaw[id]=this.objects[id].rot[1];this.defaultLayout=this.layoutData();this.setView('overview');this.r.root.update();
 }
 buildInstrument(){
  this.buildTransmissionDisplay();
  this.flat('LIGHT PATH  ↕',.85,.13,[.85,1.304,.55],this.objects.instrument,{ink:'#23484e'});
  this.screen=this.decal(1.19,.33,this.canvas(660,184),[-.65,.84,1.222],this.objects.instrument,{rough:.27,emission:.11});
  this.appearance.surface('Instrument display',this.screen.mat);
  this.lid=this.objects.instrument_lid;if(this.lid){this.r.root.children=this.r.root.children.filter(n=>n!==this.lid);this.objects.instrument.add(this.lid);this.lid.set(.85,1.25,-.38)}
 }
 wrapLabel(group,canvas,width,height,radius,y){
  const paper=[],segments=24;
  for(let i=0;i<segments;i++){
    const strip=G.plane(width/segments,height);
    for(let j=0;j<strip.length;j+=8){
      const u=(i+strip[j+6])/segments,angle=(u-.5)*width/radius;
      paper.push(radius*Math.sin(angle),strip[j+1],radius*Math.cos(angle),Math.sin(angle),0,Math.cos(angle),u,strip[j+7]);
    }
  }
  return this.decal(width,height,canvas,[0,y,0],group,{rough:.78},paper);
 }
 buildTransmissionDisplay(){
  const sheet=this.canvas(640,340), instrument=this.objects.instrument;
  const z=-.047;
  this.opticsPlate=this.decal(1.64,1.015,sheet,[-.585,1.423-.15*z,z],instrument,{rough:.29});
  this.appearance.surface('Instrument display',this.opticsPlate.mat);
  this.opticsPlate.rot[0]=-Math.PI/2+Math.atan(.15);
 }
 updateTransmission(reading){
  const signal=reading?.percentT??null;
  if(this.displayedTransmission===signal)return;
  this.displayedTransmission=signal;
  const plate=this.opticsPlate,c=plate.canvas,ctx=c.getContext('2d');
  if(this.appearance.active!=='original'){
    drawTransmissionDisplay(c,reading);this.r.texture(c,plate.mat.map);return;
  }
  const surface=ctx.createLinearGradient(0,0,0,c.height);
  surface.addColorStop(0,'#263533');surface.addColorStop(1,'#152421');
  ctx.fillStyle=surface;ctx.fillRect(0,0,c.width,c.height);
  ctx.textAlign='left';ctx.fillStyle='#d0ded5';ctx.font='600 35px Segoe UI';ctx.fillText('TRANSMITTANCE',34,65);
  ctx.fillStyle='#a2bab0';ctx.font='23px Segoe UI';ctx.fillText('Optical signal relative to blank',34,103);
  ctx.fillRect(34,124,572,1);
  for(const [i,label,fraction] of [[0,'BLANK',signal===null?null:1],[1,'SAMPLE',signal===null?null:signal/100]]){
    const y=157+i*76;
    ctx.fillStyle='#e0e6df';ctx.font='600 27px Segoe UI';ctx.fillText(label,34,y+24);
    for(let k=0;k<18;k++){
      ctx.fillStyle=fraction!==null&&(k+.5)/18<=fraction?(i?'#e9b577':'#afd7bb'):'#40534e';
      ctx.fillRect(167+k*16,y+3,12,22);
    }
    ctx.fillStyle='#dfe7dd';ctx.font='26px Consolas,monospace';
    ctx.fillText(fraction===null?'—':(fraction*100).toFixed(1)+'%',476,y+25);
  }
  this.r.texture(c,plate.mat.map);
 }
 updateInstrument(state){
  const {reading:measured,caption}=instrumentDisplay(state);
  this.updateTransmission(measured);
  const key=[measured?.absorbance,measured?.percentT,state.wavelength,caption].join('|');
  if(this.lcdValue===key)return;this.lcdValue=key;
  const c=this.screen.canvas,ctx=c.getContext('2d');
  if(this.appearance.dial) this.appearance.dial.rot[2]=(550-state.wavelength)*Math.PI/200;
  if(this.appearance.active!=='original'){
    drawFrontDisplay(c,state.wavelength,caption,measured);this.r.texture(c,this.screen.mat.map);return;
  }
  const wash=ctx.createLinearGradient(0,0,0,c.height);
  wash.addColorStop(0,'#a3b3a4');wash.addColorStop(.23,'#c2cfbf');wash.addColorStop(1,'#b1bfae');
  ctx.fillStyle=wash;ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle='#44594e';ctx.font='600 31px Consolas,monospace';ctx.fillText('λ  '+state.wavelength+' nm',25,46);
  ctx.textAlign='right';ctx.font='27px Consolas,monospace';
  ctx.fillText(measured?measured.percentT.toFixed(1)+' %T':'%T / ABS',634,46);
  ctx.textAlign='left';ctx.fillStyle='#829687';ctx.fillRect(25,60,609,2);
  ctx.fillStyle='#223a30';ctx.font=(measured?'65px':'53px')+' Consolas,monospace';
  ctx.fillText(measured?measured.absorbance.toFixed(4)+' A':caption,25,139,610);
  this.r.texture(c,this.screen.mat.map);
 }
 buildDilutionCylinder(){
  const group=this.r.group(), id='tube_dilution';
  const glass=this.mat('#c6e3e4',{glass:1,rough:.12,opacity:.2,thickness:.035});
  const glaze=this.mat('#345b63',{rough:.44}), brass=this.mat('#c39053',{rough:.38,metal:.45});
  this.box(.66,.065,.64,glaze,[0,.034,0],group,.025);
  this.cyl(.21,.035,brass,[0,.065,0],group);
  // A closed floor and a rolled, open lip surround the independently rendered liquid.
  const profile=[[.001,.083],[.145,.083],[.159,.11],[.159,1.204],[.172,1.218],[.17,1.232],[.144,1.232],[.136,1.211],[.136,.125],[.001,.118]];
  this.r.mesh(G.lathe(profile,48),glass,group);
  const rolledRim=this.r.mesh(G.torus(.154,.009,48),this.mat('#9cbbb9',{rough:.22,metal:.28}),group);
  rolledRim.set(0,1.224,0);
  // The white enamel backing belongs to the stand, keeping the scale readable against the bench.
  this.box(.27,1.06,.032,this.mat('#e5e7da',{rough:.57}),[0,.60,-.192],group);
  const ink=this.mat('#324f5b',{rough:.8});
  for(let ml=1;ml<=10;ml++){
    const level=.12+.096*ml;
    this.box(ml%2?.052:.092,.009,.006,ink,[-.046,level,.148],group);
    if(ml%2===0)this.text(String(ml),.081,.047,[.054,level,.151],group,{ink:'#223c47'});
  }
  this.flat('DILUTION',.52,.1,[0,.069,.245],group,{bg:'#eee6d3',ink:'#294950'});
  this.objects[id]=group;
  this.equipmentBounds[id]={min:[-.33,0,-.32],max:[.33,1.232,.32]};
  this.targets[id]={id,group,offset:[0,.72,0],radius:.22};
  this.addLiquid(id,.132,.96,group,.12);
 }
 setBulbPressed(pressed,tool){
  const held=pressed&&isPipette(tool)?tool:null;
  if(this.pressedPipette===held)return;
  this.pressedPipette=held;
  for(const id of pipetteIds)for(const mesh of this.bulbMeshes[id])mesh.scale[0]=mesh.scale[2]=id===held?.78:1;
  this.r.dirtyShadow=true;
 }
 get chamber(){this.r.root.update();return M.point(this.objects.instrument.world,CUVETTE.seat)}
 layoutData(){return {version:1,items:Object.fromEntries(this.layoutItems.map(({id})=>[id,{x:this.home[id][0],z:this.home[id][2],yaw:this.homeYaw[id]||0}])),slots:{...this.rackSlots}}}
 equipmentPosition(id){return this.objects[id]?[...this.objects[id].pos]:null}
 beginEquipmentDrag(id){this.draggingEquipment=id;this.dragHeight=this.objects[id]?.pos[1]||.019}
 endEquipmentDrag(id,moved){this.draggingEquipment=null;if(moved&&TUBE_IDS.includes(id)){const p=this.home[id];this.moveEquipment(id,p[0],p[2]);}}
 placementBounds(id,yaw=this.homeYaw[id]||0){
  const b=this.equipmentBounds[id],rx=Math.max(Math.abs(b.min[0]),Math.abs(b.max[0]),isPipette(id)?.42:id==='cuvette'?CUVETTE.dockHalfSize:0),rz=Math.max(Math.abs(b.min[2]),Math.abs(b.max[2]),isPipette(id)?.36:id==='cuvette'?CUVETTE.dockHalfSize:0);
  const c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw)),hx=c*rx+s*rz,hz=s*rx+c*rz;
  return {min:[-7.25+hx,0,-4.25+hz],max:[7.25-hx,Infinity,4.7-hz]};
 }
 constrainPlacement(id,x,z,yaw){const b=this.placementBounds(id,yaw);return [clamp(x,b.min[0],b.max[0]),clamp(z,b.min[2],b.max[2])]}
 placeEquipment(id,deltaYaw=0){
  const n=this.objects[id],h=this.home[id];n.set(...h);n.rot=[0,this.homeYaw[id]||0,0];
  if(id==='rack'){this.r.root.update();for(const[tube,slot]of Object.entries(this.rackSlots)){this.home[tube]=M.point(n.world,[-1.25+slot*.5,.163,0]);this.homeYaw[tube]=(this.homeYaw[tube]||0)+deltaYaw;this.objects[tube].set(...this.home[tube]);this.objects[tube].rot=[0,this.homeYaw[tube],0]}}
  if(isPipette(id)){const stand=this.objects[PIPETTES[id].stand]||this.pipetteStand;stand.set(h[0],0,h[2]);stand.rot[1]=this.homeYaw[id]||0}
  if(id==='cuvette'){this.cuvetteDock.set(h[0],0,h[2]);this.cuvetteDock.rot[1]=this.homeYaw[id]||0}
  if(this.inserted&&(id==='instrument'||id==='cuvette')){this.objects.cuvette.set(...this.chamber);this.objects.cuvette.rot=[0,this.homeYaw.instrument||0,0]}
  this.r.root.update();this.r.dirtyShadow=true;if(this.marker)this.mark(this.expected);
 }
 moveEquipment(id,x,z){
  if(!this.home[id]||![x,z].every(Number.isFinite))return {ok:false,message:'Select an item on the bench.'};
  if(this.animation)return {ok:false,message:'Finish or stop the current handling before arranging.'};
  if(id==='cuvette'&&this.inserted)return {ok:false,message:'The cuvette is inside the instrument. Move the instrument with it, or withdraw it first.'};
  const p=this.constrainPlacement(id,x,z);this.home[id][0]=p[0];this.home[id][2]=p[1];
  if(TUBE_IDS.includes(id)){
   const priorSlot=this.rackSlots[id];delete this.rackSlots[id];this.home[id][1]=this.draggingEquipment===id?this.dragHeight:.019;this.r.root.update();
   if(this.draggingEquipment!==id)for(let slot=0;slot<6;slot++){if(slot===priorSlot||Object.values(this.rackSlots).includes(slot))continue;const hole=M.point(this.objects.rack.world,[-1.25+slot*.5,.163,0]);if(Math.hypot(p[0]-hole[0],p[1]-hole[2])<.19){this.rackSlots[id]=slot;this.home[id]=hole;this.homeYaw[id]=this.homeYaw.rack;break}}
  }
  this.placeEquipment(id);return {ok:true,message:'Position updated.'};
 }
 rotateEquipment(id,radians){
  if(!this.home[id]||!Number.isFinite(radians))return {ok:false,message:'Select an item to turn.'};
  if(this.animation)return {ok:false,message:'Finish or stop the current handling before arranging.'};
  if(id==='cuvette'&&this.inserted)return {ok:false,message:'Move the spectrophotometer while the cuvette is inside.'};
  this.homeYaw[id]=(this.homeYaw[id]||0)+radians;const p=this.constrainPlacement(id,this.home[id][0],this.home[id][2]);this.home[id][0]=p[0];this.home[id][2]=p[1];this.placeEquipment(id,radians);return {ok:true,message:'Orientation updated.'};
 }
 applyLayout(data){
  if(this.animation)return {ok:false,message:'Finish or stop the current handling before arranging.'};
  if(data?.version!==1||!data.items||!data.slots||typeof data.slots!=='object')return {ok:false,message:'This saved layout is unavailable.'};
  const positions={};for(const{id}of this.layoutItems){const p=data.items[id]??(isPipette(id)&&id!=='pipette'?this.defaultLayout?.items[id]:null);if(!p||![p.x,p.z,p.yaw].every(Number.isFinite)||Math.abs(p.yaw)>100000)return {ok:false,message:'This saved layout is incomplete.'};positions[id]={...p};}
  const slots={};for(const[id,slot]of Object.entries(data.slots)){if(!TUBE_IDS.includes(id)||!Number.isInteger(slot)||slot<0||slot>5||Object.values(slots).includes(slot))return {ok:false,message:'The saved tube arrangement is invalid.'};slots[id]=slot;}
  this.rackSlots=slots;
  for(const{id}of this.layoutItems){const p=positions[id];this.homeYaw[id]=p.yaw;const limited=this.constrainPlacement(id,p.x,p.z,p.yaw);this.home[id][0]=limited[0];this.home[id][2]=limited[1];if(TUBE_IDS.includes(id))this.home[id][1]=.019;}
  for(const{id}of this.layoutItems)if(id!=='rack')this.placeEquipment(id);this.placeEquipment('rack');return {ok:true,message:'Bench arrangement restored.'};
 }
 restoreLayout(){return this.applyLayout(structuredClone(this.defaultLayout))}
 pickEquipment(x,y){return this.equipmentHit(x,y)?.id||null}
 equipmentHit(x,y){
  this.r.root.update();const ray=this.r.ray(x,y);let best=null,nearest=Infinity;
  for(const{id}of this.layoutItems){if(id==='cuvette'&&this.inserted)continue;const n=this.objects[id],inv=M.inverse(n.world),origin=M.point(inv,ray.origin),far=M.point(inv,V.add(ray.origin,ray.dir)),dir=V.sub(far,origin),bounds=this.equipmentBounds[id];let low=0,high=Infinity;
   const min=[...bounds.min],max=[...bounds.max];if(isPipette(id)){min[0]=-.43;max[0]=.43;min[1]=-.25;min[2]=-.36;max[2]=.36}if(id==='cuvette'){const half=CUVETTE.dockHalfSize+.01;min[0]=-half;max[0]=half;min[2]=-half;max[2]=half}
   for(let k=0;k<3;k++){if(Math.abs(dir[k])<1e-9){if(origin[k]<min[k]||origin[k]>max[k]){high=-1;break}}else{const a=(min[k]-origin[k])/dir[k],b=(max[k]-origin[k])/dir[k];low=Math.max(low,Math.min(a,b));high=Math.min(high,Math.max(a,b))}}
   if(high>=low&&low<nearest){nearest=low;best=id}
  }return best?{id:best,world:V.add(ray.origin,V.mul(ray.dir,nearest))}:null;
 }
 layoutGrip(x,y){
  const hit=this.equipmentHit(x,y);if(!hit)return null;
  const node=this.objects[hit.id];
  return {id:hit.id,carry:beginCarry(this.r,node.pos,hit.world,x,y),angle:node.rot[1],height:node.pos[1]};
 }
 dragLayoutGrip(grip,x,y){
  const node=this.objects[grip.id],turn=node.rot[1]-grip.angle;
  const [dx,dy,dz]=grip.carry.gripOffset,c=Math.cos(turn),s=Math.sin(turn);
  const carry={...grip.carry,gripOffset:[c*dx+s*dz,dy,c*dz-s*dx]};
  const bounds=this.placementBounds(grip.id,node.rot[1]);bounds.min[1]=bounds.max[1]=grip.height;
  const p=carryPosition(this.r,carry,x,y,bounds);
  return this.moveEquipment(grip.id,p[0],p[2]);
 }
 cloneGroup(source){if(!source)return null;const g=this.r.group();for(const m of source.children)this.r.mesh(m.geo,m.mat,g);return g}
 addLiquid(id,radius,height,parent,base,square=false){
  const material=this.mat('#accdd5',{rough:.10,opacity:.72,pattern:11,thickness:radius*2/CUVETTE.width});
  const node=square?this.box(radius*2,1,radius*2,material,[0,base+.5,0],parent):this.cyl(radius,1,material,[0,base,0],parent);
  node.noShadow=true;
  let meniscus=null;
  if(!square){
    // A shallow concave annulus terminates at the inner vessel wall.
    const profile=[[radius*.82,0],[radius*.92,.001],[radius*.975,.004],[radius,.009]];
    meniscus=this.r.mesh(G.lathe(profile,64),material,parent);meniscus.noShadow=true;
  }
  let caustic=null;
  if(['stockBottle','waterBottle','unknownBottle','wasteBeaker'].includes(id)){
    const transmitted=this.mat('#ffffff',{pattern:14,thickness:radius,opacity:.42});
    caustic=this.r.mesh(G.plane(radius*7,radius*7),transmitted,parent);
    caustic.set(0,.004-parent.pos[1],0);caustic.rot[0]=-Math.PI/2;
    caustic.noShadow=true;caustic.visible=false;
    this.appearance.cinematicDetails.push(caustic);
  }
  this.liquids[id]={node,height,base,square,meniscus,caustic};
 }
 fill(id,fraction,concentration){
  const liquid=this.liquids[id];if(!liquid)return;
  const level=clamp(fraction,0,1),height=Math.max(.003,liquid.height*level);
  liquid.node.visible=level>.001;liquid.node.scale[1]=height;
  if(liquid.square)liquid.node.pos[1]=liquid.base+height*.5;
  liquid.node.mat.dye=clamp(concentration/2.31,0,1.5);
  if(liquid.caustic){
    liquid.caustic.mat.level=level;
    liquid.caustic.mat.dye=liquid.node.mat.dye;
  }
  if(liquid.meniscus){liquid.meniscus.visible=liquid.node.visible;liquid.meniscus.pos[1]=liquid.base+height}
 }
 syncLiquids(state){
  for(const id of TUBE_IDS){const tube=state.tubes[id];this.fill(id,tube?.volume/10||0,tube?.concentration||0)}
  for(const[id,c]of[['stockBottle',2.31],['waterBottle',0],['unknownBottle',2.31]]){const b=state.bottles?.[id];this.fill(id,b?b.volume/b.capacity:.8,c)}
  // Color is a qualitative cue based on actual proportions, including clear rinse water.
  const dye=liquid=>liquid.volume?(liquid.stockVolume*2.31+liquid.unknownVolume*3.1)/liquid.volume:0;
  const mixture=state.tubes.tube_dilution;
  this.fill('tube_dilution',mixture.volume/10,dye(mixture));
  this.fill('cuvette',state.cuvette.volume/3,dye(state.cuvette));
  for(const id of pipetteIds){
    const sample=state[id], glass=this.pipetteGlass[id];
    glass.level=pipetteLevel(sample.volume);
    glass.dye=clamp(dye(sample)/2.31,0,1);
  }
  this.fill('wasteBeaker',state.waste/250,dye(state.wasteContents));
 }
 sync(state,resetPose=true){
  this.syncLiquids(state);
  this.inserted=state.cuvette.inserted;this.targets.cuvette.offset=state.cuvette.inserted?[0,CUVETTE.height+.04,0]:[0,CUVETTE.height*.52,0];this.targets.cuvette.radius=state.cuvette.inserted?.30:CUVETTE.width*.65;
  if(resetPose){for(const id of pipetteIds){this.objects[id].set(...this.home[id]);this.objects[id].rot=[0,this.homeYaw[id]||0,0]}this.objects.cuvette.set(...(state.cuvette.inserted?this.chamber:this.home.cuvette));this.objects.cuvette.rot=[0,state.cuvette.inserted?(this.homeYaw.instrument||0):(this.homeYaw.cuvette||0),0];if(this.lid)this.lid.rot[0]=state.cuvette.inserted?0:-1.4}
  this.updateInstrument(state);this.r.dirtyShadow=true;this.r.root.update();
 }
 targetPosition(id){const t=this.targets[id];if(!t)return null;this.r.root.update();return M.point(t.group.world,t.offset)}
 mark(id){this.expected=id;let p=this.targetPosition(id);this.marker.visible=!!p;if(p){let y=.022;if(id==='spec20'||id==='cuvette'&&this.inserted){p=[this.chamber[0],1.29,this.chamber[2]];y=1.29}this.marker.set(p[0],y,p[2]);this.marker.scale=[1,1,1]}}
 setLabels(visible){this.labelsVisible=visible;for(const n of this.labels)n.visible=visible}
 equipmentPoints(ids,{includeStands=true}={}){
  this.r.root.update();const included=new Set(ids);
  if(included.has('instrument'))included.add('instrument_lid');
  if(included.has('rack'))for(const id of Object.keys(this.rackSlots))included.add(id);
  for(const id of pipetteIds)if(includeStands&&included.has(id))included.add(PIPETTES[id].stand);
  if(includeStands&&included.has('cuvette')&&!this.inserted)included.add('cuvetteDock');
  return [...included].flatMap(id=>{const bounds=this.equipmentBounds[id],node=this.objects[id];if(!bounds||!node)return [];return Array.from({length:8},(_,mask)=>M.point(node.world,[0,1,2].map(k=>mask&(1<<k)?bounds.max[k]:bounds.min[k])))});
 }
 fitEquipment(ids,{yaw=0,pitch=.70,inspection=false,working=false,focus=false,held=null,handReach=false}={}){
  const rect=this.r.canvas.getBoundingClientRect(),width=rect.width,height=rect.height;
  const points=this.equipmentPoints(ids,{includeStands:!focus});
  if(held&&!ids.includes(held))points.push(...this.equipmentPoints([held],{includeStands:false}));
  for(const id of pipetteIds){
    const stand=PIPETTES[id].stand;
    if(ids.includes(stand)){
      const base=this.objects[stand].pos;
      points.push([base[0],this.home[id][1]+this.equipmentBounds[id].max[1],base[2]]);
    }
  }
  if(working){
    // Include the bulb above the opening, as well as the liquid and receiving vessel.
    for(const id of ids){
      if(!this.liquids[id]&&!isPipette(id)&&id!=='rack')continue;
      const n=this.objects[id];
      points.push([n.pos[0],3.96,n.pos[2]]);
    }
  }
  const mobile=width<=760;
  const bottomOf=id=>document.getElementById(id)?.getBoundingClientRect().bottom??rect.top;
  const topOf=id=>document.getElementById(id)?.getBoundingClientRect().top??rect.bottom;
  const spatial=document.body.classList.contains('hand-console');
  const bottom=Math.min(height*(spatial ? .32 : .22),Math.max(16,rect.bottom-topOf('benchFooter')+12));
  // The overview puts the outermost pipettes directly beneath the panel wings.
  // Station close-ups use the middle of the screen and need more height for handling.
  const overview=spatial&&!working&&!inspection;
  const topLimit=overview?height-bottom-Math.min(140,height*.22):height*(spatial ? .44 : .23);
  const top=Math.min(topLimit,Math.max(12,bottomOf(spatial?'spatialHud':'stationBar')-rect.top+12));
  // A pipette carry needs room for the whole moving hand at both ends.
  // Keep its source, receiver and stand in the central camera workspace.
  const margin=handReach?width*.18:mobile?20:inspection?50:30;
  const vertical=handReach?height*.10:0;
  const insets={top:Math.max(top,vertical),bottom:Math.max(bottom,vertical),left:margin,right:margin};
  const settings={width,height,yaw,pitch,fov:42,minDistance:inspection||focus?1.2:3};
  let camera=fitCamera(points,{...settings,insets});
  if(spatial&&this.viewSelection?.view==='instrument'){
    // A wide display can show a larger instrument between the two panels.
    // On portrait tablets, the space beneath the panels usually fits it better.
    const left=document.getElementById('opticsWing').getBoundingClientRect();
    const right=document.getElementById('dataWing').getBoundingClientRect();
    const middle={top:Math.max(12,bottomOf('spatialGuide')-rect.top+12),bottom,
      left:Math.max(margin,left.right-rect.left+12),right:Math.max(margin,rect.right-right.left+12)};
    if(width-middle.left-middle.right>=width/3&&middle.top+middle.bottom<height){
      const between=fitCamera(points,{...settings,insets:middle});
      if(between.distance<camera.distance)camera=between;
    }
  }
  Object.assign(this.r.cam,camera);
  this.r.updateCamera();
 }
 setView(view){
  this.viewSelection={view};
  if(view==='prepare')this.fitEquipment(['stockBottle','waterBottle','unknownBottle','tube_dilution','rack','cuvette',...pipetteIds],{yaw:this.homeYaw.rack||0,pitch:.77,working:true});
  else if(view==='instrument')this.fitEquipment(['instrument','cuvette','wasteBeaker'],{yaw:(this.homeYaw.instrument||0)-.08,pitch:.48,working:true});
  else this.fitEquipment(Object.keys(this.home),{yaw:-.105,pitch:.34});
 }
 frameOperation(ids,handReach=false){
  this.viewSelection={ids,handReach};
  const instrument=ids.includes('instrument');
  this.fitEquipment(ids,{yaw:instrument?(this.homeYaw.instrument||0)-.04:0,pitch:instrument?.67:.75,working:true,focus:true,handReach});
 }
 focusTarget(main,held){
  this.viewSelection={main,held};
  this.fitEquipment([main],{yaw:this.homeYaw[main]||0,pitch:main==='instrument'?.68:.77,working:true,focus:true,held});
 }
 inspectEquipment(id){if(!this.home[id])return;this.viewSelection={id};this.fitEquipment([id],{yaw:(this.homeYaw[id]||0)+(id==='instrument'?-.14:.10),pitch:id==='clipboard'?.95:isPipette(id)?.38:.56,inspection:true})}
 refitView(){const selection=this.viewSelection;if(selection?.ids)this.frameOperation(selection.ids,selection.handReach);else if(selection?.main)this.focusTarget(selection.main,selection.held);else if(selection?.id)this.inspectEquipment(selection.id);else if(selection?.view)this.setView(selection.view)}
 locate(id){const p=this.targetPosition(id);if(p){Object.assign(this.r.cam,{at:[p[0],.55,p[2]],yaw:id==='spec20'||id==='cuvette'&&this.inserted?this.homeYaw.instrument||0:.03,pitch:.7,distance:7.5,fov:42});this.r.updateCamera()}this.mark(id)}
 hit(x,y){let best=null,score=Infinity;for(const t of Object.values(this.targets)){if(t.id==='pipette'||t.id==='cuvette'&&this.inserted&&this.expected!=='cuvette')continue;const p=this.targetPosition(t.id),a=this.r.project(p),b=this.r.project([p[0]+t.radius,p[1],p[2]]),rad=Math.max(20,Math.abs(a.x-b.x));const d=Math.hypot(x-a.x,y-a.y);if(a.z<1&&d<rad&&d/rad<score){best=t.id;score=d/rad}}return best}
 begin(step){const a=step.action;const moving=['aspirate','dispense'].includes(a)?'pipette':['insert','remove','empty'].includes(a)?'cuvette':null;const node=this.objects[moving];const start=node?[...node.pos]:null;let end=start;
  if(moving==='pipette'){const t=this.targets[step.target];const p=t.group.pos;const height=step.action==='dispense'?(step.target==='cuvette'?.72:1.16):(TUBE_IDS.includes(step.target)?.4:.7);end=[p[0],p[1]+height,p[2]]}
  if(a==='insert')end=[...this.chamber];if(a==='remove')end=[...this.home.cuvette];if(a==='empty'){const p=this.home.wasteBeaker;end=[p[0],p[1]+1.2,p[2]]}
  if(a==='empty'){const p=this.home.wasteBeaker;const theta=-Math.PI*.7;end=[p[0]+Math.sin(theta)*CUVETTE.height,p[1]+1.16-Math.cos(theta)*CUVETTE.height,p[2]]}
  this.animation={action:a,moving,node,start,end,rotation:node?[...node.rot]:[0,0,0],endRotation:[0,a==='insert'?this.homeYaw.instrument||0:a==='empty'?0:this.homeYaw[moving]||0,0],lidStart:this.lid?.rot[0]||0};
 }
 beginRecovery(moving){const node=this.objects[moving],reseat=moving==='cuvette'&&this.inserted;this.animation={action:'recover',moving,node,start:[...node.pos],end:[...(reseat?this.chamber:this.home[moving])],rotation:[...node.rot],endRotation:[0,this.homeYaw[reseat?'instrument':moving]||0,0],lidStart:this.lid?.rot[0]||0,reseat}}
 animate(progress){
  const a=this.animation;if(!a)return;const p=clamp(progress,0,1),ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
  // Lift clear, travel above the opening, then descend vertically. Liquids commit
  // only after this contact phase; no reagent is created by visual motion.
  if(a.node){
   const high=Math.max(2.35,a.start[1],a.end[1]+.5),raisedStart=[a.start[0],high,a.start[2]],raisedEnd=[a.end[0],high,a.end[2]];
   const mp=a.action==='remove'?clamp((p-.12)/.88,0,1):p;
   let pos;if(mp<.2)pos=V.lerp(a.start,raisedStart,ease(mp/.2));else if(mp<.43)pos=V.lerp(raisedStart,raisedEnd,ease((mp-.2)/.23));else pos=V.lerp(raisedEnd,a.end,ease((mp-.43)/.17));
   a.node.set(...pos);a.node.rot=V.lerp(a.rotation,a.endRotation,ease(p/.18));
   if(a.action==='empty')a.node.rot[2]=-Math.PI*.7*ease((p-.63)/.14);
   if(p>.84&&a.action!=='recover'&&(a.moving==='pipette'||a.action==='empty')){
    const q=(p-.84)/.16,home=this.home[a.moving],raisedHome=[home[0],high,home[2]];
    if(q<.3)pos=V.lerp(a.end,raisedEnd,ease(q/.3));else if(q<.7)pos=V.lerp(raisedEnd,raisedHome,ease((q-.3)/.4));else pos=V.lerp(raisedHome,home,ease((q-.7)/.3));
    a.node.set(...pos);a.node.rot=[0,this.homeYaw[a.moving]||0,0];
   }
  }
  if(this.lid&&['insert','remove'].includes(a.action)){this.lid.rot[0]=a.lidStart+(-1.5-a.lidStart)*ease(p/.12);if(a.action==='insert'&&p>.61)this.lid.rot[0]*=1-ease((p-.61)/.16)}
  if(this.lid&&a.reseat&&p>.61)this.lid.rot[0]=a.lidStart*(1-ease((p-.61)/.25));
  this.r.dirtyShadow=true;
 }
 cancel(){this.animation=null;this.r.dirtyShadow=true}
 finish(state){this.animation=null;this.sync(state,false)}
}
