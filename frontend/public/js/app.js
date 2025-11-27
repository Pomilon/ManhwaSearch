// Global state variables
let currentPage = 'home';
let mangaData = []; // All scraped manga data
let favoriteMangaUrls = []; // URLs of favorited manga
let selectedManga = null;
let selectedChapter = null;
let currentImageIndex = 0;
let displayMode = 'single'; // 'single' or 'all'
let previousPage = 'home'; // To know where to go back from chapters page
let lastScrapedDataModified = localStorage.getItem('lastScrapedDataModified') || '';

// DOM Elements are grabbed in initializeApplication or helper functions to ensure they exist

// --- Utility Functions ---

function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.style.display = 'none';
    });
    const page = document.getElementById(pageId);
    if(page) page.style.display = 'block';
    
    currentPage = pageId.replace('-page', '');

    // Update active navigation button styles
    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-700', 'hover:bg-gray-600', 'text-gray-300');
    });
    const activeNavButton = document.getElementById(`nav-${currentPage.replace('-', '_')}`);
    if (activeNavButton) {
        activeNavButton.classList.remove('bg-gray-700', 'hover:bg-gray-600', 'text-gray-300');
        activeNavButton.classList.add('bg-blue-600', 'text-white');
    }
}

function showDownloadMessage(message, isError = false) {
    const downloadMessageDiv = document.getElementById('download-message');
    if(!downloadMessageDiv) return;
    
    downloadMessageDiv.textContent = message;
    downloadMessageDiv.classList.remove('hidden', 'bg-red-600', 'bg-green-600');
    if (isError) {
        downloadMessageDiv.classList.add('bg-red-600');
    } else {
        downloadMessageDiv.classList.add('bg-green-600');
    }
    setTimeout(() => {
        downloadMessageDiv.classList.add('hidden');
        downloadMessageDiv.classList.remove('bg-red-600', 'bg-green-600');
    }, 5000);
}

// --- API Interaction ---

async function fetchFavoriteMangaUrls() {
    try {
        const response = await fetch('/api/favorites');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        favoriteMangaUrls = await response.json();
    } catch(error) {
        console.error("Error fetching favorite manga URLs:", error);
        favoriteMangaUrls = [];
    }
}

async function toggleFavorite(mangaUrl) {
    const isCurrentlyFavorite = favoriteMangaUrls.includes(mangaUrl);
    const action = isCurrentlyFavorite ? 'remove' : 'add';

    try {
        const response = await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mangaUrl, action }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();

        if (action === 'add') {
            if (!favoriteMangaUrls.includes(mangaUrl)) favoriteMangaUrls.push(mangaUrl);
        } else {
            favoriteMangaUrls = favoriteMangaUrls.filter(url => url !== mangaUrl);
        }
        
        if (currentPage === 'home') renderHomePage();
        if (currentPage === 'favorites') renderFavoritesPage();
        if (currentPage === 'recommendations') renderRecommendationsPage();

        alert(`Manga ${isCurrentlyFavorite ? 'removed from' : 'added to'} favorites!`);

    } catch (error) {
        console.error("Error toggling favorite:", error);
        alert("Failed to update favorites. Please try again.");
    }
}

async function fetchScrapedMangaData() {
    try {
        const headers = {};
        if (lastScrapedDataModified) {
            headers['If-Modified-Since'] = lastScrapedDataModified;
        }

        const response = await fetch('/api/scraped_data_download', {
            method: 'GET',
            headers: headers
        });

        if (response.status === 304) {
            if (mangaData.length === 0) {
                 const cachedData = localStorage.getItem('mangaDataCache');
                 if (cachedData) {
                     mangaData = JSON.parse(cachedData);
                 }
            }
        } else if (response.ok) {
            mangaData = await response.json();
            lastScrapedDataModified = response.headers.get('Last-Modified');
            localStorage.setItem('lastScrapedDataModified', lastScrapedDataModified);
            localStorage.setItem('mangaDataCache', JSON.stringify(mangaData));
        } else {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error("Error fetching scraped manga data:", error);
        const cachedData = localStorage.getItem('mangaDataCache');
        if (cachedData) {
            mangaData = JSON.parse(cachedData);
        }
        alert("Failed to load latest manga data. Displaying cached data if available.");
    }
}

async function handleScrapeChapter(mangaId, chapterId) {
    if(!confirm("Scrape this chapter now? This happens in the background.")) return;
    try {
        const response = await fetch('/api/trigger_chapter_scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mangaId, chapterId })
        });
        if(response.ok) {
            alert("Scrape started. Please wait a moment and refresh to see updates.");
        } else {
            alert("Failed to start scrape.");
        }
    } catch(e) {
        console.error(e);
        alert("Error starting scrape.");
    }
}

