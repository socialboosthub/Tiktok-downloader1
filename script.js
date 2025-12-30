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
    // 1. Ask the user what they want to do
    const choice = confirm("Press OK to use GPS, or Cancel to type address manually.");

    if (choice) {
        // User wants GPS
        if (!navigator.geolocation) {
            alert("GPS not supported by your browser. Please enter manually.");
            promptAddress();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                // Success
                userLocation = { 
                    lat: pos.coords.latitude, 
                    lng: pos.coords.longitude, 
                    address: "GPS Location (Lat/Lng)", 
                    timestamp: new Date() 
                };
                saveLoc();
            }, 
            (err) => {
                // Error / Denied
                console.error(err);
                alert("GPS permission was denied or failed. Please type your address.");
                promptAddress();
            }
        );
    } else {
        // User cancelled, wants manual entry
        promptAddress();
    }
};

function promptAddress() {
    const address = prompt("Enter your Delivery Address (e.g., Estate Name, House No):");
    if (address && address.length > 2) {
        userLocation = { lat: null, lng: null, address: address, timestamp: new Date() };
        saveLoc();
    }
}

async function saveLoc() {
    if(!userLocation) return;
    document.getElementById('currentCoords').innerText = userLocation.address;
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
        if(setNow) window.showPage('settings', document.querySelectorAll('.nav-item')[3]);
        return;
    }

    // NEW LOGIC: Find the quantity relative to the clicked button
    let quantity = 1;
    try {
        // Look for the .qty-control div inside the same container (action-row)
        const parentRow = btnElement.closest('.action-row');
        const qtySpan = parentRow.querySelector('.qty-display');
        quantity = parseInt(qtySpan.innerText);
    } catch(e) {
        console.error("Could not find quantity, defaulting to 1", e);
    }

    const totalPrice = unitPrice * quantity;

    await addDoc(collection(db, "orders"), {
        userId: auth.currentUser.uid,
        item: item, 
        unitPrice: unitPrice,
        quantity: quantity,     // Save quantity
        totalPrice: totalPrice, // Save total
        status: 'Pending',
        address: userLocation.address,
        createdAt: new Date()
    });
    
    alert(`Order Placed!\n${quantity}x ${item}\nTotal: Ksh ${totalPrice}`);
};

function listenToOrders() {
    if(!auth.currentUser) return;
    
    // Sort orders by createdAt so recent ones are last/first
    const q = query(
        collection(db, "orders"), 
        where("userId", "==", auth.currentUser.uid),
        orderBy("createdAt", "asc")
    );

    onSnapshot(q, (snap) => {
        // 1. Update Count on Home
        document.getElementById('homeOrderCount').innerText = snap.size;

        if (!snap.empty) {
            // 2. Update Recent Activity Card (Last order)
            const last = snap.docs[snap.docs.length - 1].data();
            
            // Format: "2x Tray of 30"
            const qtyStr = last.quantity ? `${last.quantity}x ` : '1x ';
            const priceStr = last.totalPrice ? last.totalPrice : last.price; // Handle old vs new data

            document.getElementById('recentItemName').innerText = qtyStr + last.item;
            document.getElementById('recentStatusText').innerText = "Status: " + last.status;
            document.getElementById('recentPrice').innerText = "Ksh " + priceStr;
        }
    });
}

async function renderOrders() {
    if(!auth.currentUser) return;

    // Use orderBy desc for list view (newest first)
    const q = query(
        collection(db, "orders"), 
        where("userId", "==", auth.currentUser.uid), 
        orderBy("createdAt", "desc")
    );
    
    const snap = await getDocs(q);
    const list = document.getElementById('ordersList');
    list.innerHTML = snap.empty ? '<p style="text-align:center;color:#888;margin-top:20px;">No orders yet.</p>' : '';
    
    snap.forEach(d => {
        const o = d.data();
        // Handle fallback for old orders without quantity/totalPrice
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

// --- NAV ---
window.showPage = (id, el) => {
    document.querySelectorAll('.page').forEach(p => { p.style.display = 'none'; p.classList.remove('active'); });
    const target = document.getElementById(id);
    target.style.display = 'block';
    
    // Small delay to allow display:block to render before opacity transition
    setTimeout(() => target.classList.add('active'), 10);
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if(el) el.classList.add('active');
    
    if(id === 'orders') renderOrders();
};

document.getElementById('heroOrderBtn').onclick = () => window.showPage('shop', document.querySelectorAll('.nav-item')[1]);
window.logoutUser = () => signOut(auth).then(() => location.reload());
document.getElementById('google-login-btn').onclick = () => signInWithPopup(auth, provider);

// Qty Counters - Setup Event Listeners
document.querySelectorAll('.qty-control').forEach(ctrl => {
    const s = ctrl.querySelector('.qty-display');
    const btnMinus = ctrl.children[0];
    const btnPlus = ctrl.children[2]; // Index 2 because span is index 1

    btnMinus.onclick = () => { 
        let v = parseInt(s.innerText); 
        if(v > 1) s.innerText = v - 1; 
    };
    
    btnPlus.onclick = () => { 
        let v = parseInt(s.innerText);
        s.innerText = v + 1; 
    };
});
