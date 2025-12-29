// ===== REUSABLE HEADER COMPONENT =====
// This file provides a consistent header across all pages
// Simply include this script in any HTML page to get the header

function renderHeader(currentPage = 'home') {
    const headerHTML = `
        <div class="container">
            <div class="header-content">
                <div class="header-left">
                    <a href="https://virtuallab.az" class="header-brand" title="Virtual Laboratory">
                        <div class="header-icon">🔬</div>
                        <div class="header-text">
                            <h1 class="main-title">Virtual Laboratory</h1>
                            <p class="subtitle">Interactive science experiments and simulations for hands-on learning</p>
                        </div>
                    </a>
                </div>
                <div class="header-right">
                    <nav class="header-nav">
                        <a href="index.html" class="header-nav-link ${currentPage === 'home' ? 'active' : ''}">Home</a>
                        <a href="about.html" class="header-nav-link ${currentPage === 'about' ? 'active' : ''}">About</a>
                    </nav>
                    <div class="header-stats">
                        <div class="header-stat">
                            <span class="header-stat-number">3</span>
                            <span class="header-stat-label">Labs</span>
                        </div>
                        <div class="header-stat">
                            <span class="header-stat-number">1</span>
                            <span class="header-stat-label">Simulations</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const headerElement = document.querySelector('.header');
    if (headerElement) {
        headerElement.innerHTML = headerHTML;
    }
}

// Auto-render on page load
document.addEventListener('DOMContentLoaded', function() {
    // Detect current page from URL
    const currentPage = window.location.pathname.includes('about') ? 'about' : 'home';
    renderHeader(currentPage);
});
