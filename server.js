const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 3000;

// --- FIX 1: ACCEPT ALL DATA FORMATS ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, '/')));

// --- THE WEBHOOK ---
app.post('/webhook/sms', async (req, res) => {
    try {
        console.log("\n==================== INCOMING REQUEST ====================");
        
        // --- DEBUG: SEE EXACTLY WHAT THE APP SENT ---
        console.log("RAW BODY:", JSON.stringify(req.body, null, 2));

        // 1. Get the message content (Try every possible field name)
        // Some apps use 'message', some 'text', some 'content', some 'body'
        let smsContent = req.body.message || req.body.body || req.body.text || req.body.content || req.body.msg || "";
        
        // If smsContent is still empty, check if the app sent the message as a key
        if (!smsContent && typeof req.body === 'string') {
            smsContent = req.body;
        }

        const sender = req.body.sender || req.body.from || req.body.phone || "Unknown";

        console.log(`> Sender: ${sender}`);
        console.log(`> Content: "${smsContent}"`);

        if (!smsContent) {
            console.log("❌ ERROR: No SMS content found in request.");
            return res.status(400).send("No content received");
        }

        // 2. CHECK: Is it M-Pesa? (Check for 'Confirmed' keyword)
        if (!smsContent.toLowerCase().includes("confirmed")) {
            console.log("⚠️ Ignored: Message does not contain 'Confirmed'.");
            return res.status(200).send("Ignored");
        }

        // 3. EXTRACT DATA (BULLETPROOF REGEX)
        
        // FIX 2: Removed '^' anchor. Finds 10-digit code anywhere in text.
        // Example: "Fwd: UA5KK..." works now.
        const codeRegex = /([A-Z0-9]{10})\s+Confirmed/i;
        
        // Looks for 'Ksh' followed by numbers, ignoring spaces or weird chars
        const amountRegex = /Ksh\s*([\d,]+)/i;

        const codeMatch = smsContent.match(codeRegex);
        const amountMatch = smsContent.match(amountRegex);

        if (codeMatch && amountMatch) {
            const code = codeMatch[1].toUpperCase();
            
            // Remove commas to get pure number (19,000 -> 19000)
            const amount = parseFloat(amountMatch[1].replace(/,/g, ''));

            console.log(`✅ MATCH FOUND!`);
            console.log(`> Code: ${code}`);
            console.log(`> Amount: ${amount}`);

            // 4. SAVE TO FIREBASE
            await db.collection('mpesa_payments').doc(code).set({
                code: code,
                amount: amount,
                fullMessage: smsContent,
                originalSender: sender,
                used: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("💾 SAVED TO DATABASE.");
            return res.status(200).send("Payment Saved");
        } else {
            console.log("❌ PARSING FAILED.");
            if(!codeMatch) console.log("-> Could not find Transaction Code (e.g. QA... Confirmed)");
            if(!amountMatch) console.log("-> Could not find Amount (e.g. Ksh...)");
            return res.status(200).send("Could not parse");
        }

    } catch (error) {
        console.error("🚨 CRITICAL ERROR:", error);
        res.status(500).send(error.message);
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
