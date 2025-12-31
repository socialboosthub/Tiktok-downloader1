import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let userLocation = null;

// Mombasa Areas Database
const MOMBASA_AREAS = [
    "Nyali", "Bamburi", "Tudor", "Kizingo", "Mtwapa", "Likoni", 
    "Changamwe", "Mikindani", "Ganjoni", "Mombasa Island", "Shanzu", "Mkomani"
];

const translations = {
    en: { heroTitle: "Bulk Fresh Eggs", navShop: "Shop", navSettings: "Settings", myOrders: "My Orders", setTheme: "Dark Mode", setLanguage: "Language", logout: "Logout", statOrders: "My Orders", prodTray: "Tray of 30", recentActivity: "Recent Activity" },
    sw: { heroTitle: "Mayai Kwa Jumla", navShop: "Duka", navSettings: "Mipangilio", myOrders: "Oda Zangu", setTheme: "Giza", setLanguage: "Lugha", logout: "Ondoka", statOrders: "Oda Zangu", prodTray: "Tray ya 30", recentActivity: "Shughuli za Hivi Karibuni" }
};

// --- AUTH HANDLER ---
onAuthStateChanged(auth, async (user) => {
    const overlay = document.getElementById('login-overlay');
    if (user) {
        if(overlay) overlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        
        updateUIWithUser(user);
        await loadUserSettings();
        listenToOrders();
        listenToNotifications(); 
    } else {
        if(overlay) overlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

function updateUIWithUser(user) {
    if(document.getElementById('usernameDisplay')) 
        document.getElementById('usernameDisplay').innerText = user.displayName || "Wholesaler";
    if(document.getElementById('userPhoto') && user.photoURL) 
        document.getElementById('userPhoto').src = user.photoURL;
}

window.handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { alert("Login Failed: " + error.message); }
};
const loginBtn = document.getElementById('google-login-btn');
if (loginBtn) loginBtn.onclick = window.handleLogin;

// --- PROFILE EDITING (FIXED) ---
window.openProfileModal = () => {
    const user = auth.currentUser;
    if(!user) return;
    document.getElementById('editNameInput').value = user.displayName || "";
    document.getElementById('editPhotoInput').value = user.photoURL || "";
    document.getElementById('profile-modal').style.display = 'flex';
};

window.closeProfileModal = () => {
    document.getElementById('profile-modal').style.display = 'none';
};

window.saveProfile = async () => {
    const name = document.getElementById('editNameInput').value;
    const photo = document.getElementById('editPhotoInput').value;
    
    if(!name) return alert("Name cannot be empty");

    try {
        // 1. Update Firebase Auth Profile
        await updateProfile(auth.currentUser, {
            displayName: name,
            photoURL: photo
        });
        
        // 2. Update Firestore User Document
        await setDoc(doc(db, "users", auth.currentUser.uid), { 
            name: name,
            photo: photo 
        }, { merge: true });

        // 3. Force UI Update immediately
        document.getElementById('usernameDisplay').innerText = name;
        if(photo) document.getElementById('userPhoto').src = photo;

        window.closeProfileModal();
        alert("Profile Updated Successfully!");
    } catch(e) {
        alert("Error updating profile: " + e.message);
        console.error(e);
    }
};

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
                if(coordEl) coordEl.innerText = data.location.address;
            }
        }
    } catch(e) { console.error(e); }
}

window.toggleTheme = async () => {
    const toggle = document.getElementById('themeToggle');
    const theme = toggle.checked ? 'dark' : 'light';
    if (toggle.checked) document.body.setAttribute('data-theme', 'dark');
    else document.body.removeAttribute('data-theme');
    if (auth.currentUser) await setDoc(doc(db, "users", auth.currentUser.uid), { theme }, { merge: true });
};

window.changeLanguage = async (lang, save = true) => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) el.innerText = translations[lang][key];
    });
    if (save && auth.currentUser) await setDoc(doc(db, "users", auth.currentUser.uid), { lang }, { merge: true });
};

// --- LOCATION SYSTEM (Mombasa & Search) ---
window.initLocationFlow = function() {
    const choice = confirm("Use GPS to find your location automatically?\nPress Cancel to search for a Mombasa Area manually.");
    if (choice) {
        if (!navigator.geolocation) return window.openLocationSearch();
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                // In a real app, use Reverse Geocoding API here to get address name
                // For now we simulate success
                userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: "GPS Location (Mombasa)", timestamp: new Date() };
                saveLoc();
                alert("GPS Location set!");
            }, 
            () => { alert("GPS failed or denied."); window.openLocationSearch(); }
        );
    } else {
        window.openLocationSearch();
    }
};

window.openLocationSearch = () => {
    const modal = document.getElementById('location-modal');
    modal.style.display = 'flex';
    window.renderLocationList(MOMBASA_AREAS);
};

window.renderLocationList = (areas) => {
    const list = document.getElementById('locationList');
    list.innerHTML = '';
    areas.forEach(area => {
        const item = document.createElement('div');
        item.className = 'location-item';
        item.innerHTML = `<i class="fa-solid fa-map-pin"></i> ${area}, Mombasa`;
        item.onclick = () => window.selectLocation(area + ", Mombasa");
        list.appendChild(item);
    });
};

window.filterLocations = () => {
    const query = document.getElementById('locSearch').value.toLowerCase();
    const filtered = MOMBASA_AREAS.filter(a => a.toLowerCase().includes(query));
    window.renderLocationList(filtered);
};

window.selectLocation = (address) => {
    userLocation = { lat: null, lng: null, address: address, timestamp: new Date() };
    saveLoc();
    document.getElementById('location-modal').style.display = 'none';
};

