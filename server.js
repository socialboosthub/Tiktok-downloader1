const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// SETUP FIREBASE
var serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==========================================
// 🔥 SUPER SMART SMS WEBHOOK
// ==========================================
app.post('/webhook/sms', async (req, res) => {
  console.log("\n🔔 NEW SMS RECEIVED 🔔");
  
  // 1. Respond instantly so the app doesn't retry
  res.status(200).send("OK");

  try {
    const payload = req.body;
    console.log("📦 Raw Data from App:", JSON.stringify(payload, null, 2));

    // 2. Try to find the message text in ANY common field
    // Different apps hide it in different places
    let messageRaw = 
        payload.message || 
        payload.text || 
        payload.content || 
        payload.body || 
        payload.sms ||
        (payload.data ? payload.data.message : "") ||
        "";

    // 3. Try to find the Sender/Phone
    let sender = 
        payload.from || 
        payload.sender || 
        payload.number || 
        payload.phone ||
        "";

    console.log(`🔎 Found Message: "${messageRaw}"`);

    // 4. CLEANUP: If the message is empty, stop.
    if (!messageRaw) return console.log("❌ Error: Message text was empty.");
    
    // 5. SECURITY CHECK: Is it M-Pesa?
    if (!messageRaw.toLowerCase().includes("confirmed")) {
        return console.log("⚠️ Ignored: Text does not contain 'Confirmed'.");
    }

    // 6. EXTRACT CODES (The Magic Part)
    // Regex to find: "UA5KK..."
    const codeRegex = /([A-Z0-9]{10})\s+Confirmed/i;
    // Regex to find: "Ksh1,500.00" or "Ksh 500"
    const amountRegex = /Ksh\.?\s*([\d,]+\.?\d*)/i;
    // Regex to find Customer Phone inside the text
    const phoneRegex = /\d{10,12}/;

    const codeMatch = messageRaw.match(codeRegex);
    const amountMatch = messageRaw.match(amountRegex);
    const phoneMatch = messageRaw.match(phoneRegex);

    if (codeMatch && amountMatch) {
      const transactionId = codeMatch[1].toUpperCase();
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      
      // If we found a phone number IN the text (like "Sent to 0712..."), use it. 
      // Otherwise use the sender.
      const phone = phoneMatch ? phoneMatch[0] : sender; 

      console.log(`✅ SUCCESS! Saving -> Code: ${transactionId} | Amount: ${amount}`);

      await db.collection('mpesa_payments').doc(transactionId).set({
        transactionId: transactionId,
        amount: amount,
        phone: phone,
        fullMessage: messageRaw,
        used: false,
        method: "Auto-App",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log("💾 Saved to Database!");
    } else {
      console.log("⚠️ Text looked like M-Pesa but Code/Amount was missing.");
    }

  } catch (err) {
    console.error("🔥 Server Error:", err);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
