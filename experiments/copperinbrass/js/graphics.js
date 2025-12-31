// graphics.js - SVG generation for lab equipment

import { COLORS } from './config.js';
import { t } from './i18n/i18n.js';

// Balance with digital display
export function balance(reading = '0.000') {
    return `
    <svg width="140" height="100" viewBox="0 0 140 100">
        <path d="M10,65 L130,65 L125,95 L15,95 Z" fill="#4b5563" stroke="#2c3e50"/>
        <rect x="35" y="70" width="70" height="20" rx="3" fill="#1f2933" stroke="#4b5563"/>
        <text x="70" y="84" font-family="'Courier New', monospace" font-weight="bold" font-size="13" fill="#ff4d4f" text-anchor="middle">${reading}</text>
        <rect x="66" y="35" width="8" height="30" fill="url(#steel-grad)"/>
        <ellipse cx="70" cy="35" rx="48" ry="5" fill="#f6f8fa" stroke="#bdc3c7"/>
    </svg>`;
}

// Brass sample disc
export function brass() {
    return `
    <svg width="30" height="30" viewBox="0 0 30 30">
        <circle cx="15" cy="15" r="10" fill="url(#brass-grad)" stroke="#a67c00"/>
        <ellipse cx="11" cy="11" rx="3" ry="2" fill="white" opacity="0.4" transform="rotate(-45 11 11)"/>
    </svg>`;
}

// Beaker with optional contents and brass
export function beaker(vol = 0, color = 'transparent', hasBrass = false, reacting = false, label = '50ml', contentLabel = '') {
    const h = Math.min(vol, 75);
    const y = 90 - h;
    const maskId = `b-mask-${Math.random().toString(36).slice(2)}`;

    return `
    <svg width="70" height="110" viewBox="0 0 70 110" style="overflow:visible">
        <path d="M10,12 L10,92 Q10,102 35,102 Q60,102 60,92 L60,12" fill="#e8eef5" opacity="0.7" stroke="#c7d2e2" stroke-width="2"/>
        <mask id="${maskId}">
            <path d="M12,12 L12,91 Q12,100 35,100 Q58,100 58,91 L58,12" fill="white"/>
        </mask>
        <g mask="url(#${maskId})">
            ${vol > 0 ? `<path d="M11,${y} L11,91 Q11,100 35,100 Q59,100 59,91 L59,${y} Z" fill="${color}" opacity="0.9"/>` : ''}
            <path d="M11,${y} Q35,${y + 2.5} 59,${y}" fill="rgba(255,255,255,0.3)" opacity="${vol > 0 ? 1 : 0}"/>
            ${hasBrass ? `<circle cx="35" cy="94" r="${reacting ? 3 : 6}" fill="url(#brass-grad)" />` : ''}
            ${reacting ? `<circle cx="25" cy="90" r="1.5" class="bubble"/><circle cx="36" cy="94" r="2" class="bubble" style="animation-delay:0.2s"/>` : ''}
        </g>
        <path d="M10,12 L10,92 Q10,102 35,102 Q60,102 60,92 L60,12" fill="url(#glass-sheen)" stroke="#dce4ee" stroke-width="1.5" pointer-events="none"/>
        <ellipse cx="35" cy="12" rx="25" ry="4" fill="#f6f9fc" stroke="#c7d2e2" stroke-width="1.5"/>
        <text x="35" y="46" fill="#5a6b7c" font-size="9" text-anchor="middle">${label}</text>
        ${contentLabel ? `<text x="35" y="60" fill="#1f2d3d" font-size="9" text-anchor="middle" font-weight="600">${contentLabel}</text>` : ''}
    </svg>`;
}

