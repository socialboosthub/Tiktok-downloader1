import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, doc, getDoc, setDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let currentEggPrice = 385; // Default price fallback

// Mombasa Areas
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
        
        // ADMIN CHECK
        if(user.email === "ashrafsquad001@gmail.com" && !window.location.href.includes('admin.html')) {
            const goAdmin = confirm("Admin account detected. Go to Admin Dashboard?");
            if(goAdmin) window.location.href = "admin.html";
        }

        updateUIWithUser(user);
        await loadUserSettings();
        fetchLivePrice(); // GET PRICE FROM DB
        listenToOrders();
        listenToNotifications(); 
    } else {
        if(overlay) overlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});



function updateUIWithUser(user) {
    // 1. Standard UI updates
    if(document.getElementById('usernameDisplay')) 
        document.getElementById('usernameDisplay').innerText = user.displayName || "Wholesaler";
    if(document.getElementById('userPhoto') && user.photoURL) 
        document.getElementById('userPhoto').src = user.photoURL;

    // 2. THE FIX: Check email strictly (convert to lowercase to be safe)
    // Replace 'ashrafsquad001@gmail.com' with your exact email
    const myEmail = "ashrafsquad001@gmail.com";
    
    if (user.email && user.email.toLowerCase() === myEmail) {
        // Check if button already exists to prevent duplicates
        if (!document.getElementById('admin-entry-btn')) {
            const settingsList = document.querySelector('.settings-section'); // Grabs the first settings box
            
            const adminBtn = document.createElement('div');
            adminBtn.innerHTML = `
                <div class="setting-item clickable" id="admin-entry-btn" onclick="window.location.href='admin.html'" style="background: #e3f2fd; border-bottom: none;">
                    <div class="icon-wrap" style="background: #2196F3; color: white;"><i class="fa-solid fa-user-shield"></i></div>
                    <div class="text" style="color: #0d47a1; font-weight: 700;">Open Admin Panel</div>
                    <i class="fa-solid fa-arrow-right arrow" style="color: #0d47a1;"></i>
                </div>
            `;
            // Insert it at the top of the settings list
            settingsList.insertBefore(adminBtn, settingsList.firstChild);
        }
    }
}


window.handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { alert("Login Failed: " + error.message); }
};
const loginBtn = document.getElementById('google-login-btn');
if (loginBtn) loginBtn.onclick = window.handleLogin;

// --- DYNAMIC PRICE FETCH ---
async function fetchLivePrice() {
    try {
        // We listen to the config document for changes in real-time
        onSnapshot(doc(db, "config", "pricing"), (doc) => {
            if (doc.exists()) {
                currentEggPrice = doc.data().currentPrice || 385;
            } else {
                currentEggPrice = 385;
            }
            // Update UI
            const priceDisplay = document.getElementById('dynamicPriceDisplay');
            if(priceDisplay) priceDisplay.innerText = currentEggPrice;
        });
    } catch(e) {
        console.error("Error fetching price", e);
    }
}

// --- ORDER & M-PESA LOGIC ---
window.updateQty = (change) => {
    const display = document.getElementById('shopQty');
    let current = parseInt(display.innerText);
    let newVal = current + change;
    if(newVal < 30) newVal = 30;
    display.innerText = newVal;
};

// 1. Open Modal
window.initiateOrder = () => {
    if (!auth.currentUser) return alert("Please login first.");
    if (!userLocation) {
        if(confirm("No delivery address! Set one now?")) window.showPage('settings', document.querySelectorAll('.nav-item')[3]);
        return;
    }
    
    const quantity = parseInt(document.getElementById('shopQty').innerText);
    const total = quantity * currentEggPrice;
    
    document.getElementById('mpesaTotalDisplay').innerText = total.toLocaleString();
    document.getElementById('mpesa-modal').style.display = 'flex';
};

