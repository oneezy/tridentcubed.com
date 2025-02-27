// 1. Formats a number with appropriate notation (atom_1)
const formatNumber = (num) => {
	return new Intl.NumberFormat("en-US", { notation: "compact" }).format(num);
};

// 2. Applies an easing function that starts slow and gets faster (atom_2)
const easeInQuad = (t) => {
	return t * t;
};

// 3. More aggressive easing - starts very slow and accelerates quickly (atom_3)
const easeInCubic = (t) => {
	return t * t * t;
};

// 4. Customizable easing power for fine-tuning acceleration (atom_4)
const easeInPower = (t, power = 2) => {
	return Math.pow(t, power);
};

// 5. Easing that slows down at the end (atom_5)
const easeOutQuad = (t) => {
	return t * (2 - t);
};

// 6. Easing that slows down more dramatically at the end (atom_6)
const easeOutCubic = (t) => {
	return 1 - Math.pow(1 - t, 3);
};

// 7. Easing that starts slow, speeds up in the middle, and slows down at the end (atom_7)
const easeInOutQuad = (t) => {
	return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

// 8. More pronounced slow-fast-slow easing (atom_8)
const easeInOutCubic = (t) => {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// 9. Customizable slow-fast-slow easing (atom_9)
const easeInOutPower = (t, power = 3) => {
	if (t < 0.5) {
		return Math.pow(2 * t, power) / 2;
	} else {
		return 1 - Math.pow(-2 * t + 2, power) / 2;
	}
};

// 10. Combines multiple easing functions for precise control (atom_10)
const createCompositeEasing = (easingFunctions, weights) => {
	return (t) => {
		let result = 0;
		const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

		for (let i = 0; i < easingFunctions.length; i++) {
			result += (easingFunctions[i](t) * weights[i]) / totalWeight;
		}

		return result;
	};
};

// 11. Animate counter with customizable easing (molecule_1)
const animateCounter = (
	element,
	start = 0,
	end,
	duration = 2000,
	easingFn = easeInOutCubic,
) => {
	let startTime = null;
	const finalThreshold = 0.85; // Show final number when 85% complete

	const step = (timestamp) => {
		if (!startTime) startTime = timestamp;
		const linearProgress = Math.min((timestamp - startTime) / duration, 1);

		// Show the final number sooner to avoid waiting at the end
		if (linearProgress > finalThreshold) {
			// Display final value immediately once we cross the threshold
			element.textContent = formatNumber(end);
			return;
		}

		// Adjust progress to complete within the threshold to avoid slow ending
		const adjustedLinearProgress = linearProgress / finalThreshold;

		// Apply easing function
		const easedProgress = easingFn(adjustedLinearProgress);

		// Calculate current value based on eased progress
		element.textContent = formatNumber(
			Math.floor(easedProgress * (end - start) + start),
		);

		if (linearProgress < 1) {
			requestAnimationFrame(step);
		}
	};

	requestAnimationFrame(step);
};

// 12. Creates predefined easing functions for common scenarios (molecule_2)
const createEasing = (type = "inOutCubic", power = 3) => {
	switch (type) {
		case "in":
			return (t) => easeInPower(t, power);
		case "out":
			return (t) => 1 - easeInPower(1 - t, power);
		case "inOut":
			return (t) => easeInOutPower(t, power);
		case "slowStartFastMiddleSlow":
			// Custom easing that emphasizes slow start and end
			return createCompositeEasing(
				[easeInOutCubic, easeInOutPower],
				[0.7, 0.3],
			);
		case "dramaticAccelDecel":
			// Extreme slow-fast-slow
			return (t) => easeInOutPower(t, 5);
		default:
			return easeInOutCubic;
	}
};

// 13. Advances counter to near completion fast, then holds final value (atom_11)
const createProgressThresholds = (
	thresholds = { early: 0.85, display: 0.95 },
) => {
	return thresholds;
};

// 14. Ensures counter values always increase and never jump backward (atom_12)
const ensureMonotonicProgress = (lastValue, newValue, finalValue) => {
	// Ensure we never go backwards or exceed the final value
	return Math.min(Math.max(lastValue, newValue), finalValue);
};

// 15. Custom step algorithm with smooth progression to final value (molecule_3)
const createSmoothAnimationStep = (
	element,
	start,
	end,
	duration,
	easingFn,
	thresholds = { early: 0.85, display: 0.95 },
) => {
	let startTime = null;
	let lastValue = start; // Track the last value to prevent backward jumps

	return function step(timestamp) {
		if (!startTime) startTime = timestamp;
		const linearProgress = Math.min((timestamp - startTime) / duration, 1);

		let currentValue;

		// Handle the final stages differently
		if (linearProgress >= thresholds.display) {
			// Just display the final value
			currentValue = end;
			element.textContent = formatNumber(currentValue);
			return;
		} else if (linearProgress >= thresholds.early) {
			// Near the end - smoothly approach the final value
			// Calculate how close we should be to the final value (0-1)
			const remainingFraction = (linearProgress - thresholds.early) /
				(thresholds.display - thresholds.early);

			// Use a smoother curve for the final approach
			const smoothApproach = easeOutCubic(remainingFraction);

			// Determine the gap between where we were at early threshold and the end
			const valueAtEarlyThreshold = Math.floor(
				easeInOutCubic(thresholds.early) * (end - start) + start,
			);
			const gap = end - valueAtEarlyThreshold;

			// Calculate the current value, ensuring it's always increasing
			currentValue = Math.floor(valueAtEarlyThreshold + (gap * smoothApproach));
		} else {
			// Normal animation for most of the duration
			const easedProgress = easingFn(linearProgress);
			currentValue = Math.floor(easedProgress * (end - start) + start);
		}

		// Ensure the counter never jumps backward
		currentValue = ensureMonotonicProgress(lastValue, currentValue, end);
		lastValue = currentValue;

		element.textContent = formatNumber(currentValue);

		if (linearProgress < 1) {
			requestAnimationFrame(step);
		}
	};
};

// 16. Enhanced counter animation with smooth progression (molecule_4)
const smoothAnimateCounter = (
	element,
	start = 0,
	end,
	duration = 2000,
	easingFn = easeInOutCubic,
	thresholds = { early: 0.85, display: 0.95 },
) => {
	const step = createSmoothAnimationStep(
		element,
		start,
		end,
		duration,
		easingFn,
		thresholds,
	);
	requestAnimationFrame(step);
};

// 17. Creates all counter animations using IntersectionObserver (organism_1)
export const counter = (options = {}) => {
	const {
		selector = ".stat-counter",
		threshold = 0.5,
		duration = 3000,
		easingType = "inOut", // 'in', 'out', 'inOut', 'slowStartFastMiddleSlow', 'dramaticAccelDecel'
		easingPower = 3,
		finalValueThreshold = 0.75, // Start approaching final value at 75% completion
		displayFinalValueThreshold = 0.97, // Display exact final value at 97% completion
	} = options;

	const counters = document.querySelectorAll(selector);

	// Create the easing function based on the provided options
	const easingFn = createEasing(easingType, easingPower);

	// Create animation thresholds
	const animationThresholds = createProgressThresholds({
		early: finalValueThreshold,
		display: displayFinalValueThreshold,
	});

	const observer = new IntersectionObserver((entries, observer) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				const target = parseInt(entry.target.getAttribute("data-target"), 10);
				smoothAnimateCounter(
					entry.target,
					0,
					target,
					duration,
					easingFn,
					animationThresholds,
				);
				observer.unobserve(entry.target); // Stop observing after animation starts
			}
		});
	}, { threshold });

	counters.forEach((counter) => observer.observe(counter));

	// Return a way to manually trigger animations
	return {
		triggerAll: () => {
			counters.forEach((counterEl) => {
				const target = parseInt(counterEl.getAttribute("data-target"), 10);
				smoothAnimateCounter(
					counterEl,
					0,
					target,
					duration,
					easingFn,
					animationThresholds,
				);
			});
		},
		triggerOne: (selector) => {
			const counterEl = document.querySelector(selector);
			if (counterEl) {
				const target = parseInt(counterEl.getAttribute("data-target"), 10);
				smoothAnimateCounter(
					counterEl,
					0,
					target,
					duration,
					easingFn,
					animationThresholds,
				);
			}
		},
	};
};
