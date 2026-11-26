// All styles for the slot machine. Injected as a <style> tag wherever the machine renders
// (Steam's main window for the library overlay, the Millennium panel otherwise).

export const CSS = `
.gr-machine {
	position: relative; box-sizing: border-box;
	padding: 22px 26px 30px; border-radius: 24px;
	background: radial-gradient(circle at 50% -10%, #a0173f, #3a0718 55%, #14030a);
	border: 4px solid #f5c542;
	box-shadow: 0 0 0 5px #7a4b00, 0 0 50px rgba(255, 190, 60, .55), inset 0 0 50px rgba(0, 0, 0, .65);
	color: #fff; font-family: 'Segoe UI', 'Motiva Sans', sans-serif; overflow: hidden; user-select: none;
}
.gr-machine * { box-sizing: border-box; }
.gr-compact { padding: 22px 12px 16px; border-radius: 18px; }

.gr-bulb {
	position: absolute; width: 10px; height: 10px; border-radius: 50%; transform: translate(-50%, -50%);
	background: #fff1a8; box-shadow: 0 0 8px 3px rgba(255, 215, 90, .95);
	animation: gr-blink .9s steps(1) infinite; z-index: 1;
}
.gr-bulb.gr-odd { animation-delay: .45s; background: #ff9ec0; box-shadow: 0 0 8px 3px rgba(255, 90, 150, .95); }
.gr-spinning .gr-bulb { animation-duration: .25s; }
@keyframes gr-blink { 0% { opacity: 1; } 50% { opacity: .2; } }

.gr-title {
	position: relative; z-index: 2; text-align: center; margin: 0;
	font-family: Impact, 'Arial Black', sans-serif; font-size: 36px; letter-spacing: 2px; line-height: 1.1;
	background: linear-gradient(180deg, #fffbe0 0%, #ffd23f 45%, #e08a00 55%, #ffcf3a 100%);
	-webkit-background-clip: text; background-clip: text; color: transparent;
	-webkit-text-stroke: 1px #6b2b00;
	filter: drop-shadow(0 3px 0 #5a1a00) drop-shadow(0 0 14px rgba(255, 180, 0, .6));
	animation: gr-wobble 2.6s ease-in-out infinite;
}
.gr-compact .gr-title { font-size: 26px; }
@keyframes gr-wobble { 0%, 100% { transform: rotate(-2deg) scale(1); } 50% { transform: rotate(2deg) scale(1.05); } }
.gr-sub { position: relative; z-index: 2; text-align: center; color: #ffd9e6; font-style: italic; font-size: 13px; margin: 2px 0 10px; }

.gr-window {
	position: relative; z-index: 2; margin: 0 auto; border-radius: 12px; overflow: hidden; background: #000;
	border: 6px solid #d8d8d8;
	box-shadow: 0 0 0 3px #555, 0 6px 0 #2a2a2a, 0 0 30px rgba(255, 210, 63, .35);
}
.gr-window::before, .gr-window::after {
	content: ''; position: absolute; left: 0; right: 0; height: 22%; z-index: 3; pointer-events: none;
}
.gr-window::before { top: 0; background: linear-gradient(#000, transparent); }
.gr-window::after { bottom: 0; background: linear-gradient(transparent, #000); }
.gr-arrow { position: absolute; top: 50%; z-index: 4; width: 0; height: 0; transform: translateY(-50%);
	border-top: 14px solid transparent; border-bottom: 14px solid transparent; filter: drop-shadow(0 0 6px #ff2a6d); }
.gr-arrow.gr-l { left: -2px; border-left: 18px solid #ff2a6d; }
.gr-arrow.gr-r { right: -2px; border-right: 18px solid #ff2a6d; }
.gr-strip { will-change: transform; }
.gr-cell { position: relative; overflow: hidden; background: #1b2838; }
.gr-cell img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gr-cell .gr-fallback {
	width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; padding: 8px;
	font-family: Impact, 'Arial Black', sans-serif; font-size: 18px; color: #ffd23f;
	background: repeating-linear-gradient(45deg, #3a0718 0 14px, #520a22 14px 28px);
}
.gr-q {
	width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
	font-family: Impact, 'Arial Black', sans-serif; font-size: 70px; color: #ffd23f; text-shadow: 0 0 22px #ffea00;
	background: repeating-linear-gradient(45deg, #2a0512 0 16px, #3f0a1d 16px 32px);
	animation: gr-pulse 1.2s ease-in-out infinite;
}
@keyframes gr-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }

.gr-msg {
	position: relative; z-index: 2; text-align: center; min-height: 26px; margin: 14px 0 6px;
	font-weight: 800; font-size: 17px; color: #fff3a0; text-shadow: 0 0 10px #ff4f8b;
}

.gr-btn {
	font-family: Impact, 'Arial Black', sans-serif; font-size: 18px; letter-spacing: 1px; line-height: 1.1;
	padding: 11px 18px; border-radius: 14px; border: none; cursor: pointer; color: #fff;
	text-shadow: 0 2px 0 rgba(0, 0, 0, .35);
	box-shadow: 0 6px 0 var(--gr-sh), 0 9px 16px rgba(0, 0, 0, .5);
	transition: transform .08s, box-shadow .08s, filter .15s;
}
.gr-btn:hover { filter: brightness(1.15) saturate(1.1); }
.gr-btn:active { transform: translateY(5px); box-shadow: 0 1px 0 var(--gr-sh), 0 3px 6px rgba(0, 0, 0, .5); }
.gr-btn:disabled { opacity: .55; cursor: default; filter: grayscale(.4); }
.gr-red { background: linear-gradient(#ff5c7a, #d90429); --gr-sh: #7d0016; }
.gr-green { background: linear-gradient(#6dff98, #12b347); --gr-sh: #0b6b2a; }
.gr-gold { background: linear-gradient(#fff08a, #f5a400); --gr-sh: #8a5a00; color: #4a2500; text-shadow: 0 1px 0 rgba(255, 255, 255, .5); }
.gr-gray { background: linear-gradient(#9aa5b8, #5c677d); --gr-sh: #2b2f3a; }
.gr-big { font-size: 24px; padding: 12px 22px; width: 100%; }
.gr-compact .gr-big { font-size: 22px; }
.gr-small { font-size: 14px; padding: 7px 12px; border-radius: 10px; box-shadow: 0 4px 0 var(--gr-sh), 0 6px 10px rgba(0, 0, 0, .4); }

.gr-row { position: relative; z-index: 2; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
.gr-row > .gr-btn { flex: 1 1 auto; }
.gr-compact .gr-row { flex-direction: column; }

.gr-result { position: relative; z-index: 2; text-align: center; }
.gr-jackpot {
	font-family: Impact, 'Arial Black', sans-serif; font-size: 36px; color: #fff; margin-top: 6px;
	text-shadow: 0 0 10px #ff0, 0 0 22px #f0f, 0 4px 0 #b3005a;
	animation: gr-pop .6s cubic-bezier(.2, 2, .4, 1) both, gr-rainbow 1.4s linear infinite;
}
.gr-compact .gr-jackpot { font-size: 30px; }
@keyframes gr-pop { from { transform: scale(0) rotate(-25deg); } to { transform: scale(1) rotate(0); } }
@keyframes gr-rainbow { from { filter: hue-rotate(0deg); } to { filter: hue-rotate(360deg); } }
.gr-kicker { color: #ffc6d9; font-size: 13px; text-transform: uppercase; letter-spacing: 3px; margin-top: 4px; }
.gr-game { font-size: 26px; font-weight: 900; margin: 2px 0 4px; text-shadow: 0 3px 0 #5a0a26; }
.gr-compact .gr-game { font-size: 19px; }
.gr-meta { color: #ffc6d9; font-size: 13px; }
.gr-dose {
	display: inline-block; margin-top: 8px; padding: 6px 16px; border-radius: 999px; background: #0d0d0d;
	border: 3px solid #ffd23f; box-shadow: 0 0 16px rgba(255, 210, 63, .6);
	font-family: Impact, 'Arial Black', sans-serif; font-size: 22px; color: #ffd23f; letter-spacing: 1px;
}
.gr-compact .gr-dose { font-size: 17px; }
.gr-bubble {
	position: relative; margin: 12px auto 0; max-width: 520px; text-align: left;
	background: #fff; color: #1d1d1d; border-radius: 16px; padding: 10px 14px; font-size: 13px; line-height: 1.4;
	box-shadow: 0 4px 0 #c9c9c9;
}
.gr-bubble::before {
	content: ''; position: absolute; top: -12px; left: 26px; border: 12px solid transparent; border-top: 0; border-bottom-color: #fff;
}
.gr-bubble b { color: #c9184a; }

.gr-next {
	position: relative; z-index: 2; display: flex; gap: 12px; align-items: center; margin-top: 12px; padding: 8px 10px;
	border-radius: 14px; background: rgba(255, 255, 255, .07); border: 2px dashed rgba(255, 210, 63, .65);
}
.gr-next img, .gr-next .gr-next-ph { width: 128px; height: 60px; border-radius: 8px; object-fit: cover; flex-shrink: 0; background: #1b2838; }
.gr-next-info { flex: 1; min-width: 0; text-align: left; }
.gr-next-label { font-family: Impact, 'Arial Black', sans-serif; color: #ffd23f; font-size: 15px; letter-spacing: 1px; }
.gr-next-name { font-weight: 800; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-compact .gr-next { flex-direction: column; align-items: stretch; }
.gr-compact .gr-next img, .gr-compact .gr-next .gr-next-ph { width: 100%; height: auto; aspect-ratio: 460 / 215; }

.gr-timer { position: relative; z-index: 2; margin-bottom: 14px; padding: 10px 12px; border-radius: 14px; background: #0d0d0d; border: 2px solid #ff4d6d; }
.gr-timer-top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.gr-timer-name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gr-timer-clock { font-family: Impact, 'Arial Black', sans-serif; font-size: 26px; color: #ffd23f; }
.gr-timebar { height: 12px; border-radius: 6px; background: #333; overflow: hidden; margin-top: 6px; }
.gr-timebar > div {
	height: 100%; transition: width 1s linear;
	background: repeating-linear-gradient(45deg, #ff2a6d 0 10px, #ff8fab 10px 20px); background-size: 28px 28px;
	animation: gr-candy 1s linear infinite;
}
.gr-timer.gr-done { border-color: #6dff98; animation: gr-shake .5s ease-in-out infinite alternate; }
.gr-timer.gr-done .gr-timebar > div { background: repeating-linear-gradient(45deg, #12b347 0 10px, #6dff98 10px 20px); }
@keyframes gr-candy { from { background-position: 0 0; } to { background-position: 28px 0; } }
@keyframes gr-shake { from { transform: rotate(-1deg); } to { transform: rotate(1deg); } }

.gr-settings {
	position: relative; z-index: 2; display: flex; gap: 10px 16px; flex-wrap: wrap; align-items: center; justify-content: center;
	margin-top: 12px; padding-top: 10px; border-top: 2px dotted rgba(255, 255, 255, .22); font-size: 13px; color: #ffd9e6;
}
.gr-settings label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.gr-settings input[type=checkbox] { width: 16px; height: 16px; accent-color: #ff2a6d; }
.gr-settings select {
	background: #200410; color: #fff; border: 2px solid #ffd23f; border-radius: 8px; padding: 3px 6px; font-size: 13px;
}
.gr-link { background: none; border: none; color: #ffd23f; text-decoration: underline; cursor: pointer; font-size: 13px; padding: 0; }
.gr-why {
	display: inline-block; margin-top: 8px; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 700;
	background: linear-gradient(90deg, #ff2a6d, #f72585, #7209b7); box-shadow: 0 0 12px rgba(247, 37, 133, .6);
}
.gr-stats {
	position: relative; z-index: 2; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-top: 10px;
}
.gr-stats span {
	font-size: 12px; padding: 3px 9px; border-radius: 999px; background: rgba(0, 0, 0, .35); border: 1px solid rgba(255, 210, 63, .45); color: #ffe9a8;
}
.gr-foot { position: relative; z-index: 2; text-align: center; color: rgba(255, 217, 230, .7); font-size: 12px; margin-top: 8px; }

.gr-confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 20; }
.gr-confetti i { position: absolute; top: -24px; display: block; border-radius: 2px; animation: gr-fall linear forwards; }
@keyframes gr-fall {
	0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 1; }
	85% { opacity: 1; }
	100% { transform: translate3d(var(--gr-dx), 900px, 0) rotate(900deg); opacity: 0; }
}

.gr-overlay {
	position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center;
	background: radial-gradient(ellipse at center, rgba(70, 0, 35, .78), rgba(0, 0, 0, .93));
	animation: gr-fade .2s ease-out;
}
.gr-overlay .gr-machine { width: min(600px, 94vw); max-height: 94vh; overflow-y: auto; animation: gr-drop .45s cubic-bezier(.2, 1.6, .4, 1); }
@keyframes gr-fade { from { opacity: 0; } }
@keyframes gr-drop { from { transform: translateY(-60px) scale(.85); opacity: 0; } }
.gr-close {
	position: absolute; top: 12px; right: 14px; z-index: 30; width: 36px; height: 36px; border-radius: 50%;
	background: rgba(0, 0, 0, .6); border: 2px solid #ffd23f; color: #ffd23f; font-weight: 900; font-size: 16px; cursor: pointer;
}
.gr-close:hover { background: #ffd23f; color: #3a0718; }

.gr-fab {
	position: fixed; right: 28px; bottom: 72px; z-index: 99998; cursor: pointer; text-align: center;
	font-family: Impact, 'Arial Black', sans-serif; font-size: 22px; letter-spacing: 1px; color: #fff;
	padding: 12px 22px 10px; border-radius: 999px; border: 3px solid #ffd23f;
	background: radial-gradient(circle at 30% 25%, #ff7d9a, #c9184a 55%, #800f2f);
	box-shadow: 0 0 0 4px #7a4b00, 0 0 26px rgba(255, 70, 120, .85), 0 8px 0 #4a0418;
	text-shadow: 0 2px 0 #5a0a26; animation: gr-bob 1.8s ease-in-out infinite;
}
.gr-fab:hover { animation: gr-jiggle .35s ease-in-out infinite; filter: brightness(1.12); }
.gr-fab small { display: block; font-family: 'Segoe UI', sans-serif; font-size: 11px; letter-spacing: 0; font-weight: 700; color: #ffe3ec; text-shadow: none; }
.gr-fab .gr-ico { display: inline-block; animation: gr-rot 2.5s linear infinite; }
@keyframes gr-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
@keyframes gr-jiggle { 0%, 100% { transform: rotate(-4deg) scale(1.08); } 50% { transform: rotate(4deg) scale(1.08); } }
@keyframes gr-rot { to { transform: rotate(360deg); } }
`;
