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

// --- 1. AUTH & INITIALIZATION ---
onAuthStateChanged(auth, async (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (user) {
        loginOverlay.style.opacity = '0';
        setTimeout(() => { loginOverlay.style.display = 'none'; document.body.classList.remove('not-logged-in'); }, 500);
        
        document.getElementById('usernameDisplay').innerText = user.displayName || "Egg Lover 🍳";
        const profileImg = document.querySelector('.profile-pic img');
        if(profileImg && user.photoURL) profileImg.src = user.photoURL;

        await loadUserSettings();
        listenToOrders(); // Real-time tracking for Home stats
    } else {
        loginOverlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

// --- 2. LOCATION LOGIC ---
window.updateLocation = function() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }

    const statusText = document.getElementById('locationStatus');
    const coordsText = document.getElementById('currentCoords');
    
    statusText.innerText = "Locating...";

    navigator.geolocation.getCurrentPosition(async (position) => {
        userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date()
        };

        // UI Update
        statusText.innerText = "Location Saved";
        coordsText.innerText = `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;

        // Save to Cloud
        const user = auth.currentUser;
        if (user) {
            await setDoc(doc(db, "users", user.uid), { location: userLocation }, { merge: true });
        }
        alert("Default delivery location updated! 📍");
    }, (error) => {
        statusText.innerText = "Location Access Denied";
        alert("Please enable location permissions in your settings.");
    });
};

// --- 3. REAL-TIME ORDER TRACKING ---
// --- 3. REAL-TIME ORDER TRACKING ---
function listenToOrders() {
    const user = auth.currentUser;
    if(!user) return;

    const q = query(collection(db, "orders"), where("userId", "==", user.uid));
    
    // This watches Firebase for changes and updates the UI instantly
    onSnapshot(q, (snapshot) => {
        const count = snapshot.size;
        
        // 1. Update the Home Stat Card (The "12" you saw)
        const orderStat = document.getElementById('homeOrderCount');
        if(orderStat) {
            orderStat.innerText = count;
        }
        
        // 2. Update the "Recent Activity" text below the stats
        const recentActivityText = document.querySelector('.mini-order .details small');
        if(recentActivityText) {
            recentActivityText.innerText = count > 0 
                ? `You have ${count} total orders` 
                : "No recent activity";
        }

        // 3. Update the item name in the recent activity preview to show the last order
        const recentActivityTitle = document.querySelector('.mini-order .details h4');
        if(recentActivityTitle && !snapshot.empty) {
            // Get the most recent order from the snapshot
            const lastOrder = snapshot.docs[snapshot.docs.length - 1].data();
            recentActivityTitle.innerText = lastOrder.item;
            
            // Update the price on the home preview too
            const recentPrice = document.querySelector('.mini-order .price');
            if(recentPrice) recentPrice.innerText = `Ksh ${lastOrder.price}`;
        }
    });
}


// --- 4. ORDERING WITH LOCATION ---
window.placeOrder = async (name, price) => {
    const user = auth.currentUser;
    if(!user) return;
    
    // Ask for location if not set
    if(!userLocation) {
        const confirmLoc = confirm("No delivery location set. Set your current location as default now?");
        if(confirmLoc) {
            window.updateLocation();
            return; // Stop and let them set location first
        }
    }

    try {
        await addDoc(collection(db, "orders"), {
            userId: user.uid,
            item: name,
            price: price,
            status: 'Pending',
            location: userLocation, // Attach location to the order
            createdAt: new Date()
        });
        alert(`Order for ${name} placed! 🥚`);
    } catch (e) { alert("Error: " + e.message); }
};

// --- 5. NAVIGATION & UI ---
window.showPage = (pageId, navElement) => {
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
    });
    const target = document.getElementById(pageId);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
    }
    if(navElement) {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        navElement.classList.add('active');
    }
    if(pageId === 'orders') renderOrders();
};

// Link "Order Now" Hero button to Shop
document.querySelector('.hero-text button').onclick = () => {
    window.showPage('shop', document.querySelectorAll('.nav-item')[1]);
};

// Load Location from Cloud on Start
async function loadUserSettings() {
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if(userDoc.exists()) {
        const data = userDoc.data();
        if(data.location) {
            userLocation = data.location;
            const coordsText = document.getElementById('currentCoords');
            if(coordsText) coordsText.innerText = `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`;
        }
        // Handle Theme/Lang
        if(data.theme === 'dark') document.body.setAttribute('data-theme', 'dark');
    }
}

// --- REST OF UTILS ---
window.loginWithGoogle = () => signInWithPopup(auth, provider);
window.logoutUser = () => signOut(auth).then(() => location.reload());
document.getElementById('google-login-btn').onclick = window.loginWithGoogle;

// Handle Quantity Buttons
document.querySelectorAll('.qty-control').forEach(control => {
    const btnMinus = control.querySelector('button:first-child');
    const btnPlus = control.querySelector('button:last-child');
    const span = control.querySelector('span');
    btnMinus.onclick = () => { let v = parseInt(span.innerText); if(v > 1) span.innerText = v - 1; };
    btnPlus.onclick = () => { let v = parseInt(span.innerText); span.innerText = v + 1; };
});
