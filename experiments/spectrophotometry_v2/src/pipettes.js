// IDs are shared by the apparatus, transfer model, controls and notebook.
export const PIPETTES=Object.freeze({
 pipette:{name:'Stock / standards pipette',mark:'STOCK',color:'#bd7155',stand:'pipetteStand'},
 waterPipette:{name:'Distilled-water pipette',mark:'WATER',color:'#398da7',stand:'waterPipetteStand'},
 unknownPipette:{name:'Unknown pipette',mark:'UNKNOWN',color:'#8b61a5',stand:'unknownPipetteStand'}
});
export const pipetteIds=Object.keys(PIPETTES);
export const isPipette=id=>Object.hasOwn(PIPETTES,id);
// The first etched division is 0.2 mL at y=.225. Below it the bore tapers to the tip.
export function pipetteLevel(volume){
 const ml=Math.min(10,Math.max(0,volume));
 return ml<.2 ? .225*ml/.2 : .2+.125*ml;
}
export function pipetteForSource(id){
 if(id==='waterBottle'||id==='tube_0_10')return 'waterPipette';
 if(id==='unknownBottle'||id==='tube_dilution')return 'unknownPipette';
 return 'pipette';
}
