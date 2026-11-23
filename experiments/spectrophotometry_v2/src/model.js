import {PIPETTES,pipetteIds,pipetteForSource} from './pipettes.js';
/* Scientific and protocol state, independent of the 3D renderer.
 * Teaching-data provenance and deliberate corrections: README.md.
 */
export const STOCK_CONCENTRATION = 2.31;
export const TARGET_WAVELENGTH = 630;
const UNDILUTED_PERCENT_T = 39;
export const FINAL_VOLUME = 10;
export const RINSE_VOLUME = 3;
export const MAX_ABSORBANCE = 1.5;
export const LOOKUP = Object.freeze([[0,100],[0.231,95],[0.462,87],[0.693,81],[0.924,77],[1.39,65],[1.85,58],[2.31,49]].map(Object.freeze));
const EPS = 1e-8;
const round = (n, places) => Number(n.toFixed(places));
const positive = n => Number.isFinite(n) && n >= 0;

export function calculateConcentration(stockVolume, waterVolume) {
  if (!positive(stockVolume) || !positive(waterVolume)) throw new RangeError('Volumes must be finite, nonnegative mL.');
  const total = stockVolume + waterVolume;
  return total ? STOCK_CONCENTRATION * stockVolume / total : 0;
}

export const SAMPLES = Object.freeze([10,8,6,4,2,0].map((stock, i) => Object.freeze({
  id:`tube_${stock}_${10-stock}`, label:stock ? `${stock}/${10-stock}` : '0/10 · Blank',
  name:stock ? `Standard ${i+1}` : 'Water blank', stock, water:10-stock,
  concentration:calculateConcentration(stock, 10-stock)
})));
export const DRINK_SAMPLES = Object.freeze([['unknown', 'Original drink'], ['tube_dilution', 'Diluted drink']]);

export function percentT(concentration) {
  // -1 is accepted only as the original source's explicit unknown-data sentinel.
  if (concentration === -1) return UNDILUTED_PERCENT_T;
  if (!positive(concentration)) throw new RangeError('Concentration must be a finite, nonnegative µM value.');
  if (concentration <= LOOKUP[0][0]) return LOOKUP[0][1];
  if (concentration >= LOOKUP.at(-1)[0]) return LOOKUP.at(-1)[1];
  for (let i=1;i<LOOKUP.length;i++) {
    const [upper, ut] = LOOKUP[i];
    const [lower, lt] = LOOKUP[i-1];
    if (concentration <= upper) return lt + (ut-lt)*(concentration-lower)/(upper-lower);
  }
  throw new RangeError('Concentration is outside the teaching-data table.');
}

export function absorbanceFromPercentT(value) {
  if (!Number.isFinite(value) || value <= 0 || value > 100) throw new RangeError('%T must be above 0 and at most 100.');
  return -Math.log10(value/100) || 0;
}

