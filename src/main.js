import Globe from "globe.gl";
import "./style.css";

// -----------------------------------------------------------------------------
// Constants & Configuration
// -----------------------------------------------------------------------------
// 1. Utility function for responsive breakpoints (atom_1)
function mqValue(defaultValue, sm, md, lg) {
  const breakpoints = [
    { query: "(min-width: 1024px)", value: lg }, // lg (Desktop)
    { query: "(min-width: 768px)", value: md }, // md (Tablet)
    { query: "(min-width: 640px)", value: sm }, // sm (Large Mobile)
  ];

  for (const { query, value } of breakpoints) {
    if (value !== undefined && window.matchMedia(query).matches) {
      return value;
    }
  }

  return defaultValue;
}

// 2. Basic configuration settings (atom_2)
const CONFIG = {
  SCALE_FACTOR: mqValue(2.5, 3, 3.5),
  POV_ALTITUDE: mqValue(4, 3, 2.5),
  POINT_ALTITUDE: 0.2,
  POINT_COLOR: "rgba(0, 0, 255, 0)",
  ANIMATION_DURATION: 1000,
};

// 3. Asset paths configuration (atom_3)
const ASSETS = {
  earthSkin:
    "https://unpkg.com/three-globe@2.41.12/example/img/earth-blue-marble.jpg",
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
const setupControlsHTML = () => {
  const controls = document.querySelector("#controls");

  controls.innerHTML = `
	
	<!-- GLOBE CONTROLS
	:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: -->
  <div class="btn-container">
    <button id="backBtn" class="btn btn-ghost">
      <i class="icon icon-chevron-left"></i>
    </button>
    <div class="indicators" id="indicators"></div> 
    <button id="nextBtn" class="btn btn-ghost">
      <i class="icon icon-chevron-right"></i>
    </button>
  </div>
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
  document.querySelectorAll(".globe-container .svg-marker").forEach(
    (marker, idx) => {
      marker.classList.toggle("active", idx === currentIndex);
    },
  );

  // Update side indicators
  document.querySelectorAll(".indicator").forEach((indicator, idx) => {
    indicator.classList.toggle("active", idx === currentIndex);
  });

  // Update content panel
  const filteredPorts = ports.filter((port) =>
    port.location === currentLocation.location
  );
  updateContentPanel(currentLocation, filteredPorts);
};

// 8. Updates the content panel with location details (atom_6)
const updateContentPanel = (location, ports) => {
  const content = document.querySelector("#content");
  if (!content) return;

  content.innerHTML = `
    <div class="flex-col">
      <h3>${location.location}</h3>
      <div class="btn-container">
        <a class="btn btn-text" href="tel:${location.phone}">
          <i class="icon icon-phone"></i>
          ${location.phone}
        </a>
        <a class="btn btn-text" href="mailto:${location.email}">
          <i class="icon icon-email"></i>
          ${location.email}
        </a>
      </div>
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

// 11. Sets up location indicators (atom_8)
const setupIndicators = () => {
  const indicatorContainer = document.querySelector("#indicators");
  state.locations.forEach((_, idx) => {
    const indicatorEl = document.createElement("div");
    indicatorEl.className = "indicator";
    indicatorEl.addEventListener("click", () => changeLocation(idx));
    indicatorContainer.appendChild(indicatorEl);
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
    const scaleFactor = mqValue(2.5, 3, 3.5);
    const altitude = mqValue(4, 3, 2.5);

    state.globeInstance
      .width(window.innerWidth)
      .height(window.innerHeight * scaleFactor)
      .pointOfView({ lat: 0, lng: 0, altitude }, 1000);
  }
};

// -----------------------------------------------------------------------------
// Globe Setup & Management
// -----------------------------------------------------------------------------
// 10. Initializes and configures the globe (organism_1)
const setupGlobe = async () => {
  await setupControlsHTML();
  await fetchData();

  // Initialize globe
  const globeEl = document.querySelector("#globe");
  const scaleFactor = mqValue(2.5, 3, 3.5);
  const altitude = mqValue(4, 3, 2.5);

  state.globeInstance = new Globe(globeEl)
    .globeImageUrl(ASSETS.earthSkin)
    .backgroundColor("rgba(0,0,0,0)")
    .width(window.innerWidth)
    .height(window.innerHeight * scaleFactor)
    .pointsData(state.locations)
    .pointAltitude(() => CONFIG.POINT_ALTITUDE)
    .pointColor(() => CONFIG.POINT_COLOR)
    // Add HTML elements layer
    .htmlElementsData(state.locations)
    .htmlElement((d) => {
      const el = document.createElement("div");
      el.innerHTML = `<i class="svg svg-marker"></i>`;
      return el;
    })
    .htmlLat((d) => d.lat)
    .htmlLng((d) => d.lng)
    .htmlAltitude(0.1)
    .atmosphereColor("#00b7ff")
    .atmosphereAltitude(0.2)
    .pointOfView({ lat: 0, lng: 0, altitude })
    .onGlobeReady(() => {
      setTimeout(updateContent, 1000);
    });

  state.globeInstance.controls().enableZoom = false;
  setupIndicators();
  setupNavigation();
  updateContent();
};

// -----------------------------------------------------------------------------
// Event Listeners
// -----------------------------------------------------------------------------
window.addEventListener("resize", handleResize);
document.addEventListener("DOMContentLoaded", () => {
  setupGlobe();
  handleResize();
  setTimeout(updateContent, 2000);
});
