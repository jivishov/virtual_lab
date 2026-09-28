/* ELISA classroom apparatus in arbitrary Y-up scene units, restyled after the DNA microarray 3D lab (v3): the same
   room, slate resin bench, materials and apparatus language (coral tube rack with snap caps, blue tip box, kraft waste
   carton, micropipette on a stand). Reference-informed geometry, not measured manufacturer CAD. Liquids are near-clear
   with a faint cool tint so the level reads against clear plastic; the blue end point is the only strong colour. */
(function(root){
  'use strict';
  let G,M,V,rgb,Vessel,QuantityTween;
  /* The tool tip hovers straight above its aim point: the well openings when nothing is hovered, or the hovered target's height. */
  const AIM_Y=.44,HOVER=.32,EASE_S=.05,EASE_SNAP=.05;
  const PLEX='600 {px}px Plex, "IBM Plex Sans", Arial, sans-serif',HAND='{px}px "Segoe Print","Bradley Hand","Comic Sans MS",cursive';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  // Snap-cap colours identify each aliquot (with its written label); liquids stay near-clear.
  const CAPS={DIL:'#d785a3',AG:'#e0b84a',POS:'#c4545e',NEG:'#8a98a3',P1:'#3f8f86',AB1:'#6f9d64',AB2:'#d58e45',TMB:'#4f7fb5',STOP:'#8f6c4f',P2:'#8a6fb0'};
  const TINT={DIL:'#d6e6ec',AG:'#ece2b8',POS:'#e4ecee',NEG:'#e8eeea',P1:'#dce8ee',AB1:'#dfeada',AB2:'#eee1cf',TMB:'#cfe0ee',STOP:'#e8e2d8',P2:'#e2eaf0'};
  const ORDER=['DIL','AG','POS','NEG','P1','AB1','AB2','TMB','STOP','P2'];
  class Scene {
    constructor(r,p){
      ({G,M,V,rgb}=root.E3D);({Vessel,QuantityTween}=root.ClassroomLiquid);
      this.r=r;this.targets=[];this.wells=[];this.tubes={};this.strips=[];this.tipMeshes=[];this.regions={};this.strokePaths={};this.goal=null;
      this.build();if(p)this.sync(p,true);
    }
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
    target(id,label,group,offset,radius,kind){const t={id,label,group,offset,radius,kind};this.targets.push(t);return t;}
    position(t){return M.point(t.group.world,t.offset);}
    build(){
      const r=this.r,REAGENTS=root.ELISAProtocol.REAGENTS;
      const m={
        wall:this.mat('#dcd3c2',{rough:.92}),trim:this.mat('#e7e4dd',{rough:.5}),bench:this.mat('#5e6a71',{rough:.5,pattern:1}),edge:this.mat('#a47a50',{rough:.55,pattern:8}),
        pp:this.mat('#ecede8',{rough:.42,pattern:8}),dark:this.mat('#2d3134',{rough:.5,pattern:8}),
        steel:this.mat('#c3c8ca',{rough:.3,metal:.85,pattern:7}),clear:this.mat('#eef3f2',{glass:1,rough:.1,opacity:.07,thickness:.3}),
        tube:this.mat('#e9ede8',{rough:.24,opacity:.55,pattern:8}) /* translucent polypropylene, visible from any angle */,
        well:this.mat('#e6ebe8',{rough:.2,opacity:.42,pattern:8}),paper:this.mat('#f5f2e9',{rough:.9,pattern:2}),kraft:this.mat('#b98c5d',{rough:.82,pattern:8}),tape:this.mat('#e6dfcc',{rough:.8})
      };
      this.m=m;
      // Room and bench, as in the microarray lab.
      this.box(15,.22,10,m.bench,[0,-.13,0]);this.box(15,.08,.14,m.edge,[0,-.06,4.97]);
      const cab=this.mat('#c9c3b6',{rough:.6,pattern:8});this.box(15,3.2,.1,cab,[0,-1.72,4.9]);
      for(let x=-7.5+1.875;x<7.5;x+=3.75)this.box(.03,3.0,.03,this.mat('#9f998d',{rough:.6}),[x,-1.72,4.96]);
      for(let x=-7.5+.94;x<7.5;x+=1.875)this.box(.36,.05,.06,m.steel,[x,-.55,4.99]);
      this.box(15,4.4,.13,m.wall,[0,2.0,-4.6]);this.box(15,.14,.2,m.trim,[0,.05,-4.47]);
      this.windowGlow=this.box(4.6,2.1,.02,this.mat('#e3ecef',{pattern:5,emission:1.9}),[-4.1,2.25,-4.52]);
      for(const x of [-6.4,-4.1,-1.8])this.box(.07,2.2,.05,m.trim,[x,2.25,-4.48]);
      for(const y of [1.2,2.25,3.3])this.box(4.7,.07,.05,m.trim,[-4.1,y,-4.48]);
      this.box(4.9,.06,.28,m.trim,[-4.1,1.17,-4.4]);
      this.text('IMMUNOLOGY · TEACHING LAB',3.2,.22,[3.1,3.45,-4.52],r.root,{ink:'#5a6661'});
      const shelf=r.group().set(3.1,2.45,-4.33);this.box(3.8,.07,.42,this.mat('#b08a60',{rough:.6,pattern:8}),[0,0,0],shelf);
      for(const [x,glass,cap,h,label] of [[-1.35,'#a8662c','#2f3437',.62,'PBS'],[-.7,'#f2f4f1','#3f6fb3',.5,'H₂O'],[-.05,'#e9ebe4','#e9ebe4',.7,''],[.6,'#a8662c','#2f3437',.48,'70%'],[1.25,'#f2f4f1','#4f7fb5',.56,'TMB']]){
        const g=r.group(shelf).set(x,.03,0);
        r.mesh(G.lathe([[.001,0],[.14,0],[.15,.02],[.15,h*.72],[.07,h*.9],[.06,h]],28),glass==='#e9ebe4'?this.mat(glass,{rough:.45,pattern:8}):this.mat(glass,{glass:1,rough:.14,opacity:.55,thickness:.25}),g);
        this.cyl(.068,.08,this.mat(cap,{rough:.4}),[0,h,0],g);if(label)this.text(label,.2,.1,[0,h*.38,.152],g,{bg:'#f4f1e6',ink:'#2a3438'});
      }
      const sign=this.canvas(512,340),sx=sign.getContext('2d');sx.fillStyle='#f6f4ee';sx.fillRect(0,0,512,340);sx.strokeStyle='#197b7b';sx.lineWidth=18;sx.strokeRect(9,9,494,322);
      sx.fillStyle='#145f5f';sx.font=PLEX.replace('{px}',58);sx.textAlign='center';sx.fillText('PPE REQUIRED',256,128);sx.font=PLEX.replace('{px}',34).replace('600','500');sx.fillStyle='#34393c';sx.fillText('Gloves · goggles · lab coat',256,205);sx.fillText('No food or drink',256,255);
      this.decal(1.1,.73,sign,[.35,2.3,-4.52],r.root);

      // Clipboard with the printed protocol, the kit box and the wash-buffer stock bottle, behind the work area.
      const clip=r.group().set(.3,.02,-2.95);clip.rot[1]=.1;
      this.box(1.25,.02,1.7,this.mat('#8f6d4a',{rough:.7}),[0,.01,0],clip);
      const sheet=this.canvas(360,480),sc=sheet.getContext('2d');sc.fillStyle='#f7f5ee';sc.fillRect(0,0,360,480);sc.fillStyle='#39434a';sc.font=PLEX.replace('{px}',22);sc.fillText('Quantitative ELISA',24,48);
      sc.fillStyle='#8f989c';for(let i=0;i<14;i++)sc.fillRect(24,80+i*26,i%4===3?190:300,5);
      this.decal(1.08,1.44,sheet,[0,.022,.06],clip,{flat:true,rough:.85});this.box(.5,.05,.12,m.steel,[0,.045,-.78],clip);
      const kit=r.group().set(-3.4,.01,-2.85);kit.rot[1]=-.08;
      this.box(2.2,.62,1.35,m.kraft,[0,.31,0],kit);this.box(2.24,.05,1.39,this.mat('#c79a68',{rough:.8,pattern:8}),[0,.645,0],kit);
      this.text('EDVOTEK · QUANTITATIVE ELISA',1.7,.16,[0,.4,.68],kit,{bg:'#f1ece0',ink:'#2b3438'});this.blob(2.7,1.8,[0,.003,0],kit,.4);
      const stock=r.group().set(3.35,.02,-2.7);
      r.mesh(G.lathe([[.001,0],[.3,0],[.32,.03],[.32,.9],[.16,1.12],[.13,1.25]],32),this.mat('#eef3f2',{glass:1,rough:.12,opacity:.2,thickness:.3}),stock);
      const stockFluid=new Vessel(r,stock,[[.28,.03],[.3,.8]],1,'#cfe3e8');stockFluid.set(.7,null,true);this.cyl(.14,.12,this.mat('#3f6fb3',{rough:.4}),[0,1.25,0],stock);
      this.text('1× PBST\nwash buffer',.46,.26,[0,.5,.325],stock,{bg:'#f4f1e6',ink:'#26343a'});this.blob(.9,.9,[0,.003,0],stock,.4);

      // PPE on the bench, as in the microarray lab.
      const gloves=r.group().set(-5.35,.01,-.95);
      this.box(1.3,.48,.72,this.mat('#4b7cc2',{rough:.55,pattern:8}),[0,.24,0],gloves);
      this.text('NITRILE GLOVES · M',1.1,.16,[0,.3,.365],gloves,{ink:'#f4f6fa'});
      const cuff=this.box(.42,.05,.3,this.mat('#7384d8',{rough:.6}),[0,.5,0],gloves);cuff.rot=[.25,.2,.1];
      this.blob(1.7,1.1,[0,.003,0],gloves,.4);
      this.makeGoggles('#3b6790','#e8eff2',.3).set(-5.3,.02,.35);

      // Reagent rack: ten prepared aliquots in snap-top tubes (1.5 mL assumed), identified by cap colour and label.
      const rack=r.group().set(-3.3,.02,-.75);this.rack=rack;
      this.box(2.55,.36,1.05,this.mat('#d6835e',{rough:.5,pattern:8}),[0,.18,0],rack);
      this.text('PREPARED ALIQUOTS',1.7,.13,[0,.2,.528],rack,{ink:'#5b2f1d'});
      for(let i=0;i<ORDER.length;i++){
        const id=ORDER[i],conf=REAGENTS[id],g=r.group(rack).set((i%5-2)*.47,.12,i<5?-.26:.26);
        this.ring(.105,.016,this.mat('#a85f41',{rough:.6}),[0,.245,0],g);
        r.mesh(G.lathe([[.004,0],[.02,.02],[.075,.18],[.085,.58],[.097,.6],[.097,.625],[.086,.625]],32),m.tube,g);
        const fluid=new Vessel(r,g,[[.006,.022],[.066,.175],[.077,.57]],1500,TINT[id]);fluid.mesh.mat.opacity=.58;fluid.mesh.mat.rough=.05;
        const hinge=r.group(g).set(0,.625,-.097);hinge.rot[0]=-2.55; // snap cap flipped open behind the tube
        const capMat=this.mat(CAPS[id],{rough:.34,pattern:8});
        this.cyl(.1,.055,capMat,[0,0,.097],hinge);this.cyl(.078,.05,capMat,[0,-.05,.097],hinge);
        this.box(.04,.012,.05,capMat,[0,.622,-.105],g);
        const tag=this.text(conf.short,.17,.11,[0,.45,.088],g,{bg:'#f7f5ee',hand:true,ink:'#1d2a3a',rough:.8});
        this.tubes[id]={g,fluid,liquid:fluid.mesh,tag};
        this.target(id,conf.name,g,[0,.63,0],.21,'reagent');
      }
      this.blob(3.0,1.5,[0,.003,0],rack,.4);
      this.region('rack',rack,[-1.28,0,-.53],[1.28,.76,.53]);

      // Strips on a paper sheet: two linked 12-well strips with open wells. 300 µL is the domain-model limit.
      this.sheet=r.group().set(0,0,1.10);const sheetNode=this.sheet;
      this.box(4.9,.016,2.35,m.paper,[0,.012,0],sheetNode,.004);this.blob(5.3,2.7,[0,.004,0],sheetNode,.28);
      for(let s=0;s<2;s++){
        const strip=r.group(sheetNode).set(0,.026,-.53+s*1.05);strip.home=[...strip.pos];strip.homeParent=sheetNode;this.strips.push(strip);
        this.target('strip'+(s+1),'Strip '+(s+1)+' grip tab',strip,[-2.19,.34,0],.18,'strip');
        this.target('home'+(s+1),'Strip '+(s+1)+' place on the sheet',sheetNode,[0,.045,-.53+s*1.05],.30,'home');
        this.box(.32,.035,.20,m.well,[-2.13,.34,0],strip);
        for(let i=0;i<12;i++){
          const id=s*12+i+1,g=r.group(strip).set((i-5.5)*.345,0,0);
          r.mesh(G.lathe([[0,.022],[.085,.022],[.11,.065],[.143,.36],[.146,.405],[.126,.405],[.121,.37],[.097,.085],[.063,.052],[0,.052]],40),m.well,g);
          this.ring(.137,.009,this.mat('#e8eeec',{rough:.2,opacity:.5,pattern:8}),[0,.405,0],g);
          if(i<11)this.box(.075,.035,.08,m.well,[.172,.36,0],g);
          const fluid=new Vessel(r,g,[[.03,.056],[.063,.058],[.097,.088],[.118,.36]],300,'#cfe0e6');fluid.mesh.mat.opacity=.52;fluid.mesh.mat.rough=.06;
          const label=this.text(String(id),.23,.15,[0,.24,.146],g,{bg:'#eeeee3',ink:'#253d46'});label.visible=false;
          const under=this.flat(String(id),.25,.16,[(i-5.5)*.345,.025,.28],strip,{ink:'#3b4549'});under.visible=false;
          this.wells.push({id,g,fluid,liquid:fluid.mesh,label,under});
          this.target(id,'Well '+id,g,[0,.415,0],.158,'well');this.target('label'+id,'Label pad '+id,g,[0,.24,.155],.16,'label');
        }
      }
      this.flat('STANDARD CURVE  ·  1:2 SERIES',2.6,.16,[0,.03,-1.03],sheetNode,{ink:'#3b4549'});this.flat('CONTROLS  /  PATIENT SAMPLES',2.8,.16,[0,.03,.02],sheetNode,{ink:'#3b4549'});
      this.patientLabels=['+ CONTROL','− CONTROL','PATIENT 1','PATIENT 2'].map((txt,i)=>this.flat(txt,.95,.13,[(i-1.5)*1.035,.03,1.0],sheetNode,{ink:'#2b3a55',hand:true}));
      this.region('strips',sheetNode,[-2.45,0,-1.18],[2.45,.45,1.18]);

      // Tip rack with a clear blue lid and natural tips.
      this.tipbox=r.group().set(0,.02,-.95);
      this.box(1.8,.3,1.08,this.mat('#3d608d',{rough:.42,pattern:8}),[0,.15,0],this.tipbox);
      this.box(1.84,.03,1.1,m.pp,[0,.315,0],this.tipbox);
      const lid=r.group(this.tipbox).set(0,.33,-.55);lid.rot[0]=1.35;this.box(1.84,.025,1.09,this.mat('#a9c6ea',{glass:1,rough:.15,opacity:.35,thickness:.2}),[0,0,-.55],lid);
      const tipMat=this.mat('#ecdc8e',{rough:.28,opacity:.86,pattern:8}); // yellow 200 µL tips, as used on a P200
      for(let i=0;i<96;i++)this.tipMeshes.push(r.mesh(G.lathe([[.008,0],[.038,.18],[.043,.23],[.027,.23],[.020,.17],[.008,0]],10),tipMat,this.tipbox).set((i%12-5.5)*.133,.18,(Math.floor(i/12)-3.5)*.115));
      this.tipMark=this.ring(.061,.010,this.mat('#5fd0bd',{pattern:5,emission:1.6}),[0,.419,0],this.tipbox);
      this.tipTarget=this.target('tips','Next unused pipette tip',this.tipbox,[-.7315,.42,-.4025],.26,'tips');
      this.text('200 µL TIPS',.8,.12,[0,.15,.545],this.tipbox,{ink:'#eef3f8'});
      this.blob(2.2,1.5,[0,.003,0],this.tipbox,.4);
      this.region('tips',this.tipbox,[-.9,0,-.54],[.9,.45,.54]);

      // Tip and liquid waste: kraft carton labelled with marker on tape.
      const waste=r.group().set(-3.55,.01,1.35);
      this.box(1.4,.06,1.2,m.kraft,[0,.03,0],waste);
      for(const x of [-.68,.68])this.box(.035,.62,1.2,m.kraft,[x,.31,0],waste);
      for(const z of [-.58,.58])this.box(1.4,.62,.035,m.kraft,[0,.31,z],waste);
      this.text('TIP + LIQUID\nWASTE',1.0,.32,[0,.38,.6],waste,{bg:'#ece7d6',hand:true,ink:'#2b2622'});
      this.target('waste','Tip and liquid waste',waste,[0,.68,0],.52,'waste');
      this.blob(1.8,1.6,[0,.003,0],waste,.45);
      this.region('waste',waste,[-.7,0,-.6],[.7,.64,.6]);

      // 100 mL beaker of 1× PBST wash buffer, open glass with volume marks.
      this.beaker=r.group().set(3.2,.005,-.85);
      r.mesh(G.lathe([[0,.03],[.43,.03],[.53,.08],[.565,1.30],[.585,1.35],[.55,1.36],[.535,1.29],[.501,.12],[0,.105]],56),m.clear,this.beaker);
      this.ring(.565,.016,m.clear,[0,1.35,0],this.beaker);
      this.beakerFluid=new Vessel(r,this.beaker,[[.49,.108],[.53,1.28]],114700,'#b7d6de') /* capacity to 1.28 so that 100 mL reaches the 100 mark */;this.beakerFluid.mesh.mat.opacity=.5;this.beakerFluid.mesh.mat.rough=.05;
      for(let i=1;i<=5;i++){this.box(.14,.008,.008,this.mat('#3a4448',{rough:.6}),[.2,.13+i*.2,.566],this.beaker);this.text(String(i*20),.16,.08,[.37,.13+i*.2,.555],this.beaker,{ink:'#3a4448'});}
      this.text('100 mL',.42,.13,[-.2,1.0,.566],this.beaker,{ink:'#3a4448'});
      this.text('WASH BUFFER\n1× PBST',.5,.24,[-.17,.3,.57],this.beaker,{bg:'#ece7d6',hand:true,ink:'#1d2a3a'});
      this.target('WASH','Wash buffer · 100 mL beaker',this.beaker,[0,1.36,0],.5,'wash');
      this.blob(1.5,1.5,[0,.003,0],this.beaker,.35);
      this.region('beaker',this.beaker,[-.6,0,-.6],[.6,1.4,.6]);

      // Transfer pipette for wash buffer, standing in a small holder beside the beaker.
      const holder=r.group().set(4.35,.02,-.85);
      this.box(.46,.14,.46,m.dark,[0,.07,0],holder);this.cyl(.07,.36,this.mat('#dfe3e0',{rough:.35,pattern:8}),[0,.14,0],holder);
      this.washTool=r.group().set(4.35,.12,-.85);this.washHome=[...this.washTool.pos];
      this.cyl(.027,1.26,this.mat('#eef2f1',{rough:.12,opacity:.45,pattern:8}),[0,0,0],this.washTool,.018);
      this.bulb=r.group(this.washTool).set(0,1.22,0);
      r.mesh(G.lathe([[.027,0],[.12,.12],[.17,.35],[.145,.62],[.05,.78],[0,.8]],36),this.mat('#e8ecea',{rough:.28,opacity:.6,pattern:8}),this.bulb);
      this.washLiquid=this.cyl(.02,1.0,this.mat('#a9ccd6',{rough:.1,opacity:.7}),[0,.12,0],this.washTool);this.washLiquid.noShadow=true;
      this.target('washtool','Transfer pipette',this.washTool,[0,1.3,0],.24,'tool');
      this.target('stand:wash','Transfer-pipette holder',r.root,[4.35,.1,-.85],.34,'stand');
      this.blob(.8,.8,[0,.003,0],holder,.4);
      this.region('washTool',holder,[-.3,0,-.3],[.3,2.2,.3]);

      // Paper towels for draining and tapping the strips.
      this.towels=r.group().set(4.95,0,1.8);
      for(let i=0;i<4;i++)this.box(4.4,.018,1.5,m.paper,[i*.015,.02+i*.018,0],this.towels,.004);
      this.text('DRAIN / TAP',.9,.16,[1.6,.1,.58],this.towels,{flat:true,hand:true,ink:'#2b3a55',bg:'#e6dfcc'});
      this.target('towels','Paper towels',this.towels,[0,.1,0],1.0,'towels');
      this.blob(4.9,2.0,[0,.003,0],this.towels,.25);
      this.region('towels',this.towels,[-2.2,0,-.78],[2.2,.3,.78]);

      // Digital incubation timer with a lit display.
      const timer=r.group().set(1.75,0,-1.0);this.timerGroup=timer;
      this.box(.95,.3,.72,this.mat('#30353a',{rough:.45,pattern:8}),[0,.17,0],timer);
      this.timerText=this.text('05:00',.72,.24,[0,.33,.26],timer,{bg:'#141718',ink:'#ffb545',pattern:5,emission:1.6});this.timerText.rot=[-.65,0,0];
      this.text('TIMER',.4,.09,[0,.12,.365],timer,{ink:'#d9dcdc'});
      this.target('timer','Incubation timer',timer,[0,.36,0],.37,'timer');
      this.blob(1.2,1,[0,.003,0],timer,.4);
      this.region('timer',timer,[-.5,0,-.4],[.5,.4,.4]);

      // Fine-tip marker in a tray in front of the sheet.
      const tray=r.group().set(-1.05,.01,2.95);
      this.box(1.7,.04,.34,this.mat('#d9dbd5',{rough:.5,pattern:8}),[0,.02,0],tray);
      this.marker=r.group().set(-1.6,.1,2.95);this.marker.rot=[0,0,-Math.PI/2];this.markerHome={pos:[...this.marker.pos],rot:[...this.marker.rot]};
      this.cyl(.012,.09,this.mat('#253d46',{rough:.4}),[0,0,0],this.marker,.035);this.cyl(.035,.17,m.steel,[0,.09,0],this.marker,.068);
      this.cyl(.068,1.05,this.mat('#f3f5f1',{rough:.3}),[0,.26,0],this.marker);this.cyl(.072,.2,this.mat('#253d46',{rough:.4}),[0,1.31,0],this.marker);
      this.text('FINE',.12,.4,[0,.8,.071],this.marker,{ink:'#253d46'});
      this.target('markertool','Fine-tip marker',this.marker,[0,.83,0],.22,'tool');
      this.target('stand:marker','Marker tray',r.root,[-1.05,.05,2.95],.4,'stand');
      this.blob(2,.6,[0,.003,0],tray,.35);
      this.region('marker',tray,[-.9,0,-.25],[.9,.2,.25]);

      // Single-channel micropipette on its stand, showing the fixed 50 µL setting.
      this.box(.79,.10,.83,m.dark,[5.47,.05,.16]);this.box(.05,2.10,.06,m.steel,[5.68,1.10,-.04]);this.box(.50,.07,.27,m.dark,[5.49,2.16,.03]);
      this.pipette=r.group().set(5.48,.16,.31);this.pipetteHome=[...this.pipette.pos];
      this.microTip=r.group(this.pipette);
      r.mesh(G.lathe([[.008,0],[.022,.18],[.057,.55],[.040,.55],[.016,.18],[.005,.013],[.008,0]],28),this.mat('#ecdc8e',{rough:.26,opacity:.78,pattern:8}),this.microTip);
      this.tipFluid=new Vessel(r,this.microTip,[[.005,.013],[.016,.18],[.035,.45]],90,'#b9cfd8');this.tipFluid.mesh.mat.opacity=.9;this.tipFluid.mesh.mat.rough=.05;
      const body=this.mat('#eceeeb',{rough:.34,pattern:8});
      this.cyl(.038,.57,body,[0,.54,0],this.pipette);
      r.mesh(G.lathe([[.05,1.08],[.092,1.2],[.11,1.68],[.165,1.89],[.145,2.08],[.08,2.20],[0,2.20]],40),body,this.pipette);
      this.text('0 5 0',.19,.23,[0,1.65,.123],this.pipette,{bg:'#20262a',ink:'#e9eef0'});this.text('50 µL',.15,.13,[0,1.37,.113],this.pipette,{ink:'#3b4549'});
      this.cyl(.045,.15,this.mat('#9aa3a8',{rough:.4}),[0,2.19,0],this.pipette);this.plunger=this.cyl(.117,.066,this.mat('#5a7fa6',{rough:.35}),[0,2.34,0],this.pipette);
      this.box(.025,.80,.035,this.mat('#9aa3a8',{rough:.4}),[-.11,1.46,.015],this.pipette);this.cyl(.067,.06,this.mat('#9aa3a8',{rough:.4}),[-.13,1.91,.015],this.pipette);
      this.box(.12,.065,.21,body,[0,2.04,-.18],this.pipette);
      this.target('microtool','Micropipette · 50 µL',this.pipette,[0,1.69,0],.24,'tool');
      this.target('stand:micro','Micropipette stand',r.root,[5.48,.10,.25],.45,'stand');
      this.region('stand',this.pipette,[-.4,0,-.4],[.4,2.3,.4]);

      this.focus=r.group();this.focusRing=this.ring(.17,.012,this.mat('#5fd0bd',{pattern:5,emission:1.8}),[0,0,0],this.focus);this.focus.visible=false;this.focusRing.noShadow=true;
      // Next-target beacon: a soft double ring that guides without covering anything.
      this.beacon=r.group();for(const [rad,t] of [[.2,.008],[.26,.005]]){const ring=this.ring(rad,t,this.mat('#a4ecdc',{pattern:5,emission:1.25}),[0,0,0],this.beacon);ring.noShadow=true;}this.beacon.visible=false;
      r.root.update();r.dirtyShadow=true;
    }
    makeGoggles(frame,lens,opacity){
      const g=this.r.group(),fm=this.mat(frame,{rough:.45}),lm=this.mat(lens,{glass:1,rough:.1,opacity,thickness:.3});
      for(const x of [-.17,.17]){const l=this.r.mesh(G.sphere(.16,24,12),lm,g).set(x,.12,0);l.scale=[1,.62,.55];this.ring(.15,.018,fm,[x,.12,0],g).rot[0]=Math.PI/2;}
      this.box(.12,.04,.05,fm,[0,.14,0],g);const band=this.ring(.42,.014,fm,[0,.06,-.18],g);band.scale=[1,.2,.7];
      this.blob(.95,.6,[0,.003,0],g,.35);return g;
    }
    sync(p,immediate=false){
      const REAGENTS=root.ELISAProtocol.REAGENTS;
      this.microTip.visible=!!p.tip;const newTip=this.tipKey!==p.tipCount;this.tipKey=p.tipCount;this.tipFluid.set(p.tip?.volume||0,null,immediate||newTip);
      this.washLiquid.visible=p.washVolume>0;this.washLiquid.scale[1]=Math.max(.001,p.washVolume/1320);
      this.beakerFluid.set(p.reagents.WASH.volume,null,immediate);
      for(const [id,t] of Object.entries(this.tubes)){t.fluid.set(Math.max(0,p.reagents[id].volume),null,immediate);if(id==='P1'||id==='P2')this.retext(t.tag,p.reagents[id].short);}
      for(const w of p.wells){
        const v=this.wells[w.id-1],s=p.wellSignal(w.id),q=Math.pow(s,.42);v.fluid.set(Math.min(300,w.volume),null,immediate);
        // Clear liquid gets a faint cool tint; developed wells turn blue with the illustrative signal.
        v.liquid.mat.color=(s>0?[.70*(1-q)+.03*q,.84*(1-q)+.34*q,.87*(1-q)+.58*q]:[.78,.86,.88]).map(c=>Math.pow(c,2.2));
        v.liquid.mat.opacity=s>0?.52+.4*q:.52;v.label.visible=v.under.visible=p.labels.includes(w.id);
      }
      this.tipMeshes.forEach((mesh,i)=>mesh.visible=i>=p.tipCount);
      const n=Math.min(95,p.tipCount);this.tipTarget.offset=[(n%12-5.5)*.133,.42,(Math.floor(n/12)-3.5)*.115];this.tipMark.pos=[...this.tipTarget.offset];this.tipMark.visible=p.tipCount<96;
      const seconds=Math.ceil(p.timer?.remaining??(p.phase==='read'?0:300));this.retext(this.timerText,String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'));
      for(let i=0;i<2;i++)this.retext(this.patientLabels[i+2],p.patients[i].toUpperCase());
      this.r.root.update();if(this.beaconTarget)this.setBeacon(this.beaconTarget);this.r.dirtyShadow=true;
    }
    mark(id,path){
      const n=this.wells[id-1].label,c=n.canvas,ctx=c.getContext('2d');
      if(path.length>1){ctx.strokeStyle='#253d46';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();const start=path[0];path.forEach((pt,i)=>{const x=c.width*.12+(pt[0]-start[0])*3,y=c.height*.84+(pt[1]-start[1])*1.5;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();this.r.texture(c,n.mat.map);}
      this.strokePaths[id]=path;
    }
    animate(dt){
      let changed=this.tipFluid.advance(dt);changed=this.beakerFluid.advance(dt)||changed;
      const g=this.goal;
      if(g&&Math.hypot(g.pos[0]-g.node.pos[0],g.pos[1]-g.node.pos[1],g.pos[2]-g.node.pos[2])>1e-4){const k=1-Math.exp(-dt/EASE_S);g.node.pos=g.node.pos.map((v,i)=>v+(g.pos[i]-v)*k);changed=true;this.r.dirtyShadow=true;}
      for(const t of Object.values(this.tubes))changed=t.fluid.advance(dt)||changed;
      for(const w of this.wells)changed=w.fluid.advance(dt)||changed;
      return changed;
    }
    setBeacon(t){
      this.beaconTarget=t||null;this.beacon.visible=!!t;if(!t)return;
      this.r.root.update();this.beacon.pos=this.position(t);this.beacon.pos[1]+=.03;this.beacon.scale=Array(3).fill(this.ringSize(t)).map((v,i)=>i===1?1:v);
    }
    ringSize(t){return {well:1,label:1,reagent:1.1,tips:1,wash:2.9,towels:5.5,waste:2.9,timer:2,stand:2.2,home:1.6,tool:1.4,strip:1.1}[t.kind]||1.2;}
    // A locked target gets a larger gold ring; a merely hovered one keeps the teal ring.
    focusTarget(t,locked=false){this.focus.visible=!!t;if(t){this.r.root.update();this.focus.pos=this.position(t);this.focus.pos[1]+=.023;const size=this.ringSize(t)*(locked?1.2:1);this.focusRing.scale=[size,1,size];this.focusRing.mat.color=rgb(locked?'#f2b134':'#5fd0bd');}}
    toolNode(tool){return tool==='micro'?this.pipette:tool==='wash'?this.washTool:tool==='marker'?this.marker:tool?.startsWith('strip')?this.strips[+tool.slice(-1)-1]:null;}
    park(tool){
      if(tool==='micro'){this.pipette.pos=[...this.pipetteHome];this.pipette.rot=[0,0,0];this.plunger.pos[1]=2.34;}
      else if(tool==='wash'){this.washTool.pos=[...this.washHome];this.washTool.rot=[0,0,0];this.bulb.scale=[1,1,1];}
      else if(tool==='marker'){this.marker.pos=[...this.markerHome.pos];this.marker.rot=[...this.markerHome.rot];}
      else if(tool?.startsWith('strip')){const n=this.toolNode(tool);this.reparent(n,this.sheet);n.pos=[...n.home];n.rot=[0,0,0];this.pourState(tool,false);}
      this.goal=null;this.r.root.update();this.r.dirtyShadow=true;
    }
    pourState(tool,poured){const k=+tool.slice(-1)-1;for(const w of this.wells.slice(k*12,k*12+12)){w.fluid.poured=poured;w.fluid.mesh.visible=!poured&&w.fluid.quantity.value>.0001;}}
    reparent(n,parent){if(n.parent===parent)return;this.r.root.update();const local=M.point(M.inverse(parent.world),M.point(n.parent.world,n.pos));n.parent.children.splice(n.parent.children.indexOf(n),1);parent.add(n);n.pos=local;}
    // Place a tool at its goal; hand poses ease across jumps (lock, target height change, fast sweep) and track small corrections directly.
    place(n,goal,hand){this.goal={node:n,pos:goal};if(!hand||Math.hypot(goal[0]-n.pos[0],goal[1]-n.pos[1],goal[2]-n.pos[2])<=EASE_SNAP)n.pos=[...goal];}
    pose(c,f,p){
      const kind=c.tool;if(kind==='navigate'){this.goal=null;return;}
      const xy=f||c.lastFrame,locked=c.contact?.target||null,hover=c.target;if(!xy&&!locked&&!hover)return;this.r.root.update();
      // The tool follows the aim instead of jumping between hovered targets; only a lock centres it. The marker settles on a hovered label pad to write.
      const snap=locked||(kind==='marker'&&hover?.kind==='label'?hover:null);
      let point=snap?this.position(snap):xy?this.r.onPlane(xy.x,xy.y,hover?this.position(hover)[1]:AIM_Y):null;
      if(!point&&hover)point=this.position(hover);if(!point)return;
      point=[clamp(point[0],-6.8,6.8),point[1],clamp(point[2],-4.2,4.5)];
      if(xy)this.poseSource=xy.source;const hand=this.poseSource==='hand',depth=c.contact?.depth||0;
      if(kind.startsWith('strip')){
        const n=this.toolNode(kind);this.reparent(n,this.r.root);
        const towel=hover?.id==='towels',y=towel?(c.inverted?.85-depth*.36:.80-depth*.70):.65;
        this.place(n,[point[0],y,point[2]],hand);n.rot=[c.inverted?Math.PI:0,0,0];this.pourState(kind,c.inverted);this.r.dirtyShadow=true;return;
      }
      const high=[...point];high[1]+=HOVER;let tip=high;
      if(kind==='marker'){
        // The nib hovers just off the pad and touches it as the hand lowers (hand) or while the button is held (mouse); the stroke then follows the cursor.
        if(snap){tip=[...point];const touch=c.pointerHeld?1:locked?Math.min(1,depth/.5):0;tip[1]+=.06*(1-touch);if(touch>=1&&xy){const q=this.r.project(point);tip[0]+=clamp((xy.x-q.x)*.003,-.085,.085);if(!locked)tip[1]-=clamp((xy.y-q.y)*.002,-.055,.055);}}
      }else if(locked){
        const low=[...point];
        if(locked.kind==='well'){const v=this.wells[locked.id-1];low[1]=M.point(v.g.world,[0,Math.max(.07,v.fluid.height-.02),0])[1];}
        else if(locked.kind==='reagent'){const v=this.tubes[locked.id];low[1]=M.point(v.g.world,[0,Math.max(.05,v.fluid.height-.04),0])[1];}
        else if(locked.id==='WASH')low[1]=M.point(this.beaker.world,[0,Math.max(.12,this.beakerFluid.height-.05),0])[1];
        else if(locked.id==='tips')low[1]=point[1]-.02;
        tip=V.lerp(high,low,Math.min(1,depth/.85));
      }
      if(kind==='micro'&&!p.tip)tip[1]-=.54;
      const n=this.toolNode(kind);if(!n)return;
      this.place(n,tip,hand);n.rot=kind==='marker'?[0,0,-.26]:[0,0,0];
      const press=hand&&Number.isFinite(xy?.thumbDepth)?clamp(xy.thumbDepth,0,1):c.pressed?1:0;
      this.plunger.pos[1]=2.34-(kind==='micro'?press:0)*.1;const b=kind==='wash'?press:0;this.bulb.scale=[1-b*.2,1+b*.06,1-b*.2];this.r.dirtyShadow=true;
    }
  }
  root.ClassroomScene=Scene;
})(globalThis);
