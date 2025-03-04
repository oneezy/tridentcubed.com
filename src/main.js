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
    IMG_EARTH: "/images/skins/earth-blue-marble.jpg",

    GLOBE_WIDTH: mq(w, w),
    GLOBE_HEIGHT: mq(h, h),
    GLOBE_LEFT: mq(0, 0),

    // Position
    POV_ALTITUDE: mq(0.8, 0.2),
    GLOBE_TOP: mq(h * 0.9, h * 1.72),
    POV_LATITUDE: mq(36, 21),

    // POINTS
    POINT_ALTITUDE: 0.001,
    POINT_COLOR: "rgba(0, 0, 255, 1)",

    // LABELS
    LABEL_SIZE: mq(0.75, 0.25),
    LABEL_DOT_RADIUS: mq(0.3, 0.1),
    LABEL_TEXT_COLOR: "rgba(255, 255, 255, 1)",
    LABEL_DOT_COLOR: "lime",
    LABEL_POSITION: "bottom",

    // RINGS & ARCS - Updated with new configuration
    RING_COLOR_LOCATION: "#ffffff",
    RING_MAX_RADIUS: mq(4, 2),
    RING_PROPAGATION_SPEED: mq(4, 2), // deg/sec
    RING_REPEAT_PERIOD: 1000,
    RING_ALTITUDE: 0,

    // ARCS
    ARC_RELATIVE_LENGTH: 0.4, // relative to whole arc
    ARC_FLIGHT_TIME: 2000, // ms
    ARC_NUM_RINGS: 5,
    ARC_STROKE: mq(0.2, 0.05),
    ARC_DASH_LENGTH: 0.6, // relative length
    ARC_DASH_GAP: 2, // relative to dash length
    ARC_DASH_INITIAL_GAP: 1, // relative to dash length
    ARC_ALTITUDE: mq(null, null),
    ARC_ALTITUDE_AUTOSCALE: mq(0.3, 0.2),
    ARC_COLOR: "rgba(255, 255, 255, 1)",

    // ANIMATION
    ANIMATION_DURATION: 1000,

    // AUTO PLAY
    AUTO_PLAY: true,
    AUTO_PLAY_INTERVAL: 7000, // milliseconds between location changes
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
// 22. Track when arcs should be displayed (atom_16)
const showArcs = signal(false);
// Track previous location for arc animations
const previousLocation = signal(null);
// Track active arcs and rings
const activeArcs = signal([]);
const activeRings = signal([]);

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

// New derived signal for arcs data
const locationPortArcs = derived(() => {
  const location = currentLocation.value;
  const relevantPorts = currentPorts.value;

  if (!location || !relevantPorts.length) return [];

  return relevantPorts.map((port) => ({
    startLat: location.lat,
    startLng: location.lng,
    endLat: port.lat,
    endLng: port.lng,
    port: port.port,
    city: port.city,
    // color: "rgba(255, 255, 255, 0.8)",
  }));
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
// Arc & Ring Animation Functions
// -----------------------------------------------------------------------------
// 26. Emit arc from one location to another (atom_20)
const emitArc = (startLocation, endLocation, config) => {
  if (!startLocation || !endLocation || !globeInstance.value) return;

  const startLat = parseFloat(startLocation.lat);
  const startLng = parseFloat(startLocation.lng);
  const endLat = parseFloat(endLocation.lat);
  const endLng = parseFloat(endLocation.lng);

  const globe = globeInstance.value;
  const FLIGHT_TIME = config.ARC_FLIGHT_TIME;
  const ARC_REL_LEN = config.ARC_RELATIVE_LENGTH;

  // Create and add the arc
  const arc = { startLat, startLng, endLat, endLng, color: config.ARC_COLOR };
  const newArcs = [...activeArcs.value, arc];
  activeArcs.value = newArcs;
  globe.arcsData(newArcs);

  // Remove arc after animation completes
  setTimeout(() => {
    activeArcs.value = activeArcs.value.filter((d) => d !== arc);
    globe.arcsData(activeArcs.value);
  }, FLIGHT_TIME * 2);

  // Add start location rings
  const startRing = { lat: startLat, lng: startLng };
  const newStartRings = [...activeRings.value, startRing];
  activeRings.value = newStartRings;
  globe.ringsData(newStartRings);

  // Remove start rings after partial animation
  setTimeout(() => {
    activeRings.value = activeRings.value.filter((r) => r !== startRing);
    globe.ringsData(activeRings.value);
  }, FLIGHT_TIME * ARC_REL_LEN);

  // Add end location rings with delay
  setTimeout(() => {
    const endRing = { lat: endLat, lng: endLng };
    const newEndRings = [...activeRings.value, endRing];
    activeRings.value = newEndRings;
    globe.ringsData(newEndRings);

    // Remove end rings after partial animation
    setTimeout(() => {
      activeRings.value = activeRings.value.filter((r) => r !== endRing);
      globe.ringsData(activeRings.value);
    }, FLIGHT_TIME * ARC_REL_LEN);
  }, FLIGHT_TIME);

  // After all animations, set current location to active
  setTimeout(() => {
    globe.ringsData([endLocation]);
  }, FLIGHT_TIME * (1 + ARC_REL_LEN));
};

// -----------------------------------------------------------------------------
// UI Effects
// -----------------------------------------------------------------------------
// 6. Update globe rings and view when current location changes (effect_1)
effect(() => {
  const globe = globeInstance.value;
  const location = currentLocation.value;
  const prevLoc = previousLocation.value;
  const config = CONFIG.value;

  if (!globe || !location) return;

  // Clear any existing rings immediately
  globe.ringsData([]);

  // First time initialization - single ring animation
  if (!prevLoc) {
    const ring = { lat: location.lat, lng: location.lng };
    setTimeout(() => {
      globe.ringsData([ring]);

      // Remove ring after animation
      setTimeout(() => {
        globe.ringsData([]);
      }, config.ARC_FLIGHT_TIME * config.ARC_RELATIVE_LENGTH);
    }, 100);

    previousLocation.value = location;

    // Update globe view
    globe.pointOfView(
      {
        lat: parseFloat(location.lat) - config.POV_LATITUDE,
        lng: parseFloat(location.lng),
        altitude: config.POV_ALTITUDE,
      },
      config.ANIMATION_DURATION,
    );

    return;
  }

  // Location change - emit arc and ring animations
  if (prevLoc !== location) {
    // Emit arc animation (which handles its own ring animations)
    emitArc(prevLoc, location, config);

    // Update previous location for next change
    previousLocation.value = location;

    // Update globe view
    globe.pointOfView(
      {
        lat: parseFloat(location.lat) - config.POV_LATITUDE,
        lng: parseFloat(location.lng),
        altitude: config.POV_ALTITUDE,
      },
      config.ANIMATION_DURATION,
    );
  }
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
  }, 500);
});

