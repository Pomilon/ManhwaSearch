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
├── backend/                \# Python Flask Backend
│   ├── app.py              \# Main application entry point & API routes
│   ├── scheduler.py        \# Background task scheduler
│   ├── Dockerfile          \# Backend container definition
│   └── ...
├── frontend/               \# Node.js Express Frontend
│   ├── server.js           \# Express server & API proxy
│   ├── Dockerfile          \# Frontend container definition
│   └── public/             \# Static assets
└── config/
└── settings.json       \# Application settings
├── docker-compose.yml      \# Orchestration for full-stack deployment

````

## Prerequisites

-   **Docker & Docker Compose** (Recommended)
-   *Or for manual setup:*
    -   **Python 3.8+**
    -   **Node.js 14+** & **npm**

---

## Installation & Running

### Option 1: Docker (Recommended)

The easiest way to run ManhwaSearch is using Docker Compose, which sets up the database, backend, and frontend networking automatically.

1.  **Start the Application**:
    Run the following command in the project root:
    ```bash
    docker-compose up -d
    ```

2.  **Access the App**:
    -   **Frontend**: Open [http://localhost:3000](http://localhost:3000) in your browser.
    -   **Backend API**: Running on `http://localhost:5000` (handled internally).

3.  **Stop the Application**:
    ```bash
    docker-compose down
    ```

### Option 2: Manual Setup

If you prefer running without Docker, follow these steps:

#### 1. Backend Setup
Navigate to the `backend` directory and install the required Python packages:

```bash
cd backend
pip install -r requirements.txt
````

Start the backend server:

```bash
# From project root
python backend/app.py
```

*The backend API will start on `http://127.0.0.1:5000`.*

#### 2\. Frontend Setup

In a separate terminal, navigate to the `frontend` directory and install dependencies:

```bash
cd frontend
npm install
```

Start the frontend server:

```bash
node server.js
```

*The frontend will be accessible at `http://localhost:3000`.*

-----

## Configuration

The application is configured via `config/settings.json`. These settings persist even when running in Docker (via volume mapping).

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
            "url": "[https://www.mangaread.org/](https://www.mangaread.org/)",
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
      - **Full Manga**: On the manga details page, click "Scrape All Chapters" to queue a full update.
      - **Specific Chapter**: In the chapter list, click the "Scrape" button next to a chapter to fetch its images immediately.

## Troubleshooting

  - **Docker Issues**: If the containers fail to start, check the logs with `docker-compose logs -f`.
  - **Images not loading**: Some websites block hotlinking. Ensure the backend has successfully scraped the images (check console logs).
  - **Port Conflicts**: Ensure ports 5000 (backend) and 3000 (frontend) are free on your host machine.

## License

MIT
