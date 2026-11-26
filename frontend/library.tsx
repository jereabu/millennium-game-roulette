// Puts a floating "SPIN!" button into Steam's main window while the Library is showing.
// Clicking it opens the slot machine as an overlay that starts spinning right away.

import { useEffect, useRef, useState } from 'react';
import { Machine } from './Machine';
import { useStore } from './store';
import { CSS } from './styles';

const ROOT_ID = 'game-roulette-library-root';

function currentPath(): string | null {
	try {
		return (window as any).MainWindowBrowserManager?.m_lastLocation?.pathname ?? null;
	} catch {
		return null;
	}
}

/** Steam's main desktop window, or null while it's closed to the tray. */
function findMainWindow(): Window | null {
	const w = window as any;
	try {
		const popup = w.g_PopupManager?.GetExistingPopup?.('SP Desktop_uid0');
		const win = popup?.m_popup ?? popup?.window;
		if (win?.document?.body) return win;
	} catch {}
	try {
		const win = w.SteamUIStore?.WindowStore?.SteamUIWindows?.[0]?.BrowserWindow;
		if (win?.document?.body) return win;
	} catch {}
	return null;
}

const Launcher = () => {
	const { state } = useStore();
	const [open, setOpen] = useState(false);
	const [path, setPath] = useState(currentPath());
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const t = setInterval(() => setPath(currentPath()), 700);
		return () => clearInterval(t);
	}, []);

	useEffect(() => {
		if (!open) return;
		const doc = ref.current?.ownerDocument;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') setOpen(false);
		};
		doc?.addEventListener('keydown', onKey);
		return () => doc?.removeEventListener('keydown', onKey);
	}, [open]);

	// Show on every Library page. If Steam doesn't tell us the route, show it anyway.
	const inLibrary = path === null || path.startsWith('/library');

	const s = state.session;
	const left = s ? Math.max(0, s.endsAt - Date.now()) : 0;
	const subtitle = s ? (left === 0 ? "⏰ time's up!" : `⏱ ${Math.floor(left / 60_000)}:${String(Math.floor((left % 60_000) / 1000)).padStart(2, '0')} left`) : 'what should I play?';

	return (
		<div ref={ref}>
			<style>{CSS}</style>
			{inLibrary && !open && (
				<button className="gr-fab" onClick={() => setOpen(true)} title="Game Roulette: spin for a random installed game">
					<span className="gr-ico">🎰</span> SPIN!
					<small>{subtitle}</small>
				</button>
			)}
			{open && (
				<div
					className="gr-overlay"
					onMouseDown={(e) => {
						if (e.target === e.currentTarget) setOpen(false);
					}}
				>
					<Machine autoSpin onClose={() => setOpen(false)} />
				</div>
			)}
		</div>
	);
};

let mountedDoc: Document | null = null;

function ensureMounted() {
	const win = findMainWindow();
	if (!win) return;
	const doc = win.document;
	if (doc === mountedDoc && doc.getElementById(ROOT_ID)) return;

	const ReactDOM = (window as any).SP_REACTDOM;
	const React = (window as any).SP_REACT;
	if (!ReactDOM?.createRoot || !React) {
		console.warn('Game Roulette: React DOM not available yet');
		return;
	}

	doc.getElementById(ROOT_ID)?.remove();
	const container = doc.createElement('div');
	container.id = ROOT_ID;
	doc.body.appendChild(container);
	ReactDOM.createRoot(container).render(React.createElement(Launcher));
	mountedDoc = doc;
	console.log('Game Roulette: library button mounted');
}

/** Keep the button mounted, including after the main window is closed to the tray and reopened. */
export function startLibraryButton() {
	ensureMounted();
	setInterval(() => {
		try {
			ensureMounted();
		} catch (e) {
			console.warn('Game Roulette: could not mount library button', e);
		}
	}, 2000);
}
