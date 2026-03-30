// ══════════════════════════════════════════
//  HEAT SIGNAL — Thermodynamics Escape Lab
//  Game Logic & Puzzle Engine
// ══════════════════════════════════════════

// ══════════════════════════════════════════
//  SCORING CONFIGURATION  (teacher-editable)
//  maxPts : full points if solved first try
//  penalty: points lost per wrong attempt
// ══════════════════════════════════════════
const SCORE_CONFIG = {
  puzzles: {
    r0p1: { maxPts: 10, penalty: 4 },
    r0p2: { maxPts:  8, penalty: 3 },
    r1p1: { maxPts:  8, penalty: 3 },
    r1p2: { maxPts: 16, penalty: 5 },
    r2p1: { maxPts: 10, penalty: 4 },
    r2p2: { maxPts: 12, penalty: 4 },
    r3p1: { maxPts: 20, penalty: 7 },
    r3p2: { maxPts: 16, penalty: 6 },
  },
  // transform: raw score (0-100) → displayed grade (0-100)
  // Change this line to apply a curve. Examples:
  //   Linear 50-100 range:  raw => 50 + raw * 0.5
  //   Square-root boost:    raw => Math.round(Math.sqrt(raw) * 10)
  transform: function(raw) { return raw; },   // identity — no curve
  transformLabel: 'none (raw = final)',
};
// ══════════════════════════════════════════

const THEME_STORAGE_KEY = 'hs-theme';
const QUESTION_FONT_STORAGE_KEY = 'hs-question-font';
const QUESTION_FONT_PRESETS = ['default', 'large', 'x-large'];
const REPORT_LABELS = {
  r0p1: 'R0-P1  Equilibrium Chain     (drag-group)',
  r0p2: 'R0-P2  Why Thermometers Work (MC)',
  r1p1: 'R1-P1  Energy Balancer      (drag-slot)',
  r1p2: 'R1-P2  Energy Detective     (multi-scen)',
  r2p1: 'R2-P1  Possible/Impossible  (drag-group)',
  r2p2: 'R2-P2  Order the Chaos      (drag-reorder)',
  r3p1: 'R3-P1  True or False        (bulk-TF)',
  r3p2: 'R3-P2  Why Can\'t Reach 0K  (MC)'
};

// ── Scoring helpers ──
function initScoring() {
  state.scoring = {
    sessionId: 'HS-' + Date.now().toString(36).toUpperCase(),
    startTime: Date.now(),
    attempts: { r0p1:0, r0p2:0, r1p1:0, r1p2:0, r2p1:0, r2p2:0, r3p1:0, r3p2:0 }
  };
}

function puzzleRawScore(id) {
  const cfg   = SCORE_CONFIG.puzzles[id];
  const wrong = state.scoring ? state.scoring.attempts[id] : 0;
  return Math.max(0, cfg.maxPts - wrong * cfg.penalty);
}

function rawTotal() {
  return Object.keys(SCORE_CONFIG.puzzles).reduce(
    (sum, id) => sum + puzzleRawScore(id), 0
  );
}

function finalGrade() {
  return Math.min(100, Math.max(0, Math.round(SCORE_CONFIG.transform(rawTotal()))));
}

// Silent update — just refreshes number, NO animation (used on init/reset)
function updateScoreBadge() {
  const numEl = document.getElementById('scoreBadgeNum');
  if (numEl) numEl.textContent = rawTotal() + ' / 100';
}

// Wrong-answer update — increments attempt, refreshes number, triggers red flash
function recordWrong(puzzleId) {
  if (!state.scoring) return;
  state.scoring.attempts[puzzleId]++;
  const numEl = document.getElementById('scoreBadgeNum');
  const badge = document.getElementById('scoreBadge');
  if (!numEl || !badge) return;
  numEl.textContent = rawTotal() + ' / 100';
  badge.classList.remove('score-drop');
  badge.offsetWidth; // force reflow to restart keyframe
  badge.classList.add('score-drop');
  setTimeout(() => badge.classList.remove('score-drop'), 700);
}

function renderFinaleBreakdown() {
  if (!state.scoring) return;
  const labels = {
    r0p1:'R0-P1', r0p2:'R0-P2', r1p1:'R1-P1', r1p2:'R1-P2',
    r2p1:'R2-P1', r2p2:'R2-P2', r3p1:'R3-P1', r3p2:'R3-P2'
  };
  const el = document.getElementById('finaleBreakdown');
  if (el) {
    el.innerHTML = Object.keys(SCORE_CONFIG.puzzles).map(id => {
      const cfg   = SCORE_CONFIG.puzzles[id];
      const wrong = state.scoring.attempts[id];
      const pts   = puzzleRawScore(id);
      const ptsColor  = pts === cfg.maxPts ? 'color:var(--correct)' : 'color:var(--text)';
      const wrongColor = wrong > 0 ? 'color:var(--wrong)' : 'color:var(--dim)';
      return `<div class="breakdown-row">
        <span class="br-id">${labels[id]}</span>
        <span class="br-pts" style="${ptsColor}">${pts}/${cfg.maxPts}</span>
        <span class="br-wrong" style="${wrongColor}">${wrong} wrong</span>
      </div>`;
    }).join('');
  }
  const rawEl   = document.getElementById('finalRaw');
  const gradeEl = document.getElementById('finalGradeDisplay');
  const sessEl  = document.getElementById('finaleSession');
  if (rawEl)   rawEl.textContent   = rawTotal();
  if (gradeEl) gradeEl.textContent = finalGrade();
  if (sessEl)  sessEl.textContent  = '// SESSION: ' + state.scoring.sessionId;
  renderCertCard();
}

function renderCertScore() {
  const el = document.getElementById('certScoreLine');
  if (el) el.textContent = 'FINAL GRADE: ' + finalGrade() + ' / 100';
}

