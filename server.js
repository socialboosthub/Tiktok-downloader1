const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));

// --- THE WEBHOOK ---
app.post('/webhook/sms', async (req, res) => {
    try {
        console.log("--------------- NEW SMS RECEIVED ---------------");
        
        // 1. Get the message content safely
        const smsContent = req.body.message || req.body.body || req.body.text || "";
        const sender = req.body.sender || req.body.from || "Unknown";

        console.log(`From: ${sender}`);
        console.log(`Message: ${smsContent}`);

        // 2. CHECK: Is this an M-Pesa Message? (Relaxed check for testing)
        // We check if it contains "Confirmed" AND "Ksh"
        if (!smsContent.includes("Confirmed") || !smsContent.includes("Ksh")) {
            console.log("❌ Ignored: Message does not look like M-Pesa.");
            return res.status(200).send("Ignored");
        }

        // 3. EXTRACT DATA (Improved Regex)
        
        // Find the 10-digit code (e.g., UA5KK2UVTQ)
        // Looks for 10 uppercase letters/numbers at the very start
        const codeRegex = /^([A-Z0-9]{10})\s+Confirmed/i;
        
        // Find the Amount (e.g., Ksh19,000.00)
        // Looks for 'Ksh', maybe a space, then numbers/commas/dots
        const amountRegex = /Ksh\s*([\d,]+(?:\.\d{2})?)/i;

        const codeMatch = smsContent.match(codeRegex);
        const amountMatch = smsContent.match(amountRegex);

        if (codeMatch && amountMatch) {
            const code = codeMatch[1].toUpperCase();
            
            // Clean the amount: Remove commas (19,000 -> 19000)
            let rawAmount = amountMatch[1].replace(/,/g, '');
            const amount = parseFloat(rawAmount);

            console.log(`✅ PARSED SUCCESS: Code=${code}, Amount=${amount}`);

            // 4. SAVE TO FIREBASE
            await db.collection('mpesa_payments').doc(code).set({
                code: code,
                amount: amount,
                fullMessage: smsContent,
                originalSender: sender,
                used: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("💾 Saved to Database successfully.");
            return res.status(200).send("Payment Saved");
        } else {
            console.log("❌ Parsing Failed: Regex didn't match code or amount.");
            console.log("Debug Code Match:", codeMatch);
            console.log("Debug Amount Match:", amountMatch);
            return res.status(200).send("Could not parse");
        }

    } catch (error) {
        console.error("🚨 Webhook Error:", error);
        res.status(500).send("Error");
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
