// Virtual Labs Data
const labs = [
    {
        id: 1,
        title: "Spectrophotometry: Blue Dye Analysis",
        description: "Determine the concentration of blue dye in a sports drink using spectrophotometry techniques. Learn about Beer's Law and calibration curves.",
        type: "lab",
        icon: "🔬",
        tags: ["Spectrophotometry", "Chemistry", "Analytical"],
        link: "#" // Replace with actual link when available
    },
    {
        id: 2,
        title: "DNA Microarray",
        description: "Explore gene expression analysis using DNA microarray technology. Understand how genetic information is analyzed and interpreted.",
        type: "lab",
        icon: "🧬",
        tags: ["Genetics", "Molecular Biology", "DNA"],
        link: "#" // Replace with actual link when available
    },
    {
        id: 3,
        title: "Copper in Brass Analysis",
        description: "Determine the amount of copper in a brass sample using spectrophotometric methods. Apply quantitative analysis techniques.",
        type: "lab",
        icon: "⚗️",
        tags: ["Spectrophotometry", "Chemistry", "Metals"],
        link: "#" // Replace with actual link when available
    },
    {
        id: 4,
        title: "Nuclear Chemistry Game",
        description: "Interactive simulation exploring nuclear reactions, radioactive decay, and nuclear chemistry principles through engaging gameplay.",
        type: "simulation",
        icon: "⚛️",
        tags: ["Nuclear Chemistry", "Physics", "Game"],
        link: "#" // Replace with actual link when available
    }
];

// Create lab card HTML
function createLabCard(lab) {
    const card = document.createElement('div');
    card.className = 'lab-card';
    card.setAttribute('data-id', lab.id);

    const headerClass = lab.type === 'simulation' ? 'lab-card-header simulation' : 'lab-card-header';
    const buttonClass = lab.type === 'simulation' ? 'launch-button simulation-btn' : 'launch-button';
    const badgeText = lab.type === 'simulation' ? 'Simulation' : 'Virtual Lab';

    const tagsHTML = lab.tags.map(tag => `<span class="tag">${tag}</span>`).join('');

    card.innerHTML = `
        <div class="${headerClass}">
            <span class="lab-type-badge">${badgeText}</span>
            <div>
                <div class="lab-icon">${lab.icon}</div>
                <h3 class="lab-card-title">${lab.title}</h3>
            </div>
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
    labsGrid.innerHTML = '';

    labs.forEach(lab => {
        const card = createLabCard(lab);
        labsGrid.appendChild(card);
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
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
