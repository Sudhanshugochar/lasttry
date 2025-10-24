// Define monastery data with approximate coordinates and properties for the map
const MONASTERY_LOCATIONS = [
    { name: "Rumtek Monastery", lat: 27.2753, lng: 88.5447, sect: "Kagyu", location: "East Sikkim" },
    { name: "Pemayangtse Monastery", lat: 27.3193, lng: 88.2435, sect: "Nyingma", location: "West Sikkim" },
    { name: "Tashiding Monastery", lat: 27.3060, lng: 88.2932, sect: "Nyingma", location: "West Sikkim" },
    { name: "Enchey Monastery", lat: 27.3370, lng: 88.6143, sect: "Nyingma", location: "East Sikkim" },
    { name: "Phodong Monastery", lat: 27.4208, lng: 88.5833, sect: "Kagyu", location: "North Sikkim" },
    { name: "Sanga Choeling Monastery", lat: 27.3069, lng: 88.2415, sect: "Nyingma", location: "West Sikkim" },
    { name: "Dubdi Monastery", lat: 27.3592, lng: 88.3533, sect: "Nyingma", location: "West Sikkim" },
    { name: "Lingdum Monastery (Ranka)", lat: 27.3005, lng: 88.5710, sect: "Kagyu", location: "East Sikkim" },
    { name: "Do Drul Chorten", lat: 27.3277, lng: 88.6186, sect: "Nyingma", location: "East Sikkim" }
];

let map;
let markers = L.layerGroup();
const SIKKIM_CENTER = [27.33, 88.62]; // Center of Sikkim
const ZOOM_LEVEL = 10;

// --- Map Initialization ---
function initMap() {
    if (map) {
        map.remove(); // Remove existing map if trying to re-initialize
    }
    
    // Create the map and set the initial view
    map = L.map('monasteryMap').setView(SIKKIM_CENTER, ZOOM_LEVEL);

    // Add the Tile Layer (Map background)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add initial markers
    addMarkers(MONASTERY_LOCATIONS);

    // Add the marker group to the map
    markers.addTo(map);
}

// --- Marker Management ---
function addMarkers(locations) {
    markers.clearLayers();
    locations.forEach(monastery => {
        
        // ✅ FIX: Changed map_action=pano (Street View) to a standard view
        // The 'z=18' zooms in close, and 't=h' tries to ensure satellite view is used 
        // for the best 3D/globe experience.
        const googleMapsUrl = `https://www.google.com/maps/@${monastery.lat},${monastery.lng},18z/data=!3m1!1e3`;

        const popupContent = `
            <div>
                <strong>${monastery.name}</strong><br>
                Sect: ${monastery.sect}<br>
                Location: ${monastery.location}<br>
                <a href="monastery_detail.html?name=${encodeURIComponent(monastery.name)}" style="color: #003366; font-weight: bold; display: block; margin-top: 5px;">View Details &rarr;</a>
                
                <!-- ✅ UPDATED: Google Maps Link now points to Satellite/Globe View -->
                <a href="${googleMapsUrl}" target="_blank" style="color: #cc0000; font-weight: bold; display: block; margin-top: 5px;">
                    View on Google Maps (Satellite) &rarr;
                </a>
            </div>
        `;
        const marker = L.marker([monastery.lat, monastery.lng])
            .bindPopup(popupContent);
        
        // Store properties directly on the marker object for filtering/searching
        marker.options.monastery = monastery; 
        markers.addLayer(marker);
    });
}

// --- Filtering Logic (Called by Select dropdowns) ---
window.filterMonasteries = function() {
    const sect = document.getElementById('sectFilter').value;
    const location = document.getElementById('locationFilter').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    let filtered = MONASTERY_LOCATIONS.filter(monastery => {
        const matchesSect = sect === 'all' || monastery.sect === sect;
        const matchesLocation = location === 'all' || monastery.location === location;
        const matchesSearch = monastery.name.toLowerCase().includes(searchTerm) || 
                              monastery.location.toLowerCase().includes(searchTerm);
        return matchesSect && matchesLocation && matchesSearch;
    });

    addMarkers(filtered);
    
    // Provide user feedback
    const feedback = document.getElementById('searchFeedback');
    feedback.textContent = `Found ${filtered.length} monasteries matching your criteria.`;
    feedback.style.display = 'block';
}

// --- Search Logic (Called by Search button) ---
window.search = function() {
    // Search uses the same filtering function but prioritizes the search input
    filterMonasteries();
}


// --- Execute on page load ---
document.addEventListener('DOMContentLoaded', initMap);

// Global functions (needed by other files but included here for completeness)
// This is for the image slider which is also in index.html
let currentSlide = 0;
const slides = document.querySelectorAll('.slide');

function showSlide(index) {
    slides.forEach((slide, i) => {
        slide.classList.remove('active');
        if (i === index) {
            slide.classList.add('active');
        }
    });
    currentSlide = index;
}

window.nextSlide = function() {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
}

window.prevSlide = function() {
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    showSlide(currentSlide);
}

// Initialize slider
if (slides.length > 0) {
    showSlide(0);
    setInterval(nextSlide, 5000); // Auto slide every 5 seconds
}
// This script assumes the rest of your form and authentication logic is self-contained 
// within the <script> block in index.html, as provided previously.