function renderCertCard() {
  if (!state.scoring) return;
  const sc = state.scoring;

  // Populate footer: date + session
  const dateEl = document.getElementById('certDateDisplay');
  const sessEl = document.getElementById('certSessionDisplay');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US',
    { year: 'numeric', month: 'long', day: 'numeric' });
  if (sessEl) sessEl.textContent = sc.sessionId;

  // Build 2-column compact score grid
  const grid = document.getElementById('certScoreGrid');
  if (!grid) return;
  const ids = Object.keys(SCORE_CONFIG.puzzles);
  grid.innerHTML = '';
  for (let i = 0; i < ids.length; i++) {
    const id  = ids[i];
    const cfg = SCORE_CONFIG.puzzles[id];
    const pts = puzzleRawScore(id);
    const cls = pts === cfg.maxPts ? 'full' : 'deducted';
    const row = document.createElement('div');
    row.className = 'cert-score-row';
    row.innerHTML = `<span>${id.toUpperCase()}</span><span class="csr-pts ${cls}">${pts}/${cfg.maxPts}</span>`;
    grid.appendChild(row);
  }
}

function getStudentName() {
  const input = document.getElementById('certName');
  const name = input && typeof input.value === 'string' ? input.value.trim() : '';
  return name || '(unnamed)';
}

function formatElapsed(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const mm = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const ss = String(safeSeconds % 60).padStart(2, '0');
  return mm + ':' + ss;
}

