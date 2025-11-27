// server.js
const express = require('express');
const path = require('path');
const fs = require('fs'); // Node.js File System module
const app = express();
const PORT = process.env.PORT || 3000;

const FAVORITES_FILE = path.join(__dirname, 'public', 'favorites.json');
const SCRAPED_DATA_FILE = path.join(__dirname, 'public', 'scraped_manga_data_mangaread.json'); // Define path for scraped data

// Python Flask server URL (ensure this matches your Python app's host and port)
const PYTHON_SCRAPER_URL = 'http://localhost:5000';

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Basic route to ensure index.html is served for the root path
app.get('/', async (req, res) => {
    console.log("Client opened website. Triggering data refresh on scraper...");
    try {
        const response = await fetch(`${PYTHON_SCRAPER_URL}/trigger_favorites_update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (response.ok) {
            const data = await response.json();
            console.log("Python scraper triggered successfully:", data.message);
        } else {
            const errorText = await response.text();
            console.error(`Error triggering scraper: ${response.status} ${response.statusText} - ${errorText}`);
        }
    } catch (error) {
        console.error("Error communicating with Python scraper during initial page load:", error);
    }

    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Endpoint to get favorites
app.get('/api/favorites', (req, res) => {
    if (fs.existsSync(FAVORITES_FILE)) {
        try {
            const favorites = JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf8'));
            res.json(favorites);
        } catch (error) {
            console.error("Error reading favorites.json:", error);
            res.status(500).json({ message: "Error reading favorites data." });
        }
    } else {
        res.json([]); // Return empty array if file doesn't exist
    }
});

// API Endpoint to add/remove a favorite
app.post('/api/favorites', (req, res) => {
    const { mangaUrl, action } = req.body; // 'add' or 'remove'

    if (!mangaUrl || !action) {
        return res.status(400).json({ message: "Manga URL and action are required." });
    }

    let favorites = [];
    if (fs.existsSync(FAVORITES_FILE)) {
        try {
            favorites = JSON.parse(fs.readFileSync(FAVORITES_FILE, 'utf8'));
        } catch (error) {
            console.error("Error parsing existing favorites.json:", error);
            favorites = []; // Reset if corrupted
        }
    }

    const cleanedUrl = mangaUrl.trim().replace(/\/+$/, ''); // Remove trailing slash for consistency

    if (action === 'add') {
        if (!favorites.includes(cleanedUrl)) {
            favorites.push(cleanedUrl);
            console.log(`Added to favorites: ${cleanedUrl}`);
        } else {
            return res.status(200).json({ message: "Manga already in favorites." });
        }
    } else if (action === 'remove') {
        const initialLength = favorites.length;
        favorites = favorites.filter(fav => fav.trim().replace(/\/+$/, '') !== cleanedUrl);
        if (favorites.length < initialLength) {
            console.log(`Removed from favorites: ${cleanedUrl}`);
        } else {
            return res.status(200).json({ message: "Manga not found in favorites." });
        }
    } else {
        return res.status(400).json({ message: "Invalid action. Use 'add' or 'remove'." });
    }

    try {
        // Ensure the public directory exists before writing
        if (!fs.existsSync(path.dirname(FAVORITES_FILE))) {
            fs.mkdirSync(path.dirname(FAVORITES_FILE), { recursive: true });
        }
        fs.writeFileSync(FAVORITES_FILE, JSON.stringify(favorites, null, 4), 'utf8');
        res.status(200).json({ message: "Favorites updated successfully.", favorites });
    } catch (error) {
        console.error("Error writing favorites.json:", error);
        res.status(500).json({ message: "Error updating favorites data." });
    }
});

// API Endpoint to download scraped manga data conditionally
app.get('/api/scraped_data_download', (req, res) => {
    // Check if the data file exists
    if (!fs.existsSync(SCRAPED_DATA_FILE)) {
        return res.status(404).json({ message: "Scraped manga data file not found." });
    }

    try {
        const stats = fs.statSync(SCRAPED_DATA_FILE);
        const lastModified = stats.mtime.toUTCString(); // Get last modification time in HTTP format
        const ifModifiedSince = req.headers['if-modified-since'];

        // If the client has a cached version and it's up-to-date
        if (ifModifiedSince && new Date(lastModified) <= new Date(ifModifiedSince)) {
            console.log("Scraped data: Not Modified (304)");
            res.setHeader('Cache-Control', 'public, max-age=0'); // Instruct client to revalidate every time
            return res.sendStatus(304); // Send Not Modified status
        }

        // Otherwise, send the file with Last-Modified header
        console.log("Scraped data: Sending new file");
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="scraped_manga_data.json"');
        res.setHeader('Last-Modified', lastModified);
        res.setHeader('Cache-Control', 'public, max-age=0'); // Instruct client to revalidate every time
        res.sendFile(SCRAPED_DATA_FILE);

    } catch (error) {
        console.error("Error serving scraped manga data:", error);
        res.status(500).json({ message: "Error retrieving scraped manga data." });
    }
});

// API Endpoint to trigger a data refresh in the Python scraper
app.post('/api/trigger_data_refresh', async (req, res) => {
    console.log("Received request to trigger data refresh from client.");
    try {
        const response = await fetch(`${PYTHON_SCRAPER_URL}/trigger_favorites_update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (response.ok) {
            const data = await response.json();
            console.log("Python scraper responded:", data.message);
            res.status(200).json({ message: "Data refresh triggered successfully on scraper.", scraper_response: data });
        } else {
            const errorText = await response.text();
            console.error(`Error triggering scraper: ${response.status} ${response.statusText} - ${errorText}`);
            res.status(response.status).json({ message: `Failed to trigger scraper: ${response.statusText}`, details: errorText });
        }
    } catch (error) {
        console.error("Error communicating with Python scraper:", error);
        res.status(500).json({ message: "Internal server error: Could not communicate with scraper." });
    }
});

// Proxy route for triggering chapter scrape
app.post('/api/trigger_chapter_scrape', async (req, res) => {
    try {
        const response = await fetch(`${PYTHON_SCRAPER_URL}/api/scrape_chapter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error("Error communicating with Python scraper:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Proxy route for triggering full manga scrape
app.post('/api/trigger_manga_scrape', async (req, res) => {
    try {
        const response = await fetch(`${PYTHON_SCRAPER_URL}/api/scrape_manga`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error("Error communicating with Python scraper:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Serving files from: ${path.join(__dirname, 'public')}`);
});
