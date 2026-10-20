# Undercut

**Formula 1 race strategy and telemetry analytics, built on real timing data.**

[**Live site →**](https://rifatibnalam.github.io/f1-strategy-hub/) · [**Offline demo →**](https://rifatibnalam.github.io/f1-strategy-hub/?demo) (bundled data snapshot, no live APIs needed)

Undercut pairs a lap-by-lap race strategy model with live data from every session since 2023. The model is fitted to real races and backtested on races it hasn't seen. It is stress-tested against random safety cars and searched exhaustively for the fastest plan. Around it sit live standings, car telemetry, race analysis and 76 years of championship history, plus Python scripts for deeper FastF1 work.

![Strategy optimiser](docs/screenshots/optimiser.png)

## What's inside

| Page | What it does |
| --- | --- |
| **Dashboard** | Live driver and constructor standings, next-race countdown, calendar in your timezone, last race result |
| **Strategy Sim** | Lap-time model, exhaustive 1-/2-stop optimiser, safety-car Monte Carlo, calibration and backtest on real races, real tyre-degradation fits |
| **Driver Compare** | Head-to-head points progression (including sprints), race-by-race deltas, result distribution, grid vs finish |
| **Telemetry** | Lap and sector times, tyre stints, and speed/throttle/brake/gear traces for any lap; sector-by-sector driver comparison |
| **Race Flow** | Lap-by-lap position chart for races from recent seasons, with positions gained |
| **Pit Battles** | Detects undercuts and overcuts between two drivers from line-crossing timestamps |
| **Championships** | Every title since 1950: dynasty timeline, eras, nationalities, verified records |

## Highlights

- **Model calibrated on real races, with a backtest.**
  - A fixed-effects least-squares regression over every clean lap of a race estimates compound pace, tyre wear and the combined fuel/track gain. The car+driver effect is separated out, so a fast car on hards doesn't make hards look quick.
  - Pit loss is measured from in-lap and out-lap times.
  - The fit is scored **out of sample** on the same circuit's race a season later, against a per-driver-median baseline.
  - It then compares the winner's actual strategy with the model's optimum.
- **Safety-car Monte Carlo.**
  - 2,000 simulated races with Poisson-distributed safety cars and an optional "pit under SC" policy.
  - Common random numbers across strategies, so comparisons reflect the plans, not luck.
  - Reports expected race time, P10–P90 spread and win probability, and flags when uncertainty changes the best choice.
- **Strategy optimiser.** Searches every legal 1- and 2-stop plan (~30k candidates, memoised stint costs). It enforces race distance and the two-compound rule.
- **Real car telemetry.** Distance is integrated from OpenF1's ~3.7 Hz `car_data`, with synced cursors across channels.
- **Fuel-corrected tyre degradation.** Per-stint fits use true tyre age, including used sets.
- **Works offline.** CI snapshots live API responses at build time and weekly. If OpenF1 or Jolpica fail, the app serves the saved data and says so. `?demo` forces offline mode for live demos.

![Monte Carlo](docs/screenshots/monte-carlo.png)

## Strategy model

```
lapTime = basePace + compoundOffset + degRate × tyreAge + cliffPenalty
        + fuelEffect × fuelOnBoard + trackEvolution × (lap − 1)
```

Each pit stop adds the circuit's pit-lane loss. Default parameters are representative values tuned to published Pirelli/FIA ranges, not team data. They reproduce real trade-offs: medium→hard one-stops at Monza and Silverstone, two-stops at high-degradation tracks.

- **Calibration** (`src/models/calibration.js`) replaces the defaults with values fitted to a real race:

  ```
  lapTime = driverPace[d] + compoundOffset[c] + wear[c] × tyreAge + k × (lap − 1)
  ```

  Fuel burn and track evolution are collinear in timing data, so `k` captures both. The simulator splits it back out using its assumed fuel effect.
- **Monte Carlo** (`src/models/montecarlo.js`) adds safety cars: count ~ Poisson(circuit rate), 3–5 laps each at 1.4× base pace, and a stop under SC costs 45% of normal pit loss. Circuit rates are rough estimates from recent seasons.

**Known limits:**
- The model ignores traffic and overtaking difficulty, so it can recommend a Monaco two-stop that track position would never allow.
- Virtual safety cars and red flags are not modelled.

## Engineering notes

- **Data correctness.**
  - Team colours resolve from Jolpica ids, Jolpica names or OpenF1 names (2026 grid, including Audi and Cadillac), and prefer OpenF1's official `team_colour`.
  - Mid-season transfers use the driver's latest team.
  - Points include sprints, DNFs come from the classification, and "grid" is the real starting grid after penalties.
- **Colour system.**
  - Light and dark themes are built on CSS variables.
  - Team colours are used unchanged for lines, bars and swatches. Text in a team colour is mixed toward the theme's text colour with `color-mix()`, so Mercedes cyan or Haas grey stay readable on light panels.
  - Labels on coloured tiles pick black or white by WCAG contrast.
  - Teammates in two-driver views get a contrasting colour; in the race-flow chart the second driver of a team is dashed.
  - Generic UI states (positive, warning, accent) use semantic colours rather than borrowing a team's.
- **Resilient data layer.**
  - In-memory caching with TTLs, and exponential back-off on HTTP 429.
  - A `useApi` hook that drops stale responses.
  - A snapshot fallback recorded by `scripts/snapshot.mjs`, which runs the app's own service modules under Node so the saved URLs match the browser's requests exactly.
- **Robust UI.** An error boundary per view, hash routing for shareable links (`#/strategy`) that works on GitHub Pages, and safe `localStorage` access.
- **Tests.**
  - 41 Jest unit tests: the regression recovers known parameters from a synthetic race, the backtest beats its baseline out of sample, the Monte Carlo is reproducible, plus the strategy model, optimiser and data helpers.
  - A Playwright end-to-end suite drives every page against deterministic API fixtures. It also checks the API-down fallback, that `?demo` makes zero live requests, and that no page scrolls horizontally at phone width.
  - Unit and e2e tests both gate every deploy.

## Stack

- **Frontend:** React 18, Recharts, Lucide React
- **Analysis:** Python 3.10+, FastF1, Pandas, NumPy, Matplotlib, SciPy
- **Data:**
  - [OpenF1](https://openf1.org) (2023+): sessions, laps, stints, car telemetry
  - [Jolpica F1](https://github.com/jolpica/jolpica-f1) (1950+): results, standings, schedules, lap positions
  - [FastF1](https://docs.fastf1.dev): Python analysis
- **CI/CD:** GitHub Actions → GitHub Pages

## Project structure

```text
├── frontend/
│   ├── e2e/              # Playwright suite + deterministic API fixtures
│   ├── scripts/          # Build-time API snapshot
│   └── src/
│       ├── components/   # One component per page, plus shared widgets
│       ├── models/       # Strategy model, optimiser, calibration, Monte Carlo (pure, unit-tested)
│       ├── services/     # OpenF1 and Jolpica clients + offline snapshot fallback
│       ├── hooks/        # useApi
│       └── data/         # Team colours, flags, championship history
├── analysis/
│   ├── scripts/          # FastF1 telemetry, race pace, qualifying gap scripts
│   └── requirements.txt
├── docs/screenshots/
└── .github/workflows/    # Test + snapshot + build + deploy
```

## Getting started

```bash
cd frontend
npm install
npm start          # http://localhost:3000
npm test           # unit tests
npm run snapshot:mock && npm run build && npm run e2e   # end-to-end suite (offline fixtures)
npm run snapshot   # capture live API data into public/snapshot/ (as CI does)
```

Python analysis:

```bash
cd analysis
pip install -r requirements.txt
python scripts/telemetry_analysis.py --year 2025 --race "Monza" --drivers NOR PIA LEC
python scripts/race_pace_model.py --year 2025 --race "Monza" --driver NOR
python scripts/qualifying_gap_analysis.py --year 2025 --races 10
```

Figures are written to `docs/images/`, and FastF1 caches data in `analysis/cache/`.

## Deployment

Pushing to `main` runs the unit and end-to-end tests, snapshots live API data, builds the app and deploys it to GitHub Pages via `.github/workflows/deploy-pages.yml`. A weekly scheduled run refreshes the snapshot after race weekends. Pull requests run everything except the deploy.

## Notes

- API-backed pages depend on OpenF1 and Jolpica availability and rate limits; the snapshot covers the latest race when they are down. OpenF1 data starts in 2023.
- OpenF1 telemetry is sampled at ~3.7 Hz, so traces are smoother than team data, and integrated distance can drift slightly from the official lap length.
- Undercut is an independent project and is not affiliated with Formula 1, the FIA or any team.

## License

MIT. See [LICENSE](LICENSE).
