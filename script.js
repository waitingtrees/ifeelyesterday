// Enter the Are.na channel slug here. It has to be an open or closed channel. Private channels are not supported.
let channel_title = 'ifeelyesterday';

// Are.na's base API url
const api = 'https://api.are.na/v2/channels/';

// Get grid element from index.html
const thumbs_el = document.querySelector('#thumbs');

// Create loading indicator
const loadingEl = document.createElement('div');
loadingEl.id = 'loading';
loadingEl.innerHTML = '<p>camera roll is loading...</p>';
document.body.appendChild(loadingEl);

let allImages = [];
let uniqueUrls = new Set();

// Function to create and append thumbnail elements
function createThumbnail(item) {
    if (item.class == 'Image' && !uniqueUrls.has(item.image.display.url)) {
        let thumb_el = document.createElement('div');
        thumb_el.classList.add('thumb');
        thumb_el.innerHTML = `<img src="${item.image.thumb.url}" data-large="${item.image.large.url}" data-title="${item.title || ''}">`;
        thumb_el.classList.add('image');
        
        // Add click listener immediately for each thumbnail
        thumb_el.addEventListener('click', e => {
            currentImageIndex = Array.from(thumbs_el.children).indexOf(thumb_el);
            showImage(currentImageIndex);
        });
        
        thumbs_el.appendChild(thumb_el);
        uniqueUrls.add(item.image.display.url);
        allImages.push(item);
    } else if (item.class == 'Text') {
        let thumb_el = document.createElement('div');
        thumb_el.classList.add('thumb', 'text-block');
        
        // Are.na returns either item.content (plain text) or item.content_html (formatted HTML)
        // We'll use content_html if available, otherwise fall back to content
        const rawContent = item.content_html || item.content || '';
        const escapedContent = rawContent.replace(/"/g, '&quot;');
        const escapedTitle = (item.title || '').replace(/"/g, '&quot;');
        
        thumb_el.innerHTML = `<div class="text-content" data-content="${escapedContent}" data-title="${escapedTitle}">${rawContent}</div>`;
        
        // Add click listener for text blocks
        thumb_el.addEventListener('click', e => {
            currentImageIndex = Array.from(thumbs_el.children).indexOf(thumb_el);
            showText(currentImageIndex);
        });
        
        thumbs_el.appendChild(thumb_el);
        allImages.push(item);
    }
}

// Function to fetch a page of contents
async function fetchPage(page = 1, per = 100) {
    try {
        const response = await fetch(`${api}${channel_title}/contents?page=${page}&per=${per}&direction=desc`, {
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching page:', error);
        return null;
    }
}

// Main function to fetch all contents
async function fetchAllContents() {
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
        const data = await fetchPage(page, 20);
        if (!data) break;
        
        data.contents.forEach(block => {
            createThumbnail(block);
        });

        // Set favicon using first image (only on first page)
        if (page === 1 && data.contents.length > 0) {
            const firstImage = data.contents[0];
            if (firstImage.class === 'Image') {
                const favicon = document.createElement('link');
                favicon.rel = 'icon';
                favicon.href = firstImage.image.thumb.url;
                document.head.appendChild(favicon);
            }
        }
        
        hasMore = data.contents.length === 20;
        page++;
    }
    
    // Hide loading element when done
    loadingEl.style.display = 'none';
    console.log(`Loaded ${allImages.length} items`);
}

// Start fetching contents
fetchAllContents();

// Add click listener for viewer to close it
const viewer = document.querySelector('#viewer');
const viewer_img = document.querySelector('#viewer img');

// Create title element
const titleEl = document.createElement('div');
titleEl.id = 'image-title';
viewer.appendChild(titleEl);

// Track current image index
let currentImageIndex = -1;

// Function to preload adjacent images for faster navigation
function preloadAdjacentImages(index) {
    const thumbs = Array.from(thumbs_el.children);
    // Preload 3 images in each direction for faster desktop navigation
    const indicesToPreload = [
        index - 3, index - 2, index - 1,
        index + 1, index + 2, index + 3
    ];

    indicesToPreload.forEach(i => {
        if (i >= 0 && i < thumbs.length) {
            const img = thumbs[i].querySelector('img');
            if (img && img.dataset.large) {
                const preloadImg = new Image();
                preloadImg.src = img.dataset.large;
            }
        }
    });
}

// Function to show text at specific index
function showText(index) {
    const thumbs = Array.from(thumbs_el.children);
    if (index >= 0 && index < thumbs.length) {
        const textDiv = thumbs[index].querySelector('.text-content');
        if (textDiv) {
            viewer.style.display = 'flex';
            viewer_img.style.display = 'none';
            
            // Create or update text viewer
            let textViewer = document.querySelector('#text-viewer');
            if (!textViewer) {
                textViewer = document.createElement('div');
                textViewer.id = 'text-viewer';
                viewer.appendChild(textViewer);
            }
            textViewer.style.display = 'block';
            textViewer.innerHTML = textDiv.dataset.content;
            
            // Show title if it exists
            const title = textDiv.dataset.title;
            if (title) {
                titleEl.textContent = title;
                titleEl.style.display = 'block';
            } else {
                titleEl.style.display = 'none';
            }
            
            currentImageIndex = index;
        }
    }
}

// Function to show image at specific index
function showImage(index) {
    const thumbs = Array.from(thumbs_el.children);
    if (index >= 0 && index < thumbs.length) {
        const thumb = thumbs[index];
        const wasViewerOpen = viewer.style.display === 'flex';
        
        // Hide text viewer if it exists
        const textViewer = document.querySelector('#text-viewer');
        if (textViewer) textViewer.style.display = 'none';
        
        // Check if it's an image or text
        if (thumb.classList.contains('text-block')) {
            showText(index);
            return;
        }
        
        const img = thumb.querySelector('img');
        viewer.style.display = 'flex';
        
        // Lock scrolling on first open
        if (!wasViewerOpen) {
            document.documentElement.classList.add('viewer-open');
            document.body.classList.add('viewer-open');
        }

        // Immediately hide the image
        viewer_img.classList.remove('loaded');
        viewer_img.style.display = 'block';
        
        // Force reflow to ensure class is removed before we continue
        void viewer_img.offsetWidth;
        
        // Clear the image source
        viewer_img.src = '';
        
        // Load the large image
        const largeImg = new Image();
        largeImg.onload = () => {
            viewer_img.src = img.dataset.large;
            viewer_img.classList.add('loaded');
        };
        largeImg.src = img.dataset.large;
        
        // Show title if it exists
        const title = img.dataset.title;
        if (title) {
            titleEl.textContent = title;
            titleEl.style.display = 'block';
        } else {
            titleEl.style.display = 'none';
        }
        
        currentImageIndex = index;
        
        // Preload adjacent images
        preloadAdjacentImages(index);
    }
}

// Function to close viewer
function closeViewer() {
    viewer.style.display = 'none';
    viewer_img.src = '';
    viewer_img.classList.remove('loaded');
    
    const textViewer = document.querySelector('#text-viewer');
    if (textViewer) textViewer.style.display = 'none';
    titleEl.style.display = 'none';
    currentImageIndex = -1;
    
    // Unlock scrolling
    document.documentElement.classList.remove('viewer-open');
    document.body.classList.remove('viewer-open');
}

// Add keyboard event listeners
document.addEventListener('keydown', (e) => {
    if (viewer.style.display === 'flex') {
        switch(e.key) {
            case 'Escape':
                closeViewer();
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                showImage(currentImageIndex + 1);
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                showImage(currentImageIndex - 1);
                break;
        }
    }
});

// Update click handlers
viewer.addEventListener('click', closeViewer);

// Touch swipe support for mobile
let touchStartX = 0;
let touchEndX = 0;
const minSwipeDistance = 50;

viewer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

viewer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, { passive: true });

function handleSwipe() {
    const swipeDistance = touchEndX - touchStartX;

    if (Math.abs(swipeDistance) < minSwipeDistance) {
        return; // Swipe too short, ignore
    }

    if (swipeDistance > 0) {
        // Swiped right - show previous image
        showImage(currentImageIndex - 1);
    } else {
        // Swiped left - show next image
        showImage(currentImageIndex + 1);
    }
}
