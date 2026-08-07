// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Scene illustrations and option icons
//
// Semi-realistic rendering rather than wireframes. Everything is built from a
// small materials library — shaded glass, graded liquids, brushed steel,
// yellow safety enamel — plus contact shadows and a bench reflection, so the
// apparatus reads as objects sitting in light instead of outlines.
//
// Colour is declared INLINE on the shapes, not in CSS. Two earlier attempts
// lost their fills to selector-specificity fights; CSS here only animates.
//
// Gradient ids are shared across scenes, which is safe because renderScene
// swaps innerHTML and only one scene is ever mounted at a time.
//
// Scenes: viewBox 0 0 320 176. Icons: viewBox 0 0 32 32.
// ===================================

const BENCH_Y = 146;

const MATERIALS = `
<defs>
    <!-- glass body: bright edges, near-invisible centre -->
    <linearGradient id="mGlass" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"    stop-color="#eaf6ff" stop-opacity=".30"/>
        <stop offset=".10"  stop-color="#bcd9ee" stop-opacity=".10"/>
        <stop offset=".34"  stop-color="#ffffff" stop-opacity=".03"/>
        <stop offset=".66"  stop-color="#bcd9ee" stop-opacity=".07"/>
        <stop offset=".90"  stop-color="#eaf6ff" stop-opacity=".22"/>
        <stop offset="1"    stop-color="#9dc4dd" stop-opacity=".34"/>
    </linearGradient>
    <linearGradient id="mGlassRim" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"   stop-color="#dcefff" stop-opacity=".95"/>
        <stop offset=".45" stop-color="#8fb3cc" stop-opacity=".55"/>
        <stop offset="1"   stop-color="#dcefff" stop-opacity=".95"/>
    </linearGradient>

    <!-- liquids -->
    <linearGradient id="mAcid" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0"   stop-color="#ffe49b"/>
        <stop offset=".22" stop-color="#f7c63a"/>
        <stop offset=".55" stop-color="#eaa41c"/>
        <stop offset="1"   stop-color="#a45f06"/>
    </linearGradient>
    <linearGradient id="mWater" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0"   stop-color="#e2f6ff" stop-opacity=".92"/>
        <stop offset=".35" stop-color="#8fcdec" stop-opacity=".85"/>
        <stop offset="1"   stop-color="#2f78ad" stop-opacity=".9"/>
    </linearGradient>

    <!-- brushed steel -->
    <linearGradient id="mSteel" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"   stop-color="#54636f"/>
        <stop offset=".28" stop-color="#c3d2de"/>
        <stop offset=".46" stop-color="#8496a5"/>
        <stop offset=".72" stop-color="#dde7ef"/>
        <stop offset="1"   stop-color="#4c5a66"/>
    </linearGradient>
    <linearGradient id="mSteelV" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0"   stop-color="#d5e1ea"/>
        <stop offset=".5"  stop-color="#8b9dab"/>
        <stop offset="1"   stop-color="#4a5764"/>
    </linearGradient>

    <!-- safety yellow enamel (flammables cabinet) -->
    <linearGradient id="mYellow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"   stop-color="#c99a12"/>
        <stop offset=".18" stop-color="#f2c62f"/>
        <stop offset=".62" stop-color="#dcae1c"/>
        <stop offset="1"   stop-color="#a87c08"/>
    </linearGradient>

    <!-- painted door / cabinet interior -->
    <linearGradient id="mPaint" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0"   stop-color="#2c3b52"/>
        <stop offset=".3"  stop-color="#4a6284"/>
        <stop offset="1"   stop-color="#222e40"/>
    </linearGradient>

    <!-- flame -->
    <linearGradient id="mFlame" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0"   stop-color="#ff4d00"/>
        <stop offset=".35" stop-color="#ff9500"/>
        <stop offset=".72" stop-color="#ffd34a"/>
        <stop offset="1"   stop-color="#fff6d0"/>
    </linearGradient>
    <radialGradient id="mFlameGlow">
        <stop offset="0"   stop-color="#ffb03a" stop-opacity=".55"/>
        <stop offset="1"   stop-color="#ff7a00" stop-opacity="0"/>
    </radialGradient>
    <!-- corrosive vapour coming off a spill -->
    <radialGradient id="mFume">
        <stop offset="0"   stop-color="#f9e8bd" stop-opacity=".55"/>
        <stop offset=".5"  stop-color="#dcd0a8" stop-opacity=".22"/>
        <stop offset="1"   stop-color="#cfd8e0" stop-opacity="0"/>
    </radialGradient>
    <!-- steam off heated glassware -->
    <radialGradient id="mSteam">
        <stop offset="0"   stop-color="#ffffff" stop-opacity=".5"/>
        <stop offset=".5"  stop-color="#dceaf6" stop-opacity=".2"/>
        <stop offset="1"   stop-color="#dceaf6" stop-opacity="0"/>
    </radialGradient>
    <!-- glowing hotplate element -->
    <radialGradient id="mHot">
        <stop offset="0"   stop-color="#ffb44a"/>
        <stop offset=".45" stop-color="#e0561a"/>
        <stop offset="1"   stop-color="#6d1f08"/>
    </radialGradient>
    <!-- light spilling onto the floor from an exit sign. A blurred flat fill
         clipped against its filter region and rendered as a hard rectangle. -->
    <radialGradient id="mExitGlow">
        <stop offset="0"   stop-color="#31c866" stop-opacity=".22"/>
        <stop offset=".6"  stop-color="#31c866" stop-opacity=".07"/>
        <stop offset="1"   stop-color="#31c866" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mBlueFlame" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0"   stop-color="#1d6fd0"/>
        <stop offset=".5"  stop-color="#6fc4ff"/>
        <stop offset="1"   stop-color="#dff3ff"/>
    </linearGradient>
    <!-- the falling water of a safety shower: dense at the head, thinning out -->
    <linearGradient id="mSpray" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0"   stop-color="#e4f6ff" stop-opacity=".34"/>
        <stop offset=".55" stop-color="#a9dcf7" stop-opacity=".15"/>
        <stop offset="1"   stop-color="#7fc4f0" stop-opacity=".03"/>
    </linearGradient>
    <!-- microscope illuminator -->
    <radialGradient id="mLamp">
        <stop offset="0"   stop-color="#fff6d8" stop-opacity=".8"/>
        <stop offset=".45" stop-color="#ffe9a8" stop-opacity=".3"/>
        <stop offset="1"   stop-color="#ffd98a" stop-opacity="0"/>
    </radialGradient>

    <!-- key light and bench -->
    <radialGradient id="mKey" cx=".32" cy=".22" r=".85">
        <stop offset="0"   stop-color="#9fd8ff" stop-opacity=".16"/>
        <stop offset="1"   stop-color="#9fd8ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mBenchTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0"   stop-color="#2b3a52"/>
        <stop offset="1"   stop-color="#0d1320"/>
    </linearGradient>
    <linearGradient id="mFadeOut" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0"   stop-color="#080c16" stop-opacity="0"/>
        <stop offset=".75" stop-color="#080c16" stop-opacity=".92"/>
        <stop offset="1"   stop-color="#080c16"/>
    </linearGradient>

    <!-- soft shadow / bloom -->
    <filter id="fShadow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3.4"/>
    </filter>
    <filter id="fSoft" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="1.6"/>
    </filter>
    <filter id="fBloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="4.5"/>
    </filter>
    <filter id="fBlurRefl" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.9"/>
    </filter>
</defs>`;

// ---- shared pieces ----------------------------------------------------

function keyLight() {
    return `<rect x="0" y="0" width="320" height="176" fill="url(#mKey)"/>`;
}

function benchTop(y = BENCH_Y) {
    return `
    <rect x="0" y="${y}" width="320" height="${176 - y}" fill="url(#mBenchTop)"/>
    <path d="M0 ${y}h320" stroke="#7fa8c9" stroke-opacity=".55" stroke-width="1.2"/>
    <path d="M0 ${y + 1.4}h320" stroke="#0a0f1a" stroke-opacity=".9" stroke-width="2"/>`;
}

// Flipped, blurred copy of the subject, faded into the bench.
function reflection(content, y = BENCH_Y) {
    return `
    <g transform="translate(0 ${2 * y}) scale(1 -1)" opacity=".26" filter="url(#fBlurRefl)">
        ${content}
    </g>
    <rect x="0" y="${y}" width="320" height="${176 - y}" fill="url(#mFadeOut)"/>`;
}

function contactShadow(cx, cy, rx, ry = 4) {
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
                     fill="#03060d" opacity=".62" filter="url(#fShadow)"/>`;
}

// `spacing` matters for the small labels: Orbitron at 1.5 tracking overruns any
// plate narrow enough to sit on an object, and the overrun lands dark-on-dark.
function label(x, y, text, color = '#9fb6cf', size = 8.6, anchor = 'middle', spacing = 1.5) {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}"
                  font-family="Orbitron, monospace" font-size="${size}"
                  letter-spacing="${spacing}">${text}</text>`;
}

// Every string drawn into the artwork goes through the global T() from
// i18n.js, so the pictures speak the same language as the rest of the screen.

// A caption plate sized to its text.
//
// The plate is nudged back inside the 320-wide viewBox when its text is wide
// enough to overhang. Translations are not the same length as the English they
// replace, and a plate that runs off the canvas is clipped, not scrolled.
function plate(cx, y, text, { color = '#f0b13a', border = '#f0b13a', size = 8.6 } = {}) {
    const w = text.length * size * 0.78 + 16;
    const x = Math.min(Math.max(cx, w / 2 + 3), Math.max(w / 2 + 3, 317 - w / 2));
    return `
    <rect x="${x - w / 2}" y="${y - 11}" width="${w}" height="16" rx="3"
          fill="#070c17" fill-opacity=".9" stroke="${border}" stroke-opacity=".7" stroke-width="1"/>
    ${label(x, y, text, color, size)}`;
}

