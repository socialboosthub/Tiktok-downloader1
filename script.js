import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// Add Firestore imports
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBrvdknWfFKdl9Bn8TJRrpWEc2RQDEHZqE",
    authDomain: "eggshop-702f6.firebaseapp.com",
    projectId: "eggshop-702f6",
    storageBucket: "eggshop-702f6.firebasestorage.app",
    messagingSenderId: "290586261198",
    appId: "1:290586261198:web:61cd80463c8c2c5f06429f",
    measurementId: "G-HVJKWCER6S"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Cloud Database
const provider = new GoogleAuthProvider();

// --- AUTH STATE ---
onAuthStateChanged(auth, (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (user) {
        loginOverlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        updateOrderCount();
        loadUserSettings();
    } else {
        loginOverlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

// --- CLOUD DATABASE LOGIC ---

// 1. SAVE ORDER TO CLOUD
window.placeOrder = async (name, price) => {
    const user = auth.currentUser;
    if(!user) return alert("Login first!");

    try {
        await addDoc(collection(db, "orders"), {
            userId: user.uid,        // Linked to the specific user
            userEmail: user.email,
            item: name,
            price: price,
            status: 'Processing',
            createdAt: new Date()    // Server timestamp
        });
        
        alert("Order sent to Cloud! 🚀");
        updateOrderCount();
    } catch (e) {
        console.error("Error adding document: ", e);
    }
};

// 2. FETCH ORDERS FROM CLOUD
async function renderOrders() {
    const user = auth.currentUser;
    const list = document.getElementById('ordersList');
    if(!user) return;

    list.innerHTML = "<p style='text-align:center;'>Loading your cloud orders...</p>";

    // Query: Get orders WHERE userId is equal to current user UID
    const q = query(
        collection(db, "orders"), 
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        list.innerHTML = `<p style="text-align:center; padding:20px;">No cloud orders found for ${user.email}</p>`;
        return;
    }

    let html = "";
    querySnapshot.forEach((doc) => {
        const o = doc.data();
        html += `
            <div class="order-item" style="background:var(--card); margin:10px; padding:15px; border-radius:10px; display:flex; justify-content:space-between; border-left:4px solid #fab1a0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div><b>${o.item}</b><br><small>${o.createdAt.toDate().toLocaleString()}</small></div>
                <div style="text-align:right">Ksh ${o.price}<br><span style="color:#e17055; font-size:12px; font-weight:bold;">${o.status}</span></div>
            </div>
        `;
    });
    list.innerHTML = html;
}

// 3. UPDATE COUNT
async function updateOrderCount() {
    const user = auth.currentUser;
    if(!user) return;
    const q = query(collection(db, "orders"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    const countEl = document.getElementById('orderCount');
    if(countEl) countEl.innerText = querySnapshot.size;
}

// --- APP NAVIGATION ---
window.showPage = (pageId, element) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    if(element) element.classList.add('active');
    
    if(pageId === 'orders') renderOrders();
};

// --- AUTH ACTIONS ---
window.loginWithGoogle = () => signInWithPopup(auth, provider);
window.logoutUser = () => signOut(auth).then(() => location.reload());

window.toggleTheme = () => {
    const isDark = document.getElementById('themeToggle').checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('app_theme', isDark ? 'dark' : 'light');
};

function loadUserSettings() {
    const theme = localStorage.getItem('app_theme') || 'light';
    if(theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if(document.getElementById('themeToggle')) document.getElementById('themeToggle').checked = true;
    }
}
