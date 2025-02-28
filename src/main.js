import Globe from "globe.gl";
import { derived, effect, signal } from "./lib/signals.js";
import { mq } from "./lib/mq.js";
import { counter } from "./lib/counter.js";
import { createAutoPlay } from "./lib/autoPlay.js";
import "./style.css";

// -----------------------------------------------------------------------------
// Constants & Configuration
// -----------------------------------------------------------------------------
// 1. Window dimensions for responsive calculations
const windowDimensions = signal({
  width: window.innerWidth,
  height: window.innerHeight,
});

// Update dimensions when window resizes
window.addEventListener("resize", () => {
  windowDimensions.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
});

// 2. Basic configuration settings
// Google Sheet: https://docs.google.com/spreadsheets/d/1_BNtsJr9TaSYRPFAKcAd9pa_TUQyYBfqEZiDvDvkPTw/
const CONFIG = derived(() => {
  const w = windowDimensions.value.width;
  const h = windowDimensions.value.height;

  return {
    // DATA
    DATA_LOCATIONS:
      "https://opensheet.justinoneill2007.workers.dev/1_BNtsJr9TaSYRPFAKcAd9pa_TUQyYBfqEZiDvDvkPTw/locations",
    DATA_PORTS:
      "https://opensheet.justinoneill2007.workers.dev/1_BNtsJr9TaSYRPFAKcAd9pa_TUQyYBfqEZiDvDvkPTw/ports",

    // GLOBE
    IMG_EARTH:
      "https://unpkg.com/three-globe@2.41.12/example/img/earth-blue-marble.jpg",

    GLOBE_WIDTH: mq(w, w),
    GLOBE_HEIGHT: mq(h, h),
    GLOBE_LEFT: mq(0, 0),
    // Position
    POV_ALTITUDE: mq(0.8, 0.2),
    GLOBE_TOP: mq(h * 0.8, h * 1.7),
    POV_LATITUDE: mq(38, 21),

    // POINTS
    POINT_ALTITUDE: 0.002,
    POINT_COLOR: "rgba(0, 0, 255, 1)",

    // LABELS
    LABEL_SIZE: mq(0.8, 0.3),
    LABEL_DOT_RADIUS: mq(0.3, 0.2),
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

    // AUTO PLAY
    AUTO_PLAY: true,
    AUTO_PLAY_INTERVAL: 5000, // milliseconds between location changes
    AUTO_PLAY_PAUSE_ON_INTERACTION: true, // pause when user interacts
    AUTO_PLAY_RESUME_DELAY: 60000, // milliseconds before resuming after pause
  };
});

// -----------------------------------------------------------------------------
// State Management with Signals
// -----------------------------------------------------------------------------
// 3. Core state signals
const locations = signal([]);
const ports = signal([]);
const currentIndex = signal(0);
const globeInstance = signal(null);
const autoPlayInstance = signal(null); // Add signal to store autoPlay instance

// 4. Derived state values
const currentLocation = derived(() => {
  return locations.value[currentIndex.value] || null;
});

const currentPorts = derived(() => {
  if (!currentLocation.value) return [];
  return ports.value.filter((port) =>
    port.location === currentLocation.value.location
  );
});