const PROTOCOL = [];
function add(phase,title,instruction,action,target,volume=0,extra={}) {
  PROTOCOL.push({phase,title,instruction,action,target,volume,label:instruction,detail:'',...extra});
}
function transfer(phase,title,source,destination,volume,detail='') {
  const from=targetName(source), to=targetName(destination),pipetteId=pipetteForSource(source);
  add(phase,title,`Draw ${volume} mL from ${from}.`,'aspirate',source,volume,{detail,pipetteId});
  add(phase,title,`Deliver ${volume} mL into ${to}.`,'dispense',destination,volume,{detail,pipetteId});
}
export function targetName(id) {
  return SAMPLES.find(s=>s.id===id)?.label || ({tube_dilution:'the dilution vessel',stockBottle:'Blue #1 stock',waterBottle:'distilled water',unknownBottle:'the unknown drink',cuvette:'the cuvette',spec20:'the spectrophotometer',wasteBeaker:'the waste beaker',notebook:'your notebook',pipette:'the pipette'}[id]) || id;
}
function rinse(phase,title) {
  add(phase,title,'Empty the cuvette into the waste beaker.','empty','wasteBeaker',3,{markClean:false,detail:'Discard the measured aliquot before rinsing.'});
  transfer(phase,'Rinse the cuvette','waterBottle','cuvette',3,'This source protocol uses one 3 mL water rinse between samples.');
  add(phase,'Finish the rinse','Empty the rinse water into the waste beaker.','empty','wasteBeaker',3,{markClean:true,detail:'The cuvette is marked clean only after this complete fill-and-empty rinse.'});
}
for (const sample of SAMPLES) {
  const detail=`C = (2.31 µM × ${sample.stock} mL) / 10 mL = ${sample.concentration.toFixed(3)} µM. Mixing is idealized after delivery.`;
  if (sample.stock) transfer('prepare',`Prepare ${sample.label}`,'stockBottle',sample.id,sample.stock,detail);
  if (sample.water) transfer('prepare',`Prepare ${sample.label}`,'waterBottle',sample.id,sample.water,detail);
}
transfer('blank','Load the water blank','tube_0_10','cuvette',3,'A water blank establishes the optical reference for solvent and cuvette.');
add('blank','Insert the blank','Place the blank cuvette in the spectrophotometer.','insert','spec20',0,{detail:'Use the transparent optical faces along the light path. Insertion and lid closure are schematic.'});
add('blank','Set the blank reference','Set 630 nm, then zero the instrument with the blank.','zero','spec20',0,{detail:'The blank defines 100% transmittance and zero absorbance at this wavelength.'});
rinse('blank','Empty the blank');
for (const sample of SAMPLES) {
  const title=sample.stock ? `Measure ${sample.label}` : 'Verify the blank';
  transfer('standards',title,sample.id,'cuvette',3,'A clean cuvette and a fixed 3 mL aliquot make the measurements comparable.');
  add('standards',title,`Insert the ${sample.label} cuvette into the spectrophotometer.`,'insert','spec20');
  add('standards',title,`Measure ${sample.label} at 630 nm.`,'measure','spec20',0,{sample:sample.id,detail:'T = %T/100; A = −log₁₀(T). The teaching-data table supplies %T.'});
  rinse('standards',`Empty ${sample.label}`);
}
add('analyze','Fit your calibration curve','Open the notebook and fit absorbance against concentration.','fit','notebook');
transfer('unknown','Measure the original drink','unknownBottle','cuvette',3);
add('unknown','Load the original drink','Insert the original drink cuvette.','insert','spec20');
add('unknown','Read the original drink','Measure the undiluted sample at 630 nm.','measure','spec20',0,{sample:'unknown'});
add('analyze','Design a dilution','Open the notebook. Choose a dilution that brings the drink inside your standards.','plan','notebook');
rinse('dilute','Discard the original drink');
transfer('recipe','Prepare the dilution','unknownBottle','tube_dilution',0);
transfer('recipe','Complete the dilution','waterBottle','tube_dilution',0);
transfer('dilute','Sample the diluted drink','tube_dilution','cuvette',3,'Mixing is idealized after water delivery. The aliquot has the composition of the whole mixture.');
add('dilute','Load the dilution','Insert the diluted drink cuvette.','insert','spec20');
add('dilute','Read the dilution','Measure the diluted sample at 630 nm.','measure','spec20',0,{sample:'tube_dilution'});
add('analyze','Report the original concentration','Use your fitted slope and dilution factor in the notebook.','report','notebook');
export const STEPS=Object.freeze(PROTOCOL.map((step,index)=>Object.freeze({...step,index,total:PROTOCOL.length})));

function liquid(volume=0, stockVolume=0, waterVolume=0, unknownVolume=0) {
  return {volume,stockVolume,waterVolume,unknownVolume,concentration:unknownVolume ? null : calculateConcentration(stockVolume,waterVolume),source:null};
}
export function createState() {
  return {
    step:0,status:'running',finished:false,wavelength:TARGET_WAVELENGTH,zeroed:false,zeroWavelength:null,
    pipette:liquid(),waterPipette:liquid(),unknownPipette:liquid(),cuvette:{...liquid(),clean:true,inserted:false},
    analysis:{fitted:false,aliquot:null,report:null},
    tubes:{...Object.fromEntries(SAMPLES.map(s=>[s.id,liquid()])),tube_dilution:liquid()},
    bottles:{stockBottle:{...liquid(1000,1000,0),capacity:1000},waterBottle:{...liquid(1000,0,1000),capacity:1000},unknownBottle:{...liquid(500,0,0,500),capacity:500}},
    waste:0,wasteContents:liquid(),results:{},reading:null,history:[],transfer:null
  };
}