function leader(x1, y1, x2, y2, color = '#8fb0cd') {
    return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-opacity=".6"
                  stroke-width="1" stroke-dasharray="3 3"/>
            <circle cx="${x2}" cy="${y2}" r="2" fill="${color}" fill-opacity=".85"/>`;
}

function dimension(x1, x2, y, caption) {
    return `
    <g stroke="#8fb0cd" stroke-opacity=".7" stroke-width="1" fill="none">
        <path d="M${x1} ${y - 6}v12M${x2} ${y - 6}v12"/>
        <path d="M${x1} ${y}h${x2 - x1}"/>
        <path d="M${x1 + 6} ${y - 3.4}L${x1} ${y}l6 3.4M${x2 - 6} ${y - 3.4}L${x2} ${y}l-6 3.4"
              fill="#8fb0cd" fill-opacity=".8"/>
    </g>
    ${plate((x1 + x2) / 2, y + 4, caption, { color: '#b9cee3', border: '#6f8ba6' })}`;
}

// ---- glassware -------------------------------------------------------

// A beaker with shaded liquid, meniscus, specular highlights and graduations.
function beaker(x, y, w, h, fill = 0.5, liquid = 'mAcid') {
    const r = Math.min(10, w * 0.2);
    const lh = h * fill;
    const ly = y + h - lh;
    const body = `M${x} ${y}v${h - r}a${r} ${r} 0 0 0 ${r} ${r}h${w - 2 * r}a${r} ${r} 0 0 0 ${r} -${r}V${y}`;
    const cid = `clipB${Math.round(x)}${Math.round(y)}`;

    const contents = lh > 4 ? `
            <clipPath id="${cid}">
                <path d="${body}"/>
            </clipPath>
            <g clip-path="url(#${cid})">
                <rect x="${x}" y="${ly}" width="${w}" height="${lh + 2}" fill="url(#${liquid})"/>
                <!-- wall darkening, so the liquid has a body -->
                <rect x="${x}" y="${ly}" width="4" height="${lh + 2}" fill="#000" opacity=".2"/>
                <rect x="${x + w - 4}" y="${ly}" width="4" height="${lh + 2}" fill="#000" opacity=".22"/>
                <!-- bright caustic where light passes through the base -->
                <ellipse cx="${x + w * 0.42}" cy="${y + h - 4}" rx="${w * 0.28}" ry="3"
                         fill="#fff" opacity=".22" filter="url(#fSoft)"/>
            </g>
            <!-- meniscus -->
            <ellipse cx="${x + w / 2}" cy="${ly}" rx="${w / 2 - 1}" ry="2.9"
                     fill="url(#${liquid})"/>
            <ellipse cx="${x + w / 2}" cy="${ly - 0.6}" rx="${w / 2 - 3}" ry="1.9"
                     fill="#fff" opacity=".3"/>
        ` : '';

    return `
    <g>
        <path d="${body}" fill="url(#mGlass)"/>
        ${contents}
        <!-- rim -->
        <ellipse cx="${x + w / 2}" cy="${y}" rx="${w / 2}" ry="3.4"
                 fill="none" stroke="url(#mGlassRim)" stroke-width="1.7"/>
        <!-- spout -->
        <path d="M${x + w - 4} ${y - 1.5}q6 1.5 7 6" fill="none"
              stroke="#cfe6f7" stroke-opacity=".8" stroke-width="1.5"/>
        <!-- outline, brighter at the edges than across the face -->
        <path d="${body}" fill="none" stroke="url(#mGlassRim)" stroke-width="1.5"/>
        <!-- specular -->
        <path d="M${x + 4.5} ${y + 7}v${h - 20}" stroke="#fff" stroke-opacity=".55"
              stroke-width="2.6" stroke-linecap="round" filter="url(#fSoft)"/>
        <path d="M${x + w - 6} ${y + 12}v${h - 30}" stroke="#fff" stroke-opacity=".28"
              stroke-width="1.6" stroke-linecap="round"/>
        <!-- graduations -->
        <g stroke="#e8f4ff" stroke-opacity=".45" stroke-width="1">
            <path d="M${x + w - 13} ${y + h * 0.3}h7M${x + w - 10} ${y + h * 0.45}h4M${x + w - 13} ${y + h * 0.6}h7M${x + w - 10} ${y + h * 0.75}h4"/>
        </g>
    </g>`;
}

// A reagent bottle: shoulders, neck, ribbed cap, paper label.
function bottle(x, y, w, h, { liquid = 'mAcid', fill = 0.62, cap = '#2b3546', labelText = '' } = {}) {
    const neckW = w * 0.34;
    const nx = x + (w - neckW) / 2;
    const shoulder = y + h * 0.26;
    const body = `M${nx} ${y + 12}
                  L${nx} ${shoulder - 8}
                  Q${x} ${shoulder} ${x} ${shoulder + 10}
                  L${x} ${y + h - 8}
                  q0 8 8 8 h${w - 16} q8 0 8 -8
                  L${x + w} ${shoulder + 10}
                  Q${x + w} ${shoulder} ${nx + neckW} ${shoulder - 8}
                  L${nx + neckW} ${y + 12} Z`;
    const lh = (y + h - 8) - (shoulder + 10);
    const ly = y + h - 8 - lh * fill;
    const cid = `clipT${Math.round(x)}${Math.round(y)}`;

    return `
    <g>
        <path d="${body}" fill="url(#mGlass)"/>
        <clipPath id="${cid}"><path d="${body}"/></clipPath>
        <g clip-path="url(#${cid})">
            <rect x="${x}" y="${ly}" width="${w}" height="${h}" fill="url(#${liquid})"/>
            <rect x="${x}" y="${ly}" width="4.5" height="${h}" fill="#000" opacity=".2"/>
            <rect x="${x + w - 4.5}" y="${ly}" width="4.5" height="${h}" fill="#000" opacity=".22"/>
            <ellipse cx="${x + w / 2}" cy="${ly}" rx="${w / 2}" ry="2.6" fill="#fff" opacity=".22"/>
        </g>
        <path d="${body}" fill="none" stroke="url(#mGlassRim)" stroke-width="1.5"/>
        <!-- cap -->
        <rect x="${nx - 3}" y="${y}" width="${neckW + 6}" height="13" rx="2.5"
              fill="${cap}" stroke="#0d1420" stroke-width="1"/>
        <g stroke="#000" stroke-opacity=".35" stroke-width="1">
            ${[0, 1, 2, 3].map(i => `<path d="M${nx - 1 + i * (neckW + 2) / 4} ${y + 2}v9"/>`).join('')}
        </g>
        <rect x="${nx - 3}" y="${y + 1.5}" width="${neckW + 6}" height="3" rx="1.5"
              fill="#fff" opacity=".22"/>
        <!-- specular -->
        <path d="M${x + 5} ${shoulder + 14}v${lh * 0.72}" stroke="#fff" stroke-opacity=".5"
              stroke-width="2.4" stroke-linecap="round" filter="url(#fSoft)"/>
        ${labelText ? `
            <rect x="${x + 4}" y="${shoulder + 16}" width="${w - 8}" height="26" rx="2"
                  fill="#f3eee1" opacity=".93" stroke="#b9ae94" stroke-width="0.8"/>
            <path d="M${x + 8} ${shoulder + 22}h${w - 16}" stroke="#7a8394" stroke-width="1.4"/>
            ${label(x + w / 2, shoulder + 33, labelText, '#2c3a4e', 7.4)}
            <path d="M${x + 8} ${shoulder + 37}h${w - 22}" stroke="#98a2b3" stroke-width="0.9"/>
        ` : ''}
    </g>`;
}

// Erlenmeyer flask
function flask(x, y, w, h, { liquid = 'mWater', fill = 0.4 } = {}) {
    const neck = w * 0.3;
    const nx = x + (w - neck) / 2;
    const body = `M${nx} ${y}v${h * 0.3}L${x} ${y + h - 6}q0 6 6 6h${w - 12}q6 0 6 -6L${nx + neck} ${y + h * 0.3}V${y}Z`;
    const cid = `clipF${Math.round(x)}${Math.round(y)}`;
    return `
    <g>
        <path d="${body}" fill="url(#mGlass)"/>
        <clipPath id="${cid}"><path d="${body}"/></clipPath>
        <g clip-path="url(#${cid})">
            <rect x="${x}" y="${y + h - h * fill}" width="${w}" height="${h}" fill="url(#${liquid})"/>
            <ellipse cx="${x + w / 2}" cy="${y + h - h * fill}" rx="${w / 2}" ry="2.4"
                     fill="#fff" opacity=".24"/>
        </g>
        <path d="${body}" fill="none" stroke="url(#mGlassRim)" stroke-width="1.5"/>
        <ellipse cx="${nx + neck / 2}" cy="${y}" rx="${neck / 2 + 1.5}" ry="2.4"
                 fill="none" stroke="url(#mGlassRim)" stroke-width="1.5"/>
        <path d="M${nx + 1.6} ${y + 4}v${h * 0.26}" stroke="#fff" stroke-opacity=".45" stroke-width="1.8"/>
    </g>`;
}

// Layered flame with a bloom halo.
function flame(x, y, s = 1, blue = false) {
    const n = v => +(v * s).toFixed(1);
    const grad = blue ? 'mBlueFlame' : 'mFlame';
    return `
    <g class="art-flame">
        ${blue ? '' : `<ellipse cx="${x}" cy="${y - n(12)}" rx="${n(22)}" ry="${n(26)}"
                                fill="url(#mFlameGlow)"/>`}
        <path fill="url(#${grad})" d="
            M${x} ${y}
            c${n(-9)} ${n(-11)} ${n(-3)} ${n(-18)} ${n(1)} ${n(-25)}
            c${n(5)} ${n(8)} ${n(12)} ${n(9)} ${n(8)} ${n(19)}
            c${n(-1.6)} ${n(4)} ${n(-5.5)} ${n(6)} ${n(-9)} ${n(6)}z"/>
        <path fill="#fff" opacity="${blue ? '.5' : '.72'}" d="
            M${x} ${y}
            c${n(-4.4)} ${n(-5.5)} ${n(-1.4)} ${n(-9.5)} ${n(0.4)} ${n(-13)}
            c${n(2.4)} ${n(4)} ${n(6)} ${n(4.6)} ${n(4)} ${n(9.6)}
            c${n(-0.8)} ${n(2)} ${n(-2.8)} ${n(3.4)} ${n(-4.4)} ${n(3.4)}z"/>
    </g>`;
}

function svgWrap(inner, cls = '') {
    return `<svg class="scene-art ${cls}" viewBox="0 0 320 176"
                 preserveAspectRatio="xMidYMid meet" role="img" aria-hidden="true">
                ${MATERIALS}${keyLight()}${inner}
            </svg>`;
}

// ---- scenes ----------------------------------------------------------

// 1 — the four required items on a pegboard, each ticked
const ART_PPE = () => {
    const tick = (cx, cy) => `
        <circle cx="${cx}" cy="${cy}" r="7.5" fill="#0d2a15" stroke="#31c866" stroke-width="1.4"/>
        <path d="M${cx - 3.4} ${cy}l2.6 2.8 4.4-5.2" fill="none" stroke="#4de884"
              stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;

    const goggles = `
        <g>
            <path d="M22 62h44a8 8 0 0 1 8 8v9a11 11 0 0 1-11 11h-9l-6-6h-8l-6 6h-9A11 11 0 0 1 14 79v-9a8 8 0 0 1 8-8z"
                  fill="url(#mSteelV)" stroke="#25303c" stroke-width="1.2"/>
            <path d="M22 64h44a6 6 0 0 1 6 6v7a9 9 0 0 1-9 9h-8l-6-6h-8l-6 6h-8a9 9 0 0 1-9-9v-7a6 6 0 0 1 6-6z"
                  fill="#111a26" opacity=".55"/>
            <ellipse cx="32" cy="74" rx="8.5" ry="8" fill="#8fd6f5" opacity=".5"/>
            <ellipse cx="56" cy="74" rx="8.5" ry="8" fill="#8fd6f5" opacity=".5"/>
            <path d="M27 68a9 9 0 0 1 8-3" stroke="#fff" stroke-opacity=".75" stroke-width="1.6" fill="none"/>
            <path d="M51 68a9 9 0 0 1 8-3" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" fill="none"/>
            <path d="M14 68l-8-4M74 68l8-4" stroke="#59697a" stroke-width="2.4" stroke-linecap="round"/>
        </g>`;

    // A lab coat hanging by its collar. Silhouette matters most: broad
    // shoulders, a straight body and two long sleeves clearly separated from
    // it. Earlier attempts were an A-line body under a hanger triangle, which
    // read as a house.
    const coat = `
        <g>
            <!-- hook only; the hanger bar sits behind the shoulders -->
            <path d="M117 48a3.2 3.2 0 0 1 6.4 0q0 3.4-3.2 4" fill="none"
                  stroke="#8fa3b8" stroke-width="1.7"/>
            <path d="M107 62h26" stroke="#7b8ea1" stroke-width="1.6"/>

            <!-- sleeves hang outside the body, cuffs at the bottom -->
            <path d="M105 66l-9 4-7 26 11 3 8-24z" fill="#d3e0ec" stroke="#a3b5c8" stroke-width="1.2"/>
            <path d="M89 92l11 3" stroke="#94a8bc" stroke-width="2"/>
            <path d="M135 66l9 4 7 26-11 3-8-24z" fill="#f2f7fc" stroke="#a3b5c8" stroke-width="1.2"/>
            <path d="M151 92l-11 3" stroke="#94a8bc" stroke-width="2"/>

            <!-- body: broad at the shoulders, essentially straight to the hem -->
            <path d="M106 66q0-4 5-5l9-2 9 2q5 1 5 5v34h-28z"
                  fill="#e9f1f8" stroke="#a9bacb" stroke-width="1.2"/>
            <path d="M106 66q0-4 5-5l9-2v41h-14z" fill="#d3e0ec" opacity=".75"/>

            <!-- notched collar: two lapels meeting in a V -->
            <path d="M120 59l-11 4 9 14 2-6z" fill="#c2d2e0" stroke="#8ea2b6" stroke-width="1.1"/>
            <path d="M120 59l11 4-9 14-2-6z" fill="#e7f0f8" stroke="#8ea2b6" stroke-width="1.1"/>

            <!-- placket, buttons, pockets -->
            <path d="M120 77v23" stroke="#8ea2b6" stroke-width="1"/>
            <circle cx="120" cy="82" r="1.3" fill="#7e93a8"/>
            <circle cx="120" cy="89" r="1.3" fill="#7e93a8"/>
            <circle cx="120" cy="96" r="1.3" fill="#7e93a8"/>
            <path d="M124 70h8v6h-8z" fill="none" stroke="#a3b5c8" stroke-width="1"/>
            <path d="M108 86h9v9h-9zM123 86h9v9h-9z" fill="none" stroke="#a3b5c8" stroke-width="1"/>
        </g>`;

    // A PAIR of nitrile gloves. Four fingers of even length plus a clearly
    // separate thumb and a flared cuff: an earlier single-finger shape read
    // as an obscene gesture.
    const glove = (ox, oy, rot, body, edge, sheen) => `
        <g transform="translate(${ox} ${oy}) rotate(${rot})" fill="${body}"
           stroke="${edge}" stroke-width="1.2" stroke-linejoin="round">
            <rect x="0"    y="8"  width="5.4" height="20" rx="2.7"/>
            <rect x="6"    y="4"  width="5.4" height="24" rx="2.7"/>
            <rect x="12"   y="5"  width="5.4" height="23" rx="2.7"/>
            <rect x="18"   y="9"  width="5.4" height="19" rx="2.7"/>
            <path d="M0 20q-7 1-7 7t7 5z"/>
            <path d="M-1 22h25.4v10a5 5 0 0 1-5 5H4a5 5 0 0 1-5-5z"/>
            <path d="M-1 32h25.4v3a5 5 0 0 1-5 5H4a5 5 0 0 1-5-5z" fill="${edge}" opacity=".45" stroke="none"/>
            <path d="M2 24v11" stroke="${sheen}" stroke-opacity=".5"/>
        </g>`;

    const gloves = `
        <g>
            ${glove(186, 52, 9, '#2f63ad', '#1a3c6e', '#bcd8ff')}
            ${glove(172, 56, -7, '#4489e0', '#20477f', '#dbeaff')}
        </g>`;

    // Side profile, toe to the left. The cue that makes a shoe read as a shoe
    // is the throat — the dark opening between tongue and collar. Both earlier
    // versions had an unbroken top edge and so read as a rounded lump; the
    // panels are also separated in tone now (toe cap light, heel counter dark)
    // rather than one flat blue silhouette.
    const shoe = `
        <g>
            <!-- Upper. At this size the silhouette carries it: roughly 2:1 long
                 to tall, dropping to a low toe at the front and rising to the
                 collar at the back. A previous pass was near 1.5:1 with a thick
                 slab of sole, which read as a car. -->
            <!-- The throat is cut into the OUTLINE rather than painted on top:
                 a dip between instep and collar shows the opening in the
                 silhouette itself, which survives being 65px wide. Drawn as a
                 dark patch with a separate tongue, it read as a bite and a fin. -->
            <path d="M230 92C230 82 236 77 248 75C257 73 263 71 267 69
                     C270 67.5 272 69.5 275 70C279 70.5 281 67 283 64
                     C285 61.5 289 62 290 66C292 70 292 74 292 78L292 92Z"
                  fill="#46566c" stroke="#131b26" stroke-width="1.3" stroke-linejoin="round"/>
            <!-- heel counter -->
            <path d="M285 92V62c3 1 6 5 7 12v18z" fill="#2b3746"/>
            <!-- reinforced toe cap, with the seam that makes it read as one -->
            <path d="M230 92C230 82 236 77 248 75c2 6 3 11 3 17z"
                  fill="#7d90a8" stroke="#131b26" stroke-width="1.1"/>
            <!-- collar padding: a thin band hugging the top edge. Drawn as a
                 standalone shape it stuck up as a fin. -->
            <path d="M283 64C285 61.5 289 62 290 66c-2-1.5-5-1.5-7 1z" fill="#77899f"/>
            <path d="M270 70c3-1 5 1 8 1" fill="none" stroke="#131b26"
                  stroke-width="1.4" stroke-linecap="round"/>
            <!-- laces across the instep -->
            <g stroke="#e9f1f9" stroke-width="1.5" stroke-linecap="round">
                <path d="M254 84l9-3M255 80l9-3M257 76l8-3"/>
            </g>
            <!-- thin midsole and treaded outsole, kept mid-tone so the sole
                 does not out-weigh the shoe it belongs to -->
            <path d="M228 92h64q3 0 3 2.6H225q0-2.6 3-2.6z" fill="#c3d0dd" stroke="#7e8fa0" stroke-width="0.9"/>
            <path d="M225 94.6h70v2q0 2.4-3 2.4h-64q-3 0-3-2.4z"
                  fill="#8496a8" stroke="#65758a" stroke-width="0.9"/>
            <g stroke="#65758a" stroke-width="1">
                ${[232, 240, 248, 256, 264, 272, 280, 288].map(x => `<path d="M${x} 95.4v3"/>`).join('')}
            </g>
        </g>`;

    const subject = goggles + coat + gloves + shoe;

    return svgWrap(`
        <!-- pegboard -->
        <rect x="8" y="26" width="304" height="82" rx="4" fill="#0d1522" stroke="#25334a" stroke-width="1.2"/>
        <g fill="#1b2740">
            ${Array.from({ length: 9 }, (_, r) =>
                Array.from({ length: 32 }, (_, c) =>
                    `<circle cx="${16 + c * 9.4}" cy="${33 + r * 9}" r="1.1"/>`).join('')).join('')}
        </g>
        ${label(160, 20, T('art.ppe.title'), '#6fd3e8', 9)}
        ${benchTop(118)}
        ${reflection(subject, 118)}
        ${contactShadow(44, 118, 32, 4)}
        ${contactShadow(114, 118, 26, 4)}
        ${contactShadow(187, 118, 20, 4)}
        ${contactShadow(261, 118, 24, 4)}
        ${subject}
        <g class="a-item" style="--i:0">${tick(44, 132)}${label(44, 152, T('art.ppe.goggles'), '#9fb6cf', 8)}</g>
        <g class="a-item" style="--i:1">${tick(114, 132)}${label(114, 152, T('art.ppe.coat'), '#9fb6cf', 8)}</g>
        <g class="a-item" style="--i:2">${tick(187, 132)}${label(187, 152, T('art.ppe.gloves'), '#9fb6cf', 8)}</g>
        <g class="a-item" style="--i:3">${tick(261, 132)}${label(261, 152, T('art.ppe.shoes'), '#9fb6cf', 8)}</g>
    `, 'art-ppe');
};

