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

// Virtual Labs Data
const labs = [
    {
        id: 1,
        title: "Spectrophotometry: Blue Dye Analysis",
        description: "Determine the concentration of blue dye in a sports drink using spectrophotometry techniques. Learn about Beer's Law and calibration curves.",
        type: "lab",
        icon: "🔬",
        tags: ["Spectrophotometry", "Chemistry", "Analytical"],
        link: "experiments/spectrophotometry/" // Replace with actual link when available
    },
    {
        id: 2,
        title: "DNA Microarray",
        description: "Explore gene expression analysis using DNA microarray technology. Understand how genetic information is analyzed and interpreted.",
        type: "lab",
        icon: "🧬",
        tags: ["Genetics", "Molecular Biology", "DNA"],
        link: "experiments/dnamicroarray/" // Replace with actual link when available
    },
    {
        id: 3,
        title: "Copper in Brass Analysis",
        description: "Determine the amount of copper in a brass sample using spectrophotometric methods. Apply quantitative analysis techniques.",
        type: "lab",
        icon: "⚗️",
        tags: ["Spectrophotometry", "Chemistry", "Metals"],
        link: "experiments/copperinbrass/" // Replace with actual link when available
    },
    {
        id: 4,
        title: "Nuclear Chemistry Game",
        description: "Interactive simulation exploring nuclear reactions, radioactive decay, and nuclear chemistry principles through engaging gameplay.",
        type: "simulation",
        icon: "⚛️",
        tags: ["Nuclear Chemistry", "Physics", "Game"],
        link: "simulations/nuclearchemistry/" // Replace with actual link when available
    },
    {
        id: 5,
        title: "Mission: Impossible - Lab Safety Protocol",
        description: "Accept your mission and navigate through 10 high-stakes laboratory scenarios. Master critical safety protocols in this immersive spy-themed training simulation with realistic animations.",
        type: "simulation",
        icon: "🎬",
        tags: ["Lab Safety", "Training", "Interactive"],
        link: "simulations/lab-safety-mi/"
    }
];

// Create lab card HTML
function createLabCard(lab) {
    const card = document.createElement('div');
    card.className = 'lab-card';
    card.setAttribute('data-id', lab.id);

    const headerClass = lab.type === 'simulation' ? 'lab-card-header simulation' : 'lab-card-header';
    const buttonClass = lab.type === 'simulation' ? 'launch-button simulation-btn' : 'launch-button';

    const tagsHTML = lab.tags.map(tag => `<span class="tag">${tag}</span>`).join('');

    card.innerHTML = `
        <div class="${headerClass}">
            <div class="lab-icon">${lab.icon}</div>
            <h3 class="lab-card-title">${lab.title}</h3>
        </div>
        <div class="lab-card-body">
            <p class="lab-card-description">${lab.description}</p>
            <div class="lab-card-tags">
                ${tagsHTML}
            </div>
        </div>
        <div class="lab-card-footer">
            <button class="${buttonClass}" onclick="launchLab(${lab.id})">
                <span>Launch ${lab.type === 'simulation' ? 'Simulation' : 'Lab'}</span>
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

    // Clear default slide when we have images
    slider.innerHTML = '';

    let currentSlide = 0;
    const slides = [];

    // Create slides for each image
    heroImages.forEach((imagePath, index) => {
        const slide = document.createElement('div');
        slide.className = 'hero-slide';
        if (index === 0) slide.classList.add('active');
        slide.style.backgroundImage = `url('${imagePath}')`;

        slide.innerHTML = `
            <div class="hero-content">
                <h2 class="hero-title">Welcome to Your Learning Space</h2>
                <p class="hero-description">Explore scientific concepts through interactive simulations designed for educational excellence.</p>
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

    // Add a subtle parallax effect to the header (optional)
    window.addEventListener('scroll', function() {
        const header = document.querySelector('.header');
        const scrollPosition = window.pageYOffset;
        if (header && scrollPosition < 500) {
            header.style.transform = `translateY(${scrollPosition * 0.5}px)`;
            header.style.opacity = 1 - (scrollPosition / 500);
        }
    });
});

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
