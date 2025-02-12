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
  currentTooltip: null,
  activeMarkerId: null,
  currentLocationIndex: 0,
  globeInstance: null,
  portData: [],
  officeData: [],
  combinedData: [],
};

// -----------------------------------------------------------------------------
// DOM Utilities
// -----------------------------------------------------------------------------
// 3. Setup initial HTML (atom_3)
const setupBaseHTML = () => {
  document.querySelector("#app").innerHTML = `
    <div id="globe"></div>
    <div class="nav-buttons">
      <button class="nav-button" id="prevLocation">Previous</button>
      <button class="nav-button" id="nextLocation">Next</button>
    </div>
  `;
};

// 4. Create tooltip markup (atom_4)
const createTooltipContent = (d) =>
  d.type === "office"
    ? `<div><strong>${d.name}</strong></div>
     <div>${d.description}</div>
     <div><small>Managed Ports: ${d.managedPorts}</small></div>`
    : `<div><strong>${d.name}</strong></div>
     <div>${d.city}, ${d.province}</div>
     <div>${d.country}</div>
     <div>${d.timezone}</div>`;

// -----------------------------------------------------------------------------
// Data Processing
// -----------------------------------------------------------------------------
// 5. Process port data (atom_5)
const processPortData = (port, index) => ({
  id: `port-${index}`,
  lat: parseFloat(port.latitude),
  lng: parseFloat(port.longitude),
  name: port.name,
  city: port.city,
  country: port.country,
  province: port.province,
  timezone: port.timezone,
  type: "port",
});

// 6. Process office data (atom_6)
const processOfficeData = (timezone, index, portsInTimezone) => ({
  id: `office-${index}`,
  lat: calculateAverage(portsInTimezone, "latitude"),
  lng: calculateAverage(portsInTimezone, "longitude"),
  name: `Regional Office: ${timezone}`,
  timezone: timezone,
  type: "office",
  description: `Managing ${portsInTimezone.length} ports in ${timezone}`,
  managedPorts: portsInTimezone.map((p) => p.name).join(", "),
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

  container.onclick = (event) => handleMarkerClick(event, d, icon, tooltip);

  // Add hover state management with null checks
  container.onmouseenter = () => icon && icon.classList.add("selected");
  container.onmouseleave = () => {
    if (icon && state.activeMarkerId !== d.id) {
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
const handleMarkerClick = (event, d, markerEl, tooltipEl) => {
  if (!event || !d || !markerEl || !tooltipEl) return;

  event.stopPropagation();
  console.info(d);
  toggleTooltip(markerEl, tooltipEl, d);
  const index = state.combinedData.findIndex((item) => item.id === d.id);
  navigateToLocation(index, false);
};

// 11. Handle navigation (molecule_4)
const navigateToLocation = (index, showTooltip = true) => {
  if (index < 0) index = state.combinedData.length - 1;
  if (index >= state.combinedData.length) index = 0;

  state.currentLocationIndex = index;
  const d = state.combinedData[index];

  if (state.globeInstance && d) {
    state.globeInstance.pointOfView(
      { lat: d.lat - 50, lng: d.lng, altitude: 2.5 },
      1000,
    );

    if (showTooltip) {
      setTimeout(() => {
        const container = document.querySelector(`#${d.id}`);
        if (container) {
          const icon = container.querySelector(".icon");
          const tooltip = container.querySelector(".marker-tooltip");
          if (icon && tooltip) {
            toggleTooltip(icon, tooltip, d, true);
          }
        }
      }, 1100);
    }
  }
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
    const response = await fetch(
      "https://opensheet.justinoneill2007.workers.dev/1XA9G0ByJlULrVkwyfCaZhTaDYhtUZnWIscqIFRRd-A8/ports",
    );
    const ports = await response.json();

    state.portData = ports.map(processPortData);
    state.officeData = processTimezoneOffices(ports);
    state.combinedData = [...state.officeData, ...state.portData];

    return state.combinedData;
  } catch (error) {
    console.error("Error fetching port data:", error);
    return [];
  }
};

// 14. Initialize globe (organism_2)
const initGlobe = async () => {
  const globeEl = document.querySelector("#globe");
  const data = await fetchPortData();

  const globe = new Globe(globeEl)
    .backgroundColor("#fff")
    .globeImageUrl(ASSETS.earthSkin)
    .htmlElementsData(data)
    .htmlElement(createMarkerElement)
    .enablePointerInteraction(true)
    .pointerEventsFilter(() => true);

  return configureGlobeControls(globe);
};

// -----------------------------------------------------------------------------
// Application Entry Point
// -----------------------------------------------------------------------------
// 15. Initialize application (organism_3)
const initApp = async () => {
  setupBaseHTML();
  state.globeInstance = await initGlobe();

  const prevButton = document.querySelector("#prevLocation");
  const nextButton = document.querySelector("#nextLocation");
  // Setup navigation
  prevButton.addEventListener(
    "click",
    () => navigateToLocation(state.currentLocationIndex - 1),
  );

  nextButton.addEventListener(
    "click",
    () => navigateToLocation(state.currentLocationIndex + 1),
  );

  // Handle window resize
  const handleResize = () => {
    const { innerWidth: width, innerHeight: height } = window;
    if (state.globeInstance) state.globeInstance.width(width).height(height);
  };

  window.addEventListener("resize", handleResize);
  window.dispatchEvent(new Event("resize"));

  // Initial navigation
  navigateToLocation(0);
};

// Start the application when DOM is ready
document.addEventListener("DOMContentLoaded", initApp);
