const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // PUT YOUR KEY FILE HERE

// Initialize Firebase on the Server
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse incoming data from the SMS App
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/')));

// --- THE AUTOMATIC SMS HANDLER ---
app.post('/api/incoming-sms', async (req, res) => {
    try {
        // The SMS app usually sends the message in a field called "content" or "message"
        // Adjust 'content' based on the app settings, but usually it's req.body.content
        const sms = req.body.content || req.body.message || "";
        
        console.log("📩 Received SMS:", sms);

        // 1. Regex to find M-Pesa Code (10 chars) and Amount
        const codeMatch = sms.match(/([A-Z0-9]{10})/);
        const amountMatch = sms.match(/Ksh\s?([\d,]+)/i);

        if (!codeMatch || !amountMatch) {
            console.log("❌ Not an M-Pesa payment SMS.");
            return res.status(200).send("Ignored");
        }

        const mpesaCode = codeMatch[1];
        const amount = parseInt(amountMatch[1].replace(/,/g, ''));

        console.log(`🔎 Looking for Order: Code=${mpesaCode}, Amount=${amount}`);

        // 2. Search Firebase for the order
        const ordersRef = db.collection('orders');
        const q = ordersRef.where('mpesaCode', '==', mpesaCode)
                           .where('status', '==', 'Verifying');
        
        const snapshot = await q.get();

        if (snapshot.empty) {
            console.log("⚠️ Order not found or already paid.");
            return res.status(200).send("Order not found");
        }

        // 3. Update the Order
        let updated = false;
        const batch = db.batch();

        snapshot.forEach(doc => {
            const orderData = doc.data();
            // Allow a small margin of error or exact match
            if (orderData.submittedAmount === amount) {
                batch.update(doc.ref, { status: 'Paid' });
                updated = true;
                console.log(`✅ MATCHED! Order ${doc.id} updated to Paid.`);
            }
        });

        if (updated) {
            await batch.commit();
            return res.status(200).send("Payment Verified");
        } else {
             return res.status(200).send("Amount mismatch");
        }

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Standard Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
