// The slot machine itself. Used full-size in the library overlay and compact in the Millennium panel.

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatAgo, formatHours, formatMinutes, formatPlaytime, Game, SPIN_MODES, SpinMode, whyThisOne } from './logic';
import { boop, jackpot, lever, tick } from './sounds';
import { ActiveSession, chooseWinner, eligibleGames, endSession, loadGames, neverPick, nowSec, playNext, reshuffleNext, settleWinner, startSession, update, useStore } from './store';
import { CSS } from './styles';

const SPIN_MS = 4200;
const REEL_LENGTH = 30;

const SPIN_LINES = [
	'🎲 Shuffling the backlog...',
	'🔮 Consulting the gaming gods...',
	'💸 Bribing the RNG...',
	'🥁 Drumroll, please...',
	'🌀 Round and round it goes...',
	'🤞 Fingers crossed...',
	'🐹 Feeding the hamster that powers this wheel...',
];

const IDLE_LINES = ['Step right up! Step right up!', 'Every spin a winner!*', 'Your backlog called. It misses you.', 'No refunds. No regrets.'];

const TIME_OPTIONS = [
	{ v: 0, label: 'all night 🌙' },
	{ v: 30, label: '30 min' },
	{ v: 60, label: '1 hour' },
	{ v: 90, label: '1.5 hours' },
	{ v: 120, label: '2 hours' },
	{ v: 180, label: '3 hours' },
];

const CONFETTI_COLORS = ['#ffd23f', '#ff2a6d', '#6dff98', '#4cc9f0', '#f72585', '#ffffff', '#ff9f1c'];

const coverUrl = (appid: number) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;

const Cover = ({ game }: { game: Game }) => {
	const [failed, setFailed] = useState(false);
	if (failed) return <div className="gr-fallback">{game.name}</div>;
	return <img src={coverUrl(game.appid)} onError={() => setFailed(true)} draggable={false} />;
};

const Bulbs = () => {
	const bulbs: { left: string; top: string }[] = [];
	const across = 14;
	const down = 9;
	for (let i = 0; i < across; i++) {
		const left = `${((i + 0.5) / across) * 100}%`;
		bulbs.push({ left, top: '9px' }, { left, top: 'calc(100% - 9px)' });
	}
	for (let i = 1; i < down - 1; i++) {
		const top = `${(i / (down - 1)) * 100}%`;
		bulbs.push({ left: '9px', top }, { left: 'calc(100% - 9px)', top });
	}
	return (
		<>
			{bulbs.map((b, i) => (
				<span key={i} className={`gr-bulb ${i % 2 ? 'gr-odd' : ''}`} style={b} />
			))}
		</>
	);
};

const Confetti = ({ burst }: { burst: number }) => {
	const pieces = useMemo(
		() =>
			Array.from({ length: 90 }, () => ({
				left: `${Math.random() * 100}%`,
				width: 6 + Math.random() * 6,
				height: 10 + Math.random() * 8,
				background: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
				animationDuration: `${2 + Math.random() * 2.2}s`,
				animationDelay: `${Math.random() * 0.6}s`,
				dx: `${(Math.random() - 0.5) * 240}px`,
			})),
		[burst],
	);
	if (!burst) return null;
	return (
		<div className="gr-confetti" key={burst}>
			{pieces.map((p, i) => (
				<i
					key={i}
					style={{
						left: p.left,
						width: p.width,
						height: p.height,
						background: p.background,
						animationDuration: p.animationDuration,
						animationDelay: p.animationDelay,
						['--gr-dx' as any]: p.dx,
					}}
				/>
			))}
		</div>
	);
};

