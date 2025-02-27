import { derived, effect, state } from "./lib/signals.js";
import "./style.css";

const btn = document.querySelector("#btn");

btn.addEventListener("click", () => {
	count.value++;
});

let count = state(0);
let double = derived(() => count.value * 2);

effect(() => {
	btn.innerText = count.value;
});

effect(() => {
	if (count.value > 10) {
		console.log("dangerously high!");
		count.value = 0;
	}
});
