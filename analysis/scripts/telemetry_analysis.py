"""
F1 Telemetry Analysis with FastF1
===================================
Analyze car telemetry data including speed, throttle, brake, gear, and DRS usage.
Generates publication-quality visualizations.

Usage:
    python telemetry_analysis.py --year 2025 --race "Bahrain" --session R --drivers VER HAM
"""

import argparse
import fastf1
import fastf1.plotting
import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np
from matplotlib.collections import LineCollection
import os

# Setup
fastf1.Cache.enable_cache('./cache')
mpl.rcParams['font.family'] = 'sans-serif'
mpl.rcParams['figure.facecolor'] = '#0a0a12'
mpl.rcParams['axes.facecolor'] = '#13132b'
mpl.rcParams['text.color'] = '#e0e0e0'
mpl.rcParams['axes.labelcolor'] = '#888888'
mpl.rcParams['xtick.color'] = '#666666'
mpl.rcParams['ytick.color'] = '#666666'

OUTPUT_DIR = '../docs/images'
os.makedirs(OUTPUT_DIR, exist_ok=True)


def load_session(year, race, session_type='R'):
    """Load an F1 session with telemetry data."""
    session = fastf1.get_session(year, race, session_type)
    session.load()
    return session


def plot_speed_comparison(session, driver_codes, output_name='speed_comparison.png'):
    """
    Compare speed traces between drivers on their fastest laps.
    This is the classic F1 telemetry visualization.
    """
    fig, axes = plt.subplots(4, 1, figsize=(16, 12), sharex=True,
                              gridspec_kw={'height_ratios': [3, 1, 1, 1]})

    colors = ['#e10600', '#3671C6', '#FF8000', '#27F4D2']

    for i, driver in enumerate(driver_codes):
        try:
            laps = session.laps.pick_driver(driver)
            fastest = laps.pick_fastest()
            car_data = fastest.get_car_data().add_distance()
            color = colors[i % len(colors)]

            # Speed trace
            axes[0].plot(car_data['Distance'], car_data['Speed'],
                        label=driver, color=color, linewidth=1.5)

            # Throttle
            axes[1].plot(car_data['Distance'], car_data['Throttle'],
                        color=color, linewidth=1)

            # Brake
            axes[2].plot(car_data['Distance'], car_data['Brake'].astype(int),
                        color=color, linewidth=1)

            # Gear
            axes[3].plot(car_data['Distance'], car_data['nGear'],
                        color=color, linewidth=1)
        except Exception as e:
            print(f"Warning: Could not load data for {driver}: {e}")

    axes[0].set_ylabel('Speed (km/h)', fontsize=10)
    axes[0].legend(loc='upper right', fontsize=10, framealpha=0.3)
    axes[0].set_title(
        f'{session.event["EventName"]} {session.event.year} — Fastest Lap Telemetry',
        fontsize=16, fontweight='bold', color='white', pad=15
    )
    axes[0].grid(True, alpha=0.1)

    axes[1].set_ylabel('Throttle %', fontsize=10)
    axes[1].set_ylim(-5, 105)
    axes[1].grid(True, alpha=0.1)

    axes[2].set_ylabel('Brake', fontsize=10)
    axes[2].set_ylim(-0.1, 1.1)
    axes[2].grid(True, alpha=0.1)

    axes[3].set_ylabel('Gear', fontsize=10)
    axes[3].set_xlabel('Distance (m)', fontsize=10)
    axes[3].set_ylim(0, 9)
    axes[3].grid(True, alpha=0.1)

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/{output_name}', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {OUTPUT_DIR}/{output_name}")


