# Amplite

A lightweight Spotify desktop app for Windows, with themes and a mini amp.

- **Log in with your Spotify account**: no client secret is stored in the app.
- **20 themes**: Midnight, Spotify, Classic Amp, Nord, Dracula, Sakura, Ocean, Paper, **AMOLED Black**, AMOLED Red, AMOLED Pink, Catppuccin, Tokyo Night, Rosé Pine, Gruvbox, Solarized, Monokai, Forest, Sunset, Snow (light).
- **Pins**: pin playlists, albums, artists or Liked Songs with the **Pin** button on their page or by right-clicking them. Pinned items sit at the top of the sidebar and first on Home. Drag to reorder, and open with `Ctrl+1` to `Ctrl+9`.
- **Mini Amp**: click **AMP** (or press `M`) and Amplite shrinks into a small, always-on-top retro amp window. Close it to bring the full window back.
- **Customizable amp** (Settings → Mini Amp): 8 skins plus fully custom colors, size, width, corners, font, glow, 6 visualizer styles, bar count, frame rate, album art, choose which parts to show, title scrolling, opacity and always-on-top.
- **Custom accent color** on any theme (Settings → General).
- **Edit your playlists**: on any playlist you own or collaborate on, click **Add songs** to search (or pick from recently played) and add with one click. Hover a song and click **⊖** to remove it, with **Undo**. Right-click any song anywhere → **Add to playlist…**
- **Create, rename and delete playlists**: the **+** next to *Your playlists*, the pencil on a playlist's page, or right-click a playlist in the sidebar.
- **Stats** (sidebar): live listening stats, like Spotify Wrapped but always on: minutes, plays, top artists and songs, listening by day and by hour, a streak calendar, new artists, and **genre drift** over the last 12 weeks. Pick the last 7 days, 30 days, 12 months or all time. Kept only on your PC; you can import your past Last.fm scrobbles.
- **Recommended songs** at the bottom of every playlist, based on the songs in it (similar songs via Last.fm when you've added a Last.fm API key in Settings → Connections; otherwise more from the playlist's artists). **Add** puts one straight into the playlist; **Refresh** for a new set.
- **Select several songs** with Ctrl- / Shift-click or `Ctrl+A`, then right-click to queue, add to a playlist or remove them all at once (`Delete` removes too). **Drag songs onto a playlist in the sidebar** to add them.
- **Mini amp playlist window**: click **PL** on the amp for a Winamp-style list of the playlist or album that's playing (double-click to jump to a song), plus the queue.
- **Taskbar controls**: previous / play / next on Amplite's taskbar preview and song progress on its taskbar icon (Settings → General).
- **Last.fm scrobbling** and **Discord status** ("Listening to …"): Settings → Connections.
- **Queue panel** (`Q`) and **right-click → Add to queue** on any song.
- **Synced lyrics** (`L`) from [LRCLIB](https://lrclib.net). Click a line to jump to it, or show the current line on the mini amp's display.
- **10-band equalizer** with presets, in an EQ panel under the mini amp and in Settings → Audio (built-in engine).
- **Filter, sort and shuffle** Liked Songs and playlists.
- **System tray** with play/pause/skip, **close to tray**, and **start with Windows** (window, tray or mini amp).
- **Mini amp snaps** to screen edges and corners and remembers where you put it.
- **Fast startup**: your profile, playlists and Home appear instantly from the last session and refresh in the background. Pages start loading when you hover over them.
- **Collapsible sidebar** (button at the top of the sidebar, or `Ctrl+B`) and a **Lite mode** that turns off effects for lower CPU/GPU use.
- **Auto-updates**: Amplite checks GitHub Releases, downloads new versions in the background, and shows a restart button in the title bar. You can also use **Check for updates** in the account menu.
- **Media keys** (play/pause, next, previous) work even when Amplite isn't focused.
- Home (recently played and your top tracks), search, Liked Songs, playlists, albums and artists.
- Plays music itself at **320 kbps** through a built-in audio engine, or acts as a remote for Spotify on your other devices.
- Shortcuts: `Space` play/pause · `Ctrl+←/→` previous/next · `M` mini amp · `/` search · `Ctrl+B` sidebar · `Ctrl+,` settings · `Ctrl+1–9` pinned items · `Q` queue · `L` lyrics.

## Install

Download **Amplite-Setup-x.y.z.exe** from [Releases](../../releases) and run it. Windows may show a SmartScreen warning because the app isn't code-signed. Click **More info → Run anyway**.

## One-time Spotify setup

Amplite signs in through a Spotify developer app. Spotify only lets 5 people use a developer app, and each one has to be added by its owner, so **everyone should use their own** (free, about 5 minutes):

1. Open the [Spotify developer dashboard](https://developer.spotify.com/dashboard), log in with your Spotify account and click **Create app**.
2. Under **Redirect URIs** add `http://127.0.0.1:43821/callback` (exactly). Tick **Web API** and **Web Playback SDK**, then save.
3. In the app's **User Management** tab, add the email of your Spotify account.
4. In Amplite's login screen, open **Use your own Spotify app**, paste the app's **Client ID** and click **Save & log in**.

You can change it later in **Settings → About → Spotify app**. Spotify Premium is required. No client secret is needed.

## Stream Deck (optional)

Each release includes **Amplite-StreamDeck.streamDeckPlugin**. Double-click it to install, then drag **Amplite → Now Playing** onto a dial of your Stream Deck + (or onto a key).

- **Touch strip:** album cover, song, artist, a progress bar and elapsed / total time. A pause sign shows over the cover while paused.
- **Dial:** turn for volume (or seek / skip songs; set it in the action's settings), press to play/pause, hold for the next song. Tap the strip to play/pause, long-touch for next.
- **Key:** shows the album cover; press to play/pause, hold for next.
- If Amplite isn't running, pressing it opens Amplite. The plugin only talks to Amplite on your PC (`127.0.0.1:43821`), and needs Stream Deck 7.1 or newer.

## Last.fm and Discord (optional)

- **Last.fm:** create a free API account at [last.fm/api/account/create](https://www.last.fm/api/account/create) (any name, callback URL empty). In **Settings → Connections**, paste its API key and shared secret, click **Connect**, and approve in your browser. Songs scrobble after half their length or 4 minutes; scrobbles made offline are sent later.
- **Discord:** create an application named *Amplite* at [discord.com/developers/applications](https://discord.com/developers/applications), copy its **Application ID** into **Settings → Connections**, and turn on *Show what you're listening to*. Needs the Discord desktop app running.

## Playback and audio quality

Amplite plays through a bundled copy of [librespot](https://github.com/librespot-org/librespot), an open-source Spotify Connect engine, at **320 kbps** (Spotify's "Very high" quality) with 32-bit float output.

- **First time only:** when Amplite starts after you log in, your browser opens once to approve the Amplite audio engine. After that the login is cached.
- Quality (320 / 160 / 96 kbps), volume normalization and the engine status are in **Settings → Audio**, along with **Restart** and **Re-link** buttons if something goes wrong.
- Amplite can still control your other Spotify devices (phone, desktop app). Click **Play here** to move playback into Amplite.

### Accounts the engine can't play

Spotify refuses decryption keys to librespot for many newer Premium accounts (a known upstream issue, [librespot #1649](https://github.com/librespot-org/librespot/issues/1649)). In **Automatic** mode Amplite detects this and moves on to the next source:

1. **Amplite engine:** librespot, 320 kbps Ogg Vorbis.
2. **Amplite web player:** Spotify's official Web Playback SDK running inside Amplite with Widevine DRM (about 256 kbps AAC). It works for any Premium account, **but only in a VMP-signed build** (see below).
3. **Spotify app:** the official desktop app, started hidden in the background and closed again when Amplite quits.

You can also pick the source yourself in **Settings → Audio → Play audio with**.

### Enabling the in-app web player (VMP signing, one-time, free)

Spotify's DRM only works in apps signed through castLabs' free EVS service:

1. Install Python, then run `pip install castlabs-evs` and `python -m castlabs_evs.account signup`. Pick an account name and password, and confirm the email code.
2. In this repo, open **Settings → Secrets and variables → Actions → New repository secret** and add `EVS_ACCOUNT_NAME` and `EVS_PASSWD` with those values.
3. Push a new version (or re-run **Build Windows app**). The build log shows **"VMP signed"**, and from that version on the web player is used automatically wherever the engine is refused.

librespot is unofficial and Spotify Premium is required. If the engine is missing from a build, Amplite falls back to Spotify's Web Playback SDK.

## Build it yourself

```bash
npm install
npm start            # run in development
npm run dist         # Windows installer → dist/
```

Every push to `main` builds the installer on GitHub Actions and publishes it as a Release (bump `version` in package.json for a new one). You can also run the **Build Windows app** workflow by hand from the Actions tab.

## Spotify limits (2026)

- The developer app owner needs **Spotify Premium**, and so does playback.
- Development mode allows up to 5 users, each added under User Management.
- Track lists only load for playlists you own or collaborate on. Other playlists still play.
- Search returns up to 10 results per type.
- The mini amp visualizer is animated. The audio is DRM-protected, so it can't be analyzed.

## Project layout

| Path | What it is |
|---|---|
| `main.js` | Desktop shell: window, local login server, mini amp window, media keys, updater |
| `streamdeck/` | The Stream Deck plugin (Now Playing on the Stream Deck + touch strip / keys) |
| `integrations.js` | Taskbar buttons/progress, Discord status, Last.fm scrobbling |
| `engine.js` | Runs the bundled librespot audio engine (320 kbps) |
| `preload.js` | Safe bridge between the shell and the UI |
| `src/` | The UI: `index.html`, `styles.css`, `app.js` |
| `build/` | Icons and the optional VMP signing hook |
| `patches/` | Amplite's changes to librespot (Ogg-first formats, 10-band EQ) |