async function handleScrapeMangaFull(mangaId) {
    if(!confirm("Scrape ALL chapters for this manga? This might take a while.")) return;
    try {
        const response = await fetch('/api/trigger_manga_scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mangaId })
        });
        if(response.ok) {
            alert("Full scrape started. Please wait a while and refresh.");
        } else {
            alert("Failed to start full scrape.");
        }
    } catch(e) {
        console.error(e);
        alert("Error starting full scrape.");
    }
}

// --- Rendering ---

function createMangaCard(manga) {
    const mangaCard = document.createElement('div');
    mangaCard.className = "bg-gray-800 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group relative";

    const cleanedMangaUrl = manga.url ? manga.url.trim().replace(/\/+$/, '') : '';
    const isFavorite = favoriteMangaUrls.some(favUrl => favUrl.trim().replace(/\/+$/, '') === cleanedMangaUrl);
    const favoriteIconClass = isFavorite ? 'fas text-pink-500' : 'far text-gray-400';

    mangaCard.innerHTML = `
        <img
            src="${manga.cover}"
            alt="${manga.title}"
            class="w-full h-72 object-cover object-center rounded-t-xl transform group-hover:scale-105 transition-transform duration-300"
            onerror="this.onerror=null;this.src='https://placehold.co/300x450/CCCCCC/666666?text=No+Cover';"
        />
        <button class="favorite-toggle absolute top-3 right-3 bg-gray-900 bg-opacity-70 p-2 rounded-full cursor-pointer hover:scale-110 transition-transform duration-200" data-manga-url="${cleanedMangaUrl}">
            <i class="${favoriteIconClass} fa-star text-2xl"></i>
        </button>
        <div class="p-5">
            <h3 class="text-2xl font-semibold text-gray-50 mb-2 truncate">${manga.title || 'N/A'}</h3>
            <p class="text-gray-400 text-sm line-clamp-3 mb-4">${manga.description || 'No description available.'}</p>
            <div class="text-gray-500 text-xs mb-2">Genre Type: ${manga.genre_type || 'N/A'}</div>
            <div class="text-gray-500 text-xs mb-4">Latest Chapter: ${manga.latest_chapter_title || 'N/A'}</div>
            <button
                data-manga-id="${manga.id}"
                class="view-chapters-btn w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full transition-colors duration-300 transform hover:scale-105 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
            >
                View Chapters
            </button>
        </div>
    `;

    mangaCard.querySelector('.view-chapters-btn').addEventListener('click', (event) => {
        const mangaId = event.target.dataset.mangaId;
        selectedManga = mangaData.find(m => m.id === mangaId);
        if (selectedManga) {
            previousPage = currentPage;
            renderChaptersPage();
            showPage('chapters-page');
        }
    });

    mangaCard.querySelector('.favorite-toggle').addEventListener('click', (event) => {
        const mangaUrl = event.currentTarget.dataset.mangaUrl;
        toggleFavorite(mangaUrl);
    });

    return mangaCard;
}

function renderHomePage() {
    const mangaGrid = document.getElementById('manga-grid');
    if(!mangaGrid) return;
    mangaGrid.innerHTML = '';
    mangaData.forEach(manga => {
        mangaGrid.appendChild(createMangaCard(manga));
    });
}