export function getStep(state) {
  if (state.finished || state.step>=STEPS.length) return {index:STEPS.length,total:STEPS.length,phase:'complete',title:'Experiment complete',instruction:'Your results and procedure record are ready in the notebook.',action:null,target:null,volume:0,label:'Experiment complete',detail:'Export your results, or reset to carry out the experiment again.'};
  const step=STEPS[state.step];
  if(step.phase==='recipe'){
    const drawing=step.action==='aspirate';
    const source=drawing?step.target:STEPS[state.step-1].target;
    const volume=source==='unknownBottle'?state.analysis.aliquot:FINAL_VOLUME-state.analysis.aliquot;
    const instruction=drawing?`Draw ${volume} mL from ${targetName(source)}.`:`Deliver ${volume} mL into the dilution vessel.`;
    return {...step,volume,instruction,label:instruction};
  }
  if (step.action==='empty' && state.cuvette.inserted) return {...step,action:'remove',target:'cuvette',volume:0,title:'Withdraw the cuvette',instruction:'Remove the cuvette from the spectrophotometer.',label:'Remove cuvette',detail:'Withdraw the cuvette before carrying it to waste.'};
  return step;
}

export function setStatus(state,status) {
  if (!['running','paused','stopped'].includes(status)) return {ok:false,message:'Choose Run, Pause, or Stop.'};
  state.status=status;
  return {ok:true,message:status==='running' ? 'Ready to continue.' : status==='paused' ? 'Experiment paused.' : 'Experiment stopped. Partial transfers are preserved; Run resumes the current step.'};
}

// Both the bench LCD and the HUD display the last acquisition for the seated
// cuvette. Opening the lid suspends the display. Removing or retuning clears it.
export function instrumentDisplay(state) {
  if (state.lidOpen) return {caption:'Chamber open', reading:null};
  if (!state.cuvette.inserted) return {caption:'Chamber empty', reading:null};
  if (state.wavelength !== TARGET_WAVELENGTH) return {caption:`Select ${TARGET_WAVELENGTH} nm`, reading:null};
  if (!state.zeroed || state.zeroWavelength !== state.wavelength) return {caption:'Set blank reference', reading:null};
  const reading = state.reading;
  return {caption:reading ? (reading.id ? 'Reading recorded' : 'Blank reference set') : 'Ready to read', reading};
}

export function setWavelength(state,value) {
  if (!Number.isFinite(value) || value<400 || value>700) return {ok:false,message:'Choose a wavelength from 400 to 700 nm.'};
  if (state.status!=='running') return {ok:false,message:'Choose Run before changing the wavelength.'};
  state.wavelength=value;
  state.zeroed=state.zeroWavelength===value;
  state.reading=null;
  return {ok:true,message:value===TARGET_WAVELENGTH ? (state.zeroed ? '630 nm selected. The existing blank reference applies.' : '630 nm selected. Blank the instrument before measuring.') : 'This experiment requires 630 nm. The blank reference is wavelength-specific.'};
}

function fail(message) { return {ok:false,message}; }
function amountFrom(source,volume) {
  const fraction=volume/source.volume;
  return {...liquid(volume,source.stockVolume*fraction,source.waterVolume*fraction,source.unknownVolume*fraction),source:source.source};
}
function removeAmount(source,amount) {
  const empty=amount.volume>=source.volume;
  // Keep small positive remainders: a partial stroke must not silently discard
  // its last fraction merely because it is smaller than the validation tolerance.
  for (const key of ['volume','stockVolume','waterVolume','unknownVolume']) source[key]=empty ? 0 : Math.max(0,source[key]-amount[key]);
  source.concentration=source.unknownVolume ? null : calculateConcentration(source.stockVolume,source.waterVolume);
  if (!source.volume) source.source=null;
}
function addAmount(destination,amount) {
  for (const key of ['volume','stockVolume','waterVolume','unknownVolume']) destination[key]+=amount[key];
  destination.concentration=destination.unknownVolume ? null : calculateConcentration(destination.stockVolume,destination.waterVolume);
  destination.source=amount.source;
}
function validateLiquid(l,capacity) {
  if(!l||!Number.isFinite(capacity)||capacity<0||!['volume','stockVolume','waterVolume','unknownVolume'].every(k=>positive(l[k]))||l.volume>capacity+EPS||Math.abs(l.volume-l.stockVolume-l.waterVolume-l.unknownVolume)>=EPS)return false;
  return l.unknownVolume>0 ? l.concentration===null : Number.isFinite(l.concentration)&&Math.abs(l.concentration-calculateConcentration(l.stockVolume,l.waterVolume))<EPS;
}

