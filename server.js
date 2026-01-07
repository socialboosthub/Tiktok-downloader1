const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Initialize Firebase Admin
// Make sure serviceAccountKey.json is in the same folder
var serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (Frontend)
app.use(express.static(__dirname));

// Send index.html on load
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// 🔥 ROBUST SMS WEBHOOK (For SMS Forwarder Apps)
// ==========================================
app.post('/webhook/sms', async (req, res) => {
  console.log("\n=======================================");
  console.log("👉 SMS Webhook Triggered!");
  
  // 1. Respond immediately to keep the app happy
  res.status(200).send("Received");

  try {
    // 2. Extract Message Content (Handles different app formats)
    // Some apps send { "message": "..." }, others { "text": "..." }, others { "content": "..." }
    const payload = req.body;
    console.log("📩 Raw Payload:", JSON.stringify(payload, null, 2));

    const messageRaw = payload.message || payload.text || payload.content || payload.body || "";
    
    if (!messageRaw || typeof messageRaw !== 'string') {
      console.log("❌ No valid message text found in payload.");
      return;
    }

    console.log("📝 Analyzing Message:", messageRaw.substring(0, 50) + "...");

    // 3. SMART PARSING (Regex)
    // Looks for: 10-digit code at start or in text, followed by "Confirmed"
    // Looks for: "Ksh" followed by digits
    // Looks for: Phone number
    const codeRegex = /([A-Z0-9]{10})\s+Confirmed/i;
    const amountRegex = /Ksh\.?\s*([\d,]+\.?\d*)/i; // Handles "Ksh 500", "Ksh500", "Ksh. 500"
    const phoneRegex = /\d{9,12}/; // Generic phone grabber

    const codeMatch = messageRaw.match(codeRegex);
    const amountMatch = messageRaw.match(amountRegex);
    const phoneMatch = messageRaw.match(phoneRegex);

    if (codeMatch) {
      const transactionId = codeMatch[1].toUpperCase();
      
      // Clean amount (remove commas)
      let amount = 0;
      if (amountMatch) {
        amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      }

      const phone = phoneMatch ? phoneMatch[0] : "Unknown";

      console.log(`✅ MATCH FOUND! Code: ${transactionId} | Amount: ${amount}`);

      // 4. SAVE TO FIRESTORE
      // Using transactionId as the Document ID guarantees uniqueness
      await db.collection('mpesa_payments').doc(transactionId).set({
        transactionId: transactionId,
        amount: amount,
        phone: phone,
        fullMessage: messageRaw,
        used: false, // Important: Marks it as fresh
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log("💾 Saved to 'mpesa_payments' collection successfully.");

    } else {
      console.log("⚠️ Message received but NO M-Pesa code found.");
    }

  } catch (err) {
    console.error("🔥 Server Error:", err);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
