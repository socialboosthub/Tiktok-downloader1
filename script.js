import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    en: { brandName: "EggMaster", navHome: "Home", navShop: "Shop", navSettings: "Settings", myOrders: "My Orders", noOrders: "No orders yet.", setLanguage: "Language", setTheme: "Dark Mode", logout: "Logout", buyNow: "Order Now", statOrders: "Orders", statMember: "Gold Member", heroTitle: "Fresh Eggs", heroSubtitle: "Direct from farm" },
    sw: { brandName: "Bwana Mayai", navHome: "Mwanzo", navShop: "Duka", navSettings: "Mipangilio", myOrders: "Oda Zangu", noOrders: "Huna oda bado.", setLanguage: "Lugha", setTheme: "Giza", logout: "Ondoka", buyNow: "Agiza Sasa", statOrders: "Oda", statMember: "Mwanachama", heroTitle: "Mayai Safi", heroSubtitle: "Kutoka shambani" }
};

// --- AUTH LISTENER ---
onAuthStateChanged(auth, async (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (user) {
        loginOverlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        updateUIWithUserInfo(user);
        await syncCloudPreferences();
        initOrdersListener();
    } else {
        loginOverlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

function updateUIWithUserInfo(user) {
    // Header PFP
    const photo = document.getElementById('user-photo');
    const icon = document.getElementById('user-icon');
    if (user.photoURL) {
        photo.src = user.photoURL;
        photo.style.display = 'block';
        icon.style.display = 'none';
    }
    // Settings Profile
    document.getElementById('settings-pfp').src = user.photoURL || '';
    document.getElementById('settings-name').innerText = user.displayName;
    document.getElementById('settings-email').innerText = user.email;
}

// --- CLOUD SETTINGS ---
async function syncCloudPreferences() {
    const user = auth.currentUser;
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.lang) window.changeLanguage(data.lang, false);
        if (data.theme) {
            document.documentElement.setAttribute('data-theme', data.theme);
            document.getElementById('themeToggle').checked = (data.theme === 'dark');
        }
    }
}

window.changeLanguage = async (lang, save = true) => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = translations[lang][key] || key;
    });
    if (save && auth.currentUser) {
        await setDoc(doc(db, "users", auth.currentUser.uid), { lang }, { merge: true });
    }
};

window.toggleTheme = async () => {
    const theme = document.getElementById('themeToggle').checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    if (auth.currentUser) {
        await setDoc(doc(db, "users", auth.currentUser.uid), { theme }, { merge: true });
    }
};

// --- REAL-TIME ORDERS ---
function initOrdersListener() {
    const user = auth.currentUser;
    const q = query(collection(db, "orders"), where("userId", "==", user.uid));
    
    // This updates the UI automatically when the DB changes!
    onSnapshot(q, (snapshot) => {
        document.getElementById('orderCount').innerText = snapshot.size;
        
        const list = document.getElementById('ordersList');
        if (snapshot.empty) {
            list.innerHTML = `<div style="text-align:center; padding:40px; opacity:0.5;">Huna oda bado.</div>`;
            return;
        }

        let html = "";
        snapshot.forEach(doc => {
            const o = doc.data();
            const date = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString() : 'Just now';
            html += `
                <div class="order-item" style="background:var(--card); margin:15px; padding:18px; border-radius:18px; box-shadow:var(--shadow); display:flex; justify-content:space-between; align-items:center; border-left:5px solid var(--accent);">
                    <div>
                        <div style="font-weight:bold;">${o.item}</div>
                        <div style="font-size:0.75rem; opacity:0.6;">${date}</div>
                    </div>
                    <div style="text-align:right">
                        <div style="font-weight:800; color:var(--accent);">Ksh ${o.price}</div>
                        <div style="font-size:0.65rem; background:#ffeaa7; color:#d63031; padding:2px 8px; border-radius:10px; display:inline-block; margin-top:5px; font-weight:bold;">${o.status}</div>
                    </div>
                </div>`;
        });
        list.innerHTML = html;
    });
}

window.placeOrder = async (name, price) => {
    const user = auth.currentUser;
    try {
        await addDoc(collection(db, "orders"), {
            userId: user.uid,
            item: name,
            price: price,
            status: 'Processing',
            createdAt: new Date()
        });
        alert("Agizo limepokelewa! 🥚");
    } catch (e) { console.error(e); }
};

// --- NAVIGATION ---
window.showPage = (pageId, el) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    el.classList.add('active');
};

window.logoutUser = () => signOut(auth).then(() => {
    localStorage.clear();
    location.reload();
});

document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);
