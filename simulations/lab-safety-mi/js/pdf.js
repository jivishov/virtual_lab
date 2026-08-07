// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Minimal vector PDF writer for the completion certificate.
//
// Writes a real .pdf file (A4 landscape) with no external library, so the
// simulation stays self-contained and offline. The certificate is drawn as
// vectors and text in the 14 standard PDF fonts rather than a screenshot, so
// it prints crisply at any size and the text stays selectable.
//
// Text is centred using canvas measureText with metrically-compatible
// families (Arial for Helvetica, Times New Roman for Times), which avoids
// embedding an AFM width table for every glyph.
// ===================================

const PDF_PAGE = { w: 841.89, h: 595.28 };   // A4 landscape, points

const PDF_FONTS = {
    body:      { res: 'F1', base: 'Helvetica',      css: '{s}px Arial, Helvetica, sans-serif' },
    bodyBold:  { res: 'F2', base: 'Helvetica-Bold', css: 'bold {s}px Arial, Helvetica, sans-serif' },
    display:   { res: 'F3', base: 'Times-Bold',     css: 'bold {s}px "Times New Roman", Times, serif' },
    displayIt: { res: 'F4', base: 'Times-Italic',   css: 'italic {s}px "Times New Roman", Times, serif' }
};

// WinAnsiEncoding cannot represent everything the UI uses. Map what matters
// and drop the rest rather than emitting broken glyphs.
// Values must be Latin-1 (<= 0xFF): WinAnsi puts the bullet at 0x95 and the
// degree sign at 0xB0. Mapping to a Unicode char such as U+2022 would make
// pdfEscape emit a 5-digit octal escape, which is not valid PDF syntax.
const PDF_CHAR_MAP = {
    '—': '-', '–': '-', '−': '-',
    '‘': "'", '’': "'", '“': '"', '”': '"',
    '·': '\x95', '•': '\x95', '…': '...',
    '₂': '2', '₃': '3', '₄': '4',
    '°': '\xb0', '✓': '', '✗': '', '✕': '', '⭳': ''
};

function pdfSanitize(str) {
    let out = '';
    for (const ch of String(str)) {
        const mapped = PDF_CHAR_MAP[ch];
        if (mapped !== undefined) { out += mapped; continue; }
        out += ch.codePointAt(0) <= 0xff ? ch : '';
    }
    return out;
}

function pdfEscape(str) {
    let out = '';
    for (const ch of str) {
        const code = ch.charCodeAt(0);
        if (ch === '\\' || ch === '(' || ch === ')') out += '\\' + ch;
        else if (code > 0xff) continue;              // never emit an over-long escape
        else if (code < 32 || code > 126) out += '\\' + code.toString(8).padStart(3, '0');
        else out += ch;
    }
    return out;
}

class PdfDoc {
    constructor(width = PDF_PAGE.w, height = PDF_PAGE.h) {
        this.w = width;
        this.h = height;
        this.ops = [];
        this.canvas = document.createElement('canvas').getContext('2d');
    }

    // Page coordinates run bottom-up in PDF; the drawing code uses top-down.
    y(v) { return +(this.h - v).toFixed(2); }

