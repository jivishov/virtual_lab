// Visual variants share the same apparatus, interaction geometry and acquisition state.
const finishes = {
  'Worktop': ['#47585a',.63,0,1],
  'Bench edge': ['#263c41',.46,.14,10],
  'Cabinet doors': ['#a0afaa',.49,.04,10],
  'Front enclosure': ['#cbd5d1',.34,.08,10],
  'Teal front fascia': ['#254b52',.48,.04,0],
  'Sample chamber lid': ['#28484e',.46,.05,0],
  'Anodised instrument trim': ['#a9c1c1',.33,.72,7],
  'Rack base': ['#416068',.42,.30,7],
  'Rack base inset': ['#253e43',.56,.08,10],
};

const cinematic = {
  'Worktop': ['#343c3b',.42,.05,12],
  'Bench edge': ['#252e2e',.36,.21,7],
  'Cabinet doors': ['#435653',.45,.14,10],
  'Front enclosure': ['#bfc7c0',.43,.06,10],
  'Teal front fascia': ['#23383c',.40,.09,0],
  'Sample chamber lid': ['#26373a',.40,.10,0],
  'Graphite moulded ABS': ['#1e2c30',.39,.04,10],
  'Anodised instrument trim': ['#bbc7c5',.25,.83,7],
  'Brushed stainless fastener': ['#bbc1bf',.29,.91,7],
  'Rack base': ['#475b5e',.38,.49,7],
  'Rack base inset': ['#303d3f',.51,.15,10],
  'Instrument display': ['#ffffff',.16,0,13],
  'Tube graduation 1': ['#d4d9cd',.57,0,0],
};

function reagentTexture(canvas, name, description, stripe) {
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f3f1e8';ctx.fillRect(0,0,512,288);
  ctx.fillStyle=stripe;ctx.fillRect(0,0,512,91);
  ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.font='700 64px "Segoe UI", sans-serif';
  ctx.fillText(name,256,69,412);
  ctx.fillStyle='#20373c';ctx.font='600 44px "Segoe UI", sans-serif';
  ctx.fillText(description,256,171,394);
  ctx.fillStyle=stripe;ctx.fillRect(210,213,92,5);
}

export class BenchFinish {
  constructor(scene) {
    this.scene=scene;
    this.renderer=scene.r;
    this.surfaces=[];
    this.labels=[];
    this.cinematicDetails=[];
    this.active='original';
    this.revision=0;
    this.assets=new Map();
  }

  surface(name, material) {
    if (!finishes[name] && !cinematic[name]) return material;
    const original={color:material.color,rough:material.rough,metal:material.metal,pattern:material.pattern};
    const finish=([color,rough,metal,pattern])=>({color:this.renderer.material(color).color,rough,metal,pattern});
    const refined=finishes[name]?finish(finishes[name]):original;
    this.surfaces.push({material,original,refined,cinematic:cinematic[name]?finish(cinematic[name]):refined});
    return material;
  }

  reagent(node,name,description,stripe) {
    this.labels.push({node,name,description,stripe,original:node.mat.map});
  }

  instrumentPrint(vertices,indices,material,parent) {
    // The source batches all faceplate lettering and the dial index into one material.
    // The model name is the top inscription, just above the raised display bezel.
    const lettering=[], fixed=[];
    for (const index of indices) {
      const batch=vertices[index*8+1]>1.05?lettering:fixed;
      batch.push(index);
    }
    this.modelName=this.renderer.mesh(vertices,material,parent,new Uint32Array(lettering));
    return this.renderer.mesh(vertices,material,parent,new Uint32Array(fixed));
  }

  once(key,build) {
    if (!this.assets.has(key)) {
      this.assets.set(key,build().catch(error=>{this.assets.delete(key);throw error;}));
    }
    return this.assets.get(key);
  }

  async meshGroup(folder,stem) {
    const fetchAsset=async (name,type)=>{
      const response=await fetch(new URL('../assets/'+folder+'/'+name,import.meta.url));
      if (!response.ok) throw Error('Could not load '+name);
      return response[type]();
    };
    const [meshes,buffer]=await Promise.all([fetchAsset(stem+'.json','json'),fetchAsset(stem+'.bin','arrayBuffer')]);
    const geometry=meshes.map(mesh=>{
      const vertices=new Float32Array(buffer,mesh.offset,mesh.vertexCount*8);
      const indices=new Uint32Array(buffer,mesh.offset+vertices.byteLength,mesh.indexCount);
      return {vertices,indices,material:mesh.material};
    });
    const group=this.renderer.group(this.scene.objects.instrument);
    group.visible=false;
    for (const {vertices,indices,material} of geometry) {
      const {color,...finish}=material;
      this.renderer.mesh(vertices,this.renderer.material(color,finish),group,indices);
    }
    return group;
  }

