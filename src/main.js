import Globe from "globe.gl";
import { counter } from "./lib/counter.js";
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
// Data Management
// -----------------------------------------------------------------------------
// 6. Fetches and stores location and port data (molecule_1)
const fetchData = async () => {
  try {
    const [locationsRes, portsRes] = await Promise.all([
      fetch(`${CONFIG.DATA_LOCATIONS}`),
      fetch(`${CONFIG.DATA_PORTS}`),
    ]);

    state.locations = await locationsRes.json();
    state.ports = await portsRes.json();

    // Update stats after data is loaded
    updateStats();
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

  if (!globeInstance || !locations.length) {
    console.warn("Globe not ready or no locations available");
    return;
  }

  const currentLocation = locations[currentIndex];

  // Update rings data to only show for current location
  globeInstance.ringsData([currentLocation]);

  // Update globe view
  globeInstance.pointOfView(
    {
      lat: parseFloat(currentLocation.lat) - CONFIG.POV_LATITUDE,
      lng: parseFloat(currentLocation.lng),
      altitude: CONFIG.POV_ALTITUDE,
    },
    CONFIG.ANIMATION_DURATION,
  );

  // Update all active states
  updateActiveStates();

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
    <div class="flex w-screen relative md:w-[550px]">
      <button id="backBtn" class="btn-controls">
        <i class="icon icon-chevron-left"></i>
      </button>
      <h3 class="select-none text-2xl md:text-4xl font-light p-2 flex-grow">${location.location}</h3>
      <button id="nextBtn" class="btn-controls right-0 justify-end">
        <i class="icon icon-chevron-right"></i>
      </button>
    </div>

    <div class="flex gap-4 items-center justify-center">
      <a class="btn btn-text" href="tel:${location.phone}">
        <i class="icon icon-email"></i>
        ${location.phone}
      </a>
      <a class="btn btn-text" href="mailto:${location.email}">
        <i class="icon icon-phone"></i>
        ${location.email}
      </a>
    </div>

    <ul class="hidden">
      ${
    ports.length
      ? ports.map((p) => `<li>${p.port}</li>`).join("")
      : "<li>No ports available</li>"
  }
    </ul>
  `;

  // Set up navigation after content is updated
  setupNavigation();
};

// Change location and update UI
const changeLocation = (newIndex) => {
  const total = state.locations.length;
  state.currentIndex = (newIndex + total) % total;

  updateContent();
  updateLabels();
};

// 11. Sets up location indicators (atom_8)
const setupIndicators = () => {
  const indicatorContainer = document.querySelector("#indicators");
  state.locations.forEach((_, idx) => {
    const indicatorEl = document.createElement("div");
    indicatorEl.classList = "indicator ";
    indicatorEl.addEventListener("click", () => changeLocation(idx));
    indicatorContainer.appendChild(indicatorEl);
  });
};

// 12. Sets up navigation controls (atom_9)
const setupNavigation = () => {
  const backBtn = document.querySelector("#backBtn");
  const nextBtn = document.querySelector("#nextBtn");

  if (backBtn) {
    backBtn.addEventListener(
      "click",
      () => changeLocation(state.currentIndex - 1),
    );
  }

  if (nextBtn) {
    nextBtn.addEventListener(
      "click",
      () => changeLocation(state.currentIndex + 1),
    );
  }
};

// 13. Handles window resize events (atom_10)
const handleResize = (e) => {
  if (state.globeInstance) {
    const altitude = CONFIG.POV_ALTITUDE;
    // Update globe position with vertical offset
    state.globeInstance
      .width([e.target.innerWidth])
      .height([e.target.innerHeight])
      .globeOffset([CONFIG.GLOBE_LEFT, CONFIG.GLOBE_TOP])
      .pointOfView({ lat: 0, lng: 0, altitude }, 1000);
  }
};

// Creates ring color with dynamic opacity (atom_11)
const getRingColor = (t) => `rgba(255,255,255,${Math.sqrt(1 - t)})`;

// Updates the labels dynamically based on active locations (molecule_3)
const updateLabels = () => {
  if (!state.globeInstance) return;

  // Get active location
  const currentLocation = state.locations[state.currentIndex];
  if (!currentLocation) {
    console.warn("updateLabels: No active location found.");
    return;
  }

  // Find ports related to active location
  const activePorts = state.ports.filter((port) =>
    port.location === currentLocation.location
  );

  if (!Array.isArray(activePorts) || activePorts.length === 0) {
    console.warn(
      "updateLabels: No active ports found for",
      currentLocation.location,
    );
    state.globeInstance.labelsData([]); // Clear labels if no ports
    return;
  }

  // Avoid label collisions by adjusting orientation
  const adjustedPorts = avoidLabelCollisions(
    activePorts.map((port) => ({
      lat: port.lat,
      lng: port.lng,
      label: port.city || "Unknown Port",
      color: [CONFIG.LABEL_TEXT_COLOR, CONFIG.LABEL_DOT_COLOR],
      size: CONFIG.LABEL_SIZE,
      dotRadius: CONFIG.LABEL_DOT_RADIUS,
    })),
  );

  state.globeInstance.labelsData(adjustedPorts);
};

const avoidLabelCollisions = (labels) => {
  const occupiedSpots = new Set();

  return labels.map((label) => {
    const key = `${Math.round(label.lat)},${Math.round(label.lng)}`;

    // If the spot is already occupied, flip orientation
    if (occupiedSpots.has(key)) {
      label.orientation = "top"; // Move above
    } else {
      label.orientation = "bottom"; // Default position
      occupiedSpots.add(key); // Mark spot as occupied
    }

    return label;
  });
};

// 2. Basic configuration settings (atom_2)
// Google Sheet: https://docs.google.com/spreadsheets/d/1_BNtsJr9TaSYRPFAKcAd9pa_TUQyYBfqEZiDvDvkPTw/
const CONFIG = {
  // DATA
  DATA_LOCATIONS:
    "https://opensheet.justinoneill2007.workers.dev/1_BNtsJr9TaSYRPFAKcAd9pa_TUQyYBfqEZiDvDvkPTw/locations",
  DATA_PORTS:
    "https://opensheet.justinoneill2007.workers.dev/1_BNtsJr9TaSYRPFAKcAd9pa_TUQyYBfqEZiDvDvkPTw/ports",

  // GLOBE
  IMG_EARTH:
    "https://unpkg.com/three-globe@2.41.12/example/img/earth-blue-marble.jpg",

  GLOBE_TOP: mqValue(window.innerHeight * 0.8, window.innerHeight * 1.42),
  GLOBE_LEFT: mqValue(0, 0),
  POV_ALTITUDE: mqValue(0.8, 0.3),
  POV_LATITUDE: mqValue(38, 29),

  // POINTS
  POINT_ALTITUDE: 0.002,
  POINT_COLOR: "rgba(0, 0, 255, 1)",

  // LABELS
  LABEL_SIZE: mqValue(0.8, 0.4),
  LABEL_DOT_RADIUS: mqValue(0.3, 0.2),
  LABEL_TEXT_COLOR: "rgba(255, 255, 255, 1)",
  LABEL_DOT_COLOR: "lime",
  LABEL_POSITION: "bottom",

  // RINGS
  RING_COLOR_LOCATION: "#ffffff",
  RING_MAX_RADIUS: 3,
  RING_PROPAGATION_SPEED: 1,
  RING_REPEAT_PERIOD: 1000,
  RING_ALTITUDE: 0.001,

  // ANIMATION
  ANIMATION_DURATION: 1000,
};

// -----------------------------------------------------------------------------
// Globe Setup & Management
// -----------------------------------------------------------------------------
// Initializes and configures the globe (organism_1)
const setupGlobe = async () => {
  await fetchData();

  // Initialize globe
  const globeEl = document.querySelector("#globe");
  const altitude = CONFIG.POV_ALTITUDE;

  state.globeInstance = new Globe(globeEl)
    // GLOBE
    .globeImageUrl(CONFIG.IMG_EARTH)
    .backgroundColor("rgba(0,0,0,0)")
    // .width(window.innerWidth * 2)
    // .height(window.innerHeight * 2)
    .globeOffset([0, CONFIG.GLOBE_TOP])
    .pointOfView({ lat: 0, lng: 0, altitude })
    // ATMOSPHERE
    .showAtmosphere(true)
    .atmosphereColor("#00bcff")
    .atmosphereAltitude(mqValue(0.2, 0.1))
    // RINGS
    .ringsData(state.locations)
    .ringLat((d) => d.lat)
    .ringLng((d) => d.lng)
    .ringAltitude(CONFIG.RING_ALTITUDE)
    .ringColor(() => getRingColor)
    .ringMaxRadius(CONFIG.RING_MAX_RADIUS)
    .ringPropagationSpeed(CONFIG.RING_PROPAGATION_SPEED)
    .ringRepeatPeriod(CONFIG.RING_REPEAT_PERIOD)
    // POINTS
    .pointsData(state.locations)
    .pointAltitude(() => CONFIG.POINT_ALTITUDE)
    .pointColor(() => CONFIG.POINT_COLOR)
    // HTML
    .htmlElementsData(state.locations)
    .htmlElement((d) => {
      const el = document.createElement("div");
      el.innerHTML = `<i class="svg svg-marker"></i>`;
      el.dataset.lat = d.lat;
      el.dataset.lng = d.lng;

      el.style["pointer-events"] = "auto";
      el.onclick = () => {
        const idx = state.locations.findIndex((loc) =>
          parseFloat(loc.lat) === parseFloat(d.lat) &&
          parseFloat(loc.lng) === parseFloat(d.lng)
        );
        if (idx >= 0) {
          changeLocation(idx);
        }
      };
      return el;
    })
    .htmlLat((d) => d.lat)
    .htmlLng((d) => d.lng)
    .htmlAltitude(0.01)
    // LABELS
    .labelColor(() => CONFIG.LABEL_TEXT_COLOR)
    .labelDotOrientation((d) => d.orientation || "bottom")
    .labelDotRadius(() => CONFIG.LABEL_DOT_RADIUS)
    .labelSize(() => CONFIG.LABEL_SIZE)
    .labelText("label")
    .labelLabel((d) => `
        <div></div>
      `)
    // FIRST LOAD
    .onGlobeReady(() => {
      setTimeout(() => {
        updateContent();
        // Add explicit marker update on globe ready
      }, 1000);
    });
  state.globeInstance.controls().enableZoom = false;
  setupIndicators();
  updateContent();
  updateLabels();
  updateMarkers();
};

// -----------------------------------------------------------------------------
// Event Listeners
// -----------------------------------------------------------------------------
window.addEventListener("resize", handleResize);
document.addEventListener("DOMContentLoaded", () => {
  setupGlobe();
  handleResize();
  setTimeout(updateContent, 2000);
  setTimeout(counter, 600);
});

// 14. Updates stats counters with actual data (atom_12)
const updateStats = () => {
  const locationsCounter = document.getElementById("locations-counter");
  const portsCounter = document.getElementById("ports-counter");

  if (locationsCounter && state.locations) {
    locationsCounter.setAttribute("data-target", state.locations.length);
  }

  if (portsCounter && state.ports) {
    portsCounter.setAttribute("data-target", state.ports.length);
  }
};

// 15. Updates marker states based on current location (atom_13)
const updateMarkers = () => {
  // Wait a brief moment for Globe.gl to render the HTML elements
  setTimeout(() => {
    const markers = document.querySelectorAll(".svg-marker");
    markers.forEach((marker, idx) => {
      marker.classList.toggle("active", idx === state.currentIndex);
    });
  }, 200);
};

// 16. Single source of truth for managing active states (molecule_4)
const updateActiveStates = () => {
  const { locations, currentIndex } = state;
  if (!locations.length) return;

  const currentLocation = locations[currentIndex];

  // Helper to match elements with current location
  const isCurrentLocation = (lat, lng) =>
    parseFloat(lat) === parseFloat(currentLocation.lat) &&
    parseFloat(lng) === parseFloat(currentLocation.lng);

  // Update markers
  document.querySelectorAll(".svg-marker").forEach((marker) => {
    const parent = marker.closest("[data-lat][data-lng]");
    if (parent) {
      const lat = parent.dataset.lat;
      const lng = parent.dataset.lng;
      marker.classList.toggle("active", isCurrentLocation(lat, lng));
    }
  });

  // Update indicators
  document.querySelectorAll(".indicator").forEach((indicator, idx) => {
    indicator.classList.toggle("active", idx === currentIndex);
  });
};