function renderFavoritesPage() {
    const favoritesGrid = document.getElementById('favorites-grid');
    const noFavoritesMessage = document.getElementById('no-favorites-message');
    if(!favoritesGrid) return;

    favoritesGrid.innerHTML = '';
    const favorites = mangaData.filter(manga =>
        favoriteMangaUrls.some(favUrl => favUrl.trim().replace(/\/+$/, '') === (manga.url ? manga.url.trim().replace(/\/+$/, '') : ''))
    );
    
    if (favorites.length === 0) {
        if(noFavoritesMessage) noFavoritesMessage.classList.remove('hidden');
    } else {
        if(noFavoritesMessage) noFavoritesMessage.classList.add('hidden');
        favorites.forEach(manga => {
            favoritesGrid.appendChild(createMangaCard(manga));
        });
    }
}

function renderRecommendationsPage() {
    const recommendationsGrid = document.getElementById('recommendations-grid');
    if(!recommendationsGrid) return;

    recommendationsGrid.innerHTML = '';
    const nonFavorites = mangaData.filter(manga =>
        !favoriteMangaUrls.some(favUrl => favUrl.trim().replace(/\/+$/, '') === (manga.url ? manga.url.trim().replace(/\/+$/, '') : ''))
    );
    
    const numRecommendationsToShow = 12;
    const recommendations = [];
    if (nonFavorites.length > 0) {
        const shuffledNonFavorites = [...nonFavorites].sort(() => 0.5 - Math.random());
        recommendations.push(...shuffledNonFavorites.slice(0, numRecommendationsToShow));
    }

    if (recommendations.length === 0) {
        recommendationsGrid.innerHTML = `<p class="text-center text-gray-400 text-lg mt-8">
            No recommendations available right now.
        </p>`;
    } else {
        recommendations.forEach(manga => {
            recommendationsGrid.appendChild(createMangaCard(manga));
        });
    }
}

function renderChaptersPage() {
    const mangaDetails = document.getElementById('manga-details');
    const chapterList = document.getElementById('chapter-list');
    
    if (!selectedManga || !mangaDetails || !chapterList) {
        showPage('home-page');
        return;
    }

    mangaDetails.innerHTML = `
        <img
            src="${selectedManga.cover}"
            alt="${selectedManga.title}"
            class="w-48 h-72 object-cover object-center rounded-lg shadow-md md:mr-8 mb-6 md:mb-0 flex-shrink-0"
            onerror="this.onerror=null;this.src='https://placehold.co/300x450/CCCCCC/666666?text=No+Cover';"
        />
        <div class="flex-grow">
            <h2 class="text-4xl font-extrabold text-blue-400 mb-3">${selectedManga.title || 'N/A'}</h2>
            
            <div class="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 mb-4">
                <a href="${selectedManga.url}" target="_blank" rel="noopener noreferrer" class="py-2 px-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition text-sm flex items-center justify-center sm:justify-start">
                    <i class="fas fa-external-link-alt mr-2"></i> View Original
                </a>
                <button id="scrape-all-btn" class="py-2 px-4 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition text-sm flex items-center justify-center sm:justify-start">
                    <i class="fas fa-cloud-download-alt mr-2"></i> Scrape All Chapters
                </button>
            </div>

            ${selectedManga.alt_titles && selectedManga.alt_titles.length > 0 ?
                `<p class="text-gray-400 text-sm mb-2"><span class="font-semibold">Alternative Titles:</span> ${selectedManga.alt_titles.join(', ')}</p>` : ''
            }
            <p class="text-gray-400 text-sm mb-2"><span class="font-semibold">Status:</span> ${selectedManga.status || 'N/A'}</p>
            <p class="text-gray-400 text-sm mb-2"><span class="font-semibold">Author:</span> ${selectedManga.author || 'N/A'}</p>
            <p class="text-gray-400 text-sm mb-2"><span class="font-semibold">Artist:</span> ${selectedManga.artist || 'N/A'}</p>
            <p class="text-gray-400 text-sm mb-4"><span class="font-semibold">Genres:</span> ${(selectedManga.genres && selectedManga.genres.join(', ')) || 'N/A'}</p>
            <p class="text-gray-300 text-lg leading-relaxed">${selectedManga.description || 'No description available.'}</p>
        </div>
    `;
    
    // Attach event listener for "Scrape All"
    document.getElementById('scrape-all-btn').addEventListener('click', () => {
        handleScrapeMangaFull(selectedManga.id);
    });


    chapterList.innerHTML = '';
    const sortedChaptersForDisplay = [...selectedManga.chapters].reverse();

    sortedChaptersForDisplay.forEach(chapter => {
        const chapterItem = document.createElement('li');
        const hasImages = chapter.images && chapter.images.length > 0;
        chapterItem.className = `bg-gray-800 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 ${hasImages ? 'chapter-available' : ''} flex flex-col`;
        
        const checkmarkIcon = hasImages ? '<i class="fas fa-check-circle text-green-400 ml-2"></i>' : '';

        chapterItem.innerHTML = `
            <div class="p-4 flex-grow cursor-pointer read-chapter-btn" data-chapter-id="${chapter.id}">
                <span class="text-xl font-semibold text-gray-50 flex items-center">${chapter.title || 'N/A'}${checkmarkIcon}</span>
                ${chapter.date ? `<span class="block text-sm text-gray-400">Released: ${chapter.date}</span>` : ''}
            </div>
            <div class="bg-gray-900 bg-opacity-50 p-2 flex justify-end space-x-2">
                 <button class="scrape-chapter-btn text-xs bg-gray-700 hover:bg-gray-600 text-white py-1.5 px-3 rounded flex items-center hover:bg-blue-600 transition-colors" data-chapter-id="${chapter.id}" title="Scrape Chapter">
                    <i class="fas fa-sync-alt mr-1"></i> Scrape
                 </button>
                 <a href="${chapter.url}" target="_blank" rel="noopener noreferrer" class="text-xs bg-gray-700 hover:bg-gray-600 text-white py-1.5 px-3 rounded flex items-center hover:bg-blue-600 transition-colors" title="Open Source Link">
                    <i class="fas fa-external-link-alt"></i>
                 </a>
            </div>
        `;
        chapterList.appendChild(chapterItem);
    });

    chapterList.querySelectorAll('.read-chapter-btn').forEach(div => {
        div.addEventListener('click', (event) => {
            const chapterId = event.currentTarget.dataset.chapterId;
            selectedChapter = selectedManga.chapters.find(c => c.id === chapterId);
            if (selectedChapter) {
                currentImageIndex = 0;
                renderReaderPage();
                showPage('reader-page');
            }
        });
    });
    
    chapterList.querySelectorAll('.scrape-chapter-btn').forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            const chapterId = event.currentTarget.dataset.chapterId;
            handleScrapeChapter(selectedManga.id, chapterId);
        });
    });
}

