import { effect, signal } from "./signals.js";

// 1. Stores the timer reference for interval operations (atom_1)
const createTimer = (initialValue = null) => signal(initialValue);

// 2. Controls the active state of autoPlay (atom_2)
const createActiveState = (initialState = false) => signal(initialState);

// 3. Tracks if user has recently interacted (atom_3)
const createInteractionState = (initialState = false) => signal(initialState);

// 4. Clears any existing timer (atom_4)
const clearTimer = (timerSignal) => {
	if (timerSignal.value) {
		clearInterval(timerSignal.value);
		timerSignal.value = null;
	}
};

// 5. Clears any existing timeout (atom_5)
const clearTimeout = (timeoutSignal) => {
	if (timeoutSignal.value) {
		clearTimeout(timeoutSignal.value);
		timeoutSignal.value = null;
	}
};

// 6. Creates a function to advance to the next item (atom_6)
const createAdvanceFunction = (callback) => () => {
	if (typeof callback === "function") {
		callback();
	}
};

// 7. Starts the autoPlay timer for cycling (atom_7)
const startTimer = (timerSignal, interactionSignal, callback, interval) => {
	clearTimer(timerSignal);

	if (!interactionSignal.value) {
		timerSignal.value = setInterval(callback, interval);
	}
};

// 8. Creates a function to pause autoPlay on user interaction (molecule_1)
const createPauseFunction = (
	config,
	timerSignal,
	interactionSignal,
	pauseTimerSignal,
	startTimerFn,
) => {
	return () => {
		if (!config.AUTO_PLAY_PAUSE_ON_INTERACTION) return;

		interactionSignal.value = true;
		clearTimer(timerSignal);

		// Reset the pause timer if it exists
		clearTimeout(pauseTimerSignal);

		// Set a timer to resume autoPlay after delay
		if (config.AUTO_PLAY_RESUME_DELAY > 0) {
			pauseTimerSignal.value = setTimeout(() => {
				interactionSignal.value = false;
				if (config.AUTO_PLAY) {
					startTimerFn();
				}
			}, config.AUTO_PLAY_RESUME_DELAY);
		}
	};
};

// 9. Sets up user interaction events to pause autoPlay (molecule_2)
const setupInteractionEvents = (elements, events, pauseFn) => {
	elements.forEach((element) => {
		if (!element) return;

		events.forEach((eventType) => {
			element.addEventListener(eventType, pauseFn);
		});
	});
};

// 10. Creates full autoPlay functionality (organism_1)
export const createAutoPlay = (
	config,
	advanceCallback,
	interactionElements = [],
) => {
	// Initialize signals
	const timer = createTimer();
	const active = createActiveState();
	const userInteracted = createInteractionState();
	const pauseTimer = createTimer();

	// Create the advance function
	const advance = createAdvanceFunction(advanceCallback);

	// Create a function to start the timer
	const startAutoPlayTimer = () => {
		startTimer(timer, userInteracted, advance, config.AUTO_PLAY_INTERVAL);
	};

	// Create the pause function
	const pause = createPauseFunction(
		config,
		timer,
		userInteracted,
		pauseTimer,
		startAutoPlayTimer,
	);

	// Setup interaction events
	const interactionEvents = [
		"click",
		"touchstart",
		"mousedown",
		"keyup",
	];
	setupInteractionEvents(interactionElements, interactionEvents, pause);

	// Setup visibility change handler
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			clearTimer(timer);
			clearTimeout(pauseTimer);
		} else if (
			document.visibilityState === "visible" &&
			config.AUTO_PLAY &&
			active.value
		) {
			startAutoPlayTimer();
		}
	});

	// Return the controller function
	return (start = true) => {
		if (!config.AUTO_PLAY) return;

		clearTimer(timer);
		active.value = start;

		if (start) {
			startAutoPlayTimer();
		}
	};
};
