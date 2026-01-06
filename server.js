const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path'); // Added to help locate your HTML file

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

// --- THIS IS THE CHANGE ---
// 1. Serve static files (css, js, images) from the current folder
app.use(express.static(__dirname));

// 2. Send the index.html file when someone opens the site
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
// --------------------------

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
    // Regex for M-PESA Code (e.g., SHID1234567)
    const mpesaRegex = /([A-Z0-9]{10})\s+Confirmed/i;
    const codeMatch = message.match(mpesaRegex);

    if (codeMatch) {
      const transactionId = codeMatch[1];
      console.log(`✅ Found Code: ${transactionId}`);

      const ordersRef = db.collection('orders');
      const snapshot = await ordersRef.where('transactionId', '==', transactionId).get();

      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.update(ordersRef.doc(doc.id), { 
            status: 'approved',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();
        console.log(`🎉 Order ${transactionId} Approved!`);
      } else {
        console.log(`⚠️ Code ${transactionId} not found in database.`);
      }
    }
  } catch (err) {
    console.error("🔥 Database Error:", err);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