function sourceFractions(id,aliquot){
  if(id==='tube_dilution' && aliquot>0)return [0,1-aliquot/FINAL_VOLUME,aliquot/FINAL_VOLUME];
  if(id==='stockBottle')return [1,0,0];
  if(id==='waterBottle')return [0,1,0];
  if(id==='unknownBottle')return [0,0,1];
  const sample=SAMPLES.find(s=>s.id===id);
  return sample?[sample.stock/10,sample.water/10,0]:null;
}
function matchesSource(l,id,volume,aliquot){
  const fractions=sourceFractions(id,aliquot);
  return !!fractions&&Math.abs(l.volume-volume)<EPS&&['stockVolume','waterVolume','unknownVolume'].every((key,i)=>Math.abs(l[key]-volume*fractions[i])<EPS);
}
function transferProgress(state,step,action,target){
  const t=state.transfer;
  if(t==null)return {ok:true,delivered:0,remaining:step.volume};
  if(typeof t!=='object'||t.step!==state.step||t.action!==action||t.target!==target||t.goal!==step.volume||!Number.isFinite(t.delivered)||t.delivered<0||t.delivered>=t.goal)return fail('Finish the matching partial transfer before starting another operation.');
  return {ok:true,delivered:t.delivered,remaining:t.goal-t.delivered};
}