def plot_track_speed_heatmap(session, driver_code, output_name='track_speed.png'):
    """
    Visualize speed on the track layout using a color gradient.
    Creates a stunning track map with speed data overlaid.
    """
    laps = session.laps.pick_driver(driver_code)
    fastest = laps.pick_fastest()
    pos = fastest.get_pos_data()
    car = fastest.get_car_data()

    # Merge position and car data
    merged = pos.merge(car[['Speed', 'Time']], on='Time', how='inner')

    x = merged['X'].values
    y = merged['Y'].values
    speed = merged['Speed'].values

    # Create line segments colored by speed
    points = np.array([x, y]).T.reshape(-1, 1, 2)
    segments = np.concatenate([points[:-1], points[1:]], axis=1)

    fig, ax = plt.subplots(figsize=(14, 10))

    norm = plt.Normalize(speed.min(), speed.max())
    lc = LineCollection(segments, cmap='RdYlGn', norm=norm, linewidth=4)
    lc.set_array(speed[:-1])
    ax.add_collection(lc)

    cbar = plt.colorbar(lc, ax=ax, pad=0.02)
    cbar.set_label('Speed (km/h)', fontsize=12)
    cbar.ax.yaxis.label.set_color('#e0e0e0')
    cbar.ax.tick_params(colors='#888888')

    ax.set_xlim(x.min() - 500, x.max() + 500)
    ax.set_ylim(y.min() - 500, y.max() + 500)
    ax.set_aspect('equal')
    ax.axis('off')
    ax.set_title(
        f'{session.event["EventName"]} — {driver_code} Speed Map',
        fontsize=18, fontweight='bold', color='white', pad=20
    )

    plt.savefig(f'{OUTPUT_DIR}/{output_name}', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {OUTPUT_DIR}/{output_name}")


def plot_lap_time_distribution(session, driver_codes, output_name='lap_distribution.png'):
    """
    Violin plot showing lap time distribution for each driver.
    Great for understanding consistency vs raw pace.
    """
    fig, ax = plt.subplots(figsize=(14, 8))
    colors = ['#e10600', '#3671C6', '#FF8000', '#27F4D2']

    data = []
    labels = []

    for i, driver in enumerate(driver_codes):
        try:
            laps = session.laps.pick_driver(driver).pick_quicklaps()
            times = laps['LapTime'].dt.total_seconds()
            data.append(times.values)
            labels.append(driver)
        except Exception as e:
            print(f"Warning: Could not load data for {driver}: {e}")

    if data:
        parts = ax.violinplot(data, showmeans=True, showmedians=True)

        for i, pc in enumerate(parts['bodies']):
            pc.set_facecolor(colors[i % len(colors)])
            pc.set_alpha(0.7)

        ax.set_xticks(range(1, len(labels) + 1))
        ax.set_xticklabels(labels, fontsize=12)
        ax.set_ylabel('Lap Time (seconds)', fontsize=12)
        ax.set_title(
            f'{session.event["EventName"]} — Lap Time Distribution',
            fontsize=16, fontweight='bold', color='white', pad=15
        )
        ax.grid(True, axis='y', alpha=0.1)

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/{output_name}', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {OUTPUT_DIR}/{output_name}")


def plot_tire_strategy_timeline(session, output_name='tire_strategy.png'):
    """
    Create a horizontal bar chart showing every driver's tire strategy.
    Classic F1 broadcast-style visualization.
    """
    COMPOUND_COLORS = {
        'SOFT': '#FF3333', 'MEDIUM': '#FFD700', 'HARD': '#EEEEEE',
        'INTERMEDIATE': '#43B02A', 'WET': '#0067AD', 'UNKNOWN': '#888888',
    }

    laps = session.laps
    drivers = laps['Driver'].unique()

    fig, ax = plt.subplots(figsize=(16, max(8, len(drivers) * 0.5)))

    for i, driver in enumerate(sorted(drivers)):
        driver_laps = laps.pick_driver(driver)
        stints = driver_laps[['Stint', 'Compound', 'LapNumber']].groupby('Stint')

        for stint_num, stint_data in stints:
            compound = stint_data['Compound'].iloc[0]
            start = stint_data['LapNumber'].min()
            end = stint_data['LapNumber'].max()
            color = COMPOUND_COLORS.get(compound, '#888888')

            ax.barh(i, end - start + 1, left=start - 1,
                   color=color, edgecolor='#0a0a12', linewidth=0.5, height=0.7)

    ax.set_yticks(range(len(sorted(drivers))))
    ax.set_yticklabels(sorted(drivers), fontsize=10)
    ax.set_xlabel('Lap Number', fontsize=12)
    ax.set_title(
        f'{session.event["EventName"]} — Tire Strategy',
        fontsize=16, fontweight='bold', color='white', pad=15
    )
    ax.invert_yaxis()
    ax.grid(True, axis='x', alpha=0.1)

    # Legend
    from matplotlib.patches import Patch
    legend_elements = [Patch(facecolor=c, label=n) for n, c in COMPOUND_COLORS.items()
                       if n in laps['Compound'].unique()]
    ax.legend(handles=legend_elements, loc='lower right', fontsize=10, framealpha=0.3)

    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/{output_name}', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {OUTPUT_DIR}/{output_name}")


def generate_race_report(session, top_n=5):
    """Print a text summary of key race statistics."""
    laps = session.laps
    results = session.results

    print(f"\n{'='*60}")
    print(f"  RACE REPORT: {session.event['EventName']} {session.event.year}")
    print(f"{'='*60}\n")

    if results is not None and not results.empty:
        print("TOP FINISHERS:")
        for _, row in results.head(top_n).iterrows():
            print(f"  P{row.get('Position', '?'):>2} | {row.get('Abbreviation', '???')} | "
                  f"{row.get('TeamName', 'Unknown')} | {row.get('Time', 'N/A')}")

    print(f"\nFASTEST LAP:")
    fastest = laps.pick_fastest()
    if fastest is not None:
        print(f"  {fastest.get('Driver', '???')} — {fastest.get('LapTime', 'N/A')}")

    print(f"\n{'='*60}\n")


# ─── CLI Entry Point ───────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='F1 Telemetry Analysis')
    parser.add_argument('--year', type=int, default=2025, help='Season year')
    parser.add_argument('--race', type=str, default='Bahrain', help='Race name or round number')
    parser.add_argument('--session', type=str, default='R', choices=['FP1', 'FP2', 'FP3', 'Q', 'R'],
                        help='Session type')
    parser.add_argument('--drivers', nargs='+', default=['VER', 'HAM'], help='Driver codes to analyze')
    args = parser.parse_args()

    print(f"Loading {args.year} {args.race} {args.session}...")
    session = load_session(args.year, args.race, args.session)

    print("Generating speed comparison...")
    plot_speed_comparison(session, args.drivers)

    print("Generating track speed heatmap...")
    plot_track_speed_heatmap(session, args.drivers[0])

    print("Generating lap time distribution...")
    plot_lap_time_distribution(session, args.drivers)

    print("Generating tire strategy chart...")
    plot_tire_strategy_timeline(session)

    print("Generating race report...")
    generate_race_report(session)

    print("\nAll visualizations saved to docs/images/")
