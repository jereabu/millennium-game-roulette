// Shared state for every place the roulette is shown (library overlay + Millennium panel).
// Lives in Steam's SharedJSContext and is saved to localStorage.

import { toaster } from 'millennium';
import { useEffect, useState } from 'react';
import { contrasts, formatMinutes, Game, GenreInfo, libraryStats, LibraryStats, PlayLog, recommendSession, SessionPlan, Settings, spin } from './logic';

export interface Pick {
	game: Game;
	info: GenreInfo | null;
	plan: SessionPlan;
}

export interface ActiveSession {
	pick: Pick;
	startedAt: number; // ms
	endsAt: number; // ms
	notified: boolean;
}

export interface Persisted {
	settings: Settings;
	muted: boolean;
	recentPicks: number[];
	excluded: number[];
	genreCache: Record<string, GenreInfo>;
	/** real play sessions measured from Steam's game start/stop events, minutes per appid */
	playLog: PlayLog;
	current: Pick | null;
	next: Pick | null;
	session: ActiveSession | null;
}

const STORAGE_KEY = 'game-roulette:v1';

const defaults: Persisted = {
	settings: { mode: 'balanced', availableMinutes: 0 },
	muted: false,
	recentPicks: [],
	excluded: [],
	genreCache: {},
	playLog: {},
	current: null,
	next: null,
	session: null,
};

function load(): Persisted {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const saved = { ...defaults, ...JSON.parse(raw) };
			// v1 had a "favour my backlog" toggle instead of spin styles.
			if (!saved.settings?.mode) {
				saved.settings = { mode: saved.settings?.backlogBias === false ? 'chaos' : 'balanced', availableMinutes: saved.settings?.availableMinutes ?? 0 };
			}
			saved.playLog = saved.playLog ?? {};
			return saved;
		}
	} catch (e) {
		console.warn('Game Roulette: could not read saved state', e);
	}
	return { ...defaults };
}

export let state: Persisted = load();
let games: Game[] | null = null;
let stats: LibraryStats = libraryStats([], {});
let gamesError: string | null = null;
let loading = false;
const listeners = new Set<() => void>();

export function update(patch: Partial<Persisted>) {
	state = { ...state, ...patch };
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		console.warn('Game Roulette: could not save state', e);
	}
	emit();
}

function emit() {
	listeners.forEach((l) => l());
}

/** Re-renders the calling component whenever the shared state changes. */
export function useStore() {
	const [, force] = useState(0);
	useEffect(() => {
		const l = () => force((n) => n + 1);
		listeners.add(l);
		return () => {
			listeners.delete(l);
		};
	}, []);
	return { state, games: games ?? [], gamesError, loading, stats };
}

export const nowSec = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

interface RawGame {
	appid: number;
	name: string;
	size_on_disk: number;
	last_played: number;
}

/** Millennium may hand back the backend's JSON string already decoded, or as a string. Accept both. */
function fromBackend<T>(value: unknown, fallback: T): T {
	if (value === null || value === undefined || value === '') return fallback;
	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as T;
		} catch {
			return fallback;
		}
	}
	return value as T;
}

export async function loadGames(force = false): Promise<Game[]> {
	if (games && !force) return games;
	loading = true;
	emit();
	try {
		const raw = fromBackend<RawGame[]>(await backend.GetInstalledGames(), []);
		// Steam's saved play history (localconfig.vdf). Used alongside the live library data below,
		// taking whichever is larger, since either can lag behind the other.
		let saved: Record<string, { p: number; p2: number; lp: number }> = {};
		try {
			saved = fromBackend(await backend.GetPlaytimes(), {});
		} catch (e) {
			console.warn('Game Roulette: could not read saved playtime', e);
		}
		const appStore = (window as any).appStore;
		const result: Game[] = [];
		for (const r of raw) {
			let ov: any = null;
			try {
				ov = appStore?.GetAppOverviewByAppID?.(r.appid) ?? null;
			} catch {
				ov = null;
			}
			// app_type 1 = Game. Skips tools, soundtracks, software, etc. when Steam knows the type.
			if (ov && typeof ov.app_type === 'number' && ov.app_type !== 1) continue;
			const sv = saved[String(r.appid)];
			result.push({
				appid: r.appid,
				name: ov?.display_name || r.name,
				size_on_disk: r.size_on_disk,
				last_played: Math.max(ov?.rt_last_time_played || 0, sv?.lp || 0, r.last_played || 0),
				playtime_minutes: Math.max(ov?.minutes_playtime_forever || 0, sv?.p || 0),
				playtime_2weeks: Math.max(ov?.minutes_playtime_last_two_weeks || 0, sv?.p2 || 0),
			});
		}
		games = result;
		stats = libraryStats(result, state.playLog);
		gamesError = null;
		console.log(`Game Roulette: ${result.length} games, ${result.length - stats.neverPlayed} with playtime, ${Math.round(stats.totalMinutes / 60)} h total`);
	} catch (e) {
		console.error('Game Roulette: library scan failed', e);
		gamesError = 'Could not read your Steam library folders.';
		games = [];
	}
	loading = false;
	emit();
	return games;
}

export function eligibleGames(): Game[] {
	return (games ?? []).filter((g) => !state.excluded.includes(g.appid));
}

async function genresFor(appid: number): Promise<GenreInfo | null> {
	const cached = state.genreCache[appid];
	if (cached) return cached;
	try {
		const parsed = fromBackend<{ genres?: string[]; categories?: string[] } | null>(await backend.GetGameGenres(appid), null);
		if (!parsed) return null;
		const info: GenreInfo = { genres: parsed.genres ?? [], categories: parsed.categories ?? [] };
		update({ genreCache: { ...state.genreCache, [appid]: info } });
		return info;
	} catch (e) {
		console.warn('Game Roulette: genre lookup failed', e);
		return null;
	}
}

