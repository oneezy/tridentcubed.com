import Globe from "globe.gl";
import "./style.css";

// -----------------------------------------------------------------------------
// Constants & Assets
// -----------------------------------------------------------------------------
const ASSETS = {
  earthSkin: "/images/skins/earth-blue-marble.jpg",
};

// -----------------------------------------------------------------------------
// State Management
// -----------------------------------------------------------------------------
// 2. Global state object (atom_2)
const state = {
  activeMarkerId: null,
  currentLocationIndex: 0,
  globeInstance: null,
  portData: [],
  officeData: [],
  combinedData: [],
  viewMode: "offices",
};

// -----------------------------------------------------------------------------
// DOM Utilities
// -----------------------------------------------------------------------------
// 3. Setup initial HTML (atom_3)
const setupBaseHTML = () => {
  document.querySelector("#app").innerHTML = `
    <div id="globe-wrapper">
      <div id="globe"></div>
    </div>
    <div class="controls-container">
      <div class="view-mode">
        <label>
          <input type="radio" name="viewMode" value="offices" checked>
          Show Office Ports
        </label>
        <label>
          <input type="radio" name="viewMode" value="all">
          Show All Ports
        </label>
      </div>
      <div class="nav-buttons">
        <button class="nav-button" id="prevLocation">Previous</button>
        <button class="nav-button" id="nextLocation">Next</button>
      </div>
    </div>
  `;
};

// -----------------------------------------------------------------------------
// Data Processing
// -----------------------------------------------------------------------------
// 5. Process port data (atom_5)
const processPortData = (port, index) => ({
  id: `port-${index}`,
  lat: parseFloat(port.lat),
  lng: parseFloat(port.lng),
  name: port.port, // Changed from port.name
  city: port.city,
  country: port.country,
  province: port.state_province, // Changed from port.province
  timezone: "", // Removed timezone since it's not in new data
  type: "port",
});

// 6. Process office data (atom_6)
const processOfficeData = (location, index, portsInLocation) => ({
  id: `office-${index}`,
  lat: parseFloat(location.lat),
  lng: parseFloat(location.lng),
  name: `Regional Office: ${location.location}`,
  city: location.city,
  province: location.province,
  country: location.country,
  type: "office",
  description:
    `Managing ${portsInLocation.length} ports in ${location.location}`,
  managedPorts: portsInLocation.map((p) => p.port).join(", "),
  email: location.email,
  phone: location.phone,
  location: location.location, // Add location field
});

// -----------------------------------------------------------------------------
// UI Components
// -----------------------------------------------------------------------------
// 9. Create marker elements (molecule_2)
const createMarkerElement = (d) => {
  const container = document.createElement("div");
  container.className = `marker-container ${d.type}-marker`;
  container.id = d.id;

  const icon = document.createElement("i");
  icon.className = `icon icon-${d.type}`;

  container.onclick = (event) => handleMarkerClick(event, d);

  // Simplified hover handling
  container.onmouseenter = () => {
    if (state.activeMarkerId !== d.id) {
      icon.classList.add("selected");
    }
  };
  container.onmouseleave = () => {
    if (state.activeMarkerId !== d.id) {
      icon.classList.remove("selected");
    }
  };

  container.append(icon);
  return container;
};

// -----------------------------------------------------------------------------
// Event Handlers
// -----------------------------------------------------------------------------
// 10. Handle marker clicks (molecule_3)
const handleMarkerClick = (event, d) => {
  if (!event || !d) return;
  event.stopPropagation();

  state.currentLocationIndex = state.combinedData.findIndex((item) =>
    item.id === d.id
  );
  setActiveLocation(d, true);
};

// Update navigateToLocation to properly manage state and navigation (molecule_4)
const navigateToLocation = (index, showTooltip = true) => {
  // Validate index
  let nextIndex = index;
  if (nextIndex < 0) nextIndex = state.combinedData.length - 1;
  if (nextIndex >= state.combinedData.length) nextIndex = 0;

  const d = state.combinedData[nextIndex];
  if (!d) return;

  // Update state index before doing anything else
  state.currentLocationIndex = nextIndex;

  setActiveLocation(d, showTooltip);
};

// -----------------------------------------------------------------------------
// Globe Configuration
// -----------------------------------------------------------------------------
// 12. Configure globe controls (molecule_5)
const configureGlobeControls = (globe) => {
  const controls = globe.controls();
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.8;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  controls.maxDistance = 500;
  return globe;
};