// 2. Simulate Payment
window.triggerMpesa = async () => {
    const phone = document.getElementById('mpesaNumber').value;
    const btn = document.getElementById('payBtn');
    
    if(phone.length < 10) return alert("Please enter a valid M-Pesa number");

    // UI Simulation
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Sending STK Push...`;

    // Wait 3 seconds to mimic network request
    setTimeout(async () => {
        btn.innerHTML = `<i class="fa-solid fa-mobile-screen"></i> Check your phone for PIN...`;
        
        // Wait 3 more seconds to mimic user entering PIN
        setTimeout(async () => {
            await finalizeOrder(phone);
            btn.disabled = false;
            btn.innerHTML = "Pay Now";
            document.getElementById('mpesa-modal').style.display = 'none';
        }, 3000);
    }, 2500);
};

// 3. Save to DB
async function finalizeOrder(mpesaNumber) {
    const quantity = parseInt(document.getElementById('shopQty').innerText);
    const totalPrice = quantity * currentEggPrice;
    const item = "Tray of 30";

    try {
        await addDoc(collection(db, "orders"), {
            userId: auth.currentUser.uid,
            userName: auth.currentUser.displayName,
            item, 
            unitPrice: currentEggPrice, 
            quantity, 
            totalPrice,
            status: 'Pending', // Or 'Paid' if we assume success
            mpesaNumber: mpesaNumber,
            address: userLocation.address,
            createdAt: new Date()
        });
        
        await createNotification(`Order Placed! ${quantity} Trays. Total: Ksh ${totalPrice}`);
        alert(`Payment Confirmed! Order placed.`);
        window.showPage('orders', document.querySelectorAll('.nav-item')[2]);
        generateWhatsAppLink(quantity, totalPrice, userLocation.address);
    } catch(e) {
        alert("Error saving order: " + e.message);
    }
}

// 4. Update Floating Button
function generateWhatsAppLink(qty, total, loc) {
    const btn = document.querySelector('.whatsapp-float');
    const msg = `Hi EggMaster, I just ordered ${qty} Trays for Ksh ${total}. Location: ${loc}.`;
    if(btn) btn.href = `https://wa.me/254700000000?text=${encodeURIComponent(msg)}`;
}

// --- PROFILE, SETTINGS, LOCATION (Existing Code Preserved) ---
window.openProfileModal = () => {
    const user = auth.currentUser;
    if(!user) return;
    document.getElementById('editNameInput').value = user.displayName || "";
    document.getElementById('editPhotoInput').value = user.photoURL || "";
    document.getElementById('profile-modal').style.display = 'flex';
};
window.closeProfileModal = () => { document.getElementById('profile-modal').style.display = 'none'; };
window.saveProfile = async () => {
    const name = document.getElementById('editNameInput').value;
    const photo = document.getElementById('editPhotoInput').value;
    if(!name) return alert("Name cannot be empty");
    try {
        await updateProfile(auth.currentUser, { displayName: name, photoURL: photo });
        await setDoc(doc(db, "users", auth.currentUser.uid), { name, photo }, { merge: true });
        document.getElementById('usernameDisplay').innerText = name;
        if(photo) document.getElementById('userPhoto').src = photo;
        window.closeProfileModal();
    } catch(e) { alert("Error: " + e.message); }
};

// Settings
async function loadUserSettings() {
    if (!auth.currentUser) return;
    try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.theme === 'dark') {
                document.body.setAttribute('data-theme', 'dark');
                if(document.getElementById('themeToggle')) document.getElementById('themeToggle').checked = true;
            }
            if (data.location) {
                userLocation = data.location;
                if(document.getElementById('currentCoords')) document.getElementById('currentCoords').innerText = data.location.address;
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

// Location
window.initLocationFlow = function() {
    const choice = confirm("Use GPS to find your location automatically?\nCancel to search manually.");
    if (choice) {
        if (!navigator.geolocation) return window.openLocationSearch();
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: "GPS Location (Mombasa)", timestamp: new Date() };
                saveLoc();
                alert("GPS Location set!");
            }, 
            () => { alert("GPS failed."); window.openLocationSearch(); }
        );
    } else { window.openLocationSearch(); }
};
window.openLocationSearch = () => {
    document.getElementById('location-modal').style.display = 'flex';
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
    const queryStr = document.getElementById('locSearch').value.toLowerCase();
    const filtered = MOMBASA_AREAS.filter(a => a.toLowerCase().includes(queryStr));
    window.renderLocationList(filtered);
};
window.selectLocation = (address) => {
    userLocation = { address: address };
    saveLoc();
    document.getElementById('location-modal').style.display = 'none';
};
async function saveLoc() {
    if(!userLocation) return;
    document.getElementById('currentCoords').innerText = userLocation.address;
    if(auth.currentUser) await setDoc(doc(db, "users", auth.currentUser.uid), { location: userLocation }, { merge: true });
}

