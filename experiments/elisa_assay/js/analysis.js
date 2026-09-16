/* =============================================================================
 * analysis.js  —  Module 2: Analysis of Quantitative ELISA Results.
 *
 * Three pieces of work, in the protocol's own order:
 *
 *   Table A   the dilutions and concentrations of the standard curve
 *   Table B   what each of wells 13–24 is, how much antigen it holds, and
 *             whether that patient is positive or negative
 *   Table C   the class board, and the chain of infection it reveals
 *
 * Plus the one tool that makes the quantification possible: a colour chip
 * lifted out of a patient well and slid along the standard strip until it
 * matches.  That is what a technician physically does with two strips, and it
 * is the whole skill this module is teaching.
 *
 * Exposed as  Lab.analysis
 * ========================================================================== */
(function (Lab) {
  'use strict';

  var cfg = Lab.config, st = Lab.state, S = Lab.state.S;
  var refs = {};
  var built = false;
  var classBoardOpen = false;
  var chain = [];

  /* ======================================================================= */
  /*  Opening the module                                                     */
  /* ======================================================================= */
  function init(r) {
    refs = r;
    if (refs.collectBtn) refs.collectBtn.addEventListener('click', collectClassData);
  }

  function open(standalone) {
    if (!refs.section) return;
    buildOnce();
    moveStripsToLightBox();
    document.documentElement.setAttribute('data-mode', 'lightbox');
    if (Lab.theme) Lab.theme.invalidate();
    if (Lab.repaint) Lab.repaint();

    refs.section.removeAttribute('hidden');
    if (refs.provenance) {
      refs.provenance.textContent = standalone
        ? 'You are reading a prepared plate — the assay was run for you, controls and all.'
        : 'These are the strips you ran. Wells 19–24 carry the two samples you were handed.';
    }
    rebuildTableB();
    rebuildTableC();
    if (Lab.env.gsap && !(Lab.theme && Lab.theme.reducedMotion)) {
      gsap.from(refs.section, { opacity: 0, y: 20, duration: 0.5, ease: 'expo.out' });
    }
    refs.section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Wipe the worksheet for a new run.  The tables themselves are rebuilt
      rather than merely blanked, because Table B and Table C both depend on
      which two patients this run is for. */
  function reset() {
    chain = [];
    classBoardOpen = false;
    if (refs.collectBtn) refs.collectBtn.disabled = true;
    if (refs.chainWrap) refs.chainWrap.setAttribute('hidden', '');
    ['feedbackA', 'feedbackB', 'feedbackC'].forEach(function (k) {
      if (refs[k]) { refs[k].innerHTML = ''; refs[k].className = 'feedback'; }
    });
    if (built) {
      for (var n = 2; n <= 12; n++) {
        ['dilA-', 'concA-'].forEach(function (pre) {
          var i = document.getElementById(pre + n);
          if (i) { i.value = ''; i.classList.remove('right', 'wrong'); }
        });
      }
      rebuildTableB();
      rebuildTableC();
    }
    var chip = document.getElementById('cmp-chip');
    if (chip) {
      chip.classList.remove('is-loaded');
      chip.setAttribute('aria-hidden', 'true');
      chip.querySelector('.cmp-label').textContent = 'pick a well';
      chip.querySelector('.cmp-swatch').style.background = '';
    }
  }

  function close() {
    document.documentElement.removeAttribute('data-mode');
    if (Lab.theme) Lab.theme.invalidate();
    if (Lab.repaint) Lab.repaint();
    moveStripsToBench();
    if (refs.section) refs.section.setAttribute('hidden', '');
  }

  /* The strips are MOVED, not copied.  Two DOM copies of well 7 would mean
     two things called [data-well="7"], and every selector in the engine and
     the repainter would start picking the wrong one.

     What moves is the <svg> itself, not its bench slot: the slot is what
     stations.js made draggable and what surfaces.js rotates when the strip is
     inverted over the towels, and both of those belong to the bench. */
  function moveStripsToLightBox() {
    var host = document.getElementById('lightbox-strips');
    if (!host) return;
    ['A', 'B'].forEach(function (id) {
      var svg = Lab.surfaces.stripSvg(id);
      if (svg && svg.parentNode !== host) host.appendChild(svg);
    });
    Lab.surfaces.refreshAll(false);
  }
  function moveStripsToBench() {
    ['A', 'B'].forEach(function (id) {
      var svg = Lab.surfaces.stripSvg(id);
      var slot = Lab.surfaces.stripEl(id);
      if (svg && slot && svg.parentNode !== slot) slot.appendChild(svg);
    });
    Lab.surfaces.refreshAll(false);
  }

  /* ======================================================================= */
  /*  Table A — the standard curve                                           */
  /* ======================================================================= */
  function buildOnce() {
    if (built) return;
    built = true;
    buildTableA();
    buildComparator();
    if (refs.checkA) refs.checkA.addEventListener('click', checkTableA);
    if (refs.checkB) refs.checkB.addEventListener('click', checkTableB);
    if (refs.checkC) refs.checkC.addEventListener('click', checkChain);
    if (refs.clearChain) refs.clearChain.addEventListener('click', function () {
      chain = []; renderChain();
    });
  }

  function buildTableA() {
    if (!refs.tableA) return;
    var head = '<thead><tr><th scope="col" class="rowhead">Well #</th>';
    for (var i = 1; i <= 12; i++) head += '<th scope="col">' + i + '</th>';
    head += '</tr></thead>';

    var rowD = '<tr><th scope="row" class="rowhead">Dilution</th>';
    var rowC = '<tr><th scope="row" class="rowhead">Concentration<small>µg/mL</small></th>';
    for (var n = 1; n <= 12; n++) {
      if (n === 1) {
        rowD += '<td class="given">—</td>';
        rowC += '<td class="given">100</td>';
      } else {
        rowD += '<td><input type="text" class="cell" id="dilA-' + n + '" data-well="' + n +
                '" aria-label="Dilution in well ' + n + '" placeholder="1:?" autocomplete="off"></td>';
        rowC += '<td><input type="text" class="cell" id="concA-' + n + '" data-well="' + n +
                '" aria-label="Concentration in well ' + n + '" inputmode="decimal" autocomplete="off"></td>';
      }
    }
    rowD += '</tr>'; rowC += '</tr>';
    refs.tableA.innerHTML = head + '<tbody>' + rowD + rowC + '</tbody>';
  }

  /* "1:8", "1/8", "8", "8x" and "1 : 8" are all the same answer; a student who
     has understood the halving should not lose it to punctuation. */
  function dilutionMatches(well, typed) {
    var want = Math.pow(2, well - 1);
    var v = String(typed).replace(/\s|×|x|fold|-/gi, '');
    var m = /^1[:\/](\d+)$/.exec(v) || /^(\d+)$/.exec(v);
    if (!m) return false;
    return parseInt(m[1], 10) === want;
  }

  function checkTableA() {
    var right = 0, total = 0, dilWrong = 0, concWrong = 0;
    for (var n = 2; n <= 12; n++) {
      var d = document.getElementById('dilA-' + n);
      var c = document.getElementById('concA-' + n);
      [d, c].forEach(function (i) { if (i) i.classList.remove('right', 'wrong'); });
      total += 2;
      if (dilutionMatches(n, d.value.trim())) { right++; d.classList.add('right'); }
      else if (d.value.trim()) { d.classList.add('wrong'); dilWrong++; }
      if (cfg.concMatches(cfg.standardConc(n), c.value)) { right++; c.classList.add('right'); }
      else if (c.value.trim()) { c.classList.add('wrong'); concWrong++; }
    }
    var perfect = right === total;
    say(refs.feedbackA, 'Table A: <b>' + right + ' / ' + total + '</b>. ' + (perfect
      ? 'That is the whole point of a serial dilution — each well is exactly half the one ' +
        'before it, so the ladder is even all the way down.'
      : diagnoseA(dilWrong, concWrong)), perfect);
    if (perfect) Lab.engine.onAnalysisStep('quantify');
  }

  function diagnoseA(dilWrong, concWrong) {
    if (dilWrong && !concWrong) {
      return 'The concentrations are right, so the arithmetic is right — write the dilution as ' +
        '1:2, 1:4, 1:8 and so on, doubling the denominator at every step.';
    }
    if (concWrong && !dilWrong) {
      return 'The dilutions are right, so start from 100 µg/mL and halve it once per well: ' +
        '100, 50, 25, 12.5 …';
    }
    return 'Each well takes 50 µL of the well before it into 50 µL of buffer — equal volumes, ' +
      'so the concentration halves every time.';
  }

  /* ======================================================================= */
  /*  Table B — the controls and the two patients                            */
  /* ======================================================================= */
  function rebuildTableB() {
    if (!refs.tableB) return;
    var head = '<thead><tr>' +
      '<th scope="col">Well #</th><th scope="col">Sample name</th>' +
      '<th scope="col">Concentration<small>µg/mL</small></th>' +
      '<th scope="col">Diagnosis</th></tr></thead>';
    var body = '<tbody>';
    cfg.SAMPLE_BLOCKS.forEach(function (b) {
      b.wells.forEach(function (n, i) {
        var name = st.sampleNameFor(n);
        body += '<tr' + (i === 0 ? ' class="block-start"' : '') + '>' +
          '<th scope="row" class="wellnum">' + n + '</th>' +
          '<td class="samplename">' + (i === 0 ? Lab.ui.esc(name) : '<span class="ditto">〃</span>') + '</td>' +
          '<td><input type="text" class="cell" id="concB-' + n + '" data-well="' + n +
            '" aria-label="Concentration in well ' + n + '" inputmode="decimal" autocomplete="off"></td>' +
          '<td>' + diagnosisSelect(n) + '</td>' +
        '</tr>';
      });
    });
    body += '</tbody>';
    refs.tableB.innerHTML = head + body;
  }

  function diagnosisSelect(n) {
    return '<select class="cell cell-select" id="dxB-' + n + '" aria-label="Diagnosis for well ' + n + '">' +
      '<option value="">—</option>' +
      '<option value="pos">Positive</option>' +
      '<option value="neg">Negative</option></select>';
  }

  function checkTableB() {
    var right = 0, total = 0, dxWrong = 0, concWrong = 0, ctrlWrong = 0;
    cfg.SAMPLE_BLOCKS.forEach(function (b) {
      b.wells.forEach(function (n) {
        var want = st.expectedFor(n);
        var c = document.getElementById('concB-' + n);
        var d = document.getElementById('dxB-' + n);
        c.classList.remove('right', 'wrong');
        d.classList.remove('right', 'wrong');
        total += 2;
        if (cfg.concMatches(want, c.value)) { right++; c.classList.add('right'); }
        else if (c.value.trim()) {
          c.classList.add('wrong'); concWrong++;
          if (b.key === 'POS' || b.key === 'NEG') ctrlWrong++;
        }
        var wantDx = want > 0 ? 'pos' : 'neg';
        if (d.value === wantDx) { right++; d.classList.add('right'); }
        else if (d.value) {
          d.classList.add('wrong'); dxWrong++;
          if (b.key === 'POS' || b.key === 'NEG') ctrlWrong++;
        }
      });
    });
    var perfect = right === total;
    say(refs.feedbackB, 'Table B: <b>' + right + ' / ' + total + '</b>. ' + (perfect
      ? 'Controls behaved and both patients are called. Now put your two numbers on the ' +
        'class board and see who else is carrying the antigen.'
      : diagnoseB(ctrlWrong, dxWrong, concWrong)), perfect);
    if (perfect) {
      Lab.engine.onAnalysisStep('read');
      if (refs.collectBtn) refs.collectBtn.disabled = false;
    }
  }

  function diagnoseB(ctrlWrong, dxWrong, concWrong) {
    if (ctrlWrong) {
      return 'Start with the controls. Wells 13–15 hold undiluted antigen and 16–18 hold none, ' +
        'so they are the two ends of the scale — if those two are not right, nothing between ' +
        'them can be read.';
    }
    if (dxWrong && !concWrong) {
      return 'The numbers are right but a diagnosis is not: anything above zero antigen is a ' +
        'positive, however faint the colour.';
    }
    return 'Slide the colour chip along the standard strip until it matches, then read the ' +
      'concentration off that standard well.';
  }

  /* ======================================================================= */
  /*  Table C — the class board and the chain of infection                   */
  /* ======================================================================= */
  function rebuildTableC() {
    if (!refs.tableC) return;
    var head = '<thead><tr><th scope="col">Patient</th><th scope="col">Concentration<small>µg/mL</small></th>' +
      '<th scope="col">Reported by</th></tr></thead><tbody>';
    var body = '';
    cfg.PATIENTS.forEach(function (p, i) {
      var mine = S.patients.indexOf(p.id);
      var reporter = mine >= 0 ? 'you' : cfg.CLASS_GROUPS[i % cfg.CLASS_GROUPS.length];
      var cell;
      if (mine >= 0) {
        cell = '<input type="text" class="cell" id="concC-' + p.id + '" inputmode="decimal" ' +
          'aria-label="Concentration for ' + Lab.ui.esc(p.name) + '" autocomplete="off">';
      } else if (classBoardOpen) {
        cell = '<span class="shared">' + cfg.fmtConc(p.conc) + '</span>';
      } else {
        cell = '<span class="pending">not yet reported</span>';
      }
      body += '<tr' + (mine >= 0 ? ' class="is-mine"' : '') + '>' +
        '<th scope="row">' + Lab.ui.esc(p.name) + '</th>' +
        '<td>' + cell + '</td>' +
        '<td class="reporter">' + Lab.ui.esc(reporter) + '</td></tr>';
    });
    refs.tableC.innerHTML = head + body + '</tbody>';
    renderChainPool();
    renderChain();
  }

  function collectClassData() {
    classBoardOpen = true;
    rebuildTableC();
    if (refs.chainWrap) refs.chainWrap.removeAttribute('hidden');
    say(refs.feedbackC, 'Class data collected. Nine patients, five of them carrying antigen — ' +
      'and the amount each one is carrying is a clock.', false, true);
  }

  /* The chain builder.  Ordering the positives from most antigen to least is
     the inference the whole experiment exists to support: the longer someone
     has been infected, the more antigen they carry, so the order IS the
     direction the infection travelled. */
  function renderChainPool() {
    if (!refs.chainPool) return;
    refs.chainPool.innerHTML = cfg.PATIENTS.map(function (p) {
      var used = chain.indexOf(p.id) !== -1;
      return '<button type="button" class="chip-name" data-chain="' + p.id + '"' +
        (used ? ' disabled' : '') + '>' + Lab.ui.esc(p.name) + '</button>';
    }).join('');
    if (!refs.chainPool.__wired) {
      refs.chainPool.__wired = true;
      refs.chainPool.addEventListener('click', function (e) {
        var b = e.target.closest('[data-chain]');
        if (!b) return;
        chain.push(b.getAttribute('data-chain'));
        renderChainPool(); renderChain();
      });
    }
  }

  function renderChain() {
    if (!refs.chainList) return;
    if (!chain.length) {
      refs.chainList.innerHTML = '<li class="chain-empty">Click the infected students in the ' +
        'order the disease moved through them.</li>';
    } else {
      refs.chainList.innerHTML = chain.map(function (id, i) {
        var p = cfg.patientById(id);
        return '<li class="chain-step"><span class="chain-n">' + (i + 1) + '</span>' +
          Lab.ui.esc(p.name) + '</li>';
      }).join('<li class="chain-arrow" aria-hidden="true">→</li>');
    }
    renderChainPool();
  }

  function checkChain() {
    // the answer key: every positive, ordered by falling antigen load
    var key = cfg.PATIENTS.filter(function (p) { return p.conc > 0; })
      .sort(function (a, b) { return b.conc - a.conc; })
      .map(function (p) { return p.id; });

    var extras = chain.filter(function (id) {
      var p = cfg.patientById(id);
      return p && p.conc === 0;
    });

    if (extras.length) {
      say(refs.feedbackC, 'Take out the negatives first — ' +
        extras.map(function (id) { return cfg.patientById(id).name; }).join(', ') +
        (extras.length === 1 ? ' has' : ' have') + ' no antigen at all, so ' +
        (extras.length === 1 ? 'that student was never' : 'those students were never') +
        ' infected, however close the contact.', false);
      return;
    }
    if (chain.length !== key.length) {
      say(refs.feedbackC, 'There are ' + key.length + ' infected students. You have placed ' +
        chain.length + '.', false);
      return;
    }
    var correct = chain.every(function (id, i) { return id === key[i]; });
    if (!correct) {
      var reversed = chain.every(function (id, i) { return id === key[key.length - 1 - i]; });
      say(refs.feedbackC, reversed
        ? 'That is the chain, but running backwards. The patient with the MOST antigen has ' +
          'been infected longest, so they come first.'
        : 'Not yet. Order them by antigen load, highest first — and check the histories: ' +
          'every link in a real chain needs a contact to explain it.', false);
      return;
    }
    var names = key.map(function (id) { return cfg.patientById(id).name; });
    say(refs.feedbackC, 'That is the outbreak: <b>' + names.join(' → ') + '</b>. ' +
      'Sue carried the most antigen and was diagnosed first; each person she reached carries ' +
      'less, because they were infected later. The histories corroborate every link — a room-mate, ' +
      'a shared water bottle, a study group. Everyone in that chain needs ' +
      'treating, and so does anyone who has been in close contact with them.', true);
    Lab.engine.onAnalysisComplete();
  }

  /* ======================================================================= */
  /*  The colour comparator                                                  */
  /*                                                                         */
  /*  Click any well and its colour is lifted onto a chip you can slide along */
  /*  under the standard strip.  This is the physical act the protocol asks   */
  /*  for — "ESTIMATE the concentration of your patient samples" — and doing  */
  /*  it by eye against a ladder is the point, so the app never names the     */
  /*  answer.                                                                */
  /* ======================================================================= */
  function buildComparator() {
    var host = document.getElementById('comparator');
    if (!host) return;
    host.innerHTML =
      '<div class="cmp-chip" id="cmp-chip" aria-hidden="true"><span class="cmp-swatch"></span>' +
        '<span class="cmp-label">pick a well</span></div>';
    var lb = document.getElementById('lightbox-strips');
    if (lb) {
      lb.addEventListener('click', function (e) {
        var g = e.target.closest('[data-well]');
        if (g) liftColour(parseInt(g.dataset.well, 10));
      });
    }
    if (Lab.env.interact) {
      var chip = document.getElementById('cmp-chip');
      var pos = { x: 0, y: 0 };
      interact(chip).draggable({
        listeners: {
          start: function () { document.body.classList.add('dragging'); },
          move: function (ev) {
            pos.x += ev.dx; pos.y += ev.dy;
            chip.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
          },
          end: function () { document.body.classList.remove('dragging'); }
        }
      });
    }
  }

  function liftColour(n) {
    var chip = document.getElementById('cmp-chip');
    if (!chip) return;
    var paint = st.wellPaint(n);
    var sw = chip.querySelector('.cmp-swatch');
    sw.style.background = Lab.surfaces.paintFor(paint.key);
    sw.style.opacity = String(Math.max(0.06, paint.alpha));
    chip.querySelector('.cmp-label').textContent = 'well ' + n;
    chip.setAttribute('aria-hidden', 'false');
    chip.classList.add('is-loaded');
  }

  /* ======================================================================= */
  function say(node, html, good, neutral) {
    if (!node) return;
    node.innerHTML = html;
    node.className = 'feedback ' + (neutral ? 'note' : (good ? 'good' : 'bad'));
  }

  Lab.analysis = {
    init: init,
    open: open,
    close: close,
    reset: reset,
    rebuildTableB: rebuildTableB,
    rebuildTableC: rebuildTableC
  };
})(window.Lab = window.Lab || {});
