# FlyFit

A fast, offline-first workout tracker built as an installable web app. It runs on your phone, needs no account or server, and keeps your data on your device.

## Features

- **Workout logging**: log weight × reps per set and tap ✓ to complete it. Each set shows what you did last time, and tapping that "Previous" value copies it in.
- **Rest timer**: starts on its own when you finish a set, with ±15s and skip, and it vibrates and beeps when time is up.
- **Routines**: reusable templates you build yourself. Starting one pre-fills weights from your last session.
- **Personal records**: on finishing a workout, FlyFit flags a new heaviest weight, best estimated 1RM (Epley), or most reps for bodyweight moves.
- **History**: every workout with duration, volume and sets. You can repeat a workout or save it as a routine.
- **Progress charts**: est. 1RM, top weight, volume and best reps per exercise, plus a body-weight log and trend.
- **Home dashboard**: workouts and volume this week, plus your weekly streak.
- **Exercise library**: empty for now (to be filled from your training program in `js/exercises.js`). You can add custom exercises in the app at any time.
- lb / kg (switch any time; data is stored in kg internally), and dark and light themes.
- **Backup**: export and import a JSON file, for safekeeping or moving to a new phone.

## Run it

No build step. Serve the folder with any static server:

```sh
npm start            # python3 -m http.server 8080
# open http://localhost:8080
```

Opening `index.html` directly also works, but offline mode and "Add to Home Screen" install need it served over http(s).

## Put it on your phone

Host the folder on any static host (GitHub Pages works: Settings → Pages → deploy from the branch root). Then open the URL on your phone:

- **iPhone (Safari)**: Share → *Add to Home Screen*
- **Android (Chrome)**: menu → *Install app*

It then opens full-screen like a native app and works offline.

> Data lives in the browser's local storage on that device. Use **Settings → Export backup** regularly.

## Tests

```sh
npm test             # unit tests for the workout math (Node 18+)
```

## Project layout

```
index.html            App shell
css/styles.css        Styles (mobile-first, dark/light)
js/logic.js           Pure workout math: 1RM, volume, PRs, streaks (unit-tested)
js/exercises.js       Built-in exercise library
js/app.js             UI, routing, state, rest timer, charts
sw.js                 Service worker (offline support)
manifest.webmanifest  Install metadata
tests/                Node test suite
```
