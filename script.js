import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 1. Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyBrvdknWfFKdl9Bn8TJRrpWEc2RQDEHZqE",
    authDomain: "eggshop-702f6.firebaseapp.com",
    projectId: "eggshop-702f6",
    storageBucket: "eggshop-702f6.firebasestorage.app",
    messagingSenderId: "290586261198",
    appId: "1:290586261198:web:61cd80463c8c2c5f06429f",
    measurementId: "G-HVJKWCER6S"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Global variable to track who is logged in
let currentUser = null;

// Translation Dictionary
const translations = {
    en: {
        brandName: "EggMaster", navHome: "Home", navShop: "Shop", navSettings: "Settings",
        heroTitle: "Fresh Eggs", heroSubtitle: "Directly from the farm",
        myOrders: "My Orders", noOrders: "No orders found for this account.",
        setLanguage: "Language", setTheme: "Dark Mode", logout: "Logout",
        buyNow: "Order Now", statOrders: "Orders", statMember: "Member"
    },
    sw: {
        brandName: "Bwana Mayai", navHome: "Mwanzo", navShop: "Duka", navSettings: "Mipangilio",
        heroTitle: "Mayai Safi", heroSubtitle: "Kutoka shambani",
        myOrders: "Oda Zangu", noOrders: "Huna oda kwa akaunti hii.",
        setLanguage: "Lugha", setTheme: "Giza", logout: "Ondoka",
        buyNow: "Agiza Sasa", statOrders: "Oda", statMember: "Mwanachama"
    }
};

// --- AUTHENTICATION STATE OBSERVER ---
onAuthStateChanged(auth, (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    
    if (user) {
        // USER LOGGED IN
        console.log("Logged in as: ", user.email);
        currentUser = user; // Set the global user variable
        
        // Hide Login Screen
        loginOverlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        
        // Update Profile Pic
        const profileDiv = document.querySelector('.user-profile');
        if(profileDiv) profileDiv.innerHTML = `<img src="${user.photoURL}" style="width:35px; border-radius:50%; border: 2px solid #fab1a0">`;
        
        // Load their specific settings and stats
        loadUserSettings();
        updateOrderCount(); 
        
    } else {
        // USER LOGGED OUT
        console.log("User logged out");
        currentUser = null;
        
        // Clear old data from screen immediately
        document.getElementById('ordersList').innerHTML = "";
        document.getElementById('orderCount').innerText = "0";
        
        // Show Login Screen
        loginOverlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

// --- WINDOW FUNCTIONS (ACCESSIBLE FROM HTML) ---

window.loginWithGoogle = () => {
    signInWithPopup(auth, provider).catch(err => alert("Login Error: " + err.message));
};

window.logoutUser = () => {
    // 1. Sign out from Firebase
    signOut(auth).then(() => {
        // 2. Force page reload to clear ALL memory/variables
        location.reload(); 
    });
};

window.showPage = (pageId, element) => {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    // Show target page
    document.getElementById(pageId).classList.add('active');
    if(element) element.classList.add('active');
    
    // If opening Orders page, fetch fresh data
    if(pageId === 'orders') {
        renderOrders();
    }
};

window.placeOrder = (name, price) => {
    if(!currentUser) {
        alert("You must be logged in to order.");
        return;
    }
    
    // 1. Generate Key unique to this specific email
    const userKey = `orders_${currentUser.email}`;
    
    // 2. Fetch current list for THIS user only
    let userOrders = JSON.parse(localStorage.getItem(userKey)) || [];
    
    // 3. Add new order
    const newOrder = {
        id: '#' + Math.floor(1000 + Math.random() * 9000),
        item: name,
        price: price,
        status: 'Processing',
        date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString()
    };

    userOrders.push(newOrder);
    
    // 4. Save back to the specific user key
    localStorage.setItem(userKey, JSON.stringify(userOrders));
    
    updateOrderCount();
    alert(`Order placed for ${currentUser.email}!`);
};

window.changeLanguage = (lang) => {
    localStorage.setItem('lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = translations[lang][key] || key;
    });
};

window.toggleTheme = () => {
    const isDark = document.getElementById('themeToggle').checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

// --- HELPER FUNCTIONS ---

function renderOrders() {
    const list = document.getElementById('ordersList');
    
    // SAFETY CHECK: If no user, show nothing
    if(!currentUser) {
        list.innerHTML = "";
        return;
    }

    // 1. Get Key for CURRENT user
    const userKey = `orders_${currentUser.email}`;
    
    // 2. Fetch Data
    const userOrders = JSON.parse(localStorage.getItem(userKey)) || [];
    
    console.log(`Rendering orders for ${currentUser.email}:`, userOrders); // Debugging

    if (userOrders.length === 0) {
        list.innerHTML = `<p class="empty-msg" style="padding:20px; text-align:center;">No orders found for <b>${currentUser.email}</b>.</p>`;
        return;
    }
    
    // 3. Draw List
    list.innerHTML = userOrders.map(o => `
        <div class="order-item" style="background:var(--card); margin-bottom:10px; padding:15px; border-radius:10px; display:flex; justify-content:space-between; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div>
                <strong>${o.item}</strong><br>
                <small style="color:gray">${o.date}</small><br>
                <small style="color:#fab1a0">${o.id}</small>
            </div>
            <div style="text-align:right">
                <p style="font-weight:bold">Ksh ${o.price}</p>
                <span class="status-pill" style="background:#55efc4; font-size:10px; padding:4px 8px; border-radius:5px; color:#006266">${o.status}</span>
            </div>
        </div>
    `).reverse().join('');
}

function updateOrderCount() {
    if(!currentUser) return;
    const userKey = `orders_${currentUser.email}`;
    const userOrders = JSON.parse(localStorage.getItem(userKey)) || [];
    const countEl = document.getElementById('orderCount');
    if(countEl) countEl.innerText = userOrders.length;
}

function loadUserSettings() {
    const savedLang = localStorage.getItem('lang') || 'en';
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    if(savedTheme === 'dark') {
        const toggle = document.getElementById('themeToggle');
        if(toggle) toggle.checked = true;
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    
    window.changeLanguage(savedLang);
    const langSelect = document.getElementById('langSelect');
    if(langSelect) langSelect.value = savedLang;
}

// Bind click events if window functions fail (Backup)
const googleBtn = document.getElementById('google-login-btn');
if(googleBtn) googleBtn.addEventListener('click', window.loginWithGoogle);
