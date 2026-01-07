const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// 1. SETUP FIREBASE ADMIN
// Ensure 'serviceAccountKey.json' is in the same folder
var serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const app = express();

app.use(cors());
// Increased limit for larger payloads
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (Frontend)
app.use(express.static(__dirname));

// Send index.html on load
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// 🔥 AUTOMATIC SMS WEBHOOK
// This is where the SMS Forwarder App sends data
// ==========================================
app.post('/webhook/sms', async (req, res) => {
  console.log("👉 Incoming SMS Webhook...");
  
  // Always respond 200 OK quickly so the app knows it worked
  res.status(200).send("Received");

  try {
    // 1. GET THE MESSAGE
    // Different apps send data differently. We check all common fields.
    const payload = req.body;
    console.log("📩 Payload:", JSON.stringify(payload));

    const messageRaw = payload.message || payload.text || payload.content || payload.body || "";
    const sender = payload.from || payload.sender || payload.number || "";

    // 2. FILTER: Only Process M-Pesa messages
    if (!messageRaw) return console.log("❌ Empty message.");
    
    // Check if it looks like an M-Pesa message
    if (!messageRaw.includes("Confirmed") && !messageRaw.includes("received")) {
        return console.log("⚠️ Ignored: Not an M-Pesa transaction.");
    }

    // 3. EXTRACT DATA (Regex)
    // Looks for: "UA5KK..." then "Confirmed"
    // Looks for: "Ksh" then "19,000.00"
    const codeRegex = /([A-Z0-9]{10})\s+Confirmed/i;
    const amountRegex = /Ksh\.?\s*([\d,]+\.?\d*)/i;
    const phoneRegex = /\d{10,12}/;

    const codeMatch = messageRaw.match(codeRegex);
    const amountMatch = messageRaw.match(amountRegex);
    const phoneMatch = messageRaw.match(phoneRegex);

    if (codeMatch && amountMatch) {
      const transactionId = codeMatch[1].toUpperCase();
      const amount = parseFloat(amountMatch[1].replace(/,/g, '')); // Remove commas
      const phone = phoneMatch ? phoneMatch[0] : sender; // Use extracted phone or sender

      console.log(`✅ VALID PAYMENT! Code: ${transactionId} | Amount: ${amount}`);

      // 4. SAVE TO DATABASE (Firestore)
      // We use 'set' so it creates or updates safely
      await db.collection('mpesa_payments').doc(transactionId).set({
        transactionId: transactionId,
        amount: amount,
        phone: phone,
        fullMessage: messageRaw,
        used: false, // Customer hasn't used it yet
        method: "Automatic Webhook",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log("💾 Saved to Database.");
    } else {
      console.log("⚠️ Could not parse Code or Amount from SMS.");
    }

  } catch (err) {
    console.error("🔥 Server Error:", err);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