// Volumetric flask
export function flask(vol = 0, color = 'transparent', contentLabel = '') {
    const maxFill = 65;
    const filled = Math.min(vol, maxFill);
    const y = 100 - filled;

    return `
    <svg width="80" height="120" viewBox="0 0 80 120">
        <defs><path id="f-shape" d="M36,5 L36,40 L18,86 Q40,115 62,96 Q74,86 66,78 L50,40 L50,5 Z" /></defs>
        <use href="#f-shape" fill="#e8eef5" opacity="0.8" stroke="#c7d2e2" stroke-width="2"/>
        <clipPath id="f-clip"><use href="#f-shape"/></clipPath>
        <g clip-path="url(#f-clip)">
            <rect x="0" y="${y}" width="80" height="${filled}" fill="${color}" opacity="0.96"/>
            <path d="M18,${y} Q40,${y + 3} 62,${y}" fill="rgba(0,0,0,0.12)" opacity="${vol > 0 ? 1 : 0}"/>
        </g>
        <use href="#f-shape" fill="url(#glass-sheen)" stroke="#dce4ee" stroke-width="1.5"/>
        <line x1="34" y1="32" x2="52" y2="32" stroke="#e74c3c" stroke-width="1.6" opacity="0.9"/>
        ${contentLabel ? `<text x="40" y="68" fill="#1f2d3d" font-size="9" text-anchor="middle" font-weight="600">${contentLabel}</text>` : ''}
    </svg>`;
}

// Reagent bottle
export function bottle(label = 'H2O', color = '#3498db') {
    return `
    <svg width="42" height="85" viewBox="0 0 42 85">
        <rect x="14" y="2" width="14" height="11" fill="#7f8c8d"/>
        <rect x="6" y="13" width="30" height="70" rx="3" fill="${color}" stroke="rgba(0,0,0,0.12)"/>
        <rect x="7" y="13" width="6" height="70" fill="white" opacity="0.2"/>
        <rect x="8" y="38" width="26" height="26" fill="#fff"/>
        <text x="21" y="53" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">${label}</text>
    </svg>`;
}

// Pipette with fill level
export function pipette(vol = 0, color = 'transparent', label = '') {
    const maxFill = 55;
    const fillH = vol * maxFill;
    const fillY = 112 - fillH;

    return `
    <svg width="40" height="120" viewBox="0 0 40 120">
        <circle cx="20" cy="18" r="12" fill="#e84c3c" stroke="#c0392b"/>
        <rect x="17" y="30" width="6" height="70" rx="3" fill="#eef2f7" stroke="#aebccc"/>
        <rect x="18" y="100" width="4" height="14" rx="2" fill="#cfd6e0" stroke="#9aa6b5"/>
        <rect x="18" y="${fillY}" width="4" height="${fillH}" fill="${color}" opacity="0.95" rx="1.5"/>
        <line x1="20" y1="30" x2="20" y2="100" stroke="white" opacity="0.5"/>
        ${label ? `<text x="20" y="92" text-anchor="middle" font-size="7" fill="white" font-weight="700">${label}</text>` : ''}
    </svg>`;
}

// Spectrophotometer (Spec 20)
export function spec(data = {}) {
    const { open = false, reading = '---', cuvette = false } = data;
    const screenText = open ? t('graphics.open') : reading;

    return `
    <svg width="170" height="115" viewBox="0 0 170 115">
        <rect x="8" y="25" width="154" height="82" rx="8" fill="#34434f" stroke="#1f2b35" stroke-width="2"/>
        <rect x="20" y="38" width="52" height="22" fill="#0b1218" stroke="#555"/>
        <text x="46" y="52" font-family="monospace" font-size="12" fill="#ff4d4f" text-anchor="middle">${screenText}</text>
        <rect x="106" y="34" width="32" height="28" fill="#111"/>
        ${cuvette ? `<rect x="114" y="38" width="15" height="18" fill="rgba(255,255,255,0.3)" stroke="white"/>` : ''}
        <g class="spec-lid" style="cursor:pointer">
            <path d="M98,${open ? 5 : 30} L140,${open ? 5 : 30} L135,${open ? 25 : 50} L103,${open ? 25 : 50} Z" fill="${open ? '#95a5a6' : '#2c3e50'}" stroke="#1f2b35"/>
            <text x="119" y="${open ? 20 : 45}" font-size="8" fill="white" text-anchor="middle" pointer-events="none">${t('graphics.lid')}</text>
        </g>
        <circle class="spec-calibrate" cx="135" cy="90" r="9" fill="#c0392b" style="cursor:pointer"/>
        <text x="135" y="93" font-size="7" fill="white" text-anchor="middle" pointer-events="none">0.00</text>
    </svg>`;
}

