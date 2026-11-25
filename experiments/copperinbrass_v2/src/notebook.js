import { samples, concentrations, fitStandards } from './model.js';
import { label, word, legacy } from './language.js';
const $ = (id) => document.getElementById(id);
const svgNS = 'http://www.w3.org/2000/svg';
const x = (c) => 44 + (235 * c) / 0.45,
  y = (a) => 114 - a * 91;
function svg(tag, props, text = '') {
  const el = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(props)) el.setAttribute(key, value);
  el.textContent = text;
  return el;
}
function plot(element, s) {
  const fit = fitStandards(s.readings),
    nodes = [];
  for (const value of [0, 0.5, 1]) {
    nodes.push(
      svg('path', { d: 'M44 ' + y(value) + 'H280', stroke: '#43616d', 'stroke-opacity': '.7' })
    );
    nodes.push(svg('text', { x: 36, y: y(value) + 4, 'text-anchor': 'end' }, value.toFixed(1)));
  }
  for (const c of [0, 0.1, 0.2, 0.3, 0.4])
    nodes.push(svg('text', { x: x(c), y: 128, 'text-anchor': 'middle' }, c.toFixed(1)));
  nodes.push(
    svg('text', { x: 12, y: 18 }, 'A'),
    svg('text', { x: 164, y: 145, 'text-anchor': 'middle' }, 'Cu²⁺ (mol/L)')
  );
  nodes.push(svg('path', { d: 'M44 18V114H280', fill: 'none', stroke: '#9eb7c1' }));
  if (fit)
    nodes.push(
      svg('path', {
        d:
          'M' +
          x(0.015) +
          ' ' +
          y(fit.intercept + fit.slope * 0.015) +
          'L' +
          x(0.415) +
          ' ' +
          y(fit.intercept + fit.slope * 0.415),
        stroke: '#79e0ea',
        'stroke-width': 2,
        fill: 'none',
      })
    );
  for (const row of s.readings) {
    let c = row.concentration;
    if (c == null) {
      if (!fit) continue;
      c = (row.absorbance - fit.intercept) / fit.slope;
      nodes.push(
        svg('path', {
          d: 'M44 ' + y(row.absorbance) + 'H' + x(c) + 'V114',
          fill: 'none',
          stroke: '#eeb778',
          'stroke-dasharray': '3 3',
        })
      );
    }
    nodes.push(
      svg('circle', {
        cx: x(c),
        cy: y(row.absorbance),
        r: 3.9,
        fill: row.id === 'unknown' ? '#eeb778' : '#a9ecf0',
        stroke: '#153847',
      })
    );
  }
  element.replaceChildren(...nodes);
}
export function drawBook(s) {
  const mass = s.weighed ? s.mass.toFixed(3) + ' g' : '—';
  $('mass').textContent = $('bookMass').textContent = mass;
  $('condition').textContent =
    s.fluid === 'reacting'
      ? word('reacting')
      : legacy('conditions.' + (s.brass === 'dissolved' ? 'dissolved' : 'solid'));
  $('reading').textContent = s.reading == null ? '—' : s.reading.toFixed(3) + ' A';
  $('standardCount').textContent = s.readings.filter((r) => r.id.startsWith('std_')).length + ' / 3';
  $('bookVolume').textContent = s.flask === 'diluted' ? '100.0 mL' : '—';
  $('bookAnswer').textContent = s.answer == null ? '—' : s.answer + '%';
  $('readings').replaceChildren(
    ...samples.map((id) => {
      const row = s.readings.find((r) => r.id === id),
        tr = document.createElement('tr');
      for (const value of [
        label(id),
        concentrations[id]?.toFixed(3) ?? '?',
        row?.absorbance.toFixed(3) ?? '—',
      ]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      return tr;
    })
  );
  const fit = fitStandards(s.readings);
  $('fit').textContent = fit
    ? word('fit') +
      ' · A = ' +
      fit.slope.toFixed(3) +
      'c ' +
      (fit.intercept < 0 ? '−' : '+') +
      ' ' +
      Math.abs(fit.intercept).toFixed(4)
    : '';
  plot($('hudPlotCopper'), s);
  plot($('bookPlot'), s);
  $('checks').replaceChildren(
    ...s.cleanup.map((checked, i) => {
      const item = document.createElement('label'),
        check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = checked;
      check.dataset.index = i;
      item.append(check, document.createTextNode(legacy('ui.cleanupItem' + (i + 1))));
      return item;
    })
  );
  $('cleanupBox').disabled = s.index !== 58;
  $('answer').disabled = $('checkAnswer').disabled = s.index !== 59;
  if (s.answer != null) $('answer').value = s.answer;
}
export function exportCSV(s) {
  const rows = [
    ['Sample', 'Concentration (mol/L)', 'Absorbance'],
    ...s.readings.map((r) => [r.id, r.concentration ?? '', r.absorbance.toFixed(3)]),
    [],
    ['Brass mass (g)', s.weighed ? s.mass.toFixed(3) : ''],
    ['Final volume (L)', s.flask === 'diluted' ? '0.100' : ''],
    ['Reported Cu (%)', s.answer ?? ''],
    ['Completed steps', s.index],
    ['Cleanup complete', s.index >= 59 ? 'yes' : 'no'],
  ];
  const fit = fitStandards(s.readings);
  if (fit)
    rows.push(
      ['Measured slope (L/mol)', fit.slope.toFixed(5)],
      ['Measured intercept', fit.intercept.toFixed(5)]
    );
  const file = new Blob([rows.map((row) => row.join(',')).join('\r\n') + '\r\n'], {
    type: 'text/csv;charset=utf-8',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = 'copper-in-brass.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
}
