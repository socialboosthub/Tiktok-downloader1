const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Initialize Firebase Admin
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

// 1. Serve static files
app.use(express.static(__dirname));

// 2. Send index.html on load
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- NEW WEBHOOK LOGIC ---
app.post('/webhook/sms', async (req, res) => {
  console.log("👉 SMS Received!");

  // 1. Respond immediately to keep the gateway happy
  res.status(200).send("OK");

  // 2. Extract Data
  const message = req.body.message || req.body.text || req.query.message || req.query.text || "";
  
  if (!message) return console.log("❌ Empty message received");

  try {
    // 3. PARSE THE SMS (Smart Regex)
    // Matches Code (e.g., QWE12345) and Amount (e.g., Ksh500.00) and Phone (e.g., 0712...)
    const codeRegex = /([A-Z0-9]{10})\s+Confirmed/i;
    const amountRegex = /Ksh\s*([\d,.]+)/i;
    const phoneRegex = /from\s+.*?\s+(\d{9,12})/i;

    const codeMatch = message.match(codeRegex);
    const amountMatch = message.match(amountRegex);
    const phoneMatch = message.match(phoneRegex);

    if (codeMatch) {
      const transactionId = codeMatch[1];
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
      const phone = phoneMatch ? phoneMatch[1] : "Unknown";

      console.log(`✅ Saving Payment: ${transactionId} - Ksh ${amount}`);

      // 4. STORE TO DATABASE IMMEDIATELY
      // We use the Transaction ID as the Document ID for easy lookup
      await db.collection('mpesa_payments').doc(transactionId).set({
        transactionId: transactionId,
        amount: amount,
        phone: phone,
        fullMessage: message,
        used: false, // Mark as unused initially
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log("💾 Saved to DB successfully.");
    } else {
      console.log("⚠️ Could not parse M-PESA code from message.");
    }

  } catch (err) {
    console.error("🔥 Server Error:", err);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