// -----------------------------------------------------------------------------
// Data Management
// -----------------------------------------------------------------------------
// 5. Fetches and stores location and port data (molecule_1)
const fetchData = async () => {
  try {
    const [locationsRes, portsRes] = await Promise.all([
      fetch(`${CONFIG.value.DATA_LOCATIONS}`),
      fetch(`${CONFIG.value.DATA_PORTS}`),
    ]);

    locations.value = await locationsRes.json();
    ports.value = await portsRes.json();
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

// -----------------------------------------------------------------------------
// UI Effects
// -----------------------------------------------------------------------------
// 6. Update globe rings and view when current location changes (effect_1)
effect(() => {
  const globe = globeInstance.value;
  const location = currentLocation.value;
  const config = CONFIG.value; // Access CONFIG as a signal value

  if (!globe || !location) return;

  // Update rings data to only show for current location
  globe.ringsData([location]);

  // Update globe view
  globe.pointOfView(
    {
      lat: parseFloat(location.lat) - config.POV_LATITUDE,
      lng: parseFloat(location.lng),
      altitude: config.POV_ALTITUDE,
    },
    config.ANIMATION_DURATION,
  );
});

// 7. Update content panel when current location or ports change (effect_2)
effect(() => {
  const location = currentLocation.value;
  const relevantPorts = currentPorts.value;
  const content = document.querySelector("#content");

  if (!location || !content) return;

  content.innerHTML = `
    <div class="flex w-screen relative md:w-[550px]">
      <button id="backBtn" class="btn-navigation">
        <i class="icon icon-chevron-left"></i>
      </button>
      <h3 class="select-none text-2xl md:text-4xl font-light p-2 flex-grow">${location.location}</h3>
      <button id="nextBtn" class="btn-navigation right-0 justify-end">
        <i class="icon icon-chevron-right"></i>
      </button>
    </div>

    <div class="flex gap-4 items-center justify-center">
      <a class="btn btn-text" href="tel:${location.phone}">
        <i class="icon icon-phone"></i>
        ${location.phone}
      </a>
      <a class="btn btn-text" href="mailto:${location.email}">
        <i class="icon icon-email"></i>
        ${location.email}
      </a>
    </div>

    <ul class="hidden">
      ${
    relevantPorts.length
      ? relevantPorts.map((p) => `<li>${p.port}</li>`).join("")
      : "<li>No ports available</li>"
  }
    </ul>
  `;

  // Set up navigation after content is updated
  setupNavigation();
});

// 8. Update indicators active state when current index changes
effect(() => {
  const indicators = document.querySelectorAll(".indicator");
  const index = currentIndex.value;

  indicators.forEach((indicator, idx) => {
    indicator.classList.toggle("active", idx === index);
  });
});

// 9. Update markers when current location changes
effect(() => {
  const loc = currentLocation.value;
  if (!loc) return;

  // Wait a brief moment for Globe.gl to render the HTML elements
  setTimeout(() => {
    document.querySelectorAll(".svg-marker").forEach((marker) => {
      const parent = marker.closest("[data-lat][data-lng]");
      if (!parent) return;

      const lat = parent.dataset.lat;
      const lng = parent.dataset.lng;

      const isActive = parseFloat(lat) === parseFloat(loc.lat) &&
        parseFloat(lng) === parseFloat(loc.lng);

      marker.classList.toggle("active", isActive);
    });
  }, 200);
});

// 10. Update labels when current location changes
effect(() => {
  const globe = globeInstance.value;
  const ports = currentPorts.value;

  if (!globe || !ports.length) {
    if (globe) globe.labelsData([]);
    return;
  }

  // Avoid label collisions by adjusting orientation
  const adjustedPorts = avoidLabelCollisions(
    ports.map((port) => ({
      lat: port.lat,
      lng: port.lng,
      label: port.city || "Unknown Port",
      color: [CONFIG.value.LABEL_TEXT_COLOR, CONFIG.value.LABEL_DOT_COLOR],
      size: CONFIG.value.LABEL_SIZE,
      dotRadius: CONFIG.value.LABEL_DOT_RADIUS,
    })),
  );

  globe.labelsData(adjustedPorts);
});

// 11. Update stats counters when data is loaded (effect_6)
effect(() => {
  const locationsCounter = document.querySelector("#locations-counter");
  const portsCounter = document.querySelector("#ports-counter");

  if (locationsCounter) {
    locationsCounter.setAttribute("data-target", locations.value.length);
  }

  if (portsCounter) {
    portsCounter.setAttribute("data-target", ports.value.length);
  }

  // Trigger counter animation when values change
  if (locations.value.length > 0 || ports.value.length > 0) {
    counter({
      easingType: "inOut",
      easingPower: 3,
      duration: 3000,
      finalValueThreshold: 0.75, // Start approaching final value earlier
      displayFinalValueThreshold: 0.97, // Show exact final value at 97% of duration
    });
  }
});

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------
// 12. Change location and update index signal (atom_8)
const changeLocation = (newIndex) => {
  const total = locations.value.length;
  if (total === 0) return;

  currentIndex.value = (newIndex + total) % total;
};

// 13. Sets up location indicators (atom_9)
const setupIndicators = () => {
  const indicatorContainer = document.querySelector("#indicators");
  if (!indicatorContainer) return;

  indicatorContainer.innerHTML = ""; // Clear existing indicators

  locations.value.forEach((_, idx) => {
    const indicatorEl = document.createElement("div");
    indicatorEl.classList = "indicator " +
      (idx === currentIndex.value ? "active" : "");
    indicatorEl.addEventListener("click", () => changeLocation(idx));
    indicatorContainer.appendChild(indicatorEl);
  });
};

// 14. Sets up navigation buttons (atom_10)
const setupNavigation = () => {
  const backBtn = document.querySelector("#backBtn");
  const nextBtn = document.querySelector("#nextBtn");

  if (backBtn) {
    backBtn.addEventListener(
      "click",
      () => changeLocation(currentIndex.value - 1),
    );
  }

  if (nextBtn) {
    nextBtn.addEventListener(
      "click",
      () => changeLocation(currentIndex.value + 1),
    );
  }
};

// 15. Handles window resize events (atom_11)
const handleResize = (e) => {
  const globe = globeInstance.value;
  const config = CONFIG.value;
  if (!globe) return;

  globe
    .width([e.target.innerWidth])
    .height([e.target.innerHeight])
    .globeOffset([config.GLOBE_LEFT, config.GLOBE_TOP])
    .pointOfView({ lat: 0, lng: 0, altitude: config.POV_ALTITUDE }, 1000);
};

// 16. Creates ring color with dynamic opacity (atom_12)
const getRingColor = (t) => `rgba(255,255,255,${Math.sqrt(1 - t)})`;

// 17. Avoid label collisions (atom_13)
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

// 20. Handles keyboard navigation (atom_14)
const handleKeyboardNavigation = (event) => {
  // Only respond to left and right arrow keys
  if (event.key === "ArrowLeft") {
    changeLocation(currentIndex.value - 1);
    event.preventDefault();
  } else if (event.key === "ArrowRight") {
    changeLocation(currentIndex.value + 1);
    event.preventDefault();
  }
};

// -----------------------------------------------------------------------------
// Globe Setup & Management
// -----------------------------------------------------------------------------
// 18. Initializes and configures the globe (organism_1)
const setupGlobe = async () => {
  await fetchData();

  // Initialize globe
  const globeEl = document.querySelector("#globe");
  if (!globeEl) return;

  const config = CONFIG.value;
  const altitude = config.POV_ALTITUDE;
  const globe = new Globe(globeEl)
    // GLOBE
    .globeImageUrl(config.IMG_EARTH)
    .backgroundColor("rgba(0,0,0,0)")
    .globeOffset([config.GLOBE_LEFT, config.GLOBE_TOP])
    .pointOfView({ lat: 0, lng: 0, altitude })
    // ATMOSPHERE
    .showAtmosphere(true)
    .atmosphereColor("#00bcff")
    .atmosphereAltitude(mq(0.2, 0.1))
    // RINGS
    .ringLat((d) => d.lat)
    .ringLng((d) => d.lng)
    .ringAltitude(config.RING_ALTITUDE)
    .ringColor(() => getRingColor)
    .ringMaxRadius(config.RING_MAX_RADIUS)
    .ringPropagationSpeed(config.RING_PROPAGATION_SPEED)
    .ringRepeatPeriod(config.RING_REPEAT_PERIOD)
    // POINTS
    .pointsData(locations.value)
    .pointAltitude(() => config.POINT_ALTITUDE)
    .pointColor(() => config.POINT_COLOR)
    // HTML
    .htmlElementsData(locations.value)
    .htmlElement((d) => {
      const el = document.createElement("div");
      el.innerHTML = `<i class="svg svg-marker"></i>`;
      el.dataset.lat = d.lat;
      el.dataset.lng = d.lng;

      el.style["pointer-events"] = "auto";
      el.onclick = () => {
        const idx = locations.value.findIndex((loc) =>
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
    .labelColor(() => config.LABEL_TEXT_COLOR)
    .labelDotOrientation((d) => d.orientation || "bottom")
    .labelDotRadius(() => config.LABEL_DOT_RADIUS)
    .labelSize(() => config.LABEL_SIZE)
    .labelText("label")
    .labelLabel((d) => `<div></div>`)
    // FIRST LOAD
    .onGlobeReady(() => {
      // Set first location after globe is ready
      if (locations.value.length > 0) {
        currentIndex.value = 0; // Trigger all the effects

        // Setup autoplay with modular approach
        if (config.AUTO_PLAY) {
          const interactionElements = [
            document.querySelector("#globe"),
            document.querySelector("#indicators"),
            document.querySelector("#content"),
            document,
          ];

          // Create autoplay controller with the modular approach
          const autoPlay = createAutoPlay(
            config,
            () => changeLocation(currentIndex.value + 1),
            interactionElements,
          );

          // Store the autoPlay instance
          autoPlayInstance.value = autoPlay;

          // Start autoplay
          autoPlay(true);

          // Set up specific keyboard handling for autoplay
          // 21. Setup keyboard navigation with autoplay integration (atom_15)
          const handleKeyboardAutoPlay = () => {
            if (config.AUTO_PLAY_PAUSE_ON_INTERACTION) {
              // Dispatch a keyup event to trigger autoPlay pause logic
              const keyupEvent = new Event("keyup", { bubbling: true });
              document.dispatchEvent(keyupEvent);
            }
          };

          // Add keyboard event listeners with autoPlay pause integration
          document.addEventListener("keydown", (event) => {
            // Handle navigation with arrow keys
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              handleKeyboardNavigation(event);
              handleKeyboardAutoPlay();
            }
          });
        }
      }
    });

  globe.controls().enableZoom = false;
  globeInstance.value = globe; // Set the globe instance signal

  setupIndicators();
};

// -----------------------------------------------------------------------------
// Event Listeners
// -----------------------------------------------------------------------------
window.addEventListener("resize", handleResize);

// Clean up timers when page is hidden or unloaded
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && autoPlayInstance.value) {
    // Pause autoplay when page is hidden
    autoPlayInstance.value(false);
  } else if (
    document.visibilityState === "visible" &&
    CONFIG.value.AUTO_PLAY &&
    autoPlayInstance.value
  ) {
    // Resume autoplay when page becomes visible
    autoPlayInstance.value(true);
  }
});

window.addEventListener("unload", () => {
  // No need to clear timers manually, they'll be cleaned up automatically
});

// 19. Initialize application (molecule_5)
document.addEventListener("DOMContentLoaded", () => {
  setupGlobe();
  window.dispatchEvent(new Event("resize")); // Trigger initial resize
});
