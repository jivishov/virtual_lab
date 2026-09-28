// ===== SHARED PAGE RUNTIME =====
// Translation lookup with English fallback, language + theme switching,
// sticky-header state and scroll reveals. Page scripts listen for `vl:render`,
// which fires after first load and after every language change.

(function () {
    'use strict';

    const VL = (window.VL = window.VL || {});
    const hasI18n = typeof I18n !== 'undefined';
    const dict = () => (typeof translations !== 'undefined' ? translations : (window.translations || {}));

    VL.vars = {};

    VL.lang = function () {
        if (hasI18n) return I18n.currentLanguage || I18n.getCurrentLanguage();
        return 'en';
    };

    VL.languages = function () {
        return hasI18n ? I18n.supportedLanguages.slice() : Object.keys(dict());
    };

    function lookup(lang, path) {
        let value = dict()[lang];
        for (const key of path.split('.')) {
            if (value == null || typeof value !== 'object') return undefined;
            value = value[key];
        }
        return value;
    }

    // Returns the string/array/object at `path` in the current language, falling
    // back to English, or undefined when neither has it.
    VL.t = function (path, vars, lang) {
        let value = lookup(lang || VL.lang(), path);
        if (value === undefined) value = lookup('en', path);
        if (typeof value === 'string' && vars) {
            value = value.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));
        }
        return value;
    };

    // String-only convenience with an explicit fallback.
    VL.tx = function (path, fallback, lang) {
        const value = VL.t(path, VL.vars, lang);
        return typeof value === 'string' ? value : (fallback === undefined ? '' : fallback);
    };

    VL.esc = function (value) {
        return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    };

    VL.icon = {
        lab: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.8 1.6h4.4M6.6 1.6v4.3L2.7 12.5a1.4 1.4 0 0 0 1.2 2.1h8.2a1.4 1.4 0 0 0 1.2-2.1L9.4 5.9V1.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.4 10.2h7.2" stroke="currentColor" stroke-width="1.4"/></svg>',
        simulation: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.5 5.3v5.4L10.9 8z" fill="currentColor"/></svg>',
        arrow: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 8h10.5M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        check: '<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/></svg>'
    };

    VL.applyText = function (root) {
        const scope = root || document;
        scope.querySelectorAll('[data-t]').forEach(el => {
            const value = VL.t(el.getAttribute('data-t'), VL.vars);
            if (typeof value !== 'string') return;
            if (el.hasAttribute('data-t-sentences')) {
                // One span per sentence so CSS can keep each sentence on its own line.
                el.innerHTML = value.split(/(?<=[.!?])(?<!\b(?:Dr|Prof|Mr|Mrs|Ms|Nr|bzw|z\.B)\.)\s+/)
                    .map(s => `<span class="sent">${VL.esc(s)}</span>`).join(' ');
            } else {
                el.textContent = value;
            }
        });
        scope.querySelectorAll('[data-t-attr]').forEach(el => {
            el.getAttribute('data-t-attr').split(';').forEach(pair => {
                const [attr, key] = pair.split(':').map(s => s && s.trim());
                if (!attr || !key) return;
                const value = VL.t(key, VL.vars);
                if (typeof value === 'string') el.setAttribute(attr, value);
            });
        });
        const titleKey = document.body.getAttribute('data-title');
        if (titleKey) {
            const title = VL.t(titleKey);
            if (typeof title === 'string') document.title = title;
        }
    };

    // ----- Language -----
    function initLanguage() {
        const select = document.getElementById('langSelect');
        const code = document.getElementById('langCode');
        if (!select) return;

        const sync = () => {
            select.value = VL.lang();
            if (code) code.textContent = VL.lang().toUpperCase();
        };
        sync();

        select.addEventListener('change', () => VL.setLanguage(select.value));
        window.addEventListener('languageChanged', sync);
    }

    VL.setLanguage = function (lang) {
        if (hasI18n) {
            I18n.setLanguage(lang);
        } else {
            try { localStorage.setItem('virtuallab_language', lang); } catch (e) { /* storage unavailable */ }
            window.location.reload();
        }
    };

    // ----- Theme -----
    function initTheme() {
        const button = document.getElementById('themeToggle');
        const root = document.documentElement;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const current = () => root.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
        const metas = document.querySelectorAll('meta[name="theme-color"]');

        const sync = () => {
            const dark = current() === 'dark';
            if (button) button.setAttribute('aria-pressed', String(dark));
            metas.forEach(m => m.setAttribute('content', dark ? '#0D0F13' : '#F4F0E6'));
        };

        if (button) {
            button.addEventListener('click', () => {
                const next = current() === 'dark' ? 'light' : 'dark';
                root.setAttribute('data-theme', next);
                try { localStorage.setItem('virtuallab_theme', next); } catch (e) { /* storage unavailable */ }
                sync();
            });
        }
        if (media.addEventListener) media.addEventListener('change', sync);
        sync();
    }

    // ----- Header -----
    function initHeader() {
        const header = document.querySelector('.site-header');
        if (!header) return;
        const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    // ----- Scroll reveal -----
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer = null;

    VL.reveal = function (root) {
        const items = (root || document).querySelectorAll('[data-reveal]:not(.is-in)');
        if (!('IntersectionObserver' in window) || reduceMotion.matches) {
            items.forEach(el => el.classList.add('is-in'));
            return;
        }
        if (!observer) {
            observer = new IntersectionObserver(entries => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-in');
                    observer.unobserve(entry.target);
                });
            }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
        }
        items.forEach(el => observer.observe(el));
    };

    VL.reducedMotion = () => reduceMotion.matches;

    // ----- Render cycle -----
    function render() {
        VL.applyText();
        document.dispatchEvent(new CustomEvent('vl:render', { detail: { lang: VL.lang() } }));
        VL.reveal();
    }

    // Registered after i18n.js, so I18n.init() has already run when this fires.
    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        initLanguage();
        initHeader();
        render();
        document.documentElement.classList.add('vl-ready');
    });
    window.addEventListener('languageChanged', render);
})();
