// 1. Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 2. Your Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBrvdknWfFKdl9Bn8TJRrpWEc2RQDEHZqE",
    authDomain: "eggshop-702f6.firebaseapp.com",
    projectId: "eggshop-702f6",
    storageBucket: "eggshop-702f6.firebasestorage.app",
    messagingSenderId: "290586261198",
    appId: "1:290586261198:web:61cd80463c8c2c5f06429f",
    measurementId: "G-HVJKWCER6S"
};

// 3. Initialize Firebase & Variables
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
let currentUser = null;

// Translation Dictionary
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

// --- AUTHENTICATION LOGIC ---

// Listen for Login/Logout
onAuthStateChanged(auth, (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (user) {
        currentUser = user;
        loginOverlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        document.querySelector('.user-profile').innerHTML = `<img src="${user.photoURL}" style="width:35px; border-radius:50%; border: 2px solid var(--accent)">`;
        loadAppData();
    } else {
        currentUser = null;
        loginOverlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

// Sign In Function
window.loginWithGoogle = () => {
    signInWithPopup(auth, provider).catch(err => alert("Error: " + err.message));
};

// Sign Out Function
window.logoutUser = () => {
    signOut(auth).then(() => location.reload());
};

// --- APP FUNCTIONALITIES ---

window.showPage = (pageId, element) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    if(element) element.classList.add('active');
    if(pageId === 'orders') renderOrders();
};

// --- UPDATED ORDER LOGIC ---

window.placeOrder = (name, price) => {
    if(!currentUser) return alert("Please login first");
    
    // 1. Create a unique key using the user's email
    // Example: "orders_john@gmail.com"
    const userKey = `orders_${currentUser.email}`;
    
    // 2. Get ONLY this user's orders
    let userOrders = JSON.parse(localStorage.getItem(userKey)) || [];
    
    const newOrder = {
        id: '#' + Math.floor(1000 + Math.random() * 9000),
        item: name,
        price: price,
        status: 'Processing',
        date: new Date().toLocaleDateString()
    };

    userOrders.push(newOrder);
    
    // 3. Save back using the unique key
    localStorage.setItem(userKey, JSON.stringify(userOrders));
    
    updateOrderCount();
    alert("Order Successful!");
};

function renderOrders() {
    const list = document.getElementById('ordersList');
    
    // 4. Ensure we only fetch data for the logged-in email
    const userKey = `orders_${currentUser.email}`;
    const userOrders = JSON.parse(localStorage.getItem(userKey)) || [];
    
    if (userOrders.length === 0) {
        list.innerHTML = `<p class="empty-msg" data-i18n="noOrders">No orders yet.</p>`;
        return;
    }
    
    list.innerHTML = userOrders.map(o => `
        <div class="order-item">
            <div>
                <strong>${o.item}</strong><br>
                <small>${o.date} | ${o.id}</small>
            </div>
            <div style="text-align:right">
                <p>Ksh ${o.price}</p>
                <span class="status-pill">${o.status}</span>
            </div>
        </div>
    `).reverse().join('');
}

function updateOrderCount() {
    if (!currentUser) return;
    const userKey = `orders_${currentUser.email}`;
    const userOrders = JSON.parse(localStorage.getItem(userKey)) || [];
    const countEl = document.getElementById('orderCount');
    if(countEl) countEl.innerText = userOrders.length;
}