    rgb(hex) {
        const n = parseInt(hex.replace('#', ''), 16);
        return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]
            .map(v => v.toFixed(3)).join(' ');
    }

    setFill(hex)   { this.ops.push(`${this.rgb(hex)} rg`); return this; }
    setStroke(hex) { this.ops.push(`${this.rgb(hex)} RG`); return this; }
    setWidth(w)    { this.ops.push(`${w} w`); return this; }

    rect(x, y, w, h, mode = 'S') {
        this.ops.push(`${x.toFixed(2)} ${this.y(y + h)} ${w.toFixed(2)} ${h.toFixed(2)} re ${mode}`);
        return this;
    }

    line(x1, y1, x2, y2) {
        this.ops.push(`${x1.toFixed(2)} ${this.y(y1)} m ${x2.toFixed(2)} ${this.y(y2)} l S`);
        return this;
    }

    circle(cx, cy, r, mode = 'S') {
        const k = 0.5523 * r;
        const y = this.y(cy);
        this.ops.push(
            `${(cx - r).toFixed(2)} ${y.toFixed(2)} m`,
            `${(cx - r).toFixed(2)} ${(y + k).toFixed(2)} ${(cx - k).toFixed(2)} ${(y + r).toFixed(2)} ${cx.toFixed(2)} ${(y + r).toFixed(2)} c`,
            `${(cx + k).toFixed(2)} ${(y + r).toFixed(2)} ${(cx + r).toFixed(2)} ${(y + k).toFixed(2)} ${(cx + r).toFixed(2)} ${y.toFixed(2)} c`,
            `${(cx + r).toFixed(2)} ${(y - k).toFixed(2)} ${(cx + k).toFixed(2)} ${(y - r).toFixed(2)} ${cx.toFixed(2)} ${(y - r).toFixed(2)} c`,
            `${(cx - k).toFixed(2)} ${(y - r).toFixed(2)} ${(cx - r).toFixed(2)} ${(y - k).toFixed(2)} ${(cx - r).toFixed(2)} ${y.toFixed(2)} c`,
            mode
        );
        return this;
    }

    measure(str, size, fontKey, spacing = 0) {
        const font = PDF_FONTS[fontKey] || PDF_FONTS.body;
        this.canvas.font = font.css.replace('{s}', size);
        const w = this.canvas.measureText(str).width;
        return w + spacing * Math.max(0, str.length - 1);
    }

    text(raw, opts = {}) {
        const {
            x = 0, y = 0, size = 12, font = 'body',
            align = 'left', spacing = 0, color = '#000000'
        } = opts;

        const str = pdfSanitize(raw);
        if (!str) return this;

        const res = (PDF_FONTS[font] || PDF_FONTS.body).res;
        let tx = x;
        if (align !== 'left') {
            const w = this.measure(str, size, font, spacing);
            tx = align === 'center' ? x - w / 2 : x - w;
        }

        this.ops.push(
            'BT',
            `${this.rgb(color)} rg`,
            `/${res} ${size} Tf`,
            spacing ? `${spacing} Tc` : '0 Tc',
            `1 0 0 1 ${tx.toFixed(2)} ${this.y(y).toFixed(2)} Tm`,
            `(${pdfEscape(str)}) Tj`,
            'ET'
        );
        return this;
    }

    build() {
        const content = this.ops.join('\n');
        const fontObjs = Object.values(PDF_FONTS);

        const objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.w.toFixed(2)} ${this.h.toFixed(2)}] ` +
                `/Resources << /Font << ${fontObjs.map((f, i) => `/${f.res} ${5 + i} 0 R`).join(' ')} >> >> ` +
                '/Contents 4 0 R >>',
            `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
            ...fontObjs.map(f =>
                `<< /Type /Font /Subtype /Type1 /BaseFont /${f.base} /Encoding /WinAnsiEncoding >>`)
        ];

        let out = '%PDF-1.4\n';
        const offsets = [];

        objects.forEach((body, i) => {
            offsets.push(out.length);
            out += `${i + 1} 0 obj\n${body}\nendobj\n`;
        });

        const xrefAt = out.length;
        out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
        offsets.forEach(o => { out += `${String(o).padStart(10, '0')} 00000 n \n`; });
        out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
               `startxref\n${xrefAt}\n%%EOF`;

        const bytes = new Uint8Array(out.length);
        for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
        return bytes;
    }
}

// ===================================
// CERTIFICATE LAYOUT
// ===================================

const CERT_INK = {
    navy: '#1b2a4a',
    gold: '#a9803a',
    goldLight: '#d8b978',
    crimson: '#8d1c1c',
    grey: '#5a6478',
    paper: '#fbf8f1',
    // seal grade bands, matched to certificate.css
    silver: '#5f7386',
    bronze: '#96602f',
    fail: '#a3231f'
};