const SessionTimer = ({ session, nextName }: { session: ActiveSession; nextName?: string }) => {
	const total = session.endsAt - session.startedAt;
	const left = Math.max(0, session.endsAt - Date.now());
	const done = left === 0;
	const mm = Math.floor(left / 60_000);
	const ss = Math.floor((left % 60_000) / 1000);
	return (
		<div className={`gr-timer ${done ? 'gr-done' : ''}`}>
			<div className="gr-timer-top">
				<div className="gr-timer-name">{done ? `⏰ TIME'S UP! ${session.pick.game.name}` : `🎮 Now playing: ${session.pick.game.name}`}</div>
				<div className="gr-timer-clock">{done ? '0:00' : `${mm}:${String(ss).padStart(2, '0')}`}</div>
			</div>
			<div className="gr-timebar">
				<div style={{ width: `${Math.min(100, ((total - left) / total) * 100)}%` }} />
			</div>
			<div className="gr-row" style={{ marginTop: 10 }}>
				{nextName && (
					<button className="gr-btn gr-green gr-small" onClick={() => playNext()}>
						▶ NEXT CONTESTANT: {nextName}
					</button>
				)}
				<button className="gr-btn gr-gray gr-small" onClick={() => endSession()}>
					🛑 I'M DONE
				</button>
			</div>
		</div>
	);
};