// Notifications
async function createNotification(msg) {
    if(!auth.currentUser) return;
    await addDoc(collection(db, "notifications"), {
        userId: auth.currentUser.uid,
        message: msg, read: false, timestamp: new Date()
    });
}
function listenToNotifications() {
    if(!auth.currentUser) return;
    const q = query(collection(db, "notifications"), where("userId", "==", auth.currentUser.uid));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('fullNotifList');
        const badge = document.getElementById('notifBadge');
        const docs = snap.docs.map(d => d.data()).sort((a,b) => b.timestamp - a.timestamp);
        if (docs.length > 0) {
            badge.style.display = 'block';
            if(list) {
                list.innerHTML = '';
                docs.forEach(n => {
                    const d = n.timestamp.toDate ? n.timestamp.toDate() : new Date(n.timestamp);
                    list.innerHTML += `<div class="notif-card"><div class="notif-icon"><i class="fa-solid fa-bell"></i></div><div class="notif-content"><div class="msg">${n.message}</div><div class="time">${d.toLocaleString()}</div></div></div>`;
                });
            }
        } else {
            badge.style.display = 'none';
            if(list) list.innerHTML = '<p class="empty-msg">No notifications yet.</p>';
        }
    });
}

// Orders Listener
function listenToOrders() {
    if(!auth.currentUser) return;
    const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid));
    onSnapshot(q, (snap) => {
        const countEl = document.getElementById('homeOrderCount');
        if(countEl) countEl.innerText = snap.size;
        
        const list = document.getElementById('ordersList');
        if(list) list.innerHTML = snap.empty ? '<p style="text-align:center;color:#888;margin-top:20px;">No orders yet.</p>' : '';
        
        const docs = snap.docs.map(d => d.data()).sort((a,b) => b.createdAt.seconds - a.createdAt.seconds);
        
        // Update Home Recent Activity
        if(docs.length > 0) {
            const last = docs[0];
            if(document.getElementById('recentItemName')) document.getElementById('recentItemName').innerText = `${last.quantity}x ${last.item}`;
            if(document.getElementById('recentStatusText')) document.getElementById('recentStatusText').innerText = "Status: " + last.status;
            if(document.getElementById('recentPrice')) document.getElementById('recentPrice').innerText = "Ksh " + last.totalPrice;
        }

        docs.forEach(o => {
            list.innerHTML += `
            <div class="mini-order" style="margin-bottom:10px;">
                <div class="icon-box"><i class="fa-solid fa-egg"></i></div>
                <div class="details">
                    <h4>${o.quantity}x ${o.item}</h4>
                    <small>${o.status} &bull; ${o.address}</small>
                </div>
                <span class="price">Ksh ${o.totalPrice}</span>
            </div>`;
        });
    });
}

// Navigation
window.showPage = (id, el) => {
    document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
    const target = document.getElementById(id);
    if(target) { target.style.display = 'block'; setTimeout(() => target.classList.add('active'), 10); }
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
};
const heroBtn = document.getElementById('heroOrderBtn');
if(heroBtn) heroBtn.onclick = () => window.showPage('shop', document.querySelectorAll('.nav-item')[1]);
window.logoutUser = () => signOut(auth).then(() => location.reload());
