import requests
from bs4 import BeautifulSoup
import re
import time
from .base import ScraperBase

class MangaReadScraper(ScraperBase):
    BASE_URL = "https://www.mangaread.org/"

    def fetch_html(self, url, retries=3, delay=2):
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        for i in range(retries):
            try:
                response = requests.get(url, headers=headers, timeout=15)
                response.raise_for_status()
                return response.text
            except requests.exceptions.RequestException as e:
                print(f"Error fetching {url}: {e}")
                if i < retries - 1:
                    time.sleep(delay)
                    delay *= 2
        return None

    def scrape_manga_list(self, html_content, genre_type="N/A"):
        if not html_content:
            return []

        soup = BeautifulSoup(html_content, 'html.parser')
        mangas = []

        manga_elements = soup.find_all('div', class_=['page-item-detail', 'c-tabs-item__content'])

        for element in manga_elements:
            try:
                manga_title = 'N/A'
                manga_full_url = 'N/A'
                manga_id = 'N/A'
                manga_cover = 'N/A'
                manga_latest_chapter_title = 'N/A'
                manga_latest_chapter_url = 'N/A'

                title_h3_tag = element.find('h3', class_='h5')
                if title_h3_tag:
                    title_link_tag = title_h3_tag.find('a')
                    if title_link_tag:
                        manga_title = title_link_tag.get_text(strip=True)
                        manga_url_relative = title_link_tag.get('href')
                        if manga_url_relative:
                            manga_full_url = requests.compat.urljoin(self.BASE_URL, manga_url_relative)

                if manga_title == 'N/A':
                    read_title_link = element.find('a', class_='read-title')
                    if read_title_link:
                        manga_title = read_title_link.get_text(strip=True)
                        manga_url_relative = read_title_link.get('href')
                        if manga_url_relative:
                            manga_full_url = requests.compat.urljoin(self.BASE_URL, manga_url_relative)

                if manga_full_url != 'N/A':
                    clean_url = manga_full_url.rstrip('/')
                    manga_id = clean_url.split('/')[-1]
                    if not manga_id:
                        manga_id = f"manga_{hash(manga_full_url)}"
                else:
                    manga_id = f"manga_no_url_{len(mangas)}_{int(time.time() * 1000)}"

                img_ratio_div = element.find('div', class_='img-in-ratio')
                if img_ratio_div:
                    cover_img_tag = img_ratio_div.find('img')
                    if cover_img_tag:
                        manga_cover = cover_img_tag.get('data-src') or cover_img_tag.get('src')
                        if manga_cover and not manga_cover.startswith('http'):
                            manga_cover = requests.compat.urljoin(self.BASE_URL, manga_cover)

                if manga_cover == 'N/A':
                    cover_img_tag_direct = element.find('img')
                    if cover_img_tag_direct:
                        manga_cover = cover_img_tag_direct.get('data-src') or cover_img_tag_direct.get('src')
                        if manga_cover and not manga_cover.startswith('http'):
                            manga_cover = requests.compat.urljoin(self.BASE_URL, manga_cover)

                chapter_item_div = element.find('div', class_='chapter-item')
                if chapter_item_div:
                    span_chapter_tag = chapter_item_div.find('span', class_='chapter')
                    if span_chapter_tag:
                        latest_chapter_link_tag = span_chapter_tag.find('a')
                        if latest_chapter_link_tag:
                            manga_latest_chapter_title = latest_chapter_link_tag.get_text(strip=True)
                            manga_latest_chapter_url = requests.compat.urljoin(self.BASE_URL, latest_chapter_link_tag.get('href'))

                if manga_latest_chapter_title == 'N/A':
                    latest_chap_meta = element.find('div', class_='latest-chap')
                    if latest_chap_meta:
                        latest_chapter_link_tag = latest_chap_meta.find('a')
                        if latest_chapter_link_tag:
                            manga_latest_chapter_title = latest_chapter_link_tag.get_text(strip=True)
                            manga_latest_chapter_url = requests.compat.urljoin(self.BASE_URL, latest_chapter_link_tag.get('href'))


                mangas.append({
                    'id': manga_id,
                    'title': manga_title,
                    'genre_type': genre_type,
                    'cover': manga_cover,
                    'url': manga_full_url,
                    'latest_chapter_title': manga_latest_chapter_title,
                    'latest_chapter_url': manga_latest_chapter_url,
                    'chapters': []
                })
            except Exception as e:
                print(f"Error parsing manga element: {e}")
                continue
        return mangas

    def scrape_manga_detail(self, html_content):
        if not html_content:
            return {'chapters': []}

        soup = BeautifulSoup(html_content, 'html.parser')
        chapters = []
        manga_details = {}

        post_title_div = soup.find('div', class_='post-title')
        if post_title_div:
            main_title_tag = post_title_div.find('h1')
            manga_details['title'] = main_title_tag.get_text(strip=True) if main_title_tag else 'N/A'
        else:
            main_title_tag = soup.find('h1', class_='entry-title')
            manga_details['title'] = main_title_tag.get_text(strip=True) if main_title_tag else 'N/A'

        cover_img_tag = soup.find('div', class_='summary_image')
        if cover_img_tag:
            img_el = cover_img_tag.find('img')
            if img_el:
                manga_details['cover'] = img_el.get('data-src') or img_el.get('src')
                if manga_details['cover'] and not manga_details['cover'].startswith('http'):
                    manga_details['cover'] = requests.compat.urljoin(self.BASE_URL, manga_details['cover'])
            else:
                manga_details['cover'] = 'N/A'
        else:
            manga_details['cover'] = 'N/A'

        description_tag = soup.find('div', class_='description-summary')
        if description_tag:
            description_content = description_tag.find('div', class_='summary__content')
            if description_content:
                for hidden_content in description_content.find_all('div', class_='hidden-content'):
                    hidden_content.decompose()
                manga_details['description'] = description_content.get_text(strip=True)
            else:
                manga_details['description'] = 'N/A'
        else:
            manga_details['description'] = 'N/A'

        post_content_items = soup.find_all('div', class_='post-content_item')
        alt_title_div = None
        for item in post_content_items:
            summary_heading = item.find('div', class_='summary-heading')
            if summary_heading and "Alternative" in summary_heading.get_text(strip=True):
                alt_title_div = item
                break

        if alt_title_div:
            alt_titles_content = alt_title_div.find('div', class_='summary-content')
            manga_details['alt_titles'] = [t.strip() for t in alt_titles_content.get_text(separator=',', strip=True).split(',')] if alt_titles_content else []
        else:
            manga_details['alt_titles'] = []

        status_div = None
        for item in post_content_items:
            summary_heading = item.find('div', class_='summary-heading')
            if summary_heading and "Status" in summary_heading.get_text(strip=True):
                status_div = item
                break
        manga_details['status'] = status_div.find('div', class_='summary-content').get_text(strip=True) if status_div and status_div.find('div', class_='summary-content') else 'N/A'

        author_tag = soup.find('div', class_='author-content')
        manga_details['author'] = author_tag.get_text(strip=True) if author_tag else 'N/A'

        artist_tag = soup.find('div', class_='artist-content')
        manga_details['artist'] = artist_tag.get_text(strip=True) if artist_tag else 'N/A'

        genres_container = soup.find('div', class_='genres-content')
        manga_details['genres'] = [a.get_text(strip=True) for a in genres_container.find_all('a')] if genres_container else []

        chapter_list_container = soup.find('ul', class_='main version-chap') or soup.find('ul', class_='version-chap')

        if chapter_list_container:
            chapter_elements = chapter_list_container.find_all('li', class_='wp-manga-chapter')
            for element in chapter_elements:
                try:
                    link_tag = element.find('a')
                    if not link_tag:
                        continue
                    chapter_full_url = requests.compat.urljoin(self.BASE_URL, link_tag.get('href'))
                    chapter_title = link_tag.get_text(strip=True)
                    chapter_id_match = re.search(r'chapter-(\d+(?:-\d+)?)/?$', chapter_full_url)
                    chapter_id = chapter_id_match.group(1) if chapter_id_match else hash(chapter_full_url)
                    date_tag = element.find('span', class_='chapter-release-date')
                    chapter_date = date_tag.find('i').get_text(strip=True) if date_tag and date_tag.find('i') else 'N/A'
                    chapters.append({
                        'id': chapter_id,
                        'title': chapter_title,
                        'url': chapter_full_url,
                        'date': chapter_date,
                        'images': []
                    })
                except Exception:
                    continue
        manga_details['chapters'] = chapters
        return manga_details

    def scrape_chapter_pages(self, html_content):
        if not html_content:
            return {'images': []}

        soup = BeautifulSoup(html_content, 'html.parser')
        image_urls = []

        reading_content_div = soup.find('div', class_='reading-content')
        if reading_content_div:
            image_elements = reading_content_div.find_all('img')
            for img_tag in image_elements:
                img_src = img_tag.get('data-src') or img_tag.get('src')
                if img_src and img_src.strip():
                    cleaned_img_src = img_src.split('?')[0].strip()
                    if cleaned_img_src.startswith('//'):
                        cleaned_img_src = 'https:' + cleaned_img_src
                    elif not cleaned_img_src.startswith('http'):
                         cleaned_img_src = requests.compat.urljoin(self.BASE_URL, cleaned_img_src)
                    image_urls.append(cleaned_img_src)
        return {'images': image_urls}
