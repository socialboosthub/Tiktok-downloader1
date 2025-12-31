import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const ADMINS = ["ashrafsquad001@gmail.com", "abdulraxmanxamza@gmail.com"];
let userLocation = null;
let map, marker;

// --- AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-overlay').style.display = 'none';
        document.body.classList.remove('not-logged-in');
        
        // ADMIN CHECK
        if(ADMINS.includes(user.email)) {
            document.getElementById('adminBtn').style.display = 'flex';
        }

        updateUI(user);
        listenToOrders();
        listenToNotifications();
        listenToPrice();
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
});

// --- GOOGLE MAPS STYLE SEARCH ---
window.openMapModal = () => {
    document.getElementById('map-modal').style.display = 'flex';
    if (!map) {
        map = L.map('mapContainer').setView([-4.0435, 39.6682], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        marker = L.marker([-4.0435, 39.6682], {draggable: true}).addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 200);
};

window.searchMap = async () => {
    const query = document.getElementById('mapSearchInput').value;
    if(!query) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}, Mombasa`);
    const data = await res.json();
    if(data.length > 0) {
        const {lat, lon} = data[0];
        map.setView([lat, lon], 15);
        marker.setLatLng([lat, lon]);
    } else { alert("Location not found in Mombasa"); }
};

window.confirmLocation = () => {
    const pos = marker.getLatLng();
    userLocation = { lat: pos.lat, lng: pos.lng };
    document.getElementById('currentCoords').innerText = `Location Pinned`;
    document.getElementById('map-modal').style.display = 'none';
};

// --- LOGIC ---
window.placeOrder = async () => {
    if(!userLocation) return alert("Please set delivery location in Settings first!");
    const phone = document.getElementById('mpesaNumber').value;
    if(!phone) return alert("Enter M-Pesa Number");

    const qty = parseInt(document.getElementById('shopQty').innerText);
    const price = parseInt(document.getElementById('dynamicPrice').innerText);

    await addDoc(collection(db, "orders"), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName,
        phone, qty, total: qty * price,
        status: "Pending Payment",
        location: userLocation,
        createdAt: new Date()
    });

    await addDoc(collection(db, "notifications"), {
        userId: auth.currentUser.uid,
        message: `Order for ${qty} trays placed! Pay via M-Pesa.`,
        timestamp: new Date()
    });

    alert("M-Pesa Prompt Sent!");
};

// Original Functions Restored
window.updateQty = (c) => {
    let s = document.getElementById('shopQty');
    let v = parseInt(s.innerText) + c;
    if(v < 30) v = 30;
    s.innerText = v;
};

window.toggleTheme = () => {
    const isDark = document.getElementById('themeToggle').checked;
    if(isDark) document.body.setAttribute('data-theme', 'dark');
    else document.body.removeAttribute('data-theme');
};

window.showPage = (id, el) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(el) el.classList.add('active');
};

function listenToNotifications() {
    const q = query(collection(db, "notifications"), where("userId", "==", auth.currentUser.uid));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('fullNotifList');
        list.innerHTML = '';
        snap.forEach(doc => {
            const n = doc.data();
            list.innerHTML += `<div class="notif-card"><p>${n.message}</p></div>`;
        });
    });
}
// (Include your other original helper functions here)
