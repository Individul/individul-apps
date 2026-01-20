/*
 * Landing Page Scripts - Dumitru Apps
 *
 * CONFIGURATION:
 * Set the current year in copyright automatically.
 * Optional: Dark mode toggle (can be added to header if needed).
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
    // URLs for applications (matches hrefs in index.html)
    CLASSIFICARE_URL: '/clasificare/',
    PDF_URL: '/pdf/',

    // Brand name
    BRAND_NAME: 'Dumitru Apps'
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initCurrentYear();
    initSmoothScroll();
    initKeyboardNavigation();
});

// ============================================================================
// CURRENT YEAR
// ============================================================================

function initCurrentYear() {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }
}

// ============================================================================
// SMOOTH SCROLL
// ============================================================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const href = anchor.getAttribute('href');
            if (href === '#' || href === '#about' || href === '#status' ||
                href === '#clasificare-details' || href === '#pdf-details') {
                e.preventDefault();
                // For now, these are placeholder links
                console.log('Navigation to:', href);
            }
        });
    });
}

// ============================================================================
// KEYBOARD NAVIGATION
// ============================================================================

function initKeyboardNavigation() {
    // Add keyboard shortcuts for quick access
    document.addEventListener('keydown', (e) => {
        // Alt+1: Go to Clasificare
        if (e.altKey && e.key === '1') {
            window.location.href = CONFIG.CLASSIFICARE_URL;
        }
        // Alt+2: Go to PDF Toolbox
        if (e.altKey && e.key === '2') {
            window.location.href = CONFIG.PDF_URL;
        }
    });
}

// ============================================================================
// OPTIONAL: DARK MODE TOGGLE
// ============================================================================

// Uncomment below to add dark mode toggle functionality
// You would need to add a toggle button to the header in index.html

/*
function initDarkMode() {
    const toggle = document.getElementById('dark-mode-toggle');
    if (!toggle) return;

    // Check for saved preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.documentElement.classList.add('dark');
    }

    toggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}

// Call this in DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initCurrentYear();
    initSmoothScroll();
    initKeyboardNavigation();
    initDarkMode();
});
*/
