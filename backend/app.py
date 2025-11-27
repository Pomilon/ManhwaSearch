from flask import Flask, send_file, jsonify, request
import os
import threading
from scheduler import start_scheduler, favorite_scrape_event, scrape_specific_chapter, scrape_manga_full, SCRAPED_DATA_FILE, FAVORITES_FILE
import scheduler

app = Flask(__name__)

# --- Flask Routes ---
@app.route('/')
def status():
    """Provides a status update of the scraper."""
    return jsonify({
        "status": "Server running",
        "scraper_running": scheduler.is_scraper_running,
        "scraper_message": scheduler.scraper_status_message,
        "last_scrape_time": scheduler.last_scrape_time,
        "next_scrape_time": scheduler.next_scrape_time,
        "data_file": SCRAPED_DATA_FILE,
        "favorites_file": FAVORITES_FILE
    })

@app.route('/download_data')
def download_data():
    """Allows downloading of the main scraped data JSON file."""
    if os.path.exists(SCRAPED_DATA_FILE):
        return send_file(SCRAPED_DATA_FILE, as_attachment=True, download_name='scraped_manga_data.json', mimetype='application/json')
    else:
        return jsonify({"error": "Data file not found. Please wait for the scraper to run or check file path."}), 404

@app.route('/trigger_favorites_update', methods=['POST'])
def trigger_favorites_update():
    """
    Endpoint to manually trigger an immediate scrape of favorite mangas.
    """
    favorite_scrape_event.set()
    print("Received request to trigger immediate favorites update.")
    return jsonify({"message": "Immediate favorites scrape triggered. Check scraper logs for progress."}), 200

@app.route('/api/scrape_chapter', methods=['POST'])
def api_scrape_chapter():
    data = request.json
    manga_id = data.get('mangaId')
    chapter_id = data.get('chapterId')
    
    if not manga_id or not chapter_id:
        return jsonify({"error": "Missing mangaId or chapterId"}), 400

    def run_task():
        print(f"Starting background scrape for chapter {chapter_id} of manga {manga_id}")
        success = scrape_specific_chapter(manga_id, chapter_id)
        if success:
            print(f"Finished background scrape for chapter {chapter_id}")
        else:
            print(f"Failed background scrape for chapter {chapter_id}")

    threading.Thread(target=run_task).start()
    return jsonify({"message": "Chapter scrape started in background."}), 202

@app.route('/api/scrape_manga', methods=['POST'])
def api_scrape_manga():
    data = request.json
    manga_id = data.get('mangaId')
    
    if not manga_id:
        return jsonify({"error": "Missing mangaId"}), 400

    def run_task():
        print(f"Starting background full scrape for manga {manga_id}")
        success = scrape_manga_full(manga_id)
        if success:
            print(f"Finished background full scrape for manga {manga_id}")
        else:
            print(f"Failed background full scrape for manga {manga_id}")

    threading.Thread(target=run_task).start()
    return jsonify({"message": "Full manga scrape started in background."}), 202

if __name__ == "__main__":
    print("Starting Manga Scraper Backend...")
    start_scheduler()
    print("Flask server starting on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
