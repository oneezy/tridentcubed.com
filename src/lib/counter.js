const formatNumber = (num) => {
	return new Intl.NumberFormat("en-US", { notation: "compact" }).format(num);
};

const animateCounter = (element, start = 0, end, duration = 3000) => {
	let startTime = null;
	const step = (timestamp) => {
		if (!startTime) startTime = timestamp;
		const progress = Math.min((timestamp - startTime) / duration, 1);
		element.textContent = formatNumber(
			Math.floor(progress * (end - start) + start),
		);
		if (progress < 1) {
			requestAnimationFrame(step);
		}
	};
	requestAnimationFrame(step);
};

export const counter = () => {
	const counters = document.querySelectorAll(".stat-counter");
	const observer = new IntersectionObserver((entries, observer) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) {
				const target = parseInt(entry.target.getAttribute("data-target"), 10);
				animateCounter(entry.target, 0, target);
				observer.unobserve(entry.target); // Stop observing after animation starts
			}
		});
	}, { threshold: 0.5 });

	counters.forEach((counter) => observer.observe(counter));
};
