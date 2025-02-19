import Globe from "globe.gl";
import "./style.css";

// -----------------------------------------------------------------------------
// Constants & Configuration
// -----------------------------------------------------------------------------
// 1. Basic configuration settings (atom_1)
const CONFIG = {
  SCALE_FACTOR: 4, // Controls globe height multiplication
  POINT_ALTITUDE: 0.2,
  POINT_COLOR: "blue",
  POV_ALTITUDE: 2.5,
  ANIMATION_DURATION: 1000,
};

// 2. Asset paths configuration (atom_2)
const ASSETS = {
  earthSkin: "/images/skins/earth-blue-marble.jpg",
};

// 3. API endpoints configuration (atom_3)
// Google Sheet: https://docs.google.com/spreadsheets/d/1_BNtsJr9TaSYRPFAKcAd9pa_TUQyYBfqEZiDvDvkPTw/
const API = {
  BASE_URL:
    "https://opensheet.justinoneill2007.workers.dev/1_BNtsJr9TaSYRPFAKcAd9pa_TUQyYBfqEZiDvDvkPTw",
  LOCATIONS: "/locations",
  PORTS: "/ports",
};

// -----------------------------------------------------------------------------
// State Management
// -----------------------------------------------------------------------------
// 4. Global state container (atom_4)
const state = {
  locations: [],
  ports: [],
  currentIndex: 0,
  globeInstance: null,
};

// -----------------------------------------------------------------------------
// DOM Utilities
// -----------------------------------------------------------------------------
// 5. Creates base HTML structure (atom_5)
const setupBaseHTML = () => {
  document.querySelector("#app").innerHTML = `
    <section>
      <div class="globe-container">
        <div id="globe"></div>
      </div>
      <div class="front">
        <div id="frontContent" class="front-content"></div>
        <div class="markers" id="frontMarkers"></div> 
        <nav class="nav-container">
          <button id="backBtn">Back</button>
          <button id="nextBtn">Next</button>
        </nav>
      </div>
    </section>
  `;
};

// -----------------------------------------------------------------------------
// Data Management
// -----------------------------------------------------------------------------
// 6. Fetches and stores location and port data (molecule_1)
const fetchData = async () => {
  try {
    const [locationsRes, portsRes] = await Promise.all([
      fetch(`${API.BASE_URL}${API.LOCATIONS}`),
      fetch(`${API.BASE_URL}${API.PORTS}`),
    ]);

    state.locations = await locationsRes.json();
    state.ports = await portsRes.json();
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

// -----------------------------------------------------------------------------
// Content Management
// -----------------------------------------------------------------------------
// 7. Updates UI content based on current location (molecule_2)
const updateContent = () => {
  const { locations, ports, currentIndex, globeInstance } = state;
  const currentLocation = locations[currentIndex];

  // Update globe view
  globeInstance.pointOfView(
    {
      lat: parseFloat(currentLocation.lat) - 50,
      lng: parseFloat(currentLocation.lng),
      altitude: CONFIG.POV_ALTITUDE,
    },
    CONFIG.ANIMATION_DURATION,
  );

  // Update HTML markers
  const htmlMarkers = document.querySelectorAll(
    ".globe-container .icon-location",
  );
  htmlMarkers.forEach((marker, idx) => {
    marker.classList.toggle("active", idx === currentIndex);
  });

  // Update side markers
  document.querySelectorAll(".marker").forEach((marker, idx) => {
    marker.classList.toggle("active", idx === currentIndex);
  });

  // Update content panel
  const filteredPorts = ports.filter((port) =>
    port.location === currentLocation.location
  );
  updateContentPanel(currentLocation, filteredPorts);
};

// 8. Updates the content panel with location details (atom_6)
const updateContentPanel = (location, ports) => {
  const content = document.querySelector("#frontContent");
  if (!content) return;

  content.innerHTML = `
    <div>
      <strong>${location.location}</strong><br>
      ${location.phone}<br>
      ${location.email}
    </div>
    <ul>
      ${
    ports.length
      ? ports.map((p) => `<li>${p.port}</li>`).join("")
      : "<li>No ports available</li>"
  }
    </ul>
  `;
};

// 9. Handles location changes (atom_7)
const changeLocation = (newIndex) => {
  const total = state.locations.length;
  state.currentIndex = (newIndex + total) % total;
  updateContent();
};

// 11. Sets up location markers (atom_8)
const setupMarkers = () => {
  const markerContainer = document.querySelector("#frontMarkers");
  state.locations.forEach((_, idx) => {
    const markerEl = document.createElement("div");
    markerEl.className = "marker";
    markerEl.addEventListener("click", () => changeLocation(idx));
    markerContainer.appendChild(markerEl);
  });
};

// 12. Sets up navigation controls (atom_9)
const setupNavigation = () => {
  document.querySelector("#backBtn")
    .addEventListener("click", () => changeLocation(state.currentIndex - 1));
  document.querySelector("#nextBtn")
    .addEventListener("click", () => changeLocation(state.currentIndex + 1));
};

// 13. Handles window resize events (atom_10)
const handleResize = () => {
  if (state.globeInstance) {
    state.globeInstance
      .width(window.innerWidth)
      .height(window.innerHeight * CONFIG.SCALE_FACTOR);
  }
};

// -----------------------------------------------------------------------------
// Globe Setup & Management
// -----------------------------------------------------------------------------
// 10. Initializes and configures the globe (organism_1)
const setupGlobe = async () => {
  await setupBaseHTML();
  await fetchData();

  // Initialize globe
  const globeEl = document.querySelector("#globe");
  state.globeInstance = new Globe(globeEl)
    .globeImageUrl(ASSETS.earthSkin)
    .backgroundColor("rgba(0,0,0,0)")
    .width(window.innerWidth)
    .height(window.innerHeight * CONFIG.SCALE_FACTOR)
    .pointsData(state.locations)
    .pointAltitude(() => CONFIG.POINT_ALTITUDE)
    .pointColor(() => CONFIG.POINT_COLOR)
    // Add HTML elements layer
    .htmlElementsData(state.locations)
    .htmlElement((d) => {
      const el = document.createElement("div");
      el.innerHTML = `<i class="icon icon-location"></i>`;
      return el;
    })
    .htmlLat((d) => d.lat)
    .htmlLng((d) => d.lng)
    .htmlAltitude(0.1)
    .onGlobeReady(() => {
      setTimeout(updateContent, 1000);
    });

  setupMarkers();
  setupNavigation();
  updateContent();
};

// -----------------------------------------------------------------------------
// Event Listeners
// -----------------------------------------------------------------------------
window.addEventListener("resize", handleResize);
document.addEventListener("DOMContentLoaded", setupGlobe);
