# Swati's Little Studio

A singing room in a browser. Find a song, read the lyrics as they scroll in time
with the music, record yourself, and keep every take in Google Drive.

One file — `index.html`. No build step, no server, no dependencies to install.

---

## Put it online (GitHub Pages)

1. Make sure the file is named **`index.html`**. Any other name won't load.
2. Create a **public** repository. Free GitHub Pages needs public; private
   requires a paid plan.
3. Upload `index.html` (and this README) to the repository root.
4. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`,
   folder: `/ (root)` → **Save**.
5. Wait about a minute. The site appears at:

   ```
   https://YOUR-USERNAME.github.io/YOUR-REPO/
   ```

GitHub Pages serves over HTTPS, which the microphone requires. Opening the file
straight from your hard drive will *not* let you record.

---

## Connect Google Drive

Four settings in [Google Cloud Console](https://console.cloud.google.com). Do all
four or sign-in will fail.

1. **Credentials → your OAuth 2.0 Client ID → Authorized JavaScript origins.**
   Add exactly:

   ```
   https://YOUR-USERNAME.github.io
   ```

   Just that. **No repository name, no trailing slash.** Google rejects origins
   that contain a path, and this is where nearly everyone gets stuck.

2. **Enable the [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)**
   for the same project.

3. **OAuth consent screen → Test users** → add the Google account that will use
   the app. Skip this while the app is in Testing and Google returns
   `access_denied`.

4. Give it a minute or two to propagate, then press **Connect Google Drive** on
   the Drive tab.

The Drive tab prints the exact origin string to paste, and explains whatever
error Google returned.

### Staying signed in

Browsers can't hold a long-lived Google credential without a server, so the app
does the next best thing:

- On every load it asks Google for a token silently. If you're still signed in
  to Google and have granted access before, there's no prompt and no click.
- While the app is open it renews the token five minutes before it expires, so a
  long practice session never breaks mid-recording.
- If the silent attempt fails — Safari, or a browser blocking third-party
  cookies, or you signed out of Google — one tap on **Connect** restores it.

### What lives where

| | |
|---|---|
| `swati-studio-library.json` | The songbook — titles, lyrics, timings. Written to Drive whenever a song changes. |
| `*.webm` / `*.m4a` | The recordings themselves. |

Open the app on a different device, sign in, and the songbook and every past
recording are pulled back down.

---

## Settings you can change

Near the top of the `<script>` block in `index.html`:

| Setting | What it does |
|---|---|
| `CLIENT_ID` | The OAuth client. A client ID is a public identifier — it's fine in a public repo. A client **secret** is not; never put one here. |
| `FOLDER_ID` / `FOLDER_URL` | The Drive folder to aim at. |
| `SCOPE` | `drive.file` by default — the app can only touch files it created, never the rest of your Drive. Swap for the full `drive` scope if you want takes to land in a folder the app didn't make. |
| `FALLBACK_FOLDER` | Name of the folder the app creates when it can't reach the configured one. |

The Hindi encouragement lines are in the `HAUSLA` array, just below. Add your
own — same shape, `{q: '...'}`, with an optional `a` for an author.

---

## Where the lyrics come from

[LRCLIB](https://lrclib.net) — an open, crowdsourced lyrics database. No API key,
no account, and it allows browser requests directly. Many entries include
line-by-line timings, which is what drives the scrolling.

Spotify has no public lyrics API, so it isn't used here. Entries are contributed
by users, so quality varies on regional tracks — every imported song stays
editable.

---

## Notes

- Wear headphones while recording, or the backing track leaks into the mic.
- The mic needs HTTPS. GitHub Pages provides it; `file://` does not.
- Recordings under about 3.4 MB are also cached in the browser, so they play
  instantly. Longer ones stream from Drive on demand.