function buildReportData() {
  if (!state.scoring) return null;

  const sc = state.scoring;
  const elapsedSeconds = Math.round((Date.now() - sc.startTime) / 1000);
  const generatedAt = new Date();

  return {
    sessionId: sc.sessionId,
    studentName: getStudentName(),
    elapsed: formatElapsed(elapsedSeconds),
    generatedAt: generatedAt.toLocaleString(),
    generatedDate: generatedAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    generatedTime: generatedAt.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }),
    rawScore: rawTotal(),
    finalGrade: finalGrade(),
    curveLabel: SCORE_CONFIG.transformLabel,
    breakdown: Object.keys(SCORE_CONFIG.puzzles).map(id => {
      const cfg = SCORE_CONFIG.puzzles[id];
      return {
        id: id,
        label: REPORT_LABELS[id] || id.toUpperCase(),
        wrongs: sc.attempts[id],
        raw: puzzleRawScore(id),
        max: cfg.maxPts
      };
    })
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildReportPdf(report) {
  const doc = new window.jspdf.jsPDF({
    unit: 'pt',
    format: 'letter',
    orientation: 'portrait',
    compress: true
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const centerX = pageWidth / 2;
  const frameInset = 24;
  const bandInset = 40;
  const margin = 52;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 86;
  const palette = {
    paper: [247, 243, 234],
    paperAlt: [252, 249, 243],
    ink: [30, 40, 58],
    gold: [146, 112, 42],
    goldSoft: [214, 197, 160],
    line: [221, 212, 196],
    muted: [95, 91, 86],
    success: [54, 96, 76],
    warning: [153, 61, 58]
  };
  const distinction = report.finalGrade >= 95
    ? 'WITH HIGHEST DISTINCTION'
    : report.finalGrade >= 85
      ? 'WITH DISTINCTION'
      : report.finalGrade >= 70
        ? 'MISSION COMPLETE'
        : 'ESCAPE COMPLETE';
  const signatureName = 'Dr. Emil Jivishov';
  const signatureTitle = 'INSTRUCTOR & LAB DIRECTOR';
  const achievementLines = [
    'has successfully escaped Dr. Kelvin\'s Thermodynamics Lab',
    'and demonstrated mastery of the four laws of thermodynamics.'
  ];
  let y = 78;

  function setDraw(rgb) {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  }

  function setFill(rgb) {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  }

  function setText(rgb) {
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  }

  function drawPageFrame() {
    setFill(palette.paper);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    setDraw(palette.goldSoft);
    doc.setLineWidth(1.15);
    doc.rect(frameInset, frameInset, pageWidth - frameInset * 2, pageHeight - frameInset * 2);

    setDraw(palette.ink);
    doc.setLineWidth(0.8);
    doc.rect(frameInset + 8, frameInset + 8, pageWidth - (frameInset + 8) * 2, pageHeight - (frameInset + 8) * 2);

    setFill(palette.ink);
    doc.rect(bandInset, frameInset + 14, pageWidth - bandInset * 2, 10, 'F');
    setFill(palette.gold);
    doc.rect(bandInset, frameInset + 30, pageWidth - bandInset * 2, 2.5, 'F');

    y = 78;
  }

  function drawFooter() {
    setDraw(palette.line);
    doc.setLineWidth(0.9);
    doc.line(margin, pageHeight - 42, pageWidth - margin, pageHeight - 42);
  }

  function drawPageFooter(pageNumber, totalPages) {
    doc.setPage(pageNumber);
    drawFooter();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText(palette.muted);
    doc.text('Heat Signal Report | ' + report.studentName, margin, pageHeight - 24);
    doc.text(pageNumber + ' / ' + totalPages, pageWidth - margin, pageHeight - 24, { align: 'right' });
  }

  function drawCenteredLines(lines, startY, lineHeight) {
    lines.forEach(line => {
      doc.text(line, centerX, startY, { align: 'center' });
      startY += lineHeight;
    });
    return startY;
  }

  function drawRuleLine(ruleY) {
    setDraw(palette.goldSoft);
    doc.setLineWidth(1);
    doc.line(margin, ruleY, pageWidth - margin, ruleY);
  }

  function drawSummaryCard(x, cardY, w, h, label, value, detail, highlight) {
    setFill(highlight ? [255, 249, 235] : palette.paperAlt);
    setDraw(highlight ? palette.gold : palette.line);
    doc.setLineWidth(0.9);
    doc.roundedRect(x, cardY, w, h, 10, 10, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(palette.gold);
    doc.text(label, x + 14, cardY + 16);

    doc.setFont('times', 'bold');
    doc.setFontSize(highlight ? 22 : 20);
    setText(palette.ink);
    doc.text(value, x + 14, cardY + 42);

    if (detail) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      setText(palette.muted);
      const detailLines = doc.splitTextToSize(detail, w - 24);
      detailLines.slice(0, 2).forEach((line, idx) => {
        doc.text(line, x + 14, cardY + 57 + idx * 10);
      });
    }
  }

  function drawBreakdownTitle(continued) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    setText(palette.ink);
    doc.text(continued ? 'Performance Breakdown Continued' : 'Performance Breakdown', margin, y);
    y += 11;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setText(palette.muted);
    doc.text('Per-puzzle scoring summary for the completed escape lab.', margin, y);
    y += 14;

    drawRuleLine(y);
    y += 14;
  }

  function drawTableHeader() {
    setFill(palette.ink);
    doc.roundedRect(margin, y, contentWidth, 24, 6, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setText(palette.paper);
    doc.text('ID', margin + 12, y + 15);
    doc.text('PUZZLE', margin + 68, y + 15);
    doc.text('SCORE', pageWidth - margin - 92, y + 15);
    doc.text('WRONGS', pageWidth - margin - 14, y + 15, { align: 'right' });
    y += 34;
  }

  function drawContinuationPage() {
    doc.addPage();
    drawPageFrame();
    drawBreakdownTitle(true);
    drawTableHeader();
  }

  function drawCertificateFooterBlock() {
    const footerHeight = 84;
    const footerY = Math.max(y + 12, pageHeight - 146);
    const leftX = margin;
    const leftWidth = 210;
    const rightX = pageWidth - margin - 210;

    setDraw(palette.goldSoft);
    doc.setLineWidth(0.9);
    doc.line(margin, footerY - 16, pageWidth - margin, footerY - 16);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setText(palette.goldSoft);
    doc.text('DATE', leftX, footerY);
    doc.text('SESSION', leftX, footerY + 40);

    doc.setFont('courier', 'normal');
    doc.setFontSize(13);
    setText(palette.ink);
    doc.text(report.generatedDate, leftX, footerY + 20);
    doc.text(report.sessionId, leftX, footerY + 60);

    setDraw(palette.line);
    doc.setLineWidth(1);
    doc.line(rightX, footerY + 14, pageWidth - margin, footerY + 14);

    doc.setFont('times', 'italic');
    doc.setFontSize(18);
    setText(palette.ink);
    doc.text(signatureName, rightX, footerY + 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(palette.gold);
    doc.text(signatureTitle, rightX, footerY + 56);

    y = footerY + footerHeight;
  }

  drawPageFrame();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setText(palette.gold);
  doc.text('HEAT SIGNAL | THERMODYNAMICS ESCAPE LAB', centerX, y, { align: 'center' });
  y += 22;

  doc.setFont('times', 'bold');
  doc.setFontSize(28);
  setText(palette.ink);
  doc.text('Certificate of Escape', centerX, y, { align: 'center' });
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  setText(palette.muted);
  doc.text('This certifies that', centerX, y, { align: 'center' });
  y += 14;

  let nameFontSize = 32;
  let nameLines = [];
  do {
    doc.setFont('times', 'bolditalic');
    doc.setFontSize(nameFontSize);
    nameLines = doc.splitTextToSize(report.studentName, contentWidth - 120);
    if (nameLines.length <= 2 || nameFontSize <= 24) break;
    nameFontSize -= 2;
  } while (true);

  setText(palette.ink);
  y = drawCenteredLines(nameLines, y + 12, nameFontSize * 0.92);
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  setText(palette.gold);
  doc.text(distinction, centerX, y, { align: 'center' });
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setText(palette.muted);
  y = drawCenteredLines(achievementLines, y, 14);
  y += 14;

  drawRuleLine(y);
  y += 18;

  const cardGap = 12;
  const cardWidth = (contentWidth - cardGap * 2) / 3;
  const cardHeight = 78;
  drawSummaryCard(margin, y, cardWidth, cardHeight, 'FINAL GRADE', report.finalGrade + ' / 100', distinction, true);
  drawSummaryCard(margin + cardWidth + cardGap, y, cardWidth, cardHeight, 'RAW SCORE', report.rawScore + ' / 100', 'Curve: ' + report.curveLabel, false);
  drawSummaryCard(margin + (cardWidth + cardGap) * 2, y, cardWidth, cardHeight, 'ELAPSED TIME', report.elapsed, 'Completion window', false);
  y += cardHeight + 14;

  drawBreakdownTitle(false);
  drawTableHeader();

  report.breakdown.forEach((item, idx) => {
    const labelMaxWidth = contentWidth - 210;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const labelLines = doc.splitTextToSize(item.label, labelMaxWidth);
    const rowHeight = Math.max(22, labelLines.length * 11 + 10);

    if (y + rowHeight > bottomLimit) {
      drawContinuationPage();
    }

    setFill(idx % 2 === 0 ? palette.paperAlt : palette.paper);
    doc.roundedRect(margin, y - 4, contentWidth, rowHeight, 4, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    setText(palette.muted);
    doc.text(item.id.toUpperCase(), margin + 12, y + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setText(palette.ink);
    labelLines.forEach((line, lineIdx) => {
      doc.text(line, margin + 68, y + 11 + lineIdx * 11);
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setText(item.raw === item.max ? palette.success : palette.ink);
    doc.text(item.raw + '/' + item.max, pageWidth - margin - 92, y + 11);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setText(item.wrongs > 0 ? palette.warning : palette.muted);
    doc.text(String(item.wrongs), pageWidth - margin - 14, y + 11, { align: 'right' });

    setDraw(palette.line);
    doc.setLineWidth(0.75);
    doc.line(margin + 2, y + rowHeight - 4, pageWidth - margin - 2, y + rowHeight - 4);
    y += rowHeight + 4;
  });

  drawCertificateFooterBlock();

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    drawPageFooter(page, totalPages);
  }

  return doc;
}

function downloadCertPDF() {
  const btn = document.getElementById('downloadPdfBtn');
  const originalLabel = btn ? btn.dataset.defaultLabel || btn.textContent : '';
  const report = buildReportData();

  function restoreButton(delay) {
    if (!btn) return;
    window.setTimeout(() => {
      btn.textContent = originalLabel;
      btn.disabled = false;
    }, delay || 0);
  }

  if (!report || typeof window.jspdf?.jsPDF !== 'function') {
    console.error('Report PDF export is unavailable.', {
      hasReport: !!report,
      hasJsPdf: typeof window.jspdf?.jsPDF === 'function'
    });
    if (btn) {
      btn.textContent = 'PDF UNAVAILABLE';
      btn.disabled = true;
      restoreButton(2200);
    }
    return;
  }

  if (btn) {
    btn.dataset.defaultLabel = originalLabel;
    btn.textContent = 'BUILDING REPORT...';
    btn.disabled = true;
  }

  Promise.resolve(document.fonts ? document.fonts.ready : null)
    .catch(() => null)
    .then(() => {
      const doc = buildReportPdf(report);
      doc.save('heat-signal-report.pdf');
    })
    .then(() => {
      restoreButton();
    })
    .catch(err => {
      console.error('Report PDF export failed.', err);
      if (btn) {
        btn.textContent = 'PDF FAILED';
        restoreButton(2200);
      }
    });
}

function buildReport(report) {
  const data = report || buildReportData();
  if (!data) return '';
  const lines = [
    '=== HEAT SIGNAL \u2014 THERMODYNAMICS ESCAPE LAB ===',
    'Session : ' + data.sessionId,
    'Student : ' + data.studentName,
    'Time    : ' + data.elapsed,
    'Date    : ' + data.generatedAt,
    '',
    '--- PUZZLE BREAKDOWN ---',
  ];
  data.breakdown.forEach(item => {
    lines.push(item.label + '  wrongs=' + item.wrongs + '  raw=' + item.raw + '/' + item.max);
  });
  lines.push('');
  lines.push('--- TOTALS ---');
  lines.push('Raw score   : ' + data.rawScore + ' / 100');
  lines.push('Curve       : ' + data.curveLabel);
  lines.push('Final grade : ' + data.finalGrade + ' / 100');
  lines.push('===============================================');
  return lines.join('\n');
}

function copyReport() {
  const text = buildReport();
  const btn  = document.getElementById('copyReportBtn');
  function flash() {
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = 'COPIED \u2713';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(flash).catch(() => fallback());
  } else { fallback(); }
  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); flash(); } catch(e) {}
    document.body.removeChild(ta);
  }
}

// ── Theme ──
function toggleTheme() {
  const isLight = document.body.getAttribute('data-theme') === 'light';
  document.body.setAttribute('data-theme', isLight ? '' : 'light');
  localStorage.setItem(THEME_STORAGE_KEY, isLight ? 'dark' : 'light');
}

function getQuestionFontPreset() {
  const preset = document.body.getAttribute('data-question-font');
  return QUESTION_FONT_PRESETS.includes(preset) ? preset : 'default';
}

function syncQuestionFontControls() {
  const preset = getQuestionFontPreset();
  const presetIndex = QUESTION_FONT_PRESETS.indexOf(preset);
  const decBtn = document.getElementById('fontDecreaseBtn');
  const incBtn = document.getElementById('fontIncreaseBtn');

  if (decBtn) decBtn.disabled = presetIndex <= 0;
  if (incBtn) incBtn.disabled = presetIndex >= QUESTION_FONT_PRESETS.length - 1;
}

function setQuestionFontPreset(preset) {
  const safePreset = QUESTION_FONT_PRESETS.includes(preset) ? preset : 'default';
  document.body.setAttribute('data-question-font', safePreset);
  localStorage.setItem(QUESTION_FONT_STORAGE_KEY, safePreset);
  syncQuestionFontControls();
}

function adjustQuestionFont(direction) {
  const currentPreset = getQuestionFontPreset();
  const currentIndex = QUESTION_FONT_PRESETS.indexOf(currentPreset);
  const nextIndex = Math.min(QUESTION_FONT_PRESETS.length - 1, Math.max(0, currentIndex + direction));

  if (nextIndex === currentIndex) {
    syncQuestionFontControls();
    return;
  }

  setQuestionFontPreset(QUESTION_FONT_PRESETS[nextIndex]);
}

// ── Game State ──
const state = {
  currentRoom: -1,
  completed: [false, false, false, false],
  puzzlesDone: {
    r0p1: false, r0p2: false,
    r1p1: false, r1p2: false,
    r2p1: false, r2p2: false,
    r3p1: false, r3p2: false
  }
};

// Room accent colours (must match style.css)
const ROOM_ACCENTS = [
  { cls: '',       accent: '#FF6B00', rgb: '255,107,0'   }, // 0 — orange
  { cls: 'room-1', accent: '#A8FF3E', rgb: '168,255,62'  }, // 1 — lime
  { cls: 'room-2', accent: '#FF2D78', rgb: '255,45,120'  }, // 2 — magenta
  { cls: 'room-3', accent: '#00E5FF', rgb: '0,229,255'   }  // 3 — cyan
];

// ── Screen management ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  // Force animation replay
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = '';
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  const lockScroll = (id === 'intro' || id.endsWith('-door'));
  const showBadge = !(id === 'intro' || id.endsWith('-door') || id === 'finale');
  document.body.style.overflowY = lockScroll ? 'hidden' : 'auto';
  const badge = document.getElementById('scoreBadge');
  if (badge) badge.style.display = showBadge ? '' : 'none';
  updateAccentColor(id);
}

function updateAccentColor(screenId) {
  const body = document.body;
  // Strip all room classes
  body.classList.remove('room-1', 'room-2', 'room-3', 'finale');

  if (screenId.startsWith('room0') || screenId === 'room0-door') {
    // default accent is room 0
  } else if (screenId.startsWith('room1') || screenId === 'room1-door') {
    body.classList.add('room-1');
  } else if (screenId.startsWith('room2') || screenId === 'room2-door') {
    body.classList.add('room-2');
  } else if (screenId.startsWith('room3') || screenId === 'room3-door') {
    body.classList.add('room-3');
  } else if (screenId === 'finale') {
    body.classList.add('finale');
  }
}

// ── Progress strip ──
function updateProgress() {
  for (let i = 0; i < 4; i++) {
    const node = document.getElementById('pn' + i);
    node.classList.remove('active', 'done');

    if (state.completed[i]) {
      node.classList.add('done');
      node.textContent = '✓';
      if (i < 3) document.getElementById('pl' + i).classList.add('done');
    } else if (i === state.currentRoom) {
      node.classList.add('active');
      node.textContent = i;
    } else {
      node.textContent = i;
    }
  }
}

// ── Start ──
function startGame() {
  initScoring();
  updateScoreBadge();
  state.currentRoom = 0;
  updateProgress();
  showScreen('room0-door');
}

// ── Glitch on wrong answers ──
function triggerGlitch() {
  const overlay = document.getElementById('glitchOverlay');
  overlay.classList.remove('active');
  overlay.offsetHeight; // reflow
  overlay.classList.add('active');
  setTimeout(() => overlay.classList.remove('active'), 500);
}

// ── Feedback banner ──
function showFeedback(id, correct, msg) {
  const fb = document.getElementById(id);
  fb.className = 'feedback show ' + (correct ? 'correct' : 'wrong');
  fb.textContent = msg;
  if (!correct) triggerGlitch();
}

// ── Unlock transition ──
function showUnlock(label, numDisplay, callback) {
  const ov  = document.getElementById('unlockOverlay');
  const num = document.getElementById('unlockNum');
  const txt = document.getElementById('unlockText');

  num.textContent = numDisplay;
  txt.textContent = label;

  // Force animation replay on the number
  num.style.animation = 'none';
  num.offsetHeight;
  num.style.animation = '';

  ov.classList.add('show');
  setTimeout(() => {
    ov.classList.remove('show');
    callback();
  }, 1900);
}

// ── Room completion ──
function completeRoom(n) {
  state.completed[n] = true;
  updateProgress();

  if (n < 3) {
    const next = n + 1;
    state.currentRoom = next;
    updateProgress();
    showUnlock('UNLOCKED', String(n), () => showScreen('room' + next + '-door'));
  } else {
    showUnlock('ESCAPED', '✓', () => {
      document.getElementById('progressStrip').style.display = 'none';
      document.body.classList.add('finale');
      renderFinaleBreakdown();
      renderCertScore();
      showScreen('finale');
    });
  }
}

// ══════════════════════════════════
//  DRAG & DROP — Generic helpers
// ══════════════════════════════════
let draggedEl = null;

function initDragDrop(itemsContainerId, zoneIds) {
  const container = document.getElementById(itemsContainerId);
  if (!container) return;

  container.querySelectorAll('.drag-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      draggedEl = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedEl = null;
    });

    // Click-to-select fallback
    item.addEventListener('click', () => {
      if (item.dataset.selected === 'true') {
        item.dataset.selected = 'false';
        item.style.outline = '';
      } else {
        // Deselect all
        document.querySelectorAll('.drag-item[data-selected="true"]').forEach(i => {
          i.dataset.selected = 'false';
          i.style.outline = '';
        });
        item.dataset.selected = 'true';
        item.style.outline = '1px solid var(--accent)';
      }
    });
  });

  zoneIds.forEach(zid => {
    const zone = document.getElementById(zid);
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (draggedEl) { zone.appendChild(draggedEl); draggedEl.classList.add('in-zone'); }
    });
    // Click-to-drop
    zone.addEventListener('click', () => {
      const sel = document.querySelector('.drag-item[data-selected="true"]');
      if (sel) {
        zone.appendChild(sel);
        sel.classList.add('in-zone');
        sel.dataset.selected = 'false';
        sel.style.outline = '';
      }
    });
  });
}

