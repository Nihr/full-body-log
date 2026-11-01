# Full body log

A small offline workout logger for a three day full body programme (A, B, C in rotation). It is plain HTML, CSS and JavaScript with no framework, no build step and no backend. It installs to an Android home screen from Chrome and works with no network.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `app.js` | Programme, progression rule, storage and screens |
| `styles.css` | Styles, light and dark themes |
| `manifest.webmanifest` | Install metadata |
| `sw.js` | Service worker that caches the app for offline use |
| `icons/` | App icon as SVG, 192 px and 512 px PNG |
| `test.js` | Tests: progression rule, history formatting, saved data and backups, the programme, the service worker file list |
| `tools/make-icons.js` | Regenerates the icons |
| `.gitignore` | Keeps the local `start-claude.bat` launcher out of the repository |

`full-body-log.html` is the original single file prototype the app was built from. The app does not use it.

## Run it locally

A service worker only runs over `http://localhost` or HTTPS, so serve the folder rather than opening `index.html` as a file. From this folder, either of these works:

```sh
python -m http.server 8000
# or
npx serve -l 8000 .
```

Then open http://localhost:8000.

To try it on your phone before publishing, first turn on Developer options and USB debugging on the phone. Connect the phone by USB, open `chrome://inspect` on the computer, turn on port forwarding for port 8000, and open `http://localhost:8000` in Chrome on the phone. Opening the computer's LAN address (for example `http://192.168.1.20:8000`) also loads the page, but without HTTPS it will not work offline or install properly. Workouts logged on `localhost` stay there, apart from the published app; use Export and Import to move them.

## Run the tests

```sh
node test.js
```

Needs Node 16 or later and nothing else. Besides the progression rule and history formatting, it checks the programme for typos and that `SHELL` in `sw.js` lists every file the page uses. After editing `PROGRAMME`, run `node test.js programme`, which runs only those two checks: the full run also pins today's targets and increments, so tests that name an exercise you changed on purpose fail until you update them.

## Publish to GitHub Pages

1. Create a new repository on GitHub, for example `full-body-log`.
2. Push this folder to it:
   ```sh
   git init
   git add .
   git commit -m "Full body log"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/full-body-log.git
   git push -u origin main
   ```
   The `.gitignore` keeps the local `start-claude.bat` launcher out of the repository. Run `git status` before the first commit to see what will be published. If you would rather not publish the prototype `full-body-log.html` either, add it to `.gitignore`.
3. On GitHub, open the repository, go to **Settings > Pages**, set **Source** to **Deploy from a branch**, pick `main` and `/ (root)`, and save.
4. After a minute the app is live at `https://YOUR-NAME.github.io/full-body-log/`.

All paths in the app are relative, so it works from a sub-path like that without changes.

## Install on Android

1. Open the GitHub Pages address in Chrome on the phone.
2. Tap the three dot menu and choose **Install app** (on some versions it says **Add to home screen**, then **Install**).
3. Open it once from the home screen while online. After that it works in airplane mode.

## Updating the app

Every time you change any file, open `sw.js` and bump `VERSION` (for example `v2` to `v3`), then push. If you add, rename or remove a file, update the `SHELL` list in `sw.js` too (`node test.js` checks it); one missing file stops the update from installing. Open the app on the phone while online, then close it fully (swipe it away from recent apps) and open it again to get the new version. Your logged data is not affected by updates.

To change the icon, edit `tools/make-icons.js`, run `node tools/make-icons.js`, then bump `VERSION`.

## Changing the programme

The programme is the `PROGRAMME` list at the top of `app.js`. Each exercise has:

- `key`: stable id saved in every session. Rename `name` freely. If you change `key`, old sessions still appear in History under the old key, but the workout screen shows "First time" and progression starts again.
- `name`: what is shown.
- `reps`: target reps per set, or `'failure'`.
- `load`: leave out for normal weights, `'added'` for bodyweight plus belt, `'none'` for no weight field.
- `inc`: kg added when all three sets reach the target. Leave it out for `'none'`.
- `rest`: rest timer in seconds.
- `goal`: for `'failure'` exercises, the reps on all sets that trigger "Add weight" (pull-ups use 10).

A few things to know:

- The day letter is saved in each session too. Adding a day is safe. If you rename or remove a day, its old sessions stay in History under the old letter, but they no longer count for that day's "Last done" or for the rotation. Finish or discard a workout in progress first: a workout in progress for a day that no longer exists is dropped.
- A key may appear on more than one day only with identical settings, because the days then share its history.
- The sentence at the top of the home screen is `INTRO`, just below `PROGRAMME`. Update it when you change targets.
- Run `node test.js programme` afterwards. It catches typos such as `load: 'add'`, `reps: '10'` or `inc: '2.5'`.

Remember to bump `VERSION` in `sw.js` afterwards.

## Progression rule

When a workout starts, each exercise looks up the most recent finished session that contains it. If all three sets reached the target, the weight fields are prefilled with last weight plus the increment and an "Add weight" badge is shown. Otherwise last weight is prefilled. With no previous session the weight is left empty. If the last session used different weights across sets, the heaviest is used. Reps are whole numbers: a half rep such as 9.5 is saved as 9, so it does not reach a target of 10.

## In the gym

- Tap **Done** after each set. It fills in the target reps if the reps field is empty, copies the weight down to later empty sets and starts the rest timer. Tap it again to undo: reps that Done filled in are cleared again, reps you typed stay. After typing the reps, the keyboard's Done key also marks the set done.
- A weight or reps entry that is not a plain number, for example `62,,5`, stays as typed, outlined in red, and is not saved until you correct it. **Done** never writes over it.
- **Finish** saves straight away, keeping only the sets that have reps. With nothing logged it shows a message and does nothing.
- **Discard**, **Delete** and starting a different day ask for a second tap. A quick double tap does not count as the second tap.
- The Android back gesture on a workout or on History returns to Home and, like **Back**, stops the rest timer. On Home it closes the app.
- If Chrome reloads the page during a rest, the countdown carries on. That rest ends with "Go" on screen but may not beep, since sound needs a tap on Done or the timer first.

## Your data and backups

Everything is stored in this browser's local storage on the phone: `fbl.v1.sessions` (finished workouts), `fbl.v1.draft` (the workout in progress) and `fbl.v1.meta` (time of the last export). Session storage keeps `fbl.v1.view` (the open screen) and `fbl.v1.timer` (a running rest) for the open tab only. Nothing is sent anywhere. Clearing Chrome's site data or uninstalling the app deletes it.

All your GitHub Pages project sites share the address `YOUR-NAME.github.io`, and so share this storage. Clearing site data for any of them also deletes this log, and a second copy of this app published from another repository would use the same log.

Open **Menu > Export backup** regularly. It downloads a JSON file of all sessions, `{ "app": "full-body-log", "format": 1, "exported": "...", "sessions": [...] }`; keep it in Drive or email it to yourself. **Import backup** reads such a file (a plain array of sessions also works) and merges it in by session id, so importing the same file twice never creates duplicates. Importing an older backup brings back sessions you deleted after making it. Files over 10 MB are refused. The home screen's backup card turns red once you have logged a workout and never exported, or 14 days after the last export.

To move to a new phone: export on the old one, install on the new one, import.