// 2 — an unmarked bottle beside the pictogram to be read
const ART_HAZARD = () => {
    const subject = bottle(84, 40, 62, 100, { liquid: 'mAcid', fill: 0.6, cap: '#8d1c1c' });

    // One arm of the trefoil, drawn pointing up around the origin, then rotated
    // by 120 and 240. Three pieces, matching the standard construction:
    //   ring     — an annulus (R 6.8-12.4) centred 17.2 out, broken by a
    //              60-degree wedge on the side facing the centre
    //   stalk    — passes from the central hub out through that break
    //   crescent — a band (R 3.2-5.6, 170 degrees) nested in the ring's hole,
    //              concave side outward, floating free with 1.2 of clear white
    //              between it and the ring. It is nearly as wide as the hole
    //              and its ends reach the ring's horizontal diameter; drawn
    //              short and small it read as an arrowhead on a spoke.
    // Proportions decide whether this reads. Normalised to the ring's outer
    // radius, off the official icon: centre distance 1.39, band 0.45, hub 0.27.
    // The band thickness is what earlier passes kept getting wrong — at 0.33 the
    // rings read as thin wire hoops and the whole symbol went sparse and
    // wheel-like, where the real one is dense and heavy. Plain closed rings
    // around a dot are not this symbol either: the break, the stalk and the
    // free crescent are what separate it from the radiation trefoil, which is
    // this question's distractor.
    const arm = `
        <path d="M-6.2 -6.46A12.4 12.4 0 1 1 6.2 -6.46L3.4 -11.31A6.8 6.8 0 1 0 -3.4 -11.31Z"/>
        <rect x="-1.4" y="-12" width="2.8" height="9.4"/>
        <path d="M-5.58 -16.71A5.6 5.6 0 0 0 5.58 -16.71L3.19 -16.92A3.2 3.2 0 0 1 -3.19 -16.92Z"/>`;

    return svgWrap(`
        ${benchTop()}
        ${reflection(subject)}
        ${contactShadow(115, 146, 30, 5)}
        ${subject}
        ${label(115, 161, T('art.hazard.container'), '#9fb6cf')}

        <!-- Biohazard sign: black trefoil on safety amber -->
        <g class="a-pulse">
            <path d="M232 34l44 44-44 44-44-44z" fill="url(#mYellow)" stroke="#14100a" stroke-width="2.6"/>
            <path d="M232 41.5l36.5 36.5-36.5 36.5-36.5-36.5z" fill="none"
                  stroke="#14100a" stroke-opacity=".4" stroke-width="1.1"/>
            <g transform="translate(232 78) scale(.97)" fill="#14100a">
                <circle r="3.4"/>
                ${arm}
                <g transform="rotate(120)">${arm}</g>
                <g transform="rotate(240)">${arm}</g>
            </g>
        </g>
        ${plate(240, 146, T('art.hazard.plate'))}
        ${leader(188, 78, 152, 84)}
    `, 'art-hazard');
};

