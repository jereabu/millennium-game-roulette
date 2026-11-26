# Game Roulette: a Millennium plugin for Steam

Spin a roulette over your **installed** Steam games. It picks one, recommends how long to play it, and lines up what to play next.

## Where to find it

- **In your Library:** a bobbing **🎰 SPIN!** button sits in the bottom-right corner of every Library page. Click it and a casino slot machine drops in and starts spinning right away. Press Esc or ✖ to close it. While a session is running, the button shows the time left.
- **In Millennium settings:** go to Plugins → Game Roulette → Configure. This shows the same machine in a compact size.

The machine has blinking marquee bulbs, a reel of game covers that ticks as each one passes the payline, a lever clunk, a jackpot fanfare, confetti and an over-the-top host. Use 🔊 to mute it.

## Features

- **Weighted roulette** over every installed game in all your Steam library folders. Redistributables, Proton, SteamVR, tools and soundtracks are left out.
- **Reads your playtime per game** from two sources and uses whichever number is larger:
  - Steam's live library data.
  - The play history Steam saves for your account (`userdata/<id>/config/localconfig.vdf`): total hours, hours in the last two weeks, and when you last played.
- **Spin styles** (🎯 in the settings row) that use that playtime:

  | Style | Favours |
  | --- | --- |
  | ⚖️ Balanced (default) | Never-played games and dusty favourites, with a small boost for what you're playing now |
  | 🧟 Backlog buster | Unplayed and barely-played games |
  | 🛋️ Comfort food | Your most-played games |
  | 🔍 Rediscover | Games you put 2+ hours into but haven't touched in a month or more |
  | 🔥 Hot streak | What you've played in the last two weeks |
  | 🌪️ Pure chaos | Nothing; every game has the same odds |

  In every style except Hot streak and Pure chaos, games you played in the last 12 hours come up less often. Your last 5 picks almost never repeat.
- **Learns your real sessions.** Steam reports whenever any game starts and stops, so the plugin records how long you actually play each one, keeping the last 20 sessions per game.
  - If you launch the roulette's pick some other way (from the library or a desktop shortcut), its timer starts anyway.
  - When you close the game you get a "That's a wrap" pop-up comparing what you played with what was planned.
- **Recommended session length, personalised:**
  - With 2 or more measured sessions in a game, it recommends your own typical length for that game.
  - Otherwise it starts from the game's Steam store genres (RPG/Strategy about 90 min, Action/Adventure about 60, Casual about 30, MMO about 2 h, competitive PvP capped at about 1 h). Once it has measured 3 sessions across your games, it blends that with your usual session length.
  - It's shorter for a game you've never played, a little longer if you've played 5+ hours in the last two weeks or haven't touched the game in 6+ months, and never more than **I've got**.
  - When you set **I've got**, games whose usual session is much longer than that come up less often.
- **🎯 "Why this one"** for every pick, such as "An all-time favourite: 120 h logged" or "Welcome back! 14 h in, last played 8 months ago".
- **Library stats:** hours played, how many games you've never touched, and your usual session length.
- **Up next** suggestion, preferring a game with a *different* genre for variety, plus a **Shuffle** button.
- **Session timer** with a Steam pop-up when time's up and a **Next contestant** button.
- **Not this one, ever** removes a game from the wheel; **forgive N banished** brings them all back.

## Install

Requirements: Steam on Windows or Linux with [Millennium](https://steambrew.app) 3.4 or newer.

### From a release (easiest)

1. Download `game-roulette.star` from the [latest release](../../releases/latest).
2. Put it in Millennium's plugins folder:
   - Windows: `C:\Program Files (x86)\Steam\millennium\plugins`
   - Linux: the `plugins` folder inside your Millennium install
3. Restart Steam.
4. Open **Steam → Millennium → Plugins** and make sure **Game Roulette** is turned on.
5. Go to your Library and press the **🎰 SPIN!** button in the bottom-right corner.

### From source

You'll need [Bun](https://bun.com) 1.0 or newer.

```powershell
git clone https://github.com/<you>/millennium-game-roulette
cd millennium-game-roulette
bun install
bun run build
```

`bun run build` compiles the plugin and installs it into your Millennium setup automatically (`output_path = "auto"` in `millennium.toml`). Restart Steam afterwards. During development, `bun run dev` rebuilds and reloads Steam's UI on every change.

## Privacy

Everything stays on your PC. The plugin reads Steam's own files (library folders, app manifests, and the play history in your `localconfig.vdf`). Its only network requests go to Steam's public store API, to look up a game's genres, and to Steam's CDN, for cover images. Settings and measured sessions are kept in Steam's local storage.

## Layout

| File | What it does |
| --- | --- |
| `backend/library.lua` | Reads `libraryfolders.vdf` and every `appmanifest_*.acf` to list installed games, and looks up genres on the Steam store API |
| `backend/main.lua` | Plugin lifecycle |
| `frontend/logic.ts` | Roulette weights, session-length rules, variety check (pure functions, easy to tweak) |
| `frontend/store.ts` | Shared state: library scan, spins, sessions, the timer and the "time's up" toast |
| `frontend/Machine.tsx` | The slot machine UI (reel, results, up next, settings) |
| `frontend/styles.ts` | All the cheese: colours, bulbs, buttons, confetti, animations |
| `frontend/sounds.ts` | Reel ticks, lever clunk and jackpot fanfare (WebAudio, no files) |
| `frontend/library.tsx` | Mounts the floating SPIN! button and the overlay in Steam's main window |
| `frontend/index.tsx` | Plugin entry: starts the library button and registers the Millennium panel |

To change the session lengths, edit `GENRE_MINUTES` in `frontend/logic.ts`. To change how the roulette favours games, edit `weightFor`.

Settings, history, exclusions and the active session are saved in Steam's `localStorage` (key `game-roulette:v1`). Playtime comes from Steam's library data and `localconfig.vdf`. Measured sessions come from Steam's game start/stop events.