function renderReaderPage() {
    const readerTitle = document.getElementById('reader-title');
    if (!selectedManga || !selectedChapter || !readerTitle) {
        showPage('home-page');
        return;
    }

    readerTitle.textContent = `${selectedManga.title} - ${selectedChapter.title}`;
    updateReaderDisplay();

    const currentChapterIndex = selectedManga.chapters.findIndex(c => c.id === selectedChapter.id);
    const prevChapterInSortedList = currentChapterIndex > 0 ? selectedManga.chapters[currentChapterIndex - 1] : null;
    const nextChapterInSortedList = currentChapterIndex < selectedManga.chapters.length - 1 ? selectedManga.chapters[currentChapterIndex + 1] : null;

    const prevChapterBtn = document.getElementById('prev-chapter-btn');
    const nextChapterBtn = document.getElementById('next-chapter-btn');

    if(prevChapterBtn) {
        prevChapterBtn.disabled = !prevChapterInSortedList;
        prevChapterBtn.classList.toggle('opacity-50', !prevChapterInSortedList);
        prevChapterBtn.classList.toggle('cursor-not-allowed', !prevChapterInSortedList);
    }

    if(nextChapterBtn) {
        nextChapterBtn.disabled = !nextChapterInSortedList;
        nextChapterBtn.classList.toggle('opacity-50', !nextChapterInSortedList);
        nextChapterBtn.classList.toggle('cursor-not-allowed', !nextChapterInSortedList);
    }
}

