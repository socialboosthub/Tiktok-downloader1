import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, doc, getDoc, setDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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
const storage = getStorage(app); 
const provider = new GoogleAuthProvider();

let userLocation = null;
let currentEggPrice = 385; 

const MOMBASA_AREAS = ["Nyali", "Bamburi", "Tudor", "Kizingo", "Mtwapa", "Likoni", "Changamwe", "Mikindani", "Ganjoni", "Mombasa Island", "Shanzu", "Mkomani"];

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
        fetchLivePrice(); 
        listenToOrders();
        listenToNotifications(); 
    } else {
        if(overlay) overlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

// --- ADMIN UI LOGIC (REWRITTEN & BULLETPROOF) ---
function updateUIWithUser(user) {
    if(document.getElementById('usernameDisplay')) 
        document.getElementById('usernameDisplay').innerText = user.displayName || "Wholesaler";
    if(document.getElementById('userPhoto') && user.photoURL) 
        document.getElementById('userPhoto').src = user.photoURL;

    const email = user.email ? user.email.toLowerCase().trim() : "";
    let role = null;
    if (email === "ashrafsquad001@gmail.com") role = "SUPER";
    else if (email === "abdulraxmanxamza@gmail.com") role = "MANAGER";

    if (role) {
        // Start a loop to find the HTML elements in case they haven't loaded yet
        const injectInterval = setInterval(() => {
            const header = document.querySelector('.header-actions');
            const settings = document.querySelector('.settings-section');

            // Inject Header Button
            if (header && !document.getElementById('header-admin-btn')) {
                const btn = document.createElement('div');
                btn.id = "header-admin-btn";
                btn.className = "icon-btn";
                btn.style.cssText = `background: ${role === "SUPER" ? "#E3F2FD" : "#E8F5E9"}; color: ${role === "SUPER" ? "#1565C0" : "#2E7D32"}; margin-right: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid currentColor; z-index: 1000;`;
                btn.innerHTML = role === "SUPER" ? '<i class="fa-solid fa-crown"></i>' : '<i class="fa-solid fa-truck-fast"></i>';
                btn.onclick = () => window.location.href = 'admin.html';
                header.insertBefore(btn, header.firstChild);
            }

            // Inject Settings Button
            if (settings && !document.getElementById('admin-entry-btn')) {
                const sBtn = document.createElement('div');
                sBtn.id = "admin-entry-btn";
                sBtn.innerHTML = `
                    <div class="setting-item clickable" onclick="window.location.href='admin.html'" 
                         style="background: ${role === "SUPER" ? '#e3f2fd' : '#e8f5e9'}; border: 2px solid ${role === "SUPER" ? '#2196F3' : '#4CAF50'}; border-radius: 12px; margin-bottom: 15px; padding: 15px; display: flex; align-items: center; cursor: pointer;">
                        <div class="icon-wrap" style="background: ${role === "SUPER" ? '#2196F3' : '#4CAF50'}; color: white; width: 35px; height: 35px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                            <i class="fa-solid ${role === "SUPER" ? 'fa-crown' : 'fa-truck-fast'}"></i>
                        </div>
                        <div class="text" style="color: ${role === "SUPER" ? '#0d47a1' : '#1b5e20'}; font-weight: 700; flex: 1;">
                            ${role === "SUPER" ? 'SUPER ADMIN PANEL' : 'DELIVERY DASHBOARD'}
                        </div>
                        <i class="fa-solid fa-arrow-right arrow"></i>
                    </div>`;
                settings.insertBefore(sBtn, settings.firstChild);
            }

            // Stop loop if both are added
            if (document.getElementById('header-admin-btn') && document.getElementById('admin-entry-btn')) {
                clearInterval(injectInterval);
            }
        }, 1000);
        setTimeout(() => clearInterval(injectInterval), 10000); // Fail-safe stop
    }
}

// --- ORDERING & FIREBASE FUNCTIONS ---
window.handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { alert("Login Failed: " + error.message); }
};
const loginBtn = document.getElementById('google-login-btn');
if (loginBtn) loginBtn.onclick = window.handleLogin;

async function fetchLivePrice() {
    onSnapshot(doc(db, "config", "pricing"), (doc) => {
        currentEggPrice = doc.exists() ? doc.data().currentPrice : 385;
        if(document.getElementById('dynamicPriceDisplay')) document.getElementById('dynamicPriceDisplay').innerText = currentEggPrice;
    });
}

