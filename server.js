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

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// WEBHOOK: Handle Incoming SMS
app.post('/webhook/sms', async (req, res) => {
  console.log("👉 Data Received!");
  
  // 1. Get the message content
  const message = req.body.message || req.body.text || req.query.message || req.query.text || "";
  const sender = req.body.sender || req.query.sender || "Unknown";

  // 2. Respond to the forwarder immediately
  res.status(200).send("OK");

  if (!message) {
    console.log("❌ No message found");
    return;
  }

  try {
    // --- STEP 1: EXTRACT DATA ---
    // Regex matches "UA5KK2UVTQ Confirmed"
    const codeRegex = /([A-Z0-9]{10})\s+Confirmed/i;
    // Regex matches "Ksh19,000.00"
    const amountRegex = /Ksh\s*([\d,]+\.?\d*)/i;

    const codeMatch = message.match(codeRegex);
    const amountMatch = message.match(amountRegex);

    if (codeMatch && amountMatch) {
      const transactionId = codeMatch[1].toUpperCase();
      // Remove commas from amount (e.g. 19,000 becomes 19000)
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));

      console.log(`✅ Payment Detected: ${transactionId} | Amount: ${amount}`);

      // --- STEP 2: SAVE TO 'mpesa_payments' ---
      // This is the CRITICAL part your script.js is looking for
      await db.collection('mpesa_payments').doc(transactionId).set({
        transactionId: transactionId,
        amount: amount,
        sender: sender,
        fullMessage: message,
        used: false, // script.js checks this to prevent double usage
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log("💾 Saved to mpesa_payments collection.");

    } else {
      console.log("⚠️ Message received but looks like it's not a payment:", message);
    }

  } catch (error) {
    console.error("🔥 Error processing webhook:", error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
