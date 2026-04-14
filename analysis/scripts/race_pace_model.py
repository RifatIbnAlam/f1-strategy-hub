"""
F1 Race Pace & Degradation Model
==================================
Uses FastF1 data to model tire degradation curves and predict
optimal pit stop windows. This is the type of analysis F1 strategy
engineers use during race weekends.

Usage:
    python race_pace_model.py --year 2025 --race "Bahrain" --driver VER
"""

import argparse
import fastf1
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib as mpl
from scipy import stats
from scipy.optimize import curve_fit
import os

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

COMPOUND_COLORS = {
    'SOFT': '#FF3333', 'MEDIUM': '#FFD700', 'HARD': '#EEEEEE',
    'INTERMEDIATE': '#43B02A', 'WET': '#0067AD',
}


def degradation_model(x, a, b, c):
    """Quadratic degradation model: time = a*x^2 + b*x + c"""
    return a * x**2 + b * x + c


def analyze_degradation(session, driver_code):
    """
    Analyze tire degradation for each stint and fit degradation curves.
    Returns stint data with fitted models.
    """
    laps = session.laps.pick_driver(driver_code).pick_quicklaps(1.1)

    if laps.empty:
        print(f"No quick laps found for {driver_code}")
        return []

    stints = []
    for stint_num in laps['Stint'].unique():
        stint_laps = laps[laps['Stint'] == stint_num].copy()
        stint_laps = stint_laps.sort_values('LapNumber')

        compound = stint_laps['Compound'].iloc[0]
        lap_times = stint_laps['LapTime'].dt.total_seconds().values
        lap_numbers = stint_laps['LapNumber'].values
        tire_age = np.arange(1, len(lap_times) + 1)

        # Fit degradation model
        model_params = None
        deg_per_lap = 0
        if len(lap_times) >= 3:
            try:
                popt, _ = curve_fit(degradation_model, tire_age, lap_times,
                                   p0=[0.001, 0.03, lap_times[0]], maxfev=5000)
                model_params = popt
                # Degradation = slope at midpoint
                mid = len(tire_age) // 2
                deg_per_lap = 2 * popt[0] * mid + popt[1]
            except Exception:
                # Fallback to linear regression
                slope, intercept, _, _, _ = stats.linregress(tire_age, lap_times)
                deg_per_lap = slope

        stints.append({
            'stint_number': stint_num,
            'compound': compound,
            'lap_numbers': lap_numbers,
            'lap_times': lap_times,
            'tire_age': tire_age,
            'model_params': model_params,
            'deg_per_lap': deg_per_lap,
            'avg_pace': np.mean(lap_times),
            'best_pace': np.min(lap_times),
            'laps_completed': len(lap_times),
        })

    return stints


