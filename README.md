# Amplite

A lightweight, clean Spotify player for the browser: no build step, no framework, no server. It's three files and logs in with your Spotify account.

- **Log in with Spotify** using PKCE, so there's no client secret and no backend.
- **Plays in the browser** through the Spotify Web Playback SDK, or acts as a remote for your phone or desktop app.
- **8 themes**: Midnight, Spotify, Classic Amp, Nord, Dracula, Sakura, Ocean, Paper.
- **Mini Amp**: one click (or press `M`) shrinks Amplite into a retro amp-style player. In Chrome and Edge it pops out into an always-on-top window.
- Home (recently played and top tracks), search, Liked Songs, your playlists, albums and artists.
- Keyboard shortcuts: `Space` play/pause · `Ctrl+←/→` prev/next · `M` mini amp · `/` search.

## Setup (one time)

1. **Host it.** Push to GitHub. The included workflow deploys to GitHub Pages: in the repo go to **Settings → Pages → Source: GitHub Actions**. Your site will be at `https://<user>.github.io/Amplite/`.
2. **Spotify dashboard** ([developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)): open your app → **Settings → Redirect URIs** and add exactly:
   - `https://<user>.github.io/Amplite/` (the trailing slash matters)
   - for local testing: `http://127.0.0.1:5500/` (Spotify doesn't accept `localhost`)
   
   Tick **Web API** and **Web Playback SDK**, then save.
3. **Users**: under **User Management**, add the email of every Spotify account that will log in (development mode allows up to 5).

## Run locally

```bash
python -m http.server 5500 --bind 127.0.0.1
# open http://127.0.0.1:5500/
```

## Spotify limits to know about (2026)

- The developer app owner must have **Spotify Premium**, and playing or controlling music requires Premium.
- In-browser playback needs a DRM-capable browser (Chrome, Edge, Firefox). Safari can still remote-control other devices.
- In development mode, Spotify only returns track lists for playlists you own or collaborate on. Other playlists still play when you hit play.
- Search returns up to 10 results per type.
- The Mini Amp visualizer is animated, not a real spectrum analyzer, because Spotify's audio is DRM-protected and can't be analyzed in the browser.

## Files

| File | What it is |
|---|---|
| `index.html` | Layout: login, app shell, player bar, mini amp |
| `styles.css` | Themes (CSS variables) and all styling |
| `app.js` | Auth, API, playback, views, themes, mini amp |

The Client ID is public by design with PKCE. To use a different Spotify app, change `CLIENT_ID` at the top of `app.js`.
