// ===================================
// MISSION: IMPOSSIBLE - LAB SAFETY
// Teacher setup — builds the class link
//
// The whole mechanism is one query parameter. The value of this page is that a
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

    const pdf = window.certificatePdf;

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
        return baseUrl + '?instructor=' + encodeURIComponent(name);
    }

    function describeProblems(raw, rendered) {
        const problems = [];

        if (rendered !== raw) {
            // pdfSanitize drops anything above Latin-1. Vietnamese, Polish and
            // Turkish names lose letters silently, and today a teacher would
            // only find out from a student's finished PDF.
            const lost = [...raw].filter(ch => !rendered.includes(ch));
            const unique = [...new Set(lost)].join(' ');
            problems.push(
                `The certificate cannot print ${unique ? `“${unique}”` : 'some characters'}, ` +
                `so it will read “${rendered}”. Try the nearest spelling in plain letters.`
            );
        }

        if (measurer && measurer.measure(rendered, SIG_SIZE, SIG_FONT) > SIG_WIDTH) {
            problems.push('That is too long for the signature line — it will run past it. Try a shorter form, such as an initial instead of a first name.');
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
            copyState.textContent = 'Copied. Paste it wherever you post work.';
            return;
        } catch (e) {
            // Clipboard API needs a secure context, and district-managed
            // browsers are not always on one. Fall back rather than fail.
        }

        try {
            linkInput.select();
            linkInput.setSelectionRange(0, value.length);
            copyState.textContent = document.execCommand('copy')
                ? 'Copied. Paste it wherever you post work.'
                : 'Press Ctrl+C (Cmd+C on a Mac) to copy the selected link.';
        } catch (e) {
            copyState.textContent = 'Select the link above and copy it.';
        }
    }

    function previewPdf() {
        if (!pdf) return;
        const name = nameInput.value.trim();
        // Representative sample data — a pass in the top band, so the teacher
        // sees the seal and signature line as a successful student would.
        const bytes = pdf.buildCertificatePdf({
            passed: true,
            name: 'SAMPLE STUDENT',
            percent: 90,
            rank: 'Field Agent',
            tier: 'RECRUIT',
            correct: 9,
            total: 10,
            instructor: name,
            date: new Date().toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric'
            }),
            badges: [],
            stats: [
                { value: '90%', label: 'Success rate' },
                { value: '9/10', label: 'Protocols passed' },
                { value: 'RECRUIT', label: 'Clearance' }
            ],
            body: []
        });
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        window.open(url, '_blank', 'noopener');
        // Give the new tab time to take the handle before releasing it.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    nameInput.addEventListener('input', update);
    copyBtn.addEventListener('click', copyLink);
    previewPdfBtn.addEventListener('click', previewPdf);

    // Coming back with a link already in hand? Prefill from it, so the page
    // doubles as a way to check what an existing link actually says.
    const existing = (new URLSearchParams(window.location.search).get('instructor') || '').trim();
    if (existing) nameInput.value = existing;

    update();
    nameInput.focus();
})();
