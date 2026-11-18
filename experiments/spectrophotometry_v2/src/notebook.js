import { SAMPLES, FINAL_VOLUME, fitCalibration, getStep, notebookDecision } from './model.js';

const el = id => document.getElementById(id);
const format = (value, places = 3) => value == null ? '—' : value.toFixed(places);
const unknowns = [['unknown', 'Original drink'], ['tube_dilution', 'Diluted drink']];

function graph(state, fit) {
  const left = 62, bottom = 252;
  const x = concentration => left + concentration * 170;
  const y = absorbance => bottom - absorbance * 465;
  const content = [];
  for (let i = 0; i <= 5; i++) {
    const a = i / 10;
    content.push(`<path d="M${left} ${y(a)}H487" stroke="#d6dde0"/><text x="51" y="${y(a)+4}" text-anchor="end">${a.toFixed(1)}</text>
      <text x="${x(i/2)}" y="273" text-anchor="middle">${(i/2).toFixed(1)}</text>`);
  }
  content.push(`<path d="M62 19V252H487" stroke="#768793" fill="none"/><text x="275" y="301" text-anchor="middle">Blue #1 concentration (µM)</text><text transform="translate(17 138) rotate(-90)" text-anchor="middle">Absorbance</text>`);
  if (state.analysis.fitted) {
    content.push(`<path d="M62 252L${x(fit.maxConcentration)} ${y(fit.maxConcentration*fit.slope)}" stroke="#246e76" stroke-width="2"/>`);
  }
  for (const sample of SAMPLES) {
    const r = state.results[sample.id];
    if (r) content.push(`<circle cx="${x(r.concentration)}" cy="${y(r.absorbance)}" r="4.5" fill="#194f63"><title>${sample.name}, ${format(r.concentration)} µM, A = ${r.absorbance}</title></circle>`);
  }
  for (const [id, label] of unknowns) {
    const r = state.results[id];
    if (!r) continue;
    const level = y(r.absorbance);
    const end = id === 'unknown' ? 487 : x(r.absorbance / fit.slope);
    content.push(`<path d="M62 ${level}H${end}${id==='tube_dilution'?'V252':''}" fill="none" stroke="#9d572c" stroke-dasharray="4 4"/>
      <text x="${id==='unknown'?482:72}" y="${level-7}" text-anchor="${id==='unknown'?'end':'start'}" fill="#884c2b">${label}</text>`);
  }
  el('calibrationGraph').innerHTML = content.join('');
  el('calibrationGraph').setAttribute('aria-label', `Absorbance against concentration. ${fit.count} calibration readings. Values appear in the measurement record.`);
}

export function renderNotebook(state) {
  const fit = fitCalibration(state), step = getStep(state), {analysis, results} = state;
  const rows = SAMPLES.map(s => {
    const r = results[s.id], tube = state.tubes[s.id];
    return [s.name, s.stock+' / '+s.water, format(r?.concentration ?? (tube.volume ? tube.concentration : null)), r];
  });
  for (const [id, name] of unknowns) rows.push([name, '—', '—', results[id]]);
  el('dataRows').innerHTML = rows.map(([name, volumes, c, r]) =>
    '<tr>'+[name,volumes,c,format(r?.percentT,1),format(r?.transmittance,3),format(r?.absorbance,4)].map(cell=>'<td>'+cell+'</td>').join('')+'</tr>').join('');
  el('calibrationSummary').textContent = analysis.fitted ? `A = ${format(fit.slope,5)} C` : `${fit.count} of 6 calibration readings`;
  el('fitSummary').textContent = analysis.fitted ? `Slope ${format(fit.slope,5)} A/µM · R² ${format(fit.rSquared,4)}. Dye standards span ${format(fit.minA,4)}–${format(fit.maxA,4)} A.` : 'Measure the blank and five standards. Fit a line through the origin using the blank-corrected absorbances.';
  el('fitButton').hidden = step.action !== 'fit';
  el('recipeArea').hidden = step.action !== 'plan';
  el('answerArea').hidden = step.action !== 'report';
  if(step.action==='plan')el('rangePrompt').textContent = `Your drink reads ${format(results.unknown.absorbance,4)} A. Your dye standards cover ${format(fit.minA,4)}–${format(fit.maxA,4)} A.`;
  if(step.action==='report')el('reportPrompt').textContent = `Your dilution reads ${format(results.tube_dilution.absorbance,4)} A. Your slope is ${format(fit.slope,5)} A/µM. You used ${analysis.aliquot} mL of drink in ${FINAL_VOLUME} mL total.`;
  el('unknownSummary').textContent = analysis.report ? 'Original concentration · '+analysis.report.original.toPrecision(3)+' µM' : results.tube_dilution ? 'Dilution measured' : analysis.aliquot ? 'Dilution recipe' : results.unknown ? 'Original drink exceeds the standards' : 'Awaiting the original drink';
  let detail = 'Use the calibration to decide whether you can report the unknown from its first reading.';
  if (results.unknown) detail = `Original absorbance ${format(results.unknown.absorbance,4)} exceeds the strongest standard (${format(fit.maxA,4)}). Select a dilution that brackets the next reading between dye standards.`;
  if (analysis.aliquot) detail = `${analysis.aliquot} mL original drink + ${FINAL_VOLUME-analysis.aliquot} mL water = ${FINAL_VOLUME} mL mixture.`;
  if (results.tube_dilution) detail += ` The diluted sample measured ${format(results.tube_dilution.absorbance,4)} A, inside your calibration range.`;
  if (analysis.report) {
    const {factor,diluted,original} = analysis.report;
    detail += ` C diluted = ${format(results.tube_dilution.absorbance,4)} ÷ ${format(fit.slope,5)} = ${format(diluted)} µM. Dilution factor = ${FINAL_VOLUME} ÷ ${analysis.aliquot} = ${format(factor)}. Using the unrounded diluted concentration gives C original ≈ ${format(original)} µM.`;
  }
  el('unknownDetail').textContent = detail;
  graph(state,fit);
}

export function bindNotebook(getState, changed) {
  for (const [button, action] of [['fitButton','fit'],['planButton','plan'],['checkEstimate','report']]) {
    el(button).onclick = () => {
      const input = {aliquot:el('aliquot').valueAsNumber};
      if (action === 'report') {
        delete input.aliquot;
        for (const key of ['diluted','factor','original']) input[key] = el(key).valueAsNumber;
      }
      const response = notebookDecision(getState(),action,input);
      el('decisionFeedback').textContent = response.message;
      if (response.ok) { changed(); el('decisionFeedback').focus(); }
    };
  }
}

export function readingsCsv(state) {
  const {analysis,results} = state, fit = fitCalibration(state);
  const rows = [['Solution','Stock mL','Water mL','Standard concentration uM','Percent T','T','Absorbance','Original drink mL in recipe','Fitted slope A/uM','Dilution factor','Reported diluted uM','Reported original uM']];
  for (const s of SAMPLES) {
    const r=results[s.id];
    rows.push([s.name,s.stock,s.water,s.concentration,r?.percentT,r?.transmittance,r?.absorbance,'',analysis.fitted?fit.slope:'','','','']);
  }
  for (const [id,name] of unknowns) {
    const r=results[id];
    if (!r) continue;
    const mixed=id==='tube_dilution', report=mixed?analysis.report?.submitted:null;
    rows.push([name,'',mixed?FINAL_VOLUME-analysis.aliquot:'','',r.percentT,r.transmittance,r.absorbance,mixed?analysis.aliquot:'',fit.slope,report?.factor,report?.diluted,report?.original]);
  }
  return rows.map(row=>row.join(',')).join('\r\n');
}
