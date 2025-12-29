import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
onAuthStateChanged(auth, async (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (user) {
        loginOverlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        // Fetch preferences from cloud before updating UI
        await loadUserSettings();
        updateOrderCount();
    } else {
        loginOverlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
        // Reset UI to defaults on logout
        resetUIToDefaults();
    }
});

// --- CLOUD USER PREFERENCES ---
async function loadUserSettings() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        // Use cloud settings if they exist, otherwise use defaults
        const settings = userDoc.exists() ? userDoc.data() : { lang: 'en', theme: 'light' };
        
        // Apply Language
        window.changeLanguage(settings.lang, false); // false = don't save back to cloud
        if(document.getElementById('langSelect')) document.getElementById('langSelect').value = settings.lang;

        // Apply Theme
        document.documentElement.setAttribute('data-theme', settings.theme);
        if(document.getElementById('themeToggle')) document.getElementById('themeToggle').checked = (settings.theme === 'dark');

    } catch (e) {
        console.error("Error loading settings:", e);
    }
}

function resetUIToDefaults() {
    document.documentElement.setAttribute('data-theme', 'light');
    window.changeLanguage('en', false);
}

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
                <div class="order-item">
                    <div><b>${o.item}</b><br><small>${o.createdAt.toDate().toLocaleDateString()}</small></div>
                    <div style="text-align:right">Ksh ${o.price}<br><span class="status-pill">${o.status}</span></div>
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
window.changeLanguage = async (lang, saveToCloud = true) => {
    // Update UI
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = translations[lang][key] || key;
    });

    // Save to Cloud if triggered by user change
    const user = auth.currentUser;
    if (saveToCloud && user) {
        await setDoc(doc(db, "users", user.uid), { lang: lang }, { merge: true });
    }
};

window.toggleTheme = async () => {
    const isDark = document.getElementById('themeToggle').checked;
    const theme = isDark ? 'dark' : 'light';
    
    // Update UI
    document.documentElement.setAttribute('data-theme', theme);

    // Save to Cloud
    const user = auth.currentUser;
    if (user) {
        await setDoc(doc(db, "users", user.uid), { theme: theme }, { merge: true });
    }
};

// --- NAVIGATION & AUTH ---
window.showPage = (pageId, element) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if(element) element.classList.add('active');
    if(pageId === 'orders') renderOrders();
};

window.loginWithGoogle = () => signInWithPopup(auth, provider);
window.logoutUser = () => signOut(auth).then(() => {
    localStorage.clear(); // Clear local storage just in case
    location.reload();
});

document.getElementById('google-login-btn').onclick = window.loginWithGoogle;