// 3 — a sleeve alight, the safety shower within reach
const ART_FIRE = () => {
    // A forearm in a lab-coat sleeve, angled across the bench, cuff alight.
    // Drawn as an arm rather than a symmetrical shape — the previous version
    // read as a bell.
    const sleeve = `
        <g transform="rotate(-24 70 112)">
            <!-- upper arm into frame -->
            <path d="M8 96h54a10 10 0 0 1 10 10v10a10 10 0 0 1-10 10H8z"
                  fill="#e9f1f8" stroke="#a9bacb" stroke-width="1.3"/>
            <path d="M8 96h54a10 10 0 0 1 10 10H8z" fill="#fbfdff" opacity=".7"/>
            <path d="M8 120h64a10 10 0 0 1-10 6H8z" fill="#c2d2e0" opacity=".8"/>
            <!-- cuff -->
            <path d="M66 94h8v34h-8z" fill="#d8e5ef" stroke="#96a9bc" stroke-width="1.2"/>
            <path d="M69 96v30" stroke="#96a9bc" stroke-width="1"/>
            <!-- wrist and hand -->
            <path d="M74 100h10a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H74z"
                  fill="#e8bb92" stroke="#b3855c" stroke-width="1.2"/>
            <path d="M88 104q11 0 13 7t-13 8z" fill="#e8bb92" stroke="#b3855c" stroke-width="1.2"/>
            <g stroke="#b3855c" stroke-width="0.9" fill="none">
                <path d="M92 108q6 1 7 3M92 114q6-1 7-3"/>
            </g>
        </g>`;

    // A plumbed safety shower drawn to the usual pattern: floor-mounted riser,
    // stay-open ball valve, a 250 mm dished head and the triangular pull handle
    // hanging within reach. Everything is in the same straight-on elevation as
    // the bench — the previous version put the floor drain in plan view, which
    // is the same mixed-projection error that broke the conduct scene.
    //
    // Pipes are rects, not stroked lines: a vertical <path> has a zero-width
    // geometry box, so an objectBoundingBox gradient on it has nothing to grade
    // across and the pipe rendered as nothing at all.
    const shower = (() => {
        // holes across the visible front of the head's underside
        const holeRing = (rx, ry, n) => Array.from({ length: n }, (_, i) => {
            const a = Math.PI * (i + 0.5) / n;
            return `<circle cx="${(252 + rx * Math.cos(a)).toFixed(1)}"
                            cy="${(55.4 + ry * Math.sin(a)).toFixed(1)}" r="1.1"/>`;
        }).join('');

        return `
        <g>
            <!-- riser, elbow and supply arm -->
            <rect x="292.2" y="34" width="7.6" height="112" fill="url(#mSteel)"/>
            <rect x="256" y="30.2" width="40" height="7.6" fill="url(#mSteelV)"/>
            <rect x="292.2" y="30.2" width="7.6" height="8" fill="url(#mSteelV)"/>
            <rect x="286" y="140" width="20" height="6" rx="1.4" fill="url(#mSteelV)"
                  stroke="#26313c" stroke-width="1"/>
            <!-- stay-open ball valve -->
            <rect x="270" y="26" width="17" height="16" rx="2.4" fill="url(#mSteelV)"
                  stroke="#26313c" stroke-width="1.2"/>
            <rect x="274" y="21" width="9" height="6" rx="1.6" fill="url(#mSteelV)"
                  stroke="#26313c" stroke-width="1"/>
            <path d="M272 28h13" stroke="#e2edf5" stroke-opacity=".5" stroke-width="1.2"/>

            <!-- dished head: crown, rolled rim, perforated face -->
            <rect x="248" y="40" width="8" height="8" fill="url(#mSteel)"/>
            <path d="M223 55q0-16 29-16t29 16z" fill="url(#mSteelV)" stroke="#26313c" stroke-width="1.3"/>
            <path d="M231 46q9-4 21-3" fill="none" stroke="#eef6fb" stroke-opacity=".55" stroke-width="1.8"/>
            <ellipse cx="252" cy="55" rx="30" ry="5.4" fill="url(#mSteelV)"
                     stroke="#26313c" stroke-width="1.3"/>
            <path d="M222 55a30 5.4 0 0 0 60 0" fill="#141d27"/>
            <g fill="#5d7383">${holeRing(25, 3.4, 13)}${holeRing(15.5, 2, 8)}</g>

            <!-- pull rod and the triangular handle -->
            <rect x="277.6" y="42" width="2.8" height="59" fill="url(#mSteel)"/>
            <path d="M267 101h22l-11 17z" fill="none" stroke="#aebdc9" stroke-width="3.2"
                  stroke-linejoin="round"/>
            <path d="M268.5 102.4h19l-9.5 14.6z" fill="#dce8f1" opacity=".12"/>
        </g>`;
    })();

    // Water leaving a 250 mm head falls as a widening curtain, not as parallel
    // rods. The cone carries the volume; the streaks diverge with it.
    const spray = (() => {
        const streak = (dx, len, w, o) => {
            const s = 1 + 0.538 * len / 82;
            return `<path d="M${(252 + dx).toFixed(1)} 58L${(252 + dx * s).toFixed(1)} ${58 + len}"
                          stroke="#cfeeff" stroke-opacity="${o}" stroke-width="${w}"
                          stroke-linecap="round"/>`;
        };
        const drop = (dx, y, r, o) =>
            `<ellipse cx="${(252 + dx).toFixed(1)}" cy="${y}" rx="${r}" ry="${r * 1.7}"
                      fill="#dff4ff" opacity="${o}"/>`;

        return `
        <g class="a-spray">
            <path d="M226 58h52l14 84h-80z" fill="url(#mSpray)"/>
            ${streak(-24, 74, 1.2, .3)}${streak(-18, 86, 1.7, .5)}${streak(-11, 80, 1.3, .38)}
            ${streak(-4, 88, 2, .6)}${streak(4, 84, 1.9, .55)}${streak(11, 88, 1.4, .4)}
            ${streak(18, 78, 1.7, .48)}${streak(24, 70, 1.2, .28)}
            ${drop(-21, 118, 1.3, .5)}${drop(-8, 128, 1.5, .6)}${drop(7, 112, 1.2, .45)}
            ${drop(20, 124, 1.4, .5)}${drop(-14, 100, 1.1, .4)}${drop(14, 96, 1, .35)}
            <!-- water breaking on the floor -->
            <g fill="none" stroke="#cfeeff" stroke-linecap="round">
                <path d="M222 144q6-7 12-2" stroke-width="1.3" stroke-opacity=".45"/>
                <path d="M240 145q7-8 13-2" stroke-width="1.5" stroke-opacity=".55"/>
                <path d="M260 145q7-8 13-2" stroke-width="1.5" stroke-opacity=".5"/>
                <path d="M278 144q6-7 11-2" stroke-width="1.3" stroke-opacity=".4"/>
            </g>
            <ellipse cx="252" cy="145" rx="44" ry="3.4" fill="#cfeeff" opacity=".16"/>
        </g>`;
    })();

    return svgWrap(`
        ${benchTop()}
        ${reflection(sleeve + shower)}
        ${contactShadow(62, 146, 44, 5)}
        ${sleeve}
        ${flame(84, 114, 1.45)}
        ${flame(99, 122, 1)}
        ${flame(74, 104, 0.65)}
        ${contactShadow(294, 146, 16, 4)}
        ${shower}
        ${spray}
        ${plate(62, 163, T('art.fire.sleeve'), { color: '#ff8b4a', border: '#c85a1a' })}
        <!-- Equipment identification, deliberately not in the green used for a
             correct answer elsewhere: "SAFETY SHOWER" is also the wording of the
             correct option, and colour-coding it would mark the answer. The
             situation text already tells the student the shower is there. -->
        ${plate(252, 163, T('art.fire.shower'), { color: '#a8c0d6', border: '#5d7997' })}
        ${dimension(122, 206, 132, '3 m')}
    `, 'art-fire');
};

