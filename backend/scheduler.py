import threading
import time
import datetime
import json
import os
import random
import re

try:
    from .config_loader import load_config
    from .scraper.mangaread import MangaReadScraper
    from .scraper.ai_scraper import AIScraper
except ImportError:
    from config_loader import load_config
    from scraper.mangaread import MangaReadScraper
    from scraper.ai_scraper import AIScraper

# Global state
last_scrape_time = "Never"
next_scrape_time = "N/A"
is_scraper_running = False
scraper_status_message = "Idle"
favorite_scrape_event = threading.Event()
data_file_lock = threading.Lock() # Lock for file access

# Paths
FRONTEND_PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public')
SCRAPED_DATA_FILE = os.path.join(FRONTEND_PUBLIC_DIR, 'scraped_manga_data_mangaread.json')
FAVORITES_FILE = os.path.join(FRONTEND_PUBLIC_DIR, 'favorites.json')
GENRE_URLS = [
    "https://www.mangaread.org/genres/manga/",
    "https://www.mangaread.org/genres/manhwa/",
    "https://www.mangaread.org/genres/manhua/"
]

# Scraper Registry
SCRAPER_CLASSES = {
    "mangaread": MangaReadScraper,
    "ai_scraper": AIScraper
}

def load_favorites_urls():
    if os.path.exists(FAVORITES_FILE):
        try:
            with open(FAVORITES_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            return []
    return []

def load_scraped_data():
    with data_file_lock:
        if os.path.exists(SCRAPED_DATA_FILE):
            try:
                with open(SCRAPED_DATA_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def save_scraped_data(data):
    with data_file_lock:
        with open(SCRAPED_DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)

def _merge_manga_data(existing_data_map, new_data_list):
    merged_map = existing_data_map.copy()
    for new_manga in new_data_list:
        merged_map[new_manga['id']] = new_manga
    return list(merged_map.values())

def get_enabled_scrapers():
    config = load_config()
    scrapers = []
    
    websites = config.get('websites', [])
    for site in websites:
        if site.get('enabled'):
            name = site.get('name')
            cls = SCRAPER_CLASSES.get(name)
            if cls:
                scrapers.append(cls())
            else:
                print(f"Warning: No scraper class found for website '{name}'")
                
    ai_config = config.get('ai_scraper', {})
    if ai_config.get('enabled'):
        scrapers.append(AIScraper(base_url="AI_Generated"))
        
    return scrapers

def get_scraper_for_manga(manga_url):
    # Determine which scraper to use for a given URL
    scrapers = get_enabled_scrapers()
    # Simple logic for now: default to first. In future, match domain.
    if scrapers:
        return scrapers[0]
    return None

def scrape_manga_urls(scrapers, manga_urls_to_scrape, existing_mangas_map, max_chapters_per_manga=1, grab_all_chapters=False):
    current_scrape_results_map = {} 
    
    if not scrapers:
        print("No scrapers enabled.")
        return []

    primary_scraper = scrapers[0] 

    for manga_url in manga_urls_to_scrape:
        clean_url = manga_url.rstrip('/')
        manga_id = clean_url.split('/')[-1] if clean_url else f"manga_{hash(manga_url)}"

        print(f"\nScraping details for: {manga_url}")
        time.sleep(1)
        
        scraper = primary_scraper 
        
        detail_page_html = scraper.fetch_html(manga_url)
        if not detail_page_html:
            print(f"Could not fetch detail page for {manga_url}. Skipping.")
            continue

        detail_data = scraper.scrape_manga_detail(detail_page_html)

        manga_entry = existing_mangas_map.get(manga_id, {})
        manga_entry['id'] = manga_id
        manga_entry['url'] = manga_url
        manga_entry['title'] = detail_data.get('title', manga_entry.get('title', 'N/A'))
        manga_entry['cover'] = detail_data.get('cover', manga_entry.get('cover', 'N/A'))

        if manga_url in load_favorites_urls():
            manga_entry['genre_type'] = 'Favorite'
        else:
            manga_entry['genre_type'] = manga_entry.get('genre_type', 'N/A')

        manga_entry['description'] = detail_data.get('description', manga_entry.get('description', 'N/A'))
        manga_entry['alt_titles'] = detail_data.get('alt_titles', manga_entry.get('alt_titles', []))
        manga_entry['status'] = detail_data.get('status', manga_entry.get('status', 'N/A'))
        manga_entry['author'] = detail_data.get('author', manga_entry.get('author', 'N/A'))
        manga_entry['artist'] = detail_data.get('artist', manga_entry.get('artist', 'N/A'))
        manga_entry['genres'] = detail_data.get('genres', manga_entry.get('genres', []))

        chapters_from_live_site = detail_data.get('chapters', [])
        sorted_live_chapters = sorted(chapters_from_live_site,
                                      key=lambda c: float(re.search(r'\d+(\.\d+)?', c.get('title', '0')).group(0))
                                      if re.search(r'\d+(\.\d+)?', c.get('title', '0')) else 0)

        existing_chapters_for_manga = existing_mangas_map.get(manga_id, {}).get('chapters', [])
        
        all_chapters_map = {}
        for chap in existing_chapters_for_manga:
            all_chapters_map[chap['id']] = chap.copy()

        for live_chap in sorted_live_chapters:
            chap_id = live_chap['id']
            if chap_id in all_chapters_map:
                current_chapter_data = all_chapters_map[chap_id]
                current_chapter_data.update({
                    k: v for k, v in live_chap.items() if k != 'images'
                })
                if not current_chapter_data.get('images') or grab_all_chapters:
                    current_chapter_data['images'] = []
            else:
                all_chapters_map[chap_id] = live_chap.copy()

        chapters_to_scrape_images = []
        if grab_all_chapters:
            chapters_to_scrape_images = list(all_chapters_map.values())
        else:
            sorted_unique_chapters = sorted(list(all_chapters_map.values()),
                                            key=lambda c: float(re.search(r'\d+(\.\d+)?', c.get('title', '0')).group(0))
                                            if re.search(r'\d+(\.\d+)?', c.get('title', '0')) else 0)
            
            chapters_to_consider_for_image_scrape = sorted_unique_chapters[:max_chapters_per_manga]
            for chapter in chapters_to_consider_for_image_scrape:
                if not chapter.get('images'):
                    chapters_to_scrape_images.append(chapter)

        for chapter_to_scrape in chapters_to_scrape_images:
            print(f"  Scraping pages for chapter: {chapter_to_scrape['title']} ({chapter_to_scrape['url']})")
            time.sleep(1)
            chapter_page_html = scraper.fetch_html(chapter_to_scrape['url'])
            if not chapter_page_html:
                chapter_to_scrape['images'] = []
            else:
                chapter_data = scraper.scrape_chapter_pages(chapter_page_html)
                chapter_to_scrape['images'] = chapter_data.get('images', [])

            all_chapters_map[chapter_to_scrape['id']] = chapter_to_scrape
            time.sleep(1) 

        manga_entry['chapters'] = sorted(list(all_chapters_map.values()),
                                         key=lambda c: float(re.search(r'\d+(\.\d+)?', c.get('title', '0')).group(0))
                                         if re.search(r'\d+(\.\d+)?', c.get('title', '0')) else 0)

        if manga_entry['chapters']:
            manga_entry['latest_chapter_title'] = manga_entry['chapters'][-1].get('title', 'N/A')
            manga_entry['latest_chapter_url'] = manga_entry['chapters'][-1].get('url', 'N/A')
        else:
            manga_entry['latest_chapter_title'] = 'N/A'
            manga_entry['latest_chapter_url'] = 'N/A'

        current_scrape_results_map[manga_entry['id']] = manga_entry
        time.sleep(2) 

    return list(current_scrape_results_map.values())

def scrape_specific_chapter(manga_id, chapter_id):
    """Scrapes a specific chapter of a specific manga."""
    all_data = load_scraped_data()
    manga_entry = next((m for m in all_data if m['id'] == manga_id), None)
    
    if not manga_entry:
        print(f"Manga {manga_id} not found.")
        return False
        
    chapter_entry = next((c for c in manga_entry['chapters'] if c['id'] == chapter_id), None)
    if not chapter_entry:
        print(f"Chapter {chapter_id} not found in manga {manga_id}.")
        return False

    scraper = get_scraper_for_manga(manga_entry['url'])
    if not scraper:
        print("No suitable scraper found.")
        return False

    print(f"Scraping specific chapter: {chapter_entry['title']}")
    html = scraper.fetch_html(chapter_entry['url'])
    if html:
        data = scraper.scrape_chapter_pages(html)
        chapter_entry['images'] = data.get('images', [])
        
        # Save updated data
        # We need to update the entry in the list
        for i, m in enumerate(all_data):
            if m['id'] == manga_id:
                all_data[i] = manga_entry
                break
        save_scraped_data(all_data)
        return True
    return False

def scrape_manga_full(manga_id):
    """Scrapes all chapters of a specific manga."""
    all_data = load_scraped_data()
    manga_entry = next((m for m in all_data if m['id'] == manga_id), None)
    
    if not manga_entry:
        return False

    # Reuse scrape_manga_urls logic but for a single manga with grab_all_chapters=True
    scrapers = get_enabled_scrapers() # Ideally filter for the correct one
    
    # Create a map of just this manga to pass to scrape_manga_urls, 
    # but we need to update the main file afterwards.
    # Actually, scrape_manga_urls returns a list of updated entries.
    
    updated_entries = scrape_manga_urls(
        scrapers, 
        [manga_entry['url']], 
        {manga_id: manga_entry}, 
        max_chapters_per_manga=9999, 
        grab_all_chapters=True
    )
    
    if updated_entries:
        updated_manga = updated_entries[0]
        # Merge back into main data
        all_data = load_scraped_data() # Reload in case changed
        existing_map = {m['id']: m for m in all_data}
        existing_map[updated_manga['id']] = updated_manga
        save_scraped_data(list(existing_map.values()))
        return True
    return False

def scrape_favorites_data(scrapers, max_chapters_per_manga=1, grab_all_chapters=True):
    favorites_urls = load_favorites_urls()
    if not favorites_urls:
        return []

    print(f"Favorites to scrape: {favorites_urls}")
    
    existing_data = load_scraped_data()
    existing_mangas_map = {manga['id']: manga for manga in existing_data}

    return scrape_manga_urls(
        scrapers,
        manga_urls_to_scrape=favorites_urls,
        existing_mangas_map=existing_mangas_map,
        max_chapters_per_manga=max_chapters_per_manga, 
        grab_all_chapters=grab_all_chapters
    )

def scrape_recommendations_data(scrapers, num_recommendations_per_genre=5, max_chapters_per_manga=5, grab_all_chapters=False):
    if not scrapers:
        return []
        
    primary_scraper = scrapers[0]
    
    all_genre_manga_summaries = []
    for genre_url in GENRE_URLS:
        genre_type = genre_url.split('/')[-2]
        list_page_html = primary_scraper.fetch_html(genre_url)
        if list_page_html:
            all_genre_manga_summaries.extend(primary_scraper.scrape_manga_list(list_page_html, genre_type))

    favorites_urls = load_favorites_urls()
    non_favorite_manga_summaries = [
        m for m in all_genre_manga_summaries if m['url'] not in favorites_urls
    ]

    num_recommendations_total = num_recommendations_per_genre * len(GENRE_URLS)
    if len(non_favorite_manga_summaries) > num_recommendations_total:
        recommendation_summaries = random.sample(non_favorite_manga_summaries, num_recommendations_total)
    else:
        recommendation_summaries = non_favorite_manga_summaries 

    manga_urls_to_scrape = [m['url'] for m in recommendation_summaries]

    existing_data = load_scraped_data()
    existing_mangas_map = {manga['id']: manga for manga in existing_data}

    return scrape_manga_urls(
        scrapers,
        manga_urls_to_scrape=manga_urls_to_scrape,
        existing_mangas_map=existing_mangas_map,
        max_chapters_per_manga=max_chapters_per_manga, 
        grab_all_chapters=grab_all_chapters 
    )

def run_scraper_loop():
    global last_scrape_time, next_scrape_time, is_scraper_running, scraper_status_message

    # Ensure public dir exists
    os.makedirs(FRONTEND_PUBLIC_DIR, exist_ok=True)
    if not os.path.exists(FAVORITES_FILE):
        with open(FAVORITES_FILE, 'w') as f:
            json.dump([], f)

    while True:
        scrapers = get_enabled_scrapers()
        if not scrapers:
            print("No active scrapers configured.")
            time.sleep(60)
            continue
            
        config = load_config()
        scraping_config = config.get('scraping', {})
        interval_hours = scraping_config.get('interval_hours', 8)
        interval_seconds = interval_hours * 3600
        
        num_recs = scraping_config.get('num_recommendations_per_genre', 5)
        max_chapters = scraping_config.get('max_chapters_per_manga', 1)
        grab_all_favs = scraping_config.get('grab_all_chapters_favorites', False)

        if favorite_scrape_event.is_set():
            scraper_status_message = "Immediate favorites scrape triggered..."
            favorite_scrape_event.clear()
            
            existing_full_data = load_scraped_data()
            existing_full_map = {manga['id']: manga for manga in existing_full_data}

            favorites_data = scrape_favorites_data(scrapers, max_chapters_per_manga=max_chapters, grab_all_chapters=grab_all_favs)
            
            merged_data = _merge_manga_data(existing_full_map, favorites_data)
            save_scraped_data(merged_data)
            
            scraper_status_message = "Immediate favorites scrape finished."
            next_scrape_time = (datetime.datetime.now() + datetime.timedelta(seconds=interval_seconds)).strftime("%Y-%m-%d %H:%M:%S")

        else:
            is_scraper_running = True
            scraper_status_message = f"Scraping... Last run: {last_scrape_time}"
            last_scrape_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # Phase 1: Favorites
            favorites_data = scrape_favorites_data(scrapers, max_chapters_per_manga=max_chapters, grab_all_chapters=grab_all_favs)
            
            existing_full_data = load_scraped_data()
            existing_full_map = {manga['id']: manga for manga in existing_full_data}

            merged_data_after_favorites = _merge_manga_data(existing_full_map, favorites_data)
            save_scraped_data(merged_data_after_favorites)

            # Phase 2: Recommendations
            existing_full_map_after_favs = {manga['id']: manga for manga in merged_data_after_favorites}
            recommendations_data = scrape_recommendations_data(scrapers, num_recommendations_per_genre=num_recs, max_chapters_per_manga=max_chapters, grab_all_chapters=False)
            
            final_scraped_data = _merge_manga_data(existing_full_map_after_favs, recommendations_data)
            save_scraped_data(final_scraped_data)

            is_scraper_running = False
            scraper_status_message = "Scrape finished."
            next_scrape_time = (datetime.datetime.now() + datetime.timedelta(seconds=interval_seconds)).strftime("%Y-%m-%d %H:%M:%S")
        
        # Wait with check
        end_time = time.time() + interval_seconds
        while time.time() < end_time:
            if favorite_scrape_event.is_set():
                break
            time.sleep(1)

def start_scheduler():
    t = threading.Thread(target=run_scraper_loop)
    t.daemon = True
    t.start()