// ── Energy slot drag ──
function initEnergySlots() {
  document.querySelectorAll('.energy-chip').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      draggedEl = chip;
      chip.style.opacity = '0.35';
    });
    chip.addEventListener('dragend', () => {
      chip.style.opacity = '1';
      draggedEl = null;
    });
  });

  document.querySelectorAll('.energy-slot').forEach(slot => {
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('dragover'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('dragover'));
    slot.addEventListener('drop', e => {
      e.preventDefault();
      slot.classList.remove('dragover');
      if (draggedEl && draggedEl.classList.contains('energy-chip')) {
        const existing = slot.querySelector('.energy-chip');
        if (existing) document.getElementById('r1p1-chips').appendChild(existing);
        slot.appendChild(draggedEl);
        slot.classList.add('filled');
        checkEnergySlot(slot, draggedEl);
      }
    });
  });
}

function checkEnergySlot(slot, chip) {
  const val     = chip.dataset.val;
  const correct = slot.dataset.correct;
  if (val === correct) {
    showFeedback('r1p1-fb', true,
      'Correct! 500 J of heat in minus 200 J of work out = 300 J increase in internal energy. Energy is conserved!');
    state.puzzlesDone.r1p1 = true;
    document.getElementById('r1p2').classList.remove('hidden');
  } else {
    recordWrong('r1p1');
    showFeedback('r1p1-fb', false,
      'Not quite. Remember: \u0394U = Q \u2212 W. The gas absorbed 500 J and did 200 J of work. What\u2019s left?');
    setTimeout(() => {
      document.getElementById('r1p1-chips').appendChild(chip);
      slot.classList.remove('filled');
    }, 1200);
  }
}

