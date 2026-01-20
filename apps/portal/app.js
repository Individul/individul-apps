/*
    Portal - JavaScript

    Sets the current year in the footer.
*/

(function() {
    'use strict';

    function initCurrentYear() {
        const yearElement = document.getElementById('current-year');
        if (yearElement) {
            yearElement.textContent = new Date().getFullYear();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCurrentYear);
    } else {
        initCurrentYear();
    }
})();