// 4 — a corrosive spill spreading across the bench from an unmarked source.
// Shows only the hazard: the scenario asks the student what to do first, so
// the scene must not depict the answer. An earlier version put a road cone on
// the bench (nonsense in a lab) beside an intercom captioned "REPORT IT",
// which handed over the correct option.
const ART_SPILL = () => {
    // The beaker on its side IS the source — rotated just past 90 degrees so it
    // still reads as a beaker pouring out. A steeper angle turned it into an
    // unreadable box, and a second labelled bottle only added clutter.
    const tipped = `
        <g transform="rotate(-74 82 118)">
            ${beaker(64, 96, 38, 46, 0.12, 'mAcid')}
        </g>`;

    // rack of tubes directly in the path of the spread
    const rack = `
        <g>
            <rect x="230" y="122" width="60" height="9" rx="2.5" fill="#3d4d66" stroke="#141c28" stroke-width="1.2"/>
            <rect x="230" y="98" width="60" height="6" rx="2.5" fill="#4a5c78" stroke="#141c28" stroke-width="1.2"/>
            <rect x="232" y="104" width="4" height="18" fill="#3d4d66" stroke="#141c28" stroke-width="1"/>
            <rect x="284" y="104" width="4" height="18" fill="#3d4d66" stroke="#141c28" stroke-width="1"/>
            ${[240, 253, 266, 277].map((x, i) => `
                <g>
                    <path d="M${x} 92v26a5 5 0 0 0 10 0V92" fill="url(#mGlass)"
                          stroke="url(#mGlassRim)" stroke-width="1.3"/>
                    <path d="M${x + 1} 108v10a4 4 0 0 0 8 0v-10z"
                          fill="url(#${i % 2 ? 'mWater' : 'mAcid'})"/>
                    <path d="M${x + 2.5} 96v14" stroke="#fff" stroke-opacity=".45" stroke-width="1.6"/>
                </g>`).join('')}
        </g>`;

    // corrosive vapour coming off the pool
    const fumes = `
        <g class="a-fume">
            <ellipse cx="104" cy="98"  rx="28" ry="32" fill="url(#mFume)"/>
            <ellipse cx="150" cy="106" rx="22" ry="26" fill="url(#mFume)"/>
            <ellipse cx="66"  cy="108" rx="19" ry="23" fill="url(#mFume)"/>
        </g>`;

    // An irregular puddle built from overlapping ellipses — a single flat path
    // read as a yellow sliver rather than something spreading. Lobes reach
    // toward the tube rack and over the front edge of the bench.
    const pool = `
        <g>
            <g fill="#c07f0d" opacity=".72">
                <ellipse cx="104" cy="134" rx="52" ry="11"/>
                <ellipse cx="68"  cy="137" rx="30" ry="8.5"/>
                <ellipse cx="146" cy="136" rx="32" ry="8"/>
                <ellipse cx="184" cy="139" rx="20" ry="5"/>
                <ellipse cx="212" cy="141" rx="12" ry="3.4"/>
            </g>
            <!-- bright leading edge where the liquid is still advancing -->
            <g fill="none" stroke="#f7c63a" stroke-width="1.6" stroke-opacity=".8">
                <path d="M56 129q26-8 52-5t60 6q22 2 38 5"/>
            </g>
            <!-- wet sheen -->
            <ellipse cx="92"  cy="129" rx="30" ry="4.4" fill="#ffe49b" opacity=".38" filter="url(#fSoft)"/>
            <ellipse cx="148" cy="132" rx="16" ry="2.8" fill="#ffe49b" opacity=".26"/>
            <ellipse cx="70"  cy="134" rx="10" ry="2" fill="#fff" opacity=".3"/>
            <!-- bench surface etched where the acid has stood longest -->
            <g fill="#4a3004" opacity=".5">
                <ellipse cx="98"  cy="139" rx="13" ry="3"/>
                <ellipse cx="124" cy="140" rx="8"  ry="2.2"/>
            </g>
            <!-- running over the front edge -->
            <g fill="#d99612">
                <path d="M92 145q4.6 0 4.6 5.5t-4.6 8-4.6-8 4.6-5.5z" class="a-drip" style="--i:0"/>
                <path d="M130 145q4 0 4 4.6t-4 7-4-7 4-4.6z" class="a-drip" style="--i:1"/>
            </g>
        </g>`;

    return svgWrap(`
        ${benchTop()}
        ${pool}
        ${contactShadow(84, 132, 28, 4)}
        ${contactShadow(258, 131, 32, 4)}
        ${rack}
        ${tipped}
        ${fumes}
        ${plate(110, 163, T('art.spill.plate'), { color: '#ffb454', border: '#c07b12' })}
    `, 'art-spill');
};

// 5 — order of addition: both vessels standing on the bench, and the transfer
// left as an open question.
//
// Every earlier version drew the acid being poured into the water — which is
// the correct option. A student who could read the picture never needed the
// chemistry. The scene now poses the question instead of answering it: two
// vessels, a double-headed arc between them, and a question mark. Nothing in it
// favours either direction, or the two distractors (mixing fast, pouring both
// at once). The thermometer stays: heat is what the choice is about.
const ART_DILUTION = () => {
    const acid = beaker(74, 86, 50, 54, 0.6, 'mAcid');
    const water = beaker(176, 66, 80, 74, 0.66, 'mWater');
    const thermo = `
        <g>
            <rect x="272" y="36" width="9" height="64" rx="4.5" fill="url(#mGlass)"
                  stroke="url(#mGlassRim)" stroke-width="1.3"/>
            <rect x="275" y="60" width="3" height="40" fill="#d63a2a"/>
            <circle cx="276.5" cy="104" r="7.5" fill="#d63a2a" stroke="#8d1c1c" stroke-width="1"/>
            <circle cx="274" cy="101" r="2" fill="#fff" opacity=".5"/>
            <g stroke="#cfe3f2" stroke-opacity=".7" stroke-width="1">
                <path d="M283 48h6M283 60h4M283 72h6M283 84h4"/>
            </g>
        </g>`;
    // Arrowhead pointing along +x before rotation, so the tip lands on (x, y).
    const head = (x, y, deg) =>
        `<path d="M0 0L-10 -5L-10 5Z" transform="translate(${x} ${y}) rotate(${deg})" fill="#6fd3e8"/>`;

    return svgWrap(`
        ${label(160, 18, T('art.dilution.title'), '#6fd3e8', 9)}
        ${benchTop()}
        ${reflection(acid + water + thermo)}
        ${contactShadow(99, 146, 30, 5)}
        ${contactShadow(216, 146, 42, 5)}
        ${acid}
        ${water}
        ${thermo}
        <!-- One arc with a head at each end, each aimed into a vessel's mouth.
             Two separate arrows would read as a sequence — first this, then
             that — which is itself an answer. A single double-headed arc reads
             as a choice. Control point solved so the curve leaves each head
             along the direction that head points. -->
        <g class="a-pulse">
            <path d="M117 70Q155.3 35.5 191 50" fill="none" stroke="#6fd3e8"
                  stroke-opacity=".85" stroke-width="2.6" stroke-linecap="round"/>
            ${head(110, 76, 138)}
            ${head(200, 54, 22)}
        </g>
        <text x="155" y="106" text-anchor="middle" fill="#f0b13a" opacity=".92"
              font-family="Orbitron, monospace" font-size="30" font-weight="700">?</text>
        ${label(99, 163, T('art.dilution.acid'), '#f0b13a')}
        ${label(216, 163, T('art.dilution.water'), '#7fc4f0')}
    `, 'art-dilution');
};

// 6 — your own station, and where each item goes
const ART_CLEANUP = () => {
    const glass = beaker(34, 92, 32, 40, 0.26, 'mAcid') +
                  flask(76, 88, 34, 44, { liquid: 'mWater', fill: 0.45 }) +
                  beaker(118, 104, 24, 28, 0.4, 'mWater');
    const bin = (x, name, hue) => `
        <g style="--i:${name.length % 3}">
            <path d="M${x} 88h34l-4 52h-26z" fill="${hue}" stroke="#0f1723" stroke-width="1.3"/>
            <path d="M${x + 2} 88h10l-3 52h-6z" fill="#fff" opacity=".14"/>
            <rect x="${x - 3}" y="82" width="40" height="7" rx="3" fill="url(#mSteelV)" stroke="#26313c" stroke-width="1"/>
            <rect x="${x + 13}" y="76" width="8" height="6" rx="2" fill="#8fa3b8"/>
            <rect x="${x - 2}" y="99" width="38" height="15" rx="2" fill="#f8f5ec"
                  stroke="#8d9382" stroke-width="0.8"/>
            ${label(x + 17, 110, name, '#131c26', 6.6, 'middle', 0.3)}
        </g>`;
    return svgWrap(`
        ${benchTop()}
        ${reflection(glass)}
        ${contactShadow(50, 146, 22, 4)}
        ${contactShadow(93, 146, 22, 4)}
        ${contactShadow(130, 146, 16, 4)}
        ${glass}
        ${label(88, 163, T('art.cleanup.station'), '#9fb6cf')}
        ${bin(176, T('art.cleanup.glass'), '#2f6d4a')}
        ${bin(222, T('art.cleanup.aqueous'), '#2b5686')}
        ${bin(268, T('art.cleanup.sharps'), '#8d3a1c')}
        ${label(245, 163, T('art.cleanup.routes'), '#9fb6cf')}
    `, 'art-cleanup');
};

