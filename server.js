const express = require('express');
const path = require('path');
const app = express();

// Render automatically sets process.env.PORT to 10000
const PORT = process.env.PORT || 3000;

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '/')));

// Send index.html when user visits home
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// IMPORTANT: The '0.0.0.0' tells the server to accept connections from outside
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