async function saveLoc() {
    if(!userLocation) return;
    document.getElementById('currentCoords').innerText = userLocation.address;
    if(auth.currentUser) await setDoc(doc(db, "users", auth.currentUser.uid), { location: userLocation }, { merge: true });
}

// --- NOTIFICATIONS PAGE ---
async function createNotification(msg) {
    if(!auth.currentUser) return;
    await addDoc(collection(db, "notifications"), {
        userId: auth.currentUser.uid,
        message: msg,
        read: false,
        timestamp: new Date()
    });
}

function listenToNotifications() {
    if(!auth.currentUser) return;
    
    // Listen strictly for THIS user's notifications
    const q = query(
        collection(db, "notifications"), 
        where("userId", "==", auth.currentUser.uid)
    );

    onSnapshot(q, (snap) => {
        const list = document.getElementById('fullNotifList');
        const badge = document.getElementById('notifBadge');
        
        const notifs = snap.docs.map(d => d.data()).sort((a,b) => b.timestamp - a.timestamp);
        
        if (notifs.length > 0) {
            badge.style.display = 'block';
            if(list) {
                list.innerHTML = '';
                notifs.forEach(n => {
                    // Calculate time ago
                    const date = n.timestamp.toDate ? n.timestamp.toDate() : new Date(n.timestamp);
                    const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();

                    list.innerHTML += `
                        <div class="notif-card">
                            <div class="notif-icon"><i class="fa-solid fa-bell"></i></div>
                            <div class="notif-content">
                                <div class="msg">${n.message}</div>
                                <div class="time">${timeStr}</div>
                            </div>
                        </div>
                    `;
                });
            }
        } else {
            badge.style.display = 'none';
            if(list) list.innerHTML = '<p class="empty-msg">No notifications yet.</p>';
        }
    });
}

// --- SHOP (Min 30 Logic) ---
window.updateQty = (change) => {
    const display = document.getElementById('shopQty');
    let current = parseInt(display.innerText);
    let newVal = current + change;
    if(newVal < 30) newVal = 30; // Enforce Minimum 30
    display.innerText = newVal;
};

window.placeOrder = async (item, unitPrice) => {
    if (!auth.currentUser) return alert("Please login first.");
    if (!userLocation) {
        if(confirm("No delivery address! Set one now?")) window.showPage('settings', document.querySelectorAll('.nav-item')[3]);
        return;
    }

    const quantity = parseInt(document.getElementById('shopQty').innerText);
    
    if(quantity < 30) {
        alert("Minimum order is 30 Trays.");
        return;
    }

    const totalPrice = unitPrice * quantity;

    try {
        await addDoc(collection(db, "orders"), {
            userId: auth.currentUser.uid,
            item, unitPrice, quantity, totalPrice,
            status: 'Pending',
            address: userLocation.address,
            createdAt: new Date()
        });
        
        // Create Notification for the user
        await createNotification(`Order Placed: ${quantity}x ${item}. Total: Ksh ${totalPrice}`);
        
        alert(`Success! Order placed for ${quantity} trays.`);
        window.showPage('orders', document.querySelectorAll('.nav-item')[2]);
    } catch(e) {
        alert("Error: " + e.message);
    }
};

function listenToOrders() {
    if(!auth.currentUser) return;
    const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid));

    onSnapshot(q, (snap) => {
        const countEl = document.getElementById('homeOrderCount');
        if(countEl) countEl.innerText = snap.size;

        if (!snap.empty) {
            const docs = snap.docs.map(d => d.data()).sort((a,b) => a.createdAt - b.createdAt);
            const last = docs[docs.length - 1];
            const qtyStr = last.quantity ? `${last.quantity}x ` : '1x ';
            const priceStr = last.totalPrice || last.price; 

            if(document.getElementById('recentItemName')) document.getElementById('recentItemName').innerText = qtyStr + last.item;
            if(document.getElementById('recentStatusText')) document.getElementById('recentStatusText').innerText = "Status: " + last.status;
            if(document.getElementById('recentPrice')) document.getElementById('recentPrice').innerText = "Ksh " + priceStr;
        }
        renderOrdersList(snap);
    });
}

function renderOrdersList(snap) {
    const list = document.getElementById('ordersList');
    if(!list) return;

    list.innerHTML = snap.empty ? '<p style="text-align:center;color:#888;margin-top:20px;">No orders yet.</p>' : '';
    const docs = snap.docs.map(d => d.data()).sort((a,b) => b.createdAt.seconds - a.createdAt.seconds);

    docs.forEach(o => {
        const qty = o.quantity || 1;
        const total = o.totalPrice || o.price;
        list.innerHTML += `
        <div class="mini-order" style="margin-bottom:10px;">
            <div class="icon-box"><i class="fa-solid fa-egg"></i></div>
            <div class="details">
                <h4>${qty}x ${o.item}</h4>
                <small>${o.status} &bull; ${o.address}</small>
            </div>
            <span class="price">Ksh ${total}</span>
        </div>`;
    });
}

// --- NAV & UI ---
window.showPage = (id, el) => {
    document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
    const target = document.getElementById(id);
    if(target) { target.style.display = 'block'; setTimeout(() => target.classList.add('active'), 10); }
    
    // Update nav icons
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) {
        el.classList.add('active');
    } else {
        // If no element passed (e.g. from bell icon), deactivate all bottom navs
    }
};

const heroBtn = document.getElementById('heroOrderBtn');
if(heroBtn) heroBtn.onclick = () => window.showPage('shop', document.querySelectorAll('.nav-item')[1]);

window.logoutUser = () => signOut(auth).then(() => location.reload());