// ── Order list drag ──
function initOrderList(listId) {
  const list = document.getElementById(listId);
  let dragItem = null;

  list.querySelectorAll('.order-item').forEach(item => {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', e => {
      dragItem = item;
      item.style.opacity = '0.35';
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
      dragItem = null;
      updateOrderNums(listId);
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragItem && dragItem !== item) {
        const rect = item.getBoundingClientRect();
        const mid  = rect.top + rect.height / 2;
        if (e.clientY < mid) list.insertBefore(dragItem, item);
        else list.insertBefore(dragItem, item.nextSibling);
      }
    });

    // Click to swap
    item.addEventListener('click', () => {
      if (item.dataset.selected === 'true') {
        item.dataset.selected = 'false';
        item.style.outline = '';
      } else {
        const prev = list.querySelector('[data-selected="true"]');
        if (prev && prev !== item) {
          // Swap positions
          const nextOfItem = item.nextSibling;
          const nextOfPrev = prev.nextSibling;
          if (nextOfItem === prev)      list.insertBefore(prev, item);
          else if (nextOfPrev === item) list.insertBefore(item, prev);
          else { list.insertBefore(prev, nextOfItem); list.insertBefore(item, nextOfPrev); }
          prev.dataset.selected = 'false';
          prev.style.outline = '';
          updateOrderNums(listId);
        } else {
          if (prev) { prev.dataset.selected = 'false'; prev.style.outline = ''; }
          item.dataset.selected = 'true';
          item.style.outline = '1px solid var(--accent)';
        }
      }
    });
  });
}

function updateOrderNums(listId) {
  document.getElementById(listId).querySelectorAll('.order-item').forEach((item, i) => {
    item.querySelector('.order-num').textContent = i + 1;
  });
}

