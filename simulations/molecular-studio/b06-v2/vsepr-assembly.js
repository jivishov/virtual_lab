import {ELEMENTS} from './molecule-model.js';

// A socket is an electron domain. A multiple bond occupies one socket but
// contributes two or three shared electron pairs to the valence ledger.
export function electronLedger(m, sites) {
 const bondOrder=sites.reduce((n,kind)=>n+(m.pieces[kind]?.order||0),0);
 const lonePairs=sites.filter(kind=>kind==='pair').length;
 return {bondOrder,lonePairs,assigned:bondOrder+2*lonePairs,
  shell:2*(bondOrder+lonePairs),available:ELEMENTS[m.center].electrons-(m.charge||0)};
}

export function assemblyProblem(m, sites) {
 if(!Array.isArray(sites)||sites.length!==m.domains)return 'This hub has '+m.domains+' electron-domain sockets. Choose one of its labelled sites.';
 if(sites.some(kind=>!['empty','pair',...Object.keys(m.pieces)].includes(kind)))return 'Choose a piece supplied for this molecule.';
 const ledger=electronLedger(m,sites);
 if(['C','N','O','F'].includes(m.center)&&ledger.shell>8)return m.center+' cannot exceed an octet in this model. Remove a piece before adding another.';
 if(ledger.assigned>ledger.available)return 'This placement exceeds the valence-electron budget for '+m.formula+'. A multiple bond uses more than one shared pair.';
 for(const [kind,part] of Object.entries(m.pieces)){
  if(sites.filter(k=>k===kind).length>part.count)return m.formula+' supplies '+part.count+' '+m.center+'–'+(part.group?.label||part.element)+' piece'+(part.count===1?'':'s')+' of this type. Return one before adding another.';
 }
 if(ledger.lonePairs>m.pairs)return m.formula+' has '+m.pairs+' central lone pair'+(m.pairs===1?'':'s')+'. These sockets cannot hold additional lone pairs.';
 return '';
}

// Convert the old eight-direction exercise only when its occupied sites fit
// one of the real geometries. Keep the original v2 storage as an archive;
// old readings are not claimed as observations of the revised geometry.
export function migrateLegacyAssembly(m, saved) {
 if(!Array.isArray(saved?.sites)||saved.sites.length!==8)return null;
 const maps={linear:[[0,6],[1,7],[2,4],[3,5]],planar:[[0,2,4],[1,3,5]],
  tetra:[[0,2,5,7],[1,3,4,6]],tbp:[[0,1,2,3,4]],octa:[[0,1,2,3,4,5]]};
 const map=maps[m.hub.key].find(ids=>saved.sites.every((kind,i)=>kind==='empty'||ids.includes(i)));
 if(!map)return null;
 const sites=map.map(i=>saved.sites[i]);
 if(assemblyProblem(m,sites))return null;
 const torsions={};
 map.forEach((old,i)=>{const value=saved.torsions?.[String.fromCharCode(65+old)];if(Number.isFinite(value))torsions[String.fromCharCode(65+i)]=value;});
 return {sites,torsions};
}
