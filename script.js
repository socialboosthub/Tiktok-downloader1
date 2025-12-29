import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// These are the tools to talk to your new Cloud Database
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // This connects to the database in your screenshot
const provider = new GoogleAuthProvider();

// --- AUTH LOGIC ---
onAuthStateChanged(auth, (user) => {
    const loginOverlay = document.getElementById('login-overlay');
    if (user) {
        loginOverlay.style.display = 'none';
        document.body.classList.remove('not-logged-in');
        updateOrderCount();
    } else {
        loginOverlay.style.display = 'flex';
        document.body.classList.add('not-logged-in');
    }
});

// --- CLOUD DATABASE FUNCTIONS ---

window.placeOrder = async (name, price) => {
    const user = auth.currentUser;
    if(!user) return alert("Please login first!");

    try {
        // This saves the order to your Firestore 'orders' collection
        await addDoc(collection(db, "orders"), {
            userId: user.uid,        // Ties the order to THIS specific account
            item: name,
            price: price,
            status: 'Pending',
            createdAt: new Date()    
        });
        
        alert("Order placed in the cloud! 🥚");
        updateOrderCount();
    } catch (e) {
        alert("Error: " + e.message);
    }
};

async function renderOrders() {
    const user = auth.currentUser;
    const list = document.getElementById('ordersList');
    if(!user) return;

    list.innerHTML = "<p style='text-align:center;'>Fetching orders...</p>";

    // Get ONLY orders where userId matches the logged-in user
    const q = query(
        collection(db, "orders"), 
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        list.innerHTML = `<p style="text-align:center; padding:20px;">No orders found for this account.</p>`;
        return;
    }

    let html = "";
    querySnapshot.forEach((doc) => {
        const o = doc.data();
        html += `
            <div class="order-item" style="background:var(--card); margin:10px; padding:15px; border-radius:12px; display:flex; justify-content:space-between; border-left:4px solid #fab1a0; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                <div><b>${o.item}</b><br><small>${o.createdAt.toDate().toLocaleDateString()}</small></div>
                <div style="text-align:right">Ksh ${o.price}<br><span style="color:#e17055; font-size:12px; font-weight:bold;">${o.status}</span></div>
            </div>
        `;
    });
    list.innerHTML = html;
}

async function updateOrderCount() {
    const user = auth.currentUser;
    if(!user) return;
    const q = query(collection(db, "orders"), where("userId", "==", user.uid));
    const querySnapshot = await getDocs(q);
    document.getElementById('orderCount').innerText = querySnapshot.size;
}

// --- NAVIGATION ---
window.showPage = (pageId, element) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    element.classList.add('active');
    
    if(pageId === 'orders') renderOrders();
};

// --- LOGIN/LOGOUT ---
window.loginWithGoogle = () => signInWithPopup(auth, provider);
window.logoutUser = () => signOut(auth).then(() => location.reload());

// Apply Login Button
document.getElementById('google-login-btn').onclick = window.loginWithGoogle;
