import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 1. Your Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBrvdknWfFKdl9Bn8TJRrpWEc2RQDEHZqE",
    authDomain: "eggshop-702f6.firebaseapp.com",
    projectId: "eggshop-702f6",
    storageBucket: "eggshop-702f6.firebasestorage.app",
    messagingSenderId: "290586261198",
    appId: "1:290586261198:web:61cd80463c8c2c5f06429f",
    measurementId: "G-HVJKWCER6S"
};

// 2. Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
let currentUser = null;

const translations = {
    en: {
        brandName: "EggMaster", navHome: "Home", navShop: "Shop", navSettings: "Settings",
        heroTitle: "Fresh Eggs", heroSubtitle: "Directly from the farm",
        myOrders: "My Orders", noOrders: "No orders yet.",
        setLanguage: "Language", setTheme: "Dark Mode", logout: "Logout",
        buyNow: "Order Now", statOrders: "Orders", statMember: "Member"
    },
    sw: {
        brandName: "Bwana Mayai", navHome: "Mwanzo", navShop: "Duka", navSettings: "Mipangilio",
        heroTitle: "Mayai Safi", heroSubtitle: "Kutoka shambani",
        myOrders: "Oda Zangu", noOrders: "Huna oda yoyote.",
        setLanguage: "Lugha", setTheme: "Giza", logout: "Ondoka",
        buyNow: "Agiza Sasa", statOrders: "Oda", statMember: "Mwanachama"
    }
};

// --- AUTH LOGIC ---
onAuthStateChanged(auth, (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (user) {
        currentUser = user;
        loginOverlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        const profileDiv = document.querySelector('.user-profile');
        if(profileDiv) profileDiv.innerHTML = `<img src="${user.photoURL}" style="width:35px; border-radius:50%; border: 2px solid #fab1a0">`;
        loadUserSettings();
        updateOrderCount();
    } else {
        currentUser = null;
        loginOverlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

// --- ATTACHING TO WINDOW (THIS FIXES THE "NOT FUNCTIONING" ISSUE) ---

window.loginWithGoogle = () => {
    signInWithPopup(auth, provider).catch(err => alert("Login Error: " + err.message));
};

window.logoutUser = () => {
    signOut(auth).then(() => {
        localStorage.removeItem('theme'); // Optional: reset on logout
        location.reload();
    });
};

window.showPage = (pageId, element) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    if(element) element.classList.add('active');
    if(pageId === 'orders') renderOrders();
};

window.placeOrder = (name, price) => {
    if(!currentUser) return alert("Please login first");
    
    // User-specific storage key
    const userKey = `orders_${currentUser.email}`;
    let userOrders = JSON.parse(localStorage.getItem(userKey)) || [];
    
    const newOrder = {
        id: '#' + Math.floor(1000 + Math.random() * 9000),
        item: name,
        price: price,
        status: 'Processing',
        date: new Date().toLocaleDateString()
    };

    userOrders.push(newOrder);
    localStorage.setItem(userKey, JSON.stringify(userOrders));
    updateOrderCount();
    alert("Order Placed!");
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
