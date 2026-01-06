const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin (Allows server to write to DB)
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming JSON from the SMS App
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));

// --- 1. THE WEBHOOK (Where the SMS App sends data) ---
app.post('/webhook/sms', async (req, res) => {
    try {
        // Different apps send data differently. We look for 'message' or 'body'
        const smsContent = req.body.message || req.body.body || req.body.text || "";
        const sender = req.body.sender || req.body.from || "";

        console.log("Received SMS:", smsContent);

        // Only process M-Pesa messages
        if (!sender.toUpperCase().includes("MPESA")) {
            return res.status(200).send("Not an M-Pesa message, ignored.");
        }

        // --- EXTRACT DATA USING REGEX ---
        // Regex looks for: 10-char code, and the Amount after "Ksh"
        const codeRegex = /^([A-Z0-9]{10})\s+Confirmed/i;
        const amountRegex = /Ksh\s*([\d,]+(?:\.\d{2})?)/i;

        const codeMatch = smsContent.match(codeRegex);
        const amountMatch = smsContent.match(amountRegex);

        if (codeMatch && amountMatch) {
            const code = codeMatch[1].toUpperCase();
            // Remove commas from amount (e.g., 1,500 -> 1500)
            const amount = parseFloat(amountMatch[1].replace(/,/g, ''));

            // SAVE TO FIREBASE
            await db.collection('mpesa_payments').doc(code).set({
                code: code,
                amount: amount,
                fullMessage: smsContent,
                used: false, // We mark true when an order is actually placed
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`Saved Payment: ${code} of Ksh ${amount}`);
            return res.status(200).send("Payment Saved");
        } else {
            console.log("Could not parse M-Pesa message");
            return res.status(200).send("Could not parse");
        }

    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).send("Error");
    }
});

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
