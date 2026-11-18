import {FreeControls} from './free-controls.js';
import {syncChoices} from './choices.js';
import {THREE as T, GLTFLoader} from '../vendor/three-bundle.js';
import {LETTERS, isBond} from './chemistry.js';
import {ELEMENTS} from './molecule-model.js';
import {arrangeSiteTags, silhouette} from './labels.js';
import {studioRoom, lightRig, translucent} from './studio-look.js';
import {bondSpec,groupDirections,normalizedTorsion} from './vsepr-kit.js';

const UP = new T.Vector3(0,1,0);
const ZERO = new T.Vector3();
const GRIPS = {bond:1.9, other:1.9, pair:1.34};
const VIEWS = {Oblique:null, Front:[0,0,1], Back:[0,0,-1]};
const SNAP_PX = {mouse:25, pen:27, touch:32};
const label = id => document.getElementById(id);
const inRect = (x,y,r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

// Physical model-kit look (studio-look.js 'kit'): camera-relative softboxes and
// key, fill and rim lights; soft shadows on the main bench only.
function light(scene, environment, shadow=false) {
  return lightRig(scene,environment,'kit',{shadow,extent:3.8});
}
// Kit finishes from the Blender part library. Socket_cutout writes depth only,
// drawn after the bore and countersink and before the hub, so the hub never
// paints over its drilled holes. Translucent tubes and lobes get denser edges.
function kitFinish(root) {
  const seen=new Set();
  root.traverse(o=>{
    if(!o.isMesh)return;
    if(o.name==='Socket_cutout'){o.material.colorWrite=false;o.renderOrder=-1;o.userData.hole='cutout';}
    else if(o.parent?.name==='Socket_mount'){o.renderOrder=-2;o.userData.hole=o.name.startsWith('Socket_bright_lip')?'lip':'bore';}
    const m=o.material;
    if(!m.transparent||seen.has(m))return;
    seen.add(m);
    translucent(m,m.name.includes('lobe')?{edge:1.15,core:.92}:{edge:1.14,core:.86});
  });
}
function dipoleGlyph(color) {
  const arrow=new T.Group(), mat=new T.MeshPhysicalMaterial({color,roughness:.34,clearcoat:.7,clearcoatRoughness:.08});
  const stem=new T.Mesh(new T.CylinderGeometry(.030,.030,.52,24),mat);
  stem.position.y=.26;
  const tail=new T.Mesh(new T.BoxGeometry(.23,.054,.054),mat);
  const tip=new T.Mesh(new T.ConeGeometry(.094,.21,36),mat);
  tip.position.y=.58;
  arrow.add(stem,tail,tip);
  return arrow;
}

export async function createViewer(host, actions) {
  const gltf=await new GLTFLoader().loadAsync(new URL('studio-parts.glb',import.meta.url).href);
  kitFinish(gltf.scene);
  const source=name=>{
    const obj=gltf.scene.getObjectByName(name);
    if (!obj) throw new Error('Missing kit component '+name);
    return obj;
  };
  const clone=name=>{
    const obj=source(name).clone(true);
    obj.position.set(0,0,0);
    obj.traverse(child=>{if(child.isMesh) {child.castShadow=!child.userData.hole;child.receiveShadow=child.userData.hole!=='lip'&&child.userData.hole!=='cutout';}});
    return obj;
  };
  const view=label('viewport'), tray=label('tray'), layer=label('labels');
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
  renderer.setClearColor(0xeff2eb,0);renderer.autoClear=false;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  host.prepend(renderer.domElement);
  const scene=new T.Scene(), env=studioRoom(renderer,'kit');
  scene.background=null;
  const rig=light(scene,env,true);
  const camera=new T.OrthographicCamera(-3,3,3,-3,.1,50);
  const initial=new T.Vector3(4.2,2.5,7.8);camera.position.copy(initial);
  const overview=m=>m?.ligands.some(p=>p.group)?new T.Vector3(2,9,4):initial.clone();
  const controls=new FreeControls(camera,view);
  controls.rotateSpeed=.72;controls.target.set(0,0,0);controls.update();
  let preset='Oblique', settingPose=false;
  const dirs=LETTERS.map(()=>new T.Vector3());
  const aimRadius=GRIPS.bond;
  const ray=new T.Raycaster();
  const kitScenes=new Map();
  for (const kind of ['bond','other','pair']) {
    const cell=new T.Scene();
    cell.add(clone('Parts_well'));
    const cam=new T.OrthographicCamera(-1,1,1,-1,.1,20);
    cam.position.set(.22,3.5,3.45);cam.lookAt(0,.15,0);
    lightRig(cell,env,'kit',{level:.78}).align(cam); // Top-down tray view: a touch dimmer.
    kitScenes.set(kind,{scene:cell,camera:cam,well:label('well-'+kind),piece:null});
  }
  const overlay=new T.Scene();
  const ghostCam=new T.OrthographicCamera(-1,1,1,-1,.1,2400);
  ghostCam.position.z=1200;
  light(overlay,env).align(ghostCam);
  const clearGuide=new T.MeshBasicMaterial({color:0x66888a});
  const rimGeometry=new T.TorusGeometry(.129,.011,8,36);
  const guidesMaterial=new T.LineDashedMaterial({color:0x7d9995,dashSize:.05,gapSize:.055,transparent:true,opacity:.72});
  const focusRim=new T.Mesh(new T.TorusGeometry(.218,.022,10,44),new T.MeshBasicMaterial({color:0x07877b}));
  focusRim.visible=false;scene.add(focusRim);
  const arrow=dipoleGlyph(0x007079), sumArrow=dipoleGlyph(0xa15b0b);
  const gaugeMaterial=new T.LineBasicMaterial({color:0x006b70});
  const gaugeArc=new T.Line(new T.BufferGeometry(),gaugeMaterial);
  gaugeArc.visible=false;scene.add(gaugeArc);
  let visual=new T.Group(), state=null, center=null, slots=[], labels=[], occluders=[], solids=[], orthos=[];
  scene.add(visual);
  let lastWidth=0, lastHeight=0;
  let gaugePair=null, gesture=null, lastTargets=[], lastMessage='', raf=0, cameraDirty=false;
  let snapAnimation=null, lastCase=null;
  let frameRadius=2.29;
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const materials=new Map();
  function atomBall(element,radius){
    if(!materials.has(element)){
      const mat=source('Atom_sculpt').material.clone();
      mat.color.set(ELEMENTS[element].color);materials.set(element,mat);
    }
    const ball=clone('Atom_sculpt');
    ball.material=materials.get(element);
    ball.scale.setScalar(radius);
    return ball;
  }
  const electronMaterial=new T.MeshPhysicalMaterial({color:0x1c2427,roughness:.28,clearcoat:1,clearcoatRoughness:.05});
  const electronGeometry=new T.SphereGeometry(.039,24,16);
  // Identical atoms in the same model have identical radii, including both
  // carbons of ethane. The hub is no longer mistaken for several atoms.
  const terminalRadius=part=>part.element===state?.m.center ? .60 : ELEMENTS[part.element].r*.32+.19;
  const grip=kind=>kind==='pair'?GRIPS.pair:state?.m.pieces[kind]?bondSpec(state.m.center,state.m.pieces[kind]).length:aimRadius;
  // Reuse the Blender-authored resin, plugs, collars and translucent rails.
  // Only the rail span changes: socket fittings and spherical atoms retain
  // their proportions. Cached geometry never mutates the shared GLB assets.
  const pinTemplates=new Map();
  function pin(order,length,startRadius=.60,endRadius=.40){
    const key=[order,length,startRadius,endRadius].join(':');
    if(!pinTemplates.has(key)){
      const original=clone('Bond_pin_'+Math.min(order,2));original.updateMatrixWorld(true);
      const group=new T.Group(),rails=[];
      original.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),position=geometry.attributes.position;
        geometry.computeBoundingBox();const mid=(geometry.boundingBox.min.x+geometry.boundingBox.max.x)/2;
        const rail=mesh.name.startsWith('Link_rail');
        for(let i=0;i<position.count;i++){
          const y=position.getY(i),t=T.MathUtils.clamp((y-.735)/.8,0,1);
          position.setY(i,y+(startRadius-.60)*(1-t)+(length-endRadius-1.5)*t);
          if(order===3&&rail){position.setX(i,(position.getX(i)-mid)*.78+Math.sign(mid)*.10);position.setZ(i,position.getZ(i)*.78);}
        }
        geometry.computeVertexNormals();geometry.computeBoundingSphere();
        const part=new T.Mesh(geometry,mesh.material);part.castShadow=true;part.receiveShadow=true;group.add(part);
        if(rail)rails.push(part);
      });
      if(order===3){
        const geometry=rails[0].geometry.clone();geometry.computeBoundingBox();
        geometry.translate(-(geometry.boundingBox.min.x+geometry.boundingBox.max.x)/2,0,0);
        const third=new T.Mesh(geometry,rails[0].material);third.castShadow=third.receiveShadow=true;group.add(third);
      }
      pinTemplates.set(key,group);
    }
    return pinTemplates.get(key).clone(true);
  }
  const templates=new Map();
  function piece(kind,dir,index=null) {
    const key=state.m.formula+kind;
    if(!templates.has(key)){
      let item;
      if(kind==='pair')item=clone('Lone_pair_sculpt');
      else{
        const part=state.m.pieces[kind], radius=terminalRadius(part);
        const length=grip(kind);
        item=pin(part.order,length,.60,radius);
        const end=new T.Group();end.name='Kit_terminal';end.position.y=length;item.add(end);
        const ball=atomBall(part.element,radius);
        end.add(ball);
        // The paired ink studs are a Lewis count on the end cap. Their
        // placement is a diagrammatic inventory, independent of hub angles.
        for(let k=0;k<part.lonePairs;k++)for(const side of [-1,1]){
          const a=2*Math.PI*k/part.lonePairs+side*.16;
          const mark=new T.Mesh(electronGeometry,electronMaterial);
          mark.userData.terminalPairMark=true;
          mark.position.set(.82*Math.cos(a),.57,.82*Math.sin(a)).multiplyScalar(radius);
          end.add(mark);
        }
        if(part.group){
          const hRadius=terminalRadius({element:'H'}),hLength=bondSpec(part.element,{element:'H',order:1}).length;
          for(const d of groupDirections(part,0)){
            const direction=new T.Vector3(...d),link=pin(1,hLength,radius,hRadius);
            link.quaternion.setFromUnitVectors(UP,direction);end.add(link);
            const hydrogen=atomBall('H',hRadius);hydrogen.position.copy(direction).multiplyScalar(hLength);
            hydrogen.userData.groupAtom=true;end.add(hydrogen);
          }
        }
      }
      templates.set(key,item);
    }
    const obj=templates.get(key).clone(true);
    obj.quaternion.setFromUnitVectors(UP,dir);
    const part=state.m.pieces[kind],end=obj.getObjectByName('Kit_terminal');
    if(part?.group&&index!=null){
      const sites=state.reference?state.m.reference:state.sites;
      const neighbor=sites.findIndex((k,i)=>i!==index&&isBond(k));
      let radial=neighbor>=0?dirs[neighbor].clone():new T.Vector3(1,0,0);
      radial.addScaledVector(dir,-radial.dot(dir));
      if(radial.lengthSq()<.0001){radial.set(0,0,1).addScaledVector(dir,-dir.z);}
      if(radial.lengthSq()<.0001){radial.set(1,0,0).addScaledVector(dir,-dir.x);}
      radial.normalize().applyQuaternion(obj.quaternion.clone().invert());
      const phase=normalizedTorsion(part,state.reference?60:state.torsions?.[LETTERS[index]]);
      end.rotation.y=Math.atan2(-radial.z,radial.x)+phase*Math.PI/180;
    }
    return obj;
  }
  const guideLines=dirs.map(()=>new T.Line(new T.BufferGeometry(),guidesMaterial));
  function setHub(m){
    dirs.length=m.domains;
    for(const [i,v] of m.hub.vectors.entries()){
      if(!dirs[i])dirs[i]=new T.Vector3();
      const d=dirs[i].fromArray(v).normalize(), line=guideLines[i];
      line.geometry.dispose();
      line.geometry=new T.BufferGeometry().setFromPoints([d.clone().multiplyScalar(.65),d.clone().multiplyScalar(aimRadius-.15)]);
      line.computeLineDistances();
    }
  }
  function requestDraw() {if(!raf) raf=requestAnimationFrame(()=>{raf=0;draw();});}

  function makeLabel(index,pos,text,cls) {
    const el=document.createElement('span');
    el.className='marker '+cls;el.dataset.site=index<0?'center':LETTERS[index];el.textContent=text;layer.append(el);
    let leader=null;
    if(cls==='filled') {
      leader=document.createElementNS('http://www.w3.org/2000/svg','line');
      label('leaders').append(leader);
    }
    const info={index,pos,el,leader,w:el.offsetWidth,h:el.offsetHeight,depth:0,x:0,y:0,visible:false};
    labels.push(info);return info;
  }
  function addSolids(obj,index,boreIndex=-1) {
    obj.traverse(child=>{
      if(!child.isMesh)return;
      child.userData.pickIndex=index;
      child.userData.boreIndex=boreIndex;
      solids.push(child);
    });
  }
  function loadBins() {
    for (const [kind,bin] of kitScenes) {
      if (bin.piece) bin.scene.remove(bin.piece);
      bin.piece=null;
      if(isBond(kind)&&!state.m.pieces[kind])continue;
      bin.piece=piece(kind,new T.Vector3(1,0,0));
      const bounds=new T.Box3().setFromObject(bin.piece),size=bounds.getSize(new T.Vector3()),middle=bounds.getCenter(new T.Vector3());
      const scale=Math.min(1,2.15/size.x,1.35/size.z,1.4/size.y);
      bin.piece.scale.setScalar(scale);
      bin.piece.position.set(-middle.x*scale,kind==='pair'?.34:.385,.045);
      bin.scene.add(bin.piece);
    }
  }
  function addArrow(dir,sign) {
    const obj=arrow.clone(),off=new T.Vector3().crossVectors(dir,new T.Vector3(0,0,1));
    if(off.lengthSq()<.001)off.crossVectors(dir,UP);
    obj.position.copy(dir).multiplyScalar(sign>0 ? .82 : 1.46).addScaledVector(off.normalize(),.24);
    if(Math.abs(sign)<1)obj.scale.y=.62;
    obj.quaternion.setFromUnitVectors(UP,dir.clone().multiplyScalar(Math.sign(sign)));visual.add(obj);
  }
  function addResultant(sum){
    if(sum.lengthSq()<.000001)return;
    const dir=sum.normalize(), glyph=sumArrow.clone();
    // Offset the sum just outside the hub. In a linear model it runs
    // parallel to the bond arrow on the opposite side of the pin.
    const offset=new T.Vector3().crossVectors(dir,new T.Vector3(0,0,1));
    if(offset.lengthSq()<.001)offset.crossVectors(dir,UP);
    glyph.position.copy(dir).multiplyScalar(.70).addScaledVector(offset.normalize(),-.31);
    glyph.quaternion.setFromUnitVectors(UP,dir);glyph.scale.setScalar(1.4);visual.add(glyph);
  }
  function show(next) {
    cancelGesture();
    state=next;
    if(lastCase!==next.m.formula){setHub(next.m);loadBins();lastCase=next.m.formula;}
    slots=[];labels=[];occluders=[];solids=[];orthos=[];layer.replaceChildren();label('leaders').replaceChildren();
    scene.remove(visual);visual=new T.Group();scene.add(visual);
    center=atomBall(state.m.center,.60);
    addSolids(center,-1);visual.add(center);
    occluders.push({index:-1,pos:ZERO,radius:.59});
    const multiCenter=state.m.ligands.some(p=>p.group);
    makeLabel(-1,ZERO,(multiCenter?'C₁':state.m.center)+(state.m.charge?'⁺':''),'center');
    const kinds=state.reference?state.m.reference:state.sites;
    const resultant=new T.Vector3();
    for(const [i,kind] of kinds.entries()) {
      const dir=dirs[i];
      if(!state.atoms&&(!state.reference||kind!=='empty')){
        const socket=clone('Socket_mount');
        socket.traverse(child=>{if(child.userData.hole==='lip')child.material=center.material;}); // Countersink in hub resin.
        socket.quaternion.setFromUnitVectors(UP,dir);visual.add(socket);addSolids(socket,-1,i);
      }
      const slot={kind,index:i,part:null,radius:isBond(kind)?terminalRadius(state.m.pieces[kind]):.31,pos:dir.clone().multiplyScalar(isBond(kind)||kind==='pair'?grip(kind):aimRadius),extras:[]};
      slots.push(slot);
      if(kind==='empty') {
        if(state.reference||state.atoms) continue;
        const ring=new T.Mesh(rimGeometry,clearGuide);
        slot.ring=ring;slot.line=guideLines[i];
        ring.position.copy(slot.pos);visual.add(ring,slot.line);orthos.push(ring);
      } else {
        if(kind==='pair'&&state.atoms) continue;
        slot.part=piece(kind,dir,i);
        if(state.atoms)slot.part.traverse(child=>{if(child.userData.terminalPairMark)child.visible=false;});
        visual.add(slot.part);addSolids(slot.part,i);
        slot.part.updateMatrixWorld(true);
        slot.part.traverse(child=>{
          if(child.userData.groupAtom){
            const position=child.getWorldPosition(new T.Vector3()),radius=terminalRadius({element:'H'});
            slot.extras.push({position,radius});occluders.push({index:i,pos:position,radius});
          }
        });
        occluders.push({index:i,pos:slot.pos,radius:kind==='pair'?.31:terminalRadius(state.m.pieces[kind])});
        if(state.reference&&isBond(kind)&&state.arrows){
          const strength=state.m.pieces[kind].arrow;
          if(strength){addArrow(dir,strength);resultant.addScaledVector(dir,strength);}
        }
      }
      const value=kind==='empty'?LETTERS[i]:(state.reference||state.atoms?'':LETTERS[i]+' · ')+(kind==='pair'?'LP':state.m.pieces[kind].group?'C₂':state.m.pieces[kind].element);
      const groupCenter=state.m.pieces[kind]?.group;
      makeLabel(i,slot.pos,groupCenter?'C₂':value,kind==='empty'?'vacant':groupCenter?'center':'filled');
    }
    if(state.reference&&state.arrows)addResultant(resultant);
    frameRadius=Math.max(2.29,...slots.map(s=>s.pos.length()+s.radius+.15),...slots.flatMap(s=>s.extras.map(e=>e.position.length()+e.radius+.15)));
    const keyed=slots.find(s=>isBond(s.kind));
    view.setAttribute('aria-label',state.m.formula+'. '+state.m.domains+' domain sockets. '+(multiCenter?'Two carbon centers, C1 and C2. Each completed carbon has a total bond order of four. ':'')+'Use arrow keys to turn the model.');
    label('view').querySelector('[value="End-on"]').textContent=keyed?'Along bond '+LETTERS[keyed.index]:'Along site A';
    setGauge(gaugePair);
    draw();
  }
  function setGauge(pair) {
    gaugePair=pair;
    gaugeArc.visible=false;
    if(pair&&state&&!state.reference&&slots[pair[0]]?.part&&slots[pair[1]]?.part) {
      const [a,b]=pair.map(i=>dirs[i]);
      const dot=T.MathUtils.clamp(a.dot(b),-1,1);
      const tangent=b.clone().addScaledVector(a,-dot);
      if(tangent.lengthSq()<.00001){
        const axis=Math.abs(a.y)<.9?UP:new T.Vector3(1,0,0);
        tangent.copy(axis).addScaledVector(a,-axis.dot(a));
      }
      tangent.normalize();
      const spread=Math.acos(dot), points=[];
      points.push(a.clone().multiplyScalar(1.13));
      for(let n=0;n<=48;n++){
        const t=spread*n/48;
        points.push(a.clone().multiplyScalar(.98*Math.cos(t)).addScaledVector(tangent,.98*Math.sin(t)));
      }
      points.push(b.clone().multiplyScalar(1.13));
      gaugeArc.geometry.dispose();
      gaugeArc.geometry=new T.BufferGeometry().setFromPoints(points);gaugeArc.visible=true;
    }
    requestDraw();
  }
  function cameraPose(){return {position:camera.position.toArray(),target:controls.target.toArray(),up:camera.up.toArray(),zoom:camera.zoom,preset};}
  function pose(vec,name) {
    settingPose=true;controls.target.set(0,0,0);camera.up.set(0,1,0);camera.position.copy(vec).normalize().multiplyScalar(initial.length());
    camera.zoom=1;camera.updateProjectionMatrix();controls.update();preset=name;settingPose=false;
    draw();actions.camera(cameraPose());
  }
  function restore(saved,m=state?.m) {
    const pos=saved?.position,target=saved?.target,valid=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
    settingPose=true;
    controls.target.copy(valid(target)?new T.Vector3(...target):new T.Vector3());
    camera.up.copy(valid(saved?.up)&&Math.hypot(...saved.up)>.1?new T.Vector3(...saved.up).normalize():new T.Vector3(0,1,0));
    camera.position.copy(valid(pos)&&Math.hypot(...pos)>0?new T.Vector3(...pos):overview(m));
    camera.zoom=Number.isFinite(saved?.zoom)?T.MathUtils.clamp(saved.zoom,.35,5):1;camera.updateProjectionMatrix();
    controls.update();preset=saved?.preset||'Oblique';settingPose=false;draw();
  }
  function changeView(name) {
    let vec=overview(state?.m);
    if(name==='End-on'){
      const first=slots.find(s=>isBond(s.kind))||slots[0];
      vec=dirs[first?.index||0].clone();
    } else if(VIEWS[name]) vec.set(...VIEWS[name]);
    pose(vec,name);
  }
  function turn(yaw,pitch=0) {
    controls.rotate(yaw,pitch);preset='Rotated';draw();actions.camera(cameraPose());
  }
  function projection(i,j) {
    const sight=camera.getWorldDirection(new T.Vector3()).negate();
    const a=dirs[i].clone().addScaledVector(sight,-dirs[i].dot(sight));
    const b=dirs[j].clone().addScaledVector(sight,-dirs[j].dot(sight));
    if(Math.min(a.length(),b.length())<.018)return null;
    return T.MathUtils.radToDeg(a.angleTo(b));
  }
  function screenRect(rect,bounds) {
    return [rect.left-bounds.left,bounds.bottom-rect.bottom,rect.width,rect.height];
  }
  function drawScene(s,cam,rect,bounds) {
    const box=screenRect(rect,bounds);renderer.setViewport(...box);renderer.setScissor(...box);
    renderer.clearDepth();renderer.render(s,cam);
  }
  function drawLabels(rect) {
    const contact=gesture?.dragging?gesture:null;
    const candidates=[];
    for(const l of labels) {
      // A direct builder launch initially measures the hidden guided panel at zero width.
      if(!l.w||!l.h){l.w=l.el.offsetWidth;l.h=l.el.offsetHeight;}
      const p=l.pos.clone().project(camera);
      l.x=(.5+p.x/2)*rect.width;l.y=(.5-p.y/2)*rect.height;l.depth=p.z;
      ray.setFromCamera(new T.Vector2(p.x,p.y),camera);
      const distance=l.pos.clone().sub(ray.ray.origin).dot(ray.ray.direction);
      const hidden=occluders.some(o=>{
        if(o.index===l.index||o.index===contact?.from)return false;
        const offset=o.pos.clone().sub(ray.ray.origin);
        const t=offset.dot(ray.ray.direction);
        return t>0&&t<distance&&offset.lengthSq()-t*t<o.radius**2;
      });
      l.visible=!hidden&&l.index!==contact?.from;
      if(l.visible)candidates.push(l);
    }
    // Pick/snap anchors stay on the actual grip or socket. Callout positions
    // are a presentation layer and never enter hit testing or chemistry.
    const vacant=l=>l.index>=0&&slots[l.index].kind==='empty';
    candidates.sort((a,b)=>Number(vacant(a))-Number(vacant(b))||a.depth-b.depth);
    lastTargets=[];
    for(const l of candidates){
      if(l.index<0)continue;
      if(!lastTargets.some(front=>Math.hypot(l.x-front.x,l.y-front.y)<10))lastTargets.push(l);
      else l.visible=false;
    }
    const project=p=>{
      const q=p.clone().project(camera);
      return {x:(.5+q.x/2)*rect.width,y:(.5-q.y/2)*rect.height};
    };
    const obstacles=silhouette(slots,dirs,project,rect.height*camera.zoom/(camera.top-camera.bottom));
    arrangeSiteTags(labels,obstacles,rect.width,rect.height,Boolean(contact));
    lastTargets=lastTargets.filter(l=>slots[l.index].kind!=='empty'||!l.el.hidden);
    for(const l of labels){
      const slot=slots[l.index], aimed=l.index>=0&&contact?.over===l.index;
      if(slot?.ring){
        slot.ring.visible=!l.el.hidden&&!aimed;
        slot.line.visible=!l.el.hidden;
      }
      if(aimed)l.el.hidden=true; // The pin preview occupies the guide. Use the outer halo.
      l.el.classList.toggle('near',aimed&&!contact.blocked);
      l.el.classList.toggle('blocked',aimed&&contact.blocked);
      l.el.classList.toggle('measuring',gaugeArc.visible&&gaugePair.includes(l.index));
    }
  }
  const axisConfig=[['x',new T.Vector3(1,0,0),'#934f40'],['y',UP,'#4a7450'],['z',new T.Vector3(0,0,1),'#376a8a']];
  const svg=label('axes'), ns='http://www.w3.org/2000/svg';
  const axes=axisConfig.map(([name,vector,color])=>{
    const line=document.createElementNS(ns,'line'),text=document.createElementNS(ns,'text');
    line.setAttribute('x1',28);line.setAttribute('y1',24);line.setAttribute('stroke',color);
    text.textContent=name;text.setAttribute('fill',color);text.setAttribute('text-anchor','middle');svg.append(line,text);
    return {line,text,vector};
  });
  function drawAxes(){
    const inv=camera.quaternion.clone().invert();
    for(const a of axes){
      const p=a.vector.clone().applyQuaternion(inv);
      a.line.setAttribute('x2',28+15*p.x);a.line.setAttribute('y2',24-15*p.y);
      a.text.setAttribute('x',28+21*p.x);a.text.setAttribute('y',27-21*p.y);
      a.text.style.opacity=Math.abs(p.z)>.98?'.25':'1';
    }
  }
  function draw() {
    if(!state)return;
    const bounds=host.getBoundingClientRect(),rect=view.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const half=frameRadius*Math.max(1,rect.height/rect.width);
    Object.assign(camera,{top:half,bottom:-half,left:-half*rect.width/rect.height,right:half*rect.width/rect.height});
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const groupSlot=slots.find(s=>state.m.pieces[s.kind]?.group);
    const overlap=label('vsepr-overlap-note');
    if(overlap){
      overlap.hidden=!groupSlot||Math.abs(camera.getWorldDirection(new T.Vector3()).dot(dirs[groupSlot.index]))<.96;
      overlap.textContent='End-on view: C₁ and C₂ overlap in this projection. The visible spokes belong to two carbons. Use Oblique view to separate them.';
    }
    const width=Math.round(bounds.width),height=Math.round(bounds.height);
    if(width!==lastWidth||height!==lastHeight){renderer.setSize(width,height,false);lastWidth=width;lastHeight=height;}
    renderer.setScissorTest(false);renderer.setViewport(0,0,bounds.width,bounds.height);renderer.clear();
    renderer.setScissorTest(true);
    orthos.forEach(r=>r.quaternion.copy(camera.quaternion));focusRim.quaternion.copy(camera.quaternion);
    if(snapAnimation) {
      const t=Math.min(1,(performance.now()-snapAnimation.start)/140);
      snapAnimation.part.position.copy(snapAnimation.dir).multiplyScalar(.135*(1-t)**2);
      if(t<1)requestDraw();else snapAnimation=null;
    }
    rig.align(camera);
    scene.updateMatrixWorld(true);drawLabels(rect);drawScene(scene,camera,rect,bounds);
    for(const bin of kitScenes.values()){
      const r=bin.well.getBoundingClientRect();if(!r.width||!r.height)continue;
      const half=Math.max(.53,1.39*r.height/r.width);
      Object.assign(bin.camera,{top:half,bottom:-half,left:-half*r.width/r.height,right:half*r.width/r.height});
      bin.camera.updateProjectionMatrix();drawScene(bin.scene,bin.camera,r,bounds);
    }
    if(gesture?.ghost?.visible) {
      Object.assign(ghostCam,{left:-bounds.width/2,right:bounds.width/2,top:bounds.height/2,bottom:-bounds.height/2});
      ghostCam.updateProjectionMatrix();drawScene(overlay,ghostCam,bounds,bounds);
    }
    renderer.setScissorTest(false);drawAxes();label('view').value=preset;syncChoices();
    if(cameraDirty){cameraDirty=false;actions.instrument();}
  }
  function nearest(x,y,slop) {
    const rect=view.getBoundingClientRect();
    // A second hand can rotate the hub in the very frame the first releases.
    if(cameraDirty)drawLabels(rect);
    x-=rect.left;y-=rect.top;
    let best=null,dist=slop;
    for(const candidate of lastTargets) {
      const d=Math.hypot(x-candidate.x,y-candidate.y);
      if(d<dist){best=candidate;dist=d;}
    }
    return best?.index??-1;
  }
  function surface(x,y,skip) {
    const r=view.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2((x-r.left)/r.width*2-1,1-(y-r.top)/r.height*2),camera);
    return ray.intersectObjects(solids,false).find(hit=>hit.object.userData.pickIndex!==skip)?.object.userData;
  }
  function pick(x,y) {
    const hit=surface(x,y);
    if(hit)return hit.boreIndex>=0?hit.boreIndex:hit.pickIndex;
    return nearest(x,y,15);
  }
  function message(text) {
    if(text!==lastMessage){lastMessage=text;actions.guide(text);}
  }
  function cancelGesture() {
    if(!gesture)return;
    if(gesture.ghost)overlay.remove(gesture.ghost);
    if(gesture.preview)scene.remove(gesture.preview);
    if(gesture.from!=null&&slots[gesture.from]?.part)slots[gesture.from].part.visible=true;
    for(const bin of kitScenes.values())if(bin.piece)bin.piece.visible=true;
    host.classList.remove('dragging');tray.classList.remove('return-zone');focusRim.visible=false;
    if(gesture.owner?.hasPointerCapture(gesture.id))gesture.owner.releasePointerCapture(gesture.id);
    gesture=null;controls.enabled=true;lastMessage='';requestDraw();
  }
  function startLift(g){
    if(g.from!=null&&slots[g.from]?.part)slots[g.from].part.visible=false;
    if(g.from==null)kitScenes.get(g.kind).piece.visible=false;
    g.ghost=piece(g.kind,UP);overlay.add(g.ghost);
    g.preview=piece(g.kind,UP);scene.add(g.preview);g.preview.visible=false;
    g.dragging=true;host.classList.add('dragging');
  }
  function dragAt(g,x,y) {
    const r=view.getBoundingClientRect(),bounds=host.getBoundingClientRect(),t=tray.getBoundingClientRect();
    g.returning=inRect(x,y,t);tray.classList.toggle('return-zone',g.returning&&g.from!=null);
    g.over=-1;
    if(inRect(x,y,r)){
      // The physical bushing under the pointer is also a legitimate target.
      const bore=surface(x,y,g.from)?.boreIndex??-1;
      g.over=bore>=0?bore:nearest(x,y,SNAP_PX[g.pointerType]||25);
    }
    g.blocked=g.over>=0&&slots[g.over].kind!=='empty'&&g.over!==g.from;
    const candidate=g.over>=0?slots[g.over]:null;
    const canSeat=candidate&&!g.blocked&&g.over!==g.from;
    g.ghost.visible=!canSeat;g.preview.visible=!!canSeat;
    focusRim.visible=!!candidate;
    if(candidate) {
      focusRim.position.copy(candidate.pos);
      if(canSeat)focusRim.position.copy(dirs[g.over]).multiplyScalar(grip(g.kind)+.135);
      focusRim.scale.setScalar(2.07);
      focusRim.material.color.set(g.blocked?0xa46e25:0x008478);
    }
    if(canSeat){
      g.preview.quaternion.setFromUnitVectors(UP,dirs[g.over]);
      g.preview.position.copy(dirs[g.over]).multiplyScalar(.135);
      message('Site '+LETTERS[g.over]+' in range. Release to seat the pin.');
    }else{
      const size=r.height*camera.zoom/(camera.top-camera.bottom);
      const dir=new T.Vector3(x-(r.left+r.width/2),r.top+r.height/2-y,25).normalize();
      if(!inRect(x,y,r))dir.set(1,0,.10).normalize();
      g.ghost.scale.setScalar(size);
      g.ghost.quaternion.setFromUnitVectors(UP,dir);
      g.ghost.position.set(x-bounds.left-bounds.width/2,bounds.height/2-(y-bounds.top),0)
        .addScaledVector(dir,-grip(g.kind)*size);
      message(g.blocked?'Site '+LETTERS[g.over]+' is occupied. Remove its piece first.':
        g.returning&&g.from!=null?'Release in the tray to remove the piece.':'Move the grip toward a visible site. Release away to cancel.');
    }
    requestDraw();
  }
  function canGripBin(kind,x,y) {
    const bin=kitScenes.get(kind),rect=bin.well.getBoundingClientRect();
    if(!inRect(x,y,rect))return false;
    ray.setFromCamera(new T.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),bin.camera);
    if(ray.intersectObject(bin.piece,true).length)return true;
    const p=new T.Vector3(0,grip(kind),0).applyMatrix4(bin.piece.matrixWorld).project(bin.camera);
    const gx=rect.left+(.5+p.x/2)*rect.width,gy=rect.top+(.5-p.y/2)*rect.height;
    return Math.hypot(x-gx,y-gy)<15;
  }
  let suppressClick=false;
  host.addEventListener('pointerdown',e=>{
    if(gesture||!e.isPrimary||e.button!==0||!state)return;
    const bin=e.target.closest('.part');
    if(bin?.disabled)return;
    if(!bin&&!view.contains(e.target))return;
    const idx=bin?-1:pick(e.clientX,e.clientY);
    if(state.step!==0||state.reference){
      if(bin){e.preventDefault();actions.reject('Return to Build before fitting another piece.');suppressClick=true;return;}
      if(idx>=0&&state.step===2)gesture={inspect:idx,id:e.pointerId,x:e.clientX,y:e.clientY};
      return;
    }
    if(!bin&&(idx<0||state.atoms))return;
    const from=!bin&&slots[idx].kind!=='empty'?idx:null;
    const selected=bin?.dataset.tool||(from!=null?slots[idx].kind:null);
    const kind=!bin||canGripBin(selected,e.clientX,e.clientY)?selected:null;
    if(bin){
      actions.choose(selected);
      if(state.atoms)actions.reveal();
    }
    const owner=bin||view;
    e.preventDefault();e.stopImmediatePropagation();owner.setPointerCapture(e.pointerId);
    controls.enabled=false;
    gesture={id:e.pointerId,pointerType:e.pointerType,x:e.clientX,y:e.clientY,idx,bin,kind,from,owner,over:-1,dragging:false};
  },true);
  host.addEventListener('pointermove',e=>{
    const g=gesture;if(g?.id!==e.pointerId||g.inspect!=null||!g.kind)return;
    if(!g.dragging&&Math.hypot(e.clientX-g.x,e.clientY-g.y)>4)startLift(g);
    if(g.dragging)dragAt(g,e.clientX,e.clientY);
  });
  function releaseAt(x,y){
    const g=gesture;if(!g)return;
    if(g.inspect!=null){
      if(Math.hypot(x-g.x,y-g.y)<6)actions.inspect(g.inspect);
      cancelGesture();return;
    }
    if(g.dragging)dragAt(g,x,y);
    const {from,over,kind,returning,blocked,dragging,bin,idx}=g;
    const heldStill=Math.hypot(x-g.x,y-g.y)<(g.hand?12:7);
    suppressClick=!!bin&&!g.hand;cancelGesture();
    if(!dragging){
      if(!bin&&heldStill)actions.place(idx);
      else actions.guide('Selected '+(bin?.dataset.tool==='pair'?'lone pair':'bonded atom')+'. Choose a visible site or use the site controls.');
      return;
    }
    if(from!=null&&returning){actions.remove(from);return;}
    if(blocked){actions.reject('Site '+LETTERS[over]+' already holds a piece. Unplug it before seating another.');return;}
    if(over<0){actions.reject('Released outside socket range. The piece returned to its starting position.');return;}
    if(from===over){actions.guide('Returned the piece to its original socket.');return;}
    if(from==null)actions.place(over,kind);else actions.move(from,over);
    if(!reduceMotion&&slots[over]?.part){snapAnimation={part:slots[over].part,dir:dirs[over],start:performance.now()};requestDraw();}
  }
  host.addEventListener('pointerup',e=>{if(gesture?.id===e.pointerId)releaseAt(e.clientX,e.clientY);});
  // Hand input uses the same ghost, socket hit test and release transaction.
  host.handKit={
    targetAt(target,x,y){
      const bin=target.closest('.part');if(bin && host.contains(bin))return bin;
      if(!view.contains(target))return null;
      const site=pick(x,y);return site>=0?'site:'+site:'turn';
    },
    begin(target,x,y){
      if(!state||gesture||!host.contains(target))return null;
      const bin=target.closest('.part'),idx=bin?-1:pick(x,y);
      if(bin?.disabled)return null;
      if(!bin&&!view.contains(target))return null;
      if(state.step!==0||state.reference){
        if(bin){actions.reject('Return to Build before fitting another piece.');return null;}
        if(idx>=0&&state.step===2){gesture={hand:true,inspect:idx,x,y};return 'part';}
        return 'turn';
      }
      if(!bin&&(idx<0||state.atoms))return 'turn';
      const from=!bin&&slots[idx]?.kind!=='empty'?idx:null;
      const kind=bin?.dataset.tool||(from!=null?slots[from].kind:null);
      if(bin){actions.choose(kind);if(state.atoms)actions.reveal();}
      controls.enabled=false;
      gesture={hand:true,pointerType:'touch',x,y,idx,bin,kind,from,over:-1,dragging:false};
      return 'part';
    },
    move(x,y){
      const g=gesture;if(!g?.hand||!g.kind)return;
      if(!g.dragging&&Math.hypot(x-g.x,y-g.y)>9)startLift(g);
      if(g.dragging)dragAt(g,x,y);
    },
    release(x,y){if(gesture?.hand)releaseAt(x,y);},
    cancel(){if(gesture?.hand)cancelGesture();},
    canTurn:(target,x,y)=>view.contains(target)&&pick(x,y)<0,
    turn:(dx,dy)=>controls.rotate(dx*.005,dy*.005),
    pan:(dx,dy)=>controls.pan(dx,dy),
    zoom(factor){
      if(gesture || !controls.enabled)return false;
      controls.zoom(factor);return camera.zoom;
    },
    endTurn:()=>controls.dispatchEvent({type:'end'})
  };
  document.addEventListener('b06-mode',cancelGesture);
  host.addEventListener('pointercancel',()=>{cancelGesture();actions.guide('Placement canceled.');});
  host.addEventListener('keydown',e=>{if(e.key==='Escape'&&gesture){cancelGesture();actions.guide('Placement canceled.');}});
  tray.querySelectorAll('.part').forEach(bin=>bin.addEventListener('click',e=>{
    if(suppressClick&&e.detail!==0){suppressClick=false;return;}
    suppressClick=false;
    if(state.step!==0){actions.reject('Return to Build before fitting another piece.');return;}
    actions.choose(bin.dataset.tool);if(state.atoms)actions.reveal();
  }));
  const arrows={ArrowLeft:[-Math.PI/8,0],ArrowRight:[Math.PI/8,0],ArrowUp:[0,-Math.PI/14],ArrowDown:[0,Math.PI/14]};
  view.addEventListener('keydown',e=>{if(arrows[e.key]){e.preventDefault();turn(...arrows[e.key]);}});
  controls.addEventListener('change',()=>{if(!settingPose){preset='Rotated';cameraDirty=true;requestDraw();}});
  controls.addEventListener('end',()=>{if(state)actions.camera(cameraPose());});
  new ResizeObserver(()=>{if(gesture)cancelGesture();requestDraw();}).observe(host);
  return {show,setGauge,dirs,projection,pose:cameraPose,turn,view:changeView,restore,
    alongBond(index){if(!slots[index]||!isBond(slots[index].kind))return;pose(dirs[index].clone(),'Rotated');},
    zoom:factor=>{controls.zoom(factor);actions.camera(cameraPose());},roll:angle=>{controls.rotate(0,0,angle);actions.camera(cameraPose());},redraw:requestDraw,controls,element:view};
}
