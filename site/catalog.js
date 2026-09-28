// ===== LAB CATALOG =====
// One entry per experiment or simulation. Order here is the order on the page and
// the "atomic number" shown on each tile. Titles, descriptions and tags come from
// i18n/translations.js under labs.<key>; tile short names from site.short.<key>.
//
// To add a lab: append an entry, add labs.<key> to i18n/translations.js (all four
// languages), add site.short.<key> to site/strings.js, and optionally an ART.<key>
// drawing below. The periodic table grows and fills its gaps automatically.
//
//   key      translation key            sym     1–2 letter "element" symbol
//   type     'lab' | 'simulation'       family  'chem' | 'phys' | 'life' | 'safety'
//   link     launch URL                 versions [{ label: <translation key>, link }]
//   badge    optional corner label (e.g. '3D')

window.VL_CATALOG = [
    { key: 'spectrophotometry', sym: 'Sp', type: 'lab', family: 'chem', link: 'experiments/spectrophotometry/' },
    {
        key: 'dnamicroarray', sym: 'Ma', type: 'lab', family: 'life', badge: '3D',
        versions: [
            { label: 'site.buttons.v2d', link: 'experiments/dnamicroarray_v2/' },
            { label: 'site.buttons.v3d', link: 'experiments/dnamicroarray_v2/microarray-3d.html' },
            { label: 'buttons.launchV1', link: 'experiments/dnamicroarray/' }
        ]
    },
    { key: 'copperinbrass', sym: 'Cu', type: 'lab', family: 'chem', link: 'experiments/copperinbrass/' },
    { key: 'labstudio', sym: 'Ls', type: 'lab', family: 'chem', link: 'experiments/lab-studio/' },
    {
        key: 'elisaassay', sym: 'El', type: 'lab', family: 'life', badge: '3D',
        versions: [
            { label: 'site.buttons.v2d', link: 'experiments/elisa_assay/' },
            { label: 'site.buttons.v3d', link: 'experiments/elisa_assay/elisa-3d.html' }
        ]
    },
    { key: 'nuclearchemistry', sym: 'Nu', type: 'simulation', family: 'phys', link: 'simulations/nuclearchemistry/' },
    { key: 'labsafety', sym: 'Sf', type: 'simulation', family: 'safety', link: 'simulations/lab-safety-mi/' },
    { key: 'gaslaws', sym: 'Gl', type: 'simulation', family: 'phys', link: 'simulations/gassimulation/' },
    { key: 'moletycoon', sym: 'Mo', type: 'simulation', family: 'chem', link: 'simulations/mole_tycoon/index.html' },
    { key: 'thermodynamics', sym: 'Th', type: 'simulation', family: 'phys', link: 'simulations/thermodynamics/' },
    { key: 'solubilitycurves', sym: 'So', type: 'simulation', family: 'phys', link: 'simulations/solubility_curves/' },
    { key: 'pharmacogenomics', sym: 'Pg', type: 'simulation', family: 'life', link: 'simulations/pharmacogenomics/' },
    { key: 'virusdefenselab', sym: 'Vd', type: 'simulation', family: 'life', link: 'simulations/virus_defense_lab/' },
    { key: 'acidbasesolutions', sym: 'pH', type: 'simulation', family: 'chem', badge: '3D', link: 'simulations/acid_base_solutions/' },
    { key: 'latticeenergy', sym: 'Le', type: 'simulation', family: 'phys', link: 'simulations/lattice_energy_lab/' }
];

