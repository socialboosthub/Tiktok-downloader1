import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const translations = {
    en: { brandName: "EggMaster", navHome: "Home", navShop: "Shop", navSettings: "Settings", myOrders: "My Orders", noOrders: "No orders yet.", setLanguage: "Language", setTheme: "Dark Mode", logout: "Logout", buyNow: "Order Now", statOrders: "Orders" },
    sw: { brandName: "Bwana Mayai", navHome: "Mwanzo", navShop: "Duka", navSettings: "Mipangilio", myOrders: "Oda Zangu", noOrders: "Huna oda bado.", setLanguage: "Lugha", setTheme: "Giza", logout: "Ondoka", buyNow: "Agiza Sasa", statOrders: "Oda" }
};

// --- AUTH & INITIAL LOAD ---
onAuthStateChanged(auth, (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (user) {
        loginOverlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        loadUserSettings();
        updateOrderCount();
    } else {
        loginOverlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

// --- CLOUD ORDERS ---
window.placeOrder = async (name, price) => {
    const user = auth.currentUser;
    if(!user) return;
    try {
        await addDoc(collection(db, "orders"), {
            userId: user.uid,
            item: name,
            price: price,
            status: 'Pending',
            createdAt: new Date()
        });
        alert("Ordered! 🥚");
        updateOrderCount();
    } catch (e) { alert("Error: " + e.message); }
};

async function renderOrders() {
    const user = auth.currentUser;
    const list = document.getElementById('ordersList');
    if(!user) return;

    list.innerHTML = "<p style='text-align:center;'>Fetching...</p>";

    try {
        // Querying Cloud Database
        const q = query(collection(db, "orders"), where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            list.innerHTML = `<p style="text-align:center; padding:20px;" data-i18n="noOrders">No orders yet.</p>`;
            return;
        }

        let html = "";
        querySnapshot.forEach((doc) => {
            const o = doc.data();
            html += `
                <div class="order-item" style="background:var(--card); margin:10px; padding:15px; border-radius:12px; display:flex; justify-content:space-between; border-left:4px solid #fab1a0;">
                    <div><b>${o.item}</b><br><small>${o.createdAt.toDate().toLocaleDateString()}</small></div>
                    <div style="text-align:right">Ksh ${o.price}<br><span style="color:#e17055; font-size:12px; font-weight:bold;">${o.status}</span></div>
                </div>`;
        });
        list.innerHTML = html;
    } catch (e) { list.innerHTML = "Error loading orders."; console.error(e); }
}

async function updateOrderCount() {
    const user = auth.currentUser;
    if(!user) return;
    const q = query(collection(db, "orders"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    document.getElementById('orderCount').innerText = querySnapshot.size;
}

// --- APP FEATURES (LANG & THEME) ---
window.changeLanguage = (lang) => {
    localStorage.setItem('app_lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = translations[lang][key] || key;
    });
};

window.toggleTheme = () => {
    const isDark = document.getElementById('themeToggle').checked;
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('app_theme', theme);
};

function loadUserSettings() {
    const theme = localStorage.getItem('app_theme') || 'light';
    const lang = localStorage.getItem('app_lang') || 'en';
    
    document.documentElement.setAttribute('data-theme', theme);
    if(document.getElementById('themeToggle')) document.getElementById('themeToggle').checked = (theme === 'dark');
    
    window.changeLanguage(lang);
    if(document.getElementById('langSelect')) document.getElementById('langSelect').value = lang;
}

// --- NAVIGATION & AUTH ---
window.showPage = (pageId, element) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if(element) element.classList.add('active');
    if(pageId === 'orders') renderOrders();
};

window.loginWithGoogle = () => signInWithPopup(auth, provider);
window.logoutUser = () => signOut(auth).then(() => location.reload());

document.getElementById('google-login-btn').onclick = window.loginWithGoogle;