// 7 — approved yellow flammables cabinet, kept away from the burner
const ART_STORAGE = () => {
    const cabinet = `
        <g>
            <rect x="26" y="36" width="108" height="104" rx="4" fill="url(#mYellow)"
                  stroke="#6d5108" stroke-width="1.6"/>
            <rect x="30" y="40" width="100" height="96" rx="3" fill="none"
                  stroke="#fff" stroke-opacity=".25" stroke-width="1"/>
            <path d="M80 36v104" stroke="#6d5108" stroke-width="1.6"/>
            <!-- louvre vents -->
            <g stroke="#6d5108" stroke-width="2" stroke-linecap="round">
                <path d="M38 50h30M38 58h30M92 50h30M92 58h30"/>
            </g>
            <g stroke="#fff" stroke-opacity=".3" stroke-width="1">
                <path d="M38 52h30M38 60h30M92 52h30M92 60h30"/>
            </g>
            <!-- handles -->
            <rect x="68" y="84" width="4" height="16" rx="2" fill="#2d2408"/>
            <rect x="88" y="84" width="4" height="16" rx="2" fill="#2d2408"/>
            <!-- flammable diamond label -->
            <g>
                <path d="M52 100l16 16-16 16-16-16z" fill="#fff" stroke="#c62828" stroke-width="2.6"/>
                ${flame(52, 124, 0.44)}
            </g>
            <rect x="90" y="104" width="34" height="20" rx="2" fill="#f3eee1" opacity=".92"/>
            ${label(107, 117, T('art.storage.flam'), '#2c3a4e', 7)}
        </g>`;
    const burner = `
        <g>
            <ellipse cx="258" cy="140" rx="24" ry="6" fill="#0b111c" stroke="#4b5b6d" stroke-width="1.2"/>
            <path d="M240 138h36l-4-8h-28z" fill="url(#mSteelV)" stroke="#26313c" stroke-width="1.2"/>
            <rect x="252" y="98" width="12" height="34" rx="2" fill="url(#mSteel)" stroke="#26313c" stroke-width="1.1"/>
            <path d="M248 96h20v5h-20z" fill="#8fa3b8" stroke="#26313c" stroke-width="1"/>
            <!-- rect, not a stroked line: a straight <path> has a zero-height
                 geometry box and an objectBoundingBox gradient on it renders
                 nothing, so this spout was invisible -->
            <rect x="266" y="114" width="10" height="4" fill="url(#mSteelV)"/>
        </g>`;
    return svgWrap(`
        ${benchTop()}
        ${reflection(cabinet + burner)}
        ${contactShadow(80, 142, 56, 5)}
        ${cabinet}
        ${burner}
        ${flame(258, 96, 1, true)}
        ${plate(92, 163, T('art.storage.cabinet'), { color: '#f2c62f', border: '#a87c08', size: 7.8 })}
        ${plate(258, 163, T('art.storage.ignition'), { color: '#ff8b4a', border: '#c85a1a' })}
        <path class="a-pulse" d="M206 56a56 56 0 0 1 0 84" fill="none" stroke="#ff8b4a"
              stroke-width="1.6" stroke-dasharray="5 5" opacity=".8"/>
        ${dimension(140, 206, 28, T('art.storage.apart'))}
    `, 'art-storage');
};

// 8 — a controlled door: sign, lock, supervisor authorisation
const ART_ACCESS = () => {
    const door = `
        <g>
            <rect x="58" y="18" width="120" height="128" rx="3" fill="url(#mPaint)"
                  stroke="#0d1420" stroke-width="1.6"/>
            <rect x="66" y="26" width="104" height="112" rx="2" fill="none"
                  stroke="#7d94b3" stroke-opacity=".4" stroke-width="1.2"/>
            <!-- vision panel -->
            <rect x="82" y="34" width="72" height="34" rx="2" fill="#0a1a26"
                  stroke="#5d7997" stroke-width="1.2"/>
            <path d="M82 68l72-34" stroke="#9fd8ff" stroke-opacity=".18" stroke-width="8"/>
            <!-- lever handle -->
            <rect x="160" y="80" width="14" height="5" rx="2.5" fill="url(#mSteel)"/>
            <circle cx="164" cy="82.5" r="5" fill="url(#mSteelV)" stroke="#26313c" stroke-width="1"/>
            <!-- hinges -->
            <rect x="56" y="40" width="5" height="12" rx="1.5" fill="#8fa3b8"/>
            <rect x="56" y="112" width="5" height="12" rx="1.5" fill="#8fa3b8"/>
            <path d="M50 146h136" stroke="#4b5b6d" stroke-width="1.4"/>
        </g>`;
    const reader = `
        <g>
            <rect x="250" y="64" width="40" height="56" rx="5" fill="url(#mPaint)" stroke="#0f1723" stroke-width="1.3"/>
            <rect x="255" y="70" width="30" height="20" rx="2" fill="#071722" stroke="#2b4a63" stroke-width="1"/>
            <circle cx="270" cy="100" r="7" fill="#0d2a15" stroke="#31c866" stroke-width="1.4"/>
            <path d="M266.6 100l2.6 2.8 4.4-5.2" fill="none" stroke="#4de884" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round"/>
            <g class="a-pulse" fill="#4de884">
                <circle cx="262" cy="80" r="2"/>
            </g>
            <path d="M276 78h6" stroke="#8fa3b8" stroke-width="1.4"/>
        </g>`;
    return svgWrap(`
        ${benchTop(150)}
        ${reflection(door + reader, 150)}
        ${door}
        <!-- warning sign -->
        <g>
            <rect x="82" y="82" width="72" height="26" rx="2" fill="#f2b01c" stroke="#6d5108" stroke-width="1.4"/>
            ${label(118, 99, T('art.access.authorised'), '#1a1206', 8.6)}
        </g>
        <!-- padlock -->
        <g class="a-pulse">
            <path d="M204 72V60a13 13 0 0 1 26 0v12" fill="none" stroke="url(#mSteel)" stroke-width="5"/>
            <rect x="196" y="72" width="42" height="34" rx="6" fill="#c9a227" stroke="#6d5410" stroke-width="1.4"/>
            <rect x="200" y="76" width="34" height="9" rx="4" fill="#fff" opacity=".22"/>
            <circle cx="217" cy="88" r="3.6" fill="#3b2f08"/>
            <path d="M217 91v7" stroke="#3b2f08" stroke-width="2.6" stroke-linecap="round"/>
        </g>
        ${reader}
        ${label(118, 163, 'LAB OMEGA-7', '#9fb6cf')}
        ${plate(270, 136, T('art.access.supervisor'), { color: '#5fe08a', border: '#2f8a4f' })}
        ${leader(250, 92, 240, 88)}
    `, 'art-access');
};

