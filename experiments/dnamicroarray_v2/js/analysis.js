/* =============================================================================
 * analysis.js  —  Results table, colour legend and answer checking.
 *
 * Scoring rules are preserved exactly from the original experiment
 * (red=↑, green=↓, yellow==, black=– / blank).  Exposed as  Lab.analysis
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config, S = Lab.state.S;
  var section = null, tbody = null, feedback = null, legendHost = null, built = false;

  function init(refs) {
    section = refs.section;
    feedback = refs.feedback;
    legendHost = refs.legend;
    rebuildLegend();
    buildTable(refs.table);
    if (refs.checkBtn) refs.checkBtn.addEventListener('click', check);
    if (refs.eraseBtn) refs.eraseBtn.addEventListener('click', erase);
    if (refs.cvdToggle) {
      refs.cvdToggle.addEventListener('change', function () {
        document.body.classList.toggle('cvd-assist', refs.cvdToggle.checked);
      });
    }
  }

  function sci(name, variant) {
    return (Lab.theme && Lab.theme.sci)
      ? Lab.theme.sci(name, variant)
      : cfg.SPOT_COLORS[name][variant || 'base'];
  }
  function ring(name, variant) {
    return (Lab.theme && Lab.theme.sciRing)
      ? Lab.theme.sciRing(name, variant)
      : cfg.SPOT_COLORS[name][variant || 'base'];
  }

  /* ----- legend ----------------------------------------------------------
     The swatch carries a same-hue, darker rim rather than a translucent black
     inset.  The old inset was ~1.3:1 for yellow on the panel background;
     WCAG 1.4.11 needs >= 3:1 for a graphic that carries meaning, and the rim
     supplies that boundary without shifting the hue students must recognise. */
  function rebuildLegend() {
    if (!legendHost) return;
    var order = ['red', 'green', 'yellow', 'black'];
    legendHost.innerHTML = order.map(function (c) {
      var L = cfg.LEGEND[c];
      return '<div class="legend-item">' +
        '<span class="legend-swatch" style="background:' + sci(c, 'base') +
          ';--swatch-ring:' + ring(c, 'base') + '"></span>' +
        '<div><b><span class="legend-sym">' + L.symbol + '</span> ' + L.word + '</b>' +
        '<span class="legend-keys">type ' + L.keys.filter(Boolean).join(' or ') + '</span>' +
        '<span class="legend-desc">' + L.meaning + '</span></div></div>';
    }).join('');
  }

  /* ----- table -----------------------------------------------------------
     COLUMNS[].desc used to live only in a title="" tooltip, which is invisible
     on touch and to most students.  It is real science content, so it is
     rendered. */
  function buildTable(table) {
    if (!table || built) return;
    var head = '<thead><tr><th scope="col">Patient</th>';
    cfg.COLUMNS.forEach(function (c) {
      head += '<th scope="col">' +
        '<span class="col-n">' + c.col + '</span>' +
        '<span class="col-gene">' + c.label + '</span>' +
        '<span class="col-desc">' + shortDesc(c) + '</span>' +
      '</th>';
    });
    head += '</tr></thead>';

    var body = '<tbody>';
    cfg.PATIENTS.forEach(function (p) {
      body += '<tr><th scope="row" class="patient-cell">' + p.n + '. ' + p.name +
              ' <span class="p-row">' + p.row + '</span></th>';
      for (var col = 1; col <= cfg.COLS; col++) {
        var id = p.row + col;
        body += '<td><input type="text" maxlength="1" id="ans-' + id + '" ' +
          'data-id="' + id + '" aria-label="Result for spot ' + id + '" autocomplete="off"></td>';
      }
      body += '</tr>';
    });
    body += '</tbody>';
    table.innerHTML = head + body;
    tbody = table.querySelector('tbody');
    built = true;
  }

  // the headline of the gene's role, without the full sentence
  function shortDesc(c) {
    var d = c.desc || '';
    var cut = d.split(/[—–-]/)[0].trim();
    return cut.length > 34 ? cut.slice(0, 32) + '…' : cut;
  }

  /* ----- reveal --------------------------------------------------------- */
  function reveal() {
    if (!section) return;
    if (section.hasAttribute('hidden')) {
      section.removeAttribute('hidden');
      if (Lab.env.gsap && !(Lab.theme && Lab.theme.reducedMotion)) {
        gsap.from(section, { opacity: 0, y: 24, duration: 0.5, ease: 'expo.out' });
      }
    }
  }

  /* ----- checking ------------------------------------------------------- */
  function symbolMatches(colorName, value) {
    return cfg.LEGEND[colorName].keys.indexOf(value) !== -1;
  }

  function check() {
    if (!tbody) return;
    var correct = 0, applicable = 0;
    var missCtrl = 0, missGene = 0, swapped = 0;

    cfg.allIds().forEach(function (id) {
      var input = document.getElementById('ans-' + id);
      if (!input) return;
      var spot = S.spots[id];
      var val = input.value.trim().toLowerCase();
      input.classList.remove('right', 'wrong', 'na');
      if (spot.sample) {
        applicable++;
        if (symbolMatches(spot.color, val)) { correct++; input.classList.add('right'); }
        else {
          input.classList.add('wrong');
          var col = parseInt(id.slice(1), 10);
          if (col <= 4) missCtrl++; else missGene++;
          // up/down confusion is the classic error, and the one that matters
          if ((spot.color === 'red' && symbolMatches('green', val)) ||
              (spot.color === 'green' && symbolMatches('red', val))) swapped++;
        }
      } else {
        if (val === '' || val === '-') input.classList.add('na');
        else input.classList.add('wrong');
      }
    });

    var perfect = applicable > 0 && correct === applicable;
    if (feedback) {
      feedback.innerHTML = 'You scored <b>' + correct + ' / ' + applicable + '</b>. ' +
        (perfect ? praise() : diagnose(swapped, missCtrl, missGene));
      feedback.className = 'feedback ' + (perfect ? 'good' : 'bad');
    }
    if (perfect) Lab.engine.onAnalysisComplete();
  }

  // Say what to look at, not just that something is wrong.
  function diagnose(swapped, missCtrl, missGene) {
    if (swapped >= 2) {
      return 'Several spots have up- and down-regulation the wrong way round — ' +
             'red is <b>↑ up</b>, green is <b>↓ down</b>. Re-check those against the legend.';
    }
    if (missCtrl > 0 && missGene === 0) {
      return 'The genes are right, but some controls are not. Columns 1–4 read the ' +
             'same for every patient — Normal, Up, Down, Blank — so they are the ' +
             'fastest way to check your reading is calibrated.';
    }
    if (missCtrl > 0) {
      return 'Start with columns 1–4: those controls are identical for every ' +
             'patient, so if one is wrong the rest of that row is worth re-reading.';
    }
    return 'Compare the highlighted spots against the legend and read them again ' +
           'under the lamp.';
  }

  function praise() {
    return 'Every spot read correctly. Now look across the rows: the four patients ' +
           'do not share one profile, and the differences are the actual result.';
  }

  function erase() {
    if (!tbody) return;
    tbody.querySelectorAll('input').forEach(function (i) {
      i.value = ''; i.classList.remove('right', 'wrong', 'na');
    });
    if (feedback) { feedback.textContent = ''; feedback.className = 'feedback'; }
  }

  Lab.analysis = {
    init: init,
    reveal: reveal,
    check: check,
    erase: erase,
    rebuildLegend: rebuildLegend
  };
})(window.Lab = window.Lab || {});