// 10. Update labels when current location changes
effect(() => {
  const globe = globeInstance.value;
  const ports = currentPorts.value;
  const config = CONFIG.value;

  if (!globe || !ports.length) {
    if (globe) globe.labelsData([]);
    return;
  }

  // Clear existing labels immediately
  globe.labelsData([]);

  // Add delay to match arc animation timing
  setTimeout(() => {
    // Create initial label data
    const labelData = ports.map((port) => ({
      lat: port.lat,
      lng: port.lng,
      label: port.city || "Unknown Port",
      size: config.LABEL_SIZE,
      dotRadius: config.LABEL_DOT_RADIUS,
      orientation: "bottom", // default orientation
    }));

    // Apply collision detection
    const adjustedLabels = avoidLabelCollisions(labelData);
    globe.labelsData(adjustedLabels);
  }, config.ARC_FLIGHT_TIME + 500);
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

// New effect to update arcs when current location or ports change
effect(() => {
  const globe = globeInstance.value;
  const arcs = locationPortArcs.value;
  const shouldShowArcs = showArcs.value;

  if (!globe) return;

  // 25. Only show arcs when showArcs is true (atom_19)
  if (shouldShowArcs) {
    globe.arcsData(arcs);
  } else {
    globe.arcsData([]);
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
  // Create a grid to track occupied spaces
  const grid = new Map();
  const gridSize = 5; // degrees

  const getGridKey = (lat, lng) => {
    const latGrid = Math.floor(lat / gridSize);
    const lngGrid = Math.floor(lng / gridSize);
    return `${latGrid},${lngGrid}`;
  };

  return labels.map((label) => {
    const key = getGridKey(label.lat, label.lng);

    if (grid.has(key)) {
      // Space is occupied, try different orientations
      const existing = grid.get(key);
      if (existing.orientation === "bottom") {
        label.orientation = "top";
      } else if (existing.orientation === "top") {
        label.orientation = "right";
      } else if (existing.orientation === "right") {
        label.orientation = "left";
      } else {
        // If all positions are taken, offset slightly
        label.lat += gridSize * 0.2;
        label.orientation = "bottom";
      }
    } else {
      label.orientation = "bottom";
    }

    grid.set(key, label);
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
    // RINGS - Start with empty data to prevent initial infinite animation
    .ringLat((d) => d.lat)
    .ringLng((d) => d.lng)
    .ringAltitude(config.RING_ALTITUDE)
    .ringColor(() => (t) => `rgba(255,255,255,${1 - t})`)
    .ringMaxRadius(config.RING_MAX_RADIUS)
    .ringPropagationSpeed(config.RING_PROPAGATION_SPEED)
    .ringResolution(64)
    .ringsData([]) // Start with no rings
    .ringRepeatPeriod(
      config.ARC_FLIGHT_TIME * config.ARC_RELATIVE_LENGTH /
        config.ARC_NUM_RINGS,
    )
    // ARCS
    .arcColor("color")
    .arcStroke(config.ARC_STROKE)
    .arcDashLength(config.ARC_DASH_LENGTH)
    .arcDashGap(config.ARC_DASH_GAP)
    .arcDashInitialGap(config.ARC_DASH_INITIAL_GAP)
    .arcDashAnimateTime(config.ARC_FLIGHT_TIME)
    .arcAltitude(config.ARC_ALTITUDE)
    .arcAltitudeAutoScale(config.ARC_ALTITUDE_AUTOSCALE)
    .arcsTransitionDuration(0)
    .arcLabel((d) => `${d.port || "Port"} - ${d.city || "Unknown"}`)
    // POINTS
    .pointsData(locations.value)
    .pointAltitude(() => config.POINT_ALTITUDE)
    .pointColor(() => config.POINT_COLOR)
    // HTML
    .htmlElementsData(locations.value)
    .htmlElement((d) => {
      const el = document.createElement("div");
      el.innerHTML =
        `<svg xmlns="http://www.w3.org/2000/svg" class="svg svg-marker" fill="none" viewBox="0 0 87 122"><path class="stroke" stroke-width="4" d="m43.0833 115.667-1.4842 1.34 1.4842 1.643 1.4842-1.643-1.4842-1.34Zm0 0c1.4842 1.34 1.4846 1.34 1.4851 1.339l.0018-.002.0062-.007.023-.025.0875-.098c.0764-.085.1886-.211.3343-.376.2914-.33.7167-.816 1.2567-1.442 1.0799-1.254 2.6193-3.074 4.4651-5.348 3.6898-4.546 8.6129-10.9197 13.5399-18.2222 4.9232-7.2969 9.8751-15.5579 13.6022-23.8774 3.7154-8.2933 6.2816-16.7923 6.2816-24.5251A41.0836 41.0836 0 0 0 14.033 14.033 41.0835 41.0835 0 0 0 2 43.0833c0 7.7328 2.5662 16.2318 6.2816 24.5251 3.7271 8.3195 8.679 16.5805 13.6021 23.8774 4.9271 7.3025 9.8501 13.6762 13.5399 18.2222 1.8458 2.274 3.3852 4.094 4.4652 5.348.54.626.9652 1.112 1.2566 1.442.1457.165.258.291.3344.376l.0874.098.023.025.0063.007.0017.002c.0006.001.0009.001 1.4851-1.339Z"/><path class="bg" d="M60 44c0 9.3888-7.6112 17-17 17s-17-7.6112-17-17 7.6112-17 17-17 17 7.6112 17 17Z"/><path class="fg" d="M43.0833 57.0417a13.9584 13.9584 0 1 1 .0001-27.9168 13.9584 13.9584 0 0 1-.0001 27.9168Zm0-53.0417a39.0837 39.0837 0 0 0-27.6361 11.4472A39.0837 39.0837 0 0 0 4 43.0833c0 29.3125 39.0833 72.5837 39.0833 72.5837s39.0834-43.2712 39.0834-72.5837A39.0834 39.0834 0 0 0 43.0833 4Z"/></svg>`;
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
    .htmlAltitude(0.005)
    // LABELS
    .labelColor(() => config.LABEL_TEXT_COLOR)
    .labelDotOrientation((d) => d.orientation) // Use the orientation determined by collision detection
    .labelDotRadius(() => config.LABEL_DOT_RADIUS)
    .labelSize(() => config.LABEL_SIZE)
    .labelText("label")
    .labelLabel((d) => `<div>${d.label}</div>`) // Use the label property we set
    .labelAltitude(0.0011)
    .labelResolution(20)
    // FIRST LOAD
    .onGlobeReady(() => {
      // Set first location after globe is ready
      if (locations.value.length > 0) {
        // Initialize first location without animation
        const firstLocation = locations.value[0];
        globe.ringsData([firstLocation]); // Set initial ring
        currentIndex.value = 0; // This will trigger the regular ring animation through the effect

        // Rest of initialization
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
  // globe.controls().autoRotate = true;
  // globe.controls().autoRotateSpeed = -0.5;
  // globe.controls().minPolarAngle = Math.PI / 2;
  // globe.controls().maxPolarAngle = Math.PI / 2;
  // globe.controls().enableRotate = true;
  // globe.controls().rotateSpeed = -0.5;

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
  clearTimeout(window.arcsTimeout);
});

// 19. Initialize application (molecule_5)
document.addEventListener("DOMContentLoaded", () => {
  setupGlobe();
  window.dispatchEvent(new Event("resize"));
});