async function makePick(game: Game): Promise<Pick> {
	const info = await genresFor(game.appid);
	return { game, info, plan: recommendSession(game, info, state.settings, stats, state.playLog, nowSec()) };
}

/** Pick what to play after `current`: weighted roulette, preferring a different genre for variety. */
async function pickNext(current: Pick): Promise<Pick | null> {
	const list = games ?? [];
	const skip = [current.game.appid];
	let fallback: Pick | null = null;
	for (let attempt = 0; attempt < 3; attempt++) {
		const g = spin(list, [...state.recentPicks, current.game.appid], state.excluded, state.settings, stats, state.playLog, nowSec(), skip);
		if (!g) break;
		const p = await makePick(g);
		if (contrasts(current.info, p.info)) return p;
		fallback = fallback ?? p;
		skip.push(g.appid);
	}
	return fallback;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Step 1 of a spin: choose the winner right away so the reel can land on it. */
export function chooseWinner(): Game | null {
	return spin(games ?? [], state.recentPicks, state.excluded, state.settings, stats, state.playLog, nowSec());
}

/** Step 2 of a spin: work out the session plan and the "up next" game, then save them. */
export async function settleWinner(winner: Game): Promise<void> {
	const current = await makePick(winner);
	const next = await pickNext(current);
	update({ current, next });
}

export async function reshuffleNext() {
	if (!state.current) return;
	update({ next: await pickNext(state.current) });
}

export function neverPick(appid: number) {
	update({
		excluded: [...state.excluded, appid],
		current: state.current?.game.appid === appid ? null : state.current,
		next: state.next?.game.appid === appid ? null : state.next,
	});
}

function launch(appid: number) {
	try {
		// 100 = ELaunchSource "library details", the same as pressing Play in the library.
		SteamClient.Apps.RunGame(String(appid), '', -1, 100);
	} catch (e) {
		console.error('Game Roulette: RunGame failed, falling back to steam:// URL', e);
		window.location.href = `steam://rungameid/${appid}`;
	}
}

export function startSession(pick: Pick) {
	launch(pick.game.appid);
	const now = Date.now();
	update({
		session: { pick, startedAt: now, endsAt: now + pick.plan.minutes * 60_000, notified: false },
		recentPicks: [...state.recentPicks, pick.game.appid].slice(-20),
	});
}

export async function playNext() {
	const next = state.next;
	if (!next) return;
	const fresh = await makePick(next.game); // recompute the plan with current settings
	const after = await pickNext(fresh);
	update({ current: fresh, next: after });
	startSession(fresh);
}

export function endSession() {
	update({ session: null });
}

// One timer for the whole plugin: drives countdowns and sends the "time's up" toast,
// even while no roulette UI is open.
setInterval(() => {
	const s = state.session;
	if (!s) return;
	if (!s.notified && Date.now() >= s.endsAt) {
		update({ session: { ...s, notified: true } });
		const next = state.next;
		try {
			toaster.toast({
				title: `🔔 DING DING! Time's up on ${s.pick.game.name}!`,
				body: next ? `${formatMinutes(s.pick.plan.minutes)} well spent. Next contestant: ${next.game.name} 🎰` : `${formatMinutes(s.pick.plan.minutes)} well spent. Go stretch those legs! 🦵`,
				duration: 15_000,
			});
		} catch (e) {
			console.warn('Game Roulette: toast failed', e);
		}
	}
	emit();
}, 1000);

// ---------------------------------------------------------------------------
// Live play tracking: Steam tells us whenever any game starts or stops.
// ---------------------------------------------------------------------------

const runningSince: Record<number, number> = {};

function onAppLifetime(appid: number, running: boolean) {
	if (!appid) return; // non-Steam shortcuts report 0
	const now = Date.now();

	if (running) {
		runningSince[appid] = now;
		// Launched the roulette pick some other way (library, desktop shortcut)? Start its timer anyway.
		const cur = state.current;
		if (!state.session && cur && cur.game.appid === appid) {
			update({
				session: { pick: cur, startedAt: now, endsAt: now + cur.plan.minutes * 60_000, notified: false },
				recentPicks: [...state.recentPicks, appid].slice(-20),
			});
		}
		return;
	}

	const started = runningSince[appid];
	delete runningSince[appid];
	if (started) {
		const minutes = Math.round((now - started) / 60_000);
		if (minutes >= 3) {
			// Remember how long sessions in this game really last (last 20 per game).
			const log = { ...state.playLog, [appid]: [...(state.playLog[appid] ?? []), minutes].slice(-20) };
			update({ playLog: log });
			console.log(`Game Roulette: recorded a ${minutes}-minute session of ${appid}`);
		}
		const s = state.session;
		if (s && s.pick.game.appid === appid) {
			const planned = s.pick.plan.minutes;
			try {
				toaster.toast({
					title: `🎬 That's a wrap on ${s.pick.game.name}!`,
					body: `You played ${formatMinutes(minutes)} (planned ${formatMinutes(planned)}). ${minutes > planned + 10 ? 'Overtime! 😅' : minutes < planned - 10 ? 'Quick one! ⚡' : 'Right on schedule! 🎯'}`,
					duration: 10_000,
				});
			} catch {}
			update({ session: null });
		}
	}

	// Steam updates playtime when a game closes; refresh after it has had a moment.
	setTimeout(() => loadGames(true), 5000);
}

try {
	SteamClient.GameSessions.RegisterForAppLifetimeNotifications((n) => onAppLifetime(n.unAppID, n.bRunning));
} catch (e) {
	console.warn('Game Roulette: cannot watch game sessions', e);
}
