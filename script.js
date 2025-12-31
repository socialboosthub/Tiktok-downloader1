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

const translations = {
    en: { heroTitle: "Fresh Eggs", navShop: "Shop", navSettings: "Settings", myOrders: "My Orders", setTheme: "Dark Mode", setLanguage: "Language", logout: "Logout", statOrders: "Total Orders", prodTray: "Tray of 30", recentActivity: "Recent Activity" },
    sw: { heroTitle: "Mayai Safi", navShop: "Duka", navSettings: "Mipangilio", myOrders: "Oda Zangu", setTheme: "Giza", setLanguage: "Lugha", logout: "Ondoka", statOrders: "Jumla ya Oda", prodTray: "Tray ya 30", recentActivity: "Shughuli za Hivi Karibuni" }
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
        listenToNotifications(); // Start listening for user-specific notifications
    } else {
        if(overlay) overlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

function updateUIWithUser(user) {
    if(document.getElementById('usernameDisplay')) 
        document.getElementById('usernameDisplay').innerText = user.displayName || "User";
    if(document.getElementById('userPhoto') && user.photoURL) 
        document.getElementById('userPhoto').src = user.photoURL;
}

window.handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { alert("Login Failed: " + error.message); }
};

const loginBtn = document.getElementById('google-login-btn');
if (loginBtn) loginBtn.onclick = window.handleLogin;

// --- PROFILE EDITING ---
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
        await updateProfile(auth.currentUser, {
            displayName: name,
            photoURL: photo
        });
        
        // Also update Firestore user doc
        await setDoc(doc(db, "users", auth.currentUser.uid), { 
            name: name,
            photo: photo 
        }, { merge: true });

        updateUIWithUser(auth.currentUser);
        window.closeProfileModal();
        alert("Profile Updated!");
    } catch(e) {
        alert("Error updating profile: " + e.message);
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

// --- LOCATION ---
window.updateLocation = function() {
    const choice = confirm("Press OK to use GPS, or Cancel to type address manually.");
    if (choice) {
        if (!navigator.geolocation) return promptAddress();
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: "GPS Location (Lat/Lng)", timestamp: new Date() };
                saveLoc();
            }, 
            () => { alert("GPS failed."); promptAddress(); }
        );
    } else promptAddress();
};

function promptAddress() {
    const address = prompt("Enter your Delivery Address:");
    if (address && address.length > 2) {
        userLocation = { lat: null, lng: null, address: address, timestamp: new Date() };
        saveLoc();
    }
}

async function saveLoc() {
    if(!userLocation) return;
    document.getElementById('currentCoords').innerText = userLocation.address;
    if(auth.currentUser) await setDoc(doc(db, "users", auth.currentUser.uid), { location: userLocation }, { merge: true });
}

// --- NOTIFICATIONS SYSTEM ---
window.toggleNotifications = () => {
    const panel = document.getElementById('notifPanel');
    panel.classList.toggle('show');
    // Hide badge when opened
    if(panel.classList.contains('show')) {
        document.getElementById('notifBadge').style.display = 'none';
    }
};

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
    
    // Query only notifications for THIS user
    const q = query(
        collection(db, "notifications"), 
        where("userId", "==", auth.currentUser.uid)
    );

    onSnapshot(q, (snap) => {
        const list = document.getElementById('notifList');
        const badge = document.getElementById('notifBadge');
        
        // Sort in memory
        const notifs = snap.docs.map(d => d.data()).sort((a,b) => b.timestamp - a.timestamp);
        
        if (notifs.length > 0) {
            list.innerHTML = '';
            notifs.forEach(n => {
                list.innerHTML += `
                    <div class="notif-item">
                        <i class="fa-solid fa-circle-info" style="color:var(--primary); margin-top:3px;"></i>
                        <div>
                            <div>${n.message}</div>
                            <small>Just now</small>
                        </div>
                    </div>
                `;
            });
            // Show badge if we have items
            badge.style.display = 'block';
        } else {
            list.innerHTML = '<p class="empty-msg">No notifications.</p>';
            badge.style.display = 'none';
        }
    });
}

// --- ORDERS ---
window.placeOrder = async (item, unitPrice, btnElement) => {
    if (!auth.currentUser) return alert("Please login first.");
    if (!userLocation) {
        if(confirm("No delivery address! Set one now?")) window.showPage('settings', document.querySelectorAll('.nav-item')[3]);
        return;
    }

    let quantity = 1;
    try {
        const parentRow = btnElement.closest('.action-row');
        quantity = parseInt(parentRow.querySelector('.qty-display').innerText) || 1;
    } catch(e) {}

    const totalPrice = unitPrice * quantity;

    try {
        await addDoc(collection(db, "orders"), {
            userId: auth.currentUser.uid,
            item, unitPrice, quantity, totalPrice,
            status: 'Pending',
            address: userLocation.address,
            createdAt: new Date()
        });
        
        // Send Notification to self
        createNotification(`Order placed: ${quantity}x ${item} for Ksh ${totalPrice}`);
        
        alert(`Order Placed!`);
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
    });
}

async function renderOrders() {
    if(!auth.currentUser) return;
    const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid));
    const snap = await getDocs(q);
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
                <small>${o.status} &bull; ${o.address.substring(0,15)}...</small>
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
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
    if(id === 'orders') renderOrders();
};

const heroBtn = document.getElementById('heroOrderBtn');
if(heroBtn) heroBtn.onclick = () => window.showPage('shop', document.querySelectorAll('.nav-item')[1]);

window.logoutUser = () => signOut(auth).then(() => location.reload());

document.querySelectorAll('.qty-control').forEach(ctrl => {
    const s = ctrl.querySelector('.qty-display');
    const btns = ctrl.querySelectorAll('button');
    if(btns.length >= 2 && s) {
        btns[0].onclick = () => { let v = parseInt(s.innerText); if(v > 1) s.innerText = v - 1; };
        btns[1].onclick = () => { let v = parseInt(s.innerText); s.innerText = v + 1; };
    }
});
