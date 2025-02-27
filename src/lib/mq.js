export function mq(defaultValue, sm, md, lg) {
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