  async consoleFinish() {
    const group=await this.meshGroup('refined','console');
    for (const label of this.labels) {
      const c=this.scene.canvas(512,288);
      reagentTexture(c,label.name,label.description,label.stripe);
      label.refined=this.renderer.texture(c);
    }
    this.console=group;
  }

  async select(value) {
    if (!['original','refined','cinematic'].includes(value)) throw RangeError('Unknown bench appearance');
    const revision=++this.revision;
    this.originalRoom??=[this.renderer.roomTexture,this.renderer.reflections];
    let room=this.originalRoom;
    if (value!=='original') {
      try {
        [room]=await Promise.all([
          this.once(value,async ()=>(await this.renderer.roomImages(value+'/')).map(img=>this.renderer.texture(img))),
          this.once('console',()=>this.consoleFinish()),
          value==='cinematic' && this.once('dial',async ()=>{
            this.dial=await this.meshGroup('cinematic','dial');
            this.dial.set(1.24,.73,1.212);
          }),
        ]);
      } catch (error) {
        if (revision!==this.revision) return false;
        throw error;
      }
    }
    if (revision!==this.revision) return false;
    if (value===this.active) return true;
    const refined=value!=='original';
    for (const item of this.surfaces) Object.assign(item.material,item[value]);
    for (const label of this.labels) label.node.mat.map=refined?label.refined:label.original;
    [this.renderer.roomTexture,this.renderer.reflections]=room;
    if (this.console) this.console.visible=refined;
    if (this.dial) this.dial.visible=value==='cinematic';
    this.modelName.pos[1]=value==='cinematic'?.032:0;
    for (const detail of this.cinematicDetails) detail.visible=value==='cinematic';
    this.renderer.setCinematic(value==='cinematic');
    this.active=value;
    this.scene.lcdValue=null;
    this.scene.displayedTransmission=undefined;
    this.renderer.dirtyShadow=true;
    return true;
  }
}

export function drawFrontDisplay(canvas, wavelength, caption, reading) {
  const ctx=canvas.getContext('2d');
  ctx.save();
  ctx.textAlign='left';
  ctx.fillStyle='#10252d';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#a5d6d5';ctx.font='600 34px "Segoe UI", sans-serif';
  ctx.fillText(wavelength+' nm',24,43);
  ctx.textAlign='right';ctx.fillStyle='#c7d8d3';ctx.font='28px "Segoe UI", sans-serif';
  ctx.fillText('ABSORBANCE',634,41);
  ctx.fillStyle='#537b81';ctx.fillRect(24,57,610,3);
  ctx.textAlign='left';ctx.fillStyle='#f5f4de';
  ctx.font=reading?'600 89px Consolas, monospace':'600 54px "Segoe UI", sans-serif';
  ctx.fillText(reading?reading.absorbance.toFixed(4)+' A':caption,23,145,612);
  ctx.restore();
}

export function drawTransmissionDisplay(canvas, reading) {
  const ctx=canvas.getContext('2d');
  ctx.save();
  ctx.textAlign='left';
  ctx.fillStyle='#132a31';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#bcd4d3';ctx.font='600 34px "Segoe UI", sans-serif';
  ctx.fillText('TRANSMITTANCE',29,53);
  ctx.fillStyle='#e9f2e8';ctx.font='600 88px Consolas, monospace';
  ctx.fillText(reading?reading.percentT.toFixed(1):'—',27,147,415);
  ctx.fillStyle='#a9ccc8';ctx.font='600 43px "Segoe UI", sans-serif';
  ctx.textAlign='right';ctx.fillText('%T',606,141);
  ctx.fillStyle='#56797d';ctx.fillRect(30,171,577,2);
  for (const [i,label,value,color] of [[0,'BLANK',reading?100:null,'#9bd8d0'],[1,'SAMPLE',reading?.percentT,'#e8b474']]) {
    const y=221+i*69;
    ctx.textAlign='left';ctx.fillStyle='#e3eee9';ctx.font='600 29px "Segoe UI", sans-serif';
    ctx.fillText(label,30,y);
    ctx.fillStyle='#3a5257';ctx.fillRect(171,y-18,258,15);
    if (value!=null) {ctx.fillStyle=color;ctx.fillRect(171,y-18,258*value/100,15);}
    ctx.textAlign='right';ctx.fillStyle='#dce9e6';ctx.font='31px Consolas, monospace';
    ctx.fillText(value==null?'—':value.toFixed(1)+'%',606,y);
  }
  ctx.restore();
}
