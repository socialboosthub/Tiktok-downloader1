import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, doc, getDoc, setDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
const loginBtn = document.getElementById('google-login-btn');
if (loginBtn) loginBtn.onclick = window.handleLogin;

// --- DYNAMIC PRICE ---
async function fetchLivePrice() {
    try {
        onSnapshot(doc(db, "config", "pricing"), (doc) => {
            if (doc.exists()) {
                currentEggPrice = doc.data().currentPrice || 385;
            }
            const priceDisplay = document.getElementById('dynamicPriceDisplay');
            if(priceDisplay) priceDisplay.innerText = currentEggPrice;
        });
    } catch(e) { console.error("Error fetching price", e); }
}

// --- ORDER LOGIC ---
window.updateQty = (change) => {
    const display = document.getElementById('shopQty');
    let current = parseInt(display.innerText);
    let newVal = current + change;
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
    const total = quantity * currentEggPrice;
    document.getElementById('mpesaTotalDisplay').innerText = total.toLocaleString();
    document.getElementById('mpesaCodeInput').value = "";
    document.getElementById('mpesa-modal').style.display = 'flex';
};

// ==========================================
// 🔥 ROBUST VERIFICATION LOGIC (With Strict Amount Check)
// ==========================================
window.verifyPayment = async () => {
    const codeInput = document.getElementById('mpesaCodeInput').value.toUpperCase().trim();
    const btn = document.getElementById('payBtn');
    
    // 1. Basic Validation
    if(codeInput.length < 10) return alert("Please enter a valid 10-character M-Pesa code.");

    const quantity = parseInt(document.getElementById('shopQty').innerText);
    const expectedTotal = quantity * currentEggPrice;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Checking Database (30s)...`;

    let attempts = 0;
    const maxAttempts = 10; // Check for ~30 seconds (10 * 3s)

    const pollLoop = setInterval(async () => {
        attempts++;
        console.log(`🔎 Check #${attempts} for code: ${codeInput}`);

        try {
            // 2. CHECK DATABASE for the code
            const docRef = doc(db, "mpesa_payments", codeInput);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                // 3. STOP POLLING - FOUND THE CODE
                clearInterval(pollLoop);
                
                // 4. CHECK IF ALREADY USED
                if (data.used) {
                    alert("❌ SCAM ALERT: This M-Pesa code has already been used!");
                    resetBtn();
                    return;
                }

                // 5. 🔥 STRICT AMOUNT CHECK 🔥
                // Prevents scams where user pays 1 Ksh but orders 100 Trays
                if (data.amount < expectedTotal) {
                    alert(`⚠️ PAYMENT MISMATCH!\n\nExpected: Ksh ${expectedTotal}\nPaid: Ksh ${data.amount}\n\nTransaction rejected due to insufficient funds.`);
                    resetBtn();
                    return;
                }

                // 6. SUCCESS! MARK AS USED IMMEDIATELY
                await updateDoc(docRef, { 
                    used: true, 
                    usedBy: auth.currentUser.uid,
                    claimedAt: new Date()
                });

                // 7. CREATE ORDER (Pass the M-Pesa phone number)
                await finalizeOrder(codeInput, data.phone); 
                document.getElementById('mpesa-modal').style.display = 'none';
                resetBtn();

            } else {
                // NOT FOUND YET
                if (attempts >= maxAttempts) {
                    clearInterval(pollLoop);
                    alert("❌ Payment Code Not Found.\n\n1. Ensure Admin has received the SMS.\n2. Ensure code matches exactly.\n3. Contact Support if deducted.");
                    resetBtn();
                }
            }
        } catch (err) {
            clearInterval(pollLoop);
            console.error(err);
            alert("Connection Error. Please try again.");
            resetBtn();
        }
    }, 3000); // Wait 3 seconds between checks

    function resetBtn() {
        btn.disabled = false;
        btn.innerHTML = "Verify Payment";
    }
};

function generateOrderCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function finalizeOrder(mpesaCode, phoneNumber) {
    const quantity = parseInt(document.getElementById('shopQty').innerText);
    const totalPrice = quantity * currentEggPrice;
    const item = "Tray of 30";
    const deliveryCode = generateOrderCode();

    // Prepare location data
    const locationData = {
        lat: userLocation.lat || null,
        lng: userLocation.lng || null
    };

    try {
        await addDoc(collection(db, "orders"), {
            userId: auth.currentUser.uid,
            userName: auth.currentUser.displayName || "Customer",
            item, 
            unitPrice: currentEggPrice, 
            quantity, 
            totalPrice,
            status: 'Pending',
            mpesaNumber: phoneNumber || "Verified", 
            mpesaCode: mpesaCode,
            address: userLocation.address,
            locationCoords: locationData,
            deliveryCode: deliveryCode, 
            createdAt: new Date()
        });
        
        await createNotification(`Order Placed! Your Delivery Code is: ${deliveryCode}`);
        
        // Show success and redirect
        alert(`✅ Payment Verified!\n\nYOUR DELIVERY CODE: ${deliveryCode}\n(Show this to the driver)`);
        window.showPage('orders', document.querySelectorAll('.nav-item')[2]);
        generateWhatsAppLink(quantity, totalPrice, userLocation.address, deliveryCode);

    } catch(e) {
        alert("Error saving order: " + e.message);
        console.error(e);
    }
}

function generateWhatsAppLink(qty, total, loc, code) {
    const btn = document.querySelector('.whatsapp-float');
    const msg = `Hi EggMaster, I ordered ${qty} Trays (Ksh ${total}). Loc: ${loc}. Code: ${code}`;
    if(btn) btn.href = `https://wa.me/254700000000?text=${encodeURIComponent(msg)}`;
}

// --- PROFILE & SETTINGS ---
window.openProfileModal = () => {
    const user = auth.currentUser;
    if(!user) return;
    document.getElementById('editNameInput').value = user.displayName || "";
    document.getElementById('previewImg').style.display = 'none'; 
    document.getElementById('profile-modal').style.display = 'flex';
};

window.closeProfileModal = () => { document.getElementById('profile-modal').style.display = 'none'; };

window.previewFile = () => {
    const file = document.getElementById('editPhotoFile').files[0];
    const preview = document.getElementById('previewImg');
    if(file){
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
    }
};

window.saveProfile = async () => {
    const name = document.getElementById('editNameInput').value;
    const fileInput = document.getElementById('editPhotoFile');
    const saveBtn = document.getElementById('saveProfileBtn');
    
    if(!name) return alert("Name cannot be empty");

    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;

    try {
        let photoURL = auth.currentUser.photoURL;
        if(fileInput.files.length > 0) {
            try {
                const file = fileInput.files[0];
                const storageRef = ref(storage, `profile_pics/${auth.currentUser.uid}`);
                await uploadBytes(storageRef, file);
                photoURL = await getDownloadURL(storageRef);
            } catch(photoError) { console.warn("Photo upload failed", photoError); }
        }

        await updateProfile(auth.currentUser, { displayName: name, photoURL: photoURL });
        await setDoc(doc(db, "users", auth.currentUser.uid), { name: name, photo: photoURL, email: auth.currentUser.email }, { merge: true });
        
        document.getElementById('usernameDisplay').innerText = name;
        if(photoURL) document.getElementById('userPhoto').src = photoURL;
        window.closeProfileModal();
        alert("Profile Updated!");
    } catch(e) { alert("Error: " + e.message); } 
    finally { saveBtn.innerText = "Save Changes"; saveBtn.disabled = false; }
};

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

window.changeLanguage = async (lang) => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang] && translations[lang][key]) el.innerText = translations[lang][key];
    });
    if (auth.currentUser) await setDoc(doc(db, "users", auth.currentUser.uid), { lang }, { merge: true });
};