// ===== LINE ART =====
// Each function returns the inner markup of a 320×200 SVG. Strokes use currentColor
// (the page ink) and var(--c) (the lab's field colour), so drawings follow the theme.
(function () {
    'use strict';

    const r1 = n => Math.round(n * 10) / 10;

    // Small deterministic PRNG so "random" drawings are identical on every load.
    function rng(seed) {
        return function () {
            seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function head(x, y, deg, size = 6) {
        const a = deg * Math.PI / 180;
        const pt = (dx, dy) => `${r1(x + dx * Math.cos(a) - dy * Math.sin(a))} ${r1(y + dx * Math.sin(a) + dy * Math.cos(a))}`;
        return `<path class="art-fc" d="M${r1(x)} ${r1(y)}L${pt(-size, -size * 0.62)}L${pt(-size, size * 0.62)}Z"/>`;
    }

    function sample(fn, x0, x1, step) {
        let d = '';
        for (let x = x0; x <= x1 + 0.001; x += step) d += (d ? 'L' : 'M') + r1(x) + ' ' + r1(fn(x));
        return d;
    }

    const ART = {
        spectrophotometry(u) {
            const stops = [[0, '#7A3FE0'], [0.17, '#3558F0'], [0.33, '#1FA6E0'], [0.5, '#2DB85A'], [0.63, '#E8D22C'], [0.78, '#F28A26'], [1, '#E03A2E']];
            const curve = 'M40 150C70 140 88 152 118 150S170 146 190 120S214 42 232 42S262 112 292 152';
            return `<defs><linearGradient id="spg${u}" x1="0" x2="1">${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('')}</linearGradient></defs>
                <path class="art-ax" d="M40 26V160H292"/>
                <rect x="40" y="168" width="252" height="7" rx="3.5" fill="url(#spg${u})"/>
                <path class="art-fs" d="${curve}V160H40Z"/>
                <path class="art-ac draw" pathLength="1" d="${curve}"/>
                <path class="art-ln art-dash art-soft" d="M232 50V160"/>
                <circle class="art-fc" cx="232" cy="42" r="4.5"/>
                <text class="art-tx" x="242" y="34">λmax 630 nm</text>
                <text class="art-tx" x="28" y="30">A</text>
                <text class="art-tx" x="40" y="192">400</text>
                <text class="art-tx" x="292" y="192" text-anchor="end">700 nm</text>`;
        },

        dnamicroarray() {
            const r = rng(11);
            let s = '';
            for (let j = 0; j < 7; j++) {
                for (let i = 0; i < 14; i++) {
                    const cx = r1(47 + i * 17.5), cy = r1(46 + j * 17);
                    const v = r();
                    const col = v < 0.3 ? '#E5484D' : v < 0.58 ? '#2EAD68' : v < 0.8 ? '#F2C82F' : null;
                    s += col
                        ? `<circle class="spot" cx="${cx}" cy="${cy}" r="5.6" fill="${col}" fill-opacity="${(0.5 + r() * 0.5).toFixed(2)}" style="--d:${(r() * 1.6).toFixed(2)}s"/>`
                        : `<circle class="art-well" cx="${cx}" cy="${cy}" r="5.6"/>`;
                }
            }
            return `<rect class="art-ln" x="30" y="30" width="260" height="134" rx="10"/>${s}
                <text class="art-tx" x="30" y="186">Cy3</text><text class="art-tx" x="290" y="186" text-anchor="end">Cy5</text>
                <path class="art-ax" d="M62 183H258"/>`;
        },

        copperinbrass() {
            const pts = [[84, 138], [122, 118], [162, 95], [202, 74], [242, 53]];
            return `<path class="art-ax" d="M48 26V160H292"/>
                <path class="art-ac draw" pathLength="1" d="M58 152L278 34"/>
                ${pts.map(p => `<circle class="art-pt" cx="${p[0]}" cy="${p[1]}" r="4.5"/>`).join('')}
                <path class="art-ln art-dash art-soft" d="M182 85V160M182 85H48"/>
                <circle class="art-fs" cx="182" cy="85" r="11"/>
                <circle class="art-fc" cx="182" cy="85" r="4.5"/>
                <text class="art-tx" x="62" y="40">A = εbc</text>
                <text class="art-tx" x="182" y="176" text-anchor="middle">x</text>
                <text class="art-tx" x="292" y="176" text-anchor="end">[Cu²⁺]</text>`;
        },

        labstudio() {
            const box = (x, y, n) => `<rect class="art-box" x="${x}" y="${y}" width="60" height="32" rx="8"/><text class="art-tx" x="${x + 30}" y="${y + 20}" text-anchor="middle">${n}</text>`;
            const flow = 'M46 100H140M160 80V54H206M160 120V146H206M266 54H296V90M266 146H296V110';
            return `<path class="art-grid" d="M0 40H320M0 80H320M0 120H320M0 160H320M40 0V200M80 0V200M120 0V200M160 0V200M200 0V200M240 0V200M280 0V200"/>
                <path class="art-ln draw" pathLength="1" d="${flow}"/>
                <circle class="art-fc" cx="36" cy="100" r="10"/>
                ${box(62, 84, '01')}
                <path class="art-box" d="M160 80L180 100L160 120L140 100Z"/><text class="art-tx" x="160" y="104" text-anchor="middle">?</text>
                ${box(206, 38, '02')}${box(206, 130, '03')}
                <circle class="art-ring" cx="296" cy="100" r="10"/><circle class="art-fc" cx="296" cy="100" r="4.5"/>
                ${head(62, 100, 0)}${head(140, 100, 0)}${head(206, 54, 0)}${head(206, 146, 0)}${head(296, 90, 90)}${head(296, 110, -90)}
                <circle class="runner" r="4.5" style="offset-path:path('M36 100H160V54H296V100')"/>`;
        },

        elisaassay() {
            const r = rng(4);
            let s = '';
            const rows = 'ABCDEFGH';
            for (let j = 0; j < 8; j++) {
                s += `<text class="art-tx art-tiny" x="44" y="${r1(57 + j * 15.5)}" text-anchor="middle">${rows[j]}</text>`;
                for (let i = 0; i < 12; i++) {
                    let a;
                    if (i >= 10) a = 0.04;
                    else if (j < 2) a = 0.95 * Math.pow(0.7, i);
                    else { const v = r(); a = v < 0.35 ? 0.72 + r() * 0.25 : v < 0.62 ? 0.28 + r() * 0.3 : 0.05 + r() * 0.12; }
                    s += `<circle class="art-wellf" cx="${62 + i * 19}" cy="${r1(54 + j * 15.5)}" r="6.2" fill="#F2B705" fill-opacity="${a.toFixed(2)}"/>`;
                }
            }
            for (let i = 0; i < 12; i++) s += `<text class="art-tx art-tiny" x="${62 + i * 19}" y="42" text-anchor="middle">${i + 1}</text>`;
            return `<rect class="art-ln" x="28" y="26" width="264" height="152" rx="14"/>${s}
                <path class="art-ac draw" pathLength="1" d="M52 186H250"/>${head(262, 186, 0, 7)}`;
        },

        nuclearchemistry() {
            const r = rng(9);
            const pts = [];
            for (let q = -3; q <= 3; q++) {
                for (let k = -3; k <= 3; k++) {
                    const x = 14.5 * (q + k / 2), y = 14.5 * k * 0.866;
                    if (Math.hypot(x, y) <= 30) pts.push([x, y]);
                }
            }
            const nucleus = pts
                .sort((a, b) => Math.hypot(b[0], b[1]) - Math.hypot(a[0], a[1]))
                .map(p => {
                    const proton = r() < 0.5;
                    return `<circle class="${proton ? 'art-nuc-p' : 'art-nuc-n'}" cx="${r1(84 + p[0] + (r() - 0.5) * 3)}" cy="${r1(104 + p[1] + (r() - 0.5) * 3)}" r="7.8"/>`;
                }).join('');
            const alpha = [[-4.5, -4.5, 1], [4.5, -4.5, 0], [-4.5, 4.5, 0], [4.5, 4.5, 1]]
                .map(a => `<circle class="${a[2] ? 'art-nuc-p' : 'art-nuc-n'}" cx="${148 + a[0]}" cy="${46 + a[1]}" r="5"/>`).join('');
            const decay = x => 160 - 112 * Math.exp(-(x - 178) / 34);
            const h1 = 178 + 34 * Math.LN2, h2 = 178 + 68 * Math.LN2, h3 = 178 + 102 * Math.LN2;
            return `${nucleus}
                <path class="art-ln draw" pathLength="1" d="M112 80L134 60"/>${head(137, 57, -42)}
                <g class="alpha">${alpha}</g><text class="art-tx" x="126" y="40">α</text>
                <path class="art-ax" d="M178 30V160H300"/>
                <path class="art-ln art-dash art-soft" d="M178 104H${r1(h1)}V160M178 132H${r1(h2)}V160M178 146H${r1(h3)}V160"/>
                <path class="art-ac draw" pathLength="1" d="${sample(decay, 178, 300, 4)}"/>
                <text class="art-tx" x="${r1(h1)}" y="174" text-anchor="middle">t½</text>
                <text class="art-tx" x="300" y="174" text-anchor="end">t</text>
                <text class="art-tx" x="168" y="32">N</text>`;
        },

        labsafety() {
            const beams = ['M-10 40L330 122', 'M-10 168L330 54', 'M-10 94L330 188', 'M60 -10L118 210'];
            return `<g class="lasers">${beams.map(d => `<path class="laser-glow" d="${d}"/><path class="laser" d="${d}"/>`).join('')}</g>
                <path class="art-diamond" d="M160 44L216 100L160 156L104 100Z"/>
                <rect x="155.5" y="70" width="9" height="40" rx="4.5" fill="currentColor"/>
                <circle cx="160" cy="125" r="5.5" fill="currentColor"/>
                <text class="art-tx" x="296" y="190" text-anchor="end">01 / 10</text>`;
        },

        gaslaws() {
            const r = rng(21);
            let gas = '';
            for (let i = 0; i < 15; i++) {
                const x = r1(84 + r() * 72), y = r1(96 + r() * 66);
                const a = r() * Math.PI * 2, len = 7 + r() * 6;
                gas += `<g class="particle" style="--dx:${r1(Math.cos(a) * 3)}px;--dy:${r1(Math.sin(a) * 3)}px">
                    <path class="art-ln art-soft" d="M${x} ${y}L${r1(x - Math.cos(a) * len)} ${r1(y - Math.sin(a) * len)}"/>
                    <circle cx="${x}" cy="${y}" r="3.2" fill="currentColor"/></g>`;
            }
            let ticks = '';
            for (let i = 0; i <= 8; i++) {
                const ang = (210 - i * 30) * Math.PI / 180;
                const c = Math.cos(ang), s = Math.sin(ang);
                ticks += `M${r1(246 + c * 31)} ${r1(96 - s * 31)}L${r1(246 + c * 37)} ${r1(96 - s * 37)}`;
            }
            const na = 40 * Math.PI / 180;
            return `<path class="art-ln" stroke-width="2" d="M70 38V166Q70 174 78 174H162Q170 174 170 166V38"/>
                <g class="piston"><rect x="116" y="18" width="8" height="54" rx="2" fill="currentColor" opacity=".7"/>
                <rect x="98" y="12" width="44" height="9" rx="4.5" fill="currentColor"/>
                <rect class="art-fc" x="72.5" y="72" width="95" height="13" rx="3"/></g>
                <g class="gas">${gas}</g>
                <path class="art-ln" d="M170 124H217"/>
                <circle class="art-ln" cx="246" cy="96" r="42"/>
                <path class="art-ln art-soft" d="${ticks}"/>
                <path class="art-ac" stroke-width="3" d="M246 96L${r1(246 + Math.cos(na) * 30)} ${r1(96 - Math.sin(na) * 30)}"/>
                <circle class="art-fc" cx="246" cy="96" r="4.5"/>
                <text class="art-tx" x="246" y="170" text-anchor="middle">PV = nRT</text>`;
        },

        moletycoon() {
            const stacks = [[80, 3], [140, 5], [200, 8]];
            let coins = '';
            stacks.forEach(([x, n]) => {
                for (let k = 0; k < n; k++) {
                    const y = 164 - k * 7.5;
                    coins += `<path class="art-coin-side" d="M${x - 24} ${y}V${y + 5}A24 7 0 0 0 ${x + 24} ${y + 5}V${y}"/>
                        <ellipse class="art-coin" cx="${x}" cy="${y}" rx="24" ry="7"/>`;
                }
            });
            return `${coins}
                <path class="art-ac draw" pathLength="1" d="M36 146L96 118L150 128L256 50"/>${head(262, 45.5, -37, 8)}
                <text class="art-tx" x="298" y="190" text-anchor="end">6.022×10²³</text>
                <text class="art-tx" x="26" y="190">mol</text>`;
        },

        thermodynamics() {
            const loop = 'M84 52C112 66 140 78 170 86C200 106 232 128 262 142C228 138 192 132 160 126C130 106 104 76 84 52Z';
            const corners = [[84, 52, '0', -14, -4], [170, 86, '1', 6, -8], [262, 142, '2', 6, 14], [160, 126, '3', -12, 16]];
            return `<path class="art-ax" d="M44 24V172H296"/>
                <path class="art-fs" d="${loop}"/>
                <path class="art-ac draw" pathLength="1" d="${loop}"/>
                ${corners.map(c => `<circle class="art-pt" cx="${c[0]}" cy="${c[1]}" r="4.5"/><text class="art-tx" x="${c[0] + c[3]}" y="${c[1] + c[4]}">${c[2]}</text>`).join('')}
                <circle class="runner" r="5" style="offset-path:path('${loop}')"/>
                <text class="art-tx" x="120" y="54">T<tspan baseline-shift="sub" font-size="7">H</tspan></text>
                <text class="art-tx" x="206" y="158">T<tspan baseline-shift="sub" font-size="7">C</tspan></text>
                <text class="art-tx" x="32" y="30">P</text>
                <text class="art-tx" x="296" y="188" text-anchor="end">V</text>`;
        },

        solubilitycurves() {
            return `<path class="art-grid" d="M44 64H296M44 104H296M44 144H296M100 24V164M156 24V164M212 24V164M268 24V164"/>
                <path class="art-ax" d="M44 24V164H296"/>
                <path class="art-ln art-dash" d="M44 136C120 148 200 156 288 160"/>
                <path class="art-ln" d="M44 116C120 114 200 111 288 108"/>
                <path class="art-ac draw" pathLength="1" d="M44 150C110 146 190 110 280 30"/>
                <path class="art-ln art-dash art-soft" d="M165 112.5V164"/>
                <circle class="art-fc" cx="165" cy="112.5" r="4.5"/>
                <text class="art-tx" x="228" y="42" text-anchor="end">KNO₃</text>
                <text class="art-tx" x="290" y="100" text-anchor="end">NaCl</text>
                <text class="art-tx" x="290" y="152" text-anchor="end">O₂</text>
                <text class="art-tx" x="296" y="180" text-anchor="end">T / °C</text>`;
        },

        pharmacogenomics() {
            const amp = 30, x0 = 24, x1 = 214, k = (Math.PI * 2 * 1.75) / (x1 - x0);
            const a = x => 100 + amp * Math.sin((x - x0) * k);
            const b = x => 100 - amp * Math.sin((x - x0) * k);
            let rungs = '', snp = '';
            for (let x = x0 + 6; x < x1; x += 11) {
                if (Math.abs(x - 138) < 5.5) {
                    snp = `<path class="art-ac" d="M${x} ${r1(a(x))}L${x} ${r1(b(x))}"/><circle class="art-fc" cx="${x}" cy="${r1(a(x))}" r="4"/><circle class="art-fc" cx="${x}" cy="${r1(b(x))}" r="4"/>
                        <text class="art-tx" x="${x}" y="${r1(Math.min(a(x), b(x)) - 12)}" text-anchor="middle">*3A</text>`;
                } else {
                    rungs += `M${x} ${r1(a(x))}L${x} ${r1(b(x))}`;
                }
            }
            return `<path class="art-ln art-soft" d="${rungs}"/>
                <path class="art-ln draw" pathLength="1" stroke-width="2.2" d="${sample(a, x0, x1, 3)}"/>
                <path class="art-ln draw" pathLength="1" stroke-width="2.2" d="${sample(b, x0, x1, 3)}"/>
                ${snp}
                <g transform="rotate(-32 262 104)">
                    <path class="art-fc" d="M240 90H262V118H240A14 14 0 0 1 240 90Z"/>
                    <rect class="art-ln" x="226" y="90" width="72" height="28" rx="14" stroke-width="2"/>
                </g>
                <text class="art-tx" x="24" y="180">TPMT</text>
                <text class="art-tx" x="262" y="166" text-anchor="middle">6-MP</text>`;
        },

        virusdefenselab() {
            const cx = 132, cy = 94, R = 32;
            let spikes = '', knobs = '';
            for (let i = 0; i < 14; i++) {
                const t = (i / 14) * Math.PI * 2 + 0.2;
                spikes += `M${r1(cx + Math.cos(t) * R)} ${r1(cy + Math.sin(t) * R)}L${r1(cx + Math.cos(t) * (R + 11))} ${r1(cy + Math.sin(t) * (R + 11))}`;
                knobs += `<circle class="art-fc" cx="${r1(cx + Math.cos(t) * (R + 13))}" cy="${r1(cy + Math.sin(t) * (R + 13))}" r="3.6"/>`;
            }
            const ab = [[254, 52], [262, 132], [34, 60], [214, 172]].map(([x, y]) => {
                const deg = Math.atan2(cy - y, cx - x) * 180 / Math.PI + 90;
                return `<g class="antibody" transform="translate(${x} ${y}) rotate(${r1(deg)})"><path class="art-ln" stroke-width="3" d="M0 16V0L-9 -12M0 0L9 -12"/><circle class="art-fc" cx="-9" cy="-12" r="2.6"/><circle class="art-fc" cx="9" cy="-12" r="2.6"/></g>`;
            }).join('');
            let membrane = '';
            for (let x = 8; x < 320; x += 12) membrane += `<circle cx="${x}" cy="190" r="4" class="art-mem"/>`;
            return `<g class="virus"><path class="art-ln" d="${spikes}"/>${knobs}
                <circle cx="${cx}" cy="${cy}" r="${R}" class="art-cell"/>
                <path class="art-ln art-soft" d="M114 96c4-9 9 9 13 0s9 9 13 0 9 9 13 0"/></g>
                ${ab}${membrane}`;
        },

        acidbasesolutions(u) {
            const r = rng(3);
            let parts = '';
            for (let i = 0; i < 12; i++) {
                const x = r1(92 + r() * 72), y = r1(94 + r() * 64);
                const acid = i % 3 !== 0;
                parts += acid
                    ? `<g transform="translate(${x} ${y})"><circle class="art-fc" r="7"/><path d="M-3 0H3M0 -3V3" stroke="var(--on)" stroke-width="1.6"/></g>`
                    : `<g transform="translate(${x} ${y})"><circle class="art-pt" r="7"/><path d="M-3 0H3" stroke="currentColor" stroke-width="1.6"/></g>`;
            }
            const stops = [[0, '#6E3FD9'], [0.28, '#2F6BFF'], [0.5, '#30A46C'], [0.64, '#F5D90A'], [0.8, '#F28C28'], [1, '#E5484D']];
            return `<defs><linearGradient id="phg${u}" x1="0" y1="0" x2="0" y2="1">${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('')}</linearGradient></defs>
                <path class="art-fs" d="M77 78H201V160Q201 171 190 171H88Q77 171 77 160Z"/>
                <path class="art-ac" d="M77 78H201"/>
                <path class="art-ln" stroke-width="2" d="M64 34Q74 34 76 42V160Q76 172 88 172H190Q202 172 202 160V42Q204 34 214 34"/>
                ${parts}
                <rect x="176" y="14" width="10" height="112" rx="5" fill="currentColor" opacity=".78"/>
                <circle class="art-ring" cx="181" cy="130" r="6"/>
                <rect x="258" y="28" width="12" height="144" rx="6" fill="url(#phg${u})"/>
                <path d="M244 134L254 140L244 146Z" fill="currentColor"/>
                <text class="art-tx" x="278" y="34">14</text><text class="art-tx" x="278" y="104">7</text><text class="art-tx" x="278" y="174">0</text>`;
        },

        latticeenergy() {
            const xs = [100, 152, 204], ys = [74, 122, 170], dx = 44, dy = -32;
            const atom = (x, y, big, back) => big
                ? `<circle class="art-ion-big${back ? ' back' : ''}" cx="${x}" cy="${y}" r="12"/>`
                : `<circle class="art-ion-small${back ? ' back' : ''}" cx="${x}" cy="${y}" r="7"/>`;
            let back = '', front = '', depth = '', gridB = '', gridF = '';
            xs.forEach((x, i) => {
                gridB += `M${x + dx} ${ys[0] + dy}V${ys[2] + dy}`;
                gridF += `M${x} ${ys[0]}V${ys[2]}`;
            });
            ys.forEach(y => {
                gridB += `M${xs[0] + dx} ${y + dy}H${xs[2] + dx}`;
                gridF += `M${xs[0]} ${y}H${xs[2]}`;
            });
            xs.forEach((x, i) => ys.forEach((y, j) => {
                depth += `M${x} ${y}L${x + dx} ${y + dy}`;
                back += atom(x + dx, y + dy, (i + j + 1) % 2 === 0, true);
                front += atom(x, y, (i + j) % 2 === 0, false);
            }));
            return `<path class="art-ln art-soft" d="${gridB}"/>${back}
                <path class="art-ln art-soft" d="${depth}"/>
                <path class="art-ln" d="${gridF}"/>${front}
                <path class="art-ac draw" pathLength="1" d="M40 40V150"/>${head(40, 162, 90, 8)}
                <text class="art-tx" x="40" y="184" text-anchor="middle">ΔH &lt; 0</text>`;
        }
    };

    let uid = 0;
    window.VL_ART = function (key) {
        const draw = ART[key];
        if (!draw) return '';
        uid += 1;
        return `<svg class="art" viewBox="0 0 320 200" aria-hidden="true" focusable="false">${draw(uid)}</svg>`;
    };
})();
