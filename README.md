# Amplite

A lightweight Spotify desktop app for Windows, with themes and a mini amp.

- **Log in with your Spotify account**: no client secret is stored in the app.
- **8 themes**: Midnight, Spotify, Classic Amp, Nord, Dracula, Sakura, Ocean, Paper.
- **Mini Amp**: click **AMP** (or press `M`) and Amplite shrinks into a small, always-on-top retro amp window. Close it to bring the full window back.
- **Media keys** (play/pause, next, previous) work even when Amplite isn't focused.
- Home (recently played and your top tracks), search, Liked Songs, playlists, albums and artists.
- Plays music itself, or acts as a remote for the Spotify app on your PC or phone.
- Shortcuts: `Space` play/pause · `Ctrl+←/→` previous/next · `M` mini amp · `/` search.

## Install

Download **Amplite-Setup-x.y.z.exe** from [Releases](../../releases) and run it. Windows may show a SmartScreen warning because the app isn't code-signed. Click **More info → Run anyway**.

## One-time Spotify setup

In your app on the [Spotify developer dashboard](https://developer.spotify.com/dashboard):

1. **Settings → Redirect URIs**: add `http://127.0.0.1:43821/` (exactly, including the trailing slash). Tick **Web API** and **Web Playback SDK**, then save.
2. **User Management**: add the email of the Spotify account you'll log in with.

## Playing music inside Amplite

Spotify's music is DRM-protected. Amplite runs on castLabs' build of Electron, which includes the Widevine DRM component. Spotify only plays in apps that are *VMP-signed*, which is a free signature from castLabs:

1. Create a free castLabs EVS account: `pip install castlabs-evs`, then `python -m castlabs_evs.account signup`.
2. In this GitHub repo, go to **Settings → Secrets and variables → Actions** and add `EVS_ACCOUNT_NAME` and `EVS_PASSWD`.
3. Re-run the build. The installer will then be signed.

Until then, Amplite still works as a **remote**: open the official Spotify app (it can stay minimized), and Amplite will show and control what's playing, including from the mini amp.

## Build it yourself

```bash
npm install
npm start            # run in development
npm run dist         # Windows installer → dist/
```

Pushing a tag such as `v1.0.1` builds the installer on GitHub Actions and attaches it to a Release. You can also run the **Build Windows app** workflow by hand from the Actions tab.

## Spotify limits (2026)

- The developer app owner needs **Spotify Premium**, and so does playback.
- Development mode allows up to 5 users, each added under User Management.
- Track lists only load for playlists you own or collaborate on. Other playlists still play.
- Search returns up to 10 results per type.
- The mini amp visualizer is animated. The audio is DRM-protected, so it can't be analyzed.

## Project layout

| Path | What it is |
|---|---|
| `main.js` | Desktop shell: window, local login server, mini amp window, media keys |
| `preload.js` | Safe bridge between the shell and the UI |
| `src/` | The UI: `index.html`, `styles.css`, `app.js` |
| `build/` | Icons and the optional VMP signing hook |
