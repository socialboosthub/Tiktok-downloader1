const translations = {
    en: {
        brandName: "EggMaster", navHome: "Home", navShop: "Shop", navSettings: "Settings",
        heroTitle: "Fresh Eggs", heroSubtitle: "Directly from the farm",
        myOrders: "My Orders", noOrders: "No orders yet.",
        setLanguage: "Language", setTheme: "Dark Mode", logout: "Logout",
        buyNow: "Order Now", statOrders: "Orders", statMember: "Member",
        statusProcess: "Processing"
    },
    sw: {
        brandName: "Bwana Mayai", navHome: "Mwanzo", navShop: "Duka", navSettings: "Mipangilio",
        heroTitle: "Mayai Safi", heroSubtitle: "Kutoka shambani",
        myOrders: "Oda Zangu", noOrders: "Huna oda yoyote.",
        setLanguage: "Lugha", setTheme: "Giza", logout: "Ondoka",
        buyNow: "Agiza Sasa", statOrders: "Oda", statMember: "Mwanachama",
        statusProcess: "Inashughulikiwa"
    }
};

let orders = JSON.parse(localStorage.getItem('myOrders')) || [];

function showPage(pageId, element) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    element.classList.add('active');
    if(pageId === 'orders') renderOrders();
}

function placeOrder(name, price) {
    const newOrder = {
        id: '#' + Math.floor(Math.random() * 9000),
        item: name,
        price: price,
        status: 'Processing',
        date: new Date().toLocaleDateString()
    };
    orders.push(newOrder);
    localStorage.setItem('myOrders', JSON.stringify(orders));
    updateStats();
    alert("Order Placed Successfully!");
}

function renderOrders() {
    const list = document.getElementById('ordersList');
    if (orders.length === 0) return;
    
    list.innerHTML = orders.map(o => `
        <div class="order-item">
            <div>
                <strong>${o.item}</strong><br>
                <small>${o.date} | ${o.id}</small>
            </div>
            <div>
                <p>Ksh ${o.price}</p>
                <span class="status-pill">${o.status}</span>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('orderCount').innerText = orders.length;
}

function changeLanguage(lang) {
    localStorage.setItem('lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = translations[lang][key] || key;
    });
}

function toggleTheme() {
    const isDark = document.getElementById('themeToggle').checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Init
window.onload = () => {
    updateStats();
    const savedLang = localStorage.getItem('lang') || 'en';
    const savedTheme = localStorage.getItem('theme') || 'light';
    if(savedTheme === 'dark') {
        document.getElementById('themeToggle').checked = true;
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    changeLanguage(savedLang);
    document.getElementById('langSelect').value = savedLang;
};
