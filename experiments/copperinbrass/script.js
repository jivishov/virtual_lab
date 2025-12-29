/* --- GRAPHICS GENERATOR (SVG) --- */
const GFX = {
    balance: (reading) => `
        <svg width="140" height="100" viewBox="0 0 140 100">
            <path d="M10,65 L130,65 L125,95 L15,95 Z" fill="#4b5563" stroke="#2c3e50"/>
            <rect x="35" y="70" width="70" height="20" rx="3" fill="#1f2933" stroke="#4b5563"/>
            <text x="70" y="84" font-family="'Courier New', monospace" font-weight="bold" font-size="13" fill="#ff4d4f" text-anchor="middle">${reading}</text>
            <rect x="66" y="35" width="8" height="30" fill="url(#steel-grad)"/>
            <ellipse cx="70" cy="35" rx="48" ry="5" fill="#f6f8fa" stroke="#bdc3c7"/>
        </svg>`,

    brass: () => `
        <svg width="30" height="30" viewBox="0 0 30 30">
            <circle cx="15" cy="15" r="10" fill="url(#brass-grad)" stroke="#a67c00"/>
            <ellipse cx="11" cy="11" rx="3" ry="2" fill="white" opacity="0.4" transform="rotate(-45 11 11)"/>
        </svg>`,

    beaker: (vol, color, hasBrass, reacting, label = "50ml", contentLabel = "") => {
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
                <rect x="11" y="${y}" width="48" height="${h}" fill="${color}" opacity="0.9"/>
                <path d="M11,${y} Q35,${y + 2.5} 59,${y}" fill="rgba(0,0,0,0.12)" opacity="${vol > 0 ? 1 : 0}"/>
                ${hasBrass ? `<circle cx="35" cy="94" r="${reacting ? 3 : 6}" fill="url(#brass-grad)" />` : ''}
                ${reacting ? `<circle cx="25" cy="90" r="1.5" class="bubble"/><circle cx="36" cy="94" r="2" class="bubble" style="animation-delay:0.2s"/>` : ''}
            </g>
            <path d="M10,12 L10,92 Q10,102 35,102 Q60,102 60,92 L60,12" fill="url(#glass-sheen)" stroke="#dce4ee" stroke-width="1.5" pointer-events="none"/>
            <ellipse cx="35" cy="12" rx="25" ry="4" fill="#f6f9fc" stroke="#c7d2e2" stroke-width="1.5"/>
            <text x="35" y="46" fill="#5a6b7c" font-size="9" text-anchor="middle">${label}</text>
            ${contentLabel ? `<text x="35" y="60" fill="#1f2d3d" font-size="9" text-anchor="middle" font-weight="600">${contentLabel}</text>` : ""}
        </svg>`;
    },

    flask: (vol, color, contentLabel = "") => {
        const maxFill = 65; // cap fill to below the neck mark
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
            ${contentLabel ? `<text x="40" y="68" fill="#1f2d3d" font-size="9" text-anchor="middle" font-weight="600">${contentLabel}</text>` : ""}
        </svg>`;
    },

    bottle: (label, color) => `
        <svg width="42" height="85" viewBox="0 0 42 85">
            <rect x="14" y="2" width="14" height="11" fill="#7f8c8d"/>
            <rect x="6" y="13" width="30" height="70" rx="3" fill="${color}" stroke="rgba(0,0,0,0.12)"/>
            <rect x="7" y="13" width="6" height="70" fill="white" opacity="0.2"/>
            <rect x="8" y="38" width="26" height="26" fill="#fff"/>
            <text x="21" y="53" font-size="9" font-weight="bold" text-anchor="middle" fill="#333">${label}</text>
        </svg>`,

    pipette: (vol, color, label = "") => {
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
            ${label ? `<text x="20" y="92" text-anchor="middle" font-size="7" fill="white" font-weight="700">${label}</text>` : ""}
        </svg>`;
    },

    spec: (data) => {
        const screenText = data.open ? "OPEN" : (data.reading || "---");
        return `
        <svg width="170" height="115" viewBox="0 0 170 115">
            <rect x="8" y="25" width="154" height="82" rx="8" fill="#34434f" stroke="#1f2b35" stroke-width="2"/>
            <rect x="20" y="38" width="52" height="22" fill="#0b1218" stroke="#555"/>
            <text x="46" y="52" font-family="monospace" font-size="12" fill="red" text-anchor="middle">${screenText}</text>
            <rect x="106" y="34" width="32" height="28" fill="#111"/>
            ${data.cuvette ? `<rect x="114" y="38" width="15" height="18" fill="rgba(255,255,255,0.3)" stroke="white"/>` : ''}
            <g style="cursor:pointer" onclick="toggleLid()">
                <path d="M98,${data.open ? 5 : 30} L140,${data.open ? 5 : 30} L135,${data.open ? 25 : 50} L103,${data.open ? 25 : 50} Z" fill="${data.open ? '#95a5a6' : '#2c3e50'}" stroke="#1f2b35"/>
                <text x="119" y="${data.open ? 20 : 45}" font-size="8" fill="white" text-anchor="middle" pointer-events="none">LID</text>
            </g>
            <circle cx="135" cy="90" r="9" fill="#c0392b" onclick="calibrate()" style="cursor:pointer"/>
            <text x="135" y="93" font-size="7" fill="white" text-anchor="middle" pointer-events="none">0.00</text>
        </svg>`;
    },

    rack: () => `
        <svg width="110" height="50" viewBox="0 0 110 50">
            <rect x="6" y="18" width="98" height="24" rx="6" fill="#6b7b8c" stroke="#4b5563"/>
            <circle cx="24" cy="18" r="7" fill="#4b5563"/><circle cx="55" cy="18" r="7" fill="#4b5563"/><circle cx="86" cy="18" r="7" fill="#4b5563"/>
            <text x="55" y="35" fill="white" font-size="9" text-anchor="middle" font-weight="bold" opacity="0.9">GET CUVETTE</text>
        </svg>`,

    cuvette: (color, vol, dirty, label = "") => `
        <svg width="24" height="56" viewBox="0 0 24 56">
            <rect x="2" y="2" width="20" height="52" rx="2" fill="#e8eef5" opacity="0.7" stroke="#b6c2d1" stroke-width="1.2"/>
            <rect x="3" y="${54 - vol}" width="18" height="${vol}" fill="${color}" opacity="0.95"/>
            <rect x="2" y="2" width="20" height="52" fill="url(#glass-sheen)" opacity="0.7"/>
            ${dirty && vol === 0 ? '<text x="12" y="28" font-size="16" text-anchor="middle" fill="red">!</text>' : ''}
            ${label ? `<text x="12" y="36" font-size="7" text-anchor="middle" fill="#1f2d3d" font-weight="700">${label}</text>` : ""}
        </svg>`
};

/* --- LAB STATE & STEPS --- */
const LAB = {
    step: 0,
    brassMass: (1.30 + Math.random() * 0.4).toFixed(3),
    molarity: 0,
    spec: { open: false, hasCuv: false, cuvObj: null, cal: false },
    idCount: 0,
    pipetteSerial: 1,
    pipetteRegistry: {},
    cuvetteRegistry: {},
    counts: { balance: 0, brass: 0, beaker: 0, flask: 0, spec: 0, rack: 0, waste: 0, acid: 0, water: 0, std1: 0, std2: 0, std4: 0 },
    history: []
};

const STEPS = [
    { text: "Drag the brass sample onto the balance pan and record mass.", gear: ["Balance", "Brass Sample"] },
    { text: "Move the weighed brass into the 50 mL beaker.", gear: ["Brass Sample", "50 mL Beaker"] },
    { text: "Use a pipette (acid-only) to add conc. HNO3 and dissolve the brass (watch the reaction).", gear: ["Pipette", "50 mL Beaker", "Conc. HNO3"] },
    { text: "Use a fresh pipette to move the copper solution to the 100 mL volumetric flask.", gear: ["Pipette", "50 mL Beaker", "100 mL Flask"] },
    { text: "Use another clean pipette to dilute the flask to volume with distilled water.", gear: ["Pipette", "100 mL Flask", "Distilled Water"] },
    { text: "Take a cuvette for the blank and fill with distilled water using a clean pipette.", gear: ["Cuvette", "Rack", "Pipette", "Distilled Water"] },
    { text: "Open the Spec 20 lid, place the blank cuvette inside, then close the lid.", gear: ["Spec 20", "Cuvette"] },
    { text: "Calibrate the Spec 20 with the blank (0.000).", gear: ["Spec 20"] },
    { text: "Open lid, insert 0.1 M standard cuvette, close lid.", gear: ["Spec 20", "Cuvette", "0.1 M"] },
    { text: "Measure 0.1 M standard and record absorbance.", gear: ["Spec 20"] },
    { text: "Open lid, insert 0.2 M standard cuvette, close lid.", gear: ["Spec 20", "Cuvette", "0.2 M"] },
    { text: "Measure 0.2 M standard and record absorbance.", gear: ["Spec 20"] },
    { text: "Open lid, insert 0.4 M standard cuvette, close lid.", gear: ["Spec 20", "Cuvette", "0.4 M"] },
    { text: "Measure 0.4 M standard and record absorbance.", gear: ["Spec 20"] },
    { text: "Open lid, insert unknown cuvette, close lid.", gear: ["Spec 20", "Cuvette", "Unknown"] },
    { text: "Measure the unknown cuvette and record absorbance.", gear: ["Spec 20"] },
    { text: "Calculate mass percent copper for the brass sample and submit.", gear: ["Notebook"] }
];

const GEAR_COLORS = {
    "Balance": "#16a085",
    "Brass Sample": "#d9861f",
    "50 mL Beaker": "#1f9df2",
    "Conc. HNO3": "#d8344c",
    "100 mL Flask": "#8e44ad",
    "Pipette": "#e67e22",
    "Distilled Water": "#2d9cdb",
    "Rack": "#5d6d7e",
    "Cuvette": "#2ecc71",
    "Spec 20": "#34495e",
    "Standards": "#273c75",
    "Notebook": "#34495e"
};

const gearPill = (label) => `<span class="gear-pill" style="--tag:${GEAR_COLORS[label] || '#6b7b8c'}">${label}</span>`;
const labelFromKey = (key) => {
    if (!key) return "";
    if (key === 'acid') return 'HNO3';
    if (key === 'water') return 'H2O';
    if (key.startsWith('std_')) return key.split('_')[1] + 'M';
    if (key === 'conc_cu') return 'Cu(NO3)2';
    if (key === 'unk') return 'Unknown';
    return key;
};

/* --- APPLICATION LOGIC --- */
class App {
    constructor() {
        this.wb = document.getElementById('workbench');
        this.shelf = document.getElementById('shelf');
        this.objects = [];
        this.dragged = null;
        this.stepsCollapsed = false;
        this.stepListEl = null;
        this.stepToggleEl = null;

        this.wb.addEventListener('dragover', e => e.preventDefault());
        this.wb.addEventListener('drop', e => this.handleDrop(e));

        this.populateShelf();
        this.buildStepTracker();
        this.updateInstr();
    }

    isOver(src, tgt) {
        const a = src.el.getBoundingClientRect();
        const b = tgt.el.getBoundingClientRect();
        return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
    }

    populateShelf() {
        const items = [
            { type: 'balance', label: 'Balance' },
            { type: 'brass', label: 'Brass Sample' },
            { type: 'pipette', label: 'Pipette' },
            { type: 'waste', label: 'Waste Beaker' },
            { type: 'beaker', label: '50 mL Beaker' },
            { type: 'acid', label: 'Conc. HNO3' },
            { type: 'flask', label: '100 mL Flask' },
            { type: 'water', label: 'Dist. Water' },
            { type: 'spec', label: 'Spec 20' },
            { type: 'rack', label: 'Cuvette Rack' },
            { type: 'std1', label: '0.1 M Std' },
            { type: 'std2', label: '0.2 M Std' },
            { type: 'std4', label: '0.4 M Std' }
        ];

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'shelf-item';
            div.draggable = true;
            div.setAttribute('data-type', item.type);
            div.innerHTML = `
                <div class="shelf-icon">${this.getSVG(item.type, true)}</div>
                <div class="shelf-label">${item.label}</div>
            `;
            div.ondragstart = (e) => {
                e.dataTransfer.setData('src', 'shelf');
                e.dataTransfer.setData('type', item.type);
            };
            this.shelf.appendChild(div);
        });
    }

    getSVG(type, isIcon) {
        if (type === 'balance') return GFX.balance("0.000");
        if (type === 'brass') return GFX.brass();
        if (type === 'beaker') return GFX.beaker(10, 'rgba(0,0,255,0.15)', false, false);
        if (type === 'waste') return GFX.beaker(20, 'url(#waste-grad)', false, false, "Waste");
        if (type === 'flask') return GFX.flask(10, 'rgba(0,0,255,0.15)');
        if (type === 'pipette') return GFX.pipette(0, 'transparent');
        if (type === 'spec') return GFX.spec({ open: false });
        if (type === 'rack') return GFX.rack();
        if (type === 'cuvette') return GFX.cuvette('rgba(255,255,255,0.2)', 30);

        let c = '#3498db';
        let l = 'H2O';
        if (type === 'acid') { c = '#e74c3c'; l = 'HNO3'; }
        if (type.includes('std')) { c = '#2980b9'; l = type.includes('1') ? '0.1M' : (type.includes('2') ? '0.2M' : '0.4M'); }
        return GFX.bottle(l, c);
    }

    enforceLimit(type) {
        const singletons = ['balance', 'brass', 'beaker', 'flask', 'spec', 'rack', 'waste', 'acid', 'water', 'std1', 'std2', 'std4'];
        if (!singletons.includes(type)) return false;
        if (LAB.counts[type] >= 1) return true;
        LAB.counts[type] += 1;
        return false;
    }

    createObj(type, x, y, props = {}, options = {}) {
        const skipLimit = options.skipLimit || false;
        if (!skipLimit && this.enforceLimit(type)) {
            alert("Only one of this item is allowed in the workspace.");
            return null;
        }

        const id = 'obj_' + LAB.idCount++;
        const el = document.createElement('div');
        el.className = 'lab-obj';
        el.id = id;
        el.draggable = true;
        el.style.touchAction = 'none';

        if (type === 'brass') el.style.zIndex = 100;
        if (type === 'pipette') el.style.zIndex = 200;
        if (type === 'cuvette') el.style.zIndex = 101;

        if (type === 'pipette') {
            props.vol = props.vol || 0; props.content = props.content || null;
            props.serial = props.serial || ('P' + LAB.pipetteSerial++);
            LAB.pipetteRegistry[id] = props.assigned || null;
        }
        if (type === 'cuvette') {
            props.dirty = !!props.dirty;
            LAB.cuvetteRegistry[id] = props.assigned || null;
        }

        const obj = { id, type, el, x, y, props: { vol: 0, color: 'transparent', content: null, ...props } };

        if (type === 'rack') el.onclick = () => this.createObj('cuvette', obj.x + 20, obj.y + 40);

        el.ondragstart = (e) => {
            this.dragged = obj;
            e.dataTransfer.setData('src', 'wb');
            e.dataTransfer.setData('id', id);
            setTimeout(() => el.style.opacity = '0.5', 0);
        };
        el.ondragend = () => {
            this.dragged = null;
            el.style.opacity = '1';
            el.classList.remove('drag-target');
        };
        el.ondragover = (e) => { e.preventDefault(); if (this.dragged && this.dragged.id !== id) el.classList.add('drag-target'); };
        el.ondragleave = () => el.classList.remove('drag-target');
        el.ondrop = (e) => {
            e.stopPropagation();
            el.classList.remove('drag-target');
            this.interact(this.dragged, obj);
        };

        // Pointer drag fallback (helps when native drag is finicky)
        const onMove = (e) => {
            if (!obj.__pointerDrag) return;
            const rect = this.wb.getBoundingClientRect();
            const cx = e.clientX ?? (e.touches?.[0]?.clientX || 0);
            const cy = e.clientY ?? (e.touches?.[0]?.clientY || 0);
            const x = cx - rect.left - obj.__dragOffset.x;
            const y = cy - rect.top - obj.__dragOffset.y;
            this.moveObj(obj, x, y);
        };
        const stopMove = () => {
            if (!obj.__pointerDrag) return;
            obj.__pointerDrag = false;
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', stopMove);
            const target = this.objects.find(o => o.id !== obj.id && this.isOver(obj, o));
            if (target) this.interact(obj, target);
            this.dragged = null;
        };
        el.onpointerdown = (e) => {
            e.preventDefault();
            obj.__pointerDrag = true;
            const rect = obj.el.getBoundingClientRect();
            obj.__dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
            this.dragged = obj;
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', stopMove, { once: true });
        };

        this.objects.push(obj);
        this.wb.appendChild(el);
        this.moveObj(obj, x, y);
        this.render(obj);
        return obj;
    }

    moveObj(obj, x, y) {
        obj.x = x;
        obj.y = this.safeY(y);
        obj.el.style.left = x + 'px';
        obj.el.style.top = obj.y + 'px';
    }

    safeY(y) {
        const topbar = document.getElementById('topbar');
        if (!topbar || !this.wb) return y;
        const wbRect = this.wb.getBoundingClientRect();
        const tbRect = topbar.getBoundingClientRect();
        const minY = (tbRect.bottom - wbRect.top) + 10;
        return Math.max(y, minY);
    }

    contentLabel(obj) {
        if ((obj.type === 'beaker' || obj.type === 'flask') && obj.props.vol > 0) {
            if (obj.props.conc) return obj.props.conc + 'M';
            if (obj.props.content) return labelFromKey(obj.props.content);
            if (obj.props.molarity) return 'Cu(NO3)2';
            if (obj.props.acid) return 'HNO3';
        }
        return "";
    }

    pipetteLabel(obj) {
        if (obj.props.vol === 0) return "";
        const assigned = LAB.pipetteRegistry[obj.id];
        if (assigned) return labelFromKey(assigned);
        return "";
    }

    cuvetteLabel(obj) {
        if (obj.props.vol === 0) return "";
        const assigned = LAB.cuvetteRegistry[obj.id];
        if (assigned) {
            if (assigned.startsWith('std_')) return assigned.split('_')[1] + 'M';
            if (assigned === 'water') return 'Blank';
            return labelFromKey(assigned);
        }
        return "";
    }

    render(obj) {
        const p = obj.props;
        let h = "";
        if (obj.type === 'balance') h = GFX.balance(p.reading || "0.000");
        else if (obj.type === 'brass') h = GFX.brass();
        else if (obj.type === 'beaker') h = GFX.beaker(p.vol, p.color, p.hasBrass, p.reacting, "50ml", this.contentLabel(obj));
        else if (obj.type === 'waste') h = GFX.beaker(p.vol, 'url(#waste-grad)', false, false, "Waste");
        else if (obj.type === 'flask') h = GFX.flask(p.vol, p.color, this.contentLabel(obj));
        else if (obj.type === 'pipette') h = GFX.pipette(p.vol, p.color, this.pipetteLabel(obj));
        else if (obj.type === 'spec') h = GFX.spec({ open: LAB.spec.open, reading: p.reading, cuvette: LAB.spec.hasCuv });
        else if (obj.type === 'rack') h = GFX.rack();
        else if (obj.type === 'cuvette') h = GFX.cuvette(p.color, p.vol, p.dirty, this.cuvetteLabel(obj));
        else if (obj.type.includes('bottle') || obj.type === 'acid' || obj.type === 'water' || obj.type.includes('std')) {
            let label = 'H2O', col = '#3498db';
            if (p.acid) { label = 'HNO3'; col = '#e74c3c'; }
            if (p.conc) { label = p.conc + 'M'; col = '#2980b9'; }
            h = GFX.bottle(label, col);
        }
        obj.el.innerHTML = h;
    }

    handleDrop(e) {
        e.preventDefault();
        const rect = this.wb.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = this.safeY(e.clientY - rect.top);

        const src = e.dataTransfer.getData('src');

        if (src === 'shelf') {
            const type = e.dataTransfer.getData('type');
            x -= 30; y -= 30;

            let props = {};
            if (type === 'acid') props = { acid: true, color: '#e74c3c' };
            if (type === 'water') props = { color: '#3498db' };
            if (type.includes('std')) props = { conc: (type.includes('1') ? 0.1 : (type.includes('2') ? 0.2 : 0.4)), color: 'rgba(41, 128, 185, 0.7)' };
            if (type === 'waste') props = { vol: 10, color: 'url(#waste-grad)' };

            const finalType = (type === 'acid' || type === 'water' || type.includes('std')) ? 'bottle' : type;
            this.createObj(finalType, x, y, props);
        } else {
            const id = e.dataTransfer.getData('id');
            const obj = this.objects.find(o => o.id === id);
            if (obj) {
                this.moveObj(obj, x - 30, y - 30);
                if (obj.type === 'brass') {
                    const bal = this.objects.find(b => b.type === 'balance');
                    if (bal && Math.abs(bal.x - x) > 100) {
                        bal.props.reading = "0.000";
                        this.render(bal);
                    }
                }
            }
        }
    }

    interact(src, tgt) {
        if (!src || !tgt) return;

        // Clean up stale content markers on empty containers
        if ((tgt.type === 'flask' || tgt.type === 'beaker') && (tgt.props.vol || 0) === 0) {
            tgt.props.content = null;
            tgt.props.conc = null;
            tgt.props.molarity = null;
            tgt.props.type = null;
        }

        // Save history before state changes
        this.saveHistory();

        // --- PIPETTE LOGIC START ---
        if (src.type === 'pipette' && (tgt.type === 'bottle' || (src.props.vol === 0 && (tgt.type === 'beaker' || tgt.type === 'flask')))) {
            if (src.props.vol > 0) return alert("Pipette is full. Empty it first.");
            if (tgt.props.vol <= 0 && tgt.type !== 'bottle') return alert("Container is empty.");

            let color = tgt.props.color;
            let type = tgt.props.content || 'unknown';
            if (tgt.type === 'bottle') {
                if (tgt.props.acid) type = 'acid';
                else if (tgt.props.conc) type = 'std_' + tgt.props.conc;
                else type = 'water';
            }

            const assigned = LAB.pipetteRegistry[src.id];
            if (assigned && assigned !== type) return alert(`Use a new pipette for ${type}. Current pipette is reserved for ${labelFromKey(assigned)}.`);
            LAB.pipetteRegistry[src.id] = type;

            src.props.vol = 1;
            src.props.color = color;
            src.props.content = type;
            if (tgt.type === 'flask' && tgt.props.molarity) src.props.molarity = tgt.props.molarity;
            this.render(src);
            return;
        }

        if (src.type === 'pipette' && (tgt.type === 'beaker' || tgt.type === 'flask' || tgt.type === 'cuvette' || tgt.type === 'waste')) {
            if (src.props.vol === 0) return alert("Pipette is empty.");

            // Block adding acid directly into the volumetric flask
            if (tgt.type === 'flask' && src.props.content === 'acid') return alert("Do not add acid directly to the flask.");

            if (tgt.type === 'cuvette') {
                if (tgt.props.vol > 0) return alert("Cuvette is full. Drag to Waste to empty.");
                if (tgt.props.dirty && src.props.content !== 'water') return alert("Cuvette is dirty! Rinse with Distilled Water first.");
                const cvKey = LAB.cuvetteRegistry[tgt.id];
                const srcKey = src.props.content;
                if (cvKey && cvKey !== srcKey) return alert("Use a new cuvette for this solution.");
                if (!cvKey && srcKey) LAB.cuvetteRegistry[tgt.id] = srcKey;
            }

            if (tgt.type !== 'waste') {
                tgt.props.vol += (tgt.type === 'cuvette' ? 40 : 20);
                tgt.props.color = src.props.color;
                if (src.props.content === 'acid') { tgt.props.acid = true; tgt.props.content = 'acid'; }
                if (src.props.content === 'conc_cu') tgt.props.content = 'conc_cu';
                if (src.props.content === 'water') {
                    if (tgt.type === 'cuvette' && tgt.props.dirty) { /* rinsed */ }
                }
                if (src.props.content && src.props.content.startsWith('std_')) {
                    tgt.props.conc = parseFloat(src.props.content.split('_')[1]);
                    tgt.props.content = src.props.content;
                }
                if (src.props.molarity) { tgt.props.molarity = src.props.molarity; tgt.props.type = 'unk'; tgt.props.content = 'unk'; }
            } else {
                tgt.props.vol = Math.min(80, tgt.props.vol + 5);
            }

            if (tgt.type === 'beaker' && src.props.content === 'acid') this.reactBeaker(tgt);
            if (tgt.type === 'flask' && src.props.content === 'conc_cu') {
                if (tgt.props.content === 'conc_cu' && (tgt.props.vol || 0) > 0) {
                    return alert("Flask already has the copper solution.");
                }
                tgt.props.content = 'conc_cu';
                tgt.props.vol = 20; // represent the transferred concentrate volume
                if (LAB.step === 3) this.nextStep();
            }
            if (tgt.type === 'flask' && src.props.content === 'water' && tgt.props.content === 'conc_cu') {
                this.diluteFlask(tgt);
            }
            if (tgt.type === 'cuvette') {
                if (src.props.content === 'water') tgt.props.type = 'blank';
                else if (src.props.content && src.props.content.startsWith('std_')) tgt.props.type = 'std';
                else if (src.props.molarity) tgt.props.type = 'unk';
                if (LAB.step === 5 && tgt.props.type === 'blank') this.nextStep();
            }

            src.props.vol = 0;
            src.props.color = 'transparent';
            src.props.content = null;
            this.render(src);
            this.render(tgt);
            return;
        }

        if ((src.type === 'bottle' || src.type === 'beaker' || src.type === 'flask') && (tgt.type === 'beaker' || tgt.type === 'flask' || tgt.type === 'cuvette')) {
            return alert("Do not pour directly. Use the Pipette to transfer liquids.");
        }

        if (src.type === 'brass' && tgt.type === 'balance') {
            if (LAB.step !== 0) return;
            this.moveObj(src, tgt.x + 55, tgt.y + 20);
            tgt.props.reading = LAB.brassMass;
            this.render(tgt);
            document.getElementById('nb-mass').innerText = LAB.brassMass;
            this.nextStep();
        }

        if (src.type === 'brass' && tgt.type === 'beaker') {
            if (LAB.step < 1) return alert("Weigh it first.");
            src.el.style.display = 'none';
            tgt.props.hasBrass = true;
            this.render(tgt);
            this.nextStep();
        }

        if (src.type === 'cuvette' && tgt.type === 'waste') {
            if (src.props.vol === 0) return;
            tgt.props.vol = Math.min(80, tgt.props.vol + 5);
            if (src.props.type === 'blank') {
                src.props.dirty = false;
            } else {
                src.props.dirty = true;
            }
            src.props.vol = 0;
            src.props.color = 'transparent';
            src.props.type = null;
            this.render(src);
            this.render(tgt);
        }

        if (src.type === 'cuvette' && tgt.type === 'spec') {
            if (!LAB.spec.open) return alert("Open Lid.");
            if (LAB.spec.hasCuv) return alert("Full.");
            if (src.props.vol === 0) return alert("Cuvette is empty.");

            src.el.style.display = 'none';
            LAB.spec.hasCuv = true;
            LAB.spec.cuvObj = src;
            tgt.props.reading = "---";
            this.render(tgt);
            if (LAB.step === 6) this.nextStep();
        }
    }

    reactBeaker(beaker) {
        if (!beaker.props.hasBrass) return alert("Needs brass.");
        beaker.props.reacting = true;
        this.render(beaker);
        setTimeout(() => {
            beaker.props.reacting = false;
            beaker.props.hasBrass = false;
            beaker.props.color = '#2980b9';
            beaker.props.content = 'conc_cu';
            this.render(beaker);
            document.getElementById('nb-cond').innerText = "Dissolved";
            if (LAB.step === 2) this.nextStep();
        }, 2500);
    }

    diluteFlask(flask) {
        flask.props.vol = 65;
        flask.props.color = 'rgba(52, 152, 219, 0.6)';
        flask.props.type = 'unk';
        flask.props.content = 'unk';
        LAB.molarity = (parseFloat(LAB.brassMass) * 0.70) / 63.55 / 0.1;
        flask.props.molarity = LAB.molarity;
        this.render(flask);
        if (LAB.step === 4) this.nextStep();
    }

    nextStep() {
        if (LAB.step < STEPS.length - 1) {
            LAB.step++;
            this.updateInstr();
        }
    }

    updateInstr() {
        const text = document.getElementById('instr-text');
        const prog = document.getElementById('step-progress');
        const gear = document.getElementById('instr-gear');
        const current = STEPS[LAB.step];

        if (prog) prog.innerText = `Step ${LAB.step + 1} / ${STEPS.length}`;
        if (text) text.innerText = current.text;
        if (gear) gear.innerHTML = current.gear.map(gearPill).join('');
        this.highlightSteps();
    }

    saveHistory() {
        const snap = this.snapshot();
        LAB.history.push(snap);
        if (LAB.history.length > 5) LAB.history.shift();
    }

    snapshot() {
        return {
            lab: JSON.parse(JSON.stringify({
                step: LAB.step,
                brassMass: LAB.brassMass,
                molarity: LAB.molarity,
                spec: LAB.spec,
                idCount: LAB.idCount,
                pipetteSerial: LAB.pipetteSerial,
                pipetteRegistry: LAB.pipetteRegistry,
                cuvetteRegistry: LAB.cuvetteRegistry,
                counts: LAB.counts
            })),
            objects: this.objects.map(o => ({
                id: o.id,
                type: o.type,
                x: o.x,
                y: o.y,
                props: JSON.parse(JSON.stringify(o.props)),
                display: o.el.style.display || ""
            })),
            tableHTML: document.querySelector('#nb-table tbody').innerHTML,
            nbMass: document.getElementById('nb-mass').innerText,
            nbCond: document.getElementById('nb-cond').innerText,
            resultVisible: document.getElementById('result-area').style.display
        };
    }

    restore(snap) {
        // Reset state
        LAB.step = snap.lab.step;
        LAB.brassMass = snap.lab.brassMass;
        LAB.molarity = snap.lab.molarity;
        LAB.spec = snap.lab.spec;
        LAB.idCount = snap.lab.idCount;
        LAB.pipetteSerial = snap.lab.pipetteSerial;
        LAB.pipetteRegistry = JSON.parse(JSON.stringify(snap.lab.pipetteRegistry));
        LAB.cuvetteRegistry = JSON.parse(JSON.stringify(snap.lab.cuvetteRegistry));
        LAB.counts = JSON.parse(JSON.stringify(snap.lab.counts));

        // Clear objects in DOM
        this.objects.forEach(o => o.el.remove());
        this.objects = [];

        // Recreate objects
        snap.objects.forEach(o => {
            const obj = this.createObj(o.type, o.x, o.y, o.props, { skipLimit: true });
            if (obj) {
                obj.id = o.id;
                obj.el.id = o.id;
                LAB.pipetteRegistry[obj.id] = LAB.pipetteRegistry[obj.id] || o.props.assigned || null;
                LAB.cuvetteRegistry[obj.id] = LAB.cuvetteRegistry[obj.id] || o.props.assigned || null;
                if (o.display !== undefined) obj.el.style.display = o.display;
            }
        });

        // Restore notebook
        document.querySelector('#nb-table tbody').innerHTML = snap.tableHTML;
        document.getElementById('nb-mass').innerText = snap.nbMass;
        document.getElementById('nb-cond').innerText = snap.nbCond;
        document.getElementById('result-area').style.display = snap.resultVisible;

        // Refresh UI
        this.updateInstr();
        this.objects.forEach(o => this.render(o));
    }

    undo() {
        if (LAB.history.length === 0) return alert("No undo history.");
        const snap = LAB.history.pop();
        this.restore(snap);
    }

    forwardStep() {
        this.saveHistory();
        const current = LAB.step;
        this.autoStep(current);
        this.updateInstr();
    }

    autoStep(stepIdx) {
        // create helpers for default positions
        const ensure = (type, x, y, props = {}) => {
            let obj = this.objects.find(o => o.type === type);
            if (!obj) obj = this.createObj(type, x, y, props);
            return obj;
        };

        if (stepIdx === 0) {
            const bal = ensure('balance', 420, 360, {});
            const brass = ensure('brass', bal.x + 20, bal.y - 40, {});
            this.moveObj(brass, bal.x + 55, bal.y + 20);
            bal.props.reading = LAB.brassMass;
            document.getElementById('nb-mass').innerText = LAB.brassMass;
            this.render(bal);
            this.nextStep();
        } else if (stepIdx === 1) {
            const beaker = ensure('beaker', 360, 280, { vol: 0, color: 'rgba(0,0,255,0.15)' });
            const brass = this.objects.find(o => o.type === 'brass');
            if (brass) brass.el.style.display = 'none';
            beaker.props.hasBrass = true;
            this.render(beaker);
            this.nextStep();
        } else if (stepIdx === 2) {
            const beaker = ensure('beaker', 360, 280, { vol: 0, color: 'rgba(0,0,255,0.15)' });
            beaker.props.reacting = false;
            beaker.props.hasBrass = false;
            beaker.props.color = '#2980b9';
            beaker.props.content = 'conc_cu';
            document.getElementById('nb-cond').innerText = "Dissolved";
            this.render(beaker);
            this.nextStep();
        } else if (stepIdx === 3) {
            const flask = ensure('flask', 520, 280, { vol: 20, color: '#2980b9', content: 'conc_cu' });
            flask.props.content = 'conc_cu';
            flask.props.vol = 20;
            this.render(flask);
            this.nextStep();
        } else if (stepIdx === 4) {
            const flask = ensure('flask', 520, 280, { vol: 20, content: 'conc_cu', color: '#2980b9' });
            flask.props.vol = 65;
            flask.props.color = 'rgba(52, 152, 219, 0.6)';
            flask.props.type = 'unk';
            flask.props.content = 'unk';
            LAB.molarity = (parseFloat(LAB.brassMass) * 0.70) / 63.55 / 0.1;
            flask.props.molarity = LAB.molarity;
            this.render(flask);
            this.nextStep();
        } else if (stepIdx === 5) {
            const rack = ensure('rack', 320, 400, {});
            const cuv = this.createObj('cuvette', rack.x + 20, rack.y + 40, { color: '#3498db', vol: 40, type: 'blank', content: 'water' }, { skipLimit: true });
            if (cuv) {
                LAB.cuvetteRegistry[cuv.id] = 'water';
                this.render(cuv);
            }
            this.nextStep();
        } else if (stepIdx === 6) {
            const spec = ensure('spec', 620, 420, {});
            LAB.spec.cal = true;
            LAB.spec.hasCuv = false;
            spec.props.reading = "0.000";
            this.render(spec);
            this.nextStep();
        } else if (stepIdx === 7) {
            const tbody = document.querySelector('#nb-table tbody');
            tbody.innerHTML = `
                <tr><td>0.1 M</td><td>0.222</td></tr>
                <tr><td>0.2 M</td><td>0.442</td></tr>
                <tr><td>0.4 M</td><td>0.887</td></tr>
                <tr><td>Unknown</td><td>0.338</td></tr>
            `;
            document.getElementById('result-area').style.display = 'block';
            this.nextStep();
        }
    }

    buildStepTracker() {
        const tracker = document.getElementById('step-tracker');
        if (!tracker) return;

        tracker.innerHTML = `
            <div class="step-tracker-header">
                <span>Steps</span>
                <button id="toggle-steps" class="btn mini" type="button">${this.stepsCollapsed ? 'Show' : 'Hide'}</button>
            </div>
            <div id="step-list" class="${this.stepsCollapsed ? 'collapsed' : ''}">
                ${STEPS.map((step, idx) => `
                    <div class="step-item" data-idx="${idx}">
                        <div class="step-num">${idx + 1}</div>
                        <div class="step-copy">
                            <div class="step-title">${step.text}</div>
                            <div class="step-gear">${step.gear.map(gearPill).join('')}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        this.stepListEl = tracker.querySelector('#step-list');
        this.stepToggleEl = tracker.querySelector('#toggle-steps');
        tracker.classList.toggle('collapsed', this.stepsCollapsed);
        if (this.stepToggleEl) {
            this.stepToggleEl.onclick = () => {
                this.stepsCollapsed = !this.stepsCollapsed;
                if (this.stepListEl) this.stepListEl.classList.toggle('collapsed', this.stepsCollapsed);
                this.stepToggleEl.textContent = this.stepsCollapsed ? 'Show' : 'Hide';
                tracker.classList.toggle('collapsed', this.stepsCollapsed);
            };
        }
    }

    highlightSteps() {
        const scope = this.stepListEl || document;
        const items = scope.querySelectorAll('.step-item');
        items.forEach(item => {
            const idx = parseInt(item.dataset.idx, 10);
            item.classList.toggle('active', idx === LAB.step);
            item.classList.toggle('done', idx < LAB.step);
        });
    }
}

const app = new App();

/* --- GLOBAL HANDLERS --- */
function toggleLid() {
    LAB.spec.open = !LAB.spec.open;
    const spec = app.objects.find(o => o.type === 'spec');

    if (LAB.spec.open && LAB.spec.hasCuv) {
        LAB.spec.hasCuv = false;
        const c = LAB.spec.cuvObj;
        c.el.style.display = 'block';
        app.moveObj(c, spec.x + 140, spec.y + 50);
        LAB.spec.cuvObj = null;
        spec.props.reading = "---";
    } else if (!LAB.spec.open && LAB.spec.hasCuv) {
        measure(spec);
    }
    app.render(spec);
}

function calibrate() {
    const spec = app.objects.find(o => o.type === 'spec');
    if (LAB.spec.open) return;
    if (LAB.spec.hasCuv && LAB.spec.cuvObj.props.type === 'blank') {
        LAB.spec.cal = true;
        spec.props.reading = "0.000";
        app.render(spec);
        if (LAB.step === 7) app.nextStep();
    } else {
        alert("Insert Blank.");
    }
}

function measure(spec) {
    if (!LAB.spec.cal) { spec.props.reading = "Err"; return; }

    const props = LAB.spec.cuvObj.props;
    let abs = 0;
    if (props.type === 'blank') abs = 0.000;
    else {
        const conc = props.conc || props.molarity || 0;
        abs = (2.2 * conc) + (Math.random() * 0.01);
    }

    spec.props.reading = abs.toFixed(3);

    if (props.type !== 'blank') {
        const name = props.type === 'unk' ? 'Unknown' : (props.conc || 0) + " M";
        const table = document.querySelector('#nb-table tbody');
        table.innerHTML += `<tr><td>${name}</td><td>${abs.toFixed(3)}</td></tr>`;

        if (props.type === 'unk') {
            document.getElementById('result-area').style.display = 'block';
            if (LAB.step === 8) app.nextStep();
        }
    }
}

function checkResult() {
    const v = parseFloat(document.getElementById('user-calc').value);
    if (v > 68 && v < 72) alert("Correct! Good work.");
    else alert("Check calc. (Mass Cu / Total Mass) * 100");
}

// Bind controls
const undoBtn = document.getElementById('undo-btn');
if (undoBtn) undoBtn.onclick = () => app.undo();
const ffBtn = document.getElementById('ff-btn');
if (ffBtn) ffBtn.onclick = () => app.forwardStep();
