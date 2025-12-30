import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBrvdknWfFKdl9Bn8TJRrpWEc2RQDEHZqE",
    authDomain: "eggshop-702f6.firebaseapp.com",
    projectId: "eggshop-702f6",
    storageBucket: "eggshop-702f6.firebasestorage.app",
    messagingSenderId: "290586261198",
    appId: "1:290586261198:web:61cd80463c8c2c5f06429f",
    measurementId: "G-HVJKWCER6S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let userLocation = null;

const translations = {
    en: { heroTitle: "Fresh Eggs", navShop: "Shop", navSettings: "Settings", myOrders: "My Orders", setTheme: "Dark Mode", setLanguage: "Language", logout: "Logout", statOrders: "Orders", statMember: "Member", prodTray: "Tray of 30", prodDozen: "Dozen (12)", recentActivity: "Recent Activity" },
    sw: { heroTitle: "Mayai Safi", navShop: "Duka", navSettings: "Mipangilio", myOrders: "Oda Zangu", setTheme: "Giza", setLanguage: "Lugha", logout: "Ondoka", statOrders: "Oda", statMember: "Mwanachama", prodTray: "Tray ya 30", prodDozen: "Dozen (12)", recentActivity: "Shughuli za Hivi Karibuni" }
};

// --- AUTH HANDLER ---
onAuthStateChanged(auth, async (user) => {
    const overlay = document.getElementById('login-overlay');
    if (user) {
        // User is logged in
        if(overlay) overlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        
        // Update UI with user details
        if(document.getElementById('usernameDisplay')) 
            document.getElementById('usernameDisplay').innerText = user.displayName;
        if(document.getElementById('userPhoto') && user.photoURL) 
            document.getElementById('userPhoto').src = user.photoURL;
        
        await loadUserSettings();
        listenToOrders();
    } else {
        // User is logged out
        if(overlay) overlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

// --- LOGIN FUNCTION ---
// Defined globally so the HTML can find it if needed, though we attach listener below
window.handleLogin = async () => {
    try {
        await signInWithPopup(auth, provider);
        // onAuthStateChanged will handle the rest
    } catch (error) {
        console.error("Login Error:", error);
        alert("Login Failed: " + error.message);
    }
};

// Attach listener safely
const loginBtn = document.getElementById('google-login-btn');
if (loginBtn) {
    loginBtn.onclick = window.handleLogin;
}

// --- SETTINGS (THEME & LANG) ---
async function loadUserSettings() {
    if (!auth.currentUser) return;
    try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.theme === 'dark') {
                document.body.setAttribute('data-theme', 'dark');
                const toggle = document.getElementById('themeToggle');
                if(toggle) toggle.checked = true;
            }
            if (data.lang) {
                window.changeLanguage(data.lang, false);
                const langSelect = document.getElementById('langSelect');
                if(langSelect) langSelect.value = data.lang;
            }
            if (data.location) {
                userLocation = data.location;
                const coordEl = document.getElementById('currentCoords');
                if(coordEl) coordEl.innerText = data.location.address || "GPS Set";
            }
        }
    } catch(e) {
        console.error("Error loading settings:", e);
    }
}

window.toggleTheme = async () => {
    const toggle = document.getElementById('themeToggle');
    if(!toggle) return;
    
    const isDark = toggle.checked;
    const theme = isDark ? 'dark' : 'light';
    
    if (isDark) document.body.setAttribute('data-theme', 'dark');
    else document.body.removeAttribute('data-theme');

    if (auth.currentUser) {
        await setDoc(doc(db, "users", auth.currentUser.uid), { theme }, { merge: true });
    }
};

window.changeLanguage = async (lang, save = true) => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) {
            el.innerText = translations[lang][key];
        }
    });
    if (save && auth.currentUser) {
        await setDoc(doc(db, "users", auth.currentUser.uid), { lang }, { merge: true });
    }
};