// -----------------------------------------------------------------------------
// API and Data Management
// -----------------------------------------------------------------------------
// 13. Fetch and process data (organism_1)
const fetchPortData = async () => {
  try {
    const [portsResponse, locationsResponse] = await Promise.all([
      fetch(
        "https://opensheet.justinoneill2007.workers.dev/1_BNtsJr9TaSYRPFAKcAd9pa_TUQyYBfqEZiDvDvkPTw/ports",
      ),
      fetch(
        "https://opensheet.justinoneill2007.workers.dev/1_BNtsJr9TaSYRPFAKcAd9pa_TUQyYBfqEZiDvDvkPTw/locations",
      ),
    ]);

    const ports = await portsResponse.json();
    const locations = await locationsResponse.json();

    state.portData = ports.map(processPortData);

    // Process office data directly from locations
    state.officeData = locations.map((location, index) => {
      // Find ports in this location by matching location strings
      const portsInLocation = ports.filter(
        (port) => port.location === location.location,
      );
      return processOfficeData(location, index, portsInLocation);
    });

    state.combinedData = [...state.officeData, ...state.portData];
    return state.combinedData;
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
};

// Modify initGlobe to ensure wrapper has initial classes
const initGlobe = async () => {
  const globeEl = document.querySelector("#globe");
  const globeWrapper = document.querySelector("#globe-wrapper");

  // Ensure wrapper has base class
  if (globeWrapper) {
    globeWrapper.className = "globe-position";
  }

  const data = await fetchPortData();

  state.globeInstance = new Globe(globeEl)
    .backgroundColor("#fff")
    .globeImageUrl(ASSETS.earthSkin)
    .htmlElementsData(data)
    .htmlElement(createMarkerElement)
    .enablePointerInteraction(true)
    .pointerEventsFilter(() => true);

  // Configure globe
  configureGlobeControls(state.globeInstance);

  return state.globeInstance;
};

// Add new function to filter displayed data
const updateGlobeData = () => {
  if (!state.globeInstance) return;

  const filteredData = state.viewMode === "offices"
    ? [
      ...state.officeData,
      ...(state.activeMarkerId?.startsWith("office-")
        ? state.portData.filter((port) =>
          state.officeData.find((office) => office.id === state.activeMarkerId)
            ?.managedPorts.includes(port.name)
        )
        : []),
    ]
    : state.combinedData;

  state.globeInstance.htmlElementsData(filteredData);
};

// -----------------------------------------------------------------------------
// Application Entry Point
// -----------------------------------------------------------------------------
// Update initApp with simpler navigation handlers (organism_3)
const initApp = async () => {
  setupBaseHTML();
  state.globeInstance = await initGlobe();

  // Add radio button event listeners
  document.querySelectorAll('input[name="viewMode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      state.viewMode = e.target.value;
      clearMarkerState(); // Clear marker state when changing views
      updateGlobeData();
    });
  });

  const prevButton = document.querySelector("#prevLocation");
  const nextButton = document.querySelector("#nextLocation");
  // Setup navigation with direct index updates
  prevButton.addEventListener("click", () => {
    navigateToLocation(state.currentLocationIndex - 1);
  });

  nextButton.addEventListener("click", () => {
    navigateToLocation(state.currentLocationIndex + 1);
  });

  // Handle window resize
  const handleResize = () => {
    const { innerWidth: width, innerHeight: height } = window;
    if (state.globeInstance) state.globeInstance.width(width).height(height);
  };

  window.addEventListener("resize", handleResize);
  window.dispatchEvent(new Event("resize"));

  // Initial navigation
  navigateToLocation(0);

  // Initial data update
  updateGlobeData();
};

// Start the application when DOM is ready
document.addEventListener("DOMContentLoaded", initApp);

// 1. Marker state manager (atom_14)
const clearMarkerState = () => {
  // Clear active marker states
  const activeMarker = document.querySelector(".icon.selected");
  if (activeMarker) {
    activeMarker.classList.remove("selected");
  }

  state.activeMarkerId = null;
};

// 2. Marker activation manager (atom_15)
const activateMarker = (markerId) => {
  if (!markerId) return;

  // Clear previous state first
  clearMarkerState();

  // Set new active marker
  const container = document.querySelector(`#${markerId}`);
  if (container) {
    const icon = container.querySelector(".icon");
    if (icon) {
      icon.classList.add("selected");
      state.activeMarkerId = markerId;
    }
  }
};

// 3. Location state manager (molecule_5)
const setActiveLocation = (data, shouldAnimate = true) => {
  if (!data || !state.globeInstance) return;

  // Update camera position
  state.globeInstance.pointOfView(
    { lat: data.lat - 70, lng: data.lng, altitude: 2.5 },
    shouldAnimate ? 1000 : 0
  );

  // Update marker state
  setTimeout(() => {
    activateMarker(data.id);
    updateGlobeData();
  }, shouldAnimate ? 1100 : 0);
};