// ── Multiple choice ──
function checkMC(opt, puzzleId) {
  const parent = opt.parentElement;
  if (parent.dataset.locked === 'true') return;
  const correct = opt.dataset.correct === 'true';

  if (correct) {
    parent.dataset.locked = 'true';
    opt.classList.add('correct');
    parent.querySelectorAll('.mc-option').forEach(o => {
      if (o !== opt) o.style.opacity = '0.35';
      o.style.pointerEvents = 'none';
    });
    if (puzzleId === 'r0p2') {
      showFeedback('r0p2-fb', true,
        'Exactly! The thermometer reaches the same temperature as the water (thermal equilibrium). By the Zeroth Law, they must share the same temperature — which is what the reading tells you.');
      state.puzzlesDone.r0p2 = true;
      document.getElementById('r0-next-btn').classList.remove('hidden');
    } else if (puzzleId === 'r3p2') {
      showFeedback('r3p2-fb', true,
        'Correct! Each successive cooling step removes a smaller amount of heat, making it impossible to reach exactly 0 K in any finite process. This is the essence of the Third Law.');
      state.puzzlesDone.r3p2 = true;
      document.getElementById('r3-next-btn').classList.remove('hidden');
    }
  } else {
    recordWrong(puzzleId);
    opt.classList.add('wrong');
    setTimeout(() => opt.classList.remove('wrong'), 500);
    if (puzzleId === 'r0p2')
      showFeedback('r0p2-fb', false,
        'Not quite — think about what "thermal equilibrium" means and how the Zeroth Law connects two objects through a third.');
    else if (puzzleId === 'r3p2')
      showFeedback('r3p2-fb', false,
        'Not quite. Think about what happens to the cooling rate as you get closer and closer to 0 K.');
  }
}

// ══════════════════════════════════
//  ROOM 0 — Zeroth Law
// ══════════════════════════════════
function checkR0P1() {
  const g1 = [...document.getElementById('r0-group1').querySelectorAll('.drag-item')]
    .map(i => i.dataset.id).sort().join('');
  const g2 = [...document.getElementById('r0-group2').querySelectorAll('.drag-item')]
    .map(i => i.dataset.id).sort().join('');

  const correct = (g1 === 'ABD' && g2 === 'CE') || (g1 === 'CE' && g2 === 'ABD');

  if (correct) {
    showFeedback('r0p1-fb', true,
      'Perfect! A, B, and D are all in thermal equilibrium (same temperature). C and E share a different temperature. The Zeroth Law lets you build these chains without direct contact!');
    state.puzzlesDone.r0p1 = true;
    document.getElementById('r0p2').classList.remove('hidden');
  } else {
    recordWrong('r0p1');
    const placed = document.querySelectorAll('#r0-group1 .drag-item, #r0-group2 .drag-item').length;
    if (placed < 5)
      showFeedback('r0p1-fb', false,
        'Drag all 5 objects into the two groups first. Use the clues: A=B, B=D, C=E, and A≠C.');
    else
      showFeedback('r0p1-fb', false,
        'Not quite. Re-read the clues: A=B means A and B are the same temperature. B=D links D to that group. C=E is a separate group. A≠C means the groups are at different temperatures.');
  }
}

// ══════════════════════════════════
//  ROOM 1 — First Law
// ══════════════════════════════════
const r1p2Data = [
  { text: 'A pot of water is heated on a stove (absorbs heat, no work done).', answer: 'increase' },
  { text: 'A gas expands in a piston, pushing it outward while losing heat to surroundings.', answer: 'decrease' },
  { text: 'You rub your hands together vigorously (friction adds heat).', answer: 'increase' },
  { text: 'A compressed gas is released into a vacuum (expands freely, no heat exchange).', answer: 'same' }
];
const r1p2Answers = {};

function buildR1P2() {
  const el = document.getElementById('r1p2-scenarios');
  if (el.children.length > 0) return;
  r1p2Data.forEach((d, i) => {
    el.innerHTML += `
      <div class="tf-item" id="r1p2-s${i}">
        <div class="tf-text">${d.text}</div>
        <div class="tf-buttons">
          <button class="tf-btn" onclick="selectR1P2(${i},'increase',this)">INCREASE</button>
          <button class="tf-btn" onclick="selectR1P2(${i},'decrease',this)">DECREASE</button>
          <button class="tf-btn" onclick="selectR1P2(${i},'same',this)">NO CHANGE</button>
        </div>
      </div>`;
  });
}

function selectR1P2(i, choice, btn) {
  r1p2Answers[i] = choice;
  document.getElementById('r1p2-s' + i).querySelectorAll('.tf-btn')
    .forEach(b => b.className = 'tf-btn');
  btn.classList.add('selected-true');
}

function checkR1P2() {
  if (Object.keys(r1p2Answers).length < r1p2Data.length) {
    showFeedback('r1p2-fb', false, 'Select an answer for every scenario before checking.');
    return;
  }
  let allCorrect = true;
  r1p2Data.forEach((d, i) => {
    const item = document.getElementById('r1p2-s' + i);
    item.classList.remove('answered-correct', 'answered-wrong');
    if (r1p2Answers[i] === d.answer) {
      item.classList.add('answered-correct');
    } else {
      item.classList.add('answered-wrong');
      allCorrect = false;
    }
  });
  if (allCorrect) {
    showFeedback('r1p2-fb', true,
      'All correct! Every energy transfer balances out — heat in, work out, internal energy changes accordingly. First Law verified.');
    state.puzzlesDone.r1p2 = true;
    document.getElementById('r1-next-btn').classList.remove('hidden');
  } else {
    recordWrong('r1p2');
    showFeedback('r1p2-fb', false,
      'Some answers are off. Remember ΔU = Q − W. Heat IN with no work → increase. Work done AND heat lost → decrease. No heat exchange, no work → no change.');
  }
}

// ══════════════════════════════════
//  ROOM 2 — Second Law
// ══════════════════════════════════
const r2p1Data = [
  { text: 'Hot coffee cooling down in a cold room',              group: 'natural'   },
  { text: 'A cold room spontaneously heating a cup of coffee',   group: 'impossible'},
  { text: 'Ice melting on a warm countertop',                    group: 'natural'   },
  { text: 'A broken egg reassembling itself',                    group: 'impossible'},
  { text: 'Perfume spreading through a room after opening',      group: 'natural'   }
];