// --- LOCATION LOGIC (High Accuracy) ---
window.initLocationFlow = function() {
    const choice = confirm("Use GPS for exact delivery location?\n(We recommend 'OK' for accuracy)");
    if (choice) {
        if (!navigator.geolocation) return window.openLocationSearch();
        
        // Request High Accuracy
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                // Save Lat/Lng properly
                userLocation = { 
                    lat: pos.coords.latitude, 
                    lng: pos.coords.longitude, 
                    address: "GPS Location (Mombasa)", 
                    timestamp: new Date() 
                };
                
                // Reverse Geocoding optional, but for now we label it GPS
                saveLoc();
                alert("✅ GPS Location set! Orders will now include your exact map pin.");
            }, 
            (err) => { 
                console.error(err);
                alert("GPS failed or denied. Please select area manually."); 
                window.openLocationSearch(); 
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
    // Manual selection has NO coordinates, only address text
    userLocation = { address: address, lat: null, lng: null };
    saveLoc();
    document.getElementById('location-modal').style.display = 'none';
};

async function saveLoc() {
    if(!userLocation) return;
    document.getElementById('currentCoords').innerText = userLocation.address;
    if(auth.currentUser) await setDoc(doc(db, "users", auth.currentUser.uid), { location: userLocation }, { merge: true });
}

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

function listenToOrders() {
    if(!auth.currentUser) return;
    const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid));
    onSnapshot(q, (snap) => {
        const countEl = document.getElementById('homeOrderCount');
        if(countEl) countEl.innerText = snap.size;
        
        const list = document.getElementById('ordersList');
        if(list) list.innerHTML = snap.empty ? '<p style="text-align:center;color:#888;margin-top:20px;">No orders yet.</p>' : '';
        
        const docs = snap.docs.map(d => d.data()).sort((a,b) => b.createdAt.seconds - a.createdAt.seconds);
        
        if(docs.length > 0) {
            const last = docs[0];
            if(document.getElementById('recentItemName')) document.getElementById('recentItemName').innerText = `${last.quantity}x ${last.item}`;
            if(document.getElementById('recentStatusText')) document.getElementById('recentStatusText').innerText = "Status: " + last.status;
            if(document.getElementById('recentPrice')) document.getElementById('recentPrice').innerText = "Ksh " + last.totalPrice;
        }

        if(list) {
            list.innerHTML = "";
            docs.forEach(o => {
                const codeHtml = o.deliveryCode ? `<br><small style="color:#E65100; font-weight:bold;">Delivery Code: ${o.deliveryCode}</small>` : '';
                list.innerHTML += `
                <div class="mini-order" style="margin-bottom:10px;">
                    <div class="icon-box"><i class="fa-solid fa-egg"></i></div>
                    <div class="details">
                        <h4>${o.quantity}x ${o.item}</h4>
                        <small>${o.status} • ${o.address}</small>
                        ${codeHtml}
                    </div>
                    <span class="price">Ksh ${o.totalPrice}</span>
                </div>`;
            });
        }
    });
}

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


// --- TEST FUNCTION ---
// This acts exactly like MacroDroid. It creates a fake payment in the database.
window.simulateTestPayment = async () => {
    const testCode = "TEST" + Math.floor(100000 + Math.random() * 900000); // Generates TEST123456
    const amountStr = prompt("Enter Amount to Simulate (e.g. 11550):", "11550");
    
    if(!amountStr) return;
    const testAmount = parseInt(amountStr);

    try {
        // Write directly to the same collection MacroDroid uses
        await setDoc(doc(db, "mpesa_payments", testCode), {
            transactionId: testCode,
            amount: testAmount,
            phone: "0700000000",
            fullMessage: "Simulated Test Message from Website Button",
            used: false,
            method: "Simulation",
            timestamp: new Date()
        });

        // Auto-fill the box so you can verify it immediately
        document.getElementById('mpesaCodeInput').value = testCode;
        alert(`✅ Test Payment Sent to Database!\n\nCode: ${testCode}\nAmount: ${testAmount}\n\nNow click 'Verify Payment' to finish.`);
        
    } catch(e) {
        alert("Error simulating payment: " + e.message);
        console.error(e);
    }
};
