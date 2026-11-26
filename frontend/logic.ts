// Pure roulette logic: no Steam or React APIs in here.

export interface Game {
	appid: number;
	name: string;
	size_on_disk: number;
	/** unix seconds, 0 = never */
	last_played: number;
	playtime_minutes: number;
	playtime_2weeks: number;
}

export interface GenreInfo {
	genres: string[];
	categories: string[];
}

export type SpinMode = 'balanced' | 'backlog' | 'comfort' | 'rediscover' | 'hot' | 'chaos';

export const SPIN_MODES: { v: SpinMode; label: string; blurb: string }[] = [
	{ v: 'balanced', label: '⚖️ Balanced', blurb: 'A bit of everything, tilted toward stuff you haven\'t touched lately' },
	{ v: 'backlog', label: '🧟 Backlog buster', blurb: 'Unplayed and barely-played games' },
	{ v: 'comfort', label: '🛋️ Comfort food', blurb: 'Your most-played favourites' },
	{ v: 'rediscover', label: '🔍 Rediscover', blurb: 'Games you sank time into and then abandoned' },
	{ v: 'hot', label: '🔥 Hot streak', blurb: 'What you\'ve been playing the last couple of weeks' },
	{ v: 'chaos', label: '🌪️ Pure chaos', blurb: 'Every game has the same odds' },
];

export interface Settings {
	mode: SpinMode;
	/** how long the player has right now; 0 = no limit */
	availableMinutes: number;
}

/** Real play sessions the plugin has measured, in minutes, newest last. */
export type PlayLog = Record<string, number[]>;

export interface LibraryStats {
	games: number;
	totalMinutes: number;
	neverPlayed: number;
	/** playtime of the 90th-percentile played game; used to scale "favourites" */
	p90Minutes: number;
	/** median of every measured session across all games, or 0 if too few */
	usualSession: number;
	sessionsMeasured: number;
}

export interface SessionPlan {
	minutes: number;
	reason: string;
	breakTip?: string;
}

/** Typical comfortable session length per Steam store genre, in minutes. */
const GENRE_MINUTES: Record<string, number> = {
	'Massively Multiplayer': 120,
	RPG: 90,
	Strategy: 90,
	Simulation: 75,
	Adventure: 60,
	Action: 60,
	Sports: 45,
	Racing: 40,
	Casual: 30,
};

const DEFAULT_MINUTES = 60;
const COMPETITIVE_CATEGORIES = ['Online PvP', 'PvP'];
const DAY = 86400;