export const Machine = ({ compact = false, autoSpin = false, onClose }: { compact?: boolean; autoSpin?: boolean; onClose?: () => void }) => {
	const { state, games, gamesError, loading, stats } = useStore();
	const [spinning, setSpinning] = useState(false);
	const [strip, setStrip] = useState<Game[]>([]);
	const [offset, setOffset] = useState(0);
	const [animate, setAnimate] = useState(false);
	const [line, setLine] = useState(IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)]);
	const [burst, setBurst] = useState(0);
	const stripRef = useRef<HTMLDivElement>(null);
	const alive = useRef(true);
	const autoSpun = useRef(false);

	const cellW = compact ? 190 : 340;
	const cellH = Math.round((cellW * 215) / 460);
	const viewH = Math.round(cellH * 1.55);
	const centerOf = (i: number) => (viewH - cellH) / 2 - i * cellH;

	useEffect(() => {
		alive.current = true;
		loadGames();
		return () => {
			alive.current = false;
		};
	}, []);

	const eligible = games.filter((g) => !state.excluded.includes(g.appid));

	const doSpin = async () => {
		if (spinning) return;
		if (!games.length) await loadGames();
		const winner = chooseWinner();
		if (!winner || !alive.current) return;

		setSpinning(true);
		setBurst(0);
		lever();
		const settled = settleWinner(winner);

		// Build the reel: a run of random covers that ends on the winner.
		const pool = eligibleGames();
		const reel: Game[] = Array.from({ length: REEL_LENGTH }, () => pool[Math.floor(Math.random() * pool.length)]);
		reel.push(winner, pool[Math.floor(Math.random() * pool.length)]);
		setAnimate(false);
		setStrip(reel);
		setOffset(centerOf(0));

		// Let the reset paint, then start the long ease-out slide to the winner.
		await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
		if (!alive.current) return;
		setAnimate(true);
		setOffset(centerOf(REEL_LENGTH));

		// Tick every time a new cover passes the payline; rotate the cheesy captions.
		const started = performance.now();
		let lastIdx = 0;
		let lastLine = 0;
		const watch = () => {
			if (!alive.current) return;
			const el = stripRef.current;
			if (el) {
				const view = el.ownerDocument.defaultView ?? window;
				const m = view.getComputedStyle(el).transform.match(/matrix\(([^)]+)\)/);
				const ty = m ? parseFloat(m[1].split(',')[5]) : 0;
				const idx = Math.round(((viewH - cellH) / 2 - ty) / cellH);
				if (idx !== lastIdx) {
					lastIdx = idx;
					tick();
				}
			}
			const t = performance.now() - started;
			if (t - lastLine > 650) {
				lastLine = t;
				setLine(SPIN_LINES[Math.floor(Math.random() * SPIN_LINES.length)]);
			}
			if (t < SPIN_MS) requestAnimationFrame(watch);
		};
		requestAnimationFrame(watch);

		await new Promise((r) => setTimeout(r, SPIN_MS + 80));
		await settled;
		if (!alive.current) return;
		setSpinning(false);
		setLine('');
		setBurst(Date.now());
		jackpot();
	};

	// "Spin directly": the library button opens the machine already spinning.
	useEffect(() => {
		if (autoSpin && !autoSpun.current && eligible.length > 0) {
			autoSpun.current = true;
			doSpin();
		}
	}, [autoSpin, eligible.length]);

	// Show the current winner in the window when we're not mid-spin.
	const shownStrip = spinning || strip.length ? strip : [];
	const current = state.current;
	const idleStrip = !spinning && current ? [current.game] : null;

	const reelContent = idleStrip ? (
		<div className="gr-strip" style={{ transform: `translateY(${centerOf(0)}px)` }}>
			<div className="gr-cell" style={{ width: cellW, height: cellH }}>
				<Cover game={idleStrip[0]} />
			</div>
		</div>
	) : shownStrip.length ? (
		<div
			ref={stripRef}
			className="gr-strip"
			style={{
				transform: `translateY(${offset}px)`,
				transition: animate ? `transform ${SPIN_MS}ms cubic-bezier(0.08, 0.72, 0.12, 1)` : 'none',
			}}
		>
			{shownStrip.map((g, i) => (
				<div key={i} className="gr-cell" style={{ width: cellW, height: cellH }}>
					<Cover game={g} />
				</div>
			))}
		</div>
	) : (
		<div className="gr-strip" style={{ transform: `translateY(${centerOf(0)}px)` }}>
			<div className="gr-cell" style={{ width: cellW, height: cellH }}>
				<div className="gr-q">?</div>
			</div>
		</div>
	);

	const showResult = !spinning && current;

	return (
		<div className={`gr-machine ${compact ? 'gr-compact' : ''} ${spinning ? 'gr-spinning' : ''}`}>
			<style>{CSS}</style>
			<Bulbs />
			<Confetti burst={burst} />
			{onClose && (
				<button className="gr-close" onClick={onClose} title="Close (Esc)">
					✖
				</button>
			)}

			<h1 className="gr-title">🎰 GAME ROULETTE 🎰</h1>
			<div className="gr-sub">{IDLE_LINES[0]}</div>

			{state.session && <SessionTimer session={state.session} nextName={state.next?.game.name} />}

			<div className="gr-window" style={{ width: cellW + 12, height: viewH + 12 }}>
				<span className="gr-arrow gr-l" />
				<span className="gr-arrow gr-r" />
				{reelContent}
			</div>

			{spinning || !current ? <div className="gr-msg">{loading ? '🔍 Counting your games...' : gamesError ? `💥 ${gamesError}` : spinning ? line : `${eligible.length} games loaded and ready to roll!`}</div> : null}

			{showResult && (
				<div className="gr-result">
					<div className="gr-jackpot" key={burst}>
						🎉 JACKPOT! 🎉
					</div>
					<div className="gr-kicker">Tonight's feature presentation</div>
					<div className="gr-game">{current.game.name}</div>
					<div className="gr-meta">
						⌛ {formatPlaytime(current.game.playtime_minutes)}
						{current.game.playtime_2weeks > 0 ? ` · 🔥 ${formatHours(current.game.playtime_2weeks)} last 2 weeks` : ''}
						{current.game.last_played ? ` · 📅 ${formatAgo(current.game.last_played, nowSec())}` : ''}
					</div>
					{current.info?.genres.length ? <div className="gr-meta">{current.info.genres.slice(0, 3).join(' · ')}</div> : null}
					<div className="gr-why">🎯 {whyThisOne(current.game, stats, nowSec())}</div>
					<div className="gr-dose">⏱ Recommended dose: {formatMinutes(current.plan.minutes)}</div>
					<div className="gr-bubble">
						<b>🎙 The host says:</b> {current.plan.reason}.{current.plan.breakTip ? ` ☕ ${current.plan.breakTip}` : ''}
					</div>
				</div>
			)}

			<div className="gr-row">
				{showResult ? (
					<>
						<button className="gr-btn gr-green gr-big" onClick={() => startSession(current)}>
							▶ LET'S GOOO! ({formatMinutes(current.plan.minutes)})
						</button>
						<button className="gr-btn gr-red" onClick={doSpin}>
							🎰 SPIN AGAIN
						</button>
						<button
							className="gr-btn gr-gray"
							onClick={() => {
								boop();
								neverPick(current.game.appid);
							}}
						>
							🗑 NOT THIS ONE, EVER
						</button>
					</>
				) : (
					<button className="gr-btn gr-red gr-big" disabled={spinning || eligible.length === 0} onClick={doSpin}>
						{spinning ? '🌀 SPINNING... 🌀' : '🎰 PULL THE LEVER! 🎰'}
					</button>
				)}
			</div>

			{showResult && state.next && (
				<div className="gr-next">
					<img src={coverUrl(state.next.game.appid)} draggable={false} />
					<div className="gr-next-info">
						<div className="gr-next-label">🍿 COMING UP NEXT</div>
						<div className="gr-next-name">{state.next.game.name}</div>
						<div className="gr-meta">
							{formatMinutes(state.next.plan.minutes)} · {formatPlaytime(state.next.game.playtime_minutes)}
						</div>
					</div>
					<button
						className="gr-btn gr-gold gr-small"
						onClick={() => {
							boop();
							reshuffleNext();
						}}
					>
						🔀 SHUFFLE
					</button>
				</div>
			)}

			<div className="gr-settings">
				<label title={SPIN_MODES.find((m) => m.v === state.settings.mode)?.blurb}>
					🎯 Spin style
					<select value={state.settings.mode} onChange={(e) => update({ settings: { ...state.settings, mode: e.currentTarget.value as SpinMode } })}>
						{SPIN_MODES.map((m) => (
							<option key={m.v} value={m.v}>
								{m.label}
							</option>
						))}
					</select>
				</label>
				<label>
					⏳ I've got
					<select value={state.settings.availableMinutes} onChange={(e) => update({ settings: { ...state.settings, availableMinutes: Number(e.currentTarget.value) } })}>
						{TIME_OPTIONS.map((o) => (
							<option key={o.v} value={o.v}>
								{o.label}
							</option>
						))}
					</select>
				</label>
				<button className="gr-link" onClick={() => update({ muted: !state.muted })}>
					{state.muted ? '🔇 Sound off' : '🔊 Sound on'}
				</button>
			</div>
			<div className="gr-foot">{SPIN_MODES.find((m) => m.v === state.settings.mode)?.blurb}</div>
			{games.length > 0 && (
				<div className="gr-stats">
					<span>🎮 {games.length} installed</span>
					<span>⌛ {formatHours(stats.totalMinutes)} played</span>
					<span>🧟 {stats.neverPlayed} never touched ({Math.round((stats.neverPlayed / games.length) * 100)}%)</span>
					<span>{stats.usualSession ? `⏱ your usual session: ${formatMinutes(Math.round(stats.usualSession))}` : `⏱ learning your session habits (${stats.sessionsMeasured}/3)`}</span>
				</div>
			)}
			<div className="gr-foot">
				{eligible.length} of {games.length} installed games in the wheel
				{state.excluded.length ? (
					<>
						{' · '}
						<button className="gr-link" onClick={() => update({ excluded: [] })}>
							forgive {state.excluded.length} banished
						</button>
					</>
				) : null}
				{' · '}
				<button className="gr-link" onClick={() => loadGames(true)}>
					rescan
				</button>
			</div>
		</div>
	);
};
