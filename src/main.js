import Globe from "globe.gl";
import "./style.css";

// -----------------------------------------------------------------------------
// Constants & Configuration
// -----------------------------------------------------------------------------
// 1. Utility function for responsive breakpoints (atom_1)
function mediaQueryValue(defaultValue, sm, md, lg) {
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
  SCALE_FACTOR: mediaQueryValue(2.5, 3, 4),
  POINT_ALTITUDE: 0.2,
  POINT_COLOR: "blue",
  POV_ALTITUDE: mediaQueryValue(4, 3, 2.25),
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
const setupBaseHTML = () => {
  document.querySelector("#app").innerHTML = `
<section class="hero-section">

	<!-- HERO SECTION
	:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: -->
	<div class="back">
		<div class="hero-image">
			<img src="https://www.tridentcubed.com/wp-content/uploads/houston-night-2-1.jpg" alt="" class="blur-image">
			<img src="https://www.tridentcubed.com/wp-content/uploads/houston-night-2-1.jpg" alt="" class="main-image">
			<div class="overlay overlay-scrim"></div>
		</div>

		<div class="hero-container">
			<div class="hero-title">
				<strong>Logistics Support Partner</strong>
				<h1>Highly experienced Port Captains, Surveyors and Transport Engineers</h1>
			</div>
		</div>
	</div>
	
	<!-- GLOBE
	:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: -->
	<div class="globe-container">
		<div id="globe"></div>
		<div class="btn-container btn-position none">
			<a class="btn btn-primary" href="#">
				<i class="icon icon-ship"></i>
				<!-- <i class="icon icon-wheel"></i> -->
				<!-- <i class="icon icon-boat"></i> -->
				<!-- <i class="icon icon-captain"></i> -->
				<!-- <i class="icon icon-earth"></i> -->
				<!-- <i class="icon icon-globe"></i> -->
				<!-- <i class="icon icon-map"></i> -->
				<!-- <i class="icon icon-anchor"></i> -->
				<!-- <i class="icon icon-container"></i> -->
				<!-- <i class="icon icon-propeller"></i> -->
				<!-- <i class="icon icon-trident"></i> -->
				<!-- <i class="icon icon-trident2"></i> -->
				Partner With Us
			</a>
		</div>
		<div class="overlay overlay-gradient"></div> 
	</div>
	
	<!-- GLOBE CONTROLS
	:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::: -->
	<div class="front">
		<div id="frontContent" class="front-content none"></div>
    <div class="front-container">
		  <div class="indicators" id="frontIndicators"></div> 
			<div class="btn-container">
		    <button id="backBtn" class="btn btn-ghost">
          <i class="icon icon-chevron-left"></i>
        </button>
				<a class="btn btn-primary" href="#">
					<i class="icon icon-ship"></i>
					<!-- <i class="icon icon-wheel"></i> -->
					<!-- <i class="icon icon-boat"></i> -->
					<!-- <i class="icon icon-captain"></i> -->
					<!-- <i class="icon icon-earth"></i> -->
					<!-- <i class="icon icon-globe"></i> -->
					<!-- <i class="icon icon-map"></i> -->
					<!-- <i class="icon icon-anchor"></i> -->
					<!-- <i class="icon icon-container"></i> -->
					<!-- <i class="icon icon-propeller"></i> -->
					<!-- <i class="icon icon-trident"></i> -->
					<!-- <i class="icon icon-trident2"></i> -->
					Partner With Us
				</a>
        <button id="nextBtn" class="btn btn-ghost">
          <i class="icon icon-chevron-right"></i>
        </button>
      </div>
    </div>
	</div>
</section>

<section>2</section>
<section>3</section>
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
  document.querySelectorAll(".globe-container .svg-location").forEach(
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

// 11. Sets up location indicators (atom_8)
const setupIndicators = () => {
  const indicatorContainer = document.querySelector("#frontIndicators");
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
    const scaleFactor = mediaQueryValue(2.5, 3, 4);
    const altitude = mediaQueryValue(4, 3, 2.25);

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
  await setupBaseHTML();
  await fetchData();

  // Initialize globe
  const globeEl = document.querySelector("#globe");
  const scaleFactor = mediaQueryValue(2.5, 3, 4);
  const altitude = mediaQueryValue(4, 3, 2.25);

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
      el.innerHTML = `<i class="svg svg-location"></i>`;
      return el;
    })
    .htmlLat((d) => d.lat)
    .htmlLng((d) => d.lng)
    .htmlAltitude(0.1)
    .atmosphereColor("blue")
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
});