/** Pure preflight: failed operations never mutate the supplied state. */
export function validate(state,action,target,pipetteId) {
  if (!state||state.status!=='running') return fail('Choose Run to continue the experiment.');
  if(!Number.isInteger(state.step)||state.step<0||state.step>STEPS.length)return fail('The protocol state is inconsistent. Reset the experiment.');
  if(!state.tubes||typeof state.tubes!=='object'||!state.bottles||typeof state.bottles!=='object'||!Array.isArray(state.history))return fail('The experiment state is incomplete. Reset the experiment.');
  const step=getStep(state);
  if (!step.action) return fail('The experiment is complete. Open the notebook or reset.');
  if (action!==step.action || target!==step.target) return fail(`Next: ${step.instruction}`);
  const tool=pipetteId??step.pipetteId;
  if(step.pipetteId && (tool!==step.pipetteId || (state.transfer?.pipetteId && state.transfer.pipetteId!==tool)))
    return fail('Use the '+PIPETTES[step.pipetteId].name.toLowerCase()+' for this transfer.');
  const p=state[tool||'pipette'],c=state.cuvette;
  if (!validateLiquid(p,10) || !validateLiquid(c,4)) return fail('The liquid state is inconsistent. Reset the experiment.');
  if(state.transfer!=null&&!['aspirate','dispense'].includes(action))return fail('Finish the partial pipette transfer first.');
  const progress=['aspirate','dispense'].includes(action)?transferProgress(state,step,action,target):null;
  if(progress&&!progress.ok)return progress;
  if (action==='aspirate') {
    const source=state.tubes?.[target]||state.bottles?.[target];
    if (!source || !validateLiquid(source,state.tubes?.[target]?10:source.capacity)||!matchesSource(source,target,source.volume,state.analysis.aliquot)) return fail('This source is unavailable or its contents are inconsistent.');
    if (!matchesSource(p,target,progress.delivered,state.analysis.aliquot)||(progress.delivered>0?p.source!==target:p.source!==null)) return fail('The pipette contains liquid unrelated to this transfer.');
    if (source.volume<progress.remaining) return fail(`Not enough liquid: ${progress.remaining} mL is still required.`);
    if(p.volume+progress.remaining>10+EPS)return fail('That aspiration would overflow the pipette.');
    if (c.inserted) return fail('Remove the cuvette before preparing the next sample.');
  }
  if (action==='dispense') {
    const destination=target==='cuvette'?c:state.tubes?.[target],capacity=target==='cuvette'?4:10;
    const sourceID=STEPS[state.step-1]?.action==='aspirate'?STEPS[state.step-1].target:null;
    if (!validateLiquid(destination,capacity)) return fail('Choose a sample tube or cuvette with consistent contents.');
    if (p.source!==sourceID||!matchesSource(p,sourceID,progress.remaining,state.analysis.aliquot)) return fail(`The pipette must hold the remaining ${progress.remaining} mL from the correct source.`);
    if (destination.volume+progress.remaining>capacity+EPS) return fail('That delivery would overflow the vessel.');
    const sample=SAMPLES.find(s=>s.id===target),baseStock=sample&&sourceID==='waterBottle'?sample.stock:0,fractions=sourceFractions(sourceID,state.analysis.aliquot);
    const baseUnknown=target==='tube_dilution'&&sourceID==='waterBottle'?state.analysis.aliquot:0;
    const expected=[baseStock+progress.delivered*fractions[0],progress.delivered*fractions[1],baseUnknown+progress.delivered*fractions[2]];
    if(Math.abs(destination.volume-baseStock-baseUnknown-progress.delivered)>=EPS||['stockVolume','waterVolume','unknownVolume'].some((key,i)=>Math.abs(destination[key]-expected[i])>=EPS))return fail('The receiving vessel does not match this partial transfer.');
    if(progress.delivered>0&&destination.source!==(target==='cuvette'?sourceID:target))return fail('The receiving vessel contains an unrelated aliquot.');
    if (target==='cuvette') {
      if (c.inserted) return fail('Remove the cuvette before filling it.');
      if (!c.clean && p.source!=='waterBottle') return fail('Complete the water rinse before adding another sample.');
    }
  }
  if (action==='insert') {
    if (c.inserted) return fail('The cuvette is already in the spectrophotometer.');
    if (Math.abs(c.volume-3)>EPS) return fail('Fill the cuvette with a 3 mL aliquot first.');
    if (!c.clean) return fail('Rinse the cuvette before measuring a new sample.');
  }
  if (action==='remove' && !c.inserted) return fail('The cuvette is already on the bench.');
  if (action==='empty') {
    if (c.inserted) return fail('Remove the cuvette before emptying it.');
    if (c.volume<=EPS) return fail('The cuvette is already empty.');
    if (state.waste+c.volume>250+EPS) return fail('The waste beaker is full.');
    if (step.markClean && (c.source!=='waterBottle'||c.concentration!==0)) return fail('A complete clean-water rinse is required.');
  }
  if (action==='zero' || action==='measure') {
    if (!c.inserted || Math.abs(c.volume-3)>EPS) return fail('Insert a filled cuvette first.');
    if (state.lidOpen===true) return fail('Close the sample chamber lid before reading the cuvette.');
    if (state.wavelength!==TARGET_WAVELENGTH) return fail('Set the wavelength to 630 nm.');
    if (action==='zero' && (c.source!=='tube_0_10'||c.concentration!==0)) return fail('Blank the instrument with the water blank.');
    if (action==='measure') {
      if (!state.zeroed || state.zeroWavelength!==state.wavelength) return fail('A valid blank reference is required at 630 nm.');
      if (!c.clean) return fail('Use a rinsed cuvette.');
      if (c.source!==(step.sample==='unknown'?'unknownBottle':step.sample)) return fail('Load the sample named in the current instruction.');
      const a=absorbanceFromPercentT(signal(c));
      if (a>MAX_ABSORBANCE) return fail('Absorbance exceeds the instrument’s teaching range.');
    }
  }
  return {ok:true,message:'Ready.'};
}

function recordAction(state,step,action,target,message){
  state.history.push({number:state.history.length+1,step:state.step,action,target,volume:step.volume,...(step.pipetteId?{pipetteId:step.pipetteId}:{}),message});
  if(action!=='remove')state.step++;
  state.finished=state.step>=STEPS.length;
}

/** Begin or resume one prescribed pipette stroke without transferring liquid. */
export function beginTransfer(state,action,target,pipetteId){
  if(!['aspirate','dispense'].includes(action))return fail('Choose an aspiration or delivery to begin a pipette transfer.');
  const checked=validate(state,action,target,pipetteId);
  if(!checked.ok)return checked;
  const step=getStep(state);
  if(state.transfer==null)state.transfer={action,target,pipetteId:step.pipetteId,goal:step.volume,delivered:0,step:state.step};
  return {ok:true,message:state.transfer.delivered?'Continue the partial transfer.':'Ready to transfer.',transferred:0,remaining:state.transfer.goal-state.transfer.delivered,complete:false};
}

