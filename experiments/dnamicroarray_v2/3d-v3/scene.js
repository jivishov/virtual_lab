/* Reference-informed classroom apparatus in arbitrary Y-up scene units.
   v3 follows the manual's photographs: a foil-sealed QuickStrip with a letter printed over each
   well (p.11), a card printed only with row labels, column numbers and circles (pp.11–12),
   snap-top microcentrifuge tubes identified by cap colour and label, a glass-door incubator and a
   handheld long-wave UV lamp. Liquids are near-clear. Red, green and yellow are reserved for
   fluorescence; apparatus colour comes from caps, racks, boxes and PPE. */
(function(root){
  'use strict';
  const {G,M,V,rgb}=root.E3D;
  const {Vessel,QuantityTween}=root.MicroarrayLiquid;
  const LIQUID='#dbe6e9';
  /* The pipette hovers straight above its aim point: the bench spot under the cursor, or the hovered target's opening. */
  const AIM_Y=.05,HOVER=.32,EASE_S=.05,EASE_SNAP=.05;
  const CAPS={EB:'#3f6fb3',cDNA:'#7b5fae',HB:'#b8508a'};
  // Linear excitation response of each result, tuned to the p.12 photograph (Up appears orange-red).
  const FLUOR={yellow:[1.55,1.3,.03],red:[1.8,.42,.07],green:[.1,1.5,.18],black:[0,0,0]};
  const PAPER_FLUOR=[.02,.13,.95]; // optical brighteners make the paper glow blue (p.12 photograph)
  // Visual-only layer of prepared patient sample; the manual does not give its volume, so it is never counted.
  const SAMPLE_VISUAL=1.6;
  const PLEX='600 {px}px Plex, "IBM Plex Sans", Arial, sans-serif',HAND='{px}px "Segoe Print","Bradley Hand","Comic Sans MS",cursive';
  const colX=c=>-1.39+c*.43;
  class Scene {
    constructor(r,p){this.r=r;this.targets=[];this.wells={};this.spots={};this.tubes={};this.tipMeshes=[];this.regions={};this.rows=p.rows;this.uvLevel=0;this.build();this.sync(p,true);}
    mat(color,options={}){return this.r.material(color,options);}
    box(w,h,d,m,pos=[0,0,0],parent,rad){return this.r.mesh(G.bevelBox(w,h,d,rad),m,parent).set(...pos);}
    cyl(rad,h,m,pos=[0,0,0],parent,top=rad,n=28){return this.r.mesh(G.cylinder(rad,h,n,top),m,parent).set(...pos);}
    ring(rad,t,m,pos=[0,0,0],parent){return this.r.mesh(G.torus(rad,t,28),m,parent).set(...pos);}
    region(name,node,min,max){this.regions[name]={node,min,max};}
    bounds(name){
      const g=this.regions[name];if(!g)return [];g.node.update(g.node.parent?.world);
      const pts=[];for(const x of [g.min[0],g.max[0]])for(const y of [g.min[1],g.max[1]])for(const z of [g.min[2],g.max[2]])pts.push(M.point(g.node.world,[x,y,z]));
      return pts;
    }
    canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
    decal(w,h,canvas,pos,parent,options={}){
      const node=this.r.mesh(G.plane(w,h),this.mat(options.color||'#ffffff',{map:this.r.texture(canvas),opacity:.998,rough:options.rough??.75,pattern:options.pattern??6,emission:options.emission||0,metal:options.metal||0}),parent).set(...pos);
      node.canvas=canvas;node.noShadow=true;node.decal=true;if(options.flat)node.rot[0]=-Math.PI/2;return node;
    }
    text(str,w,h,pos,parent,options={}){
      const c=this.canvas(512,Math.max(64,Math.round(512*h/w)));
      const node=this.decal(w,h,c,pos,parent,options);node.options=options;this.retext(node,str);return node;
    }
    retext(n,str){
      if(n.text===str)return;n.text=str;const c=n.canvas,ctx=c.getContext('2d'),o=n.options;
      ctx.clearRect(0,0,c.width,c.height);if(o.bg){ctx.fillStyle=o.bg;ctx.fillRect(0,0,c.width,c.height);}
      ctx.fillStyle=o.ink||'#1f2a2e';ctx.textAlign='center';ctx.textBaseline='middle';
      const lines=str.split('\n'),size=Math.min(c.height/(lines.length*1.3),c.width/(Math.max(...lines.map(s=>s.length),1)*.62))*(o.scale||1);
      ctx.font=(o.hand?HAND:PLEX).replace('{px}',size);
      lines.forEach((line,i)=>ctx.fillText(line,c.width/2,c.height*(i+.5)/lines.length));this.r.texture(c,n.mat.map);
    }
    flat(str,w,h,pos,parent,options={}){return this.text(str,w,h,pos,parent,{...options,flat:true});}
    blob(w,d,pos,parent,strength=.5){const n=this.r.mesh(G.plane(w,d),this.mat('#000000',{pattern:4,opacity:strength}),parent).set(...pos);n.rot[0]=-Math.PI/2;n.decal=true;n.noShadow=true;return n;}
    target(id,label,group,offset,radius,kind,sample){const t={id,label,group,offset,radius,kind,sample};this.targets.push(t);return t;}
    position(t){return M.point(t.group.world,t.offset);}
    build(){
      const r=this.r;
      const m={
        wall:this.mat('#dcd3c2',{rough:.92}),trim:this.mat('#e7e4dd',{rough:.5}),bench:this.mat('#5e6a71',{rough:.5,pattern:1}),edge:this.mat('#a47a50',{rough:.55,pattern:8}),
        pp:this.mat('#ecede8',{rough:.42,pattern:8}),ppDark:this.mat('#d9dbd5',{rough:.5}),dark:this.mat('#2d3134',{rough:.5,pattern:8}),
        steel:this.mat('#c3c8ca',{rough:.3,metal:.85,pattern:7}),clear:this.mat('#eef3f2',{glass:1,rough:.12,opacity:.05,thickness:.14}),
        tube:this.mat('#e9ede8',{rough:.24,opacity:.55,pattern:8}) /* translucent polypropylene, visible from any angle */,ink:this.mat('#2a3236',{rough:.7}),tape:this.mat('#e6dfcc',{rough:.8})
      };
      this.m=m;
      // Room and bench.
      this.box(15,.22,10,m.bench,[0,-.13,0]);this.box(15,.08,.14,m.edge,[0,-.06,4.97]);
      // Bench cabinets below the worktop, so steep views never show empty space.
      const cab=this.mat('#c9c3b6',{rough:.6,pattern:8});this.box(15,3.2,.1,cab,[0,-1.72,4.9]);
      for(let x=-7.5+1.875;x<7.5;x+=3.75)this.box(.03,3.0,.03,this.mat('#9f998d',{rough:.6}),[x,-1.72,4.96]);
      for(let x=-7.5+.94;x<7.5;x+=1.875)this.box(.36,.05,.06,m.steel,[x,-.55,4.99]);
      this.box(15,4.4,.13,m.wall,[0,2.0,-4.6]);this.box(15,.14,.2,m.trim,[0,.05,-4.47]);
      this.windowGlow=this.box(4.6,2.1,.02,this.mat('#e3ecef',{pattern:5,emission:1.9}),[-4.1,2.25,-4.52]);
      for(const x of [-6.4,-4.1,-1.8])this.box(.07,2.2,.05,m.trim,[x,2.25,-4.48]);
      for(const y of [1.2,2.25,3.3])this.box(4.7,.07,.05,m.trim,[-4.1,y,-4.48]);
      this.box(4.9,.06,.28,m.trim,[-4.1,1.17,-4.4]);
      this.text('MOLECULAR BIOLOGY · TEACHING LAB',3.4,.22,[3.1,3.45,-4.52],r.root,{ink:'#5a6661'});
      const shelf=r.group().set(3.1,2.45,-4.33);this.box(3.8,.07,.42,this.mat('#b08a60',{rough:.6,pattern:8}),[0,0,0],shelf);
      for(const [x,glass,cap,h] of [[-1.35,'#a8662c','#2f3437',.62],[-.75,'#f2f4f1','#3f6fb3',.5],[-.2,'#e9ebe4','#e9ebe4',.7],[.45,'#a8662c','#2f3437',.48],[1.1,'#f2f4f1','#7b5fae',.56]]){
        const g=r.group(shelf).set(x,.03,0);
        r.mesh(G.lathe([[.001,0],[.14,0],[.15,.02],[.15,h*.72],[.07,h*.9],[.06,h]],28),glass==='#e9ebe4'?this.mat(glass,{rough:.45,pattern:8}):this.mat(glass,{glass:1,rough:.14,opacity:.55,thickness:.25}),g);
        this.cyl(.068,.08,this.mat(cap,{rough:.4}),[0,h,0],g);
      }
      const sign=this.canvas(512,340),sx=sign.getContext('2d');sx.fillStyle='#f6f4ee';sx.fillRect(0,0,512,340);sx.strokeStyle='#6b4fb0';sx.lineWidth=18;sx.strokeRect(9,9,494,322);
      sx.fillStyle='#4a3a86';sx.font=PLEX.replace('{px}',64);sx.textAlign='center';sx.fillText('UV LIGHT',256,130);sx.font=PLEX.replace('{px}',34).replace('600','500');sx.fillStyle='#34393c';sx.fillText('Wear UV goggles',256,205);sx.fillText('Do not look at the lamp',256,255);
      this.decal(1.1,.73,sign,[5.35,2.35,-4.52],r.root);

      // QuickStrip plate: translucent strip frame, foil seal printed with a letter over each well (p.11).
      this.plate=r.group().set(-2.35,.02,1.25);
      const W=4.4,D=2.65,H=.30;
      this.box(W,.03,D,m.pp,[0,.015,0],this.plate);
      for(const z of [-D/2+.025,D/2-.025])this.box(W,H,.05,m.pp,[0,H/2,z],this.plate);
      for(const x of [-W/2+.025,W/2-.025])this.box(.05,H,D,m.pp,[x,H/2,0],this.plate);
      const zRow=row=>-.57+row*.43,hole=.135,deck=[];
      const deckBox=(x0,x1,z0,z1)=>{if(x1-x0>.001&&z1-z0>.001)deck.push([G.box(x1-x0,.03,z1-z0),M.trs([(x0+x1)/2,H-.015,(z0+z1)/2],[0,0,0],[1,1,1])]);};
      let zc=-D/2;
      for(let row=0;row<4;row++){
        const z0=zRow(row)-hole,z1=zRow(row)+hole;deckBox(-W/2,W/2,zc,z0);
        let xc=-W/2;for(let c=0;c<8;c++){deckBox(xc,colX(c)-hole,z0,z1);xc=colX(c)+hole;}deckBox(xc,W/2,z0,z1);zc=z1;
      }
      deckBox(-W/2,W/2,zc,D/2);
      r.mesh(G.merge(deck),m.pp,this.plate);
      this.foilCanvas=this.canvas(1024,Math.round(1024*(D-.04)/(W-.04)));
      this.foil=this.decal(W-.04,D-.04,this.foilCanvas,[0,H+.003,0],this.plate,{flat:true,color:'#e9ebea',pattern:3,metal:.25,rough:.42});
      this.foil.decal=false;this.foil.noShadow=false; // opaque foil with alpha holes where wells are pierced
      this.target('plate','Gently tap QuickStrip',this.plate,[-1.95,H+.01,1.0],.27,'plate');
      const wellMat=this.mat('#8f958f',{rough:.5});
      for(let row=0;row<4;row++)for(let col=0;col<8;col++){
        const id=this.rows[row]+(col+1),g=r.group(this.plate).set(colX(col),H,zRow(row));
        const cup=r.group(g).set(0,-.29,0);
        r.mesh(G.lathe([[0,.005],[.07,.03],[.1,.16],[.128,.29]],24),wellMat,cup);
        const puncture=r.group(g).set(0,.003,0);
        for(let n=0;n<4;n++){const flap=this.box(.034,.003,.042,this.mat('#dfe1e0',{metal:.45,rough:.35}),[Math.sin(n*Math.PI/2+.4)*.045,-.02,Math.cos(n*Math.PI/2+.4)*.045],puncture);flap.rot=[1.05,n*Math.PI/2+.4,0];}
        const fluid=new Vessel(r,cup,[[.016,.045],[.070,.069],[.091,.17],[.103,.22]],5+SAMPLE_VISUAL,LIQUID);
        fluid.mesh.mat.opacity=.62;fluid.mesh.mat.rough=.06;
        this.wells[id]={g,cup,puncture,fluid,liquid:fluid.mesh};this.target('well:'+id,'QuickStrip '+id,g,[0,.01,0],.19,'well',id);
      }
      this.blob(W+.5,D+.5,[0,.004,0],this.plate,.34);
      this.region('plate',this.plate,[-W/2,0,-D/2],[W/2,H,D/2]);

      // Paper card: printed like the manual's card, with circles, row labels and column numbers only.
      this.card=r.group();this.cardHome=[2.35,.025,1.25];
      this.paper=this.mat('#f5f2e9',{rough:.9,pattern:2,fluor:PAPER_FLUOR});
      this.box(4.45,.022,2.7,this.paper,[0,0,0],this.card,.006);
      this.printCanvas=this.canvas(1024,621);
      this.print=this.decal(4.45,2.7,this.printCanvas,[0,.0118,0],this.card,{flat:true,rough:.85});
      for(let row=0;row<4;row++)for(let col=0;col<8;col++){
        const id=this.rows[row]+(col+1),g=r.group(this.card).set(colX(col),.0112,-.43+row*.43);
        const disk=this.r.mesh(G.cylinder(.13,.0016,32),this.mat('#f5f2e9',{rough:.88,pattern:2,fluor:PAPER_FLUOR}),g);
        const wet=r.mesh(G.lathe([[0,0],[.129,0],[.127,.003],[.113,.009],[.078,.015],[0,.017]],32),this.mat('#a39679',{opacity:.6,rough:.14}),g).set(0,.001,0);wet.noShadow=true;
        const halo=r.mesh(G.plane(.46,.46),this.mat('#ffffff',{pattern:9,emission:0}),g).set(0,.004,0);halo.rot[0]=-Math.PI/2;halo.decal=true;halo.additive=true;halo.noShadow=true;halo.visible=false;
        this.spots[id]={g,disk,wet,halo,quantity:new QuantityTween()};this.target('spot:'+id,'Card spot '+id,g,[0,.012,0],.18,'spot',id);
      }
      this.target('card','Paper microarray card',this.card,[-2.12,.04,1.15],.25,'card');
      this.region('card',this.card,[-2.23,0,-1.35],[2.23,.05,1.35]);this.region('cardAt',this.card,[-2.23,0,-1.35],[2.23,.05,1.35]);
      this.cardBlob=this.blob(4.9,3.1,[0,.004,0],this.card,.22);
      const outline=r.group().set(...this.cardHome);
      for(const z of [-1.44,1.44])this.box(4.7,.004,.07,m.tape,[0,-.02,z],outline,.001);
      for(const x of [-2.34,2.34])this.box(.07,.004,2.95,m.tape,[x,-.02,0],outline,.001);
      this.text('CARD',.44,.14,[2.0,-.015,1.44],outline,{flat:true,hand:true,ink:'#2b3a55',bg:'#e6dfcc'});
      this.region('benchOutline',outline,[-2.4,0,-1.5],[2.4,.05,1.5]);
      this.target('bench','Card bench position',r.root,this.cardHome,.70,'station');

      // Three 200 µL aliquots in 1.5 mL snap-top tubes (assumed size), in a polypropylene rack.
      const rack=r.group().set(1.05,.02,-.85);this.rack=rack;
      this.box(1.45,.36,.75,this.mat('#d6835e',{rough:.5,pattern:8}),[0,.18,0],rack);
      for(const [i,id] of ['EB','cDNA','HB'].entries()){
        const g=r.group(rack).set((i-1)*.44,.12,0);
        this.ring(.105,.016,this.mat('#a85f41',{rough:.6}),[0,.245,0],g);
        r.mesh(G.lathe([[.004,0],[.02,.02],[.075,.18],[.085,.58],[.097,.6],[.097,.625],[.086,.625]],32),m.tube,g);
        const fluid=new Vessel(r,g,[[.006,.022],[.066,.175],[.077,.57]],1500,LIQUID);fluid.mesh.mat.opacity=.58;fluid.mesh.mat.rough=.05;
        const hinge=r.group(g).set(0,.625,-.097);hinge.rot[0]=-2.55; // snap cap flipped open behind the tube
        const capMat=this.mat(CAPS[id],{rough:.34,pattern:8});
        this.cyl(.1,.055,capMat,[0,0,.097],hinge);this.cyl(.078,.05,capMat,[0,-.05,.097],hinge);
        this.box(.04,.012,.05,capMat,[0,.622,-.105],g);
        this.text(id,.15,.11,[0,.45,.088],g,{bg:'#f7f5ee',hand:true,ink:'#1d2a3a',rough:.8});
        this.tubes[id]={g,fluid,liquid:fluid.mesh};
        this.target(id,id==='cDNA'?'Control cDNA':id==='EB'?'Equilibration buffer (EB)':'Hybridization buffer (HB)',g,[0,.63,0],.21,'reagent');
      }
      this.blob(1.9,1.2,[0,.003,0],rack,.4);
      this.region('rack',rack,[-.73,0,-.38],[.73,.76,.38]);

      // Tip rack with a clear blue lid and natural tips.
      this.tipbox=r.group().set(-1.1,.02,-.85);
      this.box(1.8,.3,1.08,this.mat('#3d608d',{rough:.42,pattern:8}),[0,.15,0],this.tipbox);
      this.box(1.84,.03,1.1,m.pp,[0,.315,0],this.tipbox);
      const lid=r.group(this.tipbox).set(0,.33,-.55);lid.rot[0]=1.35;this.box(1.84,.025,1.09,this.mat('#a9c6ea',{glass:1,rough:.15,opacity:.35,thickness:.2}),[0,0,-.55],lid);
      const tipMat=this.mat('#ece6d6',{rough:.28,opacity:.9,pattern:8});
      for(let i=0;i<96;i++){
        const mesh=r.mesh(G.lathe([[.008,0],[.038,.18],[.043,.23],[.027,.23],[.020,.17],[.008,0]],10),tipMat,this.tipbox).set((i%12-5.5)*.133,.18,(Math.floor(i/12)-3.5)*.115);
        this.tipMeshes.push(mesh);
      }
      this.tipMark=this.ring(.061,.010,this.mat('#5fd0bd',{pattern:5,emission:1.6}),[0,.419,0],this.tipbox);
      this.tipTarget=this.target('tips','Next unused tip',this.tipbox,[-.7315,.42,-.4025],.26,'tips');
      this.blob(2.2,1.5,[0,.003,0],this.tipbox,.4);
      this.region('tips',this.tipbox,[-.9,0,-.54],[.9,.45,.54]);

      // Tip waste: kraft carton labelled with marker on tape.
      const waste=r.group().set(-3.35,.01,-.85),wasteMat=this.mat('#b98c5d',{rough:.82,pattern:8});
      this.box(1.2,.06,1.04,wasteMat,[0,.03,0],waste);
      for(const x of [-.58,.58])this.box(.035,.6,1.04,wasteMat,[x,.3,0],waste);
      for(const z of [-.50,.50])this.box(1.2,.6,.035,wasteMat,[0,.3,z],waste);
      this.text('TIP WASTE',.9,.2,[0,.4,.52],waste,{bg:'#ece7d6',hand:true,ink:'#2b2622'});
      this.target('waste','Tip waste',waste,[0,.66,0],.47,'waste');
      this.blob(1.6,1.4,[0,.003,0],waste,.45);
      this.region('waste',waste,[-.6,0,-.52],[.6,.62,.52]);

      // PPE on the bench until it is put on.
      this.gloves=r.group().set(-5.35,.01,-.95);
      this.box(1.3,.48,.72,this.mat('#4b7cc2',{rough:.55,pattern:8}),[0,.24,0],this.gloves);
      this.text('NITRILE GLOVES · M',1.1,.16,[0,.3,.365],this.gloves,{ink:'#f4f6fa'});
      const cuff=this.box(.42,.05,.3,this.mat('#7384d8',{rough:.6}),[0,.5,0],this.gloves);cuff.rot=[.25,.2,.1];
      this.blob(1.7,1.1,[0,.003,0],this.gloves,.4);
      this.goggles=this.makeGoggles('#3b6790','#e8eff2',.3);this.goggles.set(-5.3,.02,.35);
      this.uvGoggles=this.makeGoggles('#2c2f33','#e0913a',.62);this.uvGoggles.set(5.95,.02,-1.35);this.uvGoggles.rot[1]=-.5;
      this.region('goggles',this.uvGoggles,[-.45,0,-.3],[.45,.3,.3]);

      // Benchtop incubator with a glass door; the card stays visible on the shelf.
      const oven=r.group().set(-3.25,0,-3.0);this.oven=oven;
      const body=this.mat('#e7e4dc',{rough:.42,pattern:8});
      this.box(4.9,.12,2.95,body,[0,.1,0],oven);this.box(4.9,.12,2.95,this.mat('#e0ddd5',{rough:.5,pattern:8}),[0,1.3,0],oven);
      for(const x of [-2.4,2.4])this.box(.1,1.3,2.95,body,[x,.7,0],oven);
      this.box(4.9,1.3,.1,this.mat('#efece4',{rough:.6,emission:.05}),[0,.7,-1.42],oven);
      this.box(4.6,.03,2.75,m.steel,[0,.42,0],oven);
      for(const x of [-2.25,2.25])for(const z of [-1.3,1.3])this.cyl(.06,.05,m.dark,[x,0,z],oven);
      this.box(4.9,.26,.1,this.mat('#30353a',{rough:.45}),[0,1.18,1.47],oven);
      this.ovenDisplay=this.text('37.0 °C',.9,.2,[1.6,1.18,1.525],oven,{bg:'#141718',ink:'#ffb545',pattern:5,emission:1.6});
      this.text('INCUBATOR · 37 °C',1.6,.14,[-1.2,1.18,1.525],oven,{ink:'#d9dcdc'});
      const frameMat=this.mat('#3a3f42',{rough:.4});
      this.box(4.7,.95,.03,this.mat('#e3ecee',{glass:1,rough:.08,opacity:.08,thickness:.12}),[0,.6,1.49],oven);
      for(const y of [.1,1.06])this.box(4.8,.07,.06,frameMat,[0,y,1.49],oven);
      for(const x of [-2.37,2.37])this.box(.08,1.0,.06,frameMat,[x,.58,1.49],oven);
      this.box(.06,.55,.1,m.steel,[2.1,.6,1.57],oven);
      this.target('incubator','37 °C incubator',oven,[0,.6,1.1],.72,'station');
      this.ovenCard=[-3.25,.45,-3.0];
      this.blob(5.4,3.5,[0,.004,0],oven,.5);
      this.region('oven',oven,[-2.45,0,-1.48],[2.45,1.36,1.6]);

      // UV viewing area: dark mat under a handheld long-wave lamp resting in a stand (p.8, step 12).
      const uv=r.group().set(3.25,0,-3.0);this.uvArea=uv;
      this.box(4.8,.08,3.0,this.mat('#2a2e31',{rough:.6}),[0,.04,0],uv);
      this.box(4.6,.02,2.85,this.mat('#24282c',{rough:.86}),[0,.09,0],uv);
      for(const x of [-2.2,2.2])this.cyl(.045,2.0,m.steel,[x,.08,-1.3],uv);
      this.box(4.45,.06,.07,m.steel,[0,2.05,-1.3],uv);
      this.lamp=r.group(uv).set(0,1.85,-1.25);this.lamp.rot[0]=-.66;
      this.box(2.1,.2,.38,this.mat('#2b2e31',{rough:.45,pattern:8}),[0,0,0],this.lamp);
      this.lampWindow=this.box(1.86,.02,.24,this.mat('#3a3550',{rough:.2}),[0,-.105,0],this.lamp);
      this.text('LONG-WAVE UV',1.2,.12,[0,.02,.192],this.lamp,{ink:'#c9cdd2'});
      this.uvDisplay=this.text('LAMP OFF',1.1,.14,[0,.05,1.505],uv,{bg:'#141718',ink:'#9aa3a8',pattern:5,emission:1});
      this.target('uv','UV viewing area',uv,[0,.25,.3],.80,'station');this.uvCard=[3.25,.112,-2.85];
      this.blob(5.2,3.4,[0,.004,0],uv,.45);
      this.region('uv',uv,[-2.4,0,-1.5],[2.4,.6,1.5]);

      // Clipboard with the printed procedure between the stations.
      const clip=r.group().set(0,.02,-3.1);clip.rot[1]=.1;
      this.box(1.25,.02,1.7,this.mat('#8f6d4a',{rough:.7}),[0,.01,0],clip);
      const sheet=this.canvas(360,480),sc=sheet.getContext('2d');sc.fillStyle='#f7f5ee';sc.fillRect(0,0,360,480);sc.fillStyle='#39434a';sc.font=PLEX.replace('{px}',22);sc.fillText('Performing the microarray',24,48);
      sc.fillStyle='#8f989c';for(let i=0;i<14;i++)sc.fillRect(24,80+i*26,i%4===3?190:300,5);
      this.decal(1.08,1.44,sheet,[0,.022,.06],clip,{flat:true,rough:.85});
      this.box(.5,.05,.12,m.steel,[0,.045,-.78],clip);

      // P10-style single-channel pipette on its stand, showing the fixed 5 µL setting.
      this.box(.79,.10,.83,m.dark,[5.47,.05,.16]);this.box(.05,2.10,.06,m.steel,[5.68,1.10,-.04]);this.box(.50,.07,.27,m.dark,[5.49,2.16,.03]);
      this.pipette=r.group().set(5.48,.16,.31);this.pipetteHome=[...this.pipette.pos];
      this.microTip=r.group(this.pipette);
      r.mesh(G.lathe([[.008,0],[.022,.18],[.057,.55],[.040,.55],[.016,.18],[.005,.013],[.008,0]],28),this.mat('#ece6d6',{rough:.26,opacity:.8,pattern:8}),this.microTip);
      this.tipFluid=new Vessel(r,this.microTip,[[.005,.013],[.016,.18],[.035,.45]],5,LIQUID);this.tipFluid.mesh.mat.opacity=.9;this.tipFluid.mesh.mat.rough=.05;this.tipFluid.mesh.mat.color=rgb('#b9cfd8');this.microLiquid=this.tipFluid.mesh;
      const body2=this.mat('#eceeeb',{rough:.34,pattern:8});
      this.cyl(.038,.57,body2,[0,.54,0],this.pipette);
      r.mesh(G.lathe([[.05,1.08],[.092,1.2],[.11,1.68],[.165,1.89],[.145,2.08],[.08,2.20],[0,2.20]],40),body2,this.pipette);
      this.text('0 5 0',.19,.23,[0,1.65,.123],this.pipette,{bg:'#20262a',ink:'#e9eef0'});this.text('5 µL',.15,.13,[0,1.37,.113],this.pipette,{ink:'#3b4549'});
      this.cyl(.045,.15,this.mat('#9aa3a8',{rough:.4}),[0,2.19,0],this.pipette);this.plunger=this.cyl(.117,.066,this.mat('#5a7fa6',{rough:.35}),[0,2.34,0],this.pipette);
      this.box(.025,.80,.035,this.mat('#9aa3a8',{rough:.4}),[-.11,1.46,.015],this.pipette);this.cyl(.067,.06,this.mat('#9aa3a8',{rough:.4}),[-.13,1.91,.015],this.pipette);
      this.box(.12,.065,.21,body2,[0,2.04,-.18],this.pipette);
      this.target('pipette','5 µL micropipette',this.pipette,[0,1.69,0],.24,'tool');
      // Fixed spot at the stand's foot: bring the held pipette here and show an open palm to hang it back up.
      this.target('stand','Pipette stand',r.root,[5.48,.10,.25],.45,'stand');
      this.focus=r.group();this.focusRing=this.ring(.17,.012,this.mat('#5fd0bd',{pattern:5,emission:1.8}),[0,0,0],this.focus);this.focus.visible=false;this.focusRing.noShadow=true;
      // Next-target beacon: a soft double ring that guides without covering anything.
      this.beacon=r.group();for(const [rad,t] of [[.2,.008],[.26,.005]]){const ring=this.ring(rad,t,this.mat('#a4ecdc',{pattern:5,emission:1.25}),[0,0,0],this.beacon);ring.noShadow=true;}this.beacon.visible=false;
      this.r.root.update();
    }
    makeGoggles(frame,lens,opacity){
      const g=this.r.group(),fm=this.mat(frame,{rough:.45}),lm=this.mat(lens,{glass:1,rough:.1,opacity,thickness:.3});
      for(const x of [-.17,.17]){const l=this.r.mesh(G.sphere(.16,24,12),lm,g).set(x,.12,0);l.scale=[1,.62,.55];this.ring(.15,.018,fm,[x,.12,0],g).rot[0]=Math.PI/2;}
      this.box(.12,.04,.05,fm,[0,.14,0],g);const band=this.ring(.42,.014,fm,[0,.06,-.18],g);band.scale=[1,.2,.7];
      this.blob(.95,.6,[0,.003,0],g,.35);return g;
    }
    drawFoil(p){
      const key=p.ids.filter(id=>p.wells[id].punctured).join(',');if(this.foilKey===key)return;this.foilKey=key;
      const c=this.foilCanvas,x=c.getContext('2d'),W=4.36,D=2.61,sx=c.width/W,sz=c.height/D,px=v=>(v+W/2)*sx,pz=v=>(v+D/2)*sz;
      x.clearRect(0,0,c.width,c.height);x.fillStyle='#f3f4f2';x.fillRect(0,0,c.width,c.height);
      x.strokeStyle='#d4d8d8';x.lineWidth=2;for(let col=1;col<8;col++){const lx=px((colX(col-1)+colX(col))/2);x.beginPath();x.moveTo(lx,pz(-.85));x.lineTo(lx,pz(1.0));x.stroke();}
      x.textAlign='center';x.textBaseline='middle';
      x.fillStyle='#39465a';x.font=PLEX.replace('{px}',30);for(let col=0;col<8;col++)x.fillText(String(col+1),px(colX(col)),pz(-.9));
      for(let row=0;row<4;row++){x.font=PLEX.replace('{px}',34);x.fillText(this.rows[row],px(-1.93),pz(-.57+row*.43));
        for(let col=0;col<8;col++){x.font=PLEX.replace('{px}',26).replace('600','500');x.fillStyle='#4b5a70';x.fillText(this.rows[row],px(colX(col)),pz(-.57+row*.43));x.fillStyle='#39465a';}}
      x.save();x.translate(px(-2.08),pz(.2));x.rotate(-Math.PI/2);x.fillStyle='#3f6fb3';x.font=PLEX.replace('{px}',24);x.fillText('QuickStrip  ·  patient cDNA',0,0);x.restore();
      x.fillStyle='#8f9699';for(const id of key?key.split(','):[]){const row=this.rows.indexOf(id[0]),col=Number(id.slice(1))-1;x.beginPath();x.arc(px(colX(col)),pz(-.57+row*.43),.07*sx,0,Math.PI*2);x.fill();}
      x.globalCompositeOperation='destination-out';
      for(const id of key?key.split(','):[]){const row=this.rows.indexOf(id[0]),col=Number(id.slice(1))-1;x.beginPath();x.arc(px(colX(col)),pz(-.57+row*.43),.058*sx,0,Math.PI*2);x.fill();}
      x.globalCompositeOperation='source-over';this.r.texture(c,this.foil.mat.map);
    }
    drawPrint(p){
      const key=p.label+'|'+this.rows.join('');if(this.printKey===key)return;this.printKey=key;
      const c=this.printCanvas,x=c.getContext('2d'),sx=c.width/4.45,sz=c.height/2.7,px=v=>(v+2.225)*sx,pz=v=>(v+1.35)*sz;
      x.clearRect(0,0,c.width,c.height);x.textAlign='center';x.textBaseline='middle';x.fillStyle='#2b3438';x.strokeStyle='#3a4448';
      x.font=PLEX.replace('{px}',24).replace('600','500');for(let col=0;col<8;col++)x.fillText(String(col+1),px(colX(col)),pz(-.72));
      for(let row=0;row<4;row++){
        x.textAlign='left';x.font=PLEX.replace('{px}',21).replace('600','500');x.fillText(this.rows[row]+'  Patient '+(row+1),px(-2.12),pz(-.43+row*.43));x.textAlign='center';
        for(let col=0;col<8;col++){x.lineWidth=2.6;x.beginPath();x.arc(px(colX(col)),pz(-.43+row*.43),.142*sx,0,Math.PI*2);x.stroke();}
      }
      if(p.label){x.fillStyle='#1d2c52';x.font=HAND.replace('{px}',38);x.textAlign='right';x.fillText(p.label,px(2.05),pz(-1.1));}
      this.r.texture(c,this.print.mat.map);
    }
    sync(p,immediate=false){
      if(p.samplesSettled&&!this.settled)this.tapTime=.40;this.settled=p.samplesSettled;
      this.plate.rot[1]=p.orientation.plate?0:Math.PI;this.card.rot[1]=p.orientation.card?0:Math.PI;
      if(p.cardLocation!=='held')this.card.pos=[...({bench:this.cardHome,incubator:this.ovenCard,uv:this.uvCard}[p.cardLocation])];
      this.cardBlob.visible=p.cardLocation!=='held';
      this.drawFoil(p);this.drawPrint(p);
      this.goggles.visible=!p.ppe;this.uvGoggles.visible=!p.uvGoggles;
      this.microTip.visible=!!p.tip;
      const newTip=this.tipId!==p.tip?.id;this.tipId=p.tip?.id;
      this.tipFluid.set(p.tip?.volume||0,null,immediate||newTip);
      for(const [id,t] of Object.entries(this.tubes))t.fluid.set(p.reagents[id],null,immediate);
      for(const id of p.ids){
        const w=p.wells[id],v=this.wells[id];v.puncture.visible=w.punctured;v.fluid.set(w.volume+SAMPLE_VISUAL,null,immediate);
        const s=p.spots[id],visual=this.spots[id],color=p.result(id);
        visual.quantity.set(s.volume,immediate||!!p.timer||s.volume===0);this.wetLevel(visual);
        // Fluorescence exists only where the lamp excites it; there are no printed answers on the spots.
        visual.disk.mat.color=rgb(color==='black'?'#454c54':color?'#b9b5ab':'#f5f2e9');
        visual.disk.mat.fluor=color?FLUOR[color]:PAPER_FLUOR;
        visual.halo.visible=!!color&&color!=='black';if(color)visual.halo.mat.color=FLUOR[color].map(v=>v*.22);visual.halo.mat.emission=1;
      }
      this.tipMeshes.forEach((mesh,i)=>mesh.visible=i>=p.tipCount);
      const n=Math.min(95,p.tipCount);this.tipTarget.offset=[(n%12-5.5)*.133,.42,(Math.floor(n/12)-3.5)*.115];this.tipMark.pos=[...this.tipTarget.offset];this.tipMark.visible=p.tipCount<96;
      this.uvTarget=p.uv&&p.cardLocation==='uv'?1:0;if(immediate)this.uvLevel=this.uvTarget;
      Object.assign(this.lampWindow.mat,p.uv?{color:rgb('#8e6cff'),pattern:5,emission:3.2}:{color:rgb('#3a3550'),pattern:0,emission:0});
      this.uvDisplay.options.ink=p.uv?'#c6b5ff':'#9aa3a8';this.retext(this.uvDisplay,p.uv?'UV ON':'LAMP OFF');
      const ovenTimer=p.timer?.mode==='incubator'?p.timer:null,sec=Math.ceil(ovenTimer?.remaining||0);this.retext(this.ovenDisplay,ovenTimer?String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0'):'37.0 °C');
      this.r.root.update();if(this.beaconTarget)this.setBeacon(this.beaconTarget);this.applyLight();this.r.dirtyShadow=true;
    }
    applyLight(){
      const l=this.r.light,q=M.point(this.lampWindow.world,[0,0,0]);l.uvPos=q;l.uvAxis=V.sub(M.point(this.lampWindow.world,[.93,0,0]),q);
      l.uvDir=V.norm(V.sub(M.point(this.uvArea.world,[0,.1,.15]),q));l.uv=this.uvLevel;
      this.windowGlow.mat.emission=1.9*(1-.92*this.uvLevel);
    }
    wetLevel(v){const f=Math.min(1,v.quantity.value/5);v.wet.visible=f>.0001;v.wet.scale=[Math.sqrt(f),Math.max(.02,f),Math.sqrt(f)];v.wet.mat.opacity=.38+.47*f;} // wet paper is only faintly darker in reality; the mark is strengthened so treated spots read clearly
    animate(dt,p){
      let changed=false;
      if(this.uvLevel!==this.uvTarget){const step=dt/.8;this.uvLevel=this.uvTarget>this.uvLevel?Math.min(this.uvTarget,this.uvLevel+step):Math.max(this.uvTarget,this.uvLevel-step);this.applyLight();changed=true;}
      if(p.status!=='running')return changed;
      changed=this.tipFluid.advance(dt)||changed;
      const goal=this.pipetteGoal,pos=this.pipette.pos;
      if(goal&&Math.hypot(goal[0]-pos[0],goal[1]-pos[1],goal[2]-pos[2])>1e-4){const k=1-Math.exp(-dt/EASE_S);this.pipette.pos=pos.map((v,i)=>v+(goal[i]-v)*k);changed=true;this.r.dirtyShadow=true;}
      if(this.tapTime>0){this.tapTime=Math.max(0,this.tapTime-dt);this.plate.pos[1]=.02+.07*Math.abs(Math.sin((.40-this.tapTime)/.40*Math.PI*2))*(this.tapTime/.40);changed=true;this.r.dirtyShadow=true;}
      for(const t of Object.values(this.tubes))changed=t.fluid.advance(dt)||changed;
      for(const w of Object.values(this.wells))changed=w.fluid.advance(dt)||changed;
      for(const v of Object.values(this.spots))if(v.quantity.advance(dt)){this.wetLevel(v);changed=true;}
      return changed;
    }
    setBeacon(t){
      this.beaconTarget=t||null;this.beacon.visible=!!t;if(!t)return;
      this.r.root.update();this.beacon.pos=this.position(t);this.beacon.pos[1]+=.03;
      const size=['station','card'].includes(t.kind)?3.1:t.kind==='waste'?2.1:t.kind==='plate'?1.4:t.kind==='reagent'?1.1:1;this.beacon.scale=[size,1,size];
    }
    // A locked target gets a gold ring; a merely hovered one keeps the teal ring.
    focusTarget(t,locked=false){this.focus.visible=!!t;if(t){this.r.root.update();this.focus.pos=this.position(t);this.focus.pos[1]+=.023;const size=['station','card'].includes(t.kind)?3.3:t.kind==='stand'?2.6:locked?1.2:1;this.focusRing.scale=[size,1,size];this.focusRing.mat.color=rgb(locked?'#f2b134':'#5fd0bd');}}
    park(tool){if(tool==='pipette'){this.pipette.pos=[...this.pipetteHome];this.pipette.rot=[0,0,0];this.plunger.pos[1]=2.34;this.pipetteGoal=null;}this.r.dirtyShadow=true;}
    pose(c,f,p){
      if(c.tool==='view')return;const xy=f||c.lastFrame;
      if(c.tool==='card'){
        const t=c.contact?.target||c.target;if(!xy&&!t)return;this.r.root.update();const point=t?this.position(t):this.r.onPlane(xy.x,xy.y,.7);
        if(point&&p.cardLocation==='held'){this.card.pos=[Math.max(-5,Math.min(5,point[0])),.9,Math.max(-3.2,Math.min(3,point[2]))];this.card.rot[1]=0;}return;
      }
      // The tip follows the aim continuously instead of jumping between hovered targets; only a lock centres it.
      const t=c.contact?.target||null,hover=c.target;if(!xy&&!t)return;this.r.root.update();
      let point=t?this.position(t):this.r.onPlane(xy.x,xy.y,hover?this.position(hover)[1]:AIM_Y);
      if(!point&&hover)point=this.position(hover);if(!point)return;
      point=[Math.max(-7,Math.min(7,point[0])),point[1],Math.max(-4.3,Math.min(4.5,point[2]))];
      const depth=c.contact?.depth||0,low=[...point];
      if(t?.kind==='reagent'){const v=this.tubes[t.id];low[1]=M.point(v.g.world,[0,Math.max(.05,v.fluid.height-.04),0])[1];}
      if(t?.kind==='well'){const v=this.wells[t.sample];low[1]=M.point(v.cup.world,[0,.065,0])[1];}
      if(t?.kind==='spot')low[1]+=.018; // surface contact is schematic; no physical wetting model
      const high=[...point];high[1]+=HOVER;
      const tip=t?V.lerp(high,low,Math.min(1,depth/.85)):high;if(!p.tip)tip[1]-=.54;
      if(xy)this.poseSource=xy.source;const hand=this.poseSource==='hand',pos=this.pipette.pos;
      // Hand poses ease across jumps (lock, target height change, fast sweep) and track small corrections directly.
      this.pipetteGoal=tip;if(!hand||Math.hypot(tip[0]-pos[0],tip[1]-pos[1],tip[2]-pos[2])<=EASE_SNAP)this.pipette.pos=[...tip];
      this.pipette.rot=[0,0,0];
      const plunger=hand&&Number.isFinite(xy?.thumbDepth)?Math.max(0,Math.min(1,xy.thumbDepth)):c.pressed?1:0;this.plunger.pos[1]=2.34-plunger*.1;this.r.dirtyShadow=true;
    }
  }
  root.MicroarrayScene=Scene;
})(globalThis);