// --- LOCATION ---
window.updateLocation = function() {
    // 1. Force the user to choose
    const choice = confirm("Press OK to use GPS, or Cancel to type address manually.");

    if (choice) {
        // User wants GPS
        if (!navigator.geolocation) {
            alert("GPS not supported. Please type address.");
            promptAddress();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                userLocation = { 
                    lat: pos.coords.latitude, 
                    lng: pos.coords.longitude, 
                    address: "GPS Location (Lat/Lng)", 
                    timestamp: new Date() 
                };
                saveLoc();
            }, 
            (err) => {
                // If denied or failed, IMMEDIATELY ask for manual input
                console.error("GPS Error:", err);
                alert("GPS permission denied or failed. Please type your address manually.");
                promptAddress();
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    } else {
        // User chose manual
        promptAddress();
    }
};

function promptAddress() {
    const address = prompt("Enter your Delivery Address (e.g., Estate Name, House No):");
    if (address && address.length > 2) {
        userLocation = { lat: null, lng: null, address: address, timestamp: new Date() };
        saveLoc();
    } else {
        // Only if they cancel the prompt or type nothing
        alert("Address is required for delivery.");
    }
}

async function saveLoc() {
    if(!userLocation) return;
    const coordEl = document.getElementById('currentCoords');
    if(coordEl) coordEl.innerText = userLocation.address;
    
    if(auth.currentUser) {
        await setDoc(doc(db, "users", auth.currentUser.uid), { location: userLocation }, { merge: true });
        alert("Location Saved Successfully!");
    }
}

// --- ORDERS ---
window.placeOrder = async (item, unitPrice, btnElement) => {
    if (!auth.currentUser) return alert("Please login first.");
    
    if (!userLocation) {
        const setNow = confirm("No delivery address set! Go to settings?");
        if(setNow) {
            const settingsNavItem = document.querySelectorAll('.nav-item')[3];
            window.showPage('settings', settingsNavItem);
        }
        return;
    }

    // Determine quantity
    let quantity = 1;
    try {
        const parentRow = btnElement.closest('.action-row');
        const qtySpan = parentRow.querySelector('.qty-display');
        quantity = parseInt(qtySpan.innerText) || 1;
    } catch(e) {
        console.warn("Could not read quantity, defaulting to 1");
    }

    const totalPrice = unitPrice * quantity;

    try {
        await addDoc(collection(db, "orders"), {
            userId: auth.currentUser.uid,
            item: item, 
            unitPrice: unitPrice,
            quantity: quantity,
            totalPrice: totalPrice,
            status: 'Pending',
            address: userLocation.address,
            createdAt: new Date()
        });
        alert(`Order Placed!\n${quantity}x ${item}\nTotal: Ksh ${totalPrice}`);
    } catch(e) {
        alert("Error placing order: " + e.message);
    }
};

function listenToOrders() {
    if(!auth.currentUser) return;
    
    // Using simple query first to avoid index errors if index not built
    const q = query(
        collection(db, "orders"), 
        where("userId", "==", auth.currentUser.uid)
        // orderBy("createdAt", "asc") -> removed temporarily to ensure data loads if index is missing
        // You can re-enable this if you have the Firestore Index created
    );

    onSnapshot(q, (snap) => {
        const countEl = document.getElementById('homeOrderCount');
        if(countEl) countEl.innerText = snap.size;

        if (!snap.empty) {
            // Manually sort since we removed orderBy
            const docs = snap.docs.map(d => d.data()).sort((a,b) => a.createdAt - b.createdAt);
            const last = docs[docs.length - 1];
            
            const qtyStr = last.quantity ? `${last.quantity}x ` : '1x ';
            const priceStr = last.totalPrice || last.price; 

            if(document.getElementById('recentItemName'))
                document.getElementById('recentItemName').innerText = qtyStr + last.item;
            
            if(document.getElementById('recentStatusText'))
                document.getElementById('recentStatusText').innerText = "Status: " + last.status;
            
            if(document.getElementById('recentPrice'))
                document.getElementById('recentPrice').innerText = "Ksh " + priceStr;
        }
    });
}

async function renderOrders() {
    if(!auth.currentUser) return;

    const q = query(
        collection(db, "orders"), 
        where("userId", "==", auth.currentUser.uid)
    );
    
    const snap = await getDocs(q);
    const list = document.getElementById('ordersList');
    if(!list) return;

    list.innerHTML = snap.empty ? '<p style="text-align:center;color:#888;margin-top:20px;">No orders yet.</p>' : '';
    
    // Sort locally (Newest first)
    const docs = snap.docs.map(d => d.data()).sort((a,b) => b.createdAt.seconds - a.createdAt.seconds);

    docs.forEach(o => {
        const qty = o.quantity || 1;
        const total = o.totalPrice || o.price;
        
        list.innerHTML += `
        <div class="mini-order" style="margin-bottom:10px;">
            <div class="icon-box"><i class="fa-solid fa-egg"></i></div>
            <div class="details">
                <h4>${qty}x ${o.item}</h4>
                <small>${o.status}</small>
            </div>
            <span class="price">Ksh ${total}</span>
        </div>`;
    });
}

// --- NAV ---
window.showPage = (id, el) => {
    document.querySelectorAll('.page').forEach(p => { 
        p.style.display = 'none'; 
        p.classList.remove('active'); 
    });
    
    const target = document.getElementById(id);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
    }
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
    
    if(id === 'orders') renderOrders();
};

const heroBtn = document.getElementById('heroOrderBtn');
if(heroBtn) heroBtn.onclick = () => window.showPage('shop', document.querySelectorAll('.nav-item')[1]);

window.logoutUser = () => signOut(auth).then(() => location.reload());

// Qty Counters
document.querySelectorAll('.qty-control').forEach(ctrl => {
    const s = ctrl.querySelector('.qty-display');
    const btns = ctrl.querySelectorAll('button');
    if(btns.length >= 2 && s) {
        btns[0].onclick = () => { 
            let v = parseInt(s.innerText); 
            if(v > 1) s.innerText = v - 1; 
        };
        btns[1].onclick = () => { 
            let v = parseInt(s.innerText);
            s.innerText = v + 1; 
        };
    }
});
