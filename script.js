import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// CONFIG
const ADMINS = ['ashrafsquad001@gmail.com', 'abdulraxmanxamza@gmail.com'];
const SUPER_ADMIN = 'ashrafsquad001@gmail.com';
let currentPrice = 450;
let userLocation = null;

// MOMBASA DATABASE (Formatted for Google Maps Style)
const MOMBASA_LOCATIONS = [
    { name: "Mombasa CBD", detail: "Mombasa Island", dist: "1.0 km" },
    { name: "Nyali Center", detail: "Links Road, Nyali", dist: "3.5 km" },
    { name: "City Mall", detail: "Malindi Road, Nyali", dist: "4.2 km" },
    { name: "Bamburi Mtambo", detail: "Bamburi", dist: "7.0 km" },
    { name: "Mtwapa Mall", detail: "Mtwapa", dist: "12 km" },
    { name: "Likoni Ferry", detail: "Likoni", dist: "2.5 km" },
    { name: "Tudor", detail: "Tom Mboya Ave", dist: "2.1 km" },
    { name: "Kizingo", detail: "Mombasa Island", dist: "1.5 km" },
    { name: "Changamwe Roundabout", detail: "Airport Road", dist: "6.0 km" },
    { name: "Moi Int. Airport", detail: "Port Reitz", dist: "9.0 km" },
    { name: "Ganjoni", detail: "Mombasa", dist: "1.2 km" },
    { name: "Shanzu", detail: "Serena Road", dist: "10.5 km" }
];

