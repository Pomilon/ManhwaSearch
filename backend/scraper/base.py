from abc import ABC, abstractmethod

class ScraperBase(ABC):
    @abstractmethod
    def scrape_manga_list(self, url, genre_type):
        """Scrape a list of mangas from a given URL."""
        pass

    @abstractmethod
    def scrape_manga_detail(self, html_content):
        """Scrape details of a specific manga."""
        pass

    @abstractmethod
    def scrape_chapter_pages(self, html_content):
        """Scrape images for a specific chapter."""
        pass
