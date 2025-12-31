import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, doc, getDoc, setDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBrvdknWfFKdl9Bn8TJRrpWEc2RQDEHZqE",
    authDomain: "eggshop-702f6.firebaseapp.com",
    projectId: "eggshop-702f6",
    storageBucket: "eggshop-702f6.firebasestorage.app",
    messagingSenderId: "290586261198",
    appId: "1:290586261198:web:61cd80463c8c2c5f06429f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentPrice = 450; // Default fallback
let userLocation = null;
let map, marker;
const ADMIN_EMAILS = ["ashrafsquad001@gmail.com", "abdulraxmanxamza@gmail.com"];

// --- AUTH ---
onAuthStateChanged(auth, async (user) => {
    const overlay = document.getElementById('login-overlay');
    if (user) {
        if(overlay) overlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        
        updateUIWithUser(user);
        loadUserLocation();
        listenToNotifications();
        listenToPrice(); // Fetch live price
        
        // Show Admin Button if admin
        if(ADMIN_EMAILS.includes(user.email)) {
            document.getElementById('adminLink').style.display = 'flex';
        }
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
if(document.getElementById('google-login-btn'))
    document.getElementById('google-login-btn').onclick = window.handleLogin;

// --- DYNAMIC PRICING ---
function listenToPrice() {
    // Listens to the 'products/eggs' document
    onSnapshot(doc(db, "products", "eggs"), (doc) => {
        if(doc.exists()) {
            currentPrice = doc.data().price;
            document.getElementById('dynamicPrice').innerText = currentPrice;
        } else {
            // Initialize if not exists
            setDoc(doc.ref, { price: 450 });
            document.getElementById('dynamicPrice').innerText = 450;
        }
    });
}

// --- MAP & LOCATION (LEAFLET) ---
window.openMapModal = () => {
    document.getElementById('map-modal').style.display = 'flex';
    
    if (!map) {
        // Init Map centered on Mombasa
        map = L.map('mapContainer').setView([-4.0435, 39.6682], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        // Add draggable marker
        marker = L.marker([-4.0435, 39.6682], {draggable: true}).addTo(map);
    }
    
    // Resize map correctly after modal opens
    setTimeout(() => { map.invalidateSize(); }, 200);
};

window.confirmLocation = async () => {
    const latLng = marker.getLatLng();
    userLocation = {
        lat: latLng.lat,
        lng: latLng.lng,
        address: `Lat: ${latLng.lat.toFixed(4)}, Lng: ${latLng.lng.toFixed(4)}`
    };
    
    document.getElementById('currentCoords').innerText = "Location Set (Mombasa)";
    document.getElementById('map-modal').style.display = 'none';
    
    if(auth.currentUser) {
        await setDoc(doc(db, "users", auth.currentUser.uid), { location: userLocation }, { merge: true });
    }
};

async function loadUserLocation() {
    if(!auth.currentUser) return;
    const docSnap = await getDoc(doc(db, "users", auth.currentUser.uid));
    if(docSnap.exists() && docSnap.data().location) {
        userLocation = docSnap.data().location;
        document.getElementById('currentCoords').innerText = "Location Set";
    }
}

// --- ORDERS & MPESA ---
window.updateQty = (change) => {
    const display = document.getElementById('shopQty');
    let val = parseInt(display.innerText) + change;
    if(val < 30) val = 30; // Min 30
    display.innerText = val;
};

window.initiateOrder = async () => {
    if (!auth.currentUser) return;
    if (!userLocation) return alert("Please set your location on the map first!");
    
    const phone = document.getElementById('mpesaNumber').value;
    if (!phone || phone.length < 10) return alert("Please enter a valid M-Pesa number.");

    const qty = parseInt(document.getElementById('shopQty').innerText);
    const total = qty * currentPrice;

    // Simulate STK Push
    const confirmMsg = `Confirm order:\n${qty} Trays @ Ksh ${currentPrice}\nTotal: Ksh ${total}\n\nPhone: ${phone}\n\nAn M-Pesa prompt will appear on your phone shortly.`;
    
    if(confirm(confirmMsg)) {
        // 1. Save Order
        try {
            await addDoc(collection(db, "orders"), {
                userId: auth.currentUser.uid,
                userEmail: auth.currentUser.email,
                userName: auth.currentUser.displayName,
                item: "Tray of 30 Eggs",
                quantity: qty,
                totalPrice: total,
                phone: phone,
                status: 'Pending Payment',
                location: userLocation,
                createdAt: new Date()
            });

            // 2. Notification
            await addDoc(collection(db, "notifications"), {
                userId: auth.currentUser.uid,
                message: `Order for ${qty} trays received. Please complete M-Pesa payment.`,
                timestamp: new Date()
            });

            alert("Order Placed! Please check your phone for the M-Pesa PIN prompt.");
            window.showPage('notifications-page');
            
        } catch(e) {
            alert("Error placing order: " + e.message);
        }
    }
};

// --- NOTIFICATIONS ---
function listenToNotifications() {
    if(!auth.currentUser) return;
    const q = query(collection(db, "notifications"), where("userId", "==", auth.currentUser.uid));
    
    onSnapshot(q, (snap) => {
        const list = document.getElementById('fullNotifList');
        const badge = document.getElementById('notifBadge');
        if(snap.empty) {
            list.innerHTML = '<p class="empty-msg">No notifications.</p>';
            badge.style.display = 'none';
        } else {
            badge.style.display = 'block';
            list.innerHTML = '';
            const docs = snap.docs.map(d => d.data()).sort((a,b) => b.timestamp - a.timestamp);
            docs.forEach(n => {
                const date = n.timestamp && n.timestamp.toDate ? n.timestamp.toDate().toLocaleString() : '';
                list.innerHTML += `
                    <div class="notif-card">
                        <div class="notif-icon"><i class="fa-solid fa-bell"></i></div>
                        <div class="notif-content">
                            <div class="msg">${n.message}</div>
                            <div class="time">${date}</div>
                        </div>
                    </div>`;
            });
        }
    });
}

// --- PROFILE EDIT ---
window.openProfileModal = () => document.getElementById('profile-modal').style.display = 'flex';
window.closeProfileModal = () => document.getElementById('profile-modal').style.display = 'none';
window.saveProfile = async () => {
    const name = document.getElementById('editNameInput').value;
    const photo = document.getElementById('editPhotoInput').value;
    if(name && auth.currentUser) {
        try {
            await updateProfile(auth.currentUser, { displayName: name, photoURL: photo });
            await setDoc(doc(db, "users", auth.currentUser.uid), { name, photo }, { merge: true });
            document.getElementById('usernameDisplay').innerText = name;
            window.closeProfileModal();
        } catch(e) { alert(e.message); }
    }
};

window.logoutUser = () => signOut(auth).then(() => location.reload());

window.showPage = (id, el) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
};