// --- AUTH ---
onAuthStateChanged(auth, async (user) => {
    const overlay = document.getElementById('login-overlay');
    if (user) {
        if(overlay) overlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        
        // UI Updates
        document.getElementById('usernameDisplay').innerText = user.displayName || "Wholesaler";
        document.getElementById('userPhoto').src = user.photoURL;

        // Load Data
        checkAdminAccess(user.email);
        loadPrice();
        loadUserLocation();
        listenToOrders();
        listenToNotifications();
    } else {
        if(overlay) overlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

const loginBtn = document.getElementById('google-login-btn');
if (loginBtn) loginBtn.onclick = async () => {
    try { await signInWithPopup(auth, provider); } catch (e) { alert(e.message); }
};

window.logoutUser = () => signOut(auth).then(() => location.reload());

// --- ADMIN LOGIC ---
function checkAdminAccess(email) {
    if(ADMINS.includes(email)) {
        document.getElementById('adminBtnContainer').style.display = 'block';
    }
    if(email === SUPER_ADMIN) {
        document.getElementById('adminPriceControl').style.display = 'block';
    }
}

window.openAdminPanel = () => {
    document.getElementById('admin-panel').style.display = 'flex';
    loadAllOrdersForAdmin();
};

function loadAllOrdersForAdmin() {
    // Show all orders sorted by time
    const q = query(collection(db, "orders")); // In real app, order by date
    onSnapshot(q, (snap) => {
        const list = document.getElementById('adminOrderList');
        list.innerHTML = "";
        
        const orders = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => b.createdAt - a.createdAt);
        
        orders.forEach(o => {
            const date = o.createdAt.toDate ? o.createdAt.toDate().toLocaleDateString() : 'Just now';
            list.innerHTML += `
                <div class="admin-order-card">
                    <div style="display:flex; justify-content:space-between;">
                        <b>${o.quantity} Trays</b>
                        <span>Ksh ${o.totalPrice}</span>
                    </div>
                    <div style="font-size:12px; color:#666; margin:5px 0;">
                        User ID: ${o.userId.slice(0,5)}...<br>
                        Loc: ${o.address}<br>
                        Phone: ${o.phone || 'N/A'}<br>
                        ${date}
                    </div>
                    <div style="font-size:12px; font-weight:bold; color:${o.status === 'Paid' ? 'green' : 'orange'}">
                        Status: ${o.status}
                    </div>
                </div>
            `;
        });
    });
}

// --- PRICE LOGIC ---
async function loadPrice() {
    try {
        const docRef = doc(db, "config", "pricing");
        const snap = await getDoc(docRef);
        if(snap.exists()) {
            currentPrice = snap.data().amount;
            document.getElementById('displayPrice').innerText = currentPrice;
            if(auth.currentUser.email === SUPER_ADMIN) {
                document.getElementById('newPriceInput').value = currentPrice;
            }
        }
    } catch(e) { console.log("Using default price"); }
}

window.updateGlobalPrice = async () => {
    const val = parseInt(document.getElementById('newPriceInput').value);
    if(val > 0) {
        await setDoc(doc(db, "config", "pricing"), { amount: val });
        alert("Price updated!");
        location.reload();
    }
};

// --- LOCATION (Google Maps Style) ---
window.initLocationFlow = () => {
    document.getElementById('location-modal').style.display = 'flex';
    window.renderLocationList(MOMBASA_LOCATIONS);
};

window.renderLocationList = (locations) => {
    const list = document.getElementById('locationList');
    list.innerHTML = '';
    locations.forEach(loc => {
        list.innerHTML += `
            <div class="map-item" onclick="window.selectLocation('${loc.name}, ${loc.detail}')">
                <div class="map-icon"><i class="fa-solid fa-location-dot"></i></div>
                <div class="map-text">
                    <div class="map-name">${loc.name}</div>
                    <div class="map-detail">${loc.detail}</div>
                </div>
                <div class="map-dist">${loc.dist}</div>
            </div>
        `;
    });
};

window.filterLocations = () => {
    const q = document.getElementById('locSearch').value.toLowerCase();
    const filtered = MOMBASA_LOCATIONS.filter(l => 
        l.name.toLowerCase().includes(q) || l.detail.toLowerCase().includes(q)
    );
    window.renderLocationList(filtered);
};

window.selectLocation = async (addr) => {
    userLocation = addr;
    document.getElementById('currentCoords').innerText = addr;
    document.getElementById('location-modal').style.display = 'none';
    if(auth.currentUser) await setDoc(doc(db, "users", auth.currentUser.uid), { location: addr }, { merge: true });
};

async function loadUserLocation() {
    const d = await getDoc(doc(db, "users", auth.currentUser.uid));
    if(d.exists() && d.data().location) {
        userLocation = d.data().location;
        document.getElementById('currentCoords').innerText = userLocation;
    }
}

// --- SHOP & M-PESA ---
window.updateQty = (n) => {
    const el = document.getElementById('shopQty');
    let v = parseInt(el.innerText) + n;
    if(v < 30) v = 30;
    el.innerText = v;
};

window.initiateOrder = () => {
    if(!userLocation) {
        alert("Please set your location first.");
        return window.initLocationFlow();
    }
    const qty = parseInt(document.getElementById('shopQty').innerText);
    const total = qty * currentPrice;

    // Show M-Pesa Modal
    document.getElementById('mpesaAmount').innerText = total;
    document.getElementById('mpesa-modal').style.display = 'flex';
};

window.startMpesaProcess = async () => {
    const phone = document.getElementById('mpesaPhone').value;
    if(phone.length < 10) return alert("Enter valid M-Pesa number");

    const btn = document.querySelector('.mpesa-btn');
    btn.innerText = "Processing STK Push...";
    btn.disabled = true;

    // SIMULATION OF STK PUSH (Since we have no backend)
    setTimeout(async () => {
        const qty = parseInt(document.getElementById('shopQty').innerText);
        const total = qty * currentPrice;

        try {
            await addDoc(collection(db, "orders"), {
                userId: auth.currentUser.uid,
                item: "Tray of 30",
                quantity: qty,
                totalPrice: total,
                status: "Paid",
                address: userLocation,
                phone: phone,
                createdAt: new Date()
            });

            // Create Notification
            await addDoc(collection(db, "notifications"), {
                userId: auth.currentUser.uid,
                message: `Order Confirmed: ${qty} Trays to ${userLocation}`,
                read: false,
                timestamp: new Date()
            });

            alert("Payment Successful! Order Placed.");
            document.getElementById('mpesa-modal').style.display = 'none';
            btn.innerText = "Pay Now";
            btn.disabled = false;
            window.showPage('orders', document.querySelectorAll('.nav-item')[2]);

        } catch(e) {
            alert("Error: " + e.message);
            btn.disabled = false;
        }
    }, 3000); // 3 second delay to simulate phone pin prompt
};


// --- NOTIFICATIONS (Dropdown Logic) ---
window.toggleNotifDropdown = () => {
    const d = document.getElementById('notifDropdown');
    d.style.display = d.style.display === 'block' ? 'none' : 'block';
};

function listenToNotifications() {
    if(!auth.currentUser) return;
    const q = query(collection(db, "notifications"), where("userId", "==", auth.currentUser.uid));
    
    onSnapshot(q, (snap) => {
        const list = document.getElementById('notifList');
        const badge = document.getElementById('notifBadge');
        
        if(snap.empty) {
            badge.style.display = 'none';
            list.innerHTML = '<p class="empty-msg">No new notifications</p>';
        } else {
            badge.style.display = 'block';
            list.innerHTML = '';
            const docs = snap.docs.map(d => d.data()).sort((a,b) => b.timestamp - a.timestamp);
            
            docs.forEach(n => {
                list.innerHTML += `
                    <div class="notif-item">
                        <i class="fa-solid fa-circle-info"></i>
                        <div>${n.message}</div>
                    </div>
                `;
            });
        }
    });
}

// --- ORDERS LIST ---
function listenToOrders() {
    if(!auth.currentUser) return;
    const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('ordersList');
        document.getElementById('homeOrderCount').innerText = snap.size;
        
        list.innerHTML = snap.empty ? '<p style="text-align:center; padding:20px; color:#999;">No orders yet.</p>' : '';
        
        snap.docs.forEach(d => {
            const o = d.data();
            list.innerHTML += `
                <div class="mini-order">
                    <div class="icon-box"><i class="fa-solid fa-check"></i></div>
                    <div class="details">
                        <h4>${o.quantity}x Trays</h4>
                        <small>${o.status} &bull; ${o.address}</small>
                    </div>
                    <span class="price">Ksh ${o.totalPrice}</span>
                </div>
            `;
        });
    });
}

// --- NAVIGATION ---
window.showPage = (id, el) => {
    document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
    const t = document.getElementById(id);
    if(t) { t.style.display = 'block'; setTimeout(() => t.classList.add('active'), 10); }
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
};
const hBtn = document.getElementById('heroOrderBtn');
if(hBtn) hBtn.onclick = () => window.showPage('shop', document.querySelectorAll('.nav-item')[1]);
