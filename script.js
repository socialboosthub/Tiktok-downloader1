import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, doc, getDoc, getDocs, setDoc, onSnapshot, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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

let userWallet = 0;
let myReferralCode = "";


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
        // Load settings immediately to generate referral code
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
                const data = doc.data();
                currentEggPrice = data.currentPrice || 385;
                currentStock = data.currentStock || 0; 
            }
            
            // Update Price Display
            const priceDisplay = document.getElementById('dynamicPriceDisplay');
            if(priceDisplay) priceDisplay.innerText = currentEggPrice;

            // Update Stock Display
            const stockDisplay = document.getElementById('stockDisplay');
            if(stockDisplay) {
                if(currentStock > 0) {
                    stockDisplay.innerHTML = `<i class="fa-solid fa-boxes-stacked"></i> ${currentStock} Trays Available`;
                    stockDisplay.style.color = "#2E7D32"; // Green
                } else {
                    stockDisplay.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Out of Stock`;
                    stockDisplay.style.color = "#F44336"; // Red
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

window.initiateOrder = () => {
    if (!auth.currentUser) return alert("Please login first.");
    
    // STRICT LOCATION CHECK
    if (!userLocation || !userLocation.address) {
        if(confirm("⚠️ Delivery Location Missing!\n\nPlease set your location to continue.")) {
            window.showPage('settings', document.querySelectorAll('.nav-item')[3]);
            setTimeout(() => window.initLocationFlow(), 500);
        }
        return;
    }
    
    const quantity = parseInt(document.getElementById('shopQty').innerText);

    // CHECK STOCK BEFORE ORDERING
    if (quantity > currentStock) {
        return alert(`⚠️ Not enough stock!\n\nAvailable: ${currentStock} Trays\nYou want: ${quantity} Trays\n\nPlease reduce quantity.`);
    }

    const total = quantity * currentEggPrice;
    document.getElementById('mpesaTotalDisplay').innerText = total.toLocaleString();
    document.getElementById('mpesaCodeInput').value = "";
    document.getElementById('mpesa-modal').style.display = 'flex';
};

// ==========================================
// 🔥 PAYMENT & ORDER SYSTEM
// ==========================================

function generateOrderCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

window.verifyPayment = async () => {
    const codeInput = document.getElementById('mpesaCodeInput').value.toUpperCase().trim();
    const btn = document.getElementById('payBtn');
    
    if(codeInput.length < 10) return alert("Please enter a valid 10-character M-Pesa code.");

    const quantity = parseInt(document.getElementById('shopQty').innerText);
    
    // 1. FORCE Cart Total to a Number
    const expectedTotal = Number(quantity * currentEggPrice);

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
                    alert("❌ This code was already used for another order.");
                    resetBtn();
                    return;
                }

                // 2. FORCE M-Pesa Amount to a Number
                const paidAmount = Number(data.amount);

                // --- WALLET LOGIC ---
                let finalPaid = paidAmount;
                let walletDeduction = 0;
                let balanceToAdd = 0;
                
                // Case 1: They paid LESS than total (Check Wallet)
                if (paidAmount < expectedTotal) {
                    const shortage = expectedTotal - paidAmount;
                    if (userWallet >= shortage) {
                        // Use wallet to cover the rest
                        walletDeduction = shortage;
                        finalPaid = paidAmount + walletDeduction; // Now it matches expectedTotal
                        console.log(`Using Ksh ${walletDeduction} from wallet.`);
                    } else {
                        alert(`❌ Insufficient Payment!\n\nOrder Total: Ksh ${expectedTotal}\nYou Sent: Ksh ${paidAmount}\nWallet Balance: Ksh ${userWallet}\n\nPlease send the remaining amount.`);
                        resetBtn();
                        return;
                    }
                } 
                // Case 2: They paid MORE than total (Add to Wallet)
                else if (paidAmount > expectedTotal) {
                    balanceToAdd = paidAmount - expectedTotal;
                    console.log(`Overpayment of Ksh ${balanceToAdd}. Adding to wallet.`);
                }

                // Proceed only if the math works out
                if (finalPaid >= expectedTotal) {
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
                            totalPrice: expectedTotal, // Record the cost
                            amountPaid: paidAmount,   // Record actual mpesa
                            walletUsed: walletDeduction,
                            status: 'Pending',
                            mpesaNumber: data.phone || "Verified", 
                            mpesaCode: codeInput,
                            address: userLocation.address,
                            locationCoords: safeLocation,
                            deliveryCode: deliveryCode, 
                            createdAt: new Date()
                        });

                        // Mark M-Pesa Code as Used
                        batch.update(mpesaRef, { 
                            used: true, 
                            usedBy: auth.currentUser.uid,
                            claimedAt: new Date()
                        });

                        // Deduct Stock
                        const stockRef = doc(db, "config", "pricing");
                        batch.update(stockRef, { currentStock: currentStock - quantity });

                        // --- UPDATE WALLET ---
                        const userRef = doc(db, "users", auth.currentUser.uid);
                        if (walletDeduction > 0) {
                            batch.update(userRef, { walletBalance: userWallet - walletDeduction });
                        } else if (balanceToAdd > 0) {
                            batch.update(userRef, { walletBalance: userWallet + balanceToAdd });
                        }

                        await batch.commit();

                        // Refresh local wallet display
                        if (walletDeduction > 0) userWallet -= walletDeduction;
                        if (balanceToAdd > 0) userWallet += balanceToAdd;
                        document.getElementById('walletBalanceDisplay').innerText = `Ksh ${userWallet}`;

                        document.getElementById('mpesa-modal').style.display = 'none';
                        resetBtn();
                        
                        let msg = `Order Success! Code: ${deliveryCode}`;
                        if(balanceToAdd > 0) msg += `\n(Ksh ${balanceToAdd} added to your Wallet)`;
                        
                        alert(msg);
                        await createNotification(msg);
                        
                        window.showPage('orders', document.querySelectorAll('.nav-item')[2]);
                        generateWhatsAppLink(quantity, expectedTotal, userLocation.address, deliveryCode);

                    } catch (batchError) {
                        console.error(batchError);
                        alert("Order failed. Check console.");
                        resetBtn();
                    }
                }
            } else if (attempts >= maxAttempts) {
                clearInterval(pollLoop);
                alert("❌ Code not found in system yet. If you just paid, please wait 30s and try again.");
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

// ==========================================
// 🔥 FIX: USER SETTINGS & REFERRAL GENERATOR
// ==========================================
async function loadUserSettings() {
    if (!auth.currentUser) return;
    try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        let userDoc = await getDoc(userRef);

        // Generate a referral code using name + random numbers
        const namePart = (auth.currentUser.displayName || "USER").substring(0,3).toUpperCase().replace(/[^A-Z]/g, "X");
        const randPart = Math.floor(100 + Math.random() * 900);
        const newCode = `${namePart}${randPart}`;
        
        let data = {};

        // 1. If User Doc exists, load data. If code missing, add it.
        if (userDoc.exists()) {
            data = userDoc.data();
            if (!data.referralCode) {
                await setDoc(userRef, { referralCode: newCode }, { merge: true });
                myReferralCode = newCode;
            } else {
                myReferralCode = data.referralCode;
            }
        } 
        // 2. If User Doc DOES NOT exist (New Login), Create it immediately!
        else {
            const newUserObj = {
                name: auth.currentUser.displayName || "New User",
                email: auth.currentUser.email,
                photo: auth.currentUser.photoURL,
                referralCode: newCode,
                walletBalance: 0,
                createdAt: new Date()
            };
            await setDoc(userRef, newUserObj);
            myReferralCode = newCode;
            data = newUserObj;
            console.log("🆕 New User Profile Created via Script");
        }

        // --- UPDATE UI ELEMENTS ---
        
        // Referral Code Display
        if(document.getElementById('myRefCode')) 
            document.getElementById('myRefCode').innerText = myReferralCode;

        // Theme
        if (data.theme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            if(document.getElementById('themeToggle')) document.getElementById('themeToggle').checked = true;
        }

        // Location
        if (data.location) {
            userLocation = data.location;
            if(document.getElementById('currentCoords')) document.getElementById('currentCoords').innerText = data.location.address;
        }
        
        // Wallet
        userWallet = data.walletBalance || 0;
        if(document.getElementById('walletBalanceDisplay')) 
            document.getElementById('walletBalanceDisplay').innerText = `Ksh ${userWallet}`;

    } catch(e) { console.error("Error loading user settings:", e); }
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
// 📍 LOCATION LOGIC (GPS + MANUAL)
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
        // Reset Map
        window.ordersDataMap = {};

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
                // Store data for the PDF generator
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
// 📄 RECEIPT GENERATOR
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
    doc.text(`Subtotal:`, 140, finalY);
    doc.text(`Ksh ${orderData.totalPrice.toLocaleString()}`, 170, finalY);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`TOTAL PAID:`, 140, finalY + 10);
    doc.setTextColor(46, 125, 50); // Green Color
    doc.text(`Ksh ${orderData.totalPrice.toLocaleString()}`, 170, finalY + 10);

    doc.setTextColor(...darkColor);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(14, finalY + 25, 180, 20, 3, 3, 'S');
    doc.text(`Payment Method: M-Pesa`, 20, finalY + 33);
    doc.setFont("helvetica", "bold");
    doc.text(`Transaction Code: ${orderData.mpesaCode || "N/A"}`, 20, finalY + 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Thank you for your business!", 105, 280, { align: "center" });
    doc.text("For support call: 0700 000 000", 105, 285, { align: "center" });

    doc.save(`Receipt_EggMaster_${orderData.deliveryCode || "Order"}.pdf`);
};

window.ordersDataMap = {};


// --- REFERRAL FUNCTIONS ---
window.shareReferral = () => {
    if(!myReferralCode) return alert("Code loading... If new, please refresh page.");
    const msg = `Get fresh eggs at wholesale prices! Use my code ${myReferralCode} for a discount. Download: https://eggmaster.app`;
    if (navigator.share) {
        navigator.share({ title: 'EggMaster', text: msg, url: window.location.href });
    } else {
        prompt("Copy your referral link:", msg);
    }
};

window.redeemReferral = async () => {
    const code = document.getElementById('referralInput').value.trim().toUpperCase();
    if (!code) return alert("Enter a code.");
    if (code === myReferralCode) return alert("You cannot use your own code!");

    try {
        // Query database for code
        const q = query(collection(db, "users"), where("referralCode", "==", code));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return alert("Invalid Code. Code not found.");

        // Apply reward (Add 50 bob to wallet)
        const userRef = doc(db, "users", auth.currentUser.uid);
        
        await updateDoc(userRef, { 
            walletBalance: userWallet + 50,
            redeemedCode: code 
        });
        
        userWallet += 50;
        document.getElementById('walletBalanceDisplay').innerText = `Ksh ${userWallet}`;
        alert(`✅ Code Redeemed! You got Ksh 50 in your wallet.`);
        document.getElementById('referralInput').value = "";
    } catch(e) {
        console.error(e);
        // Common error is missing index
        if(e.message.includes("requires an index")) {
            alert("Admin: Please create the index in Firebase Console.");
        } else {
            alert("Error redeeming code.");
        }
    }
};
