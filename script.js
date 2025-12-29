import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

// --- AUTH STATE ---
onAuthStateChanged(auth, (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    const ordersList = document.getElementById('ordersList');
    
    if (user) {
        console.log("✅ User Verified:", user.email, "UID:", user.uid);
        
        // 1. Hide Login
        loginOverlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        
        // 2. Clear the screen of the PREVIOUS user's data before loading new data
        if(ordersList) ordersList.innerHTML = ""; 
        
        // 3. Update UI
        updateOrderCount(user.uid);
        loadUserSettings();
    } else {
        console.log("❌ No user logged in.");
        loginOverlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
        if(ordersList) ordersList.innerHTML = "";
    }
});

// --- GLOBAL FUNCTIONS ---

window.loginWithGoogle = () => {
    signInWithPopup(auth, provider).catch(err => alert(err.message));
};

window.logoutUser = () => {
    signOut(auth).then(() => {
        // Essential: Clear local storage or refresh to ensure no data leaks
        location.reload(); 
    });
};

window.showPage = (pageId, element) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    if(element) element.classList.add('active');
    
    // Fetch orders ONLY for the current user's UID
    if(pageId === 'orders' && auth.currentUser) {
        renderOrders(auth.currentUser.uid);
    }
};

window.placeOrder = (name, price) => {
    const user = auth.currentUser;
    if(!user) return alert("Login first!");

    // Use UID as the key. This is 100% unique to the account.
    const storageKey = `orders_data_${user.uid}`;
    let orders = JSON.parse(localStorage.getItem(storageKey)) || [];
    
    const newOrder = {
        id: '#' + Math.floor(1000 + Math.random() * 9000),
        item: name,
        price: price,
        status: 'Processing',
        date: new Date().toLocaleString()
    };

    orders.push(newOrder);
    localStorage.setItem(storageKey, JSON.stringify(orders));
    
    updateOrderCount(user.uid);
    alert("Order successful!");
};

function renderOrders(uid) {
    const list = document.getElementById('ordersList');
    const storageKey = `orders_data_${uid}`;
    const orders = JSON.parse(localStorage.getItem(storageKey)) || [];
    
    console.log(`Fetching orders for UID: ${uid}. Found: ${orders.length}`);

    if (orders.length === 0) {
        list.innerHTML = `<p style="text-align:center; padding:20px;">No orders found for this account.</p>`;
        return;
    }
    
    list.innerHTML = orders.map(o => `
        <div class="order-item" style="background:var(--card); margin:10px; padding:15px; border-radius:10px; display:flex; justify-content:space-between; border-left: 4px solid var(--accent);">
            <div><b>${o.item}</b><br><small>${o.date}</small></div>
            <div style="text-align:right">Ksh ${o.price}<br><span style="color:orange; font-size:12px;">${o.status}</span></div>
        </div>
    `).reverse().join('');
}

function updateOrderCount(uid) {
    const storageKey = `orders_data_${uid}`;
    const orders = JSON.parse(localStorage.getItem(storageKey)) || [];
    const countEl = document.getElementById('orderCount');
    if(countEl) countEl.innerText = orders.length;
}

// --- SETTINGS & THEME ---
window.changeLanguage = (lang) => {
    localStorage.setItem('app_lang', lang);
    // (Add your translation logic here or keep the existing dictionary)
    location.reload(); // Quickest way to apply language across app
};

window.toggleTheme = () => {
    const isDark = document.getElementById('themeToggle').checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('app_theme', isDark ? 'dark' : 'light');
};

function loadUserSettings() {
    const theme = localStorage.getItem('app_theme') || 'light';
    if(theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if(document.getElementById('themeToggle')) document.getElementById('themeToggle').checked = true;
    }
}
