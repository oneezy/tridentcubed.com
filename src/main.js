import Globe from "globe.gl";
import "./style.css";

// -----------------------------------------------------------------------------
// Constants & Assets
// -----------------------------------------------------------------------------
const ASSETS = {
  earthSkin: "/images/skins/earth-blue-marble.jpg",
};

const ARC_CONFIG = {
  OPACITY: 1,
  DASH_LENGTH: 0.2,
  DASH_GAP: 0.1,
  ANIMATE_TIME: 1500,
  // STROKE_WIDTH: 0.5, // Default stroke width
  // HOVER_STROKE_WIDTH: 0.8, // Stroke width when hovered
  // ALTITUDE: 0.1, // Arc curve height
  // STROKE_RESOLUTION: 24, // Arc smoothness
  COLORS: {
    DEFAULT: ["rgba(0, 255, 0, 0.9)", "rgba(255, 0, 0, 0.9)"],
    HIGHLIGHT: ["rgba(0, 255, 0, 0.9)", "rgba(255, 0, 0, 0.9)"],
    DIM: ["rgba(0, 255, 0, 0.075)", "rgba(255, 0, 0, 0.075)"],
  },
};

// -----------------------------------------------------------------------------
// State Management
// -----------------------------------------------------------------------------
// 2. Global state object (atom_2)
const state = {
  currentTooltip: null,
  activeMarkerId: null,
  currentLocationIndex: 0,
  globeInstance: null,
  portData: [],
  officeData: [],
  combinedData: [],
  viewMode: "offices", // Add new state property
  arcData: [], // Add new state property for arcs
};

// Add new state handling functions
// 1. Central state handler (atom_12)
const updateGlobalState = (newData) => {
  // Clear existing state
  if (state.currentTooltip) {
    state.currentTooltip.style.display = "none";
  }
  if (state.activeMarkerId) {
    const prevIcon = document.querySelector(`#${state.activeMarkerId} .icon`);
    if (prevIcon) prevIcon.classList.remove("selected");
  }

  // Update state
  state.arcData = [];
  state.activeMarkerId = newData?.id || null;
  state.currentTooltip = null;
  state.currentLocationIndex = newData
    ? state.combinedData.findIndex((item) => item.id === newData.id)
    : 0;

  // Generate arcs if office
  if (newData?.type === "office") {
    const managedPortNames = newData.managedPorts.split(", ");
    const managedPorts = state.portData.filter((port) =>
      managedPortNames.includes(port.name)
    );
    state.arcData = generateArcData(newData, managedPorts);
  }

  // Update globe
  if (state.globeInstance) {
    state.globeInstance.arcsData(state.arcData);

    // Update displayed data based on view mode
    updateGlobeData();
  }

  return newData;
};

