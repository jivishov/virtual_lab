// ===== HERO SLIDER CONFIGURATION =====
// To add images to the hero slider, simply add image paths to this array
// Images should be placed in the same directory as this file or use absolute paths
// Example: 'hero1.jpg', 'hero2.jpg', etc.
const heroImages = [
    // Add your image paths here
    'images/spectrophotom.jpg',
    'images/dnamicroarray.jpg',
    'images/nuclearrxn.jpg',
    'images/safetyquiz.jpg',
];

// Virtual Labs Data - now uses translation keys
const labs = [
    {
        id: 1,
        translationKey: "spectrophotometry",
        type: "lab",
        icon: "🔬",
        link: "experiments/spectrophotometry/"
    },
    {
        id: 2,
        translationKey: "dnamicroarray",
        type: "lab",
        icon: "🧬",
        link: "experiments/dnamicroarray/"
    },
    {
        id: 3,
        translationKey: "copperinbrass",
        type: "lab",
        icon: "⚗️",
        link: "experiments/copperinbrass/"
    },
    {
        id: 4,
        translationKey: "nuclearchemistry",
        type: "simulation",
        icon: "⚛️",
        link: "simulations/nuclearchemistry/"
    },
    {
        id: 5,
        translationKey: "labsafety",
        type: "simulation",
        icon: "🥽",
        link: "simulations/lab-safety-mi/"
    },
    {
        id: 6,
        translationKey: "gaslaws",
        type: "simulation",
        icon: "💨",
        link: "simulations/gassimulation/"
    }
];

// Create lab card HTML
function createLabCard(lab) {
    const card = document.createElement('div');
    card.className = 'lab-card';
    card.setAttribute('data-id', lab.id);

    // Get translations
    const t = (key) => (typeof I18n !== 'undefined') ? I18n.translate(key) : key;
    const labData = (typeof I18n !== 'undefined') ? I18n.translate(`labs.${lab.translationKey}`) : {};

    const title = labData.title || lab.translationKey;
    const description = labData.description || '';
    const tags = labData.tags || [];

    const headerClass = lab.type === 'simulation' ? 'lab-card-header simulation' : 'lab-card-header';
    const buttonClass = lab.type === 'simulation' ? 'launch-button simulation-btn' : 'launch-button';

    const tagsHTML = tags.map(tag => `<span class="tag">${tag}</span>`).join('');
    const buttonText = lab.type === 'simulation' ? t('buttons.launchSimulation') : t('buttons.launchLab');

    card.innerHTML = `
        <div class="${headerClass}">
            <div class="lab-icon">${lab.icon}</div>
            <h3 class="lab-card-title">${title}</h3>
        </div>
        <div class="lab-card-body">
            <p class="lab-card-description">${description}</p>
            <div class="lab-card-tags">
                ${tagsHTML}
            </div>
        </div>
        <div class="lab-card-footer">
            <button class="${buttonClass}" onclick="launchLab(${lab.id})">
                <span>${buttonText}</span>
                <span>→</span>
            </button>
        </div>
    `;

    return card;
}

// Render all lab cards
function renderLabs() {
    const labsGrid = document.getElementById('labsGrid');
    const simulationsGrid = document.getElementById('simulationsGrid');

    labsGrid.innerHTML = '';
    simulationsGrid.innerHTML = '';

    // Separate labs and simulations
    const labItems = labs.filter(lab => lab.type === 'lab');
    const simulationItems = labs.filter(lab => lab.type === 'simulation');

    // Render labs
    labItems.forEach(lab => {
        const card = createLabCard(lab);
        labsGrid.appendChild(card);
    });

    // Render simulations
    simulationItems.forEach(lab => {
        const card = createLabCard(lab);
        simulationsGrid.appendChild(card);
    });
}

// Launch lab function
function launchLab(labId) {
    const lab = labs.find(l => l.id === labId);

    if (!lab) {
        console.error('Lab not found');
        return;
    }

    // If the link is set to '#', show an alert (for demo purposes)
    if (lab.link === '#') {
        alert(`${lab.title} will be available soon!\n\nThis is where the virtual lab would launch. Update the 'link' property in the labs array to point to your actual lab files.`);
        return;
    }

    // Navigate to the lab
    window.location.href = lab.link;
}

// Add smooth scroll behavior
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add keyboard navigation for lab cards
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const focusedCard = document.activeElement.closest('.lab-card');
        if (focusedCard) {
            const button = focusedCard.querySelector('.launch-button');
            if (button) {
                button.click();
            }
        }
    }
});

// Make cards keyboard accessible
function makeCardsAccessible() {
    const cards = document.querySelectorAll('.lab-card');
    cards.forEach(card => {
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');
        card.addEventListener('click', function(e) {
            if (e.target.tagName !== 'BUTTON') {
                const button = this.querySelector('.launch-button');
                if (button) {
                    button.click();
                }
            }
        });
    });
}

// ===== HERO SLIDER FUNCTIONALITY =====
function initHeroSlider() {
    const slider = document.querySelector('.hero-slider');
    const dotsContainer = document.getElementById('sliderDots');

    if (!slider || heroImages.length === 0) {
        // No images configured, hide dots
        if (dotsContainer) {
            dotsContainer.style.display = 'none';
        }
        return;
    }

    // Clear existing slides and dots to prevent duplication on language change
    slider.innerHTML = '';
    dotsContainer.innerHTML = '';

    let currentSlide = 0;
    const slides = [];

    // Create slides for each image
    heroImages.forEach((imagePath, index) => {
        const slide = document.createElement('div');
        slide.className = 'hero-slide';
        if (index === 0) slide.classList.add('active');
        slide.style.backgroundImage = `url('${imagePath}')`;

        // Get translations
        const t = (key) => (typeof I18n !== 'undefined') ? I18n.translate(key) : '';

        slide.innerHTML = `
            <div class="hero-content">
                <h2 class="hero-title" data-i18n="hero.title">${t('hero.title') || 'Welcome to Your Learning Space'}</h2>
                <p class="hero-description" data-i18n="hero.description">${t('hero.description') || 'Explore scientific concepts through interactive simulations designed for educational excellence.'}</p>
            </div>
        `;

        slider.appendChild(slide);
        slides.push(slide);

        // Create dot
        const dot = document.createElement('div');
        dot.className = 'slider-dot';
        if (index === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(index));
        dotsContainer.appendChild(dot);
    });

    const dots = dotsContainer.querySelectorAll('.slider-dot');

    function goToSlide(index) {
        slides[currentSlide].classList.remove('active');
        dots[currentSlide].classList.remove('active');

        currentSlide = index;

        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
    }

    function nextSlide() {
        goToSlide((currentSlide + 1) % slides.length);
    }

    // Auto-advance slides every 5 seconds
    if (slides.length > 1) {
        setInterval(nextSlide, 5000);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initHeroSlider();
    renderLabs();
    makeCardsAccessible();

    // Header is now fixed, parallax effect removed
});

// Listen for language changes and re-render content
if (typeof window !== 'undefined') {
    window.addEventListener('languageChanged', function() {
        initHeroSlider();
        renderLabs();
        makeCardsAccessible();
    });
}

// Export labs data for easy updates
// To add a new lab, simply add a new object to the labs array above
// Example:
// {
//     id: 5,
//     title: "Your New Lab Title",
//     description: "Description of your new lab",
//     type: "lab", // or "simulation"
//     icon: "🔬", // Choose an appropriate emoji icon
//     tags: ["Tag1", "Tag2", "Tag3"],
//     link: "/path/to/your/lab.html" // Update with actual link
// }