// 9 — a working bench: hot plates running, glassware heating, walkway marked.
// The scenario text says "a crowded lab with hot plates running", so the scene
// shows exactly that; an earlier plan-view of an empty aisle showed neither.
const ART_CONDUCT = () => {
    // hot plate with a beaker heating on it
    const station = (x, i) => `
        <g>
            <!-- heat haze and steam -->
            <g class="a-fume">
                <ellipse cx="${x + 28}" cy="${48 - i * 2}" rx="16" ry="18" fill="url(#mSteam)"/>
                <ellipse cx="${x + 36}" cy="${40}" rx="11" ry="13" fill="url(#mSteam)"/>
            </g>
            <!-- beaker on the plate -->
            ${beaker(x + 14, 54, 28, 30, 0.55, i % 2 ? 'mWater' : 'mAcid')}
            <!-- glow under the vessel -->
            <ellipse cx="${x + 28}" cy="84" rx="24" ry="6" fill="url(#mFlameGlow)" opacity=".75"/>
            <!-- hot plate body -->
            <rect x="${x}" y="84" width="56" height="18" rx="3"
                  fill="url(#mSteelV)" stroke="#232e3a" stroke-width="1.3"/>
            <rect x="${x + 2}" y="86" width="52" height="3" rx="1.5" fill="#fff" opacity=".2"/>
            <!-- element -->
            <ellipse cx="${x + 28}" cy="84" rx="20" ry="4.6" fill="#2a3340" stroke="#4d5b6b" stroke-width="1"/>
            <ellipse class="a-hot" cx="${x + 28}" cy="83.4" rx="15" ry="3.2" fill="url(#mHot)"/>
            <!-- dial and indicator -->
            <circle cx="${x + 9}" cy="94" r="4.4" fill="#1a222c" stroke="#6b7c8c" stroke-width="1.1"/>
            <path d="M${x + 9} 94l2.6-3" stroke="#cfe0f0" stroke-width="1.3"/>
            <circle class="a-hot" cx="${x + 47}" cy="94" r="2.4" fill="#ff5a3c"/>
            <!-- feet -->
            <rect x="${x + 4}" y="102" width="7" height="3" rx="1" fill="#2a3340"/>
            <rect x="${x + 45}" y="102" width="7" height="3" rx="1" fill="#2a3340"/>
        </g>`;

    // Everything below is one straight-on elevation: wall, bench, floor edge,
    // doorway. Nothing is drawn from above.
    return svgWrap(`
        <!-- wall -->
        <rect x="0" y="0" width="320" height="126" fill="#101827"/>
        <g stroke="#1a2438" stroke-width="1">
            <path d="M0 34h320M0 68h320"/>
            <path d="M108 0v126M216 0v126"/>
        </g>
        ${label(112, 16, T('art.conduct.hotwork'), '#ffb454', 9)}

        <!-- wall-mounted hot surface warning -->
        <g>
            <path d="M280 18l13 22h-26z" fill="#f2b01c" stroke="#5f4708" stroke-width="1.4"/>
            <path d="M280 26v7M280 36h.01" stroke="#1a1206" stroke-width="2" stroke-linecap="round"/>
            ${label(280, 50, T('art.conduct.hot'), '#f2b01c', 7)}
        </g>

        <!-- bench: top edge, front face, plinth -->
        <rect x="0" y="100" width="228" height="26" fill="url(#mBenchTop)"/>
        <path d="M0 100h228" stroke="#7fa8c9" stroke-opacity=".6" stroke-width="1.4"/>
        <path d="M0 101.6h228" stroke="#0a0f1a" stroke-opacity=".9" stroke-width="2"/>
        <g stroke="#1c2940" stroke-width="1.2">
            <path d="M76 104v22M152 104v22"/>
        </g>
        <path d="M0 126h228" stroke="#26354e" stroke-width="1.4"/>

        ${contactShadow(38, 100, 30, 4)}
        ${contactShadow(102, 100, 30, 4)}
        ${contactShadow(166, 100, 30, 4)}
        ${station(10, 0)}
        ${station(74, 1)}
        ${station(138, 2)}

        <!-- doorway with an illuminated exit sign; the floor in front of it is
             deliberately empty, which is the point of the scenario -->
        <g>
            <rect x="236" y="26" width="72" height="100" rx="2" fill="#1b2536" stroke="#0c1220" stroke-width="1.4"/>
            <rect x="242" y="32" width="60" height="94" rx="1.5" fill="url(#mPaint)" stroke="#7d94b3" stroke-opacity=".35" stroke-width="1.1"/>
            <rect x="250" y="42" width="44" height="30" rx="2" fill="#0a1a26" stroke="#5d7997" stroke-width="1.1"/>
            <path d="M250 72l44-30" stroke="#9fd8ff" stroke-opacity=".16" stroke-width="7"/>
            <rect x="246" y="82" width="12" height="4" rx="2" fill="url(#mSteel)"/>
            <!-- exit sign -->
            <rect x="252" y="10" width="42" height="14" rx="2" fill="#0f3d24" stroke="#31c866" stroke-width="1.3"/>
            ${label(273, 21, T('art.conduct.exit'), '#5fe08a', 8)}
        </g>

        <!-- floor: seen edge-on, with the light from the exit sign spilling on it -->
        <rect x="0" y="126" width="320" height="50" fill="#0a1120"/>
        <path d="M0 126h320" stroke="#2b3a52" stroke-width="1.6"/>
        <path d="M0 131h320" stroke="#141d2e" stroke-width="2.4"/>
        <ellipse cx="272" cy="142" rx="52" ry="14" fill="url(#mExitGlow)"/>
        <g stroke="#16223a" stroke-width="1">
            <path d="M0 148h320M0 162h320"/>
        </g>

        <!-- Bag on a wall hook rather than on the floor. Sited on the clear
             wall panel right of the last hot plate; a stool is deliberately not
             drawn — one pushed under the bench is hidden by the bench face in
             a straight-on view, so drawing it only produced a floating blob. -->
        <g>
            <!-- rect for the same zero-bbox reason as the burner spout -->
            <rect x="200" y="60.7" width="24" height="2.6" fill="url(#mSteelV)"/>
            <path d="M209 62v-5a4.6 4.6 0 0 1 9.2 0" fill="none" stroke="#9fb3c6" stroke-width="2.2"/>
            <path d="M203 68q9-7 18 0l3 22h-24z" fill="#3a4a63" stroke="#161f2c" stroke-width="1.2"/>
            <path d="M207 77h11" stroke="#8fa3b8" stroke-opacity=".6" stroke-width="1.4"/>
            <path d="M205 84h14" stroke="#2a3648" stroke-width="1.2"/>
        </g>

        <!-- Names the hazard, not the required behaviour. A green
             "floor and exit kept clear" plate echoed the correct option's
             wording, which is the answer leak removed from the other scenes. -->
        ${plate(112, 163, T('art.conduct.plate'), { color: '#ffb454', border: '#c07b12' })}
    `, 'art-conduct');
};

// 10 — instruments only: a microscope and the field of view
const ART_BIO = () => {
    // A compound light microscope in profile, built from the parts a student
    // actually names: horseshoe base and illuminator, condenser, mechanical
    // stage with the slide clipped down, C-limb carrying coarse and fine focus,
    // revolving nosepiece with three objectives, body tube and ocular.
    // The previous drawing was a stroked arm, three short strokes for the
    // objectives and a rotated rectangle for the eyepiece — it read as a lamp.
    const scope = `
        <g>
            <!-- base -->
            <path d="M46 146v-8q0-6 8-6h58q8 0 8 7v7z" fill="url(#mSteelV)" stroke="#1e2833" stroke-width="1.3"/>
            <path d="M52 134h60" stroke="#e2edf5" stroke-opacity=".4" stroke-width="1.6"/>

            <!-- illuminator, and the light path up through the slide -->
            <path d="M82 130l-3-18h18l-3 18z" fill="url(#mLamp)"/>
            <ellipse cx="88" cy="131" rx="10" ry="3.4" fill="#26323f" stroke="#151d28" stroke-width="1"/>
            <ellipse cx="88" cy="130.2" rx="6" ry="2.2" fill="#fff6d8" opacity=".92"/>

            <!-- condenser and iris under the stage -->
            <rect x="77" y="112" width="22" height="4" rx="1.6" fill="url(#mSteelV)" stroke="#1e2833" stroke-width="1"/>
            <path d="M81 112h14l-3-6h-8z" fill="url(#mSteelV)" stroke="#1e2833" stroke-width="1"/>
            <path d="M99 114h7" stroke="#8ba0b3" stroke-width="1.8" stroke-linecap="round"/>

            <!-- limb: the C-arm the head and stage hang off -->
            <path d="M50 134V84q0-16 15-20l22-6v13l-18 5q-9 2-9 10v52z"
                  fill="url(#mSteel)" stroke="#1e2833" stroke-width="1.3"/>

            <!-- stage, slide under its clips -->
            <rect x="60" y="100" width="56" height="6.5" rx="1.6" fill="url(#mSteelV)" stroke="#1e2833" stroke-width="1.2"/>
            <rect x="74" y="96.6" width="34" height="3.6" rx="0.8" fill="#cfe8f7" opacity=".9"
                  stroke="#8fb3cc" stroke-width="0.7"/>
            <rect x="84" y="97.2" width="9" height="2.4" rx="0.6" fill="#8fd6f5" opacity=".85"/>
            <path d="M71 97h6v3.4M111 97h-6v3.4" fill="none" stroke="#9fb4c6" stroke-width="1.4"/>
            <circle cx="65" cy="109.5" r="3" fill="url(#mSteelV)" stroke="#1e2833" stroke-width="0.9"/>

            <!-- coarse and fine focus, concentric on the limb -->
            <circle cx="57" cy="120" r="8.5" fill="url(#mSteelV)" stroke="#1e2833" stroke-width="1.2"/>
            <circle cx="57" cy="120" r="4.6" fill="url(#mSteel)" stroke="#1e2833" stroke-width="1"/>
            <g stroke="#0f1723" stroke-opacity=".45" stroke-width="0.9">
                <path d="M48.8 118h16.4M48.8 122h16.4"/>
            </g>

            <!-- body tube and ocular, drawn before the nosepiece so the turret
                 covers the joint the rotation opens up -->
            <g transform="rotate(34 96 72)">
                <rect x="88" y="34" width="17" height="42" rx="2.5" fill="url(#mSteel)" stroke="#1e2833" stroke-width="1.2"/>
                <rect x="90" y="22" width="13" height="14" rx="1.6" fill="url(#mSteelV)" stroke="#1e2833" stroke-width="1.2"/>
                <rect x="88.5" y="17.6" width="16" height="6" rx="2.4" fill="#2b3646" stroke="#1e2833" stroke-width="1.1"/>
                <ellipse cx="96.5" cy="18.6" rx="7" ry="2.6" fill="#0a1a26" stroke="#5d7997" stroke-width="1.1"/>
                <ellipse cx="95" cy="18.2" rx="3.4" ry="1.5" fill="#8fd6f5" opacity=".75"/>
            </g>

            <!-- revolving nosepiece -->
            <path d="M74 70h30q5 0 5 5v5q0 5-5 5H75q-5 0-5-5v-5q0-5 4-5z"
                  fill="url(#mSteel)" stroke="#1e2833" stroke-width="1.2"/>

            <!-- Three objectives, the engaged one over the slide. The turret
                 sits high enough that the barrel stops ~1.5 above the slide's
                 top face at y=96.6: at the earlier height it ran straight
                 through the slide and into the stage. -->
            <g stroke="#1e2833" stroke-width="1">
                <g transform="rotate(-36 79 84)"><path d="M75 84h8l-1.4 7h-5.2z" fill="url(#mSteelV)"/></g>
                <g transform="rotate(34 100 84)"><path d="M96 84h8l-1.4 8h-5.2z" fill="url(#mSteelV)"/></g>
                <path d="M84.6 84h9l-1.6 8h-5.8z" fill="url(#mSteelV)"/>
                <path d="M88.6 92h4.2l-0.8 3h-2.6z" fill="#1b2734"/>
            </g>
        </g>`;
    return svgWrap(`
        ${benchTop()}
        ${reflection(scope)}
        ${contactShadow(84, 146, 42, 5)}
        ${scope}
        <!-- Was a green "INSTRUMENTS ONLY" plate, which is the correct option's
             own description ("Eyes and instruments") in the colour this set uses
             for the right answer. The scene names the equipment and the hazard;
             it does not state the protocol. -->
        ${label(84, 163, T('art.bio.microscope'), '#9fb6cf')}

        <!-- field of view -->
        <g>
            <circle cx="248" cy="76" r="44" fill="#0a1c14" stroke="#3d5f52" stroke-width="2"/>
            <circle cx="248" cy="76" r="44" fill="url(#mKey)"/>
            <circle cx="248" cy="76" r="36" fill="none" stroke="#4de884" stroke-opacity=".25" stroke-width="1"/>
            ${[[236, 62, 7, 5], [260, 70, 6, 4], [242, 90, 8, 5.5], [264, 92, 5, 3.4], [226, 82, 4.4, 3]]
                .map(([cx, cy, rx, ry], i) => `
                    <g class="a-microbe" style="--i:${i}">
                        <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
                                 fill="#5fe08a" opacity=".78"/>
                        <ellipse cx="${cx - rx * 0.3}" cy="${cy - ry * 0.35}" rx="${rx * 0.35}" ry="${ry * 0.32}"
                                 fill="#dfffe9" opacity=".6"/>
                    </g>`).join('')}
            <path d="M216 48a44 44 0 0 1 22-14" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="4"/>
        </g>
        ${label(248, 134, T('art.bio.sample'), '#9fb6cf')}
        ${plate(248, 163, T('art.bio.plate'), { color: '#f0b13a', border: '#c07d12' })}
        ${leader(215, 44, 137, 30)}
    `, 'art-bio');
};

