import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, doc, getDoc, setDoc, onSnapshot, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
let currentStock = 0;
let userWalletBalance = 0; // GLOBAL WALLET VARIABLE

// Mombasa Areas
const MOMBASA_AREAS = [
    "Nyali", "Bamburi", "Tudor", "Kizingo", "Mtwapa", "Likoni", 
    "Changamwe", "Mikindani", "Ganjoni", "Mombasa Island", "Shanzu", "Mkomani",
    "Bombolulu", "Kisauni", "Kongowea", "Mbaraki", "Mama Ngina"
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

// --- DYNAMIC PRICE & WALLET LISTENER ---
async function fetchLivePrice() {
    try {
        onSnapshot(doc(db, "config", "pricing"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                currentEggPrice = data.currentPrice || 385;
                currentStock = data.currentStock || 0; 
            }
            const priceDisplay = document.getElementById('dynamicPriceDisplay');
            if(priceDisplay) priceDisplay.innerText = currentEggPrice;

            const stockDisplay = document.getElementById('stockDisplay');
            if(stockDisplay) {
                if(currentStock > 0) {
                    stockDisplay.innerHTML = `<i class="fa-solid fa-boxes-stacked"></i> ${currentStock} Trays Available`;
                    stockDisplay.style.color = "#2E7D32"; 
                } else {
                    stockDisplay.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Out of Stock`;
                    stockDisplay.style.color = "#F44336"; 
                }
            }
        });
    } catch(e) { console.error("Error fetching price/stock", e); }
}

// --- ORDER LOGIC ---
window.updateQty = (change) => {
    const display = document.getElementById('shopQty');
    let current = parseInt(display.innerText);
    let newVal = current + change;
    if(newVal < 30) newVal = 30;
    display.innerText = newVal;
};

// GLOBAL VARIABLES FOR PAYMENT VERIFICATION
let pendingOrderTotal = 0;
let pendingWalletUsage = 0;
let pendingPayable = 0;

window.initiateOrder = () => {
    if (!auth.currentUser) return alert("Please login first.");
    
    if (!userLocation || !userLocation.address) {
        if(confirm("⚠️ Delivery Location Missing!\n\nPlease set your location to continue.")) {
            window.showPage('settings', document.querySelectorAll('.nav-item')[3]);
            setTimeout(() => window.initLocationFlow(), 500);
        }
        return;
    }
    
    const quantity = parseInt(document.getElementById('shopQty').innerText);

    if (quantity > currentStock) {
        return alert(`⚠️ Not enough stock!\n\nAvailable: ${currentStock} Trays\nYou want: ${quantity} Trays\n\nPlease reduce quantity.`);
    }

    // 1. CALCULATE COSTS
    pendingOrderTotal = quantity * currentEggPrice;
    
    // 2. CALCULATE WALLET USAGE
    // We use as much of the wallet as possible, but not more than the total
    if (userWalletBalance >= pendingOrderTotal) {
        pendingWalletUsage = pendingOrderTotal;
        pendingPayable = 0;
    } else {
        pendingWalletUsage = userWalletBalance;
        pendingPayable = pendingOrderTotal - userWalletBalance;
    }

    // 3. UPDATE UI IN MODAL
    document.getElementById('summOrderTotal').innerText = pendingOrderTotal.toLocaleString();
    
    if (pendingWalletUsage > 0) {
        document.getElementById('summWalletRow').style.display = 'flex';
        document.getElementById('summWalletUsed').innerText = pendingWalletUsage.toLocaleString();
    } else {
        document.getElementById('summWalletRow').style.display = 'none';
    }

    document.getElementById('mpesaTotalDisplay').innerText = pendingPayable.toLocaleString();
    document.getElementById('payInstructionAmount').innerText = pendingPayable.toLocaleString();
    document.getElementById('mpesaCodeInput').value = "";
    
    // 4. SHOW MODAL (Handle 0 Payment case immediately inside modal logic or here)
    if (pendingPayable === 0) {
        // Instant Buy with Wallet
        if(confirm(`Pay fully using Wallet Balance (Ksh ${pendingWalletUsage})?`)) {
            processWalletOnlyOrder(quantity);
        }
    } else {
        document.getElementById('manualPayInstructions').style.display = 'block';
        document.getElementById('mpesaCodeInput').style.display = 'block';
        document.getElementById('payBtn').innerText = "Verify Payment";
        document.getElementById('mpesa-modal').style.display = 'flex';
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

// ==========================================
// 🔥 WALLET ONLY PROCESSING
// ==========================================
async function processWalletOnlyOrder(quantity) {
    try {
        const batch = writeBatch(db);
        const newOrderRef = doc(collection(db, "orders"));
        const deliveryCode = generateOrderCode();
        
        const safeLocation = {
            lat: (userLocation && userLocation.lat) ? userLocation.lat : null,
            lng: (userLocation && userLocation.lng) ? userLocation.lng : null
        };

        // Create Order
        batch.set(newOrderRef, {
            userId: auth.currentUser.uid,
            userName: auth.currentUser.displayName || "Customer",
            item: "Tray of 30", 
            unitPrice: currentEggPrice, 
            quantity: quantity, 
            totalPrice: pendingOrderTotal,
            paidViaWallet: pendingWalletUsage,
            paidViaMpesa: 0,
            status: 'Pending',
            mpesaNumber: "Wallet", 
            mpesaCode: "WALLET-PAY",
            address: userLocation.address,
            locationCoords: safeLocation,
            deliveryCode: deliveryCode, 
            createdAt: new Date()
        });

        // Deduct Wallet
        const userRef = doc(db, "users", auth.currentUser.uid);
        // Note: We calculate new balance explicitly to be safe
        const newBalance = userWalletBalance - pendingWalletUsage; 
        batch.update(userRef, { walletBalance: newBalance });

        // Deduct Stock
        const stockRef = doc(db, "config", "pricing");
        batch.update(stockRef, { currentStock: currentStock - quantity });

        await batch.commit();
        
        // Success
        await createNotification(`Order Success! Code: ${deliveryCode}`);
        alert(`✅ Paid with Wallet!\n\nDELIVERY CODE: ${deliveryCode}`);
        window.showPage('orders', document.querySelectorAll('.nav-item')[2]);
        generateWhatsAppLink(quantity, pendingOrderTotal, userLocation.address, deliveryCode);

    } catch (e) {
        alert("Error processing wallet order: " + e.message);
    }
}

// ==========================================
// 🔥 M-PESA + WALLET VERIFICATION (SMART)
// ==========================================

window.verifyPayment = async () => {
    const codeInput = document.getElementById('mpesaCodeInput').value.toUpperCase().trim();
    const btn = document.getElementById('payBtn');
    
    if(codeInput.length < 10) return alert("Please enter a valid 10-character M-Pesa code.");

    const quantity = parseInt(document.getElementById('shopQty').innerText);
    
    // We expect the user to pay 'pendingPayable' via M-Pesa
    const amountExpectedViaMpesa = Number(pendingPayable);

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying Amount...`;

    let attempts = 0;
    const maxAttempts = 10; 

    const pollLoop = setInterval(async () => {
        attempts++;
        try {
            const mpesaRef = doc(db, "mpesa_payments", codeInput);
            const docSnap = await getDoc(mpesaRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                clearInterval(pollLoop);
                
                if (data.used) {
                    alert("❌ This code was already used.");
                    resetBtn();
                    return;
                }

                const amountSent = Number(data.amount);

                // CHECK FOR SHORT PAYMENT
                if (amountSent < amountExpectedViaMpesa) {
                    alert(`❌ INSUFFICIENT AMOUNT!\n\n` +
                          `Expected: Ksh ${amountExpectedViaMpesa}\n` +
                          `Received: Ksh ${amountSent}\n\n` +
                          `Please contact support to complete this payment.`);
                    resetBtn();
                    return;
                }

                // CALCULATE EXCESS (TO SAVE TO WALLET)
                const excessAmount = amountSent - amountExpectedViaMpesa;

                // PROCEED WITH ORDER
                try {
                    const batch = writeBatch(db);
                    const newOrderRef = doc(collection(db, "orders"));
                    const deliveryCode = generateOrderCode();
                    
                    const safeLocation = {
                        lat: (userLocation && userLocation.lat) ? userLocation.lat : null,
                        lng: (userLocation && userLocation.lng) ? userLocation.lng : null
                    };

                    batch.set(newOrderRef, {
                        userId: auth.currentUser.uid,
                        userName: auth.currentUser.displayName || "Customer",
                        item: "Tray of 30", 
                        unitPrice: currentEggPrice, 
                        quantity: quantity, 
                        totalPrice: pendingOrderTotal, // The full cost of goods
                        paidViaWallet: pendingWalletUsage,
                        paidViaMpesa: amountSent, // What they actually sent
                        status: 'Pending',
                        mpesaNumber: data.phone || "Verified", 
                        mpesaCode: codeInput,
                        address: userLocation.address,
                        locationCoords: safeLocation,
                        deliveryCode: deliveryCode, 
                        createdAt: new Date()
                    });

                    // Mark Code Used
                    batch.update(mpesaRef, { 
                        used: true, 
                        usedBy: auth.currentUser.uid,
                        claimedAt: new Date()
                    });

                    // WALLET MATH:
                    // 1. We used 'pendingWalletUsage' from the old balance.
                    // 2. We add 'excessAmount' to the result.
                    // New Balance = (OldBalance - Used) + Excess
                    const finalNewWalletBalance = (userWalletBalance - pendingWalletUsage) + excessAmount;

                    const userRef = doc(db, "users", auth.currentUser.uid);
                    batch.update(userRef, { walletBalance: finalNewWalletBalance });

                    // Deduct Stock
                    const stockRef = doc(db, "config", "pricing");
                    batch.update(stockRef, { currentStock: currentStock - quantity });

                    await batch.commit();

                    document.getElementById('mpesa-modal').style.display = 'none';
                    resetBtn();
                    
                    let successMsg = `✅ Order Success!\nCode: ${deliveryCode}`;
                    if(excessAmount > 0) {
                        successMsg += `\n\n💰 Ksh ${excessAmount} has been added to your Wallet!`;
                    }
                    
                    await createNotification(`Order Placed. Code: ${deliveryCode}`);
                    alert(successMsg);
                    
                    window.showPage('orders', document.querySelectorAll('.nav-item')[2]);
                    generateWhatsAppLink(quantity, pendingOrderTotal, userLocation.address, deliveryCode);

                } catch (batchError) {
                    console.error(batchError);
                    alert("Order failed. Check console for details.");
                    resetBtn();
                }

            } else if (attempts >= maxAttempts) {
                clearInterval(pollLoop);
                alert("❌ Code not found yet. Did you receive the SMS?");
                resetBtn();
            }
        } catch (err) {
            clearInterval(pollLoop);
            alert("Connection Error.");
            resetBtn();
        }
    }, 3000); 

    function resetBtn() {
        btn.disabled = false;
        btn.innerHTML = "Verify Payment";
    }
};


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
        // Use onSnapshot for Realtime Wallet Updates
        onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Theme
                if (data.theme === 'dark') {
                    document.body.setAttribute('data-theme', 'dark');
                    if(document.getElementById('themeToggle')) document.getElementById('themeToggle').checked = true;
                }
                
                // Location
                if (data.location) {
                    userLocation = data.location;
                    const locText = document.getElementById('currentCoords');
                    if(locText) locText.innerText = data.location.address;
                }

                // WALLET UPDATE
                userWalletBalance = data.walletBalance || 0;
                const homeWallet = document.getElementById('homeWalletBalance');
                if(homeWallet) homeWallet.innerText = userWalletBalance.toLocaleString();
            }
        });
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

// ==========================================
// 📍 LOCATION LOGIC
// ==========================================

window.initLocationFlow = function() {
    const choice = confirm("Use GPS for exact delivery location?\n\n[OK] = Use GPS (Best for Drivers)\n[Cancel] = Select Area List");
    if (choice) {
        if (!navigator.geolocation) {
            alert("GPS not supported on this device. Opening list...");
            return window.openLocationSearch();
        }
        
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                userLocation = { 
                    lat: pos.coords.latitude, 
                    lng: pos.coords.longitude, 
                    address: "GPS Location (Exact Pin)", 
                    timestamp: new Date() 
                };
                
                await saveLoc();
                alert("✅ GPS Location Saved!\nThe driver will see your exact map pin.");
            }, 
            (err) => { 
                console.error("GPS Error:", err);
                alert("⚠️ GPS Failed or Denied.\nPlease select your area manually."); 
                window.openLocationSearch(); 
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else { 
        window.openLocationSearch(); 
    }
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
    userLocation = { address: address, lat: null, lng: null };
    saveLoc().then(() => {
        document.getElementById('location-modal').style.display = 'none';
        alert(`Location set to: ${address}`);
    });
};

async function saveLoc() {
    if(!userLocation) return;
    const el = document.getElementById('currentCoords');
    if(el) el.innerText = userLocation.address;
    if(auth.currentUser) {
        await setDoc(doc(db, "users", auth.currentUser.uid), { location: userLocation }, { merge: true });
    }
}

// --- NOTIFICATIONS ---
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
        window.ordersDataMap = {}; // Reset PDF Map

        if(list) list.innerHTML = snap.empty ? '<p style="text-align:center;color:#888;margin-top:20px;">No orders yet.</p>' : '';
        
        const docs = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => b.createdAt.seconds - a.createdAt.seconds);
        
        // Update Home "Recent Activity" Card
        if(docs.length > 0) {
            const last = docs[0];
            if(document.getElementById('recentItemName')) document.getElementById('recentItemName').innerText = `${last.quantity}x ${last.item}`;
            if(document.getElementById('recentStatusText')) document.getElementById('recentStatusText').innerText = "Status: " + last.status;
            if(document.getElementById('recentPrice')) document.getElementById('recentPrice').innerText = "Ksh " + last.totalPrice;
        }

        if(list) {
            list.innerHTML = "";
            docs.forEach(o => {
                window.ordersDataMap[o.id] = o;
                const codeHtml = o.deliveryCode ? `<br><small style="color:#E65100; font-weight:bold;">Delivery Code: ${o.deliveryCode}</small>` : '';
                
                list.innerHTML += `
                <div class="mini-order" style="margin-bottom:10px; display:flex; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; width:100%;">
                        <div class="icon-box"><i class="fa-solid fa-egg"></i></div>
                        <div class="details" style="flex:1;">
                            <h4>${o.quantity}x ${o.item}</h4>
                            <small>${o.status} • ${o.address}</small>
                            ${codeHtml}
                        </div>
                        <span class="price">Ksh ${o.totalPrice}</span>
                    </div>
                    
                    <div style="width:100%; margin-top:10px; padding-top:10px; border-top:1px dashed #eee; display:flex; justify-content:flex-end;">
                         <button onclick="window.generateReceiptPDF(window.ordersDataMap['${o.id}'])" 
                            style="background:#FFEBEE; color:#D32F2F; border:none; padding:8px 15px; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">
                            <i class="fa-solid fa-file-pdf"></i> Download Receipt
                         </button>
                    </div>
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

window.simulateTestPayment = async () => {
    const testCode = "TEST" + Math.floor(100000 + Math.random() * 900000); 
    const amountStr = prompt("Enter Amount to Simulate (e.g. 11550):", "11550");
    if(!amountStr) return;
    const testAmount = parseInt(amountStr);

    try {
        await setDoc(doc(db, "mpesa_payments", testCode), {
            transactionId: testCode,
            amount: testAmount,
            phone: "0700000000",
            fullMessage: "Simulated Test Message from Website Button",
            used: false,
            method: "Simulation",
            timestamp: new Date()
        });
        document.getElementById('mpesaCodeInput').value = testCode;
        alert(`✅ Test Payment Sent to Database!\n\nCode: ${testCode}\nAmount: ${testAmount}`);
    } catch(e) {
        alert("Error simulating payment: " + e.message);
    }
};


// ==========================================
// 📄 PDF RECEIPT GENERATOR (UPDATED FOR WALLET)
// ==========================================
window.generateReceiptPDF = (orderData) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const primaryColor = [255, 179, 0];
    const darkColor = [26, 29, 31];

    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');

    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("EggMaster Wholesale", 105, 20, { align: "center" });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Official Payment Receipt", 105, 30, { align: "center" });

    doc.setTextColor(...darkColor);
    doc.setFontSize(10);
    
    const startY = 55;
    const dateStr = orderData.createdAt.toDate ? orderData.createdAt.toDate().toLocaleString() : new Date(orderData.createdAt).toLocaleString();

    doc.setFont("helvetica", "bold");
    doc.text("BILLED TO:", 14, startY);
    doc.setFont("helvetica", "normal");
    doc.text(orderData.userName || "Valued Customer", 14, startY + 6);
    doc.text(orderData.address || "Mombasa, Kenya", 14, startY + 12);
    doc.text(`Tel: ${orderData.mpesaNumber || "N/A"}`, 14, startY + 18);

    doc.setFont("helvetica", "bold");
    doc.text("RECEIPT DETAILS:", 140, startY);
    doc.setFont("helvetica", "normal");
    doc.text(`Order Ref: #${orderData.deliveryCode || "PENDING"}`, 140, startY + 6);
    doc.text(`Date: ${dateStr}`, 140, startY + 12);
    doc.text(`Status: ${orderData.status}`, 140, startY + 18);

    doc.autoTable({
        startY: startY + 30,
        head: [['Description', 'Quantity', 'Unit Price', 'Total']],
        body: [
            [
                orderData.item, 
                orderData.quantity + " Trays", 
                "Ksh " + orderData.unitPrice, 
                "Ksh " + orderData.totalPrice.toLocaleString()
            ]
        ],
        theme: 'grid',
        headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
        styles: { fontSize: 11, cellPadding: 5 },
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    
    doc.setFontSize(12);
    
    // Total Line
    doc.text(`Total Order Value:`, 130, finalY);
    doc.text(`Ksh ${orderData.totalPrice.toLocaleString()}`, 170, finalY);

    // Wallet Line (Only if used)
    let currentY = finalY;
    if(orderData.paidViaWallet > 0) {
        currentY += 8;
        doc.setTextColor(46, 125, 50); // Green
        doc.text(`Paid via Wallet:`, 130, currentY);
        doc.text(`- Ksh ${orderData.paidViaWallet.toLocaleString()}`, 170, currentY);
        doc.setTextColor(...darkColor);
    }

    // Mpesa Line
    if(orderData.paidViaMpesa > 0) {
        currentY += 8;
        doc.text(`Paid via M-Pesa:`, 130, currentY);
        doc.text(`Ksh ${orderData.paidViaMpesa.toLocaleString()}`, 170, currentY);
    }
    
    // M-Pesa Box
    if (orderData.mpesaCode) {
        doc.setDrawColor(200, 200, 200);
        doc.roundedRect(14, finalY + 25, 180, 20, 3, 3, 'S');
        doc.text(`Transaction Details`, 20, finalY + 33);
        doc.setFont("helvetica", "bold");
        doc.text(`Code: ${orderData.mpesaCode}`, 20, finalY + 40);
    }

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Thank you for your business!", 105, 280, { align: "center" });

    doc.save(`Receipt_EggMaster_${orderData.deliveryCode || "Order"}.pdf`);
};

window.ordersDataMap = {};
