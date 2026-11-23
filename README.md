# Amplite

A lightweight Spotify desktop app for Windows, with themes and a mini amp.

- **Log in with your Spotify account**: no client secret is stored in the app.
- **20 themes**: Midnight, Spotify, Classic Amp, Nord, Dracula, Sakura, Ocean, Paper, **AMOLED Black**, AMOLED Red, AMOLED Pink, Catppuccin, Tokyo Night, Rosé Pine, Gruvbox, Solarized, Monokai, Forest, Sunset, Snow (light).
- **From album art**: a theme that takes its colors from the cover of whatever's playing and glides to new ones when the song changes.
- **Theme maker**: **New theme** in the theme picker. Pick the background, panels, cards, text, accent and visualizer colors (anything you leave on *auto* is worked out for you), a font and square or rounded corners, and the whole app changes live while you edit. **Export…** saves it as a `.amptheme` file a friend can **Import…**.
- **Day and night themes** (Settings → General → Theme): switch to one theme in the morning and another in the evening, at the times you pick.
- **Pins**: pin playlists, albums, artists or Liked Songs with the **Pin** button on their page or by right-clicking them. Pinned items sit at the top of the sidebar and first on Home. Drag to reorder, and open with `Ctrl+1` to `Ctrl+9`.
- **Quick controls in the tray**: click Amplite's tray icon for a small pop-up with the cover, play/pause, skip, like, volume and seeking, without opening the window (double-click the icon to open Amplite).
- **Drag to share**: drag songs, albums, playlists or artists into Discord or a chat to drop their Spotify link.
- **Mini Amp**: click **AMP** (or press `M`) and Amplite shrinks into a small, always-on-top retro amp window. Close it to bring the full window back.
- **Customizable amp** (Settings → Mini Amp): 8 skins, an **Album art** skin that takes the cover's colors, fully custom colors, size, width, corners, font, glow, 6 visualizer styles, bar count, frame rate, album art, choose which parts to show, title scrolling, opacity and always-on-top.
- **Custom accent color** on any theme (Settings → General).
- **Edit your playlists**: on any playlist you own or collaborate on, click **Add songs** to search (or pick from recently played) and add with one click. Hover a song and click **⊖** to remove it, with **Undo**. Right-click any song anywhere → **Add to playlist…**
- **Create, rename and delete playlists**: the **+** next to *Your playlists*, the pencil on a playlist's page, or right-click a playlist in the sidebar.
- **Amplite Wrapped** (Stats → **Wrapped**, and on Home from late November): your year as a full-screen story: minutes, top artist (with their photo), top 5 artists and songs, song of the year, your obsession month, artists new to you, your listening personality and a summary. Every slide copies or saves as a story-sized picture, and **Save my top 50** makes the playlist. Pick earlier years too.
- **Friends** (sidebar): add friends by their Last.fm username (your Last.fm friends are suggested) to see what they're playing right now, play it yourself, and check **how your tastes match**: a compatibility score, the artists you share and a **You & them** playlist of songs you both love plus a few of theirs to try.
- **Timeline** (sidebar): every month of your listening, newest first: hours, plays, top artists and songs, the song you couldn't stop playing, artists you found that month and a bar per day. **On this day** shows what you played on today's date in earlier years. **Play** or **Save as playlist** any month, and jump by year. **Import from Last.fm** brings in your whole scrobble history so it goes back years.
- **Stats** (sidebar): live listening stats, like Spotify Wrapped but always on: minutes, plays, top artists and songs, listening by day and by hour, a streak calendar, new artists, and **genre drift** over the last 12 weeks. Pick the last 7 days, 30 days, 12 months or all time. Kept only on your PC; you can import your past Last.fm scrobbles (all of them, up to 200,000).
- **More stats**: **Your day** (what you play in the mornings, afternoons, evenings and late at night, each as a playlist), **Skips** (songs you skip in the first 30 seconds, and songs you always skip in one of your playlists, with *Remove from playlist*), **Albums** (how much of each album you've heard and how often you play it front to back), a **Genre map** (click a genre to play your songs from it) and **Year vs year** (who you picked up and who you dropped).
- **Share your stats**: the **Share** button on the Stats page makes a Wrapped-style image of your week, month or year (minutes, top artists, top song, streak). **Copy image** to paste into Discord or a chat, or save it as a PNG.
- **Desktop lyrics**: a see-through, always-on-top strip with the current line of synced lyrics, with a karaoke fill and the next line underneath. Turn it on with **Desktop** in the lyrics panel, the tray menu, or Settings → General. Drag it where you want it, then **Lock** it so clicks pass through.
- **AI playlists**: the ✨ next to *Your playlists*. Describe a playlist ("late-night drive, moody 2000s rock") and a model running on your own PC through [Ollama](https://ollama.com) picks the songs; Amplite finds them on Spotify so you can play them or save the playlist. Free and private. Needs Ollama with a chat model (e.g. `ollama pull llama3.1`).
- **Artist pages**: a banner tinted from the artist's photo, listener and scrobble counts and your own scrobbles (Last.fm), genres, **Follow**, **Shuffle** and **Radio** (their songs mixed with similar artists), their latest release, popular songs (with *Show more*), a **You & them** card from your history (minutes, plays, rank among your artists, your most-played songs), a biography, a discography split into Albums / Singles & EPs / Compilations / Appears on, and **Fans also like**.
- **Album pages**: type (album, EP, single), total length and discs, release date, label and credits, a **You & this album** card (plays, minutes, how many of its songs you've heard, your favourite) and **More by** the artist.
- **Playlist details**: total length, when it was last updated, who's mostly on it ("Mostly Deftones 12 · Chevelle 8 …") and how often you've played its songs.
- **About this song** (`I`, or the ⓘ next to lyrics): the cover in full size, album, track number, release date, label, explicit tag, your plays of the song and artist, a short artist bio and what's up next.
- **Home** also shows your top artists this week and **Rediscover**: songs you played a lot but haven't heard in a while.
- **Discover Mix** (sidebar, and on Home): every Monday, 30 songs by artists you've never played, one per artist, picked from Last.fm's similar artists of your favourites, with "Because you like …" under each song. It's also kept as a **Discover Mix** playlist in your Spotify (the same playlist is refreshed each week; you can turn that off). **New mix** makes a fresh one any time. Needs a Last.fm API key (Settings → Connections).
- **New releases** (sidebar): new albums, singles and EPs from the artists you follow and the ones you play most, grouped into this week / last week / earlier, with a **NEW** badge in the sidebar and a heads-up when something drops. Checked quietly in the background every few hours. **Play new songs** plays the last two weeks of releases.
- **Full screen** (`F`, or the ⛶ button in the player bar): big album art over a blurred backdrop, large synced lyrics that glide along with the song (click a line to jump there), a clock and what's up next. The controls and mouse pointer hide when you're not moving the mouse. `Esc` to leave.
- **Library**: your saved albums and the artists you follow, with filter and sort.
- **Playlist covers**: hover the cover of a playlist you own and click **Change cover** (or ⋯ → *Change cover…*, or right-click it in the sidebar). Make a 2×2 or 3×3 grid from the albums it's mostly made of (click a square to swap it, or **Shuffle**), use one album, or upload your own picture. Optionally write the name on it and tint it with your accent color. **Save…** keeps a copy as a PNG. The first time, Amplite asks Spotify for permission to change covers.
- **Playlist health** (the ✓ next to *Your playlists*): checks every playlist you own or collaborate on for songs that won't play any more (greyed out in Spotify, with the reason), songs that are gone from Spotify and duplicates. Greyed-out songs can be swapped for a version that plays (another release of the same song) right where they were. Fix one song, one playlist or everything, with **Undo**. Also on a playlist's ⋯ menu.
- **Playlist tools** (the ⋯ button on your playlists): remove duplicates, save a sort order to the playlist itself, add songs from another playlist, and export to a spreadsheet (CSV). Changes can be undone.
- **Smart shuffle**: the shuffle button on a playlist spreads out songs by the same artist and plays what you've heard in the last two days last (Settings → General → Playback).
- **Keep the music going**: when a playlist or album ends, Amplite queues similar songs.
- **Phone remote**: Settings → Connections → Phone remote. Scan the QR code and your phone's browser becomes a remote (play/pause, skip, seek, volume, like) on the same Wi-Fi. No app needed; the link has a private key, and you can make a new one at any time.
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
- **Smooth and fast**: your listening history is read once and kept up to date, so Stats, Timeline and Wrapped open quickly even with years of scrobbles. Back and Forward return you to where you were on the page. Pages that are already cached open instantly with no loading spinner, new pages and images fade in, and Lite mode or Windows' *reduce animations* setting turns the motion off.
- **Fast startup**: your profile, playlists and Home appear instantly from the last session and refresh in the background. Pages start loading when you hover over them.
- **Mouse back and forward buttons** go back and forward between pages (so do `Alt+Left` / `Alt+Right`). Back closes full screen, Settings or a dialog first.
- **Collapsible sidebar** (button at the top of the sidebar, or `Ctrl+B`). Hide sidebar items you don't use by right-clicking them or in Settings → General → Sidebar. and a **Lite mode** that turns off effects for lower CPU/GPU use.
- **Auto-updates**: Amplite checks GitHub Releases, downloads new versions in the background, and shows a restart button in the title bar. You can also use **Check for updates** in the account menu.
- **Media keys** (play/pause, next, previous) work even when Amplite isn't focused.
- Home (recently played and your top tracks), search, Liked Songs, playlists, albums and artists.
- Plays music itself at **320 kbps** through a built-in audio engine, or acts as a remote for Spotify on your other devices.
- Shortcuts: `Space` play/pause · `Ctrl+←/→` previous/next · `M` mini amp · `/` search · `Ctrl+B` sidebar · `Ctrl+,` settings · `Ctrl+1–9` pinned items · `Q` queue · `L` lyrics · `I` about this song · `F` full screen.

- **What's new**: after an update, a small card lists what changed (also in Settings → About).
- **Diagnostics**: Settings → About → **Save diagnostics…** saves one file with versions, devices, recent errors and the engine log (no passwords or tokens) to send if something isn't working.

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

## Mantel (optional)

[Mantel](https://github.com/larosa023/Mantel)'s Now Playing widget talks to Amplite through the same local API: song, cover, progress, accent color, like, volume and **EQ presets** (pick one from the widget). Nothing to set up; it's used automatically while Amplite is running.

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
