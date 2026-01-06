const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');

// Initialize Firebase Admin (This bypasses security rules)
// Ensure you have your serviceAccountKey.json in the same folder or use Environment Variables
var serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Handle JSON body
app.use(express.urlencoded({ extended: true })); // Handle Form Data (Common for SMS apps)

// Root route to keep Render alive
app.get('/', (req, res) => {
  res.status(200).send('Server is running active');
});

// WEBHOOK: Handle Incoming SMS from M-PESA
app.post('/webhook/sms', async (req, res) => {
  console.log("👉 New SMS Received!");
  console.log("Full Body:", req.body); // Check your Render logs for this!

  try {
    // 1. Extract Data (Handle different SMS Forwarder field names)
    const sender = req.body.sender || req.body.from || req.body.phone || "Unknown";
    const message = req.body.message || req.body.text || req.body.content || req.body.msg;

    // 2. Validate Content
    if (!message) {
      console.error("❌ Error: No message content found in request.");
      return res.status(400).json({ error: "No content received. Check app settings." });
    }

    console.log(`📩 Processing Message from ${sender}: ${message}`);

    // 3. Check if it is an M-PESA Message
    // Regex looks for codes like "RAG...", "QEH...", "SE..." etc.
    const mpesaRegex = /([A-Z0-9]{10})\s+Confirmed/i;
    const amountRegex = /Ksh([\d,]+\.?\d*)/i;
    
    const codeMatch = message.match(mpesaRegex);
    const amountMatch = message.match(amountRegex);

    if (codeMatch) {
      const transactionId = codeMatch[1];
      const amount = amountMatch ? amountMatch[1] : "0";
      
      console.log(`✅ M-PESA Code Detected: ${transactionId}, Amount: ${amount}`);

      // 4. Find the Order in Firebase using the Transaction ID
      // You must ensure when the user orders, they save the 'transactionId' or you search specifically
      // Assuming you want to match an order that is 'pending'
      
      // Strategy: Search for an order where the user entered this code manually, 
      // OR look for a pending order if your flow generates the code differently.
      // Here we look for a matching 'transactionId' field in your orders.
      
      const ordersRef = db.collection('orders');
      const snapshot = await ordersRef.where('transactionId', '==', transactionId).get();

      if (snapshot.empty) {
        console.log("⚠️ No matching order found for this transaction ID yet.");
        return res.status(200).send("Message received, but no matching order found.");
      }

      // 5. Update the Order
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        const orderRef = ordersRef.doc(doc.id);
        batch.update(orderRef, { 
          status: 'approved',
          paymentReceived: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`🎉 Order(s) updated to APPROVED for Transaction: ${transactionId}`);
      
      return res.status(200).send("Order Approved Successfully");

    } else {
      console.log("ℹ️ Message received but not a valid M-PESA confirmation.");
      return res.status(200).send("Not an M-PESA payment message.");
    }

  } catch (error) {
    console.error("🔥 Server Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