function buildR2P1() {
  const el = document.getElementById('r2p1-items');
  if (el.children.length > 0) return;
  const shuffled = [...r2p1Data].sort(() => Math.random() - 0.5);
  shuffled.forEach((d, i) => {
    el.innerHTML += `<div class="drag-item" draggable="true" data-id="${i}" data-group="${d.group}">${d.text}</div>`;
  });
}

function checkR2P1() {
  const natItems = [...document.getElementById('r2-natural').querySelectorAll('.drag-item')];
  const impItems = [...document.getElementById('r2-impossible').querySelectorAll('.drag-item')];
  if (natItems.length + impItems.length < r2p1Data.length) {
    showFeedback('r2p1-fb', false, 'Drag all scenarios into one of the two zones before checking.');
    return;
  }
  const allCorrect =
    natItems.every(i => i.dataset.group === 'natural') &&
    impItems.every(i => i.dataset.group === 'impossible');

  if (allCorrect) {
    showFeedback('r2p1-fb', true,
      'Correct! Processes that spread energy and increase disorder (coffee cooling, ice melting, perfume spreading) happen naturally. Processes that concentrate energy or reverse disorder violate the Second Law — they need external work.');
    state.puzzlesDone.r2p1 = true;
    document.getElementById('r2p2').classList.remove('hidden');
    buildR2P2();
  } else {
    recordWrong('r2p1');
    showFeedback('r2p1-fb', false,
      'Not quite. Ask: does this process spread energy and increase disorder? If yes → natural. If it magically creates order from chaos → needs external work.');
  }
}

const r2p2Data = [
  { text: 'Ice cube (solid, rigid crystal structure)', order: 1, emoji: '❄️' },
  { text: 'Liquid water (molecules slide freely)',      order: 2, emoji: '💧' },
  { text: 'Steam (gas, molecules fly around)',          order: 3, emoji: '☁️' },
  { text: 'Steam dispersed throughout a large room',   order: 4, emoji: '🌫️' }
];

function buildR2P2() {
  const el = document.getElementById('r2-order-list');
  if (el.children.length > 0) return;
  const shuffled = [...r2p2Data].sort(() => Math.random() - 0.5);
  shuffled.forEach((d, i) => {
    el.innerHTML += `<div class="order-item" data-order="${d.order}">
      <div class="order-num">${i + 1}</div>
      <span>${d.emoji} ${d.text}</span>
    </div>`;
  });
  initOrderList('r2-order-list');
}

function checkR2P2() {
  const items = [...document.getElementById('r2-order-list').querySelectorAll('.order-item')];
  const correct = items.every((item, i) => parseInt(item.dataset.order) === i + 1);
  if (correct) {
    showFeedback('r2p2-fb', true,
      'Perfect order! From ice (low entropy, highly ordered) to dispersed steam (max disorder). The Second Law drives natural processes toward higher entropy.');
    state.puzzlesDone.r2p2 = true;
    document.getElementById('r2-next-btn').classList.remove('hidden');
  } else {
    recordWrong('r2p2');
    showFeedback('r2p2-fb', false,
      'Not in the right order. Think: which state has the most rigid, ordered structure? Which has molecules spread out the most? Drag or click two items to swap.');
  }
  updateOrderNums('r2-order-list');
}

// ══════════════════════════════════
//  ROOM 3 — Third Law
// ══════════════════════════════════
const r3p1Data = [
  {
    text: 'At absolute zero (0 K), all molecular motion stops completely.',
    answer: false,
    explain: 'False. Quantum mechanics tells us particles retain zero-point energy at 0 K — they never fully stop. But at 0 K a perfect crystal has minimum possible entropy.'
  },
  {
    text: 'The entropy of a perfect crystal at absolute zero is exactly zero.',
    answer: true,
    explain: 'True! This is the formal statement of the Third Law. A perfect crystal at 0 K has only one possible microstate, so S = k·ln(1) = 0.'
  },
  {
    text: 'It is theoretically possible to cool an object to exactly 0 K in a finite number of steps.',
    answer: false,
    explain: 'False. The Third Law implies reaching absolute zero would require infinitely many cooling steps. Each step removes less heat than the last.'
  },
  {
    text: 'Absolute zero is −273.15°C (or 0 Kelvin).',
    answer: true,
    explain: 'True! 0 K = −273.15°C — the lowest possible temperature, where a system\'s entropy reaches its minimum.'
  }
];
const r3p1Answers = {};

function buildR3P1() {
  const el = document.getElementById('r3p1-items');
  if (el.children.length > 0) return;
  r3p1Data.forEach((d, i) => {
    el.innerHTML += `
      <div class="tf-item" id="r3p1-s${i}">
        <div class="tf-text">${d.text}</div>
        <div class="tf-buttons">
          <button class="tf-btn" onclick="selectR3TF(${i},true,this)">TRUE</button>
          <button class="tf-btn" onclick="selectR3TF(${i},false,this)">FALSE</button>
        </div>
      </div>`;
  });
}

function selectR3TF(i, val, btn) {
  r3p1Answers[i] = val;
  document.getElementById('r3p1-s' + i).querySelectorAll('.tf-btn')
    .forEach(b => b.className = 'tf-btn');
  btn.classList.add(val ? 'selected-true' : 'selected-false');
}

function checkR3P1() {
  if (Object.keys(r3p1Answers).length < r3p1Data.length) {
    showFeedback('r3p1-fb', false, 'Answer all four statements before checking.');
    return;
  }
  let allCorrect = true;
  const hints = [];
  r3p1Data.forEach((d, i) => {
    const item = document.getElementById('r3p1-s' + i);
    item.classList.remove('answered-correct', 'answered-wrong');
    if (r3p1Answers[i] === d.answer) {
      item.classList.add('answered-correct');
    } else {
      item.classList.add('answered-wrong');
      allCorrect = false;
      hints.push(d.explain);
    }
  });
  if (allCorrect) {
    showFeedback('r3p1-fb', true,
      'All correct! You understand the Third Law and what absolute zero really means.');
    state.puzzlesDone.r3p1 = true;
    document.getElementById('r3p2').classList.remove('hidden');
  } else {
    recordWrong('r3p1');
    showFeedback('r3p1-fb', false, hints[0] + ' Fix your answers and try again.');
  }
}

