# Amplite

A lightweight Spotify desktop app for Windows, with themes and a mini amp.

- **Log in with your Spotify account**: no client secret is stored in the app.
- **8 themes**: Midnight, Spotify, Classic Amp, Nord, Dracula, Sakura, Ocean, Paper.
- **Mini Amp**: click **AMP** (or press `M`) and Amplite shrinks into a small, always-on-top retro amp window. Close it to bring the full window back.
- **Auto-updates**: Amplite checks GitHub Releases, downloads new versions in the background, and shows a restart button in the title bar. You can also use **Check for updates** in the account menu.
- **Media keys** (play/pause, next, previous) work even when Amplite isn't focused.
- Home (recently played and your top tracks), search, Liked Songs, playlists, albums and artists.
- Plays music itself at **320 kbps** through a built-in audio engine, or acts as a remote for Spotify on your other devices.
- Shortcuts: `Space` play/pause · `Ctrl+←/→` previous/next · `M` mini amp · `/` search.

## Install

Download **Amplite-Setup-x.y.z.exe** from [Releases](../../releases) and run it. Windows may show a SmartScreen warning because the app isn't code-signed. Click **More info → Run anyway**.

## One-time Spotify setup

In your app on the [Spotify developer dashboard](https://developer.spotify.com/dashboard):

1. **Settings → Redirect URIs**: add `http://127.0.0.1:43821/callback` (exactly). Tick **Web API** and **Web Playback SDK**, then save.
2. **User Management**: add the email of the Spotify account you'll log in with.

## Playback and audio quality

Amplite plays through a bundled copy of [librespot](https://github.com/librespot-org/librespot), an open-source Spotify Connect engine, at **320 kbps** (Spotify's "Very high" quality) with 32-bit float output.

- **First time only:** when Amplite starts after you log in, your browser opens once to approve the Amplite audio engine. After that the login is cached.
- The chip next to the volume slider shows the engine's status: **320 kbps** means it's playing through the engine.
- If something goes wrong, use **Restart audio engine** or **Re-link audio engine** in the account menu.
- Amplite can still control your other Spotify devices (phone, desktop app). Click **Play here** to move playback into Amplite.

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
