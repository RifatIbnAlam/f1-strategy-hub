# F1 Strategy Hub

F1 Strategy Hub is a Formula 1 analytics project that combines a live React dashboard with Python-based motorsport analysis workflows. It brings together real-world telemetry, historical race results, championship data, and strategy modeling in one place.

## Highlights

- Live driver and constructor standings, race calendar, and results
- Interactive race strategy simulator with tire compounds, stint planning, and degradation modeling
- Driver comparison views with head-to-head stats and visual breakdowns
- Telemetry exploration powered by OpenF1 session data
- Historical championship views covering drivers and constructors
- Python analysis scripts for telemetry, qualifying trends, and race pace modeling

## Stack

- Frontend: React 18, Axios, Recharts, Lucide React
- Analysis: Python 3.10+, FastF1, Pandas, NumPy, Matplotlib, SciPy, scikit-learn
- Data sources: OpenF1 API, Jolpica F1 API, FastF1

## Project Structure

```text
f1-strategy-hub/
├── frontend/               # React application
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── data/
│   │   ├── hooks/
│   │   └── services/
│   └── package.json
├── analysis/               # Python analysis scripts
│   ├── scripts/
│   └── requirements.txt
├── docs/
└── README.md
```

## Frontend Features

### Live Dashboard

Tracks current driver and constructor standings, recent results, and season schedule data using the Jolpica F1 API.

### Strategy Simulator

Models stint planning and lap-time evolution across different tire compounds and degradation assumptions. It is designed to compare strategies side by side and make tradeoffs easy to inspect visually.

### Driver Comparison

Compares drivers across wins, points, results trends, and broader performance indicators for quick season-level benchmarking.

### Telemetry Viewer

Surfaces OpenF1 telemetry and lap-level session data so you can inspect pace progression, sector splits, and tire usage trends.

### Championship History

Summarizes F1 title history with visual breakdowns for champions, constructors, and nationality-level trends.

## Analysis Scripts

### `telemetry_analysis.py`

FastF1-powered analysis for speed traces, lap distributions, and strategy-oriented telemetry views.

### `race_pace_model.py`

Fits degradation behavior and explores race pace patterns to estimate stint behavior and pit-window tradeoffs.

### `qualifying_gap_analysis.py`

Measures teammate qualifying gaps and season trendlines to compare one-lap performance over time.

## Data Sources

| Source | Coverage | Notes |
| --- | --- | --- |
| [OpenF1](https://openf1.org) | 2023 onward | Live and recent telemetry-oriented session data |
| [Jolpica F1 API](https://github.com/jolpica/jolpica-f1) | 1950 onward | Standings, schedules, and historical race results |
| [FastF1](https://docs.fastf1.dev) | 2018 onward | Detailed telemetry and motorsport session data in Python |

## Getting Started

### Run the frontend

```bash
cd frontend
npm install
npm start
```

The frontend starts on `http://localhost:3000`.

### Run the Python analysis scripts

```bash
cd analysis
pip install -r requirements.txt
```

Example commands:

```bash
python scripts/telemetry_analysis.py --year 2025 --race "Bahrain" --drivers VER HAM NOR
python scripts/race_pace_model.py --year 2025 --race "Bahrain" --driver VER
python scripts/qualifying_gap_analysis.py --year 2025 --races 10
```

## Deployment

The React app includes a `deploy` script for GitHub Pages:

```bash
cd frontend
npm run deploy
```

If you publish this through GitHub Pages, update the `homepage` field in [frontend/package.json](/Users/rifatibnalam/Library/Application%20Support/Claude/local-agent-mode-sessions/94ce2974-3f1d-4155-8c09-5e1a017c6428/2dda3153-fa5a-4593-8f58-6164569512b4/local_ba83b7f1-66cc-4ae4-a252-174bdf289836/outputs/f1-strategy-hub/frontend/package.json:1) to the final site URL before deploying.

## Notes

- API-backed views depend on third-party service availability and rate limits.
- FastF1 may cache data locally after the first run for faster repeat analysis.
- `frontend/node_modules` is intentionally excluded from version control.

## Roadmap Ideas

- Weather-adjusted strategy analysis
- Pit stop performance benchmarking
- Era-adjusted historical comparisons
- ML-assisted lap-time or stint prediction
- Expanded live session tracking

## License

This project is licensed under the MIT License. See [LICENSE](/Users/rifatibnalam/Library/Application%20Support/Claude/local-agent-mode-sessions/94ce2974-3f1d-4155-8c09-5e1a017c6428/2dda3153-fa5a-4593-8f58-6164569512b4/local_ba83b7f1-66cc-4ae4-a252-174bdf289836/outputs/f1-strategy-hub/LICENSE:1).