// 2. Location update handler (atom_13)
const handleLocationUpdate = (
  data,
  markerEl,
  tooltipEl,
  shouldAnimate = true,
) => {
  if (!data || !markerEl || !tooltipEl) return;

  const updatedData = updateGlobalState(data);

  if (state.globeInstance && updatedData) {
    // Move camera
    state.globeInstance.pointOfView(
      { lat: updatedData.lat - 70, lng: updatedData.lng, altitude: 2.5 },
      shouldAnimate ? 1000 : 0,
    );

    // Show tooltip after camera movement
    setTimeout(() => {
      toggleTooltip(markerEl, tooltipEl, updatedData, true);
    }, shouldAnimate ? 1100 : 0);
  }
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

// 4. Create tooltip markup (atom_4)
const createTooltipContent = (d) =>
  d.type === "office"
    ? `<div><strong>${d.name}</strong></div>
       <div>${d.description}</div>
       <div><small>Managed Ports: ${d.managedPorts}</small></div>
       <div><small>Contact: ${d.email}</small></div>
       <div><small>Phone: ${d.phone}</small></div>`
    : `<div><strong>${d.name}</strong></div>
       <div>${d.city}, ${d.province}</div>
       <div>${d.country}</div>`;

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

// 7. Calculate average coordinates (atom_7)
const calculateAverage = (ports, prop) => {
  return ports.reduce((sum, port) => sum + parseFloat(port[prop]), 0) /
    ports.length;
};

// 7.1 Process ports by timezone (atom_8)
const groupPortsByTimezone = (ports) => {
  return ports.reduce((groups, port) => {
    const timezone = port.timezone;
    if (!groups[timezone]) {
      groups[timezone] = [];
    }
    groups[timezone].push(port);
    return groups;
  }, {});
};

// 7.2 Convert timezone groups to office data (atom_9)
const processTimezoneOffices = (ports) => {
  const timezoneGroups = groupPortsByTimezone(ports);

  return Object.entries(timezoneGroups).map(([timezone, portsInZone], index) =>
    processOfficeData(timezone, index, portsInZone)
  );
};

// -----------------------------------------------------------------------------
// Arc Processing
// -----------------------------------------------------------------------------

// 16. Generate arc data for office-port connections (atom_10)
const generateArcData = (office, ports) => {
  return ports.map((port) => ({
    startLat: office.lat,
    startLng: office.lng,
    endLat: port.lat,
    endLng: port.lng,
    officeName: office.name,
    portName: port.name,
  }));
};

// 17. Configure arc visualization (atom_11)
const configureArcs = (globe) => {
  return globe
    .arcStroke(0.4)
    // .arcAltitude(0.1)
    // .arcAltitudeAutoScale(0.5)
    .arcLabel((d) => `${d.officeName} ⟶ ${d.portName}`)
    .arcStartLat("startLat")
    .arcStartLng("startLng")
    .arcEndLat("endLat")
    .arcEndLng("endLng")
    .arcColor(() => ARC_CONFIG.COLORS.DEFAULT)
    .arcDashLength(ARC_CONFIG.DASH_LENGTH)
    .arcDashGap(ARC_CONFIG.DASH_GAP)
    .arcDashAnimateTime(ARC_CONFIG.ANIMATE_TIME)
    .onArcHover((hoverArc) => {
      globe.arcColor((d) => {
        if (!hoverArc) return ARC_CONFIG.COLORS.DEFAULT;
        return d === hoverArc
          ? ARC_CONFIG.COLORS.HIGHLIGHT
          : ARC_CONFIG.COLORS.DIM;
      });
    });
};

// -----------------------------------------------------------------------------
// UI Components
// -----------------------------------------------------------------------------
// 8. Toggle tooltip visibility (molecule_1)
const toggleTooltip = (iconEl, tooltipEl, data, shouldShow = null) => {
  // Add null checks for parameters
  if (!iconEl || !tooltipEl || !data) return false;

  // Clear previous tooltip
  if (state.currentTooltip && state.currentTooltip !== tooltipEl) {
    state.currentTooltip.style.display = "none";
    // Remove selected state from previous icon
    const prevIcon = document.querySelector(`#${state.activeMarkerId} .icon`);
    if (prevIcon) prevIcon.classList.remove("selected");
  }

  const isVisible = tooltipEl.style.display === "block";
  const newState = shouldShow !== null ? shouldShow : !isVisible;

  tooltipEl.style.display = newState ? "block" : "none";

  // Add null check for classList operations
  if (iconEl && iconEl.classList) {
    iconEl.classList[newState ? "add" : "remove"]("selected");
  }

  state.currentTooltip = newState ? tooltipEl : null;
  state.activeMarkerId = newState ? data.id : null;

  return newState;
};

// 9. Create marker elements (molecule_2)
const createMarkerElement = (d) => {
  const container = document.createElement("div");
  container.className = `marker-container ${d.type}-marker`;
  container.id = d.id;

  const icon = document.createElement("i");
  icon.className = `icon icon-${d.type}`;

  const tooltip = document.createElement("div");
  // Fix tooltip class name to match CSS
  tooltip.className = "marker-tooltip"; // Changed from "tooltip" to "marker-tooltip"
  tooltip.innerHTML = createTooltipContent(d);

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

  container.append(icon, tooltip);
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
    .pointerEventsFilter(() => true)
    .arcsData(state.arcData);

  // Configure globe first
  configureArcs(configureGlobeControls(state.globeInstance));

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

  // Clear active tooltip
  if (state.currentTooltip) {
    state.currentTooltip.style.display = "none";
    state.currentTooltip = null;
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
    const tooltip = container.querySelector(".marker-tooltip");

    if (icon && tooltip) {
      icon.classList.add("selected");
      tooltip.style.display = "block";
      state.currentTooltip = tooltip;
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
    shouldAnimate ? 1000 : 0,
  );

  // Generate arcs if office
  state.arcData = [];
  if (data.type === "office") {
    const managedPortNames = data.managedPorts.split(", ");
    const managedPorts = state.portData.filter((port) =>
      managedPortNames.includes(port.name)
    );
    state.arcData = generateArcData(data, managedPorts);
    state.globeInstance.arcsData(state.arcData);
  }

  // Update marker state
  setTimeout(() => {
    activateMarker(data.id);
    updateGlobeData();
  }, shouldAnimate ? 1100 : 0);
};
