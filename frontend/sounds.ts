// Cheesy casino sounds, synthesised with WebAudio so the plugin ships no audio files.

import { state } from './store';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
	if (state.muted) return null;
	try {
		ctx = ctx ?? new AudioContext();
		if (ctx.state === 'suspended') ctx.resume();
		return ctx;
	} catch {
		return null;
	}
}

function beep(freq: number, start: number, duration: number, type: OscillatorType = 'square', volume = 0.08) {
	const a = audio();
	if (!a) return;
	const t = a.currentTime + start;
	const osc = a.createOscillator();
	const gain = a.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, t);
	gain.gain.setValueAtTime(volume, t);
	gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
	osc.connect(gain).connect(a.destination);
	osc.start(t);
	osc.stop(t + duration + 0.02);
}

/** A reel tick. Pitch wobbles a little so a fast spin sounds like a clattering wheel. */
export function tick() {
	beep(900 + Math.random() * 300, 0, 0.035, 'square', 0.05);
}

/** Lever pull: a descending "clunk". */
export function lever() {
	const a = audio();
	if (!a) return;
	const t = a.currentTime;
	const osc = a.createOscillator();
	const gain = a.createGain();
	osc.type = 'sawtooth';
	osc.frequency.setValueAtTime(220, t);
	osc.frequency.exponentialRampToValueAtTime(60, t + 0.25);
	gain.gain.setValueAtTime(0.12, t);
	gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
	osc.connect(gain).connect(a.destination);
	osc.start(t);
	osc.stop(t + 0.32);
}

/** Jackpot fanfare: a bright arpeggio, then a ding-ding-ding. */
export function jackpot() {
	const notes = [523.25, 659.25, 783.99, 1046.5];
	notes.forEach((f, i) => beep(f, i * 0.09, 0.18, 'triangle', 0.12));
	beep(1046.5, 0.4, 0.5, 'triangle', 0.1);
	beep(1318.5, 0.4, 0.5, 'sine', 0.06);
	[0, 1, 2].forEach((i) => beep(1975.5, 0.95 + i * 0.14, 0.12, 'sine', 0.08));
}

/** Little "boop" for small buttons. */
export function boop() {
	beep(440, 0, 0.06, 'sine', 0.06);
	beep(660, 0.05, 0.08, 'sine', 0.05);
}
