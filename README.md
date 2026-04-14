# F1 Strategy Hub

A comprehensive Formula 1 analytics platform featuring live data dashboards, race strategy simulation, telemetry analysis, and historical championship insights. Built with React and Python, powered by real F1 data from the OpenF1 API, Jolpica F1 API, and FastF1.

## Features

### React Frontend (Live Dashboard)

**Live Championship Dashboard** — Real-time driver and constructor standings, race calendar, and latest results pulled directly from the Jolpica F1 API.

**Race Strategy Simulator** — Interactive tire degradation modeling with configurable physics parameters. Compare two strategies side-by-side with lap time projections, gap analysis, and visual stint breakdowns. Supports multiple circuits, tire compounds, and degradation models (linear and cliff).

**Driver Comparison Tool** — Head-to-head analysis using live championship data. Includes radar performance profiles, race-by-race finishing positions, points comparison, and win statistics.

**Telemetry Viewer** — Browse any session from 2023 onward via the OpenF1 API. View lap time progressions, sector time breakdowns, tire strategy timelines, and detailed lap-by-lap tables with compound tracking.

**Championship History** — All World Champions from 1950 to present. Visualizations include titles-per-driver bar charts, nationality breakdowns, and constructor championship histories.

### Python Analysis (FastF1)

**Telemetry Analysis** (`telemetry_analysis.py`) — Speed trace comparison, track speed heatmaps, lap time distribution violin plots, and tire strategy timelines using FastF1's rich telemetry data.

**Race Pace Model** (`race_pace_model.py`) — Tire degradation curve fitting with quadratic models, degradation rate comparison across stints, and optimal pit window calculation.

**Qualifying Gap Analysis** (`qualifying_gap_analysis.py`) — Teammate qualifying gap trends, season-long gap evolution, and team competitiveness analysis.

## Data Sources

| Source | Type | Auth | Coverage |
|--------|------|------|----------|
| [OpenF1 API](https://openf1.org) | REST API | None | 2023+ live telemetry, lap times, positions, weather, pit data |
| [Jolpica F1 API](https://github.com/jolpica/jolpica-f1) | REST API | None (200 req/hr) | 1950-present standings, results, schedules, lap times |
| [FastF1](https://docs.fastf1.dev) | Python package | None | 2018+ detailed telemetry, car data, tire data |

## Tech Stack

**Frontend:** React 18, Recharts, Lucide React, Axios
**Backend/Analysis:** Python 3.10+, FastF1, Pandas, NumPy, Matplotlib, SciPy, Scikit-learn
**Deployment:** GitHub Pages (frontend), local execution (Python)

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm start
```

The app runs at `http://localhost:3000` and fetches live data from the free APIs.

### Python Analysis

```bash
cd analysis
pip install -r requirements.txt

# Telemetry comparison
python scripts/telemetry_analysis.py --year 2025 --race "Bahrain" --drivers VER HAM NOR

# Race pace model
python scripts/race_pace_model.py --year 2025 --race "Bahrain" --driver VER

# Qualifying gaps
python scripts/qualifying_gap_analysis.py --year 2025 --races 10
```

Generated visualizations are saved to `docs/images/`.

### Deploy to GitHub Pages

```bash
cd frontend
npm run deploy
```

## Project Structure

```
f1-strategy-hub/
├── frontend/                    # React application
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.js          # Live standings & calendar
│   │   │   ├── StrategySimulator.js  # Tire strategy modeling
│   │   │   ├── DriverComparison.js   # Head-to-head analysis
│   │   │   ├── TelemetryViewer.js    # OpenF1 telemetry data
│   │   │   └── ChampionshipHistory.js# Historical champions
│   │   ├── services/
│   │   │   ├── openf1.js             # OpenF1 API client
│   │   │   └── jolpica.js            # Jolpica (Ergast) API client
│   │   ├── data/
│   │   │   └── constants.js          # Team colors, tire compounds
│   │   ├── hooks/
│   │   │   └── useApi.js             # Custom React hook for API calls
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── analysis/                    # Python analysis scripts
│   ├── scripts/
│   │   ├── telemetry_analysis.py     # Speed traces & track maps
│   │   ├── race_pace_model.py        # Degradation modeling
│   │   └── qualifying_gap_analysis.py# Teammate gap analysis
│   ├── notebooks/                    # Jupyter notebooks
│   └── requirements.txt
├── docs/                        # Generated images & documentation
└── README.md
```

## Key Engineering Decisions

**API Caching** — Both API services implement in-memory caching with TTL to minimize requests and stay within rate limits. The OpenF1 service uses 5-minute TTL for potentially live data; Jolpica uses 30-minute TTL for historical data that changes infrequently.

**Tire Physics Model** — The strategy simulator uses a simplified but realistic degradation model that accounts for compound-specific grip bonuses, fuel load reduction, track evolution, and configurable cliff behavior. The quadratic degradation curve is standard in F1 strategy modeling.

**FastF1 Integration** — Python scripts use FastF1's caching layer to avoid re-downloading large telemetry datasets. The `curve_fit` approach for degradation modeling mirrors real F1 engineering methodology.

## Contributing

Contributions are welcome. Some ideas for expansion:

- Weather impact correlation analysis
- Machine learning lap time predictions
- Live race position tracking with WebSocket
- Pit stop performance benchmarking
- Historical era-adjusted comparisons

## License

MIT