function buildCertificatePdf(data) {
    const doc = new PdfDoc();
    const W = doc.w;
    const pass = !!data.passed;

    // paper
    doc.setFill(CERT_INK.paper).rect(0, 0, W, doc.h, 'f');

    // double rule border with gold inner line
    doc.setStroke(CERT_INK.navy).setWidth(3).rect(26, 26, W - 52, doc.h - 52, 'S');
    doc.setWidth(1).rect(34, 34, W - 68, doc.h - 68, 'S');
    doc.setStroke(CERT_INK.gold).setWidth(0.8).rect(41, 41, W - 82, doc.h - 82, 'S');

    // corner marks
    doc.setStroke(CERT_INK.gold).setWidth(1.6);
    [[41, 41, 1, 1], [W - 41, 41, -1, 1], [41, doc.h - 41, 1, -1], [W - 41, doc.h - 41, -1, -1]]
        .forEach(([x, y, sx, sy]) => {
            doc.line(x, y + sy * 22, x, y);
            doc.line(x, y, x + sx * 22, y);
        });

    let y = 84;

    doc.text('IMPOSSIBLE MISSION FORCE  •  SCIENCE DIVISION',
        { x: W / 2, y, size: 9.5, font: 'bodyBold', align: 'center', spacing: 3.4, color: CERT_INK.gold });

    y += 40;
    doc.text(pass ? 'Certificate of Laboratory Safety' : 'Laboratory Safety Retraining Notice',
        { x: W / 2, y, size: 30, font: 'display', align: 'center', color: CERT_INK.navy });

    y += 16;
    doc.setStroke(CERT_INK.gold).setWidth(1).line(W / 2 - 120, y, W / 2 + 120, y);
    doc.setFill(CERT_INK.gold).circle(W / 2, y, 3, 'f');

    y += 34;
    doc.text(pass ? 'This certifies that operative' : 'This records that operative',
        { x: W / 2, y, size: 12, font: 'displayIt', align: 'center', color: CERT_INK.grey });

    y += 44;
    doc.text(data.name || 'AGENT',
        { x: W / 2, y, size: 40, font: 'display', align: 'center', spacing: 2, color: CERT_INK.crimson });

    y += 14;
    doc.setStroke(CERT_INK.navy).setWidth(0.8).line(W / 2 - 190, y, W / 2 + 190, y);

    // body copy, wrapped by hand into two measured lines
    y += 28;
    (data.body || []).forEach(lineText => {
        doc.text(lineText, { x: W / 2, y, size: 11.5, font: 'body', align: 'center', color: CERT_INK.grey });
        y += 17;
    });

    // three stat plates
    y += 18;
    const stats = data.stats || [];
    const plateW = 150;
    const gap = 22;
    const totalW = stats.length * plateW + (stats.length - 1) * gap;
    let px = W / 2 - totalW / 2;

    stats.forEach(stat => {
        doc.setStroke(CERT_INK.gold).setWidth(1).rect(px, y, plateW, 54, 'S');
        doc.text(stat.value, {
            x: px + plateW / 2, y: y + 27, size: 21, font: 'display',
            align: 'center', color: CERT_INK.navy
        });
        doc.text(stat.label, {
            x: px + plateW / 2, y: y + 45, size: 7.5, font: 'bodyBold',
            align: 'center', spacing: 1.6, color: CERT_INK.gold
        });
        px += plateW + gap;
    });

    y += 84;
    doc.text('RANK CONFERRED', {
        x: W / 2, y, size: 8, font: 'bodyBold', align: 'center',
        spacing: 2.6, color: CERT_INK.gold
    });

    y += 22;
    doc.text(data.rank || '', {
        x: W / 2, y, size: 16, font: 'display', align: 'center',
        spacing: 1.2, color: CERT_INK.navy
    });

    if (data.badges && data.badges.length) {
        y += 22;
        doc.text(data.badges.join('   •   '), {
            x: W / 2, y, size: 9.5, font: 'body', align: 'center', color: CERT_INK.grey
        });
    }

    // Award seal, upper right inside the border. Mirrors the on-screen seal:
    // graded ink for a pass, warning cues for a fail, so a printed copy says
    // the same thing at a glance that the screen does.
    const sx = W - 118;
    const sy = 132;
    const pct = Number(data.percent) || 0;
    const seal = !pass ? { ink: CERT_INK.fail, band: 'NOT CLEARED' }
               : pct >= 90 ? { ink: CERT_INK.gold, band: 'HONOURS' }
               : pct >= 80 ? { ink: CERT_INK.silver, band: 'MERIT' }
               : { ink: CERT_INK.bronze, band: 'PASS' };

    doc.setStroke(seal.ink).setWidth(pass ? 2.4 : 3.4).circle(sx, sy, 40, 'S');
    doc.setWidth(0.9).circle(sx, sy, 33, 'S');

    if (pass) {
        // rosette teeth
        doc.setWidth(1.6);
        for (let i = 0; i < 36; i++) {
            const a = i * Math.PI / 18;
            doc.line(sx + Math.cos(a) * 40, sy + Math.sin(a) * 40,
                     sx + Math.cos(a) * 45, sy + Math.sin(a) * 45);
        }
        doc.text('IMF', { x: sx, y: sy - 10, size: 7, font: 'bodyBold',
                          align: 'center', spacing: 2, color: seal.ink });
        doc.text(`${pct}%`, { x: sx, y: sy + 9, size: 20, font: 'display',
                              align: 'center', spacing: 0.5, color: seal.ink });
    } else {
        // hazard ticks around the rim, in place of the rosette
        doc.setWidth(4);
        for (let i = 0; i < 24; i++) {
            const a = i * Math.PI / 12;
            doc.line(sx + Math.cos(a) * 40.5, sy + Math.sin(a) * 40.5,
                     sx + Math.cos(a) * 46, sy + Math.sin(a) * 46);
        }
        // warning triangle
        doc.setStroke(seal.ink).setWidth(1.8);
        doc.line(sx, sy - 19, sx - 8, sy - 6).line(sx - 8, sy - 6, sx + 8, sy - 6)
           .line(sx + 8, sy - 6, sx, sy - 19);
        doc.setWidth(1.6).line(sx, sy - 15, sx, sy - 10);
        doc.text('RETRAIN', { x: sx, y: sy + 8, size: 11, font: 'display',
                              align: 'center', spacing: 1, color: seal.ink });
    }

    doc.text(seal.band, {
        x: sx, y: sy + 23, size: 6.4, font: 'bodyBold', align: 'center',
        spacing: 1.2, color: seal.ink
    });

    // signature blocks
    const sigY = doc.h - 92;
    const blocks = [
        { x: 170, line: data.instructor || '', label: 'Chief Lab Safety Officer • IMF Science Division' },
        { x: W - 170, line: data.date || '', label: 'Date of issue' }
    ];

    blocks.forEach(block => {
        doc.setStroke(CERT_INK.navy).setWidth(0.9).line(block.x - 110, sigY, block.x + 110, sigY);
        if (block.line) {
            doc.text(block.line, {
                x: block.x, y: sigY - 7, size: 13, font: 'displayIt',
                align: 'center', color: CERT_INK.navy
            });
        }
        doc.text(block.label, {
            x: block.x, y: sigY + 14, size: 7.5, font: 'bodyBold',
            align: 'center', spacing: 1.1, color: CERT_INK.gold
        });
    });

    doc.text('Virtual Lab (https://virtuallab.az) • Laboratory Safety Protocol simulation', {
        x: W / 2, y: doc.h - 52, size: 7, font: 'body', align: 'center',
        spacing: 1, color: CERT_INK.grey
    });

    return doc.build();
}

function downloadCertificatePdf(data) {
    const bytes = buildCertificatePdf(data);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const safeName = String(data.name || 'agent').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const link = document.createElement('a');
    link.href = url;
    link.download = `lab-safety-certificate-${safeName}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// pdfSanitize is exported so teacher.html can preview a name through the real
// rules rather than a second copy of them — it is the function that decides a
// teacher's name is renderable, and getting that wrong is only discovered after
// a student downloads a PDF with letters missing.
window.certificatePdf = { buildCertificatePdf, downloadCertificatePdf, PdfDoc, pdfSanitize };
