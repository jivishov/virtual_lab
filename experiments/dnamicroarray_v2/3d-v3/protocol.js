/* Edvotek #235, version 235.180419, pp.8,11,12. Discrete teaching model.
   All volumes are added liquid in µL; initial prepared-sample volume is unknown.
   v3: coded rejections, full action details in the log, validated save/restore,
   and a notebook that records observed colours before interpretation (p.12). */
(function (root) {
  'use strict';
  const DOSE = 5, SCHEMA = 'microarray-3d-3';
  const PHASES = ['prepare', 'eb', 'dry1', 'samples', 'dry2', 'hb', 'dry3', 'uv', 'analyze', 'complete'];
  const RESULTS = [
    ['yellow','red','green','black','black','yellow','green','red'],
    ['yellow','red','green','black','green','red','green','red'],
    ['yellow','red','green','black','green','yellow','green','black'],
    ['yellow','red','green','black','green','yellow','green','red']
  ];
  const COLORS = ['yellow','red','green','black'];
  const MEANINGS = {yellow:'equal', red:'up', green:'down', black:'none'};
  // p.12 table: control columns are Normal, Up, Down and Blank. They validate the run; they are not interpreted.
  const CONTROLS = [{name:'Normal',expected:'yellow'},{name:'Up',expected:'red'},{name:'Down',expected:'green'},{name:'Blank',expected:'black'}];
  const META = {
    prepare: ['01','Orient & label','Check Patient 1 is at the upper left of both items. Gently tap the QuickStrip to settle the samples. Label the card and prepare your protective equipment.','p.8 · step 1; p.11 · pre-lab'],
    eb: ['02','Equilibrate every spot','Draw 5 µL of EB, then deposit it above one paper spot. Repeat for all 32 spots. Keep the buffer tip off the paper.','p.8 · step 2'],
    dry1: ['03','Dry the equilibrated card','Use 5 minutes at 37 °C, or 10 minutes at room temperature. Let the card dry completely.','p.8 · step 3'],
    samples: ['04–08','Prepare & spot samples','Use a fresh tip for each well: add 5 µL control cDNA, mix three full draw/return cycles, then transfer 5 µL to the matching card spot.','p.8 · steps 4–8'],
    dry2: ['09','Dry the sample spots','All 32 samples are on the card. Dry completely before adding hybridization buffer.','p.8 · step 9'],
    hb: ['10','Apply hybridization buffer','Fit a clean buffer tip. Draw and deposit 5 µL HB on each of the 32 paper spots.','p.8 · step 10'],
    dry3: ['11','Dry before visualization','Dry the card completely for the third time before viewing it under UV.','p.8 · step 11'],
    uv: ['12','Visualize with UV','Put on UV goggles, move the dried card to the UV viewing area, and switch on the handheld long-wave lamp.','p.8 · step 12'],
    analyze: ['13','Check controls, then genes','Record the colour you see on each control spot (columns 1–4) and check them against the expected pattern. Then record and interpret genes 1–4 for each patient.','p.12 · results and analysis'],
    complete: ['✓','Experiment complete','Your controls and all 16 gene interpretations agree with this manual example. Answer the reasoning questions and review your debrief.','p.12 · example results']
  };
  function requireThat(value, message, code='sequence') {
    if (value) return;
    const error = new Error(message); error.code = code; throw error;
  }
  const column = id => Number(id.slice(1));
  const isControl = id => column(id) <= 4;
  class Protocol {
    constructor(rowSet='AD') {
      this.rows = rowSet === 'EH' ? ['E','F','G','H'] : ['A','B','C','D'];
      this.ids = this.rows.flatMap(row => Array.from({length:8}, (_,i)=>row+(i+1)));
      this.phase='prepare'; this.status='running'; this.orientation={card:true,plate:true};
      this.label=''; this.ppe=false; this.samplesSettled=false; this.uvGoggles=false; this.uv=false; this.cardLocation='bench';
      this.reagents={EB:200,cDNA:200,HB:200}; this.tip=null; this.tipCount=0; this.waste=0; this.evaporated=0;
      this.wells=Object.fromEntries(this.ids.map(id=>[id,{volume:0,control:false,mixes:0,punctured:false,spotted:false,tipId:null}]));
      this.spots=Object.fromEntries(this.ids.map(id=>[id,{eb:false,sample:false,hb:false,volume:0}]));
      this.timer=null; this.dried=[]; this.dryingMode='incubator';
      this.colors={}; this.interpretations={}; this.controlsVerified=false;
      this.log=[]; this.elapsed=0;
    }
    get rowSet() { return this.rows[0]==='E'?'EH':'AD'; }
    get meta() { return META[this.phase]; }
    get currentSample() { return this.ids.find(id=>!this.wells[id].spotted); }
    get progress() {
      if(this.phase==='complete') return 1;
      const i=PHASES.indexOf(this.phase);
      let sub=0;
      if(['eb','hb'].includes(this.phase)) sub=this.ids.filter(id=>this.spots[id][this.phase]).length/32;
      if(this.phase==='samples') sub=this.ids.filter(id=>this.wells[id].spotted).length/32;
      if(this.phase==='analyze') sub=(Object.keys(this.colors).length+Object.keys(this.interpretations).length)/48;
      if(this.timer) sub=1-this.timer.remaining/this.timer.total;
      return (i+sub)/9;
    }
    dispatch(action, input='button') {
      requireThat(action && typeof action.type==='string','Choose a laboratory action.','input');
      const copy=Object.assign(Object.create(Protocol.prototype),structuredClone(this));
      const message=copy.reduce(action);
      requireThat(Math.abs(copy.balance())<1e-7,'Liquid bookkeeping error. This action was cancelled.','input');
      const detail={};
      for(const [key,value] of Object.entries(action))if(!['type','target'].includes(key)&&['string','number','boolean'].includes(typeof value))detail[key]=value;
      copy.log.push({n:copy.log.length+1,phase:copy.phase,action:action.type,target:action.target??null,detail,input,simulatedSeconds:copy.elapsed});
      Object.assign(this,copy);
      return message;
    }
    reduce(a) {
      if(a.type==='pause'||a.type==='stop') {this.status=a.type==='pause'?'paused':'stopped'; return a.type==='pause'?'Paused. The drying clock and all handling are suspended.':'Stopped. Pending handling cancelled; actual volumes and elapsed drying time retained.';}
      if(a.type==='run') {this.status='running'; return 'Resumed from the current state.';}
      requireThat(this.status==='running','Choose Run to resume the experiment first.','paused');
      if(a.type==='orient') {
        requireThat(this.phase==='prepare'&&['card','plate'].includes(a.target),'Orientation is set before the experiment.');
        this.orientation[a.target]=!this.orientation[a.target]; return 'Rotated '+(a.target==='card'?'paper card':'QuickStrip plate')+'.';
      }
      if(a.type==='prepare') {
        requireThat(this.phase==='prepare','The workcell has already been prepared.');
        requireThat(this.orientation.card&&this.orientation.plate,'Patient 1 must be at the upper left of both the card and the QuickStrip plate.','prep');
        requireThat(typeof a.label==='string'&&a.label.trim().length>0&&a.label.trim().length<=24,'Enter initials or a group label (1–24 characters).','prep');
        requireThat(a.ppe===true,'Confirm gloves and laboratory goggles before starting.','prep');
        requireThat(this.samplesSettled,'Gently tap the QuickStrip to settle the prepared samples at the bottom of the wells.','prep');
        this.label=a.label.trim();this.ppe=true;this.phase='eb';return 'Card labeled. Begin the 32 EB deposits.';
      }
      if(a.type==='tapPlate') {
        requireThat(this.phase==='prepare','Settle the QuickStrip samples before preparing the workcell.');
        this.samplesSettled=true;return 'QuickStrip gently tapped. Prepared samples settled at the bottom of the wells.';
      }
      if(a.type==='attach') {
        requireThat(['eb','samples','hb'].includes(this.phase),'A pipette tip is not needed at this step.');
        requireThat(!this.tip,'Eject the current tip into waste first.','tip');requireThat(this.tipCount<96,'The tip rack is empty. Start a fresh experiment.','volume');
        this.tip={id:++this.tipCount,volume:0,reagent:null,sample:null,payload:null,retired:false};return 'Fresh tip fitted.';
      }
      if(a.type==='eject') {
        requireThat(this.tip,'No tip is fitted.','tip');
        requireThat(!this.tip.sample||this.tip.retired,'Keep this tip through all three mixes and the matching sample-spot transfer.','tip');
        this.waste+=this.tip.volume;this.tip=null;return 'Tip ejected into waste.';
      }
      if(a.type==='pickCard') {
        requireThat(!this.timer,'Finish drying before moving the card.','drying');
        requireThat(!['prepare','eb','complete'].includes(this.phase),'Keep the paper card at its station for this step.');
        requireThat(this.phase!=='hb'||this.cardLocation!=='bench','Complete all HB deposits before moving the card.');
        requireThat(this.phase!=='samples'||this.cardLocation!=='bench','Complete all sample transfers before moving the card.');
        requireThat(this.cardLocation!=='held','The card is already held.');this.uv=false;this.cardLocation='held';return 'Card held. Choose its destination.';
      }
      if(a.type==='placeCard') {
        requireThat(this.cardLocation==='held','Pick up the card first.');
        requireThat(['bench','incubator','uv'].includes(a.target),'Choose a card station.','input');
        requireThat(a.target!=='incubator'||this.phase.startsWith('dry'),'The incubator is for a drying stage.','drying');
        requireThat(a.target!=='uv'||['uv','analyze'].includes(this.phase),'Complete all three drying stages before UV viewing.','drying');
        this.cardLocation=a.target;return 'Card placed '+({bench:'on the bench',incubator:'in the 37 °C incubator',uv:'in the UV viewing area'}[a.target])+'.';
      }
      if(a.type==='dry') {
        requireThat(this.phase.startsWith('dry'),'Drying is not the current step.');requireThat(!this.timer,'The drying clock is already active.','drying');
        requireThat(['incubator','room'].includes(a.mode),'Choose 37 °C or room temperature.','input');
        requireThat(this.cardLocation===(a.mode==='incubator'?'incubator':'bench'),a.mode==='incubator'?'Place the card in the incubator first.':'Place the card on the bench for room-temperature drying.','drying');
        this.dryingMode=a.mode;const total=a.mode==='incubator'?300:600;
        // Linear evaporation is an explicit teaching approximation, not measured kinetics.
        this.timer={total,remaining:total,phase:this.phase,mode:a.mode,initialVolumes:Object.fromEntries(this.ids.map(id=>[id,this.spots[id].volume])),evaporatedStart:this.evaporated};
        return 'Drying started: '+(total/60)+' simulated minutes.';
      }
      if(a.type==='uvGoggles') {this.uvGoggles=a.value===true;if(!this.uvGoggles)this.uv=false;return this.uvGoggles?'UV goggles on.':'UV lamp off; goggles removed.';}
      if(a.type==='uv') {
        requireThat(['uv','analyze','complete'].includes(this.phase)&&this.dried.length===3,'Finish all three drying stages before UV viewing.','drying');
        requireThat(this.cardLocation==='uv','Place the card in the UV viewing area.','uv');requireThat(this.uvGoggles,'Put on UV goggles before switching on the lamp.','uv');
        this.uv=!this.uv;if(this.uv&&this.phase==='uv')this.phase='analyze';return this.uv?'UV lamp on. Inspect the control columns first.':'UV lamp off.';
      }
      if(a.type==='observe') {
        requireThat(this.phase==='analyze'&&this.uv,'View the finished card under UV to record observations.','uv');
        requireThat(this.ids.includes(a.target),'Choose a spot on this card.','input');
        requireThat([...COLORS,''].includes(a.value),'Choose the colour you see.','input');
        requireThat(isControl(a.target)||this.controlsVerified,'Check all four control columns for every patient before recording genes.','analysis');
        if(a.value)this.colors[a.target]=a.value;else delete this.colors[a.target];
        if(isControl(a.target))this.controlsVerified=false;
        return 'Colour recorded for '+a.target+'.';
      }
      if(a.type==='interpret') {
        requireThat(this.phase==='analyze'&&this.uv,'View the finished card under UV to interpret genes.','uv');
        requireThat(this.ids.includes(a.target)&&!isControl(a.target),'Interpretations are recorded for gene spots in columns 5–8.','input');
        requireThat(['up','down','equal','none',''].includes(a.value),'Choose an expression interpretation.','input');
        requireThat(this.controlsVerified,'Check all four control columns for every patient before interpreting genes.','analysis');
        if(a.value)this.interpretations[a.target]=a.value;else delete this.interpretations[a.target];
        return 'Interpretation recorded for '+a.target+'.';
      }
      if(a.type==='verifyControls'||a.type==='finish') {
        requireThat(this.phase==='analyze'&&this.uv,'View the card under UV first.','uv');
        const genes=a.type==='finish';
        if(genes)requireThat(this.controlsVerified,'Check the controls first.','analysis');
        const ids=this.ids.filter(id=>genes!==isControl(id));
        const missing=ids.filter(id=>!this.colors[id]||(genes&&!this.interpretations[id]));
        requireThat(!missing.length,'Record all '+ids.length+(genes?' gene colours and interpretations':' control colours')+' first ('+missing.length+' remaining).','analysis');
        // Feedback names patients, not cells, so a check cannot be used to locate each answer.
        const wrongColor=ids.filter(id=>this.colors[id]!==this.result(id));
        const wrongMeaning=genes?ids.filter(id=>this.interpretations[id]!==MEANINGS[this.result(id)]):[];
        const wrong=[...new Set([...wrongColor,...wrongMeaning])];
        const patients=[...new Set(wrong.map(id=>'Patient '+(this.rows.indexOf(id[0])+1)))];
        const parts=[wrongColor.length?wrongColor.length+' colour'+(wrongColor.length===1?'':'s'):'',wrongMeaning.length?wrongMeaning.length+' interpretation'+(wrongMeaning.length===1?'':'s'):''].filter(Boolean);
        requireThat(!wrong.length,parts.join(' and ')+(wrongColor.length+wrongMeaning.length===1?' needs':' need')+' another look ('+patients.join(', ')+'). Compare with the card under UV'+(genes?' and the legend.':'.'),'analysis');
        if(!genes){this.controlsVerified=true;return 'All 16 controls show the expected Normal / Up / Down / Blank pattern. The run is valid; record the genes.';}
        this.phase='complete';return 'All gene colours and interpretations agree with the card.';
      }
      requireThat(['aspirate','dispense'].includes(a.type),'Unknown laboratory action.','input');
      requireThat(['eb','samples','hb'].includes(this.phase),'Liquid transfer is not allowed during this step.');
      requireThat(this.cardLocation==='bench','Return the dried card to the bench before continuing.','drying');
      requireThat(this.tip,'Fit a fresh tip first.','tip');requireThat(!this.tip.retired,'This tip has touched a sample spot. Eject it and fit a fresh tip.','tip');
      const t=this.tip, well=this.ids.includes(a.target)?this.wells[a.target]:null, spot=this.ids.includes(a.target)?this.spots[a.target]:null;
      if(a.type==='aspirate') {
        requireThat(t.volume===0,'The pipette already contains 5 µL. Deliver it before drawing again.','volume');
        if(Object.hasOwn(this.reagents,a.target)) {
          const wanted={eb:'EB',samples:'cDNA',hb:'HB'}[this.phase];
          requireThat(a.target===wanted,'This step requires '+wanted+', not '+a.target+'.','reagent');
          requireThat(!t.sample,'A tip that entered a patient well cannot return to a stock reagent.','tip');
          requireThat(!t.reagent||(this.phase!=='samples'&&t.reagent===wanted),'Use a fresh tip for this reagent or patient sample.','tip');
          if(this.phase==='samples')requireThat(!this.wells[this.currentSample]?.control,'Control cDNA is already in this well. Mix it before spotting.','duplicate');
          requireThat(this.reagents[wanted]>=DOSE,'There is less than 5 µL left in '+wanted+'. Start a fresh run.','volume');
          this.reagents[wanted]-=DOSE;t.reagent=wanted;t.payload=wanted;t.volume=DOSE;return 'Drew 5 µL '+wanted+'.';
        }
        requireThat(this.phase==='samples'&&well&&a.surface==='well','Draw from the current reagent tube or patient well, not from the paper card.','reagent');
        requireThat(a.target===this.currentSample,'Work in row order. The next patient well is '+this.currentSample+'.','order');
        requireThat(well.control&&well.tipId===t.id&&t.sample===a.target,'Use the same tip that added control cDNA to this patient well.','tip');
        requireThat(well.volume>=DOSE,'The well does not contain a full 5 µL added-liquid aliquot.','volume');
        well.volume-=DOSE;t.volume=DOSE;t.payload='sample';return well.mixes<3?'Drew mixing aliquot. Return it to '+a.target+' ('+(well.mixes+1)+'/3).':'Drew 5 µL mixed sample. Transfer it to card spot '+a.target+'.';
      }
      requireThat(t.volume===DOSE,'Draw a full 5 µL aliquot first.','volume');
      if(a.surface==='well') {
        requireThat(this.phase==='samples'&&well,'Use a QuickStrip well only during sample preparation.');
        requireThat(a.target===this.currentSample,'The next patient well is '+this.currentSample+'.','order');
        if(t.payload==='cDNA') {
          requireThat(!well.control&&!t.sample,'Use one fresh control-cDNA tip for each patient well.','tip');
          well.control=true;well.punctured=true;well.tipId=t.id;t.sample=a.target;
        } else {
          requireThat(t.payload==='sample'&&t.sample===a.target&&well.tipId===t.id,'Return this aliquot only to its original patient well.','mixing');
          requireThat(well.mixes<3,'Three mixing cycles are complete. Transfer the aliquot to its matching card spot.','mixing');well.mixes++;
        }
        well.volume+=DOSE;t.volume=0;t.payload=null;return well.mixes?'Mixing cycle '+well.mixes+'/3 complete in '+a.target+'.':'Pierced foil and added 5 µL control cDNA to '+a.target+'.';
      }
      requireThat(a.surface==='card'&&spot,'Choose a receiving paper-card spot.','input');
      if(this.phase==='eb'||this.phase==='hb') {
        const wanted=this.phase==='eb'?'EB':'HB';requireThat(t.payload===wanted,'The card needs '+wanted+' at this step.','reagent');
        requireThat(!spot[this.phase],'Spot '+a.target+' already received '+wanted+'.','duplicate');spot[this.phase]=true;spot.volume+=DOSE;t.volume=0;t.payload=null;
        if(this.ids.every(id=>this.spots[id][this.phase]))this.phase=this.phase==='eb'?'dry1':'dry3';return 'Deposited 5 µL '+wanted+' on '+a.target+'.';
      }
      requireThat(a.target===this.currentSample&&t.sample===a.target,'Keep patient and gene positions matched. This aliquot belongs on '+t.sample+'.','match');
      requireThat(t.payload==='sample'&&well.mixes===3,'Complete three full draw/return mixing cycles before spotting.','mixing');
      requireThat(!spot.sample&&!well.spotted,'This sample is already on the card.','duplicate');
      spot.sample=true;spot.volume+=DOSE;well.spotted=true;t.volume=0;t.payload=null;t.retired=true;
      if(this.ids.every(id=>this.wells[id].spotted))this.phase='dry2';return 'Transferred 5 µL from '+a.target+' to its matching spot. Eject this tip.';
    }
    tick(seconds) {
      if(!this.timer||this.status!=='running'||!Number.isFinite(seconds)||seconds<=0)return false;
      const used=Math.min(seconds,this.timer.remaining);this.timer.remaining=Math.max(0,this.timer.remaining-used);this.elapsed+=used;
      if(this.timer.remaining<1e-7)this.timer.remaining=0;
      let removed=0;
      for(const id of this.ids){const initial=this.timer.initialVolumes[id];this.spots[id].volume=initial*this.timer.remaining/this.timer.total;removed+=initial-this.spots[id].volume;}
      this.evaporated=this.timer.evaporatedStart+removed;
      if(this.timer.remaining>1e-7)return false;
      const finished=this.phase;
      this.dried.push({phase:finished,seconds:this.timer.total,mode:this.timer.mode});this.timer=null;
      this.phase={dry1:'samples',dry2:'hb',dry3:'uv'}[finished];
      this.log.push({n:this.log.length+1,phase:this.phase,action:'dryComplete',target:finished,detail:{},input:'clock',simulatedSeconds:this.elapsed});return true;
    }
    result(id) {
      if(!this.ids.includes(id)||!['analyze','complete'].includes(this.phase)||!this.uv)return null;
      return RESULTS[this.rows.indexOf(id[0])][column(id)-1];
    }
    balance() {
      return Object.values(this.reagents).reduce((a,b)=>a+b,0)+Object.values(this.spots).reduce((n,s)=>n+s.volume,0)+Object.values(this.wells).reduce((n,w)=>n+w.volume,0)+(this.tip?.volume||0)+this.waste+this.evaporated-600;
    }
    next() {
      if(this.status!=='running')return {text:'Choose Run to continue.',kind:'run'};
      if(this.phase==='prepare')return this.samplesSettled?{text:'Check the orientation, enter your label, and confirm laboratory PPE.',kind:'prepare'}:{type:'tapPlate',target:'plate',text:'Gently tap the QuickStrip to settle the samples, then label your card.',kind:'prepare'};
      if(this.phase==='complete')return {text:'Experiment complete. Answer the reasoning questions, then review your debrief.',kind:'notebook'};
      if(['samples','hb'].includes(this.phase)&&this.cardLocation!=='bench')return this.cardLocation==='held'?{type:'placeCard',target:'bench',text:'Return the card to its taped bench outline.'}:{type:'pickCard',target:'card',text:'Pick up the dried paper card.'};
      if(this.phase.startsWith('dry')) {
        if(this.timer)return {text:'Drying in progress. The clock is accelerated only at the selected rate.',kind:'wait'};
        return {text:'Choose the drying method, place the card, then start the clock.',kind:'dry'};
      }
      if(this.phase==='uv')return {text:'Put on UV goggles, place the card in the UV viewing area, and switch on the lamp.',kind:'uv',target:'uv'};
      if(this.phase==='analyze'){
        if(!this.uv)return {text:'Switch the UV lamp back on to read the card.',kind:'uv',target:'uv'};
        return {text:this.controlsVerified?'Record each gene spot’s colour and interpretation in the notebook.':'Record the colour of every control spot (columns 1–4), then check the controls.',kind:'notebook'};
      }
      if(this.tip?.retired||(this.tip?.reagent&&this.tip.reagent!==({eb:'EB',samples:'cDNA',hb:'HB'}[this.phase])))return {type:'eject',target:'waste',text:'Eject the used tip into waste.'};
      if(!this.tip)return {type:'attach',target:'tips',text:'Fit a fresh tip from the rack.'};
      if(this.phase!=='samples') {
        const id=this.ids.find(id=>!this.spots[id][this.phase]),reagent=this.phase==='eb'?'EB':'HB';
        return this.tip.volume?{type:'dispense',target:id,surface:'card',text:'Deposit 5 µL '+reagent+' above card spot '+id+'.'}:{type:'aspirate',target:reagent,text:'Draw 5 µL '+reagent+'.'};
      }
      const id=this.currentSample,w=this.wells[id];
      if(!w.control)return this.tip.volume?{type:'dispense',target:id,surface:'well',text:'Pierce the foil and deliver control cDNA into QuickStrip well '+id+'.'}:{type:'aspirate',target:'cDNA',text:'Draw 5 µL control cDNA for '+id+'.'};
      if(!this.tip.volume)return {type:'aspirate',target:id,surface:'well',text:w.mixes<3?'Draw from '+id+' for mixing cycle '+(w.mixes+1)+' of 3.':'Draw 5 µL mixed sample from '+id+'.'};
      return w.mixes<3?{type:'dispense',target:id,surface:'well',text:'Return the aliquot to '+id+' to complete mixing cycle '+(w.mixes+1)+' of 3.'}:{type:'dispense',target:id,surface:'card',text:'Apply the mixed aliquot to matching card spot '+id+'.'};
    }
    serialize() {
      const state={schema:SCHEMA};
      for(const [key,value] of Object.entries(this))state[key]=structuredClone(value);
      return state;
    }
    static restore(data) {
      const fail=message=>{const e=new Error('Saved run could not be restored: '+message);e.code='restore';throw e;};
      if(!data||typeof data!=='object'||data.schema!==SCHEMA)fail('it was saved by a different version.');
      const rowSet=data.rows?.[0]==='E'?'EH':'AD',p=new Protocol(rowSet);
      if(JSON.stringify(data.rows)!==JSON.stringify(p.rows)||JSON.stringify(data.ids)!==JSON.stringify(p.ids))fail('the card layout does not match.');
      const num=(v,lo=0,hi=Infinity)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo-1e-9&&v<=hi+1e-9;
      const bool=v=>typeof v==='boolean',sameKeys=(o,keys)=>!!o&&typeof o==='object'&&JSON.stringify(Object.keys(o).sort())===JSON.stringify([...keys].sort());
      if(!PHASES.includes(data.phase))fail('unknown step.');
      if(!['running','paused','stopped'].includes(data.status))fail('unknown run status.');
      if(!['bench','incubator','uv','held'].includes(data.cardLocation))fail('unknown card location.');
      if(!['incubator','room'].includes(data.dryingMode))fail('unknown drying method.');
      if(!sameKeys(data.orientation,['card','plate'])||!bool(data.orientation.card)||!bool(data.orientation.plate))fail('orientation is invalid.');
      for(const key of ['ppe','samplesSettled','uvGoggles','uv','controlsVerified'])if(!bool(data[key]))fail(key+' is invalid.');
      if(typeof data.label!=='string'||data.label.length>24)fail('label is invalid.');
      if(!sameKeys(data.reagents,['EB','cDNA','HB'])||!Object.values(data.reagents).every(v=>num(v,0,200)))fail('reagent quantities are invalid.');
      if(!Number.isInteger(data.tipCount)||data.tipCount<0||data.tipCount>96)fail('tip count is invalid.');
      if(!num(data.waste)||!num(data.evaporated)||!num(data.elapsed))fail('quantities are invalid.');
      if(!sameKeys(data.wells,p.ids)||!sameKeys(data.spots,p.ids))fail('spot records are incomplete.');
      for(const id of p.ids){
        const w=data.wells[id],s=data.spots[id];
        if(!num(w?.volume)||!Number.isInteger(w.mixes)||w.mixes<0||w.mixes>3||!['control','punctured','spotted'].every(k=>bool(w[k]))||!(w.tipId===null||Number.isInteger(w.tipId)))fail('well '+id+' is invalid.');
        if(!num(s?.volume)||!['eb','sample','hb'].every(k=>bool(s[k])))fail('spot '+id+' is invalid.');
      }
      if(data.tip!==null){
        const t=data.tip;
        if(!t||!Number.isInteger(t.id)||t.id<1||t.id>data.tipCount||![0,DOSE].includes(t.volume)||!bool(t.retired))fail('the fitted tip is invalid.');
        if(![null,'EB','cDNA','HB','sample'].includes(t.payload)||![null,'EB','cDNA','HB'].includes(t.reagent)||!(t.sample===null||p.ids.includes(t.sample)))fail('the fitted tip is invalid.');
      }
      if(data.timer!==null){
        const t=data.timer;
        if(!t||![300,600].includes(t.total)||!num(t.remaining,0,t.total)||t.phase!==data.phase||!data.phase.startsWith('dry')||!['incubator','room'].includes(t.mode)||!sameKeys(t.initialVolumes,p.ids)||!Object.values(t.initialVolumes).every(v=>num(v))||!num(t.evaporatedStart))fail('the drying clock is invalid.');
      }
      if(!Array.isArray(data.dried)||data.dried.length>3||!Array.isArray(data.log))fail('records are invalid.');
      for(const [store,values] of [['colors',COLORS],['interpretations',['up','down','equal','none']]]){
        const o=data[store];if(!o||typeof o!=='object'||Array.isArray(o))fail(store+' are invalid.');
        for(const [id,v] of Object.entries(o))if(!p.ids.includes(id)||!values.includes(v)||(store==='interpretations'&&isControl(id)))fail(store+' are invalid.');
      }
      for(const key of Object.keys(p))p[key]=structuredClone(data[key]);
      if(Math.abs(p.balance())>1e-6)fail('the liquid balance does not add up.');
      return p;
    }
    summary() {return {version:SCHEMA,source:'Edvotek #235, 235.180419, pp.8,11,12',phase:this.phase,status:this.status,label:this.label,rows:this.rows,orientation:this.orientation,samplesSettled:this.samplesSettled,ppe:this.ppe,tipCount:this.tipCount,reagents:this.reagents,wells:this.wells,spots:this.spots,tip:this.tip,cardLocation:this.cardLocation,wasteUL:this.waste,evaporatedUL:this.evaporated,balanceErrorUL:this.balance(),drying:this.dried,timer:this.timer,controlsVerified:this.controlsVerified,observedColors:this.colors,interpretations:this.interpretations,actions:this.log};}
  }
  const api={Protocol,DOSE,SCHEMA,PHASES,RESULTS,COLORS,MEANINGS,CONTROLS,META,isControl};root.MicroarrayProtocol=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
