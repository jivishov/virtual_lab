// ===== HOME PAGE =====
// Periodic table (hero), collection with filters/search, and the stats band.

(function () {
    'use strict';

    const VL = window.VL;
    const CATALOG = window.VL_CATALOG || [];
    const FAMILIES = ['chem', 'phys', 'life', 'safety'];
    const esc = VL.esc;

    VL.vars = { n: CATALOG.length, l: VL.languages().length };

    const state = { type: 'all', family: null, q: '' };
    let tableFocus = null;
    let firstRender = true;

    // ----- Data helpers -----
    function text(item) {
        const data = VL.t('labs.' + item.key) || {};
        const title = data.title || item.key;
        return {
            title,
            desc: data.description || '',
            tags: Array.isArray(data.tags) ? data.tags : [],
            short: VL.tx('site.short.' + item.key, title)
        };
    }

    function launches(item) {
        if (item.versions) return item.versions.map(v => ({ label: VL.tx(v.label, 'Launch'), link: v.link }));
        const key = item.type === 'lab' ? 'buttons.launchLab' : 'buttons.launchSimulation';
        return [{ label: VL.tx(key, 'Launch'), link: item.link }];
    }

    const primaryLink = item => (item.versions ? item.versions[0].link : item.link);
    const familyName = f => VL.tx('site.family.' + f, f);
    const typeName = t => VL.tx('site.type.' + t, t);
    const counts = () => {
        const c = { all: CATALOG.length, lab: 0, simulation: 0 };
        FAMILIES.forEach(f => (c[f] = 0));
        CATALOG.forEach(item => { c[item.type] += 1; c[item.family] += 1; });
        return c;
    };

    const normalize = s => String(s)
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/ı/g, 'i').replace(/ə/g, 'e');

    // ----- Periodic table -----
    function tileHTML(item, i, tx) {
        const label = `${i + 1}. ${tx.title} (${typeName(item.type)}, ${familyName(item.family)})`;
        return `<a class="tile" href="${esc(primaryLink(item))}" data-i="${i}" data-family="${item.family}"
                style="--c:var(--${item.family});--on:var(--on-${item.family});--i:${i}" aria-label="${esc(label)}">
                <span class="tile-no">${i + 1}</span>
                <span class="tile-type">${item.badge ? `<b>${esc(item.badge)}</b>` : ''}${VL.icon[item.type]}</span>
                <span class="tile-sym">${esc(item.sym)}</span>
                <span class="tile-name">${esc(tx.short)}</span>
            </a>`;
    }

    function keyHTML(c) {
        const chips = FAMILIES.map(f => `
            <button type="button" class="fam-chip" data-family="${f}" style="--c:var(--${f})" aria-pressed="${tableFocus === f}">
                <span class="dot" aria-hidden="true"></span><span class="fam-name">${esc(familyName(f))}</span><span class="n">${c[f]}</span>
            </button>`).join('');
        return `<div class="ptable-key" id="pkey" data-state="legend">
            <div class="key-legend">
                <div class="key-anatomy" aria-hidden="true">
                    <div class="tile tile-demo" style="--c:var(--chem);--on:var(--on-chem)">
                        <span class="tile-no">3</span><span class="tile-type">${VL.icon.lab}</span>
                        <span class="tile-sym">Cu</span><span class="tile-name">${esc(VL.tx('site.short.copperinbrass'))}</span>
                    </div>
                    <ul class="anat">
                        <li><b>3</b>${esc(VL.tx('site.table.no'))}</li>
                        <li><b class="serif">Cu</b>${esc(VL.tx('site.table.symbol'))}</li>
                        <li><b>${VL.icon.lab}</b>${esc(typeName('lab'))}</li>
                        <li><b>${VL.icon.simulation}</b>${esc(typeName('simulation'))}</li>
                    </ul>
                </div>
                <div class="key-fams">
                    <p class="key-label">${esc(VL.tx('site.table.families'))}</p>
                    <div class="fam-grid" role="group" aria-label="${esc(VL.tx('site.table.families'))}">${chips}</div>
                </div>
            </div>
            <div class="key-inspect" aria-hidden="true"></div>
        </div>`;
    }

    function renderTable() {
        const table = document.getElementById('ptable');
        if (!table) return;
        const c = counts();
        const n = CATALOG.length;
        const slots = 2 + 8 * Math.max(2, Math.ceil((n - 2) / 8));
        let html = '';

        CATALOG.forEach((item, i) => {
            html += tileHTML(item, i, text(item));
            if (i === 0) html += keyHTML(c);
        });
        for (let k = n; k < slots; k++) {
            html += `<div class="tile is-eka" data-eka style="--i:${k}" aria-hidden="true">
                <span class="tile-no">${k + 1}</span><span class="tile-sym">?</span>
                <span class="tile-name">${esc(VL.tx('site.eka.name'))}</span></div>`;
        }

        table.innerHTML = html;
        table.toggleAttribute('data-focus', !!tableFocus);
        applyTableFocus();

        if (firstRender && !VL.reducedMotion()) {
            table.classList.add('is-entering');
            window.setTimeout(() => table.classList.remove('is-entering'), 1600 + n * 40);
        }

        const hint = document.getElementById('tableHint');
        if (hint) {
            const hover = window.matchMedia('(hover: hover)').matches;
            hint.textContent = VL.tx(hover ? 'site.table.hint' : 'site.table.hintTouch');
        }
    }

    function applyTableFocus() {
        const table = document.getElementById('ptable');
        if (!table) return;
        const active = tableFocus;
        table.toggleAttribute('data-focus', !!active);
        table.querySelectorAll('a.tile').forEach(t => t.classList.toggle('is-fam', !!active && t.dataset.family === active));
        table.querySelectorAll('.fam-chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.family === tableFocus)));
    }

    function inspectHTML(tile) {
        if (tile.hasAttribute('data-eka')) {
            return `<div class="insp-meta"><span class="insp-dash"></span>${esc(VL.tx('site.eka.name'))}</div>
                <h3 class="insp-title">${esc(VL.tx('site.eka.title'))}</h3>
                <p class="insp-desc">${esc(VL.tx('site.eka.desc'))}</p>
                <div class="insp-sym is-eka">?</div>`;
        }
        const i = Number(tile.dataset.i);
        const item = CATALOG[i];
        const tx = text(item);
        return `<div class="insp-meta"><span class="dot"></span>${esc(familyName(item.family))} · ${esc(typeName(item.type))}${item.badge ? ` · ${esc(item.badge)}` : ''}</div>
            <h3 class="insp-title">${esc(tx.title)}</h3>
            <p class="insp-desc">${esc(tx.desc)}</p>
            <div class="insp-sym">${esc(item.sym)}</div>
            <p class="insp-go">${esc(VL.tx('site.table.go'))} ${VL.icon.arrow}</p>`;
    }

    function initTableInteractions() {
        const table = document.getElementById('ptable');
        if (!table) return;
        let timer = 0;
        let current = null;

        const key = () => document.getElementById('pkey');
        const show = tile => {
            const k = key();
            if (!k || current === tile) return;
            current = tile;
            const panel = k.querySelector('.key-inspect');
            panel.style.setProperty('--c', tile.hasAttribute('data-eka') ? 'var(--ink-3)' : `var(--${tile.dataset.family})`);
            panel.innerHTML = inspectHTML(tile);
            k.setAttribute('data-state', 'inspect');
            table.querySelectorAll('.tile.is-active').forEach(t => t.classList.remove('is-active'));
            tile.classList.add('is-active');
        };
        const reset = () => {
            const k = key();
            current = null;
            if (k) k.setAttribute('data-state', 'legend');
            table.querySelectorAll('.tile.is-active').forEach(t => t.classList.remove('is-active'));
        };

        table.addEventListener('pointerover', e => {
            if (e.pointerType === 'touch') return;
            const tile = e.target.closest('.tile:not(.tile-demo)');
            window.clearTimeout(timer);
            if (!tile) return;
            timer = window.setTimeout(() => show(tile), current ? 40 : 90);
        });
        table.addEventListener('pointerleave', () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(reset, 260);
        });
        table.addEventListener('focusin', e => {
            const tile = e.target.closest('a.tile');
            if (tile) show(tile);
        });
        table.addEventListener('focusout', e => {
            if (!table.contains(e.relatedTarget)) reset();
        });

        // The preview panel is a large click target for the tile it describes.
        table.addEventListener('click', e => {
            if (!e.target.closest('.key-inspect') || !current || !current.href) return;
            window.location.href = current.href;
        });

        // Field chips highlight a family; hover previews, click pins.
        table.addEventListener('click', e => {
            const chip = e.target.closest('.fam-chip');
            if (!chip) return;
            tableFocus = tableFocus === chip.dataset.family ? null : chip.dataset.family;
            applyTableFocus();
        });
        table.addEventListener('pointerover', e => {
            const chip = e.target.closest('.fam-chip');
            if (!chip || e.pointerType === 'touch') return;
            table.setAttribute('data-focus', '');
            table.querySelectorAll('a.tile').forEach(t => t.classList.toggle('is-fam', t.dataset.family === chip.dataset.family));
        });
        table.addEventListener('pointerout', e => {
            const chip = e.target.closest('.fam-chip');
            if (chip && !chip.contains(e.relatedTarget)) applyTableFocus();
        });

        // Arrow keys move between tiles by position, like a spreadsheet.
        table.addEventListener('keydown', e => {
            const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
            if (!keys.includes(e.key)) return;
            const tile = e.target.closest('a.tile');
            if (!tile) return;
            const tiles = Array.from(table.querySelectorAll('a.tile'));
            let target = null;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                target = tiles[tiles.indexOf(tile) + (e.key === 'ArrowRight' ? 1 : -1)];
            } else {
                const r = tile.getBoundingClientRect();
                const cx = r.left + r.width / 2;
                const down = e.key === 'ArrowDown';
                const candidates = tiles.filter(t => {
                    const tr = t.getBoundingClientRect();
                    return down ? tr.top > r.bottom - 2 : tr.bottom < r.top + 2;
                });
                candidates.sort((a, b) => {
                    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
                    const dy = Math.abs(ra.top - r.top) - Math.abs(rb.top - r.top);
                    if (Math.abs(dy) > 4) return dy;
                    return Math.abs(ra.left + ra.width / 2 - cx) - Math.abs(rb.left + rb.width / 2 - cx);
                });
                target = candidates[0];
            }
            if (target) {
                e.preventDefault();
                target.focus();
            }
        });
    }

    // ----- Collection -----
    function cardHTML(item, i) {
        const tx = text(item);
        const actions = launches(item);
        const single = actions.length === 1;
        const haystack = normalize([tx.title, tx.desc, tx.tags.join(' '), tx.short, item.sym, familyName(item.family), typeName(item.type)].join(' '));
        return `<article class="card" data-reveal data-type="${item.type}" data-family="${item.family}" data-search="${esc(haystack)}"
                style="--c:var(--${item.family});--on:var(--on-${item.family});--rd:${(i % 3) * 70}ms">
            <div class="card-art">
                ${window.VL_ART ? window.VL_ART(item.key) : ''}
                <span class="card-tile" aria-hidden="true"><span class="tile-no">${i + 1}</span><span class="tile-sym">${esc(item.sym)}</span></span>
                <span class="card-type">${VL.icon[item.type]}<span>${esc(typeName(item.type))}</span>${item.badge ? `<b>${esc(item.badge)}</b>` : ''}</span>
            </div>
            <div class="card-body">
                <p class="card-fam"><span class="dot" aria-hidden="true"></span>${esc(familyName(item.family))}</p>
                <h4 class="card-title">${esc(tx.title)}</h4>
                <p class="card-desc">${esc(tx.desc)}</p>
                <ul class="card-tags">${tx.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
            </div>
            <div class="card-actions">
                ${actions.map((a, k) => `<a class="btn ${k === 0 ? 'btn-launch' : 'btn-line'}${single ? ' stretch' : ''}" href="${esc(a.link)}"${single ? '' : ` aria-label="${esc(tx.title + ' — ' + a.label)}"`}><span>${esc(a.label)}</span>${VL.icon.arrow}</a>`).join('')}
            </div>
        </article>`;
    }

    function renderToolbar() {
        const c = counts();
        const seg = document.getElementById('typeSeg');
        if (seg) {
            const opts = [['all', VL.tx('site.catalog.all')], ['lab', VL.tx('sections.virtualLabs')], ['simulation', VL.tx('sections.simulations')]];
            seg.innerHTML = opts.map(([v, label]) =>
                `<button type="button" data-type="${v}" aria-pressed="${state.type === v}">${esc(label)}<span class="n">${c[v]}</span></button>`).join('');
            seg.setAttribute('aria-label', VL.tx('site.catalog.filters'));
        }
        const chips = document.getElementById('famChips');
        if (chips) {
            chips.innerHTML = FAMILIES.map(f =>
                `<button type="button" class="chip" data-family="${f}" style="--c:var(--${f})" aria-pressed="${state.family === f}"><span class="dot" aria-hidden="true"></span>${esc(familyName(f))}</button>`).join('');
            chips.setAttribute('aria-label', VL.tx('site.table.families'));
        }
    }

    function renderCatalog() {
        const root = document.getElementById('catalog');
        if (!root) return;
        const groups = [['lab', 'sections.virtualLabs'], ['simulation', 'sections.simulations']];
        root.innerHTML = groups.map(([type, key]) => {
            const items = CATALOG.map((item, i) => [item, i]).filter(([item]) => item.type === type);
            return `<section class="group" data-group="${type}" aria-labelledby="group-${type}">
                <header class="group-head">
                    <span class="group-icon" aria-hidden="true">${VL.icon[type]}</span>
                    <h3 class="group-title" id="group-${type}">${esc(VL.tx(key))}</h3>
                    <span class="group-count" data-count></span>
                    <span class="group-rule" aria-hidden="true"></span>
                </header>
                <div class="cards">${items.map(([item, i]) => cardHTML(item, i)).join('')}</div>
            </section>`;
        }).join('');
        applyFilters();
    }

    function applyFilters() {
        const terms = normalize(state.q.trim()).split(/\s+/).filter(Boolean);
        let shown = 0;
        document.querySelectorAll('#catalog .group').forEach(group => {
            let n = 0;
            group.querySelectorAll('.card').forEach(card => {
                const ok = (state.type === 'all' || card.dataset.type === state.type)
                    && (!state.family || card.dataset.family === state.family)
                    && terms.every(t => card.dataset.search.includes(t));
                card.hidden = !ok;
                if (ok) n += 1;
            });
            group.hidden = n === 0;
            group.querySelector('[data-count]').textContent = String(n).padStart(2, '0');
            shown += n;
        });
        const empty = document.getElementById('emptyState');
        if (empty) empty.hidden = shown > 0;
        document.querySelectorAll('#typeSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.type === state.type)));
        document.querySelectorAll('#famChips .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.family === state.family)));
    }

    function initToolbar() {
        const seg = document.getElementById('typeSeg');
        const chips = document.getElementById('famChips');
        const search = document.getElementById('search');
        const clear = document.getElementById('clearFilters');

        if (seg) seg.addEventListener('click', e => {
            const b = e.target.closest('button[data-type]');
            if (!b) return;
            state.type = b.dataset.type;
            applyFilters();
        });
        if (chips) chips.addEventListener('click', e => {
            const b = e.target.closest('button[data-family]');
            if (!b) return;
            state.family = state.family === b.dataset.family ? null : b.dataset.family;
            applyFilters();
        });
        if (search) search.addEventListener('input', () => {
            state.q = search.value;
            applyFilters();
        });
        if (clear) clear.addEventListener('click', () => {
            state.type = 'all';
            state.family = null;
            state.q = '';
            if (search) search.value = '';
            applyFilters();
            if (search) search.focus();
        });

        // "/" jumps to search, like many documentation sites.
        document.addEventListener('keydown', e => {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
            const t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            if (!search) return;
            e.preventDefault();
            search.focus();
        });
    }

    // ----- Stats band -----
    function renderStats() {
        const values = { labs: CATALOG.length, langs: VL.languages().length, installs: 0 };
        document.querySelectorAll('[data-stat]').forEach(el => {
            const v = values[el.dataset.stat];
            if (v === undefined) return;
            el.dataset.value = v;
            if (!el.dataset.counted) el.textContent = firstRender && !VL.reducedMotion() ? '0' : String(v);
        });
    }

    function initCountUp() {
        const band = document.querySelector('.band');
        if (!band || !('IntersectionObserver' in window) || VL.reducedMotion()) {
            document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = el.dataset.value; el.dataset.counted = '1'; });
            return;
        }
        const io = new IntersectionObserver(entries => {
            if (!entries.some(e => e.isIntersecting)) return;
            io.disconnect();
            document.querySelectorAll('[data-stat]').forEach(el => {
                const end = Number(el.dataset.value) || 0;
                const start = performance.now();
                const dur = 1100;
                const step = now => {
                    const p = Math.min(1, (now - start) / dur);
                    el.textContent = String(Math.round(end * (1 - Math.pow(1 - p, 3))));
                    if (p < 1) requestAnimationFrame(step);
                    else el.dataset.counted = '1';
                };
                requestAnimationFrame(step);
            });
        }, { threshold: 0.4 });
        io.observe(band);
    }

    // ----- Wiring -----
    document.addEventListener('vl:render', () => {
        renderTable();
        renderToolbar();
        renderCatalog();
        renderStats();
        if (firstRender) {
            initTableInteractions();
            initToolbar();
            initCountUp();
        }
        firstRender = false;
    });
})();