def plot_degradation_analysis(stints, driver_code, event_name,
                              output_name='degradation_analysis.png'):
    """
    Plot tire degradation curves with fitted models for each stint.
    """
    fig, axes = plt.subplots(1, 2, figsize=(18, 8))

    # Left: Raw lap times with degradation curves
    ax1 = axes[0]
    for stint in stints:
        color = COMPOUND_COLORS.get(stint['compound'], '#888888')
        ax1.scatter(stint['tire_age'], stint['lap_times'],
                   color=color, s=30, alpha=0.8, zorder=5,
                   label=f"S{stint['stint_number']} ({stint['compound']})")

        # Plot fitted curve
        if stint['model_params'] is not None:
            x_fit = np.linspace(1, stint['tire_age'][-1], 100)
            y_fit = degradation_model(x_fit, *stint['model_params'])
            ax1.plot(x_fit, y_fit, color=color, linewidth=2, alpha=0.8,
                    linestyle='--')

    ax1.set_xlabel('Tire Age (laps)', fontsize=12)
    ax1.set_ylabel('Lap Time (seconds)', fontsize=12)
    ax1.set_title(f'{driver_code} — Tire Degradation Analysis',
                  fontsize=14, fontweight='bold', color='white')
    ax1.legend(fontsize=10, framealpha=0.3)
    ax1.grid(True, alpha=0.1)

    # Right: Degradation rate comparison
    ax2 = axes[1]
    compounds = [s['compound'] for s in stints]
    deg_rates = [s['deg_per_lap'] * 1000 for s in stints]  # Convert to ms/lap
    colors = [COMPOUND_COLORS.get(c, '#888') for c in compounds]
    labels = [f"S{s['stint_number']}\n{s['compound']}" for s in stints]

    bars = ax2.bar(range(len(stints)), deg_rates, color=colors, width=0.6,
                   edgecolor='#0a0a12', linewidth=1)

    for bar, rate in zip(bars, deg_rates):
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                f'{rate:.0f} ms/lap', ha='center', va='bottom',
                fontsize=10, color='#e0e0e0', fontweight='bold')

    ax2.set_xticks(range(len(stints)))
    ax2.set_xticklabels(labels, fontsize=10)
    ax2.set_ylabel('Degradation Rate (ms/lap)', fontsize=12)
    ax2.set_title('Degradation Rate by Stint', fontsize=14,
                  fontweight='bold', color='white')
    ax2.grid(True, axis='y', alpha=0.1)

    fig.suptitle(f'{event_name} — Race Pace Model', fontsize=18,
                 fontweight='bold', color='#e10600', y=1.02)
    plt.tight_layout()
    plt.savefig(f'{OUTPUT_DIR}/{output_name}', dpi=150, bbox_inches='tight')
    plt.close()
    print(f"Saved: {OUTPUT_DIR}/{output_name}")


def optimal_pit_window(stints, total_laps, pit_loss_seconds=22):
    """
    Calculate the theoretically optimal pit stop window.
    Finds the lap where switching compounds yields net time gain.
    """
    print("\n" + "=" * 60)
    print("  OPTIMAL PIT WINDOW ANALYSIS")
    print("=" * 60)

    for i, stint in enumerate(stints):
        if stint['model_params'] is not None:
            a, b, c = stint['model_params']
            # Find lap where marginal time loss = potential gain from fresh tires
            # Simplified: when deg_rate * remaining_laps > pit_loss
            max_tire_age = stint['tire_age'][-1]
            for lap in range(1, max_tire_age + 10):
                marginal_cost = 2 * a * lap + b
                remaining = total_laps - stint['lap_numbers'][0] - lap + 1
                if remaining > 0 and marginal_cost * remaining > pit_loss_seconds:
                    print(f"\n  Stint {stint['stint_number']} ({stint['compound']}):")
                    print(f"    Optimal pit at tire age: ~{lap} laps")
                    print(f"    Degradation at pit: {marginal_cost*1000:.0f} ms/lap")
                    print(f"    Avg pace: {stint['avg_pace']:.3f}s")
                    print(f"    Best pace: {stint['best_pace']:.3f}s")
                    break
            else:
                print(f"\n  Stint {stint['stint_number']} ({stint['compound']}): "
                      f"Tire life sufficient — no early pit recommended")

    print("\n" + "=" * 60)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='F1 Race Pace Model')
    parser.add_argument('--year', type=int, default=2025)
    parser.add_argument('--race', type=str, default='Bahrain')
    parser.add_argument('--driver', type=str, default='VER')
    args = parser.parse_args()

    print(f"Loading {args.year} {args.race}...")
    session = fastf1.get_session(args.year, args.race, 'R')
    session.load()

    print(f"Analyzing {args.driver} degradation...")
    stints = analyze_degradation(session, args.driver)

    if stints:
        event_name = f"{session.event['EventName']} {session.event.year}"
        plot_degradation_analysis(stints, args.driver, event_name)
        optimal_pit_window(stints, session.total_laps or 57)
    else:
        print("No stint data available.")