const median = (xs: number[]) => {
	if (!xs.length) return 0;
	const s = [...xs].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const daysSince = (g: Game, nowSec: number) => (g.last_played > 0 ? (nowSec - g.last_played) / DAY : Infinity);

export function libraryStats(games: Game[], log: PlayLog): LibraryStats {
	const played = games.filter((g) => g.playtime_minutes > 0).map((g) => g.playtime_minutes).sort((a, b) => a - b);
	const all = Object.values(log).flat();
	return {
		games: games.length,
		totalMinutes: games.reduce((s, g) => s + g.playtime_minutes, 0),
		neverPlayed: games.length - played.length,
		p90Minutes: played.length ? played[Math.min(played.length - 1, Math.floor(played.length * 0.9))] : 600,
		usualSession: all.length >= 3 ? median(all) : 0,
		sessionsMeasured: all.length,
	};
}

/** The player's own typical session in this game, if the plugin has measured at least two. */
export function personalSession(game: Game, log: PlayLog): number {
	const xs = log[game.appid] ?? [];
	return xs.length >= 2 ? median(xs.slice(-10)) : 0;
}

/** How strongly this game fits the chosen spin style, based on its playtime history. */
function modeWeight(g: Game, mode: SpinMode, stats: LibraryStats, nowSec: number): number {
	const hours = g.playtime_minutes / 60;
	const days = daysSince(g, nowSec);
	const fav = Math.min(1, g.playtime_minutes / Math.max(60, stats.p90Minutes)); // 0..1 "how much of a favourite"

	switch (mode) {
		case 'chaos':
			return 1;
		case 'backlog':
			if (g.playtime_minutes === 0) return 5;
			if (g.playtime_minutes < 60) return 3.5;
			if (hours < 5) return 1.5;
			return 0.4 / (1 + hours / 50);
		case 'comfort':
			if (g.playtime_minutes === 0) return 0.05;
			return 0.2 + 4 * fav;
		case 'rediscover':
			if (hours < 2) return 0.1;
			if (days < 30) return 0.15;
			return Math.min(5, 0.5 + days / 60) * (0.5 + fav);
		case 'hot':
			if (g.playtime_2weeks > 0) return 2 + Math.min(4, g.playtime_2weeks / 120);
			if (days < 14) return 1.5;
			return 0.1;
		case 'balanced':
		default: {
			let w = 1;
			if (g.playtime_minutes === 0) w = 2.2;
			else if (days > 60) w = 1.4 + 0.6 * fav; // a dusty game you clearly liked
			else if (g.playtime_2weeks > 0) w = 1.3;
			return w;
		}
	}
}

export function weightFor(game: Game, recentPicks: number[], excluded: number[], settings: Settings, stats: LibraryStats, log: PlayLog, nowSec: number): number {
	if (excluded.includes(game.appid)) return 0;

	let w = modeWeight(game, settings.mode, stats, nowSec);

	// Played in the last few hours: give something else a turn (except when chasing a hot streak).
	if (settings.mode !== 'hot' && settings.mode !== 'chaos' && game.last_played > 0 && nowSec - game.last_played < DAY / 2) w *= 0.3;

	// Fit the time slot: if your usual session in this game is far longer than the time you have, it's less likely.
	const usual = personalSession(game, log);
	if (settings.availableMinutes > 0 && usual > 0) {
		if (usual > settings.availableMinutes * 1.5) w *= 0.4;
		else if (usual <= settings.availableMinutes) w *= 1.3;
	}

	if (recentPicks.slice(-5).includes(game.appid)) w *= 0.1;

	return w;
}

/** Weighted random pick. Returns null when nothing is eligible. */
export function spin(
	games: Game[],
	recentPicks: number[],
	excluded: number[],
	settings: Settings,
	stats: LibraryStats,
	log: PlayLog,
	nowSec: number,
	skip: number[] = [],
	rand: () => number = Math.random,
): Game | null {
	const pool = games
		.filter((g) => !skip.includes(g.appid))
		.map((g) => ({ g, w: weightFor(g, recentPicks, excluded, settings, stats, log, nowSec) }))
		.filter((e) => e.w > 0);
	if (pool.length === 0) return null;

	const total = pool.reduce((s, e) => s + e.w, 0);
	let r = rand() * total;
	for (const e of pool) {
		r -= e.w;
		if (r <= 0) return e.g;
	}
	return pool[pool.length - 1].g;
}

export function formatAgo(lastPlayed: number, nowSec: number): string {
	if (!lastPlayed) return 'never';
	const d = (nowSec - lastPlayed) / DAY;
	if (d < 1) return 'today';
	if (d < 2) return 'yesterday';
	if (d < 30) return `${Math.floor(d)} days ago`;
	if (d < 365) return `${Math.floor(d / 30)} month${d >= 60 ? 's' : ''} ago`;
	const y = Math.floor(d / 365);
	return `${y} year${y > 1 ? 's' : ''} ago`;
}

/** One cheesy line on why the wheel landed here, from the game's playtime history. */
export function whyThisOne(g: Game, stats: LibraryStats, nowSec: number): string {
	const days = daysSince(g, nowSec);
	const hours = g.playtime_minutes / 60;
	if (g.playtime_minutes === 0) return `Fresh out of the backlog: you've never launched it!`;
	if (g.playtime_2weeks > 0) return `You're on a roll: ${formatHours(g.playtime_2weeks)} in the last two weeks.`;
	if (g.playtime_minutes >= stats.p90Minutes && stats.p90Minutes > 0) return `An all-time favourite: ${formatHours(g.playtime_minutes)} logged.`;
	if (hours >= 2 && days > 90) return `Welcome back! ${formatHours(g.playtime_minutes)} in, last played ${formatAgo(g.last_played, nowSec)}.`;
	if (g.playtime_minutes < 120) return `Barely scratched: only ${formatHours(g.playtime_minutes)} so far.`;
	return `${formatHours(g.playtime_minutes)} played, last time ${formatAgo(g.last_played, nowSec)}.`;
}

export function recommendSession(game: Game, info: GenreInfo | null, settings: Settings, stats: LibraryStats, log: PlayLog, nowSec: number): SessionPlan {
	const genres = info?.genres ?? [];
	const categories = info?.categories ?? [];
	const days = daysSince(game, nowSec);
	const mine = personalSession(game, log);
	const measured = (log[game.appid] ?? []).length;

	let minutes: number;
	let reason: string;

	if (mine > 0) {
		// Best signal: how long you actually play this game.
		minutes = mine;
		reason = `You usually play this for about ${formatMinutes(Math.round(mine))} (from your last ${Math.min(measured, 10)} sessions)`;
	} else {
		const known = genres.filter((g) => g in GENRE_MINUTES);
		const genreMinutes = known.length ? Math.max(...known.map((g) => GENRE_MINUTES[g])) : DEFAULT_MINUTES;
		minutes = genreMinutes;
		reason = known.length ? `${known.join(' / ')} games usually need about ${genreMinutes} minutes to get into` : 'A standard session';

		const competitive = categories.some((c) => COMPETITIVE_CATEGORIES.includes(c)) && !genres.includes('Massively Multiplayer');
		if (competitive) {
			minutes = Math.min(minutes, 60);
			reason = 'Competitive multiplayer: a few matches is enough';
		}

		// Lean toward the player's own habits once we've seen a few sessions.
		if (stats.usualSession > 0) {
			minutes = (minutes + stats.usualSession) / 2;
			reason += `, nudged toward your usual ${formatMinutes(Math.round(stats.usualSession))} sessions`;
		}

		if (game.playtime_minutes === 0) {
			minutes = Math.max(30, minutes * 0.75);
			reason = `You've never played it: give it a first look and see if it clicks`;
		} else if (game.playtime_2weeks >= 300) {
			minutes += 15;
			reason += `. You've played ${formatHours(game.playtime_2weeks)} in two weeks, so you're clearly hooked`;
		} else if (game.playtime_2weeks > 0) {
			reason += `. You're mid-run, so pick up where you left off`;
		} else if (days > 180) {
			minutes += 15;
			reason += `. Extra time to re-learn the controls after ${formatAgo(game.last_played, nowSec).replace(' ago', '')} away`;
		}
	}

	if (settings.availableMinutes > 0 && minutes > settings.availableMinutes) {
		minutes = settings.availableMinutes;
		reason += ` (trimmed to the time you have)`;
	}

	minutes = Math.max(15, Math.round(minutes / (minutes >= 60 ? 15 : 5)) * (minutes >= 60 ? 15 : 5));

	const plan: SessionPlan = { minutes, reason };
	if (minutes >= 90) plan.breakTip = `Take a 10-minute break around the ${Math.round(minutes / 30) * 15}-minute mark.`;
	return plan;
}

/** True when two games share no "real" genre, so playing one after the other feels different. */
export function contrasts(a: GenreInfo | null, b: GenreInfo | null): boolean {
	if (!a || !b) return true;
	const ga = a.genres.filter((g) => g in GENRE_MINUTES);
	const gb = b.genres.filter((g) => g in GENRE_MINUTES);
	if (!ga.length || !gb.length) return true;
	return !ga.some((g) => gb.includes(g));
}

export function formatMinutes(m: number): string {
	if (m < 60) return `${m} min`;
	const h = Math.floor(m / 60);
	const r = m % 60;
	return r ? `${h} h ${r} min` : `${h} h`;
}

export function formatHours(m: number): string {
	if (m < 60) return `${m} min`;
	return `${(m / 60).toFixed(m < 600 ? 1 : 0)} h`;
}

export function formatPlaytime(m: number): string {
	if (m === 0) return 'Never played';
	return `${formatHours(m)} played`;
}