const SCENE_ART = {
    ppe: ART_PPE,
    hazard: ART_HAZARD,
    fire: ART_FIRE,
    spill: ART_SPILL,
    dilution: ART_DILUTION,
    cleanup: ART_CLEANUP,
    storage: ART_STORAGE,
    access: ART_ACCESS,
    conduct: ART_CONDUCT,
    biological: ART_BIO
};

// ===================================
// OPTION ICONS — 32x32, two-tone: a soft fill reads as volume, the stroke
// keeps them crisp at the sizes the cards use.
// ===================================

const ICON_PATHS = {
    'lab-coat': '<path d="M12 4l4 2.6L20 4l5 3a3 3 0 0 1 1.6 2.6V28H5.4V9.6A3 3 0 0 1 7 7z" class="f"/><path d="M16 6.6V28M12 4l4 3.4L20 4"/>',
    goggles: '<path d="M3 13a3 3 0 0 1 3-3h20a3 3 0 0 1 3 3v4a5 5 0 0 1-5 5h-4l-2.6-2.6h-2.8L12 22H8a5 5 0 0 1-5-5z" class="f"/><circle cx="11" cy="15.5" r="3.6"/><circle cx="21" cy="15.5" r="3.6"/><path d="M3 11L1 9M29 11l2-2"/>',
    // four even fingers + thumb + cuff, so it cannot read as a gesture
    gloves: '<rect x="9" y="9" width="4.2" height="12" rx="2.1" class="f"/>' +
            '<rect x="13.6" y="6" width="4.2" height="15" rx="2.1" class="f"/>' +
            '<rect x="18.2" y="7" width="4.2" height="14" rx="2.1" class="f"/>' +
            '<rect x="22.8" y="10" width="4.2" height="11" rx="2.1" class="f"/>' +
            '<path d="M9 17q-5 1-5 5t5 4z" class="f"/>' +
            '<path d="M8 18h19v7a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" class="f"/>',
    tshirt: '<path d="M11 4l5 3.4L21 4l5 3.4-2.4 4L21 10v18H11V10l-2.6 1.4L6 7.4z" class="f"/>',
    shower: '<path d="M16 3v6M8 11h16M10.6 11L9 15h14l-1.6-4" class="f"/><path d="M12 19v4M16 20v6M20 19v4"/>',
    blanket: '<rect x="4" y="6" width="24" height="21" rx="3" class="f"/><path d="M4 12h24M12 6v21"/>',
    extinguisher: '<path d="M11 11h10v17H11z" class="f"/><path d="M14 11V7h4v4M21 8h4l-1.4 4M16 16h3"/>',
    door: '<rect x="7" y="4" width="18" height="24" rx="2" class="f"/><circle cx="21" cy="16" r="1.4"/>',
    run: '<circle cx="19" cy="6" r="2.4" class="f"/><path d="M17.4 10l-4 5.4 4 2.6 1.4 6.6M13.4 15.4L8 17M19 18l5.4 2.6"/>',
    walk: '<circle cx="16" cy="6" r="2.4" class="f"/><path d="M16 9v8M16 17l-2.6 10M16 17l4 10M12 13l4-2.6 4 2.6"/>',
    beaker: '<path d="M9 4h14M10.6 4v17.4a5.4 5.4 0 0 0 10.8 0V4" class="f"/><path d="M10.6 16h10.8"/>',
    'acid-to-water': '<path d="M4 5h6M5 5v6.6a3.2 3.2 0 0 0 6.4 0V5" class="f"/><path d="M14 13l5.4 3.4L14 20"/><path d="M20 10h8M21 10v10.6a3.4 3.4 0 0 0 6.8 0V10" class="f"/>',
    'water-to-acid': '<path d="M28 5h-6M27 5v6.6a3.2 3.2 0 0 1-6.4 0V5" class="f"/><path d="M18 13l-5.4 3.4L18 20"/><path d="M4 10h8M5 10v10.6a3.4 3.4 0 0 0 6.8 0V10" class="f"/>',
    swirl: '<path d="M16 4a12 12 0 1 1-11.4 8"/><path d="M16 9.4a6.6 6.6 0 1 0 6.2 4.4"/><path d="M4 8l.6 4.6L9.4 12"/>',
    balance: '<path d="M16 4v22M8 28h16" /><path d="M5 10h22M5 10l-2.6 6.6h5.2zM27 10l2.6 6.6h-5.2z" class="f"/>',
    droplet: '<path d="M16 4s8 8.6 8 13.8A8 8 0 0 1 8 17.8C8 12.6 16 4 16 4z" class="f"/>',
    thermometer: '<path d="M16 19V6a2.6 2.6 0 0 1 5.2 0v13a5.2 5.2 0 1 1-5.2 0z" class="f"/><path d="M11 9h4M11 14h4"/>',
    biohazard: '<circle cx="16" cy="17" r="3.2" class="f"/><circle cx="16" cy="8" r="4" class="f"/><circle cx="8.4" cy="21" r="4" class="f"/><circle cx="23.6" cy="21" r="4" class="f"/>',
    radioactive: '<circle cx="16" cy="16" r="2.6" class="f"/><path d="M16 13.4V4a12 12 0 0 1 10.4 6l-8 4.6M16 18.6l-8 4.6A12 12 0 0 1 5.6 10"/><path d="M18.4 17.6l8 4.6A12 12 0 0 1 16 28"/>',
    flame: '<path d="M16 28a8 8 0 0 0 5.4-14C19 11 17.6 7 17.6 3 13.6 7.6 8 11.6 8 19a8 8 0 0 0 8 9z" class="f"/>',
    burner: '<path d="M8 28h16M16 28v-8M12 20h8" class="f"/><path d="M16 16c2.6-2.2 1.4-5.4 0-7.4-1.4 2-2.6 5.2 0 7.4z" class="f"/>',
    fridge: '<rect x="8" y="3" width="16" height="26" rx="3" class="f"/><path d="M8 12h16M12 7v3M12 16v4"/>',
    cabinet: '<rect x="5" y="4" width="22" height="24" rx="3" class="f"/><path d="M16 4v24M11 15h2.4M18.6 15H21M8 8h4M20 8h4"/>',
    megaphone: '<path d="M4 14v5l14 6.6V7.4z" class="f"/><path d="M18 11a5.4 5.4 0 0 1 0 10"/><path d="M7 19v5h4"/>',
    broom: '<path d="M21 4l7 7M19 9l4 4-8 8H8l-2.6-2.6z" class="f"/><path d="M11 19l-2.6 8M15 20l-1.4 7"/>',
    arrow: '<path d="M5 16h19M17.4 9.4L24 16l-6.6 6.6"/>',
    people: '<circle cx="11" cy="9" r="4" class="f"/><path d="M3 28v-2.6A7 7 0 0 1 19 25.4V28"/><circle cx="23" cy="10.6" r="3.2" class="f"/><path d="M19 28v-2a5.2 5.2 0 0 1 10.4 0v2"/>',
    teacher: '<circle cx="16" cy="7" r="3.4" class="f"/><path d="M9.4 28v-8a6.6 6.6 0 0 1 13.2 0v8"/><path d="M5 15l11-5.4L27 15"/>',
    clock: '<circle cx="16" cy="16" r="12" class="f"/><path d="M16 9.4V17l5.4 2.6"/>',
    check: '<circle cx="16" cy="16" r="12" class="f"/><path d="M10.6 16.6l4 4 6.8-8"/>',
    book: '<path d="M5 5h8a2.6 2.6 0 0 1 2.6 2.6v19a2.6 2.6 0 0 0-2.6-2.6H5z" class="f"/><path d="M27 5h-8a2.6 2.6 0 0 0-2.6 2.6v19a2.6 2.6 0 0 1 2.6-2.6h8z" class="f"/>',
    trash: '<path d="M5 9h22M12 9V5h8v4M7.6 9L9 28h14l1.4-19z" class="f"/>',
    microscope: '<path d="M8 28h16M14.6 28v-5.4M10.6 22.6h9.4" class="f"/><path d="M12 22.6V12a5.4 5.4 0 0 1 5.4-5.4L21.4 11l-5.4 5.4"/><path d="M18.6 16l4 4"/>',
    tongue: '<path d="M10.6 5h10.8v8a5.4 5.4 0 0 1-10.8 0z" class="f"/><path d="M16 18.6v8a3.4 3.4 0 0 0 6.8 0"/>',
    nose: '<path d="M17.4 4v9.4L21.4 19h-4v4a4 4 0 0 1-8 0" class="f"/><path d="M10.6 24h6.8"/>',
    straw: '<path d="M10.6 4h10.8l-2 24h-6.8z" class="f"/><path d="M11.4 12h9.2"/>',
    notes: '<rect x="7" y="4" width="18" height="24" rx="3" class="f"/><path d="M12 11h8M12 16h8M12 21h4"/>',
    question: '<circle cx="16" cy="16" r="12" class="f"/><path d="M12.6 12.6a3.4 3.4 0 1 1 4.8 3.1c-1 .6-1.4 1.2-1.4 2.3"/><path d="M16 22.6h.01"/>'
};

function icon(name) {
    const path = ICON_PATHS[name] || ICON_PATHS.question;
    return `<svg class="opt-icon" viewBox="0 0 32 32" fill="none"
                 stroke="currentColor" stroke-width="1.9"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                ${path}
            </svg>`;
}

function sceneArt(key) {
    const art = SCENE_ART[key];
    return typeof art === 'function' ? art() : (art || '');
}

window.graphics = { sceneArt, icon, SCENE_ART, ICON_PATHS };
