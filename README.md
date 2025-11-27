# ManhwaSearch - Manga Scraper & Reader

ManhwaSearch is a self-hosted web application for scraping, managing, and reading manga and manhwa. It features a modern, responsive Single Page Application (SPA) frontend and a Python backend with a background scheduler for automated updates.

## Features

-   **Manga & Manhwa Scraping**: Automatically scrape details, chapters, and images from supported websites (e.g., mangaread.org).
-   **Reading Interface**: A built-in reader with Single Page and All Pages modes.
-   **Favorites Management**: Mark titles as favorites to automatically keep them updated.
-   **Background Scheduler**: Periodically checks for updates to favorites and fetches new recommendations.
-   **Manual Scraping Control**: Trigger immediate scrapes for specific chapters or entire manga directly from the UI.
-   **Responsive UI**: Optimized for both desktop and mobile devices.
-   **Configuration**: customizable settings for scraping intervals and website management.
-   **Modular Architecture**: Designed for easy extension with new scraper modules.

## Project Structure

```
ManhwaSearch/
├── backend/                # Python Flask Backend
│   ├── app.py              # Main application entry point & API routes
│   ├── scheduler.py        # Background task scheduler
│   ├── config_loader.py    # Configuration management
│   ├── scraper/            # Scraper modules
│   │   ├── base.py         # Abstract base class for scrapers
│   │   ├── mangaread.py    # Implementation for mangaread.org
│   │   └── ai_scraper.py   # Experimental AI scraper
│   └── requirements.txt    # Python dependencies
├── frontend/               # Node.js Express Frontend
│   ├── server.js           # Express server & API proxy
│   ├── package.json        # Node.js dependencies
│   └── public/             # Static assets
│       ├── index.html      # Main HTML file
│       ├── css/            # Stylesheets
│       ├── js/             # Frontend logic (app.js)
│       └── scraped_data... # Data storage (JSON)
└── config/
    └── settings.json       # Application settings
```

## Prerequisites

-   **Python 3.8+**
-   **Node.js 14+** & **npm**

## Installation

### 1. Backend Setup

Navigate to the `backend` directory and install the required Python packages:

```bash
cd backend
pip install -r requirements.txt
```

### 2. Frontend Setup

Navigate to the `frontend` directory and install the required Node.js packages:

```bash
cd frontend
npm install
```

## Running the Application

For the application to function correctly, both the backend and frontend servers must be running.

### 1. Start the Backend

In a terminal, navigate to the project root or `backend` directory and run:

```bash
# From project root
python backend/app.py
```

The backend API will start on `http://127.0.0.1:5000`.

### 2. Start the Frontend

In a separate terminal, navigate to the `frontend` directory and run:

```bash
cd frontend
node server.js
```

The frontend will be accessible at `http://localhost:3000`.

## Configuration

The application is configured via `config/settings.json`.

```json
{
    "scraping": {
        "interval_hours": 8,                   # How often the background scraper runs
        "max_chapters_per_manga": 1,           # How many new chapters to scrape images for automatically
        "num_recommendations_per_genre": 5,    # Number of recommendations to fetch
        "grab_all_chapters_favorites": false   # If true, scrapes images for ALL chapters of favorites (intensive)
    },
    "websites": [
        {
            "name": "mangaread",
            "url": "https://www.mangaread.org/",
            "enabled": true
        }
    ],
    "ai_scraper": {
        "enabled": false,
        "api_key": ""
    }
}
```

### Adding New Scrapers

1.  Create a new Python file in `backend/scraper/` (e.g., `mysite.py`).
2.  Implement a class inheriting from `ScraperBase`.
3.  Register the new class in `backend/scheduler.py` in the `SCRAPER_CLASSES` dictionary.
4.  Add an entry to the `websites` list in `config/settings.json`.

## Usage Guide

1.  **Home Page**: Browse a list of scraped titles. Use the search bar to filter.
2.  **Reading**: Click "View Chapters" on any card. Select a chapter to read.
3.  **Favorites**: Click the star icon on any manga card to add it to your favorites. The scheduler prioritizes updates for these titles.
4.  **Manual Scraping**:
    -   **Full Manga**: On the manga details page, click "Scrape All Chapters" to queue a full update.
    -   **Specific Chapter**: In the chapter list, click the "Scrape" button next to a chapter to fetch its images immediately.
    -   **View Original**: Click the "View Original" button or the external link icon to visit the source website.

## Troubleshooting

-   **Images not loading**: Some websites block hotlinking. Ensure the backend has successfully scraped the images (check console logs).
-   **Scraper not running**: Check `backend/app.py` output logs. Ensure `interval_hours` in `settings.json` is reasonable.
-   **Port Conflicts**: Ensure ports 5000 (backend) and 3000 (frontend) are free.

## License

MIT
