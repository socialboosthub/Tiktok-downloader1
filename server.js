const express = require('express');
const path = require('path');
const app = express();

// Set the port (Render provides the port automatically via process.env.PORT)
const PORT = process.env.PORT || 3000;

// Serve static files (HTML, CSS, JS) from the current directory
app.use(express.static(path.join(__dirname, '/')));

// Send index.html when the user goes to the homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