function updateReaderDisplay() {
    const chapterImageDisplay = document.getElementById('chapter-image-display');
    const singlePageControls = document.getElementById('single-page-controls');
    
    if(!chapterImageDisplay) return;

    chapterImageDisplay.innerHTML = '';
    if (displayMode === 'single') {
        if(singlePageControls) singlePageControls.style.display = 'flex';
        const img = document.createElement('img');
        img.src = selectedChapter.images[currentImageIndex];
        img.alt = `${selectedChapter.title} - Page ${currentImageIndex + 1}`;
        img.className = "max-w-full h-auto rounded-lg shadow-md";
        img.onerror = function() {
            this.onerror = null;
            this.src = 'https://placehold.co/800x1200/CCCCCC/666666?text=Image+Not+Found';
        };
        chapterImageDisplay.classList.remove('flex-col', 'overflow-y-auto', 'max-h-[70vh]', 'scrollbar-thin', 'scrollbar-thumb-gray-700', 'scrollbar-track-gray-900');
        chapterImageDisplay.classList.add('justify-center', 'items-center');
        chapterImageDisplay.appendChild(img);
        updatePageCounter();
    } else {
        if(singlePageControls) singlePageControls.style.display = 'none';
        chapterImageDisplay.classList.add('flex-col', 'overflow-y-auto', 'max-h-[70vh]', 'scrollbar-thin', 'scrollbar-thumb-gray-700', 'scrollbar-track-gray-900');
        chapterImageDisplay.classList.remove('justify-center', 'items-center');
        selectedChapter.images.forEach((imageSrc, index) => {
            const img = document.createElement('img');
            img.src = imageSrc;
            img.alt = `${selectedChapter.title} - Page ${index + 1}`;
            img.className = "max-w-full h-auto rounded-lg shadow-md my-2";
            img.onerror = function() {
                this.onerror = null;
                this.src = 'https://placehold.co/800x1200/CCCCCC/666666?text=Image+Not+Found';
            };
            chapterImageDisplay.appendChild(img);
        });
    }
    updateImageNavigationButtons();
    updateDisplayModeButtons();
}

function updatePageCounter() {
    const pageCounter = document.getElementById('page-counter');
    if(pageCounter) pageCounter.textContent = `Page ${currentImageIndex + 1} / ${selectedChapter.images.length}`;
}

function updateImageNavigationButtons() {
    const prevPageBtn = document.getElementById('prev-page-btn');
    const nextPageBtn = document.getElementById('next-page-btn');

    if(prevPageBtn) {
        prevPageBtn.disabled = currentImageIndex === 0;
        prevPageBtn.classList.toggle('opacity-50', currentImageIndex === 0);
        prevPageBtn.classList.toggle('cursor-not-allowed', currentImageIndex === 0);
    }

    if(nextPageBtn) {
        nextPageBtn.disabled = currentImageIndex === selectedChapter.images.length - 1;
        nextPageBtn.classList.toggle('opacity-50', currentImageIndex === selectedChapter.images.length - 1);
        nextPageBtn.classList.toggle('cursor-not-allowed', currentImageIndex === selectedChapter.images.length - 1);
    }
}

function updateDisplayModeButtons() {
    const singlePageModeBtn = document.getElementById('single-page-mode-btn');
    const allPagesModeBtn = document.getElementById('all-pages-mode-btn');

    if(singlePageModeBtn) {
        singlePageModeBtn.classList.toggle('bg-blue-600', displayMode === 'single');
        singlePageModeBtn.classList.toggle('text-white', displayMode === 'single');
    }
    if(allPagesModeBtn) {
        allPagesModeBtn.classList.toggle('bg-blue-600', displayMode === 'all');
        allPagesModeBtn.classList.toggle('text-white', displayMode === 'all');
    }
}

// --- Download ---

