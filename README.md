# GeoZest

![GitHub License](https://img.shields.io/github/license/AumGupta/GeoZest)
![GitHub last commit](https://img.shields.io/github/last-commit/AumGupta/GeoZest)
![GitHub repo size](https://img.shields.io/github/repo-size/AumGupta/GeoZest)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-light.svg">
  <img src="docs/assets/logo-dark.svg" width="120" alt="GeoZest logo">
</picture>

GeoZest is a minimal, map-first geography quiz game. Explore every country on a 3D globe, hear how places are said in their own languages, and test yourself on maps, flags, capitals, languages, currencies and borders.

**Try it:** [aumgupta.github.io/GeoZest](https://aumgupta.github.io/GeoZest/)

## Features

- Opens on a 3D globe facing your location.
- Four map views: Globe, Geoid (EGM96 heights), Equal Earth and Mercator, with smooth morphs between them.
- Country cards with population, area, languages, currency, borders and a fun fact.
- Native pronunciations of country names, capitals and languages, with IPA.
- Seven quiz modes: Locate, Identify, Capitals, Flags, Languages, Currencies and Neighbours.
- No giveaway questions. If an answer contains the country's name, the wrong options are made just as convincing.
- A daily challenge, XP levels, mastery by region and achievements.
- Light and dark themes, works on phone and desktop, no sign-up. Progress is saved in the browser.
- Installable as an app from the browser, and works offline once loaded.

## Screenshots

<p>
  <img src="docs/assets/screenshots/1.png" width="24%" alt="Globe">
  <img src="docs/assets/screenshots/2.png" width="24%" alt="Country card">
  <img src="docs/assets/screenshots/3.png" width="24%" alt="Quiz">
  <img src="docs/assets/screenshots/4.png" width="24%" alt="Geoid view">
</p>

## How scoring works?

### Points in a quiz

- A correct answer is worth **100 points**. A wrong answer is worth 0.
- **Speed bonus:** with the timer on, you get up to **50 extra points** for answering fast. The bonus shrinks over the 15 seconds and is gone when time runs out.
- **Streak bonus:** every correct answer in a row adds **10%** to the next one, up to double points after 10 in a row. A wrong answer resets the streak.

For example, answering in 3 seconds as your fourth correct answer in a row gives (100 + 40) × 1.3 = **182 points**.

### XP and levels

At the end of a quiz, your points turn into XP: **1 XP for every 10 points**, plus **10 XP** for finishing and **25 XP** for a perfect round.

Each level needs 100 XP more than the one before: 100 XP to reach level 2, 200 more to reach level 3, and so on.

### Mastery

- A country counts as **mastered** in a mode when your latest answer about it was right. Get it wrong later and it drops out again.
- **Mastery %** shows how much of each region you have mastered in each mode.
- **Known** counts the countries you have mastered in at least one mode.

### Which questions you get

Questions are picked to help you learn. Countries you got wrong come back more often, new ones come up normally, and ones you already know show up less.

### Daily challenge and streaks

- The **Daily** quiz has 6 mixed questions that stay the same all day, and you can play it once a day.
- Your **day streak** counts the days in a row on which you finished at least one quiz.

## How your progress is saved?

- Everything is saved **in your browser only**, using local storage. There is no account, no server and no tracking, so nothing about you leaves your device.
- It saves after every answer, so closing the tab mid-quiz loses nothing.
- What is saved: your XP, your last answer for each country in each mode, achievements, days played, daily results, your last 50 quizzes and your settings.
- Progress stays in the browser and device you played on. It does not sync to other devices, and clearing your browser's site data erases it.
- To start over, open your level (top right) and use **Settings > Progress > Reset**. Your settings are kept.
- The offline cache only stores the app's own files, never your progress.

## Development

### Tech Stack & Libraries Used

- Plain HTML, CSS and JavaScript. No framework and no build step for the app.
- [D3](https://d3js.org/) for projections and [TopoJSON](https://github.com/topojson/topojson-client) for borders, drawn on a single canvas.
- Web Audio for sound effects.

### Project Structure

```
index.html          page markup
css/style.css       all styles, light and dark themes
js/core.js          state, storage, sound, helpers and fun facts
js/map.js           flat map renderer, gestures and labels
js/globe.js         3D globe, geoid view and projection morphs
js/ui.js            sheets, country cards, pronunciation, search and settings
js/quiz.js          question generator and quiz flow
js/main.js          wiring and start-up
js/pwa.js           registers the offline cache
data/geo.js         countries, borders, flags, time zones and geoid grid (generated)
data/say/           pronunciation clips, one file per country
icons/              app icons
sw.js               offline cache
manifest.webmanifest  name, colours and icons used when installed
scripts/            script that rebuilds data/geo.js
```

### Run Locally

The app is static, but it loads pronunciation clips with `fetch`, so serve it rather than opening the file directly.

```
git clone https://github.com/AumGupta/GeoZest.git
cd GeoZest
npm start
```

Any static server works too, for example `python3 -m http.server`.

### Rebuild the Data

`data/geo.js` is already included. To regenerate it from the source packages:

```
npm install
npm run build:data
```

### How to Contribute

1. Fork the repository.
2. Clone your fork:

   ```
   git clone https://github.com/<your-username>/GeoZest.git
   ```
3. Run it locally, make your changes and test on both phone and desktop sizes.
4. Submit a Pull Request with your improvements.

## Data & Credits

- Borders: [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas).
- Country details: [world-countries](https://github.com/mledoze/countries).
- Capitals: [SimpleMaps World Cities](https://simplemaps.com/data/world-cities) (CC BY 4.0).
- Population: [World Bank](https://data.worldbank.org/indicator/SP.POP.TOTL), latest year per country.
- Geoid: EGM96.
- Flags: Wikimedia Commons.
- Pronunciation: AI4Bharat Indic-TTS, Kokoro, Piper, Mimic 3, Coqui and Meta MMS voices, with eSpeak NG as a fallback. IPA from eSpeak NG.

## License

GeoZest is licensed under the [GNU General Public License v3.0 (GPL-3.0)](LICENSE).

## Support & Feedback

For suggestions, feature requests, or bug reports, open an issue on the [Issues](https://github.com/AumGupta/GeoZest/issues) page.

If you enjoy GeoZest, consider [supporting the project](https://github.com/sponsors/AumGupta) or starring the repository on GitHub.
