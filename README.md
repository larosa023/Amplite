# Amplite

A lightweight Spotify desktop app for Windows, with themes and a mini amp.

- **Log in with your Spotify account**: no client secret is stored in the app.
- **19 themes**: Midnight, Spotify, Classic Amp, Nord, Dracula, Sakura, Ocean, Paper, **AMOLED Black**, AMOLED Red, Catppuccin, Tokyo Night, Rosé Pine, Gruvbox, Solarized, Monokai, Forest, Sunset, Snow (light).
- **Pins**: pin playlists, albums, artists or Liked Songs with the **Pin** button on their page or by right-clicking them. Pinned items sit at the top of the sidebar and first on Home. Drag to reorder, and open with `Ctrl+1` to `Ctrl+9`.
- **Mini Amp**: click **AMP** (or press `M`) and Amplite shrinks into a small, always-on-top retro amp window. Close it to bring the full window back.
- **Customizable amp** (Settings → Mini Amp): 8 skins plus fully custom colors, size, width, corners, font, glow, 6 visualizer styles, bar count, frame rate, album art, choose which parts to show, title scrolling, opacity and always-on-top.
- **Custom accent color** on any theme (Settings → General).
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

In your app on the [Spotify developer dashboard](https://developer.spotify.com/dashboard):

1. **Settings → Redirect URIs**: add `http://127.0.0.1:43821/callback` (exactly). Tick **Web API** and **Web Playback SDK**, then save.
2. **User Management**: add the email of the Spotify account you'll log in with.

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
| `engine.js` | Runs the bundled librespot audio engine (320 kbps) |
| `preload.js` | Safe bridge between the shell and the UI |
| `src/` | The UI: `index.html`, `styles.css`, `app.js` |
| `build/` | Icons and the optional VMP signing hook |
| `patches/` | Amplite's changes to librespot (Ogg-first formats, 10-band EQ) |