/**
 * Transfer at most volumeML of the currently armed stroke. Every increment
 * changes real material state; only reaching the prescribed goal records a step.
 */
export function advanceTransfer(state,volumeML,pipetteId){
  if(!Number.isFinite(volumeML)||volumeML<0)return fail('Transfer volume must be finite, nonnegative mL.');
  const t=state?.transfer;
  if(!t)return fail('Begin a pipette transfer first.');
  const tool=pipetteId??t.pipetteId??getStep(state).pipetteId;
  const checked=validate(state,t.action,t.target,tool);
  if(!checked.ok)return checked;
  const remaining=t.goal-t.delivered;
  if(volumeML===0)return {ok:true,message:'No liquid transferred.',transferred:0,remaining,complete:false};
  let amount=Math.min(volumeML,remaining);const completing=volumeML>=remaining;
  const source=t.action==='aspirate'?(state.tubes[t.target]||state.bottles[t.target]):state[tool];
  const destination=t.action==='aspirate'?state[tool]:t.target==='cuvette'?state.cuvette:state.tubes[t.target];
  // The pipette's conserved remainder is authoritative. Repeated floating-point
  // additions/subtractions can differ from goal-delivered by a few ulps; drain
  // the validated remainder instead of leaving or discarding fictitious residue.
  if(completing&&t.action==='dispense')amount=source.volume;
  // Do not round the source up to the requested amount if its material is missing.
  if(amount>source.volume)return fail('There is not enough liquid to complete this increment.');
  const dose=amountFrom(source,amount);
  if(t.action==='aspirate')dose.source=t.target;
  addAmount(destination,dose);removeAmount(source,dose);
  if(t.action==='dispense'&&t.target!=='cuvette')destination.source=t.target;
  t.delivered+=amount;
  if(completing){
    const step=getStep(state),message=t.action==='aspirate'?`Drew ${t.goal} mL from ${targetName(t.target)}.`:`Delivered ${t.goal} mL into ${targetName(t.target)}.`;
    state.transfer=null;recordAction(state,step,t.action,t.target,message);
    return {ok:true,message,transferred:amount,remaining:0,complete:true};
  }
  return {ok:true,message:`Transferred ${t.delivered.toFixed(2)} of ${t.goal} mL.`,transferred:amount,remaining:t.goal-t.delivered,complete:false};
}

function signal(cuvette){
  if(!cuvette.unknownVolume)return percentT(cuvette.concentration);
  return 100 * (UNDILUTED_PERCENT_T/100) ** (cuvette.unknownVolume/cuvette.volume);
}

export function perform(state,action,target,pipetteId) {
  if(['fit','plan','report'].includes(action))return fail('Complete this decision in the notebook.');
  if(['aspirate','dispense'].includes(action)){
    const started=beginTransfer(state,action,target,pipetteId);
    return started.ok?advanceTransfer(state,started.remaining):started;
  }
  const checked=validate(state,action,target,pipetteId);
  if (!checked.ok) return checked;
  const step=getStep(state),c=state.cuvette;
  let message='Action complete.';
  switch(action) {
    case 'insert': c.inserted=true; state.reading=null; message='Cuvette seated in the sample chamber.'; break;
    case 'remove': c.inserted=false; state.reading=null; message='Cuvette removed from the instrument.'; break;
    case 'empty': {
      const dose=amountFrom(c,c.volume); addAmount(state.wasteContents,dose); state.waste+=dose.volume; removeAmount(c,dose);
      c.clean=!!step.markClean; message=c.clean?'Rinse discarded. The cuvette is clean.':'Aliquot discarded. Rinse the cuvette next.'; break;
    }
    case 'zero': state.zeroed=true;state.zeroWavelength=state.wavelength;state.reading={percentT:100,transmittance:1,absorbance:0,label:'Water blank'};message='Blank reference set: 100.0%T / 0.0000 A at 630 nm.';break;
    case 'measure': {
      const isUnknown=step.sample==='unknown', t=signal(c),raw=absorbanceFromPercentT(t),a=round(raw,4);
      const result={id:step.sample,label:isUnknown?'Original drink':targetName(step.sample),concentration:isUnknown?null:c.concentration,percentT:t,transmittance:t/100,absorbance:a,absorbanceRaw:raw,wavelength:state.wavelength,volume:c.volume};
      if(c.unknownVolume){
        const fit=fitCalibration(state);
        result.inRange=a>=fit.minA && a<=fit.maxA;
        result.dilutionFactor=c.volume/c.unknownVolume;
      }
      state.results[step.sample]=result; state.reading={...result};message=`Recorded ${t.toFixed(1)}%T and ${a.toFixed(4)} absorbance.`;break;
    }
  }
  recordAction(state,step,action,target,message);
  return {ok:true,message};
}

