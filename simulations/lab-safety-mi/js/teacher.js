// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Teacher setup — builds the class link
//
// The whole mechanism is query parameters. The value of this page is that a
// teacher never has to hand-encode one, and gets to SEE what their students'
// certificates will say before handing the link out.
//
// Everything here goes through the real PDF pipeline (js/pdf.js) rather than a
// second copy of its rules, so the preview cannot drift from the artefact.
// ===================================

(() => {
    const nameInput = document.getElementById('teacherName');
    const sigPreview = document.getElementById('sigPreview');
    const warning = document.getElementById('nameWarning');
    const linkStep = document.getElementById('linkStep');
    const linkInput = document.getElementById('classLink');
    const copyBtn = document.getElementById('copyBtn');
    const copyState = document.getElementById('copyState');
    const tryLink = document.getElementById('tryLink');
    const previewPdfBtn = document.getElementById('previewPdfBtn');
    const studentLang = document.getElementById('studentLang');
    const backLink = document.getElementById('backLink');

    const pdf = window.certificatePdf;
    const i18n = window.i18n;

    // The signature rule in the PDF runs from block.x - 110 to block.x + 110
    // (js/pdf.js, buildCertificatePdf), drawn at size 13 in the italic display
    // face. Measure against that rather than guessing a character count — the
    // face is proportional, so "Ms. Li" and "Mr. Wojciechowski" are nothing
    // alike at the same length.
    const SIG_WIDTH = 220;
    const SIG_SIZE = 13;
    const SIG_FONT = 'displayIt';

    const measurer = pdf ? new pdf.PdfDoc() : null;

    // Relative to this page, so the link is right on virtuallab.az, on
    // jivishov.github.io/virtual_lab/..., and on localhost alike. Never hardcode
    // a host — the repo is served under two different path shapes.
    const baseUrl = new URL('.', window.location.href).toString();

    function buildLink(name) {
        // encodeURIComponent, not URLSearchParams: the latter serialises spaces
        // as '+'. Both decode correctly, but %20 is what the README documents
        // and it survives being eyeballed in a Google Classroom post.
        let link = baseUrl + '?instructor=' + encodeURIComponent(name);

        // Omitted when the teacher leaves the choice to students, so the link
        // stays as short as it was before this option existed and the student's
        // own browser language still gets a say.
        const lang = studentLang ? studentLang.value : '';
        if (lang) link += '&lang=' + encodeURIComponent(lang);

        return link;
    }

    function describeProblems(raw, rendered) {
        const problems = [];

        if (rendered !== raw) {
            // pdfSanitize drops anything above Latin-1. Vietnamese, Polish and
            // Turkish names lose letters silently, and today a teacher would
            // only find out from a student's finished PDF. Spanish accents and
            // ñ are inside Latin-1, so they survive untouched.
            const lost = [...raw].filter(ch => !rendered.includes(ch));
            const unique = [...new Set(lost)].join(' ');
            problems.push(i18n.t('tp.warnChars', {
                chars: unique ? `“${unique}”` : i18n.t('tp.warnCharsSome'),
                rendered
            }));
        }

        if (measurer && measurer.measure(rendered, SIG_SIZE, SIG_FONT) > SIG_WIDTH) {
            problems.push(i18n.t('tp.warnLong'));
        }

        return problems;
    }

    function update() {
        const raw = nameInput.value.trim();
        const rendered = pdf ? pdf.pdfSanitize(raw) : raw;

        // textContent throughout: the name is arbitrary text from a text field
        // and never markup.
        sigPreview.textContent = rendered;

        if (!raw) {
            linkStep.hidden = true;
            warning.hidden = true;
            warning.textContent = '';
            copyState.textContent = '';
            return;
        }

        const problems = describeProblems(raw, rendered);
        warning.hidden = problems.length === 0;
        warning.textContent = problems.join(' ');

        const link = buildLink(raw);
        linkInput.value = link;
        tryLink.href = link;
        linkStep.hidden = false;
        copyState.textContent = '';
    }

    async function copyLink() {
        const value = linkInput.value;
        if (!value) return;

        try {
            await navigator.clipboard.writeText(value);
            copyState.textContent = i18n.t('tp.copied');
            return;
        } catch (e) {
            // Clipboard API needs a secure context, and district-managed
            // browsers are not always on one. Fall back rather than fail.
        }

        try {
            linkInput.select();
            linkInput.setSelectionRange(0, value.length);
            copyState.textContent = document.execCommand('copy')
                ? i18n.t('tp.copied')
                : i18n.t('tp.copyManual');
        } catch (e) {
            copyState.textContent = i18n.t('tp.copySelect');
        }
    }

    function previewPdf() {
        if (!pdf) return;
        const name = nameInput.value.trim();

        // The preview is rendered in the language the STUDENT will get, not the
        // one the teacher is reading this page in — that is the artefact whose
        // wording they are here to check.
        const previewLang = (studentLang && studentLang.value) || i18n.lang;
        const pageLang = i18n.lang;
        if (previewLang !== pageLang) i18n.setLang(previewLang, { persist: false });

        const tier = i18n.t('tier.recruit');
        const bytes = pdf.buildCertificatePdf({
            passed: true,
            name: i18n.t('tp.sampleStudent'),
            percent: 90,
            rank: i18n.t('rank.90'),
            tier,
            correct: 9,
            total: 10,
            instructor: name,
            date: i18n.formatDate(),
            badges: [],
            stats: [
                { value: '90%', label: i18n.t('cert.successRate') },
                { value: '9/10', label: i18n.t('cert.protocolsPassed') },
                { value: tier, label: i18n.t('cert.clearance') }
            ],
            body: [1, 2, 3].map(n =>
                i18n.t(`cert.bodyPassPdf${n}`, { tier, threshold: 70 })),
            strings: {
                issuer: i18n.t('cert.issuerPdf'),
                title: i18n.t('cert.titlePass'),
                preamble: i18n.t('cert.preamblePass'),
                rankConferred: i18n.t('cert.rankConferred'),
                signatureRole: i18n.t('cert.signatureRolePdf'),
                dateOfIssue: i18n.t('cert.dateOfIssue'),
                footer: i18n.t('cert.footer'),
                bandHonours: i18n.t('cert.bandHonours'),
                filename: i18n.t('cert.filename')
            }
        });

        if (previewLang !== pageLang) i18n.setLang(pageLang, { persist: false });

        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        window.open(url, '_blank', 'noopener');
        // Give the new tab time to take the handle before releasing it.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    i18n.mountLanguageSwitch(document.getElementById('langSwitch'));

    nameInput.addEventListener('input', update);
    copyBtn.addEventListener('click', copyLink);
    previewPdfBtn.addEventListener('click', previewPdf);
    if (studentLang) studentLang.addEventListener('change', update);

    // Re-run on a language change: the warnings and the copy-state line are
    // generated text, not markup the data-i18n sweep can reach.
    i18n.onChange(() => {
        if (backLink) backLink.href = 'index.html?lang=' + i18n.lang;
        update();
    });
    if (backLink) backLink.href = 'index.html?lang=' + i18n.lang;

    // Coming back with a link already in hand? Prefill from it, so the page
    // doubles as a way to check what an existing link actually says.
    const params = new URLSearchParams(window.location.search);
    const existing = (params.get('instructor') || '').trim();
    if (existing) nameInput.value = existing;

    // The ?lang= that brought a teacher here sets the language THEY read, and
    // is deliberately not copied into the dropdown above. Following the link
    // from an English intro screen must not silently produce a class link that
    // forces English on a student whose browser asks for Spanish — the default
    // stays "let students choose" until a teacher picks otherwise on purpose.

    update();
    nameInput.focus();
})();
