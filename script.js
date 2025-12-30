import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. FIREBASE CONFIG ---
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

// --- 2. TRANSLATIONS (Updated for new UI) ---
const translations = {
    en: { brandName: "EggMaster", navHome: "Home", navShop: "Shop", navSettings: "Settings", myOrders: "My Orders", noOrders: "No active orders", setLanguage: "Language", setTheme: "Dark Mode", logout: "Log Out" },
    sw: { brandName: "Bwana Mayai", navHome: "Mwanzo", navShop: "Duka", navSettings: "Mipangilio", myOrders: "Oda Zangu", noOrders: "Huna oda bado", setLanguage: "Lugha", setTheme: "Giza", logout: "Ondoka" }
};

// --- 3. AUTH STATE OBSERVER ---
onAuthStateChanged(auth, async (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    
    if (user) {
        // HIDE Login Screen with animation
        loginOverlay.style.opacity = '0';
        setTimeout(() => {
            loginOverlay.style.display = 'none';
            document.body.classList.remove('not-logged-in');
        }, 500);

        // Update Header with User Info
        document.getElementById('usernameDisplay').innerText = user.displayName || "Egg Lover 🍳";
        const profileImg = document.querySelector('.profile-pic img');
        if(profileImg && user.photoURL) profileImg.src = user.photoURL;

        // Load Data
        await loadUserSettings();
        updateOrderCount();
    } else {
        // SHOW Login Screen
        loginOverlay.style.display = 'flex';
        loginOverlay.style.opacity = '1';
        document.body.classList.add('not-logged-in');
        resetUIToDefaults();
    }
});

// --- 4. CLOUD SETTINGS (Theme/Lang) ---
async function loadUserSettings() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const settings = userDoc.exists() ? userDoc.data() : { lang: 'en', theme: 'light' };
        
        // Apply Language
        window.changeLanguage(settings.lang, false);
        if(document.getElementById('langSelect')) document.getElementById('langSelect').value = settings.lang;

        // Apply Theme
        const themeToggle = document.getElementById('themeToggle');
        if (settings.theme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            if(themeToggle) themeToggle.checked = true;
        } else {
            document.body.removeAttribute('data-theme');
            if(themeToggle) themeToggle.checked = false;
        }

    } catch (e) { console.error("Error loading settings:", e); }
}

function resetUIToDefaults() {
    document.body.removeAttribute('data-theme');
    window.changeLanguage('en', false);
}

// --- 5. ORDER SYSTEM ---
window.placeOrder = async (name, price) => {
    const user = auth.currentUser;
    if(!user) return;
    
    try {
        await addDoc(collection(db, "orders"), {
            userId: user.uid,
            item: name,
            price: price,
            status: 'Pending',
            createdAt: new Date() // Firestore timestamp
        });
        
        // Success Feedback
        alert(`Successfully ordered ${name}! 🍳`);
        updateOrderCount();
        
        // Redirect to orders page to see it
        // window.showPage('orders', document.querySelectorAll('.nav-item')[2]);
    } catch (e) { 
        alert("Error placing order: " + e.message); 
    }
};

async function renderOrders() {
    const user = auth.currentUser;
    const list = document.getElementById('ordersList');
    if(!user) return;

    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading...</p></div>`;

    try {
        // Query orders, sorted by date (newest first)
        const q = query(
            collection(db, "orders"), 
            where("userId", "==", user.uid)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            list.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-basket-shopping"></i>
                    <p data-i18n="noOrders">No active orders</p>
                    <button onclick="window.showPage('shop', document.querySelectorAll('.nav-item')[1])">Start Shopping</button>
                </div>`;
            return;
        }

        let html = "";
        querySnapshot.forEach((doc) => {
            const o = doc.data();
            const date = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : 'Just now';
            
            // New Card Design
            html += `
                <div class="mini-order" style="margin-bottom: 15px;">
                    <div class="icon-box"><i class="fa-solid fa-check"></i></div>
                    <div class="details">
                        <h4>${o.item}</h4>
                        <small>${date} • <span style="color:var(--primary-dark)">${o.status}</span></small>
                    </div>
                    <span class="price">Ksh ${o.price}</span>
                </div>`;
        });
        list.innerHTML = html;
    } catch (e) { 
        console.error(e);
        list.innerHTML = `<p style="text-align:center; color:red">Error loading orders.</p>`; 
    }
}

async function updateOrderCount() {
    const user = auth.currentUser;
    if(!user) return;
    const q = query(collection(db, "orders"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    // You can update a badge here if you add one to the HTML, e.g.:
    // document.querySelector('.dot-badge').innerText = querySnapshot.size;
}

// --- 6. UI INTERACTION (Navigation & Toggles) ---

// Navigation Logic (Fixes "All pages visible" bug)
window.showPage = (pageId, navElement) => {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none'; // Force hide
    });

    // Show target page
    const target = document.getElementById(pageId);
    if(target) {
        target.style.display = 'block';
        // Small timeout to allow display:block to apply before adding opacity class
        setTimeout(() => target.classList.add('active'), 10);
    }

    // Update Nav Icons
    if(navElement) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        navElement.classList.add('active');
    }

    // Load data if needed
    if(pageId === 'orders') renderOrders();
};

// Quantity Counter Logic
document.querySelectorAll('.qty-control').forEach(control => {
    const btnMinus = control.querySelector('button:first-child');
    const btnPlus = control.querySelector('button:last-child');
    const span = control.querySelector('span');

    btnMinus.onclick = () => {
        let val = parseInt(span.innerText);
        if (val > 1) span.innerText = val - 1;
    };

    btnPlus.onclick = () => {
        let val = parseInt(span.innerText);
        span.innerText = val + 1;
    };
});

// Settings Logic
window.changeLanguage = async (lang, saveToCloud = true) => {
    const user = auth.currentUser;
    
    // Simple text replacement for demo purposes
    // In a real app, you'd have more extensive mapping
    const t = translations[lang];
    if(t) {
        if(document.querySelector('.page-title')) document.querySelector('.page-title').innerText = t.navSettings;
        // Update specific elements if they exist with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if(t[key]) el.innerText = t[key];
        });
    }

    if (saveToCloud && user) {
        await setDoc(doc(db, "users", user.uid), { lang: lang }, { merge: true });
    }
};

window.toggleTheme = async () => {
    const isDark = document.getElementById('themeToggle').checked;
    const theme = isDark ? 'dark' : 'light';
    
    if(isDark) document.body.setAttribute('data-theme', 'dark');
    else document.body.removeAttribute('data-theme');

    const user = auth.currentUser;
    if (user) {
        await setDoc(doc(db, "users", user.uid), { theme: theme }, { merge: true });
    }
};

// --- 7. EXPORTED FUNCTIONS (Attached to Window) ---
window.loginWithGoogle = () => signInWithPopup(auth, provider).catch(e => alert(e.message));

window.logoutUser = () => signOut(auth).then(() => {
    location.reload();
});

// Event Listeners for Login Buttons
const googleBtn = document.getElementById('google-login-btn');
if(googleBtn) googleBtn.onclick = window.loginWithGoogle;

// Guest button (Optional functionality)
const guestBtn = document.querySelector('.guest-btn');
if(guestBtn) {
    guestBtn.onclick = () => {
        alert("Guest mode is view-only. Please sign in to order.");
    }
}