async function handleDownloadChapter() {
    if (!selectedChapter || !selectedChapter.images || selectedChapter.images.length === 0) {
        showDownloadMessage("No images to download for this chapter.", true);
        return;
    }

    const downloadButton = document.getElementById('download-chapter-btn');
    downloadButton.disabled = true;
    downloadButton.textContent = 'Downloading...';
    downloadButton.classList.remove('bg-green-600', 'hover:bg-green-700');
    downloadButton.classList.add('bg-yellow-600', 'opacity-70', 'cursor-not-allowed');

    try {
        for (let i = 0; i < selectedChapter.images.length; i++) {
            const imageUrl = selectedChapter.images[i];
            const fileName = `${selectedManga.title.replace(/\s/g, '_')}_Chapter-${selectedChapter.title.replace(/\s/g, '_')}_Page-${i + 1}.jpg`;
            
            showDownloadMessage(`Downloading image ${i + 1} of ${selectedChapter.images.length}...`);

            const response = await fetch(imageUrl, {
                mode: 'cors'
            });

            if (!response.ok) continue;

            const imageBlob = await response.blob();
            const blobUrl = URL.createObjectURL(imageBlob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

            await new Promise(resolve => setTimeout(resolve, 100));
        }
        showDownloadMessage("Chapter downloaded successfully!");
    } catch (error) {
        showDownloadMessage("Error downloading chapter.", true);
    } finally {
        downloadButton.disabled = false;
        downloadButton.textContent = 'Download Chapter';
        downloadButton.classList.remove('bg-yellow-600', 'opacity-70', 'cursor-not-allowed');
        downloadButton.classList.add('bg-green-600', 'hover:bg-green-700');
    }
}

// --- Init ---

async function initializeApplication() {
    const loadingSpinner = document.getElementById('loading-spinner');
    const mainNavigation = document.getElementById('main-navigation');

    if(loadingSpinner) loadingSpinner.style.display = 'flex';
    if(mainNavigation) mainNavigation.classList.add('hidden');

    const cachedMangaData = localStorage.getItem('mangaDataCache');
    if (cachedMangaData) {
        mangaData = JSON.parse(cachedMangaData);
    }

    await fetchFavoriteMangaUrls();
    await fetchScrapedMangaData();

    renderHomePage();
    showPage('home-page');

    if(loadingSpinner) loadingSpinner.style.display = 'none';
    if(mainNavigation) mainNavigation.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    initializeApplication();

    document.getElementById('nav-all-titles')?.addEventListener('click', () => {
        renderHomePage();
        showPage('home-page');
    });

    document.getElementById('nav-favorites')?.addEventListener('click', () => {
        renderFavoritesPage();
        showPage('favorites-page');
    });

    document.getElementById('nav-recommendations')?.addEventListener('click', () => {
        renderRecommendationsPage();
        showPage('recommendations-page');
    });

    document.getElementById('back-to-previous-btn')?.addEventListener('click', () => {
        selectedManga = null;
        showPage(`${previousPage}-page`);
    });

    document.getElementById('back-to-chapters-btn')?.addEventListener('click', () => {
        selectedChapter = null;
        renderChaptersPage();
        showPage('chapters-page');
    });

    document.getElementById('prev-page-btn')?.addEventListener('click', () => {
        if (currentImageIndex > 0) {
            currentImageIndex--;
            updateReaderDisplay();
        }
    });

    document.getElementById('next-page-btn')?.addEventListener('click', () => {
        if (currentImageIndex < selectedChapter.images.length - 1) {
            currentImageIndex++;
            updateReaderDisplay();
        }
    });

    document.getElementById('single-page-mode-btn')?.addEventListener('click', () => {
        displayMode = 'single';
        updateReaderDisplay();
    });

    document.getElementById('all-pages-mode-btn')?.addEventListener('click', () => {
        displayMode = 'all';
        updateReaderDisplay();
    });

    document.getElementById('download-chapter-btn')?.addEventListener('click', handleDownloadChapter);

    document.getElementById('prev-chapter-btn')?.addEventListener('click', () => {
        if (selectedManga && selectedChapter) {
            const currentChapterIndex = selectedManga.chapters.findIndex(c => c.id === selectedChapter.id);
            if (currentChapterIndex > 0) {
                selectedChapter = selectedManga.chapters[currentChapterIndex - 1];
                currentImageIndex = 0;
                renderReaderPage();
            }
        }
    });

    document.getElementById('next-chapter-btn')?.addEventListener('click', () => {
        if (selectedManga && selectedChapter) {
            const currentChapterIndex = selectedManga.chapters.findIndex(c => c.id === selectedChapter.id);
            if (currentChapterIndex < selectedManga.chapters.length - 1) {
                selectedChapter = selectedManga.chapters[currentChapterIndex + 1];
                currentImageIndex = 0;
                renderReaderPage();
            }
        }
    });
});
