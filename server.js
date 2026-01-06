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

// 1. Serve static files (css, js, images) from the current folder
app.use(express.static(__dirname));

// 2. Send the index.html file when someone opens the site
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// WEBHOOK: Handle Incoming SMS
app.post('/webhook/sms', async (req, res) => {
  console.log("👉 Data Received!");
  
  // Try to find the message in ANY format (body or query)
  const message = req.body.message || req.body.text || req.query.message || req.query.text || "";
  const sender = req.body.sender || req.query.sender || "Unknown";

  // IMMEDIATELY tell the app "OK" so it doesn't timeout
  res.status(200).send("OK");

  if (!message) {
    console.log("❌ No message found in this request");
    return;
  }

  try {
    // 1. Regex for M-PESA Code (e.g., UA5KK2UVTQ)
    const codeRegex = /([A-Z0-9]{10})\s+Confirmed/i;
    // 2. Regex for Amount (e.g., Ksh19,000.00)
    const amountRegex = /Ksh([\d,]+\.?\d*)/i;

    const codeMatch = message.match(codeRegex);
    const amountMatch = message.match(amountRegex);

    if (codeMatch) {
      const transactionId = codeMatch[1].toUpperCase();
      let amount = 0;

      // Clean up the amount string (remove commas)
      if (amountMatch) {
        amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      }

      console.log(`✅ Found Code: ${transactionId} | Amount: ${amount}`);

      // --- FIX START: ALWAYS SAVE THE TRANSACTION FIRST ---
      // This ensures even if the order doesn't exist yet, the payment is recorded.
      const transactionRef = db.collection('transactions').doc(transactionId);
      await transactionRef.set({
        transactionId: transactionId,
        amount: amount,
        fullMessage: message,
        sender: sender,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        used: false // We can mark this true later if matched to an order
      }, { merge: true });
      // --- FIX END ---

      // Now check if there is a pending order waiting for this code
      const ordersRef = db.collection('orders');
      const snapshot = await ordersRef.where('transactionId', '==', transactionId).get();

      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.update(ordersRef.doc(doc.id), { 
            status: 'approved',
            paidAmount: amount, // Optional: save the actual paid amount to the order
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          // Mark transaction as used
          batch.update(transactionRef, { used: true });
        });
        await batch.commit();
        console.log(`🎉 Order ${transactionId} Approved!`);
      } else {
        console.log(`⚠️ Payment saved to 'transactions', but no matching Order found yet for code: ${transactionId}`);
      }

    } else {
      console.log("❌ Message received, but no M-PESA code found:", message);
    }

  } catch (error) {
    console.error("🔥 Error processing webhook:", error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
