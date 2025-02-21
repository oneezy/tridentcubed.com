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
// DOM Utilities
// -----------------------------------------------------------------------------
// 5. Creates base HTML structure (atom_5)
const setupControlsHTML = () => {
  const controls = document.querySelector("#controls");

  controls.innerHTML = `
	
	<!-- GLOBE CONTROLS
	:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: -->
  <div class="btn-container">
    <button id="backBtn" class="btn btn-ghost btn-controls">
      <i class="icon icon-chevron-left"></i>
    </button>
    <button id="nextBtn" class="btn btn-ghost btn-controls">
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
      fetch(`${CONFIG.DATA_LOCATIONS}`),
      fetch(`${CONFIG.DATA_PORTS}`),
    ]);

    state.locations = await locationsRes.json();
    state.ports = await portsRes.json();

    // Update stats after data is loaded
    updateStats();

    console.log("Fetched Locations:", state.locations);
    console.log("Fetched Ports:", state.ports);
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

// Change location and update UI
const changeLocation = (newIndex) => {
  const total = state.locations.length;
  state.currentIndex = (newIndex + total) % total;

  console.log(
    "Switched to Location:",
    state.locations[state.currentIndex].location,
  ); // Debugging log

  updateContent();
  updateLabels();
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
    const scaleFactor = CONFIG.SCALE_FACTOR;
    const altitude = CONFIG.POV_ALTITUDE;

    state.globeInstance
      .width(window.innerWidth)
      .height(window.innerHeight * scaleFactor)
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

  console.log("Active Ports:", activePorts);

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

  // NO HEADER
  SCALE_FACTOR: mqValue(4.5, 5.5),
  POV_ALTITUDE: mqValue(2, 1.9),
  POV_LATITUDE: mqValue(47, 54),

  // WITH HEADER
  // SCALE_FACTOR: mqValue(4.5, 6.5),
  // POV_ALTITUDE: mqValue(2.3, 1.9),
  // POV_LATITUDE: mqValue(52, 55),

  // POINTS
  POINT_ALTITUDE: 0.002,
  POINT_COLOR: "rgba(0, 0, 255, 1)",

  // LABELS
  LABEL_SIZE: mqValue(0.6, 0.5),
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
  await setupControlsHTML();
  await fetchData();

  // Initialize globe
  const globeEl = document.querySelector("#globe");
  const scaleFactor = CONFIG.SCALE_FACTOR;
  const altitude = CONFIG.POV_ALTITUDE;

  state.globeInstance = new Globe(globeEl)
    // GLOBE
    .globeImageUrl(CONFIG.IMG_EARTH)
    .backgroundColor("rgba(0,0,0,0)")
    .width(window.innerWidth)
    .height(window.innerHeight * scaleFactor)
    .pointOfView({ lat: 0, lng: 0, altitude })
    // ATMOSPHERE
    .atmosphereColor("#00b7ff")
    .atmosphereAltitude(0)
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
      return el;
    })
    .htmlLat((d) => d.lat)
    .htmlLng((d) => d.lng)
    .htmlAltitude(0.1)
    // LABELS
    // .labelAltitude((d) => d.altitude || CONFIG.LABEL_ALTITUDE)
    .labelColor(() => CONFIG.LABEL_TEXT_COLOR)
    // .labelDotOrientation(() => CONFIG.LABEL_POSITION)
    .labelDotOrientation((d) => d.orientation || "bottom")
    .labelDotRadius(() => CONFIG.LABEL_DOT_RADIUS)
    // .labelsData([])
    // .labelsData(state.por)
    .labelSize(() => CONFIG.LABEL_SIZE)
    .labelText("label")
    // .labelText((d) => d.label)
    .labelLabel((d) => `
        <div><b>hi mom</b></div>
        <div>hope it works</div>
      `)
    // FIRST LOAD
    .onGlobeReady(() => {
      setTimeout(() => {
        updateContent();
      }, 1000);
    });

  state.globeInstance.controls().enableZoom = false;
  setupIndicators();
  setupNavigation();
  updateContent();
  updateLabels();
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