window.updateQty = (change) => {
    const display = document.getElementById('shopQty');
    let newVal = parseInt(display.innerText) + change;
    if(newVal < 30) newVal = 30;
    display.innerText = newVal;
};

window.initiateOrder = () => {
    if (!auth.currentUser) return alert("Please login first.");
    if (!userLocation) {
        if(confirm("No delivery address! Set one now?")) window.showPage('settings', document.querySelectorAll('.nav-item')[3]);
        return;
    }
    const quantity = parseInt(document.getElementById('shopQty').innerText);
    document.getElementById('mpesaTotalDisplay').innerText = (quantity * currentEggPrice).toLocaleString();
    document.getElementById('mpesa-modal').style.display = 'flex';
};

window.triggerMpesa = async () => {
    const phone = document.getElementById('mpesaNumber').value;
    const btn = document.getElementById('payBtn');
    if(phone.length < 10) return alert("Valid number required");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...`;
    setTimeout(async () => {
        await finalizeOrder(phone);
        btn.disabled = false;
        btn.innerHTML = "Pay Now";
        document.getElementById('mpesa-modal').style.display = 'none';
    }, 3000);
};

function generateOrderCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 5; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

async function finalizeOrder(mpesaNumber) {
    const quantity = parseInt(document.getElementById('shopQty').innerText);
    const totalPrice = quantity * currentEggPrice;
    const deliveryCode = generateOrderCode();
    try {
        await addDoc(collection(db, "orders"), {
            userId: auth.currentUser.uid, userName: auth.currentUser.displayName,
            item: "Tray of 30", unitPrice: currentEggPrice, quantity, totalPrice,
            status: 'Pending', mpesaNumber, address: userLocation.address,
            deliveryCode, createdAt: new Date()
        });
        alert(`Order Placed! CODE: ${deliveryCode}`);
        window.showPage('orders', document.querySelectorAll('.nav-item')[2]);
    } catch(e) { alert(e.message); }
}

window.openProfileModal = () => {
    document.getElementById('editNameInput').value = auth.currentUser.displayName || "";
    document.getElementById('profile-modal').style.display = 'flex';
};

window.closeProfileModal = () => { document.getElementById('profile-modal').style.display = 'none'; };

window.saveProfile = async () => {
    const name = document.getElementById('editNameInput').value;
    if(!name) return;
    await updateProfile(auth.currentUser, { displayName: name });
    await setDoc(doc(db, "users", auth.currentUser.uid), { name }, { merge: true });
    location.reload();
};

async function loadUserSettings() {
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.theme === 'dark') document.body.setAttribute('data-theme', 'dark');
        if (data.location) {
            userLocation = data.location;
            document.getElementById('currentCoords').innerText = data.location.address;
        }
    }
}

window.toggleTheme = async () => {
    const theme = document.getElementById('themeToggle').checked ? 'dark' : 'light';
    theme === 'dark' ? document.body.setAttribute('data-theme', 'dark') : document.body.removeAttribute('data-theme');
    await setDoc(doc(db, "users", auth.currentUser.uid), { theme }, { merge: true });
};

window.initLocationFlow = () => {
    const area = prompt("Enter your area in Mombasa (e.g. Nyali, Bamburi):");
    if(area) {
        userLocation = { address: area + ", Mombasa" };
        document.getElementById('currentCoords').innerText = userLocation.address;
        setDoc(doc(db, "users", auth.currentUser.uid), { location: userLocation }, { merge: true });
    }
};

function listenToOrders() {
    const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('ordersList');
        list.innerHTML = '';
        snap.forEach(doc => {
            const o = doc.data();
            list.innerHTML += `<div class="mini-order">
                <div class="details"><h4>${o.quantity}x Tray</h4><small>${o.status}</small><br><b>Code: ${o.deliveryCode}</b></div>
                <span class="price">Ksh ${o.totalPrice}</span>
            </div>`;
        });
    });
}

function listenToNotifications() {
    const q = query(collection(db, "notifications"), where("userId", "==", auth.currentUser.uid));
    onSnapshot(q, (snap) => {
        const badge = document.getElementById('notifBadge');
        badge.style.display = snap.empty ? 'none' : 'block';
    });
}

window.showPage = (id, el) => {
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(id).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
};

window.logoutUser = () => signOut(auth).then(() => location.reload());
