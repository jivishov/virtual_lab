// ===== ABOUT PAGE I18N HELPER =====
// Dynamically updates about page content based on current language

function renderAboutPage() {
    if (typeof I18n === 'undefined') return;

    const about = I18n.getAll('about');
    if (!about || !about.sections) return;

    // Update sections that don't have data-i18n attributes yet
    updateSection('technical', about.sections.technical);
    updateSection('classroom', about.sections.classroom);
    updateSection('multilingual', about.sections.multilingual);
    updateSection('author', about.sections.author);
    updateSection('opensource', about.sections.opensource);
    updateSection('future', about.sections.future);
    updateSection('contact', about.sections.contact);
}

function updateSection(sectionName, sectionData) {
    if (!sectionData) return;

    // Find section by matching heading text or data attribute
    const sections = document.querySelectorAll('.about-section');
    let targetSection = null;

    sections.forEach(section => {
        const heading = section.querySelector('h2');
        if (heading && (
            heading.textContent.includes(getSectionKeyword(sectionName)) ||
            heading.getAttribute('data-section') === sectionName
        )) {
            targetSection = section;
            heading.setAttribute('data-section', sectionName);
        }
    });

    if (!targetSection) return;

    // Update heading
    const heading = targetSection.querySelector('h2');
    if (heading && sectionData.title) {
        heading.textContent = sectionData.title;
    }

    // Update content paragraphs
    const paragraphs = targetSection.querySelectorAll('p:not(.contact-link):not(.disclaimer)');
    if (sectionData.content) {
        if (paragraphs[0]) paragraphs[0].textContent = sectionData.content;
    }
    if (sectionData.content1) {
        if (paragraphs[0]) paragraphs[0].textContent = sectionData.content1;
    }
    if (sectionData.content2) {
        if (paragraphs[1]) paragraphs[1].textContent = sectionData.content2;
    }
    if (sectionData.content3) {
        // For opensource section, update the text before GitHub link
        const githubParagraph = targetSection.querySelector('p:nth-of-type(3)');
        if (githubParagraph) {
            const githubLink = githubParagraph.querySelector('a');
            if (githubLink) {
                githubParagraph.childNodes[0].textContent = sectionData.content3 + ' ';
            }
        }
    }

    // Update lists
    if (sectionData.list && Array.isArray(sectionData.list)) {
        const list = targetSection.querySelector('.feature-list');
        if (list) {
            const items = list.querySelectorAll('li');
            sectionData.list.forEach((text, index) => {
                if (items[index]) {
                    items[index].textContent = text;
                }
            });
        }
    }

    // Update disclaimer
    if (sectionData.disclaimer) {
        const disclaimer = targetSection.querySelector('.disclaimer');
        if (disclaimer) {
            disclaimer.textContent = sectionData.disclaimer;
        }
    }

    // Update special links
    updateButtonText();
}

function updateButtonText() {
    const buttons = I18n.getAll('buttons');
    if (!buttons) return;

    const linkedInButton = document.querySelector('.cta-link[href*="linkedin"]');
    if (linkedInButton && buttons.connectLinkedIn) {
        linkedInButton.innerHTML = buttons.connectLinkedIn + ' →';
    }

    const backButton = document.querySelector('.cta-link[href="index.html"]');
    if (backButton && buttons.backToLabs) {
        backButton.innerHTML = '← ' + buttons.backToLabs;
    }
}

function getSectionKeyword(sectionName) {
    const keywords = {
        'technical': 'Technical',
        'classroom': 'Classroom',
        'multilingual': 'Multilingual',
        'author': 'Author',
        'opensource': 'Open Source',
        'future': 'Future',
        'contact': 'Touch'
    };
    return keywords[sectionName] || '';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    renderAboutPage();
});

// Listen for language changes
if (typeof window !== 'undefined') {
    window.addEventListener('languageChanged', function() {
        // Need to wait a bit for I18n to update
        setTimeout(renderAboutPage, 50);
    });
}