// Cuvette rack
export function rack() {
    return `
    <svg width="110" height="50" viewBox="0 0 110 50">
        <rect x="6" y="18" width="98" height="24" rx="6" fill="#6b7b8c" stroke="#4b5563"/>
        <circle cx="24" cy="18" r="7" fill="#4b5563"/>
        <circle cx="55" cy="18" r="7" fill="#4b5563"/>
        <circle cx="86" cy="18" r="7" fill="#4b5563"/>
        <text x="55" y="35" fill="white" font-size="9" text-anchor="middle" font-weight="bold" opacity="0.9">${t('graphics.getCuvette')}</text>
    </svg>`;
}

// Cuvette with fill and label
export function cuvette(color = 'transparent', vol = 0, label = '') {
    return `
    <svg width="24" height="56" viewBox="0 0 24 56">
        <rect x="2" y="2" width="20" height="52" rx="2" fill="#e8eef5" opacity="0.7" stroke="#b6c2d1" stroke-width="1.2"/>
        <rect x="3" y="${54 - vol}" width="18" height="${vol}" fill="${color}" opacity="0.95"/>
        <rect x="2" y="2" width="20" height="52" fill="url(#glass-sheen)" opacity="0.7"/>
        ${label ? `<text x="12" y="36" font-size="7" text-anchor="middle" fill="#1f2d3d" font-weight="700">${label}</text>` : ''}
    </svg>`;
}

// Waste beaker with disposed pipettes
export function waste(vol = 10, disposedPipettes = []) {
    const pipetteCount = disposedPipettes.length;

    // Draw disposed pipettes inside the beaker
    let pipettesSvg = '';
    if (pipetteCount > 0) {
        disposedPipettes.forEach((pipette, i) => {
            // Position pipettes at different angles inside the beaker
            const xOffset = 20 + (i * 12) % 30;
            const yOffset = 50 + (i * 8) % 20;
            const rotation = -15 + (i * 25) % 40;
            pipettesSvg += `
                <g transform="translate(${xOffset}, ${yOffset}) rotate(${rotation})">
                    <rect x="0" y="0" width="4" height="25" rx="1" fill="#e8e8e8" stroke="#bbb" stroke-width="0.5"/>
                    <rect x="0.5" y="18" width="3" height="6" fill="${pipette.color || '#ffd7a0'}" opacity="0.6"/>
                    <circle cx="2" cy="1" r="1.5" fill="#d35400"/>
                </g>
            `;
        });
    }

    return `<svg width="70" height="110" viewBox="0 0 70 110" class="beaker">
        <!-- Beaker body -->
        <path d="M10,12 L10,92 Q10,102 35,102 Q60,102 60,92 L60,12" fill="url(#waste-grad)" stroke="#3e2b15" stroke-width="2"/>

        <!-- Liquid contents -->
        <path d="M12,${95 - vol * 0.8} L12,92 Q12,100 35,100 Q58,100 58,92 L58,${95 - vol * 0.8}" fill="#5e4b35" opacity="0.6"/>

        <!-- Disposed pipettes -->
        ${pipettesSvg}

        <!-- Glass highlights -->
        <path d="M15,20 L15,85" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>

        <!-- Label -->
        <text x="35" y="55" font-size="8" text-anchor="middle" fill="#fff" font-weight="bold">${t('graphics.waste')}</text>
        ${pipetteCount > 0 ? `<text x="35" y="68" font-size="7" text-anchor="middle" fill="#ffeaa7">${t('graphics.pipettes', { count: pipetteCount })}</text>` : ''}
    </svg>`;
}

// Helper to get content label for display
export function getContentLabel(content) {
    if (!content) return '';
    // Map content types to translation keys
    const keyMap = {
        'acid': 'content.acid',
        'water': 'content.water',
        'copper': 'content.copper',
        'std_0.1': 'content.std01',
        'std_0.2': 'content.std02',
        'std_0.4': 'content.std04',
        'unknown': 'content.unknown',
        'blank': 'content.blank'
    };
    const key = keyMap[content];
    return key ? t(key) : content;
}

// Get color for content type
export function getContentColor(content) {
    const colors = {
        'acid': COLORS.acid,
        'water': COLORS.water,
        'copper': COLORS.copper,
        'std_0.1': COLORS.standard,
        'std_0.2': COLORS.standard,
        'std_0.4': COLORS.standard,
        'unknown': COLORS.copperLight,
        'blank': COLORS.water
    };
    return colors[content] || COLORS.transparent;
}