export function fitCalibration(state) {
  const points=SAMPLES.filter(s=>state.results[s.id]).map(s=>({concentration:state.results[s.id].concentration,absorbance:state.results[s.id].absorbance}));
  const xx=points.reduce((sum,p)=>sum+p.concentration*p.concentration,0),xy=points.reduce((sum,p)=>sum+p.concentration*p.absorbance,0);
  const measuredSlope=xx>0?xy/xx:null;
  const mean=points.length?points.reduce((sum,p)=>sum+p.absorbance,0)/points.length:0;
  const total=points.reduce((sum,p)=>sum+(p.absorbance-mean)**2,0),residual=measuredSlope===null?0:points.reduce((sum,p)=>sum+(p.absorbance-measuredSlope*p.concentration)**2,0);
  const nonblank=points.filter(p=>p.concentration>0);
  return {slope:measuredSlope,method:'least-squares-through-origin',intercept:0,
    rSquared:points.length>1&&total>EPS?1-residual/total:null,count:points.length,
    complete:points.length===SAMPLES.length,minA:nonblank.length?Math.min(...nonblank.map(p=>p.absorbance)):null,
    maxA:nonblank.length?Math.max(...nonblank.map(p=>p.absorbance)):null,
    maxConcentration:points.length?Math.max(...points.map(p=>p.concentration)):null};
}

export function notebookDecision(state,action,input={}){
  const gate=validate(state,action,'notebook');
  if(!gate.ok)return gate;
  const fit=fitCalibration(state);
  let message;
  if(action==='fit'){
    if(!fit.complete || !(fit.slope>0))return fail('Measure every standard and the blank first.');
    state.analysis.fitted=true;
    message='Calibration fitted. Measure the original drink.';
  }else if(action==='plan'){
    const aliquot=input.aliquot;
    if(!Number.isInteger(aliquot)||aliquot<1||aliquot>=FINAL_VOLUME)return fail('Choose a whole number from 1 to 9 mL.');
    const predicted=state.results.unknown.absorbance*aliquot/FINAL_VOLUME;
    if(predicted<fit.minA)return fail('That dilution would fall below the weakest dye standard. Use more drink.');
    if(predicted>fit.maxA)return fail('That dilution would exceed the strongest standard. Use less drink.');
    state.analysis.aliquot=aliquot;
    message='Dilution recorded. Prepare it at the bench.';
  }else if(action==='report'){
    const r=state.results.tube_dilution;
    if(!r?.inRange || !state.analysis.fitted)return fail('Obtain a reading bracketed by your standards first.');
    const diluted=r.absorbance/fit.slope, factor=r.dilutionFactor, original=diluted*factor;
    const agrees=(n,value)=>Number.isFinite(n)&&Math.abs(n-value)<=value*.01;
    if(!agrees(input.diluted,diluted))return fail('For the diluted concentration, divide the second absorbance by your fitted slope.');
    if(!agrees(input.factor,factor))return fail('Divide the final mixture volume by the volume of original drink transferred.');
    if(!agrees(input.original,original))return fail('Multiply the diluted concentration by the dilution factor to recover the original.');
    state.analysis.report={submitted:{...input},diluted,factor,original};
    message='Report accepted. Your worked calculation is in the notebook.';
  }else return fail('Choose a notebook decision.');
  recordAction(state,getStep(state),action,'notebook',message);
  return {ok:true,message};
}

export function totalVolume(state) {
  return Object.values(state.bottles).reduce((n,l)=>n+l.volume,0)+Object.values(state.tubes).reduce((n,l)=>n+l.volume,0)+pipetteIds.reduce((sum,id)=>sum+state[id].volume,0)+state.cuvette.volume+state.waste;
}
