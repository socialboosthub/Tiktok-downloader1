// --- TRANSLATIONS DICTIONARY ---
const translations = {
    en: {
        brandName: "EggMaster",
        navHome: "Home",
        navShop: "Shop",
        navSettings: "Settings",
        heroTitle: "Fresh Eggs, Delivered Daily",
        heroSubtitle: "From our farm to your frying pan.",
        shopNow: "Shop Now",
        featDelivery: "Fast Delivery",
        featOrganic: "100% Organic",
        shopTitle: "Our Products",
        prodTray: "Tray of 30",
        prodDozen: "Dozen (12)",
        prodKienyeji: "Kienyeji (Tray)",
        addToCart: "Add to Cart",
        settingsTitle: "Settings",
        setLanguage: "Language",
        setTheme: "Appearance",
        themeLight: "Light",
        themeDark: "Dark"
    },
    sw: {
        brandName: "EggMaster",
        navHome: "Nyumbani",
        navShop: "Duka",
        navSettings: "Mipangilio",
        heroTitle: "Mayai Safi, Kwa Wakati",
        heroSubtitle: "Kutoka shambani mwetu hadi jikoni kwako.",
        shopNow: "Nunua Sasa",
        featDelivery: "Uwasilishaji wa Haraka",
        featOrganic: "Asilia 100%",
        shopTitle: "Bidhaa Zetu",
        prodTray: "Trei (30)",
        prodDozen: "Dazeni (12)",
        prodKienyeji: "Kienyeji (Trei)",
        addToCart: "Weka kwa Kikapu",
        settingsTitle: "Mipangilio",
        setLanguage: "Lugha",
        setTheme: "Muonekano",
        themeLight: "Mwanga",
        themeDark: "Giza"
    }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    if(savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('themeToggle').checked = true;
    }

    // 2. Load saved language
    const savedLang = localStorage.getItem('lang') || 'en';
    document.getElementById('languageSelect').value = savedLang;
    updateText(savedLang);
});

// --- NAVIGATION LOGIC ---
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    // Show selected page
    document.getElementById(pageId).classList.add('active');
}

// --- SETTINGS LOGIC ---

// 1. Change Language
function changeLanguage(lang) {
    localStorage.setItem('lang', lang);
    updateText(lang);
}

// Helper to update text on screen
function updateText(lang) {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });
}

// 2. Toggle Dark/Light Mode
function toggleTheme() {
    const checkbox = document.getElementById('themeToggle');
    if (checkbox.checked) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    }
}