// Temperature slider
function updateTemp() {
  const val = parseInt(document.getElementById('tempSlider').value);
  document.getElementById('tempDisplay').textContent = val + ' K';

  const entropyPct = Math.round((val / 300) * 100);
  document.getElementById('entropyFill').style.width = entropyPct + '%';
  document.getElementById('entropyVal').textContent = entropyPct + '%';

  const msg = document.getElementById('tempMessage');
  if (val <= 1) {
    msg.textContent = 'SO CLOSE TO 0 K... BUT YOU CAN\'T QUITE REACH IT.';
    msg.style.color = 'var(--accent)';
    document.getElementById('r3p2-question').classList.remove('hidden');
  } else if (val < 10) {
    msg.textContent = 'NEARLY THERE — ENTROPY ALMOST ZERO, BUT NOT QUITE.';
    msg.style.color = 'var(--accent)';
  } else if (val < 60) {
    msg.textContent = 'VERY COLD. MOLECULAR MOTION IS SLOWING DRAMATICALLY.';
    msg.style.color = '#888';
  } else if (val < 150) {
    msg.textContent = 'GETTING COLDER. ENTROPY DECREASING AS ORDER INCREASES.';
    msg.style.color = '#555';
  } else {
    msg.textContent = 'DRAG LEFT TO COOL...';
    msg.style.color = '#444';
  }
}

// ── Finale ──
function updateCert() {
  const name = document.getElementById('certName').value.trim();
  document.getElementById('certDisplay').textContent = name || 'YOUR NAME';
  renderCertScore();
}

// ── Reset ──
function resetGame() {
  state.currentRoom = -1;
  state.completed = [false, false, false, false];
  Object.keys(state.puzzlesDone).forEach(k => state.puzzlesDone[k] = false);

  // Progress strip
  for (let i = 0; i < 4; i++) {
    const node = document.getElementById('pn' + i);
    node.classList.remove('active', 'done');
    node.textContent = i;
    if (i < 3) document.getElementById('pl' + i).classList.remove('done');
  }
  document.getElementById('pn0').classList.add('active');
  document.getElementById('progressStrip').style.display = '';

  // Body class
  document.body.className = '';

  // Feedback
  document.querySelectorAll('.feedback').forEach(f => {
    f.className = 'feedback';
    f.textContent = '';
  });

  // Hidden sections
  ['r0p2', 'r1p2', 'r2p2', 'r3p2'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));
  ['r0-next-btn', 'r1-next-btn', 'r2-next-btn', 'r3-next-btn'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));

  // Drag zones
  resetDragItems('r0p1-items', ['r0-group1', 'r0-group2']);
  resetDragItems('r2p1-items', ['r2-natural', 'r2-impossible']);

  // Energy slot
  const slot = document.getElementById('r1-slot1');
  const chipInSlot = slot.querySelector('.energy-chip');
  if (chipInSlot) document.getElementById('r1p1-chips').appendChild(chipInSlot);
  slot.classList.remove('filled');

  // R1P2 selections
  document.querySelectorAll('[id^="r1p2-s"]').forEach(el => {
    el.classList.remove('answered-correct', 'answered-wrong');
    el.querySelectorAll('.tf-btn').forEach(b => b.className = 'tf-btn');
  });
  Object.keys(r1p2Answers).forEach(k => delete r1p2Answers[k]);

  // R3P1 selections
  document.querySelectorAll('[id^="r3p1-s"]').forEach(el => {
    el.classList.remove('answered-correct', 'answered-wrong');
    el.querySelectorAll('.tf-btn').forEach(b => b.className = 'tf-btn');
  });
  Object.keys(r3p1Answers).forEach(k => delete r3p1Answers[k]);

  // Slider
  document.getElementById('tempSlider').value = 300;
  updateTemp();
  document.getElementById('r3p2-question').classList.add('hidden');
  document.querySelectorAll('#r3p2-question .mc-option').forEach(o => {
    o.className = 'mc-option';
    o.style.opacity = '';
    o.style.pointerEvents = '';
  });
  document.getElementById('r3p2-question').dataset.locked = '';

  // R2P2 order list
  document.getElementById('r2-order-list').innerHTML = '';

  // MC locks
  ['r0p2-opts', 'r3p2-question'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.dataset.locked = '';
      el.querySelectorAll('.mc-option').forEach(o => {
        o.className = 'mc-option';
        o.style.opacity = '';
        o.style.pointerEvents = '';
      });
    }
  });

  // Certificate
  document.getElementById('certName').value = '';
  document.getElementById('certDisplay').textContent = 'YOUR NAME';
  const certScore = document.getElementById('certScoreLine');
  if (certScore) certScore.textContent = 'FINAL GRADE: -- / 100';
  const gridEl = document.getElementById('certScoreGrid');
  if (gridEl) gridEl.innerHTML = '';
  const certDateEl = document.getElementById('certDateDisplay');
  if (certDateEl) certDateEl.textContent = '\u2014';
  const certSessEl = document.getElementById('certSessionDisplay');
  if (certSessEl) certSessEl.textContent = '\u2014';

  // Reset scoring
  initScoring();
  updateScoreBadge();

  showScreen('intro');
}

function resetDragItems(sourceId, zoneIds) {
  const source = document.getElementById(sourceId);
  zoneIds.forEach(zid => {
    document.getElementById(zid).querySelectorAll('.drag-item').forEach(item => {
      item.classList.remove('in-zone');
      source.appendChild(item);
    });
  });
}

// ── Init on load ──
document.addEventListener('DOMContentLoaded', () => {
  setQuestionFontPreset(localStorage.getItem(QUESTION_FONT_STORAGE_KEY) || getQuestionFontPreset());
  initScoring();
  updateScoreBadge();
  buildR1P2();
  buildR2P1();
  buildR3P1();
  initDragDrop('r0p1-items', ['r0-group1', 'r0-group2']);
  initEnergySlots();
  // R2P1 drag needs items to exist in DOM first
  setTimeout(() => initDragDrop('r2p1-items', ['r2-natural', 'r2-impossible']), 50);
  syncQuestionFontControls();
});
