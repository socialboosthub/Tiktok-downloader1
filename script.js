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

let userLocation = null;

const translations = {
    en: { heroTitle: "Fresh Eggs", navShop: "Shop", navSettings: "Settings", myOrders: "My Orders", setTheme: "Dark Mode", setLanguage: "Language", logout: "Logout", statOrders: "Orders", statMember: "Member", prodTray: "Tray of 30", prodDozen: "Dozen (12)", recentActivity: "Recent Activity" },
    sw: { heroTitle: "Mayai Safi", navShop: "Duka", navSettings: "Mipangilio", myOrders: "Oda Zangu", setTheme: "Giza", setLanguage: "Lugha", logout: "Ondoka", statOrders: "Oda", statMember: "Mwanachama", prodTray: "Tray ya 30", prodDozen: "Dozen (12)", recentActivity: "Shughuli za Hivi Karibuni" }
};

// --- AUTH STATE ---
onAuthStateChanged(auth, async (user) => {
    const overlay = document.getElementById('login-overlay');
    if (user) {
        overlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        document.getElementById('usernameDisplay').innerText = user.displayName;
        if(user.photoURL) document.getElementById('userPhoto').src = user.photoURL;
        
        await loadUserSettings();
        listenToOrders();
    } else {
        overlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

// --- SETTINGS (THEME & LANG) ---
async function loadUserSettings() {
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        const data = userDoc.data();
        // Apply Theme
        if (data.theme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            document.getElementById('themeToggle').checked = true;
        }
        // Apply Language
        if (data.lang) {
            window.changeLanguage(data.lang, false);
            document.getElementById('langSelect').value = data.lang;
        }
        // Apply Location
        if (data.location) {
            userLocation = data.location;
            document.getElementById('currentCoords').innerText = data.location.address || "GPS Set";
        }
    }
}

window.toggleTheme = async () => {
    const isDark = document.getElementById('themeToggle').checked;
    const theme = isDark ? 'dark' : 'light';
    if (isDark) document.body.setAttribute('data-theme', 'dark');
    else document.body.removeAttribute('data-theme');

    if (auth.currentUser) await setDoc(doc(db, "users", auth.currentUser.uid), { theme }, { merge: true });
};

window.changeLanguage = async (lang, save = true) => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) el.innerText = translations[lang][key];
    });
    if (save && auth.currentUser) await setDoc(doc(db, "users", auth.currentUser.uid), { lang }, { merge: true });
};

// --- LOCATION ---
window.updateLocation = function() {
    const address = prompt("Enter Delivery Address (e.g. Estate, House No) or type 'GPS' to use sensor:");
    if (!address) return;

    if (address.toLowerCase() === 'gps' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: "GPS Coordinates", timestamp: new Date() };
            saveLoc();
        }, () => alert("GPS Denied. Please type address manually."));
    } else {
        userLocation = { lat: null, lng: null, address: address, timestamp: new Date() };
        saveLoc();
    }
};

async function saveLoc() {
    document.getElementById('currentCoords').innerText = userLocation.address;
    await setDoc(doc(db, "users", auth.currentUser.uid), { location: userLocation }, { merge: true });
    alert("Location Saved!");
}

// --- ORDERS ---
window.placeOrder = async (item, price) => {
    if (!userLocation) {
        alert("Set delivery address in settings first!");
        window.showPage('settings', document.querySelectorAll('.nav-item')[3]);
        return;
    }
    await addDoc(collection(db, "orders"), {
        userId: auth.currentUser.uid,
        item, price, status: 'Pending',
        address: userLocation.address,
        createdAt: new Date()
    });
    alert("Ordered! 🥚");
};

function listenToOrders() {
    const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid));
    onSnapshot(q, (snap) => {
        document.getElementById('homeOrderCount').innerText = snap.size;
        if (!snap.empty) {
            const last = snap.docs[snap.docs.length - 1].data();
            document.getElementById('recentItemName').innerText = last.item;
            document.getElementById('recentStatusText').innerText = "Status: " + last.status;
            document.getElementById('recentPrice').innerText = "Ksh " + last.price;
        }
    });
}

async function renderOrders() {
    const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
    const list = document.getElementById('ordersList');
    list.innerHTML = snap.empty ? '<p>No orders yet.</p>' : '';
    snap.forEach(d => {
        const o = d.data();
        list.innerHTML += `<div class="mini-order" style="margin-bottom:10px;">
            <div class="icon-box"><i class="fa-solid fa-egg"></i></div>
            <div class="details"><h4>${o.item}</h4><small>${o.status}</small></div>
            <span class="price">Ksh ${o.price}</span>
        </div>`;
    });
}

// --- NAV ---
window.showPage = (id, el) => {
    document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
    const target = document.getElementById(id);
    target.style.display = 'block';
    setTimeout(() => target.classList.add('active'), 50);
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
    if(id === 'orders') renderOrders();
};

document.getElementById('heroOrderBtn').onclick = () => window.showPage('shop', document.querySelectorAll('.nav-item')[1]);
window.logoutUser = () => signOut(auth).then(() => location.reload());
document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);

// Qty Counters
document.querySelectorAll('.qty-control').forEach(ctrl => {
    const s = ctrl.querySelector('span');
    ctrl.querySelector('button:first-child').onclick = () => { let v = parseInt(s.innerText); if(v>1) s.innerText = v-1; };
    ctrl.querySelector('button:last-child').onclick = () => { s.innerText = parseInt(s.innerText)+1; };
});
