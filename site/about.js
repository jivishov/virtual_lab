// ===== ABOUT PAGE =====
// Lists that come from translation arrays, the live language switcher panel,
// "predicted elements" for future work, and the copy-to-clipboard command.

(function () {
    'use strict';

    const VL = window.VL;
    const CATALOG = window.VL_CATALOG || [];
    const esc = VL.esc;

    VL.vars = { n: CATALOG.length, l: VL.languages().length };

    function list(path) {
        const value = VL.t(path);
        return Array.isArray(value) ? value : [];
    }

    function renderSpec() {
        const el = document.getElementById('specList');
        if (!el) return;
        el.innerHTML = list('about.sections.technical.list').map((item, i) => `
            <li data-reveal style="--rd:${i * 60}ms"><span class="spec-no">${String(i + 1).padStart(2, '0')}</span>
            <span class="spec-txt">${esc(item)}</span><span class="spec-ok">${VL.icon.check}</span></li>`).join('');
    }

    function renderChecklist() {
        const el = document.getElementById('checklist');
        if (!el) return;
        el.innerHTML = list('site.about.checklist').map((item, i) => `
            <li style="--k:${i}"><span class="box">${VL.icon.check}</span><span>${esc(item)}</span></li>`).join('');
    }

    function renderFuture() {
        const el = document.getElementById('ekaGrid');
        if (!el) return;
        const start = CATALOG.length + 1;
        el.innerHTML = list('about.sections.future.list').map((item, i) => `
            <li class="eka-card" data-reveal style="--rd:${i * 70}ms">
                <span class="tile-no">${start + i}</span>
                <span class="eka-sym" aria-hidden="true">?</span>
                <span class="eka-txt">${esc(item)}</span>
            </li>`).join('');
    }

    function renderLanguages() {
        const el = document.getElementById('langRows');
        if (!el) return;
        const current = VL.lang();
        el.innerHTML = VL.languages().map(lang => {
            const name = VL.t('languageName', null, lang) || lang.toUpperCase();
            const pre = VL.tx('site.hero.pre', '', lang);
            const em = VL.tx('site.hero.em', '', lang);
            const post = VL.tx('site.hero.post', '', lang);
            return `<li><button type="button" class="lang-row" data-lang="${lang}" aria-pressed="${lang === current}" lang="${lang}">
                <span class="code">${lang.toUpperCase()}</span>
                <span class="native">${esc(name)}</span>
                <span class="phrase">${esc(pre)} <em>${esc(em)}</em> ${esc(post)}</span>
            </button></li>`;
        }).join('');
    }

    function initInteractions() {
        const rows = document.getElementById('langRows');
        if (rows) rows.addEventListener('click', e => {
            const b = e.target.closest('.lang-row');
            if (b && b.dataset.lang !== VL.lang()) VL.setLanguage(b.dataset.lang);
        });

        const copy = document.getElementById('copyCmd');
        if (copy) copy.addEventListener('click', async () => {
            const cmd = document.getElementById('cmd').textContent.trim();
            let ok = false;
            try {
                await navigator.clipboard.writeText(cmd);
                ok = true;
            } catch (e) {
                const range = document.createRange();
                range.selectNodeContents(document.getElementById('cmd'));
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
            if (!ok) return;
            const label = copy.querySelector('[data-t]');
            copy.classList.add('is-done');
            label.textContent = VL.tx('site.about.copied', 'Copied');
            window.setTimeout(() => {
                copy.classList.remove('is-done');
                label.textContent = VL.tx('site.about.copy', 'Copy');
            }, 1800);
        });
    }

    let first = true;
    document.addEventListener('vl:render', () => {
        document.querySelectorAll('[data-stat-n]').forEach(el => { el.textContent = VL.vars.n; });
        document.querySelectorAll('[data-stat-l]').forEach(el => { el.textContent = VL.vars.l; });
        renderSpec();
        renderChecklist();
        renderFuture();
        renderLanguages();
        if (first) initInteractions();
        first = false;
    });
})();
